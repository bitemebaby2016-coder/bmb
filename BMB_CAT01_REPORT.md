# BMB — CAT-01 REPORT: Menu / Section / Archive Catalog Control

**Gate:** CAT-01 (1 gate = 1 commit) · ยึด decisions: **CAT-D01=B** (Section = real entity, SERVER-ENFORCED) · **CAT-D04=B** (soft archive) · **TEN-D01=A** (tenant-owned catalog — ไม่เพิ่ม tenant_id gate นี้) · **TEN-D02=A/D03=A/D04=A/D05=Phase1-param/D06=C** (ไม่กระทบ gate นี้)

## Contract
```
Tenant(เดิม, single) → menu_sections → product_categories.menu_section_id → products (+archived)
```
- **เพิ่มเท่านั้น (additive):** ตาราง `menu_sections` · columns `product_categories.menu_section_id / archived` · `products.archived` · RLS ของตารางใหม่ (public_read is_active / admin_manage is_admin()) · trigger `trg_catalog_visibility_gate` (AFTER INSERT ON order_items)
- **ไม่แตะ:** orders/payments/dispatch/inventory schema · state machine (008/030) · `create_order_with_items` · RLS เดิมทุกตัว · tenant_id
- **หมายเหตุการตีความ:** CAT-D01=B กำหนดให้ Section ปิดต้อง **server-enforced** — enforce ทำผ่าน trigger ที่ order_items (จุดเดียวที่ทุก order ต้องผ่าน) โดยไม่แก้ RPC/state machine; "order change" ในคำสั่ง = ห้ามแตะโครงสร้าง/สถานะ order ซึ่งไม่ถูกแตะ

## Server enforcement (production authority)
`trg_catalog_visibility_gate` (055, live ใน prod แล้ว) ปฏิเสธ order transaction เมื่อ: `ERR_PRODUCT_ARCHIVED` · `ERR_PRODUCT_UNAVAILABLE` (เดิม 020) · `ERR_CATEGORY_ARCHIVED` · `ERR_CATEGORY_CLOSED` · `ERR_SECTION_CLOSED` — **ไม่ใช่แค่ซ่อน UI** · หมวดที่ไม่มี section / section NULL = ผ่าน (additive, zero disruption) · **Runtime verify prod: 10/10 สินค้าทุกตัวผ่าน gate (ไม่มีอะไรถูกบล็อกโดยไม่ตั้งใจ) · 0 archived · 0 sections · trigger fn live**

## Archive semantics (CAT-D04=B)
| สถานะ | ความหมาย | ลูกค้า | Server |
|---|---|---|---|
| active/visible | ปกติ | เห็น (RLS) | รับ |
| is_available=false | ปิดขายชั่วคราว | ไม่เห็น (RLS filter) | ปฏิเสธ |
| archived=true (+available=false) | จัดเก็บถาวรแบบกู้คืนได้ | ไม่เห็น | ปฏิเสธ (ERR_PRODUCT_ARCHIVED) |
- **ปุ่ม "ลบ" ใน AdminProducts ถูกแทนด้วย 📦 จัดเก็บ / ↩ กู้คืน** — hard DELETE ไม่ใช่กลไกปกติแล้ว (deleteProduct/deleteCategory ยังอยู่ใน lib แต่ไม่ถูกเรียกจาก UI)
- Restore = ปลด archived เท่านั้น (availability ยังปิด — Admin เปิดเอง)

## Admin (✅ ตามเป้าหมาย Owner)
✅ สร้าง/แก้/ลำดับ/ซ่อน-แสดง/จัดเก็บ Section · ✅ ผูกหมวด→Section (select ในฟอร์มหมวด) · ✅ Archive/Restore สินค้า+หมวด · ✅ Product/รูป/Add-on (เดิม) · เส้นทางทั้งหมด = Admin → RLS(is_admin) → DB → PWA · ไม่มี mock/hardcode/duplicate

## Customer PWA
- MenuPage: จัดกลุ่มตาม **Section → หมวด → สินค้า** ผ่าน `catalogStructure.buildCatalogGroups` (pure mirror, ตรวจเดียวกับ server gate); หมวดที่ถูก assign กับ section ปิด = **ซ่อนทั้งหมวด** (ไม่ fallback); section ไม่มี = แสดงแบบเดิม
- Home showcase (CAT-WL-00): คง canonical, is_available/archived กรองตรงกัน

## Tests / Build
- Vitest **304/304 (33 files)** (+8 ใหม่: catalogControl 3 + catalogGate 5 — control pass + 4 rejection codes + section-close)
- tsc 0 · eslint 0 · vite build PASS · mock (`supabaseMock`) เพิ่ม 055 gate เพื่อ test ผ่าน canonical create_order path
- Runtime E2E กับ admin JWT ยังค้าง G-phase (เดิม); prod verify ครั้งนี้ = read-only + DDL deploy เท่านั้น

## Remaining (ตามลำดับ Owner)
CAT-02 (menu_schedule UI, D02=A) → CAT-03 (media/storage, D03=B) → CAT-04 (Brand/Theme/Mascot single-brand) → Catalog Runtime Verify → Open-Shop Matrix

## 🔴 HARD STOP — รอ Owner review evidence ก่อน gate ถัดไป