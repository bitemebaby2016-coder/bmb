# Bite Me Baby — Specificationsผลิตภัณฑ์เป้าหมาย

## ภาพรวม
Bite Me Baby เป็น **Cloud Kitchen Operating Platform** ที่รวมระบบจัดการออเดอร์ การควบคุมสต็อก ลูกค้า และระบบ AI มาไว้ในระบบเดียวสำหรับร้านค้าผู้ปรุงอาหารเมืองจันทบุรี

## คุณลักษณะหลักของผลิตภัณฑ์

### 1. ระบบจัดการออเดอร์
- **Pre-order & Same-day Order** — รองรับการสั่งซื้อล่วงหน้าและออเดอร์วันเดียวกัน
- **Unified Order Hub** — ศูนย์รวมการจัดการออเดอร์ทั้งหมด
- รองรับการส่งหลายรอบ (morning, midday, evening)
- ลำดับชีวิตของออเดอร์: pending → confirmed → preparing → dispatched → in_transit → delivered
- ติดตามสถานะออเดอร์แบบเรียลไทม์

### 2. Bite Drive (การส่งของภายนอก)
- การบูรณาการกับพันธมิตรการส่งของภายนอก
- ผู้ให้บริการที่รองรับ: self_delivery, grab_rider, linemen_rider, foodpanda_rider
- การจัดเส้นทางแบบ Dynamic ตามความจุและความพร้อม
- ติดตามการส่งของแบบเรียลไทม์

### 3. การจัดการลูกค้าและความภักดี
- โปรไฟล์ลูกค้าที่มีการปรับแต่ง
- ระบบ Loyalty points (สะสม/แลกเปลี่ยน)
- โปรแกรมแนะนำเพื่อน (Referral)
- ข้อเสนอแนะที่ปรับแต่งเฉพาะบุคคล

### 4. การจัดการสต็อก
- ติดตามวัตถุดิบด้วยระดับสต็อก (current_stock, min_stock, max_stock)
- การแจ้งเตือนสต็อกต่ำและการสั่งซื้อใหม่
- การบูรณาการกับผู้จัดจำหน่าย (supplier_name, supplier_phone)
- ติดตามสต็อกต่อสินค้าแต่ละรายการพร้อมสถานะ (in_stock, low_stock, out_of_stock, critical)

### 5. บริการลูกค้าที่ขับเคลื่อนด้วย AI
- การบูรณาการ OpenRouter AI เพื่อการสนับสนุนแบบสนทนา
- Natural Language Processing สำหรับคำถามลูกค้า
- รองรับหลายภาษา (ภาษาไทย)
- ตอบสนองที่รู้บริบทภายในแพลตฟอร์ม

### 6. การดำเนินการในครัว
- คอลัมน์สินค้าหลายหมวด (จานเดียว, ข้าว, แกง, เครื่องดื่ม, ของหวาน)
- การประมาณเวลาการเตรียมอาหาร (prep_minutes)
- กระบวนการเตรียมออเดอร์
- การประสานงานพนักงานในครัว

### 7. 3D Floating Visual Layout (เพิ่มใหม่ v1.5)
- **3D Floating UI** — Layering ภาพอาหารเหลื่อมหลุดขอบบนการ์ด (Negative Margin) + `filter drop-shadow` ซ้อนเลเยอร์ (Soft UI / Glassmorphism)
- **Micro-interactions** — Hover/Active: ภาพ `group-hover:-translate-y-4 group-hover:scale-105`, การ์ด `group-active:scale-[0.99]` พร้อมเงาฟุ้งระดับพรีเมียม
- **Business Rules** — ปุ่ม Same-day Order แสดงเมื่อ `is_available = true` ผ่าน Live Availability Engine; ปุ่ม Pre-order เลือก Delivery Round; สองปุ่มแยก Action และ Log เด็ดขาด
- รายละเอียดฉบับเต็ม: `docs/COMPONENT_SPEC_UI.md`

## เทคโนโลยีสแต็ก

| องค์ประกอบ | เทคโนโลยี |
|------------|-----------|
| Frontend | React + TypeScript + Vite |
| Backend | Supabase (PostgreSQL) |
| State Management | Zustand |
| AI Service | OpenRouter API |
| Storage | Local storage (ฝั่ง client) |
| Routing | React Router |
| Styling | Tailwind CSS |

## โมเดลข้อมูล

### Product
- ID, name, description, price, category_id, image_url, is_available, is_featured, prep_minutes, sort_order
- `image_url` เป็นรูปอาหารที่ Admin อัปโหลด/แก้ไขผ่าน Products Management
- สถานะ `is_available` เป็นเงื่อนไขบังคับของปุ่ม Same-day Order บน PWA (ผูกกับ Live Availability Engine)

### Order
- ID, order_number, customer_id, customer_name, customer_phone, delivery_round, status, total_amount, delivery_fee, payment_method, payment_status, delivery_address, dropoff_latitude, dropoff_longitude, items, timestamps

### Inventory
- ID, name, category, unit, current_stock, min_stock, max_stock, unit_price, supplier_name, supplier_phone, status

### Customer
- ID, email, phone, name, line_id, default_latitude, default_longitude, default_address_detail, loyalty_points, total_orders, total_spent

## อินเทอร์เฟซหลัก

### Order Lifecycle
1. **Pre-order** → **Confirmed** → **Preparing** → **Dispatched** → **In Transit** → **Delivered**

### Delivery Flow
1. Order placed → Kitchen preparation → Pickup/location selection → Dispatch to driver → Delivery → Customer notification

### AI Interaction
- ผู้ใช้สามารถโต้ตอบผ่านแชทกับผู้ช่วย AI ได้
- ตอบสนองในภาษาไทย
- จัดการคำถามทั่วไป (เมนู, ออเดอร์, สถานะการส่ง ฯลฯ)

## เกณฑ์ความสำเร็จ
- อัตราการส่งมอบออเดอร์ 100%
- เวลาการเตรียมออเดอร์น้อยกว่า 30 นาที
- การมองเห็นสต็อกแบบเรียลไทม์
- ความพึงพอใจของลูกค้าสูง (CSAT > 4.5/5)
- การสูญหายของออเดอร์ระหว่างการส่ง 0

## การปฏิบัติตามมาตรฐานและข้อบังคับ
- ข้อมูลปฏิบัติตามข้อกำหนด GDPR
- การตรวจสอบสิทธิ์ที่ปลอดภัย (Supabase auth)
- การประมวลผลการชำระเงินมาตรฐาน PCI-DSS
- มาตรฐานความเข้าถึง (WCAG 2.1)

## ประวัติเวอร์ชัน
- v1.0: การปล่อยแพลตฟอร์มครั้งแรก (2026-09-13)
- v1.1: เพิ่มการบูรณาการ Bite Drive
- v1.2: เพิ่มความสามารถในการสนทนาด้วย AI
- v1.3: คอลัมน์สินค้าหลายหมวด
- v1.4: การบูรณาการโปรแกรมความภักดี
- v1.5: เพิ่ม 3D Floating Visual Layout (Admin อัปโหลดรูปเอง) บนหน้า PWA Home/Menu (2026-09-14)

## แหล่งอ้างอิง
- Bite Me Baby README: D:\A PROJECT\Bite Me Baby\README.md (Section #101)
- Component/UI Spec: docs/COMPONENT_SPEC_UI.md (v1.1)
- Schema ฐานข้อมูล: Supabase PostgreSQL (products, orders, inventory, customers)
- เอกสาร API: endpoint bmb_orders, bmb_products, bmb_inventory
- การตั้งค่า AI: OpenRouter API keys ที่กำหนดใน config