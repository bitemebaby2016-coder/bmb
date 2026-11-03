# BMB G8-S3 — CONTROLLED SCHEDULER CUTOVER PREPARATION (AUDIT ONLY)

- Date: 2026-10-03 · Baseline: G8-S2 @ `1f93533` · Gate scope: AUDIT → CONTRACT → PLAN ONLY
- **NO production cutover performed. NO scheduler change. NO G6/G7 registration. NO real business queue execution.**
- Evidence probes: `e2e/g8s3AuditProbe.cjs` (READ-ONLY SQL via Management API — selects only)

## 1. CURRENT PRODUCTION BASELINE (verified live, read-only)

- Scheduler: `.github/workflows/automation-scheduler.yml` — 2 crons `*/5 * * * *` (notification_dispatch + orders_stale_pending) + `7 * * * *` (inventory_low_stock), `concurrency: bmb-automation` (queued, no cancel), `timeout-minutes: 5`, `workflow_dispatch` inputs job=all|dispatch|stale|stock
- Legacy traces (`audit_logs action='automation.execution'`): succeeded=1397, partial=5, failed=4 — live traffic confirmed (gh-stale/gh-dispatch traces at 10:21/10:38/11:07 UTC วันนี้)
- Queue: `automation_queue` RLS=true, 0 policies, **0 rows** (synthetic S2 evidence cleaned); 5 RPCs SECURITY DEFINER, EXECUTE เฉพาะ service_role (grants probed live)
- Secrets in play: `AUTOMATION_TOKEN` (GitHub repo secret + Supabase secret), publishable apikey inline (public by design) — ไม่มี Meta/Page token

## 2. LEGACY JOB INVENTORY (actual code)

| # | Job | Entrypoint | Cadence | Payload (exact from workflow) |
|---|---|---|---|---|
| 1 | notification_dispatch | POST `automation-worker` + `x-automation-token` | */5 min | `{job, eventId:"gh-dispatch-<UTCyyyyMMddTHHmm>", lookbackMinutes:360, limit:200}` |
| 2 | orders_stale_pending | เดียวกัน | */5 min | `{job, eventId:"gh-stale-<UTCyyyyMMddTHHmm>", maxAgeMinutes:120}` |
| 3 | inventory_low_stock | เดียวกัน | 7 * * * * (hourly) | `{job, eventId:"gh-stock-<UTCyyyyMMdTHH>", stockThreshold:3}` |

Worker semantics (`supabase/functions/automation-worker/index.ts`):
- unknown job → HTTP 400; invalid json → 400; bad token → 401
- **idempotency = deterministic eventId → audit_logs trace `auto-exec-<eventId>`**; prior succeeded → `{duplicate:true}` HTTP 200 no-op; default eventId = `<job>:<UTC hour-bucket>` (GH always passes explicit per-run eventId)
- side-effect idempotency: `notifications` deterministic id + `resolution=ignore-duplicates` (`notifyOnce`); insert failure = OBSERVABLE `failed:<status>` (ไม่เผลอนับเป็น duplicate)
- status: errors=0 → succeeded; errors>0 แต่มี results → **partial**; ไม่มี results → failed; exceptions ถูก catch ภายใน → ยังออก HTTP 200 เสมอ
- GH ตัดสิน fail เมื่อ: curl ล้มเหลว (HTTP non-200) หรือ status ∉ {succeeded, partial, duplicate:true}

## 3. WORKER INVENTORY

| Worker | Role | Auth | Idempotency | Retry |
|---|---|---|---|---|
| automation-worker (legacy, ACTIVE) | back-office notify/read-only | verify_jwt + x-automation-token | audit trace + notification PK | caller-driven เท่านั้น |
| social-ai-worker (G6, manual) | classify+reply draft | verify_jwt=false + x-automation-token + rate limit | social_events claim/attempts | internal releaseToRetryable |
| social-post-worker (G7, manual) | post draft → content_approvals | เดียวกัน | trace `g7-draft-<draft_ref>` + draft id PK | none (one-shot) |

## 4. QUEUE MAPPING (S3-02 — based on actual code, nothing invented)

