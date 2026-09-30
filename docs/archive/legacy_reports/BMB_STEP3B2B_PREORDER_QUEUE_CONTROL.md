# BMB STEP 3B-2B — PRE-ORDER QUEUE OPERATIONAL CONTROL (EVIDENCE / รายงานหลักฐาน)

Base: `b5564ce` (HEAD == origin/main ก่อนเริ่ม) · Project `ivkdfognyiwjcmrhcnwz`
ขอบเขต: **3B-2B เท่านั้น** — Pre-order Queue operational control บน canonical order spine เดิม (ห้ามสร้าง order system ใหม่ / ห้ามแยก pre-order ออกจาก same-day)

---

## Phase A — READ/AUDIT (ตรวจจากโค้ดจริง + production read-only)

**Authority ที่มีอยู่แล้ว (reuse ทั้งหมด ไม่สร้าง RPC ใหม่):**
- `delivery_rounds` = source of truth ของ round/cutoff/capacity (`max_capacity, current_count, cutoff_time, delivery_start, delivery_end, scheduled_date, status`) — RLS `delivery_rounds_public_read` (anon+authenticated SELECT) + `delivery_rounds_admin_manage`
- Migration **025** `create_order_with_items`: cutoff authority (Asia/Bangkok) + atomic capacity lock + mode gate + `ERR_CUTOFF_PASSED` / `ERR_CAPACITY_FULL` / `ERR_SCHEDULED_DATE_INVALID`
- Migration **038**: `enforce_pre_order_window` (cutoff = 2 ชม. ก่อน delivery_start) + `enforce_pre_order_cancel_window` (`ERR_CANCEL_AFTER_CUTOFF`)
- Migration **017**: `create_pre_order_with_items` / `quote_pre_order` / `cancel_pre_order` (capacity refund)

**Production probe (`e2e/ct-3b2b-preorder-probe.cjs` — READ-ONLY):**
- คอลัมน์ `delivery_rounds` ครบจริง · PRE_ORDER 8 ออเดอร์ (202) จับกลุ่มตาม scheduled_date+round ได้จริง (2026-09-29/28/24) · orphan (PRE_ORDER ไม่มี round) = **0** · SAME_DAY 194 (spine เดียวกัน)
- ไม่มี mutation ใด ๆ ใน production ทั้งเซสชัน

**GAP ที่พบ → แก้ใน 3B-2B:**
- GAP-B1: ไม่มีมุมมอง queue จับกลุ่มตาม scheduled_date+round → เพิ่ม PRE_ORDER queue view
- GAP-B2: capacity/cutoff ไม่เคยแสดงให้ operator → แสดงจาก `delivery_rounds` ตรง ๆ (display only)
- GAP-B3: payment exception ใน queue ไม่ถูกชี้ → counter "payment needs attention"

## Phase B — IMPLEMENT

- **ใหม่** `src/lib/preOrderQueue.ts` (pure display): `groupPreOrders` (จับกลุ่ม date+round, date desc) · `roundCapacityState` (สล็อตจาก DB row; FULL เมื่อ remaining≤0 — **แสดงเท่านั้น** server ยังบังคับ `ERR_CAPACITY_FULL`) · `roundCutoffState` (ค่าดิบ cutoff_time/delivery_start–end จาก DB — **ไม่คำนวณ/ไม่บังคับฝั่ง client**) · `isPaymentException`
- **เพิ่ม** `getRoundsByIds()` ใน `bmbAdminApi_orders.ts` — READ-ONLY reuse RLS public_read, graceful degrade
- **แก้** `AdminOrders.tsx`: filter mode `PRE_ORDER` → แสดง header ต่อกลุ่ม (📅 scheduled_date · round id + display_name · 🟢 used/max slots หรือ 🔴 FULL · cutoff/delivery window · round status · ⚠ payment-needs-attention count) และการ์ด order ใต้กลุ่มใช้ปุ่ม canonical เดิมจาก 3B-2A (next-hop จาก allow-list 008/030 + `cancel_order` RPC + history/audit) — **ไม่มี transition ใหม่ใน UI, ไม่มี mock/static data**
- Canonical spine ยืนยัน: SAME_DAY + PRE_ORDER ใช้ `orders`/state machine/payment/delivery/audit เดียวกัน (probe: spine เดียว, ไม่มีตาราง pre-order แยก — `pre_orders` เป็น legacy-migration artifact ที่ไม่ถูกอ่านใน path นี้)

