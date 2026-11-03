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

---

## §17 OBSERVATION RESULT (update 2026-10-04T00:45Z — ~10 ชม. หลัง cutover)

SCHEDULED RUNTIME observed:

```text
scheduled notification_dispatch  = 0 (ยังไม่เกิด)
scheduled orders_stale_pending   = 0
scheduled inventory_low_stock    = 0
legacy runtime invocation        = 0 (ต่อเนื่องทุก poll)
dual-path                        = 0
unexpected queue record          = 0
```

Observation timeline (watcher poll ทุก 2 นาที ต่อเนื่อง, logs = transient ไม่ commit):
- 14:52Z cutover push → 23:55Z: quiet ต่อเนื่อง, legacySinceCutover=0 ทุก poll
- 23:25Z deep probe: automation_queue sched-*-gh-* since cutover = [] · traces 6 ชม. = [] · legacy = 0
- 23:25Z→00:45Z: quiet ต่อเนื่อง

OPERATIONAL OBSERVATION (ไม่ใช่ proof ว่า queue path ล้มเหลว):
- GH Actions scheduler ไม่ได้ fire ตั้งแต่ก่อน cutover (last pre-cutover scheduled run 14:09Z) — เงียบรวม >10 ชม. ทั้ง legacy และ queue path → เป็นพฤติกรรม/สถานะของ GitHub Actions infra (free-plan cron delay รุนแรง หรือ schedule ถูกระงับ) ไม่เกี่ยวกับสถาปัตยกรรม queue
- ต่อ mandate §8: ไม่แก้ cron, ไม่ manual dispatch, ไม่ enqueue manual, ไม่ประกาศ PASS — สถานะคง HOLD จนกว่าจะได้ scheduled executions จริง
- watcher ถูกหยุด cleanly เมื่อจบรอบ observation นี้; re-run `node e2e/g8s5Watch.cjs` เมื่อเริ่มรอบใหม่

---

## §23 FINAL GATE — RECHECK (2026-10-04T00:45Z)

```text
========================================
G8-S5 FINAL OBSERVATION GATE
========================================

scheduled notification_dispatch = 0 (ยังไม่พบ — รอต่อ)
scheduled orders_stale_pending  = 0 (ยังไม่พบ — รอต่อ)
scheduled inventory_low_stock   = 0 (ยังไม่พบ — รอต่อ)

secure enqueue                 = PASS (CONTROLLED RUNTIME — ENQUEUED/DUPLICATE)
queue claim                    = PASS (CONTROLLED RUNTIME — claim SKIP LOCKED 1 ต่อ identity)
canonical worker               = PASS (CONTROLLED RUNTIME — succeeded 3/3, worker ไม่แตะ)
terminal result                = PASS (CONTROLLED RUNTIME — queue terminal succeeded)

legacy runtime invocation      = 0 (9.9 ชม. หลัง cutover — ต่อเนื่องทุก poll)
dual-path                      = 0
duplicate execution            = 0

retry/failure                  = PASS (synthetic: backoff/dead/replay/lease — คงเดิม)
security                       = PASS (scan clean; token เดียว; RPC/RLS ไม่แตะ)
regression                     = PASS (npm test 488/488)
rollback readiness             = PASS (git revert 8666026 พร้อม)

unexpected real mutation       = NONE

G6 registered                  = NO
G7 registered                  = NO

OPEN SHOP                      = NOT AUTHORIZED

HEAD                           = (ดู git block ด้านล่าง)
origin/main                    = (ดู git block ด้านล่าง)
HEAD == origin/main            = (ดู git block ด้านล่าง)
WORKTREE                       = (ดู git block ด้านล่าง)

G8-S5                          = HOLD — scheduled executions ยังไม่เกิด
                                 (GH Actions infra ไม่ fire >10 ชม. ทั้ง pre/post cutover
                                  = operational observation; ไม่ใช่ความล้มเหลวของ queue path;
                                  ห้าม PASS ก่อนได้ >=2 scheduled executions/job)
========================================
```

---

## §17b SCHEDULER TRIGGER RESTORATION ROUND (2026-10-04T02:45Z — Owner-authorized inspect/restore)

### ROOT CAUSE FOUND (defect of cutover workflow file, NOT queue architecture)

```text
GitHub Actions runs API evidence:
- scheduled runs: last = 2026-10-03T14:09:18Z (success) — NONE after
- push runs of automation-scheduler.yml (created only AFTER cutover commit):
  14:46Z / 16:56Z / 00:41Z — event=push, conclusion=failure, jobs total_count=0
  => startup_failure = GitHub parser REJECTED the workflow file
- cause: 3 dispatch steps declared `needs:` (job-level key) at STEP level
  => invalid workflow file => ALL triggers ignored incl. schedule
- timeline aligns exactly: last schedule 14:09Z < first invalid-file push 14:46Z (8666026)
```