| Dimension | notification_dispatch | orders_stale_pending | inventory_low_stock |
|---|---|---|---|
| CURRENT ENTRYPOINT | POST automation-worker | เดียวกัน | เดียวกัน |
| CURRENT CADENCE | */5 | */5 | hourly |
| NEW QUEUE JOB TYPE | `notification_dispatch` | `orders_stale_pending` | `inventory_low_stock` (ชื่อเดิม — ไม่ invent) |
| PAYLOAD | lookbackMinutes:360, limit:200 | maxAgeMinutes:120 | stockThreshold:3 |
| REFERENCE (idempotency seed) | `sched-dispatch-<UTC hour-bucket>` | `sched-stale-<UTC hour-bucket>` | `sched-stock-<UTC yyyy-MM-ddTHH>` |
| CANONICAL WORKER | automation-worker (unchanged) | เดียวกัน | เดียวกัน |
| RETRY CLASS (D03) | DB (30s base) — insert notification errors | DB (30s) | DB (30s) — notification only |
| MAX ATTEMPTS | 3 | 3 | 3 |
| FAILURE CLASSIFICATION | worker status failed→retryable; partial→pending OD-1; duplicate→succeeded | เดียวกัน | เดียวกัน |
| TIMEOUT | worker call ≤60s (< lease 5min — ปิดช่อง R-2) | เดียวกัน | เดียวกัน |
| IDEMPOTENCY KEY | eventId (trace PK) — คงเดิมที่ worker level | เดียวกัน | เดียวกัน |
| RESULT RECORDING | audit_logs automation.execution (unchanged) + automation_queue row | เดียวกัน | เดียวกัน |
| OPERATOR RECOVERY | replay_automation_job (dead→replay) + workflow_dispatch manual run | เดียวกัน | เดียวกัน |

## 5. G6 ASSESSMENT (S3-04)

- current role: AI capability — claim `social_events` (RECEIVED/comment) เองผ่าน claimEvent/attempts/releaseToRetryable
- invocation contract: POST + x-automation-token, body `{limit, event_id?}` — manual/internal เท่านั้น
- scheduler eligibility: **HOLD** — worker มี claim layer ของตัวเอง; การเอาเข้า automation_queue จะสร้าง **double-claim** (queue claim + social_events claim) ต้องออกแบบ adapter ก่อน
- queue eligibility: ต้องมี adapter ที่ map `fail_automation_job` ↔ releaseToRetryable semantics ให้ตรงกัน
- required authority: AUTOMATION_TOKEN + OPENROUTER_API_KEY (มีอยู่, server-side) — ไม่มี Meta
- risks: 429 rate_limit จาก G5 limiter (ต้อง classify retryable), AI timeout, double-retry amplification (queue retry × internal retry)
- **DECISION REQUIRED: G6 ไม่ register ใน cutover ครั้งแรก** (align D04 — register หลัง claim layer ผ่านจริงเท่านั้น)

## 6. G7 ASSESSMENT (S3-04)

- current role: post DRAFT generation → content_approvals (pending, created_by=NULL)
- invocation contract: POST + x-automation-token, body ต้องมี **brief/source_text** — ไม่มี scheduled payload contract (ไม่มีแหล่ง brief ตามเวลาใน code)
- scheduler eligibility: **HOLD — NO source of scheduled briefs exists**; การ schedule โดยไม่มี brief = ต้อง invent payload (ผิดข้อห้าม S3-02)
- queue eligibility: เทคนิคพร้อม (idempotent by draft_ref) แต่ semantic ไม่พร้อม (ไม่มีตัวตั้ง brief)
- required authority: AUTOMATION_TOKEN + OPENROUTER_API_KEY — ไม่มี Meta; publish path ไม่มีอยู่จริง
- risks: content_approvals backlog ถ้า schedule ถี่; duplicate drafts; brief sourcing policy เป็นธุรกิจ decision
- **DECISION REQUIRED: cadence + brief source ก่อนพิจารณา register**

## 7. SINGLE-PATH PROOF (S3-03)

Design (Option A — ตาม D01): GitHub Actions ยังเป็น trigger เดียว แต่เปลี่ยน step จาก direct-invoke → enqueue เข้า automation_queue (ผ่าน enqueue boundary — see §14) + dispatcher step

