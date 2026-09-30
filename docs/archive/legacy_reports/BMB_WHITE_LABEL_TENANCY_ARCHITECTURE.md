# BMB — WHITE-LABEL TENANCY ARCHITECTURE CONTRACT (WL-TENANCY-00)

**ฐาน:** `9e4b149` (CAT-WL-00 closed) · **ประเภท gate: AUDIT + CONTRACT DESIGN ONLY — ไม่มี migration/RLS/RPC/Admin/PWA change** · probe read-only (`e2e/ct-tenancy-probe.cjs`: FK map + RLS ครบ 37 ตาราง)

> **ERRATA (PRODUCTION WINS):** `BMB_ADMIN_MENU_CATALOG_AUDIT.md` §11 เขียนว่า "order_items.product_id ไม่มี FK" — **ผิด**; probe FK map ยืนยัน `order_items.product_id → products.id` มี FK จริง → hard-DELETE product ที่มี order จะถูก RESTRICT (ผลบังคับของ CAT-D04 ใหญ่กว่าที่ประเมินไว้; snapshot ยังรอดเพราะ name/price เก็บใน order_items เอง)

---

## 1. Existing Identity Model (production จริง)

- **ไม่มี** tenant/store/business/organization/brand id ในตารางใด (37 ตาราง, ยืนยันซ้ำด้วย information_schema)
- Single-store assumption ทุกที่: `business_settings` key-value ตารางเดียว · catalog ตารางเดียว · `kitchen_location` จุดเดียว
- Admin authorization = `is_admin()` **global** (SQL function live; policy USING(is_admin()) ทุกตาราง admin)
- FK anchor หลัก (จาก prod FK map): `order_items → orders + products` · `delivery_assignments → orders(order_number) + drivers` · `order_status_history/provider_orders → orders(order_number)` · `orders → delivery_rounds` · `products → product_categories + delivery_rounds` · `menu_schedule/pre_orders/preorder_votes/reviews/recipes → products` · customer-owned → `customers`
- payment_intents ผูก order_number (ทาง policy/คอลัมน์)

## 2. 37-Table Ownership Matrix (สรุป — ตารางเต็มใน `BMB_WHITE_LABEL_TENANCY_DATA_MATRIX.md`)

- คลาส A = **platform global**: profiles, audit_logs, system_errors, content_approvals, customer_channel_identities, drivers (cloud-kitchen กลุ่มเดียว ใช้ pool ร่วมได้ — Owner ยืนยัน)
- คลาส B = **tenant/store-owned**: products, product_categories, menu_schedule, promotions, delivery_rounds, delivery_zones, inventory, inventory_transactions, recipes, production_batches(+items), business_settings, media_assets, mascot_overrides, brands(ใหม่)
- คลาส C = **customer-owned (scope ผ่าน customer/order)**: customers, orders, order_items, order_status_history, payment_intents, delivery_assignments, pre_orders, preorder_votes, reviews, loyalty_points, notifications, notification_prefs, ai_conversations, ai_customer_memory, ai_recommendations, track_order_attempts, provider_orders

## 3. Tenant/Store Model แนะนำ

- **Entities ขั้นต่ำ 2 ตัว:** `tenants` (store/business instance) + `brands` (identity layer)
- **Tenant 1 : N Brand** — เหตุผลจาก business: cloud kitchen หนึ่งที่อาจรันหลาย brand ในครัวเดียว; เก็บ `tenants.default_brand_id` + `brands.tenant_id`
- ชื่อร้าน/contact/hours/policy ยังอยู่ `business_settings` (เพิ่ม tenant scope ภายหลัง)
- **OWNER DECISION REQUIRED หากต่างจากนี้:** ถ้า Owner ต้องการ catalog แยกต่อ brand (ไม่ใช่ต่อ tenant) → anchor ของ catalog เป็น brand_id แทน tenant_id

## 4. Brand Model (Q2=B — design เท่านั้น, ไม่สร้างตาราง)

`brands(id, tenant_id FK, name, display_name, tagline, description, logo refs, favicon/app_icon refs, og_image, social jsonb, is_active, is_default, created_at)` · public read = anon SELECT is_active · admin write = tenant admin · migration source: ไม่มี data เดิม (seed BMB แถวเดียว)

