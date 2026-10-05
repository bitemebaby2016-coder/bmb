# BMB — G8-S5 FINAL REPORT

**สร้าง:** 2026-10-05 ~00:15Z · **ผล:** G8-S5 = **PASS** · โหมดทั้งหมด: READ-ONLY observation

---

## 1–2. Root cause #1 และ fix

```text
DEFECT #1: commit 8666026 (2026-10-03 14:46Z) แนะ step-level `needs:` keys ที่ invalid
           → GitHub parser ปฏิเสธ workflow file → startup_failure ทุก push run
           → scheduler ไม่ emit event=schedule เลย (เงียบ 14:09Z → 04:03Z ≈ 14 ชม.)
FIX: 3310601 (2026-10-04 01:45Z) — ลบ step-level `needs:` 3 จุด (cadence/architecture ไม่เปลี่ยน)
```

## 3–4. Root cause #2 และ fix

```text
DEFECT #2: ref template `date -u +%Y%m%dT%H%M` ให้ uppercase T ใน identity
           (gh-dispatch-20261004T0602) → queue-enqueue allowlist regex
           /^[a-z0-9][a-z0-9-]{3,63}$/ (index.ts:111) REJECT → enqueue step FAILURE
FIX: e244f90 (2026-10-04 05:48Z) — เปลี่ยน T→t ใน 3 EV lines + comment ระบุ regex constraint
```

## 5–6. Scheduled run IDs และ timestamps (event=schedule ตั้งแต่ cutover)

```text
37175882210  04:03:38Z  FAILURE (sha 5068092, pre-e244f90 — enqueue step fail)
37176095710  04:07:44Z  FAILURE (sha 5068092, pre-e244f90 — enqueue step fail)
37181605118  06:02:01Z  SUCCESS (sha e244f90) — notif + stale
37197402052  11:03:09Z  SUCCESS (sha 62a8519) — inventory
37201317088  12:12:35Z  SUCCESS (sha 62a8519) — notif + stale
37222594979  17:59:07Z  SUCCESS (sha 882feab)
37223924076  18:18:25Z  SUCCESS — notif(t1818) + stale
37235212013  21:13:23Z  SUCCESS — inventory(t21)
37235501519  21:17:34Z  SUCCESS — notif(t2117) + stale
37237377862  21:45:32Z  SUCCESS — notif(t2145) + stale
37238360151  22:00:50Z  SUCCESS — notif(t2200) + stale
37239738469  22:21:58Z  SUCCESS — notif(t2222) + stale
37239815598  22:23:09Z  SUCCESS — inventory(t22)
37240871552  22:39:57Z  SUCCESS — notif(t2240) + stale
37241814827  22:54:56Z  SUCCESS — notif(t2255) + stale
37242940106  23:12:53Z  SUCCESS — notif(t2312) + stale
37243480540  23:21:47Z  SUCCESS — inventory(t23)
37244022170  23:30:42Z  SUCCESS — notif(t2330) + stale
37245027222  23:47:30Z  SUCCESS — notif(t2347) + stale
37245759959  00:00:09Z  IN-PROGRESS ณ เวลาตรวจ (ไม่นับ)
```

## 7. Job counts

| Job | Required | Total (event=schedule + full chain + terminal succeeded + trace) |
|---|---:|---|
| notification_dispatch | 2 | **12** |
| orders_stale_pending | 2 | **12** |
| inventory_low_stock | 2 | **4** (t11, t21, t22, t23) |

**รวม successful scheduled executions = 28 (เกินเกณฑ์ 6)**


## 8. Queue IDs (automation_queue — ทุก row status=succeeded, attempt_count=1)

```text
sched-notification_dispatch-gh-dispatch-20261004t0602  created 06:02:05Z
sched-orders_stale_pending-gh-stale-20261004t0602      created 06:02:10Z
sched-inventory_low_stock-gh-stock-20261004t11         created 11:03:14Z
sched-notification_dispatch-gh-dispatch-20261004t1212  created 12:12:40Z
sched-orders_stale_pending-gh-stale-20261004t1212      created 12:12:47Z
sched-inventory_low_stock-gh-stock-20261004t21         created 21:13:2xZ
sched-inventory_low_stock-gh-stock-20261004t22         created 22:23:1xZ
sched-inventory_low_stock-gh-stock-20261004t23         created 23:21:5xZ
(+ notification/stale รอบ t1818, t2117, t2145, t2200, t2222, t2240, t2255, t2312, t2330, t2347)
```