- BEFORE: GH Actions → HTTP automation-worker (direct, x-automation-token)
- AFTER: GH Actions → enqueue (service path) → automation_queue → claim_automation_jobs (atomic, SKIP LOCKED) → automation-worker execute → complete/fail (retry/DLQ)
- Transition = **one commit to automation-scheduler.yml**: old steps REMOVED ใน commit เดียวกับที่ new steps ADDED → ไม่มี commit ไหนที่ old=ON && new=ON (dual path เป็นไปไม่ได้ทาง git history)
- Guard: worker คงเดิม (ไม่แก้) — การสลับ path ขึ้นกับ GH step เท่านั้น; workflow_dispatch ยัง run ได้เฉพาะ new path
- Proof ที่จะเกิดใน cutover gate: pre-check grep `automation-worker` ใน yml ต้องเหลือเฉพาะ dispatcher invocation; synthetic queue e2e ต้องผ่านก่อน enable

## 8. RETRY COMPATIBILITY MATRIX (S3-06 — vs G8-D03)

| Case | Legacy behavior | G8-D03 policy | Conflict? | Resolution (design, ไม่แก้ business) |
|---|---|---|---|---|
| retryable failure (HTTP non-200/network) | caller-driven (GH exit 1, ลองใหม่ทุก 5 นาที) | queue backoff 30s×2^n+jitter, max 3 | ความถี่ต่างกัน | ยอมรับ — bounded; worker idempotent กัน side-effect ซ้ำ |
| non-retryable (401/400/unknown job) | GH แดงทุก run จนแก้ | dead ทันที | ตรงกัน | dead + replay โดย operator |
| timeout | GH timeout 5min kill | lease expiry → requeue | ตรงกัน (กลไกต่างกัน) | lease ครอบคลุม crash ระหว่าง execution |
| duplicate | `{duplicate:true}` = success | complete → succeeded | ตรงกัน | adapter ตีความ duplicate=true → complete |
| already-completed (hourly eventId) | duplicate no-op | queue row ใหม่ทุก tick | **CONFLICT (benign)** | enqueue ต้อง skip ถ้ามี active row ของ reference เดียวกัน (OD-2) |
| partial (errors + results) | GH = SUCCESS | D03 ไม่ระบุ | **CONFLICT — OD-1** | succeeded (observe) หรือ retryable (worker กัน duplicate ที่ notification PK แล้ว) |
| worker exception ภายใน | HTTP 200 + status failed | queue เห็น "สำเร็จ" ถ้าดูแค่ HTTP | **CONFLICT (critical)** | dispatcher ต้องดู **body.status** ไม่ใช่ HTTP code: failed→fail_automation_job(retryable) |
| unknown job / malformed payload | HTTP 400 | dead | ตรงกัน | dead + last_error 400 body |
| downstream unavailable (DB down) | non-200/timeout | backoff retry | ตรงกัน | — |

**ไม่พบ conflict ที่ต้องแก้ business behavior — ทุก conflict แก้ได้ที่ adapter/boundary layer โดย worker คงเดิม 100%** → ไม่ HARD STOP จาก S3-06 (partial classification รอ OD-1)

## 9. FAILURE MATRIX

- dead conditions: max attempts (3) · non-retryable reason (auth/validation/unknown_job) · lease-exhausted
- operator view: `automation_queue` (status/last_error/failure_reason) + audit_logs traces (unchanged)
- replay: `replay_automation_job` — dead เดิมคงอยู่, identity `-r<ts>`, attempt reset

## 10. SECURITY BOUNDARY (S3-07 — verified live)

- 5 RPCs: EXECUTE เฉพาะ **service_role** (probe ยืนยัน — ไม่มี grant anon/authenticated)
- RLS enabled + 0 policies → anon/authenticated deny table ทั้งหมด; service_role bypass
- anon ไม่มีทาง enqueue · authenticated customer ไม่มีทาง enqueue (ต้องผ่าน service path เท่านั้น)
- caller เลือก tenant/brand/business ไม่ได้ — queue schema ไม่มีช่องทาง; worker derive context จาก canonical tables (G7 pattern: `brands is_default=true`)
- payload ไม่มี credential field; worker creds มาจาก Deno.env เท่านั้น
- G6/G7 ยังไม่ถูก register → ไม่มี canonical bypass ใหม่เกิดขึ้นใน S3
- ไม่มี Meta credential / Page Access Token ในทุก path (code + workflow + secrets ที่ audit)

