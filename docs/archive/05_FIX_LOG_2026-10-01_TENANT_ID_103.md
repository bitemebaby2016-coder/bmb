# FIX LOG — 2026-10-01: Admin CREATE 403/400 (tenant_id 23502) — migration 103

## อาการ (end-to-end trace)
- `/admin/products` กด **+ New heading / + Section / เพิ่มเมนู** → `POST rest/v1/product_categories|menu_sections|products` → **400 Bad Request**
- Error: `23502 — null value in column "tenant_id" of relation ... violates not-null constraint`
- ผู้ใช้เห็นเป็น 403 เมื่อ cache JWT เก่า + ปุ่ม Save ใช้งานไม่ได้ทุกจุดในหมวด/Section

## Root cause (ยืนยันจาก prod probe 2026-10-01)
1. Migrations 062..101 (tenant wave, TEN-05/06/07) เพิ่ม `tenant_id TEXT NOT NULL` **ไม่มี default** ให้ 16 ตาราง (product_categories, menu_sections, products, delivery_rounds, addon_groups, addons, branches, brands, business_settings, delivery_assignments, delivery_zones, drivers, mascot_overrides, menu_schedule, product_addon_groups, profiles)
2. Client insert ใน `bmbAdminApi_products.ts` (createProduct / createCategory / createSection / createDeliveryRound) **ไม่ส่ง tenant_id** → ทุก CREATE ล้ม 23502
3. RLS/grants **พร้อมอยู่แล้ว**: `is_tenant_admin(tenant_id)` + authenticated มี INSERT/UPDATE/DELETE — ฝั่ง DB ไม่ผิด ผิดที่ client payload

## แก้ 2 ชั้น (defense in depth)
| ชั้น | ไฟล์ | สิ่งที่ทำ |
|---|---|---|
| DB | `supabase/migrations/103_tenant_id_defaults.sql` | + `public.default_tenant_id()` (อ่านจาก `tenants` จริง — owner เปลี่ยน tenant ที่ DB ได้ ไม่ต้องแก้โค้ด) · SET DEFAULT ให้ tenant_id **ทั้ง 16 ตาราง** · verification block จบ migration ถ้า default ขาด |
| Client | `src/lib/bmbAdminApi_products.ts` | + `resolveAdminTenantId()` (adminTenantContext → brandContext → seed default) · ส่ง `tenant_id` ชัดเจนใน 4 insert paths |

## การตรวจสอบ (ทั้งหมดผ่าน)
- `tsc --noEmit` 0 errors · `vitest run` **353/353** · `npm run build` PASS
- `supabase db push` → 103 applied (history: `103` ✅)
- Probe prod: default_tenant_id ครบ **16/16 ตาราง**, fn คืน `tenant-bmb-001`
- RLS insert test (SET LOCAL ROLE authenticated + admin JWT claims, rollback):
  - Section + explicit tenant_id ✅ · Category + default ✅ · Section + default ✅

## หมายเหตุ
- `tenants.id` เป็น **TEXT** (`tenant-bmb-001`) ตามสคีมา tenant wave — "UUID จริง" ในที่นี้ = ใช้ id จริงของ tenant จาก `profiles.tenant_id`/`adminTenantContext` ไม่ใช่ hardcode ในทุก call (default ฝั่ง DB ยังมีเป็น safety net)
- ปัญหาเดิม (401/403 ตอนอ่าน) แก้ด้วย migration 102 (GRANT SELECT) — ยืนยันใน migration history แล้ว
- ควรกระจาย `resolveAdminTenantId()` ให้ API ไฟล์อื่นที่ insert ตาราง tenant-scoped ในอนาคต (ปัจจุบันไม่มี call path อื่นที่เกี่ยว)