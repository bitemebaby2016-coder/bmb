# BMB HANDOFF → STEP 3B-2A (ORDERS OPERATIONAL CONTROL)

**สำหรับเซสชันถัดไป — เริ่มทำ 3B-2A จากไฟล์นี้** (Owner อนุมัติคำสั่ง 3B-2A แล้วในเซสชันก่อน)

## สถานะปัจจุบัน (ตอนแฮนด์ออฟ)
- `STEP 3A = CLOSED / RUNTIME VERIFIED` · `G-SEC-01 + G-SEC-01b = CLOSED` (migrations 052 + 053 deployed)
- `STEP 3B-1 = COMPLETE` (read-only audit) → `BMB_STEP3B_OPERATIONAL_CORE_AUDIT.md`
- Base commit: `527a18b` (= origin/main ก่อนคอมมิตแฮนด์ออฟนี้)

## Owner decisions ที่อนุมัติแล้ว (ผูกมัดเซสชันถัดไป)
1. ลำดับ: **3B-2A Orders → 3B-2B Pre-order → 3B-2C Kitchen → 3B-2D Dispatch/Driver → 3B-2E Payment Exceptions → 3B-3 Dashboard → 3B-4 Daily Report** — ทีละ sub-gate, ห้ามรวม push
2. Driver model = **Bite Drive / internal RiderPwaPage**
3. Notifications = **In-App + Admin เท่านั้น** (SMS/Email/Web Push/LINE/pg_cron = FROZEN)
4. **No real customer / No LIVE money / No physical delivery** จนกว่าจะอนุมัติ Physical Pilot แยก
5. TEST/QA cleanup = Owner-gated (ห้ามลบ/refund/mutate TEST artifacts)

## ขอบเขต 3B-2A (อย่าทำเกิน)
- ทำให้ **Admin Orders** เป็น control surface ที่เชื่อถือได้ — ห้าม redesign UI ทั้งหมด, ห้ามสร้าง order architecture ใหม่, ห้ามระบบ order ที่สอง
- Canonical spine เดิม: `orders → payment → transition_order_status → kitchen → dispatch → delivery`
- **Phase A (อ่านก่อนแก้)**: AdminOrders.tsx + bmbAdminApi_orders.ts + transition/payment/cancel/refund + order_mode/scheduled_date/round/source_channel/external_ref_id + history/audit — ตรวจว่าทุก action ใช้ canonical RPC (ไม่มี client-side authority)
- **Phase B (visibility ขั้นต่ำ)**: order id/number, order_mode (SAME_DAY/PRE_ORDER), customer, order time, scheduled_date, round, payment states (pending/processing/paid/failed/partially_refunded/refunded), order status 10 ค่า, delivery states (unassigned/assigned/accepted/dispatched/in_transit/arrived/delivered/exception)
- **Phase C (actions)**: inspect order/payment/history/audit + **valid canonical transitions เท่านั้น** — ห้าม force status, ห้าม bypass `transition_order_status`, ห้าม UPDATE status ตรง
- **Phase D (pre-order boundary)**: แค่ **display** PRE_ORDER/scheduled_date/round ให้ถูก — ห้ามทำ queue/cutoff/capacity workflow (เป็นของ 3B-2B)
- **Phase E (security)**: คง is_admin()/RLS/own-data/driver boundary; RPC ใหม่ต้อง admin-guarded; ห้าม inventory leak
- **Phase F (tests)**: SAME_DAY/PRE_ORDER display, payment states, delivery states, history, valid transition, invalid blocked, non-admin blocked, customer เข้า Admin Orders ไม่ได้, no STEP-2 regression → Vitest + tsc + lint + build + secret scan
- **Phase G (production verify)**: ใช้ TEST/QA data เท่านั้น, read-only ให้มากที่สุด; **ถ้าต้อง mutate เพื่อพิสูจน์ transition → STOP รายงานก่อน**; ห้าม LIVE Stripe/real order/physical
- Git gate: ก่อนเริ่ม HEAD==origin/main; จบแล้ว commit→push→HEAD==origin/main, WORKTREE CLEAN, STOP

## ผล Phase A ที่สแกนไว้แล้วในเซสชันนี้ (ต่อให้เซสชันหน้าเริ่มจากตรงนี้)
ไฟล์: `src/pages/admin/AdminOrders.tsx`, `src/lib/bmbAdminApi_orders.ts` — authority ถูกต้องอยู่แล้ว: `updateOrderStatus→transition_order_status RPC`, `confirmOfflinePayment→confirm_offline_payment RPC`, `stripeRefundOrder→stripe-refund EF`, cancel ใน lib มี `cancelOrder→cancel_order RPC` (atomic: capacity+inventory+audit) แต่พบ **GAPS ที่ต้องแก้ใน 3B-2A**:
1. **GAP-A1 (ต้องแก้)**: ปุ่ม `ready_for_dispatch → 'delivered'` (AdminOrders ~line 192-194) **ผิด state machine 008** (ต้องเป็น dispatched → in_transit → arrived → delivered หรือผูกกับ driver lifecycle) — ปุ่มนี้จะโดน RPC ปฏิเสธ/หรือ mislead operator
2. **GAP-A2**: ปุ่ม Cancel (pending/preparing) เรียก `handleStatusUpdate(...,'cancelled')` = `transition_order_status` → **ควรเปลี่ยนไปใช้ `cancelOrder` (cancel_order RPC)** เพื่อ release capacity + restore inventory + audit ใน transaction เดียว
3. **GAP-A3 (Phase B)**: การ์ด order ไม่แสดง `order_mode`, `scheduled_date`, round ที่แท้จริง (แสดง 'Morning' fallback), ไม่แสดง payment_status ชัดเจน/ป้าย payment method, ไม่แสดง **delivery/assignment state**, ไม่มีลิงก์/มุมมอง status history + audit trail
4. **GAP-A4**: filter chips ยังไม่มี PRE_ORDER/SAME_DAY และไม่มี failed/in_transit/arrived
5. ตรวจ RLS ของ read-model (`delivery_assignments`, `order_status_history`) ให้ Admin อ่านได้ (probe ยังไม่ได้รัน — ทำใน Phase A ของเซสชันหน้า)
6. production ยืนยันแล้ว (3B-1): state machine 008 = pending→confirmed→preparing→ready_for_dispatch→dispatched→in_transit→arrived→delivered + cancelled/failed; delivery_assignments มี lifecycle cols; order_status_history มี actor

## ห้ามแตะ (FROZEN)
OTP/SMS · Meta real E2E · Facebook Group · Payment Events · Web Push/VAPID · Email · LINE · pg_cron · Supabase Pro/PITR · external rider · race P1-1 · Make.com · canonical RPC bypass · SQL force state · service-role exposure · ห้ามแก้ order spine/pre-order architecture

## เครื่องมือ/รูปแบบที่ใช้ได้
- Probe env: `SUPABASE_ACCESS_TOKEN` (mgmt) + anon key (publishable, อยู่ใน e2e harness เดิม) · admin JWT ทำได้ผ่าน phone-auto-login + is_admin promotion harness (`e2e/ct-admin-check.cjs`, `ct-gsec01-admin.cjs` pattern)
- Test mock: `src/__tests__/helpers/supabaseMock.ts` (ไม่มี `.or()`; insert/update/delete/single ใช้ได้; reset ตารางต้อง await)
- Migration ถ้าจำเป็นต้อง read-model RPC ใหม่: ต้อง is_admin()-guarded + COMMIT ท้ายไฟล์ (ดูแบบ 052/053)
- vitest ปัจจุบัน = 199/199 · tsc 0 · lint 0 · build PASS