## 11. CUTOVER SEQUENCE (S3-05 — DESIGN ONLY, NOT EXECUTED)

1. PRE-CHECK: worktree clean · queue RPC probe PASS · npm test 488+ · audit trace cadence normal · enqueue boundary deployed + synthetic verified (แยก gate)
2. FREEZE: หยุด merge ทุก branch ที่แตะ scheduler; เลือกเวลา low-traffic; บันทึก HEAD ก่อน cutover
3. DISABLE OLD PATH + ENABLE QUEUE PATH: **commit เดียว** แก้ automation-scheduler.yml (ลบ direct steps, เพิ่ม enqueue+dispatch steps) + push
4. SYNTHETIC VERIFICATION: workflow_dispatch run → queue rows synthetic → claim → complete → cleanup exact-ID
5. OBSERVE: ≥2 ชั่วโมง — traces ต่อเนื่อง, ไม่มี dead สะสม, notification created/duplicate สมดุล
6. ACCEPT: ปิด freeze

## 12. ROLLBACK SEQUENCE (single state transition — no dual path)

- Revert = `git revert <cutover commit>` → workflow กลับ direct path ทั้งไฟล์ (old ON, new OFF พร้อมกันใน commit เดียว)
- Rollback triggers (any): no trace >15min · dead rate >10% · duplicate/created anomaly · enqueue boundary 5xx
- In-flight queue rows: drain รอจบ หรือ force-requeue หลัง lease — ตาม OD-5 · **ห้าม** สอง path รันพร้อมกันทุกกรณี
- Rollback ไม่ลบ queue table/RPC (infrastructure คงอยู่, inactive)

## 13. OBSERVABILITY / EVIDENCE PLAN

- ต่อเนื่อง: audit_logs automation.execution (คงเดิม — 1,406 traces เป็น baseline: 1397 succeeded / 5 partial / 4 failed)
- ใหม่: automation_queue rows (queued→…→succeeded/dead) + e2e evidence JSON (S2 pattern)
- S3 evidence: `e2e/g8s3AuditProbe.cjs` output (read-only) บันทึกใน §1 ของรายงานนี้

## 14. EXACT FILES REQUIRING MODIFICATION (ใน cutover gate ถัดไป — NOT NOW)

1. `.github/workflows/automation-scheduler.yml` — เปลี่ยน steps (single-commit toggle)
2. `supabase/functions/queue-dispatcher/index.ts` — **NEW** enqueue/claim-dispatch boundary (verify_jwt=false + x-automation-token, job_type allowlist, payload template per §4, body.status mapping, HTTP timeout 60s < lease 5min) — ต้อง synthetic e2e + owner gate ก่อน deploy
3. (optional, แยก migration) enqueue helper RPC / partial unique index ถ้าเลือก DB-level dedupe (OD-2)

## 15. EXACT DB OBJECTS REQUIRING MODIFICATION

- **NONE จำเป็น** — automation_queue + 5 RPCs (migration 110) รองรับ mapping ครบ
- ถ้า Owner เลือก DB-level dedupe: เพิ่ม partial unique index หรือ RPC `enqueue_automation_job` (additive, ต้อง gate ใหม่) — ไม่แก้ของเดิม

## 16. RISKS

- R-1: retry เร็วกว่า legacy (30s vs 5min) → downstream load ช่วง incident — mitigated: max 3 + backoff + jitter
- R-2: worker ไม่มี internal timeout → lease ต้อง > HTTP timeout ของ dispatcher (60s < 5min)
- R-3: GH schedule best-effort delay (แจ้งไว้ใน yml) — queue ไม่แก้ปัญหานี้ (D01 accepted)
- R-4: partial semantics ยังไม่ lock → ห้าม cutover ก่อน OD-1 (BLOCKER)
- R-5: enqueue boundary เป็นของใหม่ = attack surface ใหม่ — synthetic gate ก่อนใช้จริง
- R-6: rollback ช่วง in-flight rows — ต้อง lock drain policy (OD-5)

## 17. BLOCKERS (ต้องปลดก่อน cutover gate)

