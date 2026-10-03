# BMB — G8-S5 — CONTROLLED CUTOVER RUNTIME REPORT

**Cutover commit:** `8666026` — feat(G8): S5 single-commit cutover — scheduler → secure enqueue + dispatcher (legacy direct invocation removed)

## §1 Owner authorization

DOCUMENTED — Owner authorize G8-S5 (PRE-CUTOVER / CONTROLLED LEGACY → QUEUE TRANSITION) สำหรับ notification_dispatch · orders_stale_pending · inventory_low_stock เท่านั้น · NOT Open Shop · NOT G6/G7 registration · NOT arbitrary business jobs

## §2 Pre-cutover baseline (S5-0)

RUNTIME VERIFIED (e2e/g8s5Precheck.cjs — read-only live probe):

```text
queue queued    = 1 (synthetic leftover จาก T2 debug — ไม่ใช่ business; เคลียร exact-ID ใน S5-3)
queue claimed   = 0
queue running   = 0
queue retryable = 0
queue dead      = 0
active legacy execution = ACTIVE (6h: dispatch=12, stale=12, stock=4 — succeeded ทั้งหมด)
unexpected real business queue rows = 0 → ไม่ HARD STOP
```

## §3 Legacy architecture (ก่อน cutover)

DOCUMENTED (git history): GH Actions cron */5 + hourly(:07), concurrency bmb-automation → curl POST automation-worker ตรง {job, eventId: gh-dispatch|gh-stale|gh-stock-<bucket>, params} → worker idempotency = eventId (PK auto-exec-<eventId>)

## §4 Queue architecture (หลัง cutover)

IMPLEMENTED + DEPLOYED — single path:

```text
GitHub Actions (cron เดิม, concurrency เดิม)
  → queue-enqueue EF (verify_jwt + x-automation-token; allowlist; payload template server-side; DB ON CONFLICT idempotency)
  → automation_queue id = sched-<job>-gh-<bucket> (attempt 0, max 3)
  → queue-dispatcher EF [ใหม่ G8-S5 v1, verify_jwt] — claim FOR UPDATE SKIP LOCKED (batch 10, lease 5 นาที)
      → invoke automation-worker UNCHANGED (eventId = queue id)
      → succeeded|partial|duplicate → complete · failed/auth/malformed/network → fail_automation_job (retryable ตาม mapping)
  → canonical worker (automation-worker — ค้ดไม่ถกแตะ)
```

D-S5-A design note: dispatcher แยกจาก worker ตาม PRIMARY OBJECTIVE (GH → queue-enqueue → queue → dispatcher → canonical worker) · ไม่มี business logic · OD-1/OD-2 คงอย่ · synthetic_selftest ไม่อย่ใน dispatcher allowlist

## §5 Three job contracts (S5-1)

RUNTIME VERIFIED — mapping ตรง G8-S3 audit ทุกบรรทัด:

| Job | Legacy entry | Queue job_type | Payload | Canonical worker | Idempotency identity |
|---|---|---|---|---|---|
| notification_dispatch | workflow step (lookbackMinutes 360, limit 200) | notification_dispatch | ตรงกันเปะ (server template) | automation-worker (ค้ดไม่แตะ) | sched-notification_dispatch-gh-dispatch-YYYYMMDDTHHMM |
| orders_stale_pending | workflow step (maxAgeMinutes 120) | orders_stale_pending | ตรงกันเปะ | automation-worker (ค้ดไม่แตะ) | sched-orders_stale_pending-gh-stale-YYYYMMDDTHHMM |
| inventory_low_stock | workflow hourly (stockThreshold 3) | inventory_low_stock | ตรงกันเปะ | automation-worker (ค้ดไม่แตะ) | sched-inventory_low_stock-gh-stock-YYYYMMDDTHH |

customerNamePrefix ยังถกปิเส (S3 §4) · ไม่มี invented payload · ไม่เพิ่ม worker dedupe

## §6 Scheduler diff (S5-2)

DOCUMENTED — single-commit toggle: commit `8666026` เปลี่ยนทั้ง 3 steps พร้อมกัน (legacy direct invocation ถกลบ — verified ไม่เหลือในไฟล) · ไม่มี intermediate dual-path state · ไม่แตะ job อื่น · G6/G7 ไม่ถกแตะ

