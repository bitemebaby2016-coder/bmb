# BMB G8-S0 — AUTOMATION RELIABILITY AUDIT (AUDIT ONLY)

- Date: 2026-10-03 · Baseline: G7 FINAL CLOSED @ `2424187` · HEAD == origin/main == `2424187`, WORKTREE CLEAN
- Method: read-only audit เท่านั้น — production mutation = NO · deploy = NO · migration = NO · source แก้ = NO
- ลำดับ evidence ตามคำสั่ง: production DB/traffic → deployed code → repo code → migrations → tests → docs

## 1. EXECUTIVE SUMMARY

Native BMB automation วันนี้ = **single external HTTP scheduler (GitHub Actions) + automation-worker Edge Function เดียว** ที่มี durable idempotency (DB-based) แต่**ไม่มี queue/lease/retry/backoff/dead-letter ในระดับ schema เลย** — ยืนยันจาก production DB probe (ทุก candidate queue table และ queue RPC = 404) ไม่ใช่จากเอกสาร

Reliability ปัจจุบันพึ่งพา 3 กลไกจำกัด: (1) deterministic event_id + audit trace → replay ได้แต่ถูกเท่านั้น, (2) GitHub Actions concurrency group → กัน concurrent scheduler runs, (3) AI-layer fallback (G5/G6 policy) → ใน-request เท่านั้น ไม่มี cross-run retry

G8 จึงต้องสร้าง reliability layer ใหม่จริง (ไม่มีของเดิมให้ต่อยอดด้าน queue) — แต่ต้องออกแบบให้ scheduler ใหม่ซ้อนอยู่เหนือ scheduler เดิมโดยไม่ duplicate execution (Owner decision จำเป็น ดู §14)

## 2. CURRENT AUTOMATION INVENTORY (จาก HEAD + production evidence)

**A. GitHub Actions — `.github/workflows/automation-scheduler.yml`**
- Cron 2 ตัว: `*/5 * * * *` (notification_dispatch + orders_stale_pending) · `7 * * * *` (inventory_low_stock) — หัวไฟล์ระบุชัด BEST-EFFORT, ไม่ใช่ SLA
- workflow_dispatch inputs: `all | dispatch | stale | stock`
- Concurrency: group `bmb-automation`, `cancel-in-progress: false` (queued — ไม่ cancel งานที่กำลังรัน)
- Auth ทุก step: `x-automation-token: ${{ secrets.AUTOMATION_TOKEN }}` + publishable apikey header — token ไม่ถูก echo
- Endpoint เดียว: `automation-worker` (3 jobs ผ่าน payload.job) · job FAIL ถ้า response ไม่ใช่ succeeded/partial/duplicate (fail visible ใน run history)
- **G6 reconciliation note (in-file):** G6 scheduler registration ถูก REMOVE แล้ว — social-ai-worker ยัง deploy แต่ manual/internal เท่านั้น · G7 ไม่มี registration

**B. Workers (แต่ละตัว architecture ต่างกันจริง — ไม่สมมติเหมือนกัน):**

| Field | automation-worker | social-ai-worker (G6) | social-post-worker (G7) |
|---|---|---|---|
| WORKER | W3-B back-office worker | AI capability (classify/draft) | AI draft persistence |
| TRIGGER | GH Actions cron 2 ตัว + manual dispatch | manual HTTP เท่านั้น (ไม่มี cron) | manual HTTP เท่านั้น (ไม่มี cron) |
| AUTH | verify_jwt=true + x-automation-token | **verify_jwt=false** + x-automation-token | verify_jwt=true + x-automation-token |
| CLAIM | ไม่มี (idempotency-replay แทน) | ไม่มี | ไม่มี |
| IDEMPOTENCY | DB-based: audit_logs id=`auto-exec-<event_id>`, succeeded → duplicate:true | per-event_id log เท่านั้น — **ไม่มี durable dedupe** | deterministic ref → duplicate no-op (S4-R2 พิสูจน์แล้ว) |
| STATUS | succeeded / partial / failed (in trace) | per-call status log | draft row = pending เท่านั้น |
| RETRY | ไม่มีใน worker (caller-driven) | in-request fallback model 1 ครั้ง (aiPolicy) | in-request AI retry (1 fallback); ไม่มี cross-run |
| BACKOFF | ไม่มี | ไม่มี | ไม่มี |
| CONCURRENCY | GH Actions group เท่านั้น (worker-level ไม่มี) | ไม่มี | ไม่มี (idempotency กันซ้ำ แต่ concurrent duplicate ยังทำ AI call 2 ครั้งได้) |
| FAILURE HANDLING | errors[] รวม, status partial/failed, trace บันทึกทุกครั้ง | fail-closed ต่อ request (422/500) | fail-closed, ไม่เขียน DB (S4-R2 F-series) |
| DEAD LETTER | ไม่มี | ไม่มี | ไม่มี |
| RECOVERY | manual re-dispatch (event_id เดิม/ใหม่) | manual re-invoke | manual re-invoke (ref เดิม = duplicate) |
| DEPLOYED | ACTIVE (production รันจริง — trace 1,406 executions) | ACTIVE v2 (G6) | ACTIVE v3 (G7) |
| AUTHORITY | ไม่แตะ business state (notification/audit เท่านั้น) | AI output เท่านั้น | draft INSERT เท่านั้น |