- B-1: enqueue boundary (queue-dispatcher) ยังไม่มี — ต้อง implement+deploy+synthetic verify ใน gate ของตัวเอง
- B-2: partial classification รอ Owner decision (OD-1)
- B-3: dedupe active-reference — adapter vs DB constraint (OD-2)
- B-4: G6/G7 registration นอก scope โดยปริยาย (D04) — gate แยก

## 18. OWNER DECISIONS REQUIRED

- OD-1: partial (errors + results) → succeeded หรือ retryable?
- OD-2: dedupe active-reference ที่ adapter หรือ DB constraint?
- OD-3: อนุมัติ gate ถัดไป implement `queue-dispatcher` (ของใหม่) ก่อน cutover?
- OD-4: ยืนยัน G6/G7 ยังไม่ register จนกว่า claim-adapter design ผ่าน gate แยก
- OD-5: rollback drain policy — drain รอจบ หรือ force-requeue ทันที

## 19. DUPLICATE / IDEMPOTENCY ANALYSIS (S3-06 — from actual code)

| Scenario | What happens | Existing protection | New boundary needed? |
|---|---|---|---|
| GitHub Actions retries the run | same minute → same `gh-*-<yyyyMMddTHHmm>` eventId → `previousExecution` sees succeeded trace → `{duplicate:true}` no-op | audit trace PK (`auto-exec-<eventId>`) | NO |
| GH re-run later (new eventId) | worker re-runs, but each canonical event notified via `notifyOnce` deterministic id + `resolution=ignore-duplicates` | notifications PK | NO |
| enqueue twice (same reference) | queue id = PK → second INSERT 409, original untouched (S2 QUEUE-13) | PK constraint | adapter skip optional (OD-2) |
| two workers claim concurrently | `FOR UPDATE SKIP LOCKED` single UPDATE → 1 winner (S2 QUEUE-03: 8→1) | atomic claim RPC | NO |
| worker completes but ack lost (crash before complete) | lease expires → requeue → attempt 2 → same eventId → prior trace `succeeded` → duplicate no-op (side effects NOT duplicated) | audit trace PK + notification PK | NO |
| worker failed (partial/failed trace) then requeued | trace not `succeeded` → re-execute; `notifyOnce` per-event dedupe กัน notification ซ้ำ | notifications PK | NO |
| worker times out mid-execution | legacy: killed, no trace → next run retry ปลอดภัย; queue: lease expiry → requeue, attempt preserved | worker dedupe เดิม | NO |
| lease expires AFTER business op completed, before ack | side effects persisted idempotently → retry = duplicate no-op (never double notification) | audit trace + notification PK | NO |
| same logical canonical event appears again | `notifyOnce(e.id …)` keyed by canonical event id → duplicate | canonical event id | NO |

**สรุป: ทุก duplicate scenario ถูกคุมโดย worker-level durable idempotency ที่มีอยู่จริง (audit trace PK + notifications deterministic PK + atomic claim)** — ไม่ต้องเพิ่ม worker-level dedupe → ไม่ HARD STOP จาก S3-06
- ข้อยกเว้นเดียว: enqueue-dedupe ระหว่าง schedule ticks (active-row skip) = adapter concern → OD-2 (ไม่ใช่ duplicate-execution risk — เป็น row hygiene)

## 20. RETRY CLASS VERIFICATION (S3-07 — code = migration 110 `fail_automation_job`)

`base := case p_reason when 'db_transient' then 30 when 'ai_failure' then 120 else 60 end; nxt := now() + base * 2^(attempt-1) * (0.8+random()*0.4)`

| D03 class | Spec | Code reality | Verdict |
|---|---|---|---|
| NETWORK | 3 attempts, 60→120→240 ±20% | base 60 (default), ×2^(n-1)×jitter(0.8–1.2), max_attempts=3 ที่ enqueue | MATCH |
| AI 5xx/429 | 3 attempts, 120s exp ±20% | p_reason='ai_failure' → base 120 | MATCH |
| AI timeout | **2 attempts**, 120s base ±20% | p_reason='ai_timeout' → **ตก else = 60s**; attempts = max_attempts ตอน enqueue (DB ไม่ enforce 2) | **GAP → OD-6** |
| DB transient | 3 attempts, 30→60→120 ±20% | p_reason='db_transient' → base 30 | MATCH |
| Worker timeout | lease expiry → requeue, attempt preserved | `requeue_stale_automation_jobs` (S2 QUEUE-05) | MATCH |
| Non-retryable 401/403/malformed/schema/safety/unknown | NOT retried | p_retryable=false → dead ทันที (S2 QUEUE-12); adapter ต้อง classify 400/401/422 → non-retryable | MATCH (design) |

