# BMB STEP 3B-2D — DISPATCH / DRIVER (Bite Drive)

**ฐาน:** `f8c8a20` (3B-2C closed) · สถานะเป้าหมาย: 3B-2D CLOSED → HARD STOP

---

## 1. AUDIT สถานะจริง (Production > Code > Migrations — probe read-only `ct-3b2d-dispatch-probe.cjs`)

| รายการ | สถานะจริง |
|---|---|
| RPCs canonical | `assign_driver(p_order_number,p_driver_id)` (020, is_admin) · `driver_login(p_display_name?)` (041 JWT) · `driver_accept_assignment` · `driver_update_delivery_status` (041 JWT-bound + 036 sync) · `my_deliveries` · `list_drivers` (037, is_admin) · `link_driver_user` (041 admin) · `upsert_driver` — **7/7 live บน prod, signature ตรง 041** |
| Schema | `drivers` (id/name/phone UNIQUE/status ∈ available,busy,offline/`user_id` UNIQUE FK auth.users จาก 041) · `delivery_assignments` (UNIQUE order_number, status ∈ assigned,accepted,picked_up,in_transit,delivered,cancelled + timestamps) |
| Tracking | **ไม่มีตาราง `track_attempts`** — canonical tracking = `order_status_history` (trigger 040 เขียนทุก hop รวม DRIVER sync, RLS admin-read) + `delivery_assignments` + `audit_logs` + `track_order_attempts` (w5h1 customer-side) — **ไม่สร้างสถาปัตยกรรม tracking ใหม่** |
| RLS | drivers: scoped_read + self_update + admin_write + deny_anon · delivery_assignments: scoped_read + admin_write + deny_anon · order_status_history: admin_read — relrowsecurity=true ทุกตาราง |
| Driver identity | **JWT-bound (041)**: driver RPCs resolve `drivers.user_id = auth.uid()`; phone params ถูก ignore (JWT WINS); ไม่มี self-register ทาง phone; provisioning = `link_driver_user` (admin) |
| Prod data (read-only) | drivers 5 คน (2 JWT-linked QA) · assignments: assigned 6 / accepted 4 · READY_FOR_DISPATCH 8 รายการ · orphan linkage 0 · state ประพันธ์ถูกต้อง |
| Admin Dispatch UI เดิม | ❌ **ไม่ canonical** — DeliveryManagement เดิมใช้ client-side optimizer (`assignOrdersToDrivers` จาก routeOptimization) + mock external providers + local audit log = "mock success" ไม่เขียน DB |
| Driver UI | ✅ RiderPwaPage ใช้ driverService → canonical RPCs (041) ครบแล้ว |

**ไม่มี material conflict กับ Owner contract** → ดำเนินการต่อได้ (canonical path = `assign_driver` มีอยู่จริง ใช้ตามจริง ไม่สร้างคู่ขนาน)

## 2. IMPLEMENTATION (3B-2D เท่านั้น)

1. **DeliveryManagement.tsx → canonical dispatch board**: คิว READY_FOR_DISPATCH + มอบหมายผ่าน **`assign_driver` RPC** เท่านั้น · ปุ่ม 🚚 Dispatch ผ่าน **`transition_order_status`** · ไรเดอร์จาก **`list_drivers`** (display-only) · สถานะ assignment อ่านจาก `delivery_assignments` (RLS) · exception visibility (assignment active แต่สถานะ order ไม่ dispatch-able) · **ลบ** client-optimizer assign + mock provider UI (Grab/Lineman/Foodpanda = FROZEN ไม่ implement) · ไม่มี optimistic fake state
2. **driverService.ts**: + `adminListDrivers()` (canonical list_drivers) · **FIX จริง**: `driverUpdateDeliveryStatus` ไม่ส่ง `p_driver_phone` (จำเป็นใน signature 041 แม้จะถูก ignore) → เดิมจะ RPC-fail บน prod จริง (CONNECTED แต่ไม่ RUNTIME VERIFIED) — ส่ง `p_driver_phone: ''` wire-compat (JWT WINS ไม่เปลี่ยน authority)
3. **ลบ legacy `bmbAdminApi_drivers.ts`** (dead code, param ผิด canonical: list/upsert/assign/setStatus ไม่มี caller + direct UPDATE ที่ column ไม่มีจริง)
4. **Mock**: + drivers/delivery_assignments seed + handler `driver_login`/`list_drivers`/`assign_driver`/`driver_accept_assignment`/`driver_update_delivery_status`/`my_deliveries`/`upsert_driver`/`link_driver_user` (mirror 020/036/037/041 รวม multi-hop forward-only sync + terminal lock)