## 3. PRODUCTION DB EVIDENCE (read-only probe, `e2e/g8s0DbAudit.cjs`)

1. **มี queue จริงหรือไม่ → ไม่มี** — probe `automation_jobs / jobs / job_queue / queue / queued_jobs / scheduled_jobs / job_runs / dead_letter(_queue) / social_posts / social_drafts / worker_registrations` ทั้งหมด 404 (ไม่มีใน public schema, ไม่มีใน migration 001–109)
2. **มี durable job state หรือไม่ → มีแบบ trace เท่านั้น** — audit_logs (2,053 rows; cols id|user_id|user_email|action|entity_type|entity_id|description|metadata|ip_address|user_agent|created_at) โดย `action='automation.execution'` = **1,406 rows** (durable execution record จริง)
3. **มี retry state หรือไม่ → ไม่มี** — ไม่มี next_retry_at/retry_at/attempt counter ใน notifications (cols id|customer_id|title|message|is_read|notification_type|created_at|category|user_id) หรือ audit_logs
4. **มี lease/claim หรือไม่ → ไม่มี** — ไม่มี locked_at/claimed_at/lease fields ทุกตาราง; RPC probe enqueue_job/claim_job/complete_job/retry_job = 404 ทั้งหมด
5. **มี concurrency protection หรือไม่ → ระดับ scheduler เท่านั้น** (GH Actions concurrency group); worker/DB level ไม่มี
6. **มี terminal failure/dead-letter หรือไม่ → ไม่มี** — status='failed' ถูกบันทึกใน trace แต่ไม่มี state machine ต่อ / ไม่มี DLQ
7. **per-worker:** ดูตาราง §2 — automation-worker มี durable idempotency+trace; G6 ไม่มี durable dedupe; G7 มี ref-idempotency (draft-row authority) — ทุกตัวไม่มี retry/backoff/lease/DLQ

พบเพิ่ม: content_approvals rows = 0 (production สะอาดตาม G7 cleanup) · g7.draft audit = 0

## 4. SCHEDULER EVIDENCE (G8-S0-04)

- scheduler เดิมมีอะไร: GitHub Actions `automation-scheduler.yml` เท่านั้น — ไม่พบ pg_cron ใน migrations; comment "Called by: Supabase Cron (pg_cron)" ใน automation-worker header = **stale doc** (production ใช้ GH Actions — workflow คือ single source จริง)
- cron cadence: `*/5 * * * *` + `7 * * * *` · registered jobs: notification_dispatch, orders_stale_pending, inventory_low_stock
- **G6 registration ถูก remove จริง → ยืนยัน** (workflow note + ไม่มี job เรียก social-ai-worker)
- **G7 registration ไม่ได้ถูกเพิ่ม → ยืนยัน** (ไม่มี reference ไป social-post-worker ใน workflow)
- duplicate execution: scheduler ชุดเดียว + concurrency queued → ไม่มี duplicate scheduler ที่ขัดกันเอง
- concurrent GH runs: ป้องกันโดย group `bmb-automation` (queued, cancel-in-progress=false)
- worker-level concurrency: **ไม่ถูกป้องกัน** — manual invoke ระหว่าง cron ทำให้ read-then-write duplicate check ไม่ atomic (risk ต่ำตอนนี้เพราะ side effect มี notification dedupe แต่ AI workers จะโดน AI call ซ้ำแพง — ต้องแก้ใน G8)

