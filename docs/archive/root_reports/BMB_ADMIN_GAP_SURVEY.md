# BMB — ADMIN SYSTEM GAP SURVEY · 2026-10-05

**สถานะเอกสาร:** ผลสำรวจ gap ของระบบแอดมิน วัดกับ **acceptance bar ข้อ 5** ("Admin คุมทุกขั้นตอน: confirm → kitchen → assign driver → in_transit → delivered ผ่าน production UI ได้จริง")
**HEAD:** `4e3f92e` · ไม่มีการแก้โค้ดในรอบนี้ (สำรวจ + รายงาน)

---

## 1. สิ่งที่แอดมินทำได้จริงตอนนี้ (ยืนยันจากโค้ด)

| ขั้น | หน้า | การกระทำจริง (RPC/ฟังก์ชันที่เรียก) | สถานะ |
|---|---|---|---|
| ยืนยันออเดอร์ | `AdminOrders` | `updateOrderStatus` → `confirmed` | ✅ มี |
| ยืนยันเงิน (promptpay/COD) | `AdminOrders` | `confirmOfflinePayment` | ✅ มี |
| ครัว: สร้าง batch | `AdminKitchen` | `createBatch(roundId, date)` | ✅ มี |
| ครัว: เช็กพร้อมทำ | `AdminKitchen` | `getOrderReadyToMake(order)` | ✅ มี |
| ครัว: mark ready | `AdminKitchen` | `updateOrderStatus(order, to)` | ✅ มี |
| จัดส่ง: assign driver | `DeliveryManagement` | `assignDriver(orderNumber, driverId)` | ✅ มี |
| จัดส่ง: dispatch | `DeliveryManagement` | `updateOrderStatus(order, 'dispatched')` | ✅ มี |
| ไรเดอร์: picked_up / in_transit | `RiderPwaPage` (แอปไรเดอร์) | `driverUpdateDeliveryStatus` | ✅ มี (แต่เป็นบทบาทไรเดอร์) |
| ไรเดอร์: delivered (geolocation + POD) | `RiderPwaPage` | `driverUpdateDeliveryStatus(order,'delivered')` | ✅ มี (แต่เป็นบทบาทไรเดอร์) |
| คืนเงิน Stripe | `AdminOrders` / `AdminPaymentExceptions` | `stripeRefundOrder` (EF) | ✅ มี |
| ยกเลิก pre-order | `AdminPreOrders` | `cancelOrder(orderNumber, reason)` | ✅ มี |
| มองเห็นทุกสถานะ | `AdminOrders` / `AdminKitchen` / `DeliveryManagement` | ตาราง + ตัวกรองสถานะครบ | ✅ มี |

## 2. GAP ที่พบ (ต่อ acceptance bar ข้อ 5)

| # | Gap | ผลกระทบ | ต้องทำอะไร |
|---|---|---|---|
| **A-1** | **Admin UI ไม่มีปุ่ม advance `in_transit → arrived → delivered`** — ปุ่มเดียวที่ปิดวงจรอยู่ใน `RiderPwaPage` (บทบาทไรเดอร์, gate ด้วย geolocation+POD) | ถ้าไรเดอร์ไม่กด/แอปมีปัญหา **ออเดอร์ค้าง `in_transit` ตลอดชีพ** — Admin เห็นได้แต่แก้ไม่ได้ ทำให้ข้อ 5 ของ acceptance bar ไม่ครบ | เพิ่มปุ่ม admin-force `advance_delivery_status` ใน `DeliveryManagement` (admin-gated RPC ที่มี audit) |
| **A-2** | **ปุ่มบังคับข้ามสถานะฉุกเฉิน (force-cancel) ไม่มีบน order ที่จ่ายแล้ว** | ออเดอร์ที่จ่ายแล้วยกเลิกไม่ได้จาก UI โดยตรง (ต้องผ่าน refund path แยก) | เพิ่ม action `cancel + auto-refund` ใน `AdminOrders` (ผูก `stripeRefundOrder` ที่มีอยู่) |
| **A-3** | **`AdminPaymentExceptions` เป็น read-only** | เห็น exception แต่แก้/ปิดเคสจากหน้านั้นไม่ได้ (ต้องไปทำที่ AdminOrders) | เพิ่ม inline action (resolve/refund/mark-failed) |
| **A-4** | **ไม่มีหน้ารวม "order ค้างสถานะ"** | ออเดอร์ค้าง >X ชม. ต้องไล่หาเองข้ามหน้า | เพิ่ม widget บน `AdminDashboard` (stale orders by stage) — ใช้ `orders_stale_pending` ที่มีอยู่แล้วเป็นต้นแบบ |

## 3. สิ่งที่ไม่ใช่ gap (ตรวจแล้ว — อย่าเพิ่มงานซ้ำ)

- Admin-configurable ครบแล้ว (migration 114: brand/theme/branch/bite-drive/radius/methods/fee/cutoff/quota)
- `/admin/notifications` มี visibility ครบ · `notification_prefs` มี push/sms transport flags (migration 115)
- Multi-tenant + branch switching มี (`AdminTenants`, `BranchSwitcher`)
- Audit log มีหน้า (`AuditLogPage`)

## 4. ลำดับที่แนะนำ (รอ Owner อนุมัติก่อนลงมือ)

1. **A-1** (สำคัญสุด — ปิดข้อ 5 ของ acceptance bar ให้ครบ) 
2. **A-2** (ปิดวงจรเงิน + ยกเลิก) 
3. A-3 / A-4 (QoL — ทำหลัง pilot ผ่าน)

> ทั้งหมดต้องผ่าน gates + อัปเดตเอกสารก่อน push ตามกฎเดิม · ไม่มีข้อใดต้อง migration ใหม่ (ใช้ RPC admin-gated ที่มี pattern อยู่แล้ว)

---

**สรุป:** ระบบแอดมิน "คุมได้ 95% ของวงจร" — ขาดจุดเดียวคือ **A-1** (admin ปิดวงจรจัดส่งเองไม่ได้) ซึ่งเป็นสิ่งเดียวที่ขวาง acceptance bar ข้อ 5 โดยตรง