## Phase C — TEST PASS

- **Vitest 232/232** (27 ไฟล์) — รวม `preOrderQueue.test.ts` ใหม่ **13/13**: จับกลุ่ม date+round · SAME_DAY ไม่ปน queue · capacity display (ใช้/เต็ม/round หาย) · cutoff display จากค่า DB ดิบ · payment exception ทั้ง 6 สถานะ · illegal transition blocked (`ready_for_dispatch→delivered` ยังถูก block — no regression 3B-2A) · `getRoundsByIds` read-only + degrade
- Regression: STEP 2 payment suites + STEP 3A G-SEC + 3B-2A adminOrdersOp ครบ 232 เทสต์ **GREEN**
- `tsc --noEmit` 0 errors · `eslint` 0 · `npm run build` PASS · `ct-secrets-check.cjs` PASS

## Phase D — PRODUCTION VERIFICATION (READ-ONLY)

- Probe ผ่าน 2 รอบ (ก่อน/หลัง implement): RLS `delivery_rounds_public_read` live · คอลัมน์ครบ · queue grouping ตรง production data · orphan=0 · spine เดียวกัน
- **ไม่มี mutation ที่ต้องขออนุมัติ** — การพิสูจน์ cutoff/capacity/cancel-window เป็น server rules ที่ RUNTIME VERIFIED มาแล้ว (STEP 2 CT + contracts_025/038 BEGIN…ROLLBACK) จึงไม่จำเป็นต้อง mutate
- ไม่สร้าง production test data · ไม่ใช้ LIVE Stripe · ไม่มี real customer/physical delivery

## Phase E — GIT

- Commit: `step3b-2b: pre-order queue operational control (date+round grouping, capacity/cutoff display from DB truth, payment-attention flags)`
- Push origin/main → ยืนยัน HEAD == origin/main · WORKTREE CLEAN · ONE sub-gate only

## สถานะแยกประเภท (ตาม HARD STOP RULE)

| รายการ | สถานะ |
|---|---|
| PRE_ORDER queue view (grouping/capacity/cutoff/payment flags) | **IMPLEMENTED + RUNTIME VERIFIED (read-only prod)** |
| Capacity/cutoff authority | **UNCHANGED — server (025/038)** — client display only |
| Canonical spine (SAME_DAY+PRE_ORDER เดียวกัน) | **RUNTIME VERIFIED** (probe) |
| STEP 2 / 3A / 3B-2A regression | **GREEN** (232/232) |
| Security boundary | **NO CHANGE** — ไม่มี RPC ใหม่, ไม่มี policy เปลี่ยน, G-SEC-01/01b ไม่ถูกแตะ |
| FROZEN items | **UNTOUCHED** |
| Non-admin boundary | RLS เดิม: rounds=public read, orders/history=RLS admin — ไม่เปิด PII/inventory เพิ่ม |

## Remaining gaps (ไม่ใช่ blocker ของ 3B-2B — เสนอเพื่อ gate ถัดไป)

1. **Cutoff countdown** ราย order (เช่น "closes in 3h") — ต้องอิง server clock/RPC เพื่อไม่หลอก operator (DEFER → พิจารณาใน 3B-3 dashboard ถ้าจำเป็น)
2. **คอลัมน์ตาราง queue แบบประหยัดจอ** สำหรับวันที่คิวเยอะ (UI polish — DEFERRED ตาม owner scope)
3. **3B-2C Kitchen** (batch→preparing→ready) ยังไม่เริ่ม — รอ Owner สั่ง

## HARD STOP

**3B-2B = PASS (IMPLEMENTED + RUNTIME VERIFIED)** → STOP · ห้ามเริ่ม 3B-2C Kitchen / Dispatch / Dashboard / Reports / Physical Delivery จนกว่า Owner จะสั่งต่อ
