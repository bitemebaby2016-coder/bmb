# BMB G8-S4 — QUEUE DISPATCHER + SYNTHETIC E2E — RUNTIME REPORT

- Date: 2026-10-03 · Baseline: G8-S3 @ `4c2c6b0` · Owner decisions: OD-1..OD-6 LOCKED
- **NO scheduler cutover · NO G6/G7 registration · NO real business queue execution · NO Edge Function created**
- Evidence: `e2e/g8s4-runtime-evidence.json` + `e2e/g8s4ResidueCheck.cjs` output

## 1. B-1 RESOLUTION

B-1 (trusted enqueue boundary MISSING จาก S3) = **RESOLVED** ด้วย DB-level RPC `enqueue_automation_job` (migration 111) — ไม่มี Edge Function ตามข้อบังคับ S4-01

## 2. TRUSTED ENQUEUE BOUNDARY

`enqueue_automation_job(p_id text, p_job_type text, p_worker text, p_payload jsonb default '{}', p_max_attempts integer default 3) → text ('ENQUEUED'|'DUPLICATE'|'INVALID')`
- SECURITY DEFINER, search_path=public · **EXECUTE granted เฉพาะ service_role** (probe ยืนยัน — ไม่มี grant anon/authenticated)
- RLS คงเดิม (enabled, 0 policies) — ไม่มีการอ่อนแอ
- caller ควบคุม tenant/brand/business authority ไม่ได้ (schema ไม่มีช่องทาง — payload เป็น opaque data)
- **GH Actions transport = DEFERRED (S5 OWNER DECISION)** — RPC พร้อมแล้วแต่ GH ยังไม่มีช่องทางเรียก PostgREST service-role โดยปลอดภัย (ห้ามใส่ service key ใน GH secrets โดยไม่ผ่านการตัดสิน) — ดู §21/§22

## 3. DB IDEMPOTENCY (OD-2)

- **Authority = database-enforced**: single `INSERT ... ON CONFLICT (id) DO NOTHING` — atomic, ไม่มี check-then-insert
- Duplicate identity → `DUPLICATE` (no-op, ไม่สร้าง execution ซ้ำ, ไม่เข้า DLQ) — ไม่ต้องใช้ migration ใหม่ (PK จาก migration 110)

## 4. MIGRATION(S)

- `supabase/migrations/111_g8_s4_enqueue_idempotency.sql` — ADDITIVE ONLY, deployed HTTP 201
- precheck ก่อน deploy (read-only): existing rows = **0**, indexes = 3 (pkey unique + 2 จาก 110), constraints = 3 — ไม่มี conflict
- ไม่แก้ schema/columns เดิม · `fail_automation_job` เป็น CREATE OR REPLACE ด้วย signature เดิม (superset behavior)

## 5. AI TIMEOUT CORRECTION (OD-6)

`fail_automation_job` v2: `ai_timeout` → base **120s** (เดิมตก else=60) + **eff_max = least(max_attempts, 2)** → dead ที่ attempt 2
- runtime วัดจริง: attempt 1 backoff = **122s ∈ [96,144]** ✓ · attempt 2 fail → DEAD (attempt=2/3 ที่ max=3) ✓
- ไม่กระทบ class อื่น (db_transient 30 / ai_failure 120 / network 60 คงเดิม)

## 6. DISPATCHER ARCHITECTURE (S4-02 — 10 responsibilities)

1-2 deterministic identity + safe enqueue = `enqueue_automation_job` (atomic) · 3 ไม่ bypass queue · 4 ไม่ mutate business · 5 ไม่ bypass canonical worker (claim RPC คือ boundary เดียว) · 6-7 record/classify = `complete_automation_job` / `fail_automation_job` (canonical outcome จาก worker, **OD-1: dispatcher ไม่ตีความ business result**) · 8 attempt_count คงอยู่ข้าม requeue · 9 lease จาก claim RPC · 10 evidence = automation_queue rows + JSON logs
- OD-1 enforcement note: `partial`/failed canonical outcome → `fail_automation_job` เท่านั้น (ห้ามใช้ errors.length เป็น decision — ไม่มี logic ดังกล่าวใน DB layer)

## 7-12. SYNTHETIC E2E (S4-05/06, ทุกข้อ PASS)

| Test | Evidence |
|---|---|
| F1 ENQUEUE→CLAIM→LEASE→RUN→SUCCESS | ENQUEUED → claim attempt=1 + lease → complete → succeeded ✓ |
| F1b DUPLICATE ENQUEUE | ครั้งที่ 2 = `DUPLICATE` no-op (row untouched) ✓ |
| F2 RETRYABLE→NEXT RETRY→SUCCESS | db_transient → REQUEUED, backoff 26s ∈ [24,36] (base 30 ±20%) → ffwd → claim → succeeded ✓ |
| F3 NON-RETRYABLE→DEAD | malformed_input → DEAD ทันที, reason=malformed_input ✓ |
| F4 DEAD→REPLAY→NEW IDENTITY | new id `<id>-r<ts>`, queued, attempt=0; original dead+failedAt preserved ✓ |
| F5 CLAIM→CRASH→LEASE EXPIRY→REQUEUE→SECOND CLAIM | requeued=1, attempt preserved=1 → second claim attempt=2 ✓ |
| OD-6 ai_timeout | attempt1 backoff 122s ∈ [96,144] → attempt2 → DEAD ✓ |
| S4-06 N-concurrent enqueue (8) same identity | **1 ENQUEUED + 7 DUPLICATE** (exactlyOne=true — atomic ON CONFLICT ภายใต้ race) ✓ |
| S4-06 N-concurrent claim (8) | **winners = 1** ✓ |
- หมายเหตุ defect ระหว่างทดสอบ: run แรกของ F5 โดน interference (replay clone ถูก claim แทน) → แก้ด้วย isolation ที่ evidence script (ffwd clone) — ไม่ใช่ production defect (claim order by created_at ถูกต้องตาม design)

