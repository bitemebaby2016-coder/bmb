# BMB — G8-S5 ROOT-CAUSE DIAGNOSTIC

**สร้าง:** 2026-10-04 (~06:35Z) · **โหมด:** READ-ONLY diagnostic (หา root cause แล้ว STOP)
**HEAD ขณะตรวจ:** 5068092 → e244f90 (push 05:48:07Z ระหว่างการตรวจ) · **Supabase ref:** ivkdfognyiwjcmrhcnwz

---

## 1. Executive finding

Root cause ถูกพบและ **แก้ไปแล้วระหว่างการตรวจ** (commit `e244f90` push 05:48:07Z) และ **scheduled chain ผ่าน end-to-end จริงแล้ว** ที่ run 06:02:01Z:

| ช่วง | สถานะ | สาเหตุ |
|---|---|---|
| 8666026 (14:46Z 10-03) → 3310601 (01:45Z 10-04) | `event=schedule` = 0 ทั้งช่วง | workflow file **INVALID** (step-level `needs:`) → GitHub parser reject → scheduler ไม่ emit schedule event เลย |
| 3310601 → e244f90 (05:48Z) | schedule ยิงแล้ว (04:03Z, 04:07Z) แต่ run = **failure** | workflow ยิง + run สร้าง + job start จริง แต่ **enqueue step FAIL** — ref identity ใช้ uppercase `T` (`gh-dispatch-20261004T0403`) ซึ่ง queue-enqueue allowlist regex `/^[a-z0-9][a-z0-9-]{3,63}$/` **REJECT** |
| e244f90 → ปัจจุบัน (06:02:01Z เป็นต้นไป) | **SUCCESS end-to-end** | ref = lowercase `t` (`gh-dispatch-20261004t0602`) → ENQUEUED → claim → dispatcher → canonical worker → terminal `succeeded` → audit trace ครบ |

ทั้งสอง defect เป็นปัญหาใน **ไฟล์ workflow definition เดียวกัน** (สอง commit ต่างกัน: 8666026 ทำ `needs:` พัง, cutover ทำ uppercase-T ref) → จัดเป็น **R1**

## 2. Exact first failure point

```text
1st failure (ช่วง 14:46Z 10-03 → 01:45Z 10-04) = GitHub workflow parser
  → 8666026 มี `needs:` ระดับ step ที่ invalid → workflow file invalid → schedule ถูก ignore ทั้งช่วง (~11.4 ชม.)

2nd failure (ช่วง 01:45Z → 05:48Z 10-04) = workflow enqueue step (post-trigger, execution layer)
  → run 37175882210 (04:03:38Z) job every-5-minutes: step notification_dispatch_enqueue = FAILURE
  → run 37176095710 (04:07:44Z) job hourly-low-stock: step inventory_low_stock_enqueue = FAILURE
  → production ไม่มี queue row จาก 2 runs นี้ (request ถูก EF reject ก่อน INSERT)

ปัจจุบัน (หลัง e244f90): FIRST FAILURE POINT = ไม่มี — chain ผ่านครบที่ 06:02:01Z
```

## 3. GitHub workflow evidence

```text
workflow ID    = 368347532
name           = automation-scheduler
path           = .github/workflows/automation-scheduler.yml
state          = active (Actions API, ตรวจ 06:2xZ)
default branch = main (repo public, not archived/disabled)
crons          = '*/5 * * * *' + '7 * * * *'  (+ workflow_dispatch inputs)
jobs           = every-5-minutes (notification_dispatch, orders_stale_pending)
                 hourly-low-stock  (inventory_low_stock)
revision บน main ณ ตรวจ = e244f90 (lowercase-t ref + regex เอกสารในไฟล์)
```

## 4. Historical successful schedule evidence

```text
run_id      = 37128641566
event       = schedule
status      = completed
conclusion  = success
created_at  = 2026-10-03T14:09:18Z
updated_at  = 2026-10-03T14:09:48Z (duration ~30s)
head_sha    = 5f924bab305799326e3d3f54f8b95de21b305293
workflow    = automation-scheduler (id 368347532)
head_branch = main
```