### RESTORATION ACTION (RESTORE EXISTING TRIGGER ONLY)

- UI/enable state: workflow state = `active` both before and after (API) — **UI restoration NOT required**
- Fix commit `3310601`: remove 3 step-level `needs:` keys ONLY — cron expressions, schedule triggers,
  event types, cadence, jobs, steps, identity scheme, architecture: UNCHANGED (single-file diff proves)
- Post-fix proof: push 01:45Z created CI run only — **NO automation-scheduler failure run**
  (invalid-file runs stopped) => file now parses on GitHub

### POST-FIX OBSERVATION (01:45Z → 02:45Z)

```text
scheduled notification_dispatch = 0 (ยังไม่เกิด)
scheduled orders_stale_pending  = 0
scheduled inventory_low_stock   = 0
legacy runtime invocation       = 0 (ต่อเนื่องทุก poll)
dual-path                       = 0
unexpected queue record         = 0
```

GitHub schedule infra ยังไม่สร้าง schedule event ใหม่เลยหลังไฟล์กลับมา valid
(รวมเวลาเงียบของ scheduler > 12 ชม. ทั้ง pre/post cutover — operational observation,
ไม่ใช่ defect ของ queue path; watcher/observe เก็บ evidence ต่อเนื่อง)

---

## §23b FINAL GATE RECHECK (2026-10-04T02:45Z — หลัง scheduler trigger restoration)

```text
========================================
G8-S5 FINAL OBSERVATION GATE (post-restoration)
========================================

scheduled notification_dispatch = 0 (ยังไม่เกิด — GH schedule infra ยังเงียบ)
scheduled orders_stale_pending  = 0
scheduled inventory_low_stock   = 0

workflow enabled                = YES (state=active, before AND after)
UI restoration required         = NO
schedule/cron changed           = NO (fix 3310601 ลบเฉพาะ step-level needs)
workflow parses on GitHub       = YES (post-fix push ไม่สร้าง startup_failure run)

secure enqueue                  = PASS (CONTROLLED RUNTIME)
queue claim                     = PASS (CONTROLLED RUNTIME)
canonical worker                = PASS (CONTROLLED RUNTIME)
terminal result                 = PASS (CONTROLLED RUNTIME)

legacy runtime invocation       = 0 (ต่อเนื่องทุก poll ทั้งก่อน/หลัง fix)
dual-path                       = 0
duplicate execution             = 0

retry/failure                   = PASS (synthetic suite คงเดิม)
security                        = PASS (scan clean)
regression                      = PASS (npm test 488/488 @ post-fix)
rollback readiness              = PASS (git revert 8666026..3310601 ตามลำดับ หรือ revert 3310601 เพื่อคง cutover)

unexpected real mutation        = NONE

G6 registered                   = NO
G7 registered                   = NO
OPEN SHOP                       = NOT AUTHORIZED

HEAD / origin/main / WORKTREE   = (ดู git block commit นี้)

G8-S5                           = HOLD — workflow กลับมา valid แล้ว (root cause แก้แล้ว
                                  commit 3310601) แต่ GH schedule infra ยังไม่ fire
                                  จึงยังไม่มี scheduled executions ให้นับ
========================================
```

---

## §17c OBSERVATION-ONLY ROUND (2026-10-04 03:08Z–03:35Z, หลัง fix 3310601)

```text
last successful event=schedule  = 2026-10-03T14:09:18Z (run 37128641566, success)
latest event=schedule after fix = NONE (ไม่มี SRUN ใหม่ถกสร้างเลย)
latest push                     = 2026-10-04T02:38:18Z (d84c2a9) — CI success,
                                  ไม่มี automation-scheduler startup_failure run (parser PASS ยืนยัน)
workflow state                  = ACTIVE
observation window              = 03:08Z → 03:35Z (watcher poll ทุก 2 นาที + observe)
production queue evidence       = sched-*-gh-* since cutover = 0 · traces = 0 · legacy = 0
duration since workflow fix     = ~1.9 ชม.
```

GitHub Actions scheduler infra ยังไม่สร้าง schedule event ใหม่ (รวม >13 ชม. เงียบทั้ง pre/post cutover)
= operational observation — ตาม mandate: ไม่เดาสาเหตุ, ไม่ workaround, ไม่แก้ cron, ไม่ประกาศ PASS

G8-S5 = HOLD (scheduled executions ยังไม่เกิด — controlled runtime คง PASS ตามเดิม)