## 5. Theme Ownership (Q3=A)

**Theme เป็นของ Brand** (ตอบโจทย์ "เปลี่ยน brand แล้วธีมเปลี่ยน") — เก็บใน `brands.theme_tokens jsonb` (controlled keys + validation); CSS token 34 vars เดิม = fallback/default ของ brand ที่ไม่ได้กำหนด — ไม่ใส่ theme ลง business_settings (เลี่ยง duplicate)

## 6. Mascot Ownership (Q6=A)

`mascot_overrides` **extend ด้วย tenant_id/brand_id (nullable; NULL = default BMB set)** + metadata ตาม WL-04; 23 poses เดิมคงเป็น default mapping; role_name ยังเป็น key ต่อ tenant

## 7. Media Ownership

`media_assets` ต้องเพิ่ม `tenant_id` + `asset_type` (product/category/mascot/brand_logo/theme/system) + `brand_id nullable` — ไม่ migrate base64 (CAT-D04 แยก gate)

## 8. Catalog Ownership

`product_categories.tenant_id` เป็น anchor → products (FK ต่ออยู่แล้ว) → ตารางที่ผูก products สืบทอดผ่าน FK โดยไม่ต้องเพิ่ม tenant_id ทุกตาราง

## 9. Order Ownership (CRITICAL)

- `orders.tenant_id` เพิ่มในอนาคต (nullable → backfill default → enforce ตามที่ Owner อนุมัติ) — **order_id รูปแบบเดิม (TEXT) คง canonical, state machine 008/030 ไม่แตะ**
- ตาราง order-related แนะนำ **derive ผ่าน orders** แทนการเพิ่มคอลัมน์เอง: order_items (FK order_id มีอยู่), order_status_history (order_number), delivery_assignments (order_number), provider_orders (order_number), payment_intents (order_number) — RLS subquery จาก orders; ถ้าประสิทธิภาพต้องการ denormalize tenant_id ทีหลัง
- Snapshot rule: migration ห้าม update ค่าเดิมใน order_items/orders — แตะเฉพาะคอลัมน์ใหม่

## 10–12. Payment / Delivery / Automation

- payment_intents/Stripe: การรับเงินต่อ tenant (แยกบัญชี/marketplace) = OWNER DECISION ใน G-phase — ไม่แตะ EF/idempotency
- delivery: drivers pool ร่วมกลุ่มหรือแยกต่อ tenant = Owner decision (คลาส A/B ผสม); assignments scope ตาม order
- automation (pg_cron/stale pending/low stock): ต้องรู้ tenant context ต่อ job (`set_config('app.tenant_id')`) — ไม่แตะ scheduler gate นี้; ไม่มี Make.com
- AI: ยัง intelligence-only (ห้าม price/payment/stock/capacity/fee/cancel/refund/order-state authority); AI data scope ต่อ tenant

## 13. Admin Authorization Model

ปัจจุบัน `is_admin()` global → อนาคต `profiles.tenant_id` + `profiles.platform_admin` + `is_tenant_admin(tenant_id)`; Admin A (tenant A) ไม่เห็น/แก้ tenant B (RLS + route guard); platform admin = Owner

## 14. Customer Routing Model

ลำดับ: subdomain (storeA.bitemebaby.com) → custom domain (ตาราง mapping) → QR/store link param → fallback default tenant (BMB) — ทำ phase TEN-06; ปัจจุบัน PWA ไม่มี resolver (DOCUMENTED เท่านั้น); manifest/icon ยัง build-time (จำกัด — ระบุใน WL-05)

## 15. RLS Design (contract เท่านั้น — ไม่แก้จริง)