## 5. G6/G7 WORKER INTEGRATION (G8-S0-03)

- internal invocation contract: POST /functions/v1/<worker> + `x-automation-token` header (G6: verify_jwt=false + token; G7: verify_jwt=true + token — G7 แข็งกว่า)
- AUTOMATION_TOKEN: internal automation credential อยู่ใน GitHub secret + Supabase secret (G7 audit: VALUE EXPOSED=NO) — G6 worker ไม่รู้จัก header นี้ก่อน G6 fix; ตอนนี้ทั้งสองรู้จัก (G6 D1/D2 negative)
- manual invocation path: operator ยิง HTTP ด้วย token — G7 มี evidence script pattern (invoke/review/cleanup) ใช้งานจริงแล้ว
- deterministic idempotency: G7 = client-supplied ref → same ref = duplicate no-op (พิสูจน์แล้วใน S4-R2-G) · G6 = event_id log เท่านั้น ไม่มี durable dedupe
- failure behavior: G7 fail-closed ไม่เขียน DB (422 malformed AI output, 4xx auth/contract); G6 fail-closed ต่อ request
- AI provider failure: ทั้งคู่มี fallback model 1 ครั้งใน-request (aiPolicy), 422 → AI_OUTPUT_REJECTED — ไม่ retry ข้าม run
- DB persistence failure: ถ้า INSERT ล้มเหลว → error response ไม่มี partial draft (transactional ของ PostgREST insert เดี่ยว)
- current claim/lease: ไม่มีทั้งคู่
- **safe to register into a scheduler NOW → G7: ใกล้เคียง (มี deterministic idempotency durable แล้ว แต่ควรมี claim กัน concurrent AI call) · G6: ไม่ปลอดภัย จนกว่าจะมี durable dedupe** (S4-R2 ไม่ได้ครอบคลุม scheduler-induced concurrent duplicates)
- ห้าม register จริงใน S0 — ยังไม่ได้ทำ

## 6. EXISTING RELIABILITY MECHANISMS (สรุป)

มีจริง: (1) deterministic-id idempotency (automation-worker trace / G7 ref), (2) GH Actions concurrency group, (3) AI fallback 1 ระดับ + timeout (aiPolicy/aiTimeout), (4) audit trail ครอบคลุม execution (1,406 records), (5) fail-closed AI validation
ไม่มี: queue, claim, lease, retry state, backoff, jitter, max attempts, DLQ, terminal state machine, stale-lease recovery, observability รวม (แค่ Actions history + audit_logs)

## 7. RELIABILITY GAP MATRIX (G8-S0-05)

| Capability | Existing | Worker | Evidence | Risk | G8 Need |
|---|---|---|---|---|---|
| durable queue | NO | – | DB probe: queue tables 404 | high สำหรับ AI jobs | REQUIRED |
| claim | NO | – | ไม่มี claim RPC/field | medium | REQUIRED |
| lease | NO | – | ไม่มี locked/lease field | medium | REQUIRED (queue model) |
| idempotency | PARTIAL | auto ✓ / G7 ✓ / G6 ✗ | audit trace + ref dedupe + S4-R2-G | low | REUSE + ต่อยอด G6 |
| retry | NO | – | worker source; workflow ยิงครั้งเดียว/รอบ | high | REQUIRED |
| exponential backoff | NO | – | ไม่มี retry state | medium | REQUIRED |
| jitter | NO | – | – | low | REQUIRED (พร้อม backoff) |
| max attempts | NO | – | ไม่มี attempt counter | medium | REQUIRED |
| timeout | YES (in-request) | G6/G7 aiTimeout; GH timeout=5min | aiPolicy + workflow | low | KEEP |
| concurrency | PARTIAL | GH group เท่านั้น | workflow concurrency block | medium | REQUIRED (worker-level claim) |
| recovery after crash | NO | – | ไม่มี lease ให้ recover | high | REQUIRED |
| stale lease recovery | NO | – | – | high | REQUIRED |
| dead-letter | NO | – | probe 404 | medium | REQUIRED (AI jobs) |
| terminal failure | NO | – | status='failed' จบใน trace | medium | REQUIRED |
| observability | PARTIAL | Actions history + audit_logs | 1,406 trace rows | low | IMPROVE |
| audit trail | YES | automation.execution trace | DB probe | low | KEEP (ต่อ schema เดิม) |
| scheduler registration | PARTIAL | 3 legacy jobs; G6 removed; G7 ไม่มี | workflow source | medium | REQUIRED (เมื่อ workers safe) |
| manual replay | YES | workflow_dispatch + event_id/ref | workflow inputs | low | KEEP |
| operator recovery | PARTIAL | manual re-dispatch เท่านั้น | – | medium | DEFINE ใน S1 contract |

