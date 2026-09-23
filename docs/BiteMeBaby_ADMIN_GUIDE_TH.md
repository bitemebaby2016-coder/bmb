# Bite Me Baby -- คู่มือผู้ดูแลระบบ (Admin Guide)

> ปรับปรุง: 2026-09-21 -- เขียนตามความเป็นจริงของระบบ (overwrite ไม่ append)

---

## เข้าสู่ระบบ (Login)

- เปิดเว็บแล้วกด **เข้าสู่ระบบ** (email + password)
- ผู้ดูแลระบบ = profile ที่มี role = `admin` (ระบบตรวจด้วย server/RLS)
- หลังเข้าระบบ --> กด **Admin** ด้านขวาหรือเปิด `/admin`
- หาก role ยังไม่ใช่ admin, owner ต้อง promote ก่อน:
  `select public.promote_to_full_admin('you@example.com');`

---

## Dashboard และการนำทาง

- `/admin` --> ภาพรวมธุรกิจ: ออเดอร์วันนี้, ไดรเวอร์, pending, delivered, stock ต่ำ
- **AdminNav** (แถบด้านซ้ายทุกหน้า admin): สลับหมวดหมู่ได้ในคลิกเดียว
- บนมือถือ --> ปุ่ม **Dashboard**: กลับไปแผงควบคุมได้ทุกเวลา
- หมวดหมู่: Dashboard, Orders, Menu, Approvals, Rounds, Promos, Customers, Inventory, Media, Settings, Delivery, Route, Audit, Errors, Mascot, Control

---

## เมนูและหมวดหมู่

- **+ เพิ่มเมนู** -- ชื่อ, ราคา, หมวดหมู่, prep time, คำอธิบาย, รูปภาพ
- **รูปภาพ**: อัพโหลดไฟล์ (preview) หรือใส่ URL; **Remove image** -- ลบรูปภาพที่เลือก
- แสดงผลแบบสลับ: ขายอยู่ / ซ่อนไว้, Add-ons (ราคาคำนวณฝั่ง server)
- **Category headings** (ส่วนล่างรายการเมนู):
  * **+ New heading** -- สร้าง heading ใหม่ (name + icon + order + active)
  * Edit -- เปลี่ยนชื่อ/ไอคอน/ลำดับ/ซ่อน, Delete -- ลบได้เฉพาะเมื่อ empty
  * หมวดหมู่ที่ยบันทึกจะแสดงแก่ลูกค้าทันที

---

## การอนุมัติเนื้อหา (Content Approvals)

- หน้า `/admin/content-approvals` -- ส่งขอ approves (type + title + body)
- การเผยแพร่ทำได้ **เฉพาะเมื่อ approved** เท่านั้น
- Admin: **Approve** / **Reject** + หมายเหตุ
- Banner จาก Promotions จะถูกส่งห approval โดยอัตโนมัติ

---

## ตาราง URLs

| URL | ความรับผิดชอบ |
|-----|---------------|
| `/admin` | Dashboard |
| `/admin/orders` | ออเดอร์, สถานะ |
| `/admin/products` | เมนู + หมวดหมู่ |
| `/admin/rounds` | รอบส่ง, จำกัด |
| `/admin/promotions` | Promo/coupon/banner |
| `/admin/content-approvals` | Approval |
| `/admin/customers` | ลูกค้า |
| `/admin/inventory` | วัตถุดิบ/สต็อก |
| `/admin/media` | สื่อ (bmb-images) |
| `/admin/settings` | ตั้งค่า |
| `/admin/delivery` | Bite Drive + External |
| `/admin/route-optimization` | วิดีดเส้นทาง |
| `/admin/audit-log` | บันทึกการกระทำ |
| `/admin/errors` | ข้อผิดพลาด |
| `/admin/mascot` | มาสคอต |
| `/admin/control` | Quota/Rider |
| `/rider` | Rider PWA |

---

## Deploy

- Cloudflare Pages: `git push origin main` --> deploy อัตโนมัติ
- Env: `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, `VITE_OPENROUTER_API_KEY`
- ห้ามใส่ `service_role` key ใน frontend เด็ดขาด
- **Migrations 001-034: ผ่าน `supabase db push` แล้ว (34/34 LIVE, history consistent)**
- ก่อน push: `npm test` + `npm run build` + `npm run lint`
- **WAVE 3 verification: `node e2e/prodCheckMigrations.cjs --remote` + `node e2e/prodCheckGrants.cjs --remote` + `node e2e/prodRunContracts.cjs`**

---

**สิ้นสุดคู่มือผู้ดูแลระบบ**