| Table | Tenant Owner | Current RLS | Future Isolation Rule | RPC Impact | Risk |
|---|---|---|---|---|---|
| products | ✅ | public_read(is_available)/admin(is_admin) | tenant_id = current tenant OR platform_admin | — | ต่ำ |
| product_categories | ✅ | public_read(is_active)/admin | เดียวกัน | — | ต่ำ |
| menu_schedule | ✅ (ผ่าน products) | admin/read | subquery products | enforce_menu_gate ต้องรู้ tenant | กลาง |
| media_assets | ✅ | public/admin | tenant scope + public asset types เท่านั้น | — | ต่ำ |
| mascot_overrides | ✅ (NULL=default) | anon read/admin | tenant scope; NULL อ่านได้ทุก tenant | upsert RPC | กลาง |
| business_settings | ✅ | admin/auth-read/anon-deny(qual=false) | tenant scope หรือคง global ช่วงแรก | — | กลาง |
| orders + derived | ✅ | own/admin เดิม | tenant + own เดิมคงอยู่ | create_order_with_items, transition RPCs ต้อง derive tenant | **สูง** |
| customers/payments/delivery/notifications | ✅ | own/admin เดิม | subquery จาก orders/customers | หลาย RPC | **สูง** |
| profiles | platform | own/admin/public_read | tenant_id + platform_admin | is_tenant_admin() ใหม่ | กลาง |

- **ข้อควรตรวจต่อ (ใน TEN-08):** หลาย policy cmd=ALL ให้ anon (ai_conversations_anon, inventory_transactions_anon, customers_anon, order_items_anon, payment_intents_anon, notifications_anon, content_approvals_anon) — ยังไม่ได้ตรวจ qual รายตัว → ต้อง audit qual ครบก่อน enforce RLS แบบ tenant-aware

## 16. Migration Sequence (planning IDs — ไม่ implement)

```
TEN-01 tenants + brands (seed BMB default; ไม่แตะตารางเดิม)
TEN-02 profiles.tenant_id + is_tenant_admin() (global admin ยังทำงานเต็ม)
TEN-03 catalog ownership (tenant_id nullable + backfill default)
TEN-04 media/mascot/settings ownership
TEN-05 admin authorization enforcement (UI + RPC context)
TEN-06 customer routing (subdomain/link → tenant resolver)
TEN-07 order ownership (orders.tenant_id + derived scoping)
TEN-08 RLS enforcement (หลัง backfill ครบ + RPC regression ครบ)
TEN-09 controlled multi-store E2E
```

## 17–19. Safety / Rollback / Data Migration

ทุก phase: เพิ่มคอลัมน์ nullable → backfill default BMB → NOT NULL/RLS enforce ต้อง Owner อนุมัติแยก · rollback = ปิด policy ใหม่/คงคอลัมน์ (ไม่ลบ) · ศูนย์ data loss (ไม่มี destructive update) · existing orders/snapshots ไม่เปลี่ยนค่าเดิม · RPC เดิม default tenant context จนจบ migration

## 20. Multi-store Test Contract (TEN-09 — ยังไม่ execute)

QA tenants A/B: catalog/brand/mascot/theme/media/orders แยกกัน · Admin A mutate B = ถูกปฏิเสธ · customer A ไม่เห็น B · order history/snapshot คงเดิม · canonical order_id ไม่ชนกัน (prefix tenant หรือ sequence ต่อ tenant — ตัดสินตอน TEN-01)

## 21. Vocabulary

ปัจจุบัน: WHITE-LABEL READINESS = PARTIAL · TENANCY = **MISSING** (contract DOCUMENTED เท่านั้น) · ใช้คำ "MULTI-TENANT READY" ได้ต่อเมื่อ TEN-01..09 ครบ IMPLEMENTED+CONNECTED+DEPLOYED+RUNTIME VERIFIED

## Owner Decisions ยังค้างสำหรับ TEN gates

1. catalog anchor ต่อ tenant หรือต่อ brand (§3) 2. drivers pool ร่วม/แยก 3. order_id format หลาย tenant 4. Stripe model ต่อ tenant 5. subdomain/domain strategy + โดเมนที่ใช้ 6. business_settings scope ตั้งแต่ TEN-04 หรือคง global ก่อน

## 🔴 HARD STOP — OWNER REVIEW

ไม่สร้าง tenants/brands · ไม่เพิ่ม tenant_id · ไม่แตะ RLS/RPC/orders/Admin/PWA · ไม่เริ่ม WL-01..05/CAT-01 — รอ Owner review contract นี้