## 8. FAILURE CLASSIFICATION (G8-S0-08)

| # | Failure | คลาสที่เสนอ | เหตุผลจาก architecture จริง |
|---|---|---|---|
| 1 | worker timeout | RETRYABLE (จำกัด attempts) | GH timeout ตัด run; idempotency กัน side effect ซ้ำ |
| 2 | AI provider timeout | RETRYABLE | aiTimeout มีอยู่; AI call ไม่มี side effect ก่อน validation |
| 3 | AI provider 4xx | RETRYABLE (429→backoff) / TERMINAL (401-403 config ผิด) | aiPolicy เดิม; 401 ไม่ใช่ transient |
| 4 | AI provider 5xx | RETRYABLE | upstream transient; in-request fallback มีแล้ว 1 ครั้ง |
| 5 | malformed AI output | RETRYABLE 1–2 ครั้ง → TERMINAL | S4-R2 fail-closed พิสูจน์; ซ้ำเพี้ยนต้องดู manual |
| 6 | DB transient failure | RETRYABLE | PostgREST 503 transient; idempotency กันซ้ำ |
| 7 | DB constraint conflict | NON-RETRYABLE → duplicate/no-op | deterministic id ชน = งานเดิมเสร็จ/กำลังทำ |
| 8 | duplicate job | NON-RETRYABLE → duplicate:true | พฤติกรรมเดิม automation-worker + G7 |
| 9 | worker crash หลัง claim | RECOVERABLE เฉพาะเมื่อมี lease expiry | ไม่มี lease วันนี้ → crash = งานหาย (G8 ต้องสร้าง) |
| 10 | scheduler crash | RECOVERABLE | GH run FAIL มองเห็น; cron รอบหน้า re-trigger |
| 11 | network failure | RETRYABLE | curl -f → exit 1; รอบถัดไป/queue retry |
| 12 | invalid authentication | NON-RETRYABLE (TERMINAL) | 401 = token mismatch — retry ไม่แก้ ต้อง operator |
| 13 | permanent business rejection | NON-RETRYABLE (TERMINAL → dead-letter) | validation/business rule — ไม่ transient |
| 14 | exhausted retries | TERMINAL (dead-letter + operator alert) | max attempts ครบ → หยุด กัน cost/side effect สะสม |

## 9. ARCHITECTURE OPTIONS (G8-S0-06 — เสนอเท่านั้น ห้ามเลือกเอง)

**OPTION A — Existing GitHub Actions + DB-backed queue (ใหม่)**
GH Actions ยังเป็น cron trigger แต่เรียก dispatcher ที่ claim จาก queue table ใหม่ (migration) → invoke worker → record result/retry/DLQ
+ lease/claim/backoff ครบใน DB (source of truth เดิม) · + ไม่ผูก reliability กับ GH runtime
− ต้องมี migration ใหม่ · − ซับซ้อนสุด

**OPTION B — GitHub Actions + existing tables/RPCs (ไม่เพิ่ม queue table)**
ใช้ audit_logs trace เป็น idempotency + in-workflow retry/backoff + delayed dispatch
+ ไม่แตะ schema · + ต่อยอด pattern ที่พิสูจน์แล้ว
− ไม่มี lease/claim (concurrent ไม่ atomic) · − retry state อยู่ใน run เท่านั้น (crash = สูญ) · − recovery ไม่ครบ

**OPTION C — DB queue + dedicated dispatcher/worker Edge Function**
queue table + dispatcher function เดียว job ทุกประเภทผ่าน; GH Actions เหลือแค่ tick
+ สะอาดระยะยาว · + register G6/G7 uniform
− migration + deploy ใหม่หลายชิ้น · − ต้องออกแบบ transition กัน duplicate scheduler ช่วงโยกย้าย (legacy 3 jobs)