- **Legacy 3 jobs ใช้ class เดียว (db_transient 30→60→120, 3 attempts) — ตรง D03 ทุกข้อ → ไม่ HARD STOP จาก S3-07**
- OD-6 (ใหม่): AI-timeout — patch migration `'ai_timeout'` → base 120 + max_attempts 2 (additive) หรือ adapter ส่ง reason='ai_failure' (ผลเท่ากัน) — ไม่กระทบ legacy cutover

## 21. PRODUCTION READINESS — OPEN SHOP ASSESSMENT (S3-08)

**A. software-ready** (จาก code audit):
- ORDER: order/checkout RPCs + RLS ใน repo migrations · PAYMENT: stripe-webhook/create-checkout/stripe-refund deployed · KITCHEN: ready-to-make gate (migration 054) · DISPATCH/DELIVERY: delivery_assignments (migration 020) + driver RPCs · TRACKING: order_status_history trigger (migration 040) · FAILURE HANDLING: automation notify path + queue infra (S2)
- Automation notify/observability = software-ready หลัง cutover ตาม plan นี้

**B. production-runtime-ready** — ยังไม่ครบ:
- cutover ยังไม่เกิด (legacy path ยัง active) · queue-dispatcher ยังไม่มี (B-1) · OD-1/OD-2/OD-5 ยังไม่ตัดสิน
- Meta/social messaging automation = FROZEN (G4 HOLD)

**C. external-service-ready**:
- Stripe: keys deployed (webhook/refund) — ต้องยืนยัน live-mode webhook ก่อน OPEN SHOP
- OpenRouter: ใช้งานได้ (G5–G7 evidence) — ไม่ใช่ dependency ของ order/payment path
- Meta/LINE/EMAIL/SMS/PUSH: **ไม่มี credentials** (declared, NOT configured — by design) → การแจ้งเตือนลูกค้าภายนอก in-app ยังไม่มี

**D. physical-operation-ready**: นอก scope software — Owner ต้องกำหนด: เปิดร้านจริง (menu_schedule publish, capacity), ครัว/ไรเดอร์ใช้ UI จริง, กระบวนการรับเหตุขัดข้อง

**GAPS ต่อ OPEN SHOP (โซ่ REAL ORDER→…→FAILURE HANDLING)**
| Chain | Gap |
|---|---|
| ORDER | E2E order จริง 1 รอบใน production (OWNER-LED) |
| PAYMENT | Stripe live-mode keys + webhook verify (OWNER-LED) |
| KITCHEN | ผู้ใช้จริง + device (OWNER-LED) |
| DISPATCH/DELIVERY | ไรเดอร์ account + assignment จริง (OWNER-LED) |
| TRACKING | order_status_history พร้อม (auto) — READY |
| FAILURE HANDLING | queue cutover (gate ถัดไป) · external notification transports ยังว่าง (design, G4-adjacent) |
| SOCIAL/MESSAGING | G4 HOLD — ไม่ block order flow ทางเว็บ |

## 22. NEXT GATE RECOMMENDATION

1. **G8-S4 (proposed)**: implement `queue-dispatcher` enqueue/claim boundary (ใหม่, additive) + synthetic e2e + ตัดสิน OD-1/OD-2/OD-5/OD-6 — ยังไม่ cutover
2. **G8-S5 (proposed)**: controlled cutover ตาม §11/§12 (single-commit toggle + observe) — หลัง S4 PASS + Owner authorize
3. **G8-S6 (proposed, optional)**: G6/G7 registration แยก gate (double-claim adapter design) — หลัง queue path นิ่ง
4. คู่ขนาน: OWNER-LED OPEN SHOP readiness (§21 C/D) — ไม่ผูกกับ G8 gates