## 9. Claim evidence

ทุก row มี `claimed_at` จริง: t0602 → 06:02:06.76Z · stale-t0602 → 06:02:10.71Z · t11 → 11:03:15.83Z · t1212 → 12:12:42.14Z — claim ผ่าน `claim_automation_jobs` (FOR UPDATE SKIP LOCKED), attempt_count=1 ทุก row (ไม่มี retry/requeue)

## 10. Dispatcher evidence

GitHub step `*_dispatch` ทุกรอบ = success (เช่น run 37181605118: notification_dispatch_dispatch + orders_stale_pending_dispatch = success) + row ถูก claimed และ completed ตามเวลาจริง

## 11. Canonical worker evidence

audit trace ลงจริงทุก execution: `auto-exec-sched-<job>-gh-<identity>` — ตัวอย่าง: t0602 traces 06:02:08Z/06:02:39Z · t11 trace 11:03:17Z · t21 trace 21:13:32Z · t22 trace 22:23:15Z · t23 trace 23:21:56Z

## 12. Terminal states

`status = 'succeeded'` ทุก row ที่นับ (ไม่มี failed/dead/retry จาก schedule) — completed_at ตัวอย่าง: t0602 06:02:09Z · t11 11:03:17Z · t1212 12:12:45Z / 12:13:20Z

## 13. Audit traces

`audit_logs.action='automation.execution'` — 28 traces รูปแบบ `auto-exec-sched-*` ทั้งหมด metadata.status=succeeded (รายการเต็มใน output ของ `node e2e/g8s5Acceptance.cjs` ณ 2026-10-05T00:00Z)

## 14. Legacy invocation proof

```text
audit_logs: id like 'auto-exec-gh-%' (legacy format, ไม่มี sched-) ตั้งแต่ cutover 2026-10-03T14:52Z = 0
```

## 15. Dual-path proof

scheduler ทุกรอบ emit เพียง 1 execution ต่อ 1 job — queue row = trace = 1:1 ทุก identity · ไม่มีการเรียก worker ตรง (direct invocation) · ไม่มี dual execution path

## 16. Duplicate proof

```text
DUP_CHECK: group by job_type,id having count>1 = [] (0 duplicates) — ON CONFLICT idempotency (migration 111) ทำงาน
```

## 17. Security proof

identity ทั้งหมดผ่าน allowlist regex (lowercase-t) · enqueue ใช้ AUTOMATION_TOKEN ผ่าน secrets เท่านั้น · ไม่มี token รั่วใน logs/reports · ไม่มี manual enqueue/direct invocation จากการตรวจทั้งหมด · ไม่มี security violation

## 18. Unexpected mutation proof

production เปลี่ยนแปลงเฉพาะจาก scheduled executions ของระบบเอง (queue rows + audit traces) · การตรวจทั้งหมด read-only (GitHub public API + Supabase Management SELECT) · migration drift 104–111 ไม่ถูกแตะ · Meta/Stripe/G6/G7/Open Shop ไม่ถูกแตะ


## 19. Regression status

Vitest 488/488 PASS (44 files) ณ commit e244f90 (fix หลัก) — ไม่มีการแก้ code/logic ใด ๆ หลังจากนั้น นอกจาก docs/probes และ index.html meta tag (ไม่กระทบ automation chain)

## 20–22. Git verification

```text
HEAD        = 882feabd66ac55f8a0a51d816ada219fa5dfc462
origin/main = 882feabd66ac55f8a0a51d816ada219fa5dfc462
WORKTREE    = CLEAN
```

## VERDICT

```text
notification_dispatch = 12 >= 2  PASS
orders_stale_pending  = 12 >= 2  PASS
inventory_low_stock   =  4 >= 2  PASS
TOTAL                 = 28 >= 6  PASS
legacy=0 PASS · dual-path=0 PASS · duplicates=0 PASS · security=0 PASS · unexpected-mutation=0 PASS

G8-S5 = PASS
```

## HARD STOP NOTICE

G8-S5 ปิดแล้ว — ห้ามดำเนินการต่อเองในทุกกรณี:
เริ่ม G6 / เริ่ม G7 / register G6-G7 / Open Shop / Stripe / Meta automation / physical delivery /
provider integration / migration repair 104-111 — รอ Owner review และคำสั่งถัดไปเท่านั้น

