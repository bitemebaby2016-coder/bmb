# BMB G8-S2 — DB QUEUE + ATOMIC CLAIM IMPLEMENTATION REPORT

- Date: 2026-10-03 · Baseline: G8-S1 @ `8f70ab3` · Owner decisions LOCKED (D01=A, D02 migrate-all, D03 policy, D04 gate, D05 90d)
- Production: project `ivkdfognyiwjcmrhcnwz` · NO secrets in this report

## 1. MIGRATION (S2-11 — additive, non-destructive)

- `supabase/migrations/110_g8_automation_queue.sql` — deployed via Management API SQL endpoint (supabase CLI ใช้ไม่ได้บนเครื่องนี้ — เหมือน S4-R1 lesson), HTTP **201**
- ของใหม่ล้วน: 1 table + 2 indexes + 5 functions · ไม่แก้ตาราง/ข้อมูลเดิม · rollback = drop objects ใหม่

## 2. DB OBJECTS

- `public.automation_queue` (18 cols): id(text PK) · job_type · worker · payload(jsonb) · status(check: queued|claimed|running|succeeded|failed|dead) · attempt_count · max_attempts(≥1) · available_at · next_retry_at · claimed_at · lease_until · started_at · completed_at · failed_at · last_error · failure_reason · created_at · updated_at
- indexes: dispatch (job_type,status,available_at) · lease partial (status,lease_until where claimed/running)
- functions (SECURITY DEFINER, search_path=public): `claim_automation_jobs(p_job_type,p_worker,p_batch,p_lease_minutes)` · `requeue_stale_automation_jobs()` · `fail_automation_job(p_id,p_error,p_reason,p_retryable)` · `complete_automation_job(p_id)` · `replay_automation_job(p_id)`

## 3. GRANTS / RLS (S2-10)

- RLS **enabled**, ไม่มี policy → anon/authenticated ถูก deny ทั้งหมด · service_role bypasses RLS
- table: REVOKE ALL from anon, authenticated
- functions: REVOKE from anon/authenticated · GRANT EXECUTE เฉพาะ service_role
- ไม่มี caller-controlled tenant/brand/business authority · ไม่มี Meta credential ใด ๆ

## 4. ATOMIC CLAIM (S2-03)

`FOR UPDATE SKIP LOCKED` + single UPDATE (status+claimed_at+lease_until+attempt_count ใน statement เดียว) — ไม่มี check-then-act ระดับ application

## 5. RUNTIME EVIDENCE (synthetic records เท่านั้น — `e2e/g8s2QueueRuntime.cjs`, evidence `e2e/g8s2-queue-runtime-evidence.json`)

| Test | Result |
|---|---|
| QUEUE-01 enqueue | 201, status=queued, attempt=0 |
| QUEUE-02 atomic claim | 1 winner, correct id, attempt=1 |
| QUEUE-03 concurrent claim (8 parallel) | **winners = 1** (7 ได้ empty), uniqueWinner=true |
| QUEUE-04 lease | lease_until set, ≤5min, อยู่ในอนาคต |
| QUEUE-05 stale recovery (claim→crash→lease past→requeue) | requeued=1, status=queued, attempt preserved=1 |
| QUEUE-05 reclaim | secondClaim=true, attempt=2 |
| QUEUE-06 attempt persisted | attempt_count คงอยู่ข้าม claim/fail (ไม่ reset ต่อ run) |
| QUEUE-07 retry scheduled | fail → REQUEUED + next_retry_at set |
| QUEUE-08 backoff | base 60×2^(n-1) → attempt2 = 120s, actual 111s |
| QUEUE-09 jitter ±20% | within bounds (111 ∈ [96,144]) |
| QUEUE-10 max attempts | attempt 3/3 fail → DEAD |
| QUEUE-11 dead transition | status=dead, failed_at ✓, reason=exhausted_retries, last_error ✓ |
| QUEUE-12 non-retryable (auth) | DEAD ทันทีที่ attempt 1, reason=auth |
| QUEUE-13 deterministic duplicate | second enqueue same id = 409 conflict, original untouched, attempt unchanged |
| QUEUE-14 replay | new id `<old>-r<timestamp>`, status=queued, attempt=0 (NEW identity) |
| QUEUE-15 original preserved | เดิมยัง dead + failed_at + reason ครบ (ไม่ถูก reset) |
| succeeded path | claim → complete = SUCCEEDED |
| CRASH chain | CLAIM → crash (lease past) → expiry → requeue → second claim succeeds ✓ |

## 6. CLEANUP

- DELETE เฉพาะ exact synthetic ids (id=in.(...)) → 204 · remainingExact = 0 · synthetic residue (like g8s2-selftest-*) = **0**
- ไม่มี real business/order/payment/delivery mutation ใด ๆ

## 7. REGRESSION

- npm test = **488 passed / 0 failed** (รวม G5 31 + G6 27 + G7 63) — ไม่มี src change (queue = DB-level, ยังไม่ถูกเรียกจาก worker/scheduler)

## 8. SCOPE GUARDS

- scheduler ไม่ถูกแก้ (workflow เดิมคงเดิม) · legacy 3 jobs ยังทำงานทางเดิม
- G6 ไม่ถูก register · G7 ไม่ถูก register (ตาม D04 + S2-12)
- ไม่มี dispatcher Edge Function (ตาม D01 Option A) · ไม่มี Meta/Page token/business authority