**OPTION D (เสริม) — Hybrid: Option B ตอนนี้ + Option A/C phase 2** — ลด risk เปลี่ยน production พร้อมกันทั้งชุด; ต้องกำหนดเงื่อนไขจบชัด กันค้างครึ่งทาง

**ข้อจำกัดทุก option:** ห้ามมีสอง scheduler ยิง worker เดียวกันพร้อมกันโดยไม่มี claim — transition path ต้องชัด

## 10. SECURITY / AUTHORITY BOUNDARY (G8-S0-07)

G8 = orchestration เท่านั้น: TRIGGER → CLAIM → INVOKE CANONICAL WORKER → RECORD RESULT
- automation layer ไม่เป็น authority ของ price/payment/stock/capacity/delivery fee/order state/cancel/refund/kitchen state/dispatch/delivery — ยืนยันจาก inventory: worker ทุกตัวเขียนได้เฉพาะ notifications / audit_logs / content_approvals (draft); business state อยู่หลัง canonical RPC/RLS เดิม (migration 007/008/023/025 chain)
- automation-worker ประกาศ non-authority ใน source ตั้งแต่ W3-B; G7 = draft-only พิสูจน์แล้ว (G7 FINAL)
- G8 ห้ามเพิ่ม RPC ที่เขียน business state; retry/recovery ต่อ "งาน" เท่านั้น ไม่ต่อ "ผลลัพธ์ธุรกิจ"

## 11. MIGRATION IMPACT (ถ้า Option A/C ถูกเลือกใน S1+)

- จะต้องมี migration ใหม่ (queue table + index + RLS + claim/complete/fail RPC) — **non-destructive** (table ใหม่ล้วน ไม่แตะ business schema)
- RLS: queue table service_role-only (ไม่ expose ต่อ anon/authenticated)
- ไม่กระทบ G3/G4/G5 security boundary · rollback = drop table ใหม่ ปลอดภัย

## 12. OPERATIONAL RECOVERY MODEL (เสนอ, ยังไม่ implement)

- งานค้างจาก crash: ต้องมี lease expiry → stale lease ถูก re-claim (ยังไม่มีวันนี้ — งาน crash ปัจจุบันหาย ต้อง manual re-dispatch)
- manual replay: คง workflow_dispatch (job=all/dispatch/stale/stock) + re-invoke ด้วย event_id/ref เดิม = duplicate-safe
- operator recovery สำหรับ terminal: ดู dead-letter/trace → แก้สาเหตุ (token/model/config) → re-dispatch ด้วย event_id ใหม่
- audit: ทุก transition (claimed/running/succeeded/failed/dead) บันทึกต่อ pattern audit_logs เดิม

## 13. G8 SCOPE / NON-SCOPE

IN: scheduler, queue/claim, retry, backoff, concurrency control, recovery, dead-letter/terminal handling, worker registration (G6 เมื่อ dedupe พร้อม / G7 เมื่อ claim พร้อม)
OUT: Meta publish (G4 HOLD), AI model/policy เปลี่ยน (G5), draft boundary เปลี่ยน (G7), business authority ใด ๆ, G9/G10

## 14. OPEN OWNER DECISIONS

1. **เลือก architecture** (A/B/C/D ใน §9) — กำหนดทิศทาง S1 contract ทั้งหมด
2. **legacy 3 jobs (notification_dispatch / stale / stock) ย้ายเข้า reliability layer หรือคง GH Actions ตรงตามเดิม** — กัน duplicate execution ช่วง transition
3. **cron cadence/SLA ของ tick ใหม่** (เดิม */5 best-effort) และค่า max attempts / backoff base
4. **G6 ต้องเพิ่ม durable dedupe ก่อน register หรือไม่** (แนะนำ: ใช่ — ไม่มี durable dedupe)
5. dead-letter retention/alert channel (notification in-app เดิม vs แยก)

## 15. S1 READINESS RECOMMENDATION

S0 = PASS (ไม่มี conflict/ambiguity ที่ block audit): production ยืนยันว่า reliability layer ยังไม่มีจริง (สร้างใหม่ได้โดยไม่ชนของเดิม) · ไม่มี duplicate scheduler · boundary ชัด · ไม่ต้อง destructive migration
ข้อเสนอ S1: แปลง Option ที่ Owner เลือก → BMB_G8_S0_CONTRACT.md (job model, state machine, claim/lease semantics, failure classes ตาม §8, worker registration criteria) + ผ่าน decision ครบใน §14 ก่อน