## 3. CONTRACT (ตารางตาม Owner §5)

| # | Condition | Authority | สถานะ |
|---|---|---|---|
| 1-5 | order มีจริง/canonical/dispatchable (ready_for_dispatch, dispatched, confirmed, preparing เท่านั้น)/ไม่ terminal | assign_driver | IMPLEMENTED+RUNTIME (probe live) |
| 6-7 | driver exists | assign_driver | IMPLEMENTED+VERIFIED (⚠ GAP: ไม่ตรวจ driver.status — มอบหมาย offline ได้ → document gap, ไม่แก้เอง) |
| 8 | authorization: is_admin() only | assign_driver + RLS | RUNTIME VERIFIED (grants + 041) |
| 9 | duplicate = deterministic (ON CONFLICT order_number → reassign/reset รอบเดียว) | 020 | IMPLEMENTED+VERIFIED (unit) |
| 10 | audit: delivery_assigned + ทุก sync hop + order_status_history trigger | 020/036/040 | IMPLEMENTED+VERIFIED |
| 11-13 | ไม่มี client authority / direct mutation / arbitrary assignment | UI ใหม่ + RPCs | IMPLEMENTED+VERIFIED |

**Transitions (Owner §6):** canonical เดิมครบ — ADMIN: ready_for_dispatch→dispatched (transition RPC) · RIDER: picked_up→dispatched / in_transit→in_transit / delivered→(in_transit→arrived→delivered multi-hop) ผ่าน `driver_update_delivery_status` + guard allow-list (036) · ASSIGNED/ACCEPTED = assignment-level events (delivery_assignments.status) ไม่ใช่สถานะ order — รักษา canonical model ตามจริง · pending→dispatched, preparing→delivered, delivered→in_transit, failed→delivered **ถูก block** (เทสต์ + guard trigger)

## 4. TEST MATRIX (Owner §11) — `dispatchContract.test.ts` (14 tests)

✅ assign valid driver · invalid driver denied · non-admin denied · duplicate deterministic · cancelled/delivered not dispatchable · missing order denied · JWT-linked login / unlinked = ERR_NOT_A_DRIVER · driver เห็นเฉพาะ own deliveries · driver กระทำ order อื่นไม่ได้ · accept→picked_up→in_transit + canonical sync · full flow ถึง delivered + already-delivered block · terminal lock (cancelled ไม่ sync) · admin hop ready_for_dispatch→dispatched + pending→dispatched block · regression allow-list (2/2A/2B/2C spine)

## 5. GATE ผลรวม (ตัวเลขจริง)

- **Vitest: 276/276 PASS (29 files)** = เดิม 262 + ใหม่ 14
- **tsc --noEmit: 0** · **eslint .: 0** · **build: PASS** · **secret scan: CLEAN (0 hits)**
- **Production evidence (read-only):** RPCs 7/7 live · RLS ครบ · ข้อมูลจริงสอดคล้อง — จัดเป็น **CODE/CONTRACT VERIFIED + CONTROLLED TEST VERIFIED (mock/QA)** · **REAL-WORLD VERIFIED = ยังไม่ได้** (ต้องรอ G3/G4 Physical Pilot ตาม §12 — ไม่ mutate order จริงเพื่อพิสูจน์)

## 6. Tracking / Failure (Owner §9-10)

- Tracking linkage: driver action → assignment → orders.status (036) → order_status_history (040 trigger, actor=DRIVER) → ลูกค้าเห็นผ่าน tracking path เดิม — **IMPLEMENTED/CONNECTED**
- `track_order_attempts` (w5h1) = customer tracking API — ไม่แตะ — CONNECTED
- Failure/exception ที่มี: reassignment deterministic (ON CONFLICT) · cancelled assignment ถูกกรองออกจาก my_deliveries · ERR_ALREADY_DELIVERED / ERR_DELIVERY_SYNC_BLOCKED · exception visibility ใน dispatch board · **GAP (documented, ไม่ block gate):** reassignment หลัง picked_up reset assignment แต่ orders.status ยังอยู่หน้าเดิม (เช่น dispatched) — ต้อง policy เพิ่ม (ให้ Owner สั่ง เช่น ที่ 3B-2E) · ไม่มี "driver unavailable" auto-reassign — MISSING/DEFERRED

## 7. Git

- commit เดียว STEP 3B-2D · push แล้ว · HEAD == origin/main · WORKTREE CLEAN

## 🔴 HARD STOP — รอ Owner command (roadmap: 3B-2E Payment exception → 3B-3 Dashboard → 3B-4 Daily Ops → G3–G6; ห้ามกระโดด)