หมายเหตุ: run นี้เป็น **pre-cutover revision (5f924ba)** — scheduler ยังเรียก automation-worker ตรง (legacy direct route) ไม่ผ่าน queue — จึงอธิบายได้ว่าทำไม run สำเร็จแต่ไม่มี `sched-*-gh-*` ใน production queue

## 5. Post-3310601 schedule evidence (classify จาก API field `event`, ไม่ใช่ timestamp)

```text
run 37175882210  event=schedule  completed/FAILURE  created=2026-10-04T04:03:38Z  sha=5068092
  job every-5-minutes = failure
    notification_dispatch_enqueue   = FAILURE   <- first failed step
    notification_dispatch_dispatch  = success   (dispatcher ยิงได้ แต่คิวว่าง)
    orders_stale_pending_enqueue    = skipped   (if: success() chain)
    orders_stale_pending_dispatch   = success
run 37176095710  event=schedule  completed/FAILURE  created=2026-10-04T04:07:44Z  sha=5068092

## 7. Production migration drift

วิธีตรวจ: `node e2e/prodCheckMigrations.cjs --remote` (snapshot 05:53:15Z) + direct query `supabase_migrations.schema_migrations` (read-only) + เทียบ `supabase/migrations/`

```text
applied (recorded)     = 001..034, 036..103  (035 ถูกข้ามโดยตั้งใจ — superseded by 037, Owner-approved repair)
missing from history   = 104, 105, 106, 107, 108, 109, 110, 111
extra/unexpected       = ไม่พบ
```

**สำคัญ:** objects ของ 104–111 **มีชีวิตอยู่จริงใน production** (ตาราง automation_queue, media_assets, social_events + RPCs claim/complete/fail/requeue/replay/enqueue + อื่น ๆ ยืนยันจาก tables=49 / functions=136 ใน prod-check 05:53Z) → 104–111 ถูก apply **out-of-band** (S2–S4 gates deploy ผ่าน Management API) แต่ `schema_migrations` ไม่ถูกบันทึก → **bookkeeping drift เท่านั้น ไม่ใช่ functional drift**

Dependency classification (ของที่ไม่ถูกบันทึก):

```text
104_b1_order_number_uniqueness        = NOT RELATED TO G8 (order state)
105_asset_registry_media_assets       = NOT RELATED TO G8 (media)
106/107/108_rls_tenant_boundary...    = NOT RELATED TO G8 (RLS/tenant)
109_g3_social_events_foundation       = NOT RELATED TO G8 (G3)
110_g8_automation_queue               = RELATED TO QUEUE/DISPATCHER/WORKER (deployed, live)
111_g8_s4_enqueue_idempotency         = RELATED TO QUEUE (deployed, live — ON CONFLICT idempotency)
```

**B3 — Critical distinction:** ถ้า 104–111 ไม่ deploy → GitHub `event=schedule` **ยังควรเกิด** เพราะการ emit schedule event เป็นฝั่ง GitHub ล้วน ๆ (workflow valid + active + อยู่บน default branch) ไม่มีอะไรเกี่ยวกับ Supabase/DB → **migration drift อธิบาย `schedule=0` ไม่ได้** และต้องแยก Scheduler trigger failure ออกจาก Post-trigger production runtime failure เสมอ (กรณีนี้ trigger กลับมาทำงานจริงแล้วที่ 04:03Z)

## 8. G8 automation dependency readiness

ตรวจ existence/schema/configuration แบบ read-only — สถานะล่าสุดพิสูจน์ด้วย **runtime จริงที่ 06:02:01Z** (strongest possible evidence):

```text
GitHub schedule        = EXISTS (event ยิงจริง 3 runs หลัง fix)
workflow               = EXISTS (valid, active, e244f90)
queue-enqueue EF       = EXISTS + runtime-verified (ENQUEUED ที่ 06:02Z; reject ที่ 04:03/04:07Z ตาม contract)
automation_queue       = EXISTS (table + 2 rows succeeded ณ 06:02Z)
claim mechanism        = EXISTS (claim_automation_jobs FOR UPDATE SKIP LOCKED — claim สำเร็จ)
queue-dispatcher EF    = EXISTS + runtime-verified (claimed -> dispatched 06:02Z)
canonical worker       = EXISTS + runtime-verified (execution สำเร็จ, trace ลง audit_logs)
terminal state         = EXISTS (status='succeeded' ทั้ง 2 rows)
audit/trace            = EXISTS (auto-exec-sched-* 2 traces, metadata.status=succeeded)
required RPCs          = EXISTS ครบ (enqueue/claim/complete/fail/requeue/replay จาก functions list)
```

Dependency chain: `GitHub schedule -> workflow -> queue-enqueue -> automation_queue -> claim -> dispatcher -> canonical worker -> terminal state -> audit` = **ทุกชั้น EXISTS + runtime-verified ณ 06:02Z**

## 9. Facebook/Meta dependency analysis (D1–D3, ไม่แตะ Meta)


## 10. First-failure dependency graph

| Layer | Expected | Actual | Evidence | First failure? |
|---|---|---|---|---|
| GitHub workflow definition | valid | **พัง (8666026->3310601) -> แก้แล้ว -> พังซ้ำ (uppercase-T) -> แก้แล้ว (e244f90)** | run 746-748 startup_failure; runs 04:03/04:07 enqueue fail; diff e244f90 | **YES (R1 ทั้งสองรอบ)** |
| Workflow ACTIVE | yes | yes | Actions API state=active | no |
| Default branch | correct | correct (main) | run inventory head_branch=main ทุก run | no |
| Schedule registration | active | active | `event=schedule` ยิงจริง 04:03Z/04:07Z/06:02Z | no (หลัง 3310601) |
| `event=schedule` | exists | **exists แล้ว** (premise "0" ล้าสมัย — เกิดขึ้นจริงหลัง fix) | 3 schedule runs post-3310601 | no |
| Workflow job starts | starts | starts | jobs started_at มีจริงทุก run | no |
| enqueue step | 200 ENQUEUED | **FAILED (04:03, 04:07) -> SUCCESS (06:02)** | step conclusions + DB row 0 ตอน fail / 2 ตอน success | **YES (รอบที่ 2)** |
| queue-enqueue EF | reachable | reachable (reject ตาม contract — ทำงานถูกต้อง) | dispatcher ยิงโดเมนเดียวกันสำเร็จ; EF ตอบ deterministic | no (EF ทำหน้าที่ถูก) |
| automation_queue row | >=1 | 0 (ตอน fail) / 2 (ตอน success) | probes | no (ตอน success) |
| claim | occurs | occurs | queue rows -> claimed -> succeeded | no |
| dispatcher | runs | runs | 06:02Z dispatch steps success + rows terminal | no |
| canonical worker | runs | runs | trace auto-exec-sched-* landed | no |
| terminal state | exists | exists (succeeded) | queue status=succeeded | no |
| audit trace | exists | exists | audit_logs 2 traces | no |
| Meta dependency | required? | **ไม่ required** | worker line 52–55 + grep 0 refs | n/a |

## 11. Root-cause classification

```text
ROOT CAUSE CLASS = R1 (GitHub workflow definition problem)
```

สอง defect ต่อเนื่องในไฟล์เดียว (`.github/workflows/automation-scheduler.yml`):
1. **8666026** — step-level `needs:` invalid -> parser reject -> schedule ถูก ignore (แก้ด้วย 3310601)
2. **cutover ref template** — `date +%Y%m%dT%H%M` ให้ uppercase `T` -> queue-enqueue allowlist (`/^[a-z0-9][a-z0-9-]{3,63}$/`) reject ref -> enqueue step fail (แก้ด้วย e244f90)

## 12. Evidence supporting classification

## 14. What remains unknown

1. **HTTP status/response ตอน enqueue fail 04:03/04:07** — job logs API ต้องการ admin token (unauthenticated = 403) จึงอ่าน log ไม่ได้; สรุป `invalid_ref` จาก contract (regex + id format) + หลักฐาน post-fix success — ไม่ใช่การอ่าน error string โดยตรง
2. **พฤติกรรม delay ของ GitHub scheduler** — ช่วงเงียบ 14:09Z(10-03) -> 04:03Z(10-04) รวมทั้งช่วง workflow พัง (~11.4 ชม.) และหลัง fix อีก ~2.3 ชม. — เป็น platform behavior ที่วัดได้แต่ควบคุมไม่ได้
3. **hourly-low-stock ยังไม่มี scheduled success หลัง fix** — รอบถัดไปที่ cron `7 * * * *` = 07:07Z (ณ เวลาตรวจ 06:3xZ) — gate acceptance (>=2 ครั้ง/job) ยังต้องเก็บต่อ

## 15. Recommended next diagnostic / Owner decision

1. **เก็บ scheduled evidence ต่อจนครบ gate** (>=2 execution/job x 3 jobs = >=6): notification_dispatch ok 1, orders_stale_pending ok 1, inventory_low_stock 0 -> รอ hourly 07:07Z เป็นต้นไป + ตรวจ `sched-*-gh-*` rows/traces และ legacy=0 ต่อเนื่อง — แล้วประเมิน `G8-S5 = PASS` ตาม §17/§23 ของ controlled-cutover report
2. **Owner decision (ไม่เร่งด่วน):** บันทึก migrations 104–111 ลง `schema_migrations` (`supabase migration repair --status applied`) เพื่อปิด bookkeeping drift — ห้าม re-run/re-apply เนื้อหา
3. **ไม่ต้องแก้เพิ่มใน workflow/EF/RPC** — root cause ปิดแล้วที่ e244f90; HARD STOP เดิม (G6/G7 ยัง NOT REGISTERED, ไม่แตะ Stripe/Meta/delivery) ยังมีผล

## 16. Statement — NO production mutation

การตรวจทั้งหมดเป็น **read-only**: GitHub REST API (unauthenticated public endpoints), Supabase Management API SELECT queries, และ grep/ไฟล์ใน repo เท่านั้น ไม่มีการ enqueue/dispatch/invoke EF/deploy migration/rotate token/แตะ Meta/แตะ production data โดยเจตนาทั้งสิ้น row ที่เกิดขึ้นใน production (06:02Z) มาจาก **scheduled run ของระบบเอง** ไม่ใช่การ trigger โดย diagnostic นี้ การแก้ไขเดียวที่เกิดขึ้นคือ commit `e244f90` บน workflow (ทำโดย Owner identity ระหว่างช่วงตรวจ — อยู่นอกขอบเขตการ mutate ของ diagnostic นี้)

---
*Probes ที่ใช้ (read-only, tracked ใน repo):* `e2e/g8s5RunInventory.cjs`, `e2e/g8s5MigrationHistory.cjs`, `e2e/g8s5ProbeScheduled.cjs`, `e2e/prodCheckMigrations.cjs --remote` (snapshot: `e2e/prod-check-result.json` 05:53:15Z)


* `git show 8666026..3310601` — ลบ step-level `needs:` 3 จุด; ข้อความ commit ยืนยัน "GitHub parser rejected workflow file (schedule silently ignored since 8666026)"
* runs 746/747/748 (push บน revision พัง) = failure; ช่วงนั้น **ไม่มี schedule run เลย** (run inventory 13:45Z -> 04:03Z มี schedule run เดียวคือ 14:09Z pre-cutover)
* 04:03/04:07 runs: schedule event มีจริง, job start จริง, enqueue step = failure, production ไม่มี queue row จาก 2 runs นี้
* `git show e244f90` — เปลี่ยน `T`->`t` 3 เส้น + comment ระบุ regex constraint เป๊ะ (`[a-z0-9][a-z0-9-]{3,63}`)
* `queue-enqueue/index.ts:111` — regex ตรวจ `ref` (case-sensitive, ไม่มี toLowerCase) ; `:118` id = `sched-<job>-<ref>`
* หลัง e244f90: run 06:02:01Z ทุก step success + production มี queue rows/traces ที่ id ลงท้าย `...20261004t0602` (**lowercase t** = ผ่าน regex จริง)
* dispatcher steps เป็น `success` ตลอด (โดเมน/ช่องทาง/เครดิตเทียบเท่า enqueue) -> failure อยู่ที่ **ค่า ref เท่านั้น** ไม่ใช่เครือข่าย/credential

## 13. Evidence that disproves alternative causes

* **R2 (registration/eligibility):** workflow active + อยู่บน main + event ยิงจริง -> หักล้าง
* **R3 (platform delay/anomaly):** delay มีจริง (04:03Z หลัง push 01:45Z) แต่ delay ไม่ใช่สาเหตุของ failure — run ที่ยิงแล้วล้มเหลวที่ step (post-trigger) และหลังแก้ ref แล้วผ่านทันที -> platform ไม่ใช่ root cause
* **R4 (default-branch problem):** head_branch=main ทุก run, CI push pass ทุก commit -> หักล้าง
* **R5 (migration/runtime dependency):** automation objects deploy ครบและทำงานจริง (06:02Z end-to-end) -> หักล้าง; ส่วน history-table drift เป็น bookkeeping
* **R6 (Meta/Facebook):** ไม่มี dependency (§9) -> หักล้าง
* **R7 (unknown):** evidence เพียงพอ -> ไม่ต้องใช้

* `automation-scheduler.yml` = GitHub Actions -> HTTP ไป Supabase Edge Functions เท่านั้น — **ไม่มี** Facebook/Meta/Page token/webhook/Messenger reference ใด ๆ
* `queue-enqueue/index.ts` + `queue-dispatcher/index.ts` — grep หา `meta|facebook|messenger` = **0 result**
* `automation-worker/index.ts` line 52–55 (คำตอบตรงจาก source):
  > "Transport abstraction (W3-D-6): in_app = row in public.notifications ... All external transports (EMAIL/SMS/PUSH/LINE/ **FACEBOOK/MESSENGER**) are declared but **NOT CONFIGURED — no credentials exist, so the dispatcher never calls them**. NOT fake connectivity."

**D2 คำตอบ: `NO — independent`** — Facebook Page ยังไม่ verify/configure **ไม่มีทาง** ทำให้ GitHub หยุดสร้าง `event=schedule` (trigger เป็นฝั่ง GitHub ล้วน) และแม้ post-trigger ก็ไม่มีการเรียก Meta เลย (worker ไม่มี credentials) -> R6 ถูกหักล้าง

  job hourly-low-stock = failure
    inventory_low_stock_enqueue     = FAILURE   <- first failed step
    inventory_low_stock_dispatch    = success
run 37181605118  event=schedule  completed/SUCCESS  created=2026-10-04T06:02:01Z  sha=e244f90
  job every-5-minutes = success — ทุก step success (enqueue x2 + dispatch x2)
  job hourly-low-stock = skipped (cron คนละนาที — hourly รอบถัดไป 07:07Z)
```

Production evidence ณ 06:2xZ (read-only probes):

```text
automation_queue  = sched-notification_dispatch-gh-dispatch-20261004t0602  status=succeeded  created=06:02:05Z
                    sched-orders_stale_pending-gh-stale-20261004t0602      status=succeeded  created=06:02:10Z
audit_logs trace  = auto-exec-sched-notification_dispatch-gh-dispatch-20261004t0602  st=succeeded
                    auto-exec-sched-orders_stale_pending-gh-stale-20261004t0602      st=succeeded
LEGACY auto-exec-gh-* since cutover = 0  (single-path ยังไม่มี dual-path)
```

## 6. Default branch / scheduler eligibility

* workflow file อยู่บน default branch (main) — ทุก schedule run head_branch=main
* revision ปัจจุบันบน main = e244f90 (push 05:48:07Z, CI pass run 37180925023)
* workflow state = active, repo not disabled/archived
* ข้อสังเกต platform: หลัง 3310601 push 01:45Z schedule event แรกกลับมาที่ 04:03:38Z (delay ~2.3 ชม.) — เป็นพฤติกรรม delay ของ GitHub scheduler ที่รู้จักกันทั่วไป ไม่ใช่ blocker (event ยิงจริงแล้วต่อเนื่อง)
