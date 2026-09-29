# คู่มือ Admin — Bite Me Baby Cloud Kitchen Command Center

> **สถานะเอกสาร:** สร้างใน gate WHITE-LABEL AUDIT (`a528cdd` เสริม) — อธิบาย **ของที่มีจริงตอนนี้** + รายการที่ยัง "มาเร็ว ๆ นี้" ถูกทำเครื่องหมายชัดเจน ห้ามใช้คำสั่งในหมวด "ยังไม่เปิดใช้" ก่อน Owner ประกาศ

## 1. ภาพรวม Cloud Kitchen Command Center

Admin แบ่งเป็นพื้นที่ควบคุม: **Orders** (ควบคุมออเดอร์, ยกเลิกผ่าน RPC) · **Pre-orders** · **Kitchen** (เริ่มทำ/พร้อมส่ง — server-gated) · **Dispatch** (จ่ายไรเดอร์) · **Payment Exceptions** (อ่านอย่างเดียว) · **Products/Categories** (เมนู) · **Settings** (ชั่วโมง/นโยบาย) · **Mascot** (ปรับภาพมาสคอตต์) — ทุกการเปลี่ยนไปที่ฐานข้อมูลจริง (Supabase) แล้วลูกค้าเห็นทันที (รีเฟรชหน้า)

## 2. การจัดการ Brand — ⚠️ ยังไม่เปิดใช้ (MISSING runtime config)

- ปัจจุบัน: ชื่อร้าน/logo/favicon/OG/PWA metadata ฝังใน code (build ใหม่เท่านั้น) — **ยังเปลี่ยนจาก Admin ไม่ได้**
- ที่ Admin แก้ได้วันนี้: ชั่วโมงเปิด-ปิด, นโยบายส่ง (Settings)
- รอ Owner decision Q1/Q2 (white-label contract) แล้วจะมีหน้า Brand จริง

## 3. การจัดการ Mascot — เปิดใช้แล้ว (CONNECTED)

- หน้า **Mascot Settings**: เลือก role (23 pose: greeting/cooking/delivering/empty_cart ฯลฯ) → ใส่ URL รูป + alt → บันทึก (ผ่าน RPC, มี audit)
- ระบบเลือกภาพ: อ่าน override จาก DB ตาม role → ถ้าไม่มีใช้ภาพ default ใน app
- ข้อจำกัดปัจจุบัน: ยังใส่ URL เอง (ยังไม่ผูก upload), ไม่มีชื่อ/คำอธิบาย mascot — รอ WL-04

## 4. การจัดการ Media — ⚠️ ยังไม่เปิดใช้จริง (DEPLOYED/NOT CONNECTED)

- หน้า Media มีอยู่แต่ยังไม่ต่อ upload จริง — อย่าใช้จนกว่าจะประกาศ (รอ CAT-D03)

## 5. การจัดการ Menu

- **Section (migration 055)**: สร้าง/แก้/ลำดับ/ซ่อน-แสดง/จัดเก็บ — Section ปิด = ลูกค้าไม่เห็นและ **server ปฏิเสธออเดอร์สินค้าใน Section นั้นจริง** (ERR_SECTION_CLOSED)
- **Category (หมวด)**: เพิ่ม/แก้/ลำดับ/ซ่อน + เลือก Section ที่สังกัด + จัดเก็บ (archive) — หมวดใน Section ปิดจะซ่อนทั้งหมวด
- **Product** อยู่ใต้ Category · โครงสร้างเต็ม: Section → Category → Product (TEN-D01=A: catalog เป็นของ Tenant, Brand เป็น presentation layer ภายหลัง)
- **Menu Schedule รายสัปดาห์ (migration 039/056 — CAT-D02=A)**: หน้า **/admin/menu-schedule** — เลือกวันที่ (≤ preorder_max_days จาก order_policy จริง), ติ๊กสินค้าที่ขายได้ + กำหนด round key (ว่าง = ทุกรอบ), Save (replace-all) → **Publish** เพื่อบังคับใช้จริง · Effective state แสดงจาก DB ตรง
- **Server บังคับใช้จริง**: PRE_ORDER วันที่มี published menu สินค้านอกเมนูถูก RPC ปฏิเสธ (`ERR_PRODUCT_NOT_ON_MENU`) · วันที่ไม่มี menu = ใช้เงื่อนไข pre-order ปกติ (`available_preorder`) · mode/round เปิด-ปิด ผ่าน Settings (operating_hours) → `ERR_ORDER_MODE_CLOSED` / `ERR_ROUND_CLOSED`
- Customer Checkout (pre-order) อ่าน schedule published เดียวกัน + แจ้งเตือนก่อน submit — server ยังเป็นผู้ตัดสินสุดท้าย

## 6. การจัดการ Product

ชื่อ · รายละเอียด · **ราคา** (แก้แล้ว order ใหม่ใช้ราคาใหม่ทันที — server คำนวณเอง อย่าส่งราคาเองเด็ดขาด) · รูป (อัปโหลดจากเครื่อง — ปัจจุบันเก็บแบบฝังใน DB, กำลังจะย้ายระบบรูป อย่าอัปรูปใหญ่) · **Availability** (ปิดขาย = ลูกค้าไม่เห็น + สั่งไม่ได้ทันที) · same-day/preorder แยกกัน · is_featured (หน้าแรก) · ลำดับ (sort_order) · **Add-ons** (extra/topping ต่อสินค้า: ราคาและตัวเลือก server คิดเอง)

## 7. Menu Schedule — รอ implementation (CAT-D02) — ยังไม่อธิบายขั้นตอน

## 8. Archive — นิยามปัจจุบัน

| คำ | ความหมายวันนี้ | ลูกค้าเห็น? | กู้คืน? |
|---|---|---|---|
| **Unavailable** (is_available ปิด) | ปิดขายชั่วคราว | ไม่เห็น | ✅ เปิดกลับ |
| **Inactive** (หมวด is_active ปิด) | ซ่อนทั้งหมวด | ไม่เห็น | ✅ เปิดกลับ |
| **Archived** | ✅ (migration 055): จัดเก็บ — ลูกค้าไม่เห็น + server ปฏิเสธ order (ERR_PRODUCT_ARCHIVED) | ไม่เห็น | ✅ ปุ่มกู้คืนใน Admin |
| **Unavailable** (is_available ปิด) | ปิดขายชั่วคราว | ไม่เห็น | ✅ เปิดกลับ |
| **Inactive** (หมวด is_active ปิด) | ซ่อนทั้งหมวด | ไม่เห็น | ✅ เปิดกลับ |

⚠️ **การลบถาวรไม่ใช่กลไกปกติแล้ว** — ปุ่มใน Admin = 📦 จัดเก็บ (กู้คืนได้); hard delete สงวนไว้เฉพาะกรณีพิเศษ

## 9. Theme — ⚠️ ยังไม่เปิดใช้ (code เท่านั้น) — รอ WL-02; ห้ามแก้ไฟล์ CSS เอง

## 10. Mascot Pose — ระบบเลือกอย่างไร

PWA ถาม mascot ด้วยชื่อ role (เช่น หน้าตะกร้า = empty_cart, หน้าจัดส่ง = delivering) → หา override ล่าสุดใน DB → ไม่มี = ภาพ default ประจำ role

## 11. White-label — สรุปสถานะ

```
Brand identity → ยังฝัง code (build เท่านั้น)
Assets/theme   → ยังไม่ผ่าน Admin (mascot ยกเว้น — ทำได้แล้ว)
Catalog        → Admin → DB → PWA ✅ จริง
Multi-store    → ยังไม่มีระบบ (รอ Owner ตัดสิน Q1)
```

## 12. สิ่งที่ Admin ห้ามทำ (เด็ดขาด)

- ❌ แก้ราคาใน order เก่า / แก้ payment state / force สถานะ order / แก้ snapshot ประวัติ
- ❌ bypass server authority (ราคา สถานะ ความพร้อม จ่ายไรเดอร์ = server เท่านั้น)
- ❌ ลบ category ที่มีสินค้าโดยไม่ย้ายสินค้าก่อน (hard delete)
- ❌ แชร์บัญชี Admin ให้ผู้ไม่เกี่ยว / ใส่ URL รูปจากแหล่งที่ไม่ควบคุม
- ❌ ปิดขาย/เปิดขายเมนูรายวันล่วงหน้าด้วยมือทั้งชุด (รอระบบ schedule)

## 13. Troubleshooting

| อาการ | สาเหตุที่พบบ่อย / ทางแก้ |
|---|---|
| สินค้าไม่ขึ้นหน้า PWA | is_available ปิด / หมวด is_active ปิด / รีเฟรชหน้า (ระบบอ่านสด) |
| แก้ราคาแล้ว order เก่าราคาไม่เปลี่ยน | **ถูกต้อง** — order เกัน snapshot ของตัวเอง |
| mascot ไม่แสดงภาพใหม่ | URL รูปไม่ถึง client / role ผิด / รีเฟรช |
| รูปสินค้าไม่โหลด | รูปฝังใน DB ขนาดใหญ่ → รอระบบ storage (WL-03) |
| ปิดเมนูวันนี้แล้วลูกค้ายังสั่งได้ | ตรวจว่าปิด "is_available" ของสินค้าจริง (server จะปฏิเสธเอง) — ถ้ายังไม่ได้แจ้ง dev |
| จ่ายไรเดอร์ไม่ได้ | ตรวจสถานะ order ผ่าน Dispatch; ระบบมี exception log แจ้งทาง Payment Exceptions |

## 14. Status Vocabulary (ใช้ในรายงานทุก gate)

`IMPLEMENTED` = มีโค้ดและใช้ได้ · `CONNECTED` = Admin→DB→PWA ต่อจริง · `DEPLOYED` = พร้อมหลังบ้านแต่ยังไม่มีผู้ใช้ · `RUNTIME VERIFIED` = พิสูจน์จากระบบจริง · `DOCUMENTED` = มีคู่มือ · `MISSING` = ยังไม่มี · `BLOCKED` = ติดขึ้นกับสิ่งอื่น · `DEFERRED` = Owner เลื่อน

## 15. รายการที่รอ Owner ตัดสิน (อย่าใช้ก่อนประกาศ)

Brand/Theme config (Q2/Q3) · Menu sections (CAT-D01) · Weekly menu (CAT-D02) · ระบบรูป storage (CAT-D03) · Archive (CAT-D04) · Add-on กลุ่ม (CAT-D05) · Multi-store (Q1) · ย้ายเมนูเครื่องดื่ม/ขนมเข้า DB (Q4)