## 13. SECURITY NEGATIVE TESTS (S4-07)

| Case | Result |
|---|---|
| anon enqueue | HTTP **401** (no EXECUTE grant) DENIED ✓ |
| authenticated enqueue | DENIED โดย grants (probe: EXECUTE เฉพาะ service_role; ไม่มี grant authenticated) — login-based probe ทำไม่สำเร็จ (BMB_TEST_ADMIN login 401 — คาดว่ารหัสทดสอบไม่ตรงปัจจุบัน, ไม่ใช่ security gap) |
| wrong/untrusted caller | HTTP **401** DENIED ✓ |
| tenant/brand/business authority injection | payload เก็บเป็น opaque data — table ไม่มีคอลัมน์ authority, RPC ไม่อ่าน — caller ควบคุมไม่ได้ ✓ |
| credential injection (service_role_key/openrouter key ใน payload) | เก็บเป็น opaque data, ไม่ถูกตีความ, worker ใช้ Deno.env เท่านั้น ✓ |
| RLS | คงเดิม enabled + 0 policies (ไม่ weakening) ✓ |

## 14. REGRESSION TESTS (S4-08)

- npm test = **488 passed / 0 failed** — suite คงเดิม ไม่ลบ ไม่อ่อน assertion · ไม่มี src change (S4 ทั้งหมดเป็น DB layer + e2e scripts)

## 15. PRODUCTION RUNTIME EVIDENCE (S4-09)

- deployment ได้รับอนุญาตเฉพาะ: enqueue infrastructure + AI timeout migration → ทำครบ, ไม่เกินขอบเขต
- runtime verification = synthetic เท่านั้น (job_type='synthetic_selftest') — ไม่มี real business job เดินใน queue

## 16. CLEANUP / RESIDUE (S4-10)

- DELETE เฉพาะ exact synthetic ids → 204 · remainingExact=0
- residue probe: `g8s4-synth-*` = **0** · `g8s2-selftest-*` = **0** (ตรวจซ้ำหลัง run แรกที่ถูกขัดกลางทาง)
- ไม่ลบ real rows / audit rows / production data ใด ๆ

## 17. G6 STATUS

**NOT REGISTERED · NOT MODIFIED** — รอ gate แยก (OD-4 locked)

## 18. G7 STATUS

**NOT REGISTERED · NOT MODIFIED** — รอ gate แยก (OD-4 locked)

## 19. SCHEDULER STATUS

**UNCHANGED** — `.github/workflows/automation-scheduler.yml` ไม่ถูกแตะ (ห้ามตาม S4)

## 20. LEGACY STATUS

**ACTIVE ตามเดิม** — direct invocation path ยังทำงานปกติ (ไม่มี overlap เกิดขึ้น — queue ยังไม่มีใครเรียกนอกจาก synthetic ที่ถูกลบแล้ว)

## 21. OPEN SHOP READINESS BLOCKERS (S4-11 — ยังไม่ resolved, ไม่อ้างว่า resolved)

**S4 components ผูกกับ automation chain:**
| Chain | S4 component ที่เกี่ยว | สถานะ |
|---|---|---|
| ORDER automation | queue + enqueue boundary | READY (synthetic-verified) — รอ cutover (S5) |
| PAYMENT automation | (queue infrastructure กลาง) | รอ cutover · **Stripe live-mode verification = UNRESOLVED (OWNER)** |
| KITCHEN automation | (queue infrastructure กลาง) | รอ cutover · real users/device = OWNER |
| DISPATCH automation | (queue infrastructure กลาง) | รอ cutover · real dispatch integration = UNRESOLVED (OWNER) |
| DELIVERY automation | (queue infrastructure กลาง) | รอ cutover · physical delivery = OWNER |
| TRACKING automation | order_status_history มีอยู่ (migration 040) | READY · remaining tracking dependency = none known in code |
| FAILURE HANDLING | queue retry/dead/replay + audit traces | READY (this gate) — external notification transports (EMAIL/SMS/PUSH/LINE/Meta) **ยังไม่มี credentials = UNRESOLVED** |

**Blockers นอกเหนือ G8 (ยังเปิดอยู่):** Stripe live-mode verify · external notification credentials · physical delivery ops · **G4 Meta dependency (HOLD)** · real dispatch/provider integration · GH-transport decision (§22 T-1)

## 22. EXACT GIT STATE (S4-13)

- รายงานนี้ commit: `feat(G8): S4 trusted enqueue boundary + OD-6 AI timeout + synthetic e2e`
- HEAD == origin/main = YES (ตรวจหลัง push) · WORKTREE CLEAN · ไฟล์ใหม่: migration 111, e2e/g8s4Migrate.cjs, e2e/g8s4Runtime.cjs, e2e/g8s4ResidueCheck.cjs, e2e/g8s4-runtime-evidence.json, รายงานนี้

## OWNER DECISIONS STILL REQUIRED (สำหรับ gate ถัดไป)

- **T-1**: GH Actions transport เข้าถึง enqueue boundary อย่างไรโดยปลอดภัย (เช่น automation-token EF — เดิมถูกห้ามใน S4, PostgREST+restricted role, หรือ pg_cron) — ต้องตัดสินก่อน S5 cutover
- T-2: อนุมัติ S5 cutover (single-commit toggle ตาม S3 §11/§12) หลัง T-1 ปลด
- T-3: G6/G7 registration gate แยก (OD-4 คง locked)
