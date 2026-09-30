# 03 — Admin User Guide (คู่มือผู้ดูแลร้าน)

> อัปเดต: 2026-09-30 · เข้าใช้งานที่ `/admin` (ต้องเป็น admin ใน `profiles` — ตรวจผ่าน `is_admin()`)

## 1. Dashboard & Branch Switcher
- หลัง login เข้า `/admin` — Dashboard สรุปยอด/ออเดอร์ของ **สาขาที่เลือก**
- **BranchSwitcher** (แถบบน AdminNav): สลับสาขาได้ทุกหน้า admin — ทุกข้อมูล (orders, products, rounds, zones) จะกรองตามสาขาทันที (RLS M088 รองรับ)
- Owner เห็นทุกสาขา / staff เห็นเฉพาะสาขาตัวเอง (`profiles.branch_id` M090)

## 2. หน้าจอหลัก
| Route | หน้าที่ |
|---|---|
| `/admin/orders` | ออเดอร์ (paged, filter ตาม branch, audit trail) |
| `/admin/products` | จัดการเมนู — ราคา/availability/featured/sort (M092 branch overrides) |
| `/admin/rounds` | รอบจัดส่ง — เวลา + capacity (`delivery_rounds`) |
| `/admin/delivery` | Dispatch/delivery management |
| `/admin/promotions` | โปรโมชั่น CRUD + toggle banner |
| `/admin/customers` | ลูกค้า + ประวัติสั่งซื้อ |
| `/admin/settings` | business_settings (เวลาเปิด-ปิด, นโยบายส่ง) ต่อสาขา |
| `/admin/media` | Media Library (upload → bucket `bmb-images`) |
| `/admin/portfolio` | อัลบั้มผลงาน (M094) — แสดงบนหน้ารีวิวสาธารณะ |
| `/admin/inventory` | สต๊อก |
| `/admin/audit-log` | บันทึกการกระทำทั้งหมด |
| `/admin/errors` | หน้ารวม error ระบบ |
| `/admin/mascot`, `/admin/brands`, `/admin/tenants` | ตกแต่ง mascot / แบรนด์ / ผู้เช่า |

## 3. 🤖 AI Studio v2 (`/admin/ai-studio`)
### 3.1 สร้างแคปชัน (แท็บ "✨ สร้าง")
- เลือก 1 template: ☀️ แคปชันเปิดร้าน / 🔥 โปรโมตเมนูขายดี / 📸 แคปชันอัลบั้มผลงาน
- ระบบดึงข้อมูลจริง: สินค้า featured · ผลงาน M094 · รีวิว verified ⭐4+ (M093)
- ได้ผลลัพธ์ **3 สไตล์ A/B**: 🏢 เป็นทางการ / 🤝 เพื่อนสนิท / 🎉 โปรโมชัน — กด 📋 Copy ที่สไตล์ที่ชอบ
### 3.2 ประวัติ (แท็บ "📁 ประวัติ & โปรด")
- ประวัติการสร้าง 50 รายการล่าสุด (เก็บในเครื่อง) — ติดดาว ⭐ เก็บแคปชันโปรด / 📋 คัดลอกซ้ำ / ล้างประวัติ
### 3.3 ตั้งเวลาโพสต์ (แท็บ "📅 ตั้งเวลาโพสต์")
- Content Calendar (จำลอง): เลือกวันที่จาก date picker → แคปชันถูกจัดกลุ่มตามวันในปฏิทิน
- ⚠️ ยังเป็นระบบวางแผนในเครื่อง — ไม่โพสต์อัตโนมัติ

## 4. น้อง Bite (ฝั่งลูกค้า — ที่ admin ควรรู้)
- วิดเจ็ตแชทมุมขวาล่างหน้าร้าน: ตอบจากข้อมูลจริง (สาขา + เมนู + รอบส่ง) ผ่าน cache 12 นาที
- รองรับสั่งด้วยเสียง (Web Speech API th-TH) + ตอบเป็นเสียงได้
- หากแก้เมนู/รอบส่งแล้วอยากให้ AI รู้ทันที: cache จะรีเฟรชเองภายใน 12 นาที
- AI มี guardrail: ไม่สัญญาราคา/สถานะออเดอร์ — แนะนำให้ลูกค้าสั่งผ่านแอปเสมอ

## 5. เคล็ดลับการใช้งาน
- ตั้งรอบส่งให้ครบวันนี้+พรุ่งนี้ ลูกค้าจะเห็นตัวเลือกสั่งถูกต้อง (cutoff ตาม `delivery_rounds.cutoff_time`)
- สินค้าที่หมด: ปิด `is_available` → ลูกค้าและ AI เห็น "ไม่มีวันนี้" ทันทีหลัง cache รีเฟรช
- เพิ่มผลงานใน Portfolio + รีวิวจะ verified เมื่อผูก order_number จริง