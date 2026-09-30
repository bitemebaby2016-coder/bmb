# Bite Me Baby -- คู่มือผู้ดูแลระบบ (Admin Guide) ฉบับสมบูรณ์

> อัปเดตล่าสุด: 2026-09-26 | Version: 2.0
> ผู้ใช้: เจ้าของร้าน, ผู้จัดการ, พนักงานครัว, ไรเดอร์

---

## 📋 สารบัญ

1. [เข้าสู่ระบบ](#1-เข้าสู่ระบบ-login)
2. [Dashboard และภาพรวมธุรกิจ](#2-dashboard-และภาพรวมธุรกิจ)
3. [จัดการออเดอร์](#3-จัดการออเดอร์-orders)
4. [จัดการเมนูและสินค้า](#4-จัดการเมนูและสินค้า-products)
5. [จัดการรอบส่ง](#5-จัดการรอบส่ง-rounds)
6. [จัดการโปรโมชั่น](#6-จัดการ-promotions-promotions)
7. [จัดการลูกค้า](#7-จัดการลูกค้า-customers)
8. [จัดการสินค้าคงคลัง](#8-จัดการสินค้าคงคลัง-inventory)
9. [ตั้งค่าระบบ](#9-ตั้งค่าระบบ-settings)
10. [จัดการการจัดส่ง](#10-จัดการการจัดส่ง-delivery)
11. [Rider PWA](#11-rider-pwa--หน้าจอไรเดอร์)
12. [การชำระเงิน (Payment)](#12-การชำระเงิน-payment-management)
13. [ปัญหาที่พบบ่อย + วิธีแก้ไข](#13-ปัญหาที่พบบ่อย--วิธีแก้ไข)

---

## 1. เข้าสู่ระบบ (Login)

### ขั้นตอนที่ 1: ไปที่หน้าเว็บ
เปิดเบราว์เซอร์ไปที่ `https://bitemebaby.pages.dev`

### ขั้นตอนที่ 2: กดเข้าสู่ระบบ
- มุมขวาบนมีปุ่ม **"เข้าสู่ระบบ"** หรือ **"Sign In"**
- กรอก **Email** และ **Password** ที่ได้รับจากเจ้าของระบบ
- กดปุ่ม **"เข้าสู่ระบบ"**

### ถ้ายังเข้าหน้า Admin ไม่ได้ - ต้อง Promote เป็น Admin ก่อน!
กรณีล็อกอินแล้วแต่เข้าหน้า Admin (`/admin`) ไม่ได้ ยังไม่ใช่ role `admin`

**วิธีแก้ไข (ต้องทำผ่าน Supabase SQL Editor):**

```sql
UPDATE public.profiles SET role = 'admin' WHERE email = 'your-email@gmail.com';
```

หรือใช้ function ที่พร้อมให้:

```sql
SELECT public.promote_to_full_admin('your-email@gmail.com');
```

หลังจาก run แล้ว ให้ Logout แล้ว Login ใหม่ จะเข้า Admin ได้ทันที

---

## 2. Dashboard และภาพรวมธุรกิจ

**URL:** `/admin/dashboard`

Dashboard แสดงข้อมูลสำคัญทั้งหมดในหน้าเดียว

### ข้อมูลที่แสดง
- 📊 **ออเดอร์วันนี้**: จำนวนออเดอร์ / ยอดขายรวม
- 👨‍🍳 **สถานะครัว**: ออเดอร์ที่กำลังเตรียม / รอรับ / เสร็จแล้ว
- 🚴 **ไรเดอร์**: ไรเดอร์ออนไลน์ / กำลังขนส่ง / เสร็จแล้ว
- ⚠️ **สินค้าใกล้หมด**: รายการที่ stock ต่ำกว่า min
- 💰 **รายได้รายวัน**: กราฟแสดงรายได้

### วิธีใช้งาน
- คลิกที่การ์ดแต่ละใบเพื่อดูรายละเอียดเพิ่มเติม
- ดึงข้อมูลแบบ real-time (auto-refresh ทุก 30 วินาที)
- บนมือถือ: แตะไอคอน "กลับไปด้านบน" ด้านซ้ายบนเพื่อกลับ Dashboard ได้เสมอ

### เมนูนำทางด้านซ้าย (AdminNav)
แถบด้านซ้ายทุกหน้า admin มีลิงก์ไปทุกหน้า:
Dashboard, Orders, Menu, Approvals, Rounds, Promos, Customers, Inventory, Media, Settings, Delivery, Route, Audit, Errors, Mascot, Control

---

## 3. จัดการออเดอร์ (Orders)

URL: /admin/orders

ภาพรวม
หน้านี้ใช้ดู จัดการ และติดตามออเดอร์ทั้งหมดของลูกค้า

คอลัมน์ที่สำคัญ
| คอลัมน์ | รายละเอียด |
|---------|-----------|
| Order # | เลขที่ออเดอร์ เช่น BMB-20260926-001 |
| Customer | ชื่อ + เบอร์โทรลูกค้า |
| Status | สถานะปัจจุบัน (Created, Accepted, Preparing, Ready, Dispatched, Delivered) |
| Total | ราคารวม (THB) |
| Payment | วิธีการชำระ (credit_card, promptpay_qr, cash_on_delivery) |
| Mode | SAME_DAY หรือ PRE_ORDER |
| Created | เวลาสร้างออเดอร์ |

การดำเนินการ (Actions)

ยืนยันออเดอร์ (Confirm Order)
1. คลิกปุม ยืนยัน ในแถวที่ต้องการ
2. ระบบเปลี่ยนสถานะเปน Confirmed

เปลี่ยนสถานะ
ใชปุม ลกศรเลื่อนขั้น ลงไดภายในขอบเขตที่กำหนด:
SAME DAY: Created -> Accepted -> Preparing -> Ready -> Dispatched -> Delivered
PRE ORDER: Booked -> Allocated -> Batch Production -> Ready -> Dispatched -> Delivered
ระวัง: ห้ามนกระโดดขามขั้นตอน

จัดการการชำระเงิน (Offline Payments: PromptPay/COD)
สำหรับ PromptPay:
1. ลูกคา submit TXN ID -> สถานะเปน Processing
2. Admin คลิก Confirm Payment -> Paid
3. ตรวจสอบกับธนาคารกอน confirm

สำหรับ COD:
1. ไรดือนำสินคาไปสง เก็บเงิน กด Mark Delivered
2. Admin กด Confirm Payment -> Paid

Filter & Search
- SAME_DAY / PRE_ORDER
- Search by Order # or Customer Name
- Date Range Picker
- By Payment Status

---

## 4. จัดการเมนูและสินค้า (Products)

URL: /admin/products

เพิ่มเมนูใหม
1. กด ปุม + New Product
2. กรอกขอความ: ชื่อสินคา, ราคา (จำนวนเต็ม THB), หมวดหมู, Prep Time (นาที), คำอธิบาย (optional), รูปภาพ (อัพโหลด/URL), Active?, Add-ons (JSON)
3. กด Save Product

ไขไขเมนู
1. หาหาสินคาในตาราง
2. คลิกปุม Edit
3. ปรับแก -> Update

ซอน/แสดงสินคา
- ติ๊กหลง Is Available เพื่อแสดง/ซอนสินคา
- สินคาที่ inactive จะไมแสดงผลในหนาเมนูของลูกคา

จัดหมวดหมู (Categories)
1. เลื่อนลงไปตามดานลางของหนา Products
2. + New Heading สร้างหมวดหมูใหม (ชื่อ, ไอคอน, ลำดับ, Active)
3. Edit เปลี่ยนชื่อ/ลำดับ/ไอคอน
4. Delete ลบไดเฉพาะเมื่อไมมมีสินคาในกลุ่มนี้

---

## 5. จัดการรอบส่ง (Rounds)

URL: /admin/rounds

ระบบจัดรอบส่งช่วยกระจายออเดอร์ตามช่วงเวลา เหมาะกับร้านอาหารที่ตองวางแผนลางหนา

สร้างรอบสงใหม
1. กด + New Round
2. กรอกขอความ: วันที่, เวลาเริ่มต้น/สิ้นสุด, ความจุสูงสุด (max orders), พื้นที่ให้บริการ (km จากครัว), Active?
3. Save Round

การใช้งาน
- ลูกคาจะเห็นเฉพาะรอบที่ยังเหลือ capacity
- ออเดอร์จะถูกผูกกับ round ที่ตรงเงื่อนไข
- ระบบ auto-reject หากเกิน capacity

---

## 6. จัดการโปรโมชั่น (Promotions)

URL: /admin/promotions

สร้างโปรโมชั่น
1. กด + New Promotion
2. กำหนดประเภท: Discount (%), Fixed Amount, Free Shipping, Banner

ตั้งคาโปรโมชั่น
Name: Summer Sale 2026
Type: Percentage Discount, Value: 15, Min Order: ฿200, Expiry: 2026-12-31
Status: Active/Scheduled/Expired

Approval Flow
- Banner ทุกอันตองผานการ approve กอนแสดงผล
- ไปที่ /admin/content-approvals เพื่อดูและ approve

---

## 7. จัดการลูกคา (Customers)

URL: /admin/customers

ดูรายชื่อลูกคา
- รายชื่อบัญชี, อีเมล, เบอร์โทร, ที่อยู่สง, ประวัติการสั่งซื้อ

ขอมูลลูกคา
1. คลิกที่ customer row เพื่อดูรายละเอียด
2. แสดง: ประวัติออเดอร์ทั้งหมด, ยอดซื้อรวม (Lifetime Value), จำนวนออเดอร์, คะแนน Loyalty Points

Promote เป็น Admin
หากต้องการเพิ่ม Admin คนใหม:
UPDATE public.profiles SET role = admin WHERE email = new-admin@email.com;

---

## 8. จัดการสินคาคงคลัง (Inventory)

URL: /admin/inventory

เพิ่มวัตถุดิบ
1. กด + New Ingredient
2. กรอก: ชื่อวัตถุดิบ, หน่วยนับ (g/ml/ชิ้น), สต็อกปัจจุบัน, Minimum Stock, ต้นทุนตอหนวย, Active?

การเตือนสต็อกต่ำ
- Dashboard แสดงรายการที่ stock <= min
- สีแดง = เกิน limit / สีส้ม = ใกล้หมด

อัพเดทสต็อก
- ปุม + Restock เพิ่มสต็อก
- ปุม - Deduct หักสต็อก (ใช้ในกรณี manual)

---

## 9. ตั้งค่าระบบ (Settings)

URL: /admin/settings

คาที่สำคัญ
| Setting | คาต้งตน | คำอธิบาย |
|---------|-----------|----------|
| Kitchen Lat/Lng | 10.7016, 102.1429 | ตำแหน่งครัว |
| Max Delivery Radius | 5 km | รัศมีการจัดส่ง Bite Drive |
| Bite Drive Fee | ฿25 | คาสงในโซน Bite Drive |
| Tier 2 Markup | 12% | สวนต่างราคา 3rd party |
| Free Shipping Threshold | ฿300 | ซื้อครบสงฟรี |
| Daily Quota | 120 | จำนวนออเดอร์สูงสุดตอวัน |
| Cutoff Hours | 2 | สั่งกอนกี่ชม.จึงจะสงได |

แกไขคา
1. ไปที่ Settings page
2. เปลี่ยนคา -> กด Save Changes
3. มีผลทันที (ไม reboot)

---

## 10. จัดการการจัดสง (Delivery)

URL: /admin/delivery

Two-Tier Logic
ระบบแบงเลนทางการสงจัดสง 2 ชัน:

Tier 1: Bite Drive (<= 5km)
- ใชไรดรรานเอง
- คาสงคงที่ ฿25
- ควบคมคุณภาพ 100%

Tier 2: External Partner (> 5km)
- ใช Grab/LINE MAN/Foodpanda
- เรียก Real-time Quote จาก API
- Platform markup 12%

ตั้งคา External Providers
- ไปที่ /admin/delivery
- Toggle providers ตามความตองการ:
  - Grab Rider
  - Lineman Rider
  - Foodpanda (mockup only)

---

## 11. Rider PWA — จอไรเดอร์

URL: /rider (สาธารณะ)

หนาที่
แอปพลิเคเชนสำหรับไรดรรบ-สงของ

ขั้นตอนการใช้งาน
1. เขาสูระบบ — ใส่เบอร์โทรศัพท
2. รรับออเดอร์ — เห็นรายการ pending
3. เริ่มเดินทาง — กด Accept
4. อัปเดตสถานะ — รับของ -> ระหว่างทาง -> ถึงแลว
5. POD (Proof of Delivery) — ถ่ายรูปหลักฐาน + GPS required

ฟีเจอร์ POD
- ถ่ายรูป — ใชกลองมือถือน
- GPS Auto — อานพิกัดอัตโนมัติ
- หมายเหตุ — เพิ่มขอเพิ่มเติม

---

## 12. การชำระเงิน (Payment Management)

สรุป Flow การชำระเงิน

Credit Card (Stripe)
1. Customer เลือก บัตรเครดิต/เดบิต
2. ระบบเรียก create-checkout EF -> สร้าง Stripe PI
3. Customer จ่ายผาน Stripe Elements
4. Stripe webhook แจ้งสำเร็จ -> mark as PAID

PromptPay QR
1. Customer เลือก PromptPay QR
2. ระบบแสดง QR Code + จำนวนเงิน
3. Customer สแกนโอน -> ไใส่ TXN ID ในระบบ
4. Admin ตรวจสอบ -> Confirm Payment -> PAID

Cash on Delivery (COD)
1. Customer เลือก เงินสดตอนรรับของ
2. ไรดือนำสินคาไปสง -> เก็บเงิน
3. ไรเดอร์กด Mark Delivered + ถ่ายรูป POD
4. Admin Confirm Payment -> PAID

การตรวจสอบสถานะ
- ไปที่ /admin/orders -> Filter by Payment Status
- Status: Pending -> Processing -> Completed -> Refunded

---

## 13. ปัญหาที่พบบบอย + วิธีไข

เข้าหนา Admin ไม่ได้ / Promoted แลวแต่ยังเขาไมได
สาเหตุ: ยังไมใช role admin ในฐานขอมูล
วิธีไข:
UPDATE public.profiles SET role = admin WHERE email = your-email@gmail.com;
หรือ
SELECT public.promote_to_full_admin(your-email@gmail.com);
-> Logout แล้ว Login ใหม่ จำเปน

ออเดอร์ค้างสถานะ (Pending/Confirmed ตลอดเวลา)
สาเหตุ: ไมมีการ confirm offline payment สำหรับ PromptPay/COD
วิธีไข:
SELECT * FROM payment_intents WHERE order_number = ORDER-NUMBER ORDER BY created_at DESC;
UPDATE payment_intents SET status = completed, updated_at = NOW() WHERE order_number = ORDER-NUMBER AND status IN (pending, processing);

เมนูไมแสดงผลในหนาลูกค้า
สาเหตุ: Product ถูก disable หรือ Category inactive
วิธีไข:
1. ไป /admin/products
2. เช็คหลง Is Available ต้อง Active
3. ไปเช็ค Category heading ต้อง Active ดวย

คาสงผิด (ไมตรงกับระยะทางจริง)
สาเหตุ: ใช Haversine (line straight) แทน Google Maps driving distance
วิธีไข:
ตรวจสอบ .env keys: VITE_GOOGLE_MAPS_API_KEY, VITE_GOOGLE_ROUTES_API_KEY
-> Push ใหม่ -> ระบบจะใช Google Routes API อัตโนมัติ

Stripe Payment ผิดพลาด / สร้าง Checkout ไมได
สาเหตุ: Key ไมถูกตอง หรือ EF ไดไม deploy
วิธีไข:
1. ตรวจสอบ .env keys ครบทั้ง 3 ตัว: VITE_STRIPE_PUBLISHABLE_KEY, VITE_STRIPE_SECRET_KEY, VITE_STRIPE_WEBHOOK_SECRET
2. ตรวจสอบ Edge Functions ใน Supabase Dashboard -> Functions
   - create-checkout ตองมี deployed
   - stripe-webhook ตองมี deployed
3. Re-test กับ card test numbers: สำเร็จ 4242 4242 4242 4242 | ล้มเหลว 4000 0000 0000 0002

บริการภายนอก (Grab/LINEMAN) ไมทำงาน
สถานะปจจุบัน:
- Grab Sandbox: grab_mock_client_id (mock only)
- LINE MAN Sandbox: lineman_mock_api_key (mock only)
- Foodpanda: Mockup เท่านั้น

ไรดอรไมรรับออเดอร์ / ไมมมีไรดอรออนไลน
สาเหตุ: Driver status ไมใช available
วิธีไข:
SELECT * FROM drivers ORDER BY id;
UPDATE drivers SET status = available WHERE id = DRIVER-ID;

 logoutไมได / Session คาง
วิธีไข:
1. กดปุม Logoutดานขวาบน
2. หรือกด Ctrl+F5 เพื่อ hard refresh

ติดตอ Support
- GitHub Issues: https://github.com/bitemebaby2016-coder/bmb/issues
- Line OA: @BiteMeBabySupport

---

Environment Variables หลัก (สำหรับ Deploy)
| Variable | คำอธิบาย | จำเปน? |
|----------|---------|---------|
| VITE_SUPABASE_URL | URL ของ Supabase project | จำเปน |
| VITE_SUPABASE_ANON_KEY | Anon key (RLS) | จำเปน |
| VITE_SUPABASE_SERVICE_ROLE_KEY | Service role (EF ONLY) | ห้ามใส frontend |
| VITE_OPENROUTER_API_KEY | AI Chat model | Optional |
| VITE_STRIPE_* | Stripe integration | จำเปน |
| VITE_GOOGLE_MAPS_* | Maps/Routes API | แนะนำ |
| VITE_DELIVERY_KITCHEN_LAT | พิกัดครัว lat | จำเปน |
| VITE_DELIVERY_KITCHEN_LNG | พิกัดครัว lng | จำเปน |

ระวัง: ห้ามนใส service_role_key ใน frontend เด็ดขาด! ควรอยูใน Edge Functions เทานั้น

---

เอกสารนี้จัดทำโดยทีมพัฒนา Bite Me Baby
อัปเดตลสต: 2026-09-26 | Version 2.0

---

## 3. จัดการออเดอร (Orders)

URL: /admin/orders

ภาพรวม
หน้านี้ใช้ด จัดการ และติดตามออเดอรทั้งหมดของลกค้า

คอลัมนที่สำคั
| คอลัมน | รายละเอียด |
|---------|-----------|
| Order # | เลขที่ออเดอร เช่น BMB-20260926-001 |
| Customer | ชื่อ + เบอรทรลกค้า |
| Status | สถานะปัจจุบัน (Created, Accepted, Preparing, Ready, Dispatched, Delivered) |
| Total | ราคารวม (THB) |
| Payment | วิีการชำระ (credit_card, promptpay_qr, cash_on_delivery) |
| Mode | SAME_DAY หรือ PRE_ORDER |
| Created | เวลาสร้างออเดอร |

การดำเนินการ (Actions)

ยืนยันออเดอร (Confirm Order)
1. คลิกปุม ยืนยัน ในแถวที่ต้องการ
2. ระบบเปลี่ยนสถานะเปน Confirmed

เปลี่ยนสถานะ
ใชปุม ลกศรเลื่อนขั้น ลงไดภายในขอบเขตที่กำหนด:
SAME DAY: Created -> Accepted -> Preparing -> Ready -> Dispatched -> Delivered
PRE ORDER: Booked -> Allocated -> Batch Production -> Ready -> Dispatched -> Delivered
ระวัง: ห้ามนกระดดขามขั้นตอน

จัดการการชำระเงิน (Offline Payments)
สำหรับ PromptPay:
1. ลกคา submit TXN ID -> สถานะเปน Processing
2. Admin คลิก Confirm Payment -> Paid
3. ตรวจสอบกับนาคารกอน confirm

สำหรับ COD:
1. ไรดือนำสินคาไปสง เกบเงิน กด Mark Delivered
2. Admin กด Confirm Payment -> Paid

Filter & Search
- SAME_DAY / PRE_ORDER
- Search by Order # or Customer Name
- Date Range Picker
- By Payment Status
\n---\n