## §7 Freeze evidence (S5-3)

RUNTIME VERIFIED ก่อน commit: business queue rows = 0 (claimed/running/retry/dead = 0) · synthetic T2 leftover เคลียร exact-ID (residue=0) · ไม่มีการลบ/force-complete/cancel real executions

## §8 Single-commit switch (S5-4)

IMPLEMENTED — commit `8666026` (8 files, +545/−51): workflow rewrite + queue-dispatcher EF + config.toml + evidence scripts · push `5f924ba..8666026`

## §9 Git state ( เวลา cutover)

HEAD = origin/main = `8666026` · worktree clean

## §10 Runtime enqueue evidence (S5-5A/B)

RUNTIME VERIFIED (e2e/g8s5DispatcherRuntime.cjs + g8s5FailureReverify.cjs): enqueue ทั้ง 3 jobs → ENQUEUED · unknown/bad token/invalid json → 401/400 · synthetic transport ใช้ได้ทั้ง synthetic_selftest และ legacy 3 jobs

## §11 Queue claim evidence (S5-5C)

RUNTIME VERIFIED — dispatcher claim จริงทั้ง 3 job types: claimed=1, workerHttp=200, queueResult=SUCCEEDED, queueFinal=succeeded (evidence: e2e/g8s5-dispatcher-evidence.json)

## §12 Canonical worker evidence

RUNTIME VERIFIED — automation-worker ทำงานผ่าน queue path ด้วยผลเดียวกับ legacy (succeeded, audit trace สร้างดย worker เอง — ค้ด worker ไม่ถกแตะใน cutover commit)

## §13 Idempotency evidence (S5-5D)

RUNTIME VERIFIED — ต่อ job: re-enqueue same ref → DUPLICATE (no-op) · re-dispatch → claimed=0 · trace PK auto-exec-<queue id> ทำให้ re-execution คืน worker duplicate → complete · ไม่มี duplicate execution

## §14 Retry/failure evidence (S5-5E — synthetic only)

RUNTIME VERIFIED (e2e/g8s5FailureReverify.cjs):
- retryable (db_transient) → REQUEUED + backoff · re-claim ก่อน available_at = 0 row (backoff respected)
- non-retryable (business_rejection) → DEAD
- replay (dead) → identity ใหม่ -r<TS> queued
- lease expiry: claim → expire lease (synthetic row only) → requeue_stale → requeued=1
- dispatcher fail-mapping: worker failed → worker_failure(retryable) · 401/403 → auth(dead) · 400 → malformed_input(dead) · network → db_transient(retryable)
- ไม่มีการแตะ real customer/order/payment state

## §15 Legacy-path negative proof (S5-6)

RUNTIME VERIFIED (running) — นับจาก cutover push 14:52Z: auto-exec-gh-* traces = 0 ต่อเนื่อง (watcher ทุก 2 นาที) · สรุปตัวเลขใน §17

## §16 Single-path proof (S5-7)

RUNTIME VERIFIED (controlled) — per job: ONE identity → ONE enqueue → ONE claim → ONE canonical execution · duplicate identity → DUPLICATE no-op · legacy>0 AND queue>0 ต่อ identity = ไม่พบ (มิะนั้น IMMEDIATE HARD STOP)

## §17 Observation window (S5-8)

IN PROGRESS — watcher (poll 2 นาที) หลัง cutover 14:52Z; ผลจะบันทึกก่อน final gate §23

## §18 Rollback readiness

DOCUMENTED + VERIFIED — `git revert 8666026` คืน legacy path ใน commit เดียว · หยุด enqueue → รอ claimed/running settle (lease 5 นาที / requeue_stale) → ตรวจ queue → revert = legacy ON + queue OFF (ไม่มี dual) · ไม่ mutate business state เพื่อ่อน evidence

## §19 Security verification

VERIFIED — workflow ใช้ secrets.AUTOMATION_TOKEN เท่านั้น (ไม่มี service_role) · secret scan 0 literal hits · queue-enqueue = ทางเข้า enqueue เดียว, queue-dispatcher = ทางเข้า claim เดียว (allowlist 3) · DB RPC ยัง service_role-only · RLS ไม่แตะ · ไม่มี arbitrary RPC proxy/SQL · ไม่มี tenant/business/credential injection · token ไม่ echo

## §20 Regression verification

PASS — npm test = 488/488 (baseline คงเดิม)

## §21 Open Shop traceability

ยังเปิดทั้งหมด (S5 ปิดเพาะ automation control-plane): REAL ORDER (evidence เดิมคงอย่) · REAL PAYMENT (Stripe live-mode เปิด) · REAL KITCHEN (canonical path ไม่แตะ) · REAL DISPATCH (เปิด) · REAL DELIVERY (เปิด) · REAL TRACKING (เปิด) · REAL FAILURE HANDLING (S5 พิสจนเพาะ automation-level)

## §22 Remaining blockers

1. Observation window: ต้องได้ ≥2 scheduled executions หลัง cutover — GH Actions free cron delay (ประวัติเว้นได้ 30 นาที–3.5 ชม.)
2. Stripe live-mode verification · external notification credentials · physical delivery ops · G4 Meta (HOLD) · real dispatch/provider integration
3. G6/G7 scheduler registration = gate แยก

## §23 Final gate

(กรอกหลัง §17 เสรจ)
## §23 FINAL GATE (ณ 16:55–17:15 UTC — หลัง cutover 2 ชม. 23 นาที)

```text
========================================
G8-S5 CONTROLLED CUTOVER GATE
========================================

precheck                 = PASS (queue ว่างจาก business rows; legacy ACTIVE)
job contract mapping     = PASS (3/3 ตรง S3 contract — ไม่มี invented payload)
freeze                   = PASS (0 active/stale/retry/dead; ไม่แตะ real executions)
scheduler switch         = PASS (single commit 8666026; legacy OFF / queue ON; YAML validated)
secure enqueue           = PASS (T2-verified transport; ENQUEUED/DUPLICATE runtime)
queue execution          = PASS (claim SKIP LOCKED runtime — dispatcher controlled runs)
canonical worker         = PASS (automation-worker ไม่ถูกแตะ; succeeded 3/3 ผ่าน queue path)
idempotency              = PASS (DUPLICATE no-op; re-dispatch claimed=0; trace PK)
retry/failure            = PASS (synthetic: backoff respected / dead / replay / lease-expiry requeue)
legacy negative proof    = PASS (interim) — auto-exec-gh-* ตั้งแต่ cutover = 0 ต่อเนื่อง
single-path proof        = PASS (controlled) + scheduled = PENDING
observation window       = PENDING — GH Actions free cron ยังไม่ fire ใน 2ชม.23น.
                           (ประวัติจริงวันนี้เคยเว้น 2ชม.19น.; watcher poll ทุก 2 นาที
                            อีก ~3 ชม. — legacySinceCutover ยัง = 0 ต่อเนื่อง)
security                 = PASS (scan clean; token เดียว; RPC/RLS ไม่แตะ)
regression               = PASS (npm test 488/488; baseline ไม่แตะ)
rollback readiness       = READY (git revert 8666026 ครั้งเดียว; settle-first procedure)

notification_dispatch    = CUTOVER DONE (controlled RUNTIME VERIFIED; scheduled proof PENDING)
orders_stale_pending     = CUTOVER DONE (เช่นเดียวกัน)
inventory_low_stock      = CUTOVER DONE (เช่นเดียวกัน)

dual-path detected       = NO (legacy=0 ต่อเนื่องหลัง cutover)
real unexpected mutation = NONE

G6 registered            = NO
G7 registered            = NO

OPEN SHOP status         = NOT OPEN — S5 ปิดเฉพาะ automation control-plane
remaining blockers       = scheduled observation evidence · Stripe live-mode · external
                           notification credentials · physical delivery · Meta (G4 HOLD)
                           · real dispatch integration · G6/G7 gate แยก

HEAD                     = (ด้านล่าง)
origin/main              = (ด้านล่าง)
HEAD == origin/main      = (ด้านล่าง)
WORKTREE                 = (ด้านล่าง)

G8-S5                     = HOLD — ทุก phase ผ่าน ยกเว้น S5-8 observation window
                            (รอ ≥2 scheduled executions; ไม่ประกาศ PASS ก่อนได้ evidence)
========================================
```
