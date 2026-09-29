# BMB — TEN-01 AUDIT (PRODUCTION-FIRST, AUDIT ONLY)

**Date:** 2026-09-29 · Baseline HEAD = `ebea32662afbae8dac1952b0e22929082fff170c` (= origin/main, worktree clean)
**Scope:** TEN-01 re-audit จาก production จริง (read-only probes: `e2e/ct-ten01-inventory.cjs`, `e2e/ct-ten01-storage-probe.cjs`) — **ไม่มี schema change, ไม่มี RLS change, ไม่มี backfill, ไม่มี media mutation, ไม่มี fake data**

Source-of-truth priority ถือตาม command: Production DB > Code > Migrations > Docs

## 1. PRODUCTION INVENTORY (ตัวเลขจริง ณ 2026-09-29)

ประมาณ 38 tables ใน public schema ของ prod (`ivkdfognyiwjcmrhcnwz`) — **ยืนยันแล้ว: ไม่มี tenant_id, ไม่มี brands, ไม่มี tenants table อยู่จริง** (ต่างจากที่ docs เคยเกร็ดไว้เป็น "future")

ตารางหลัก + จำนวนแถวจริง:

| table | rows | role | FK | order-derived | catalog-derived | RLS หลัก |
|---|---|---|---|---|---|---|
| orders | 202 | order spine | customer_ref→auth.users, delivery_round_id | – | – | is_admin ALL / own_create (customer_ref=auth.uid()) / own_read / own_update=false |
| order_items | 199 | order content | order_id CASCADE, **product_id RESTRICT** | ✅ | ✅ | ตาม orders |
| order_status_history | 274 | audit spine | orders | ✅ | – | ตาม orders |
| payment_intents | 56 | payment ledger | (ตาม order_number) | ✅ | – | admin/anon(qual=false)/own |
| delivery_rounds | 23 | ops | – | – | – | admin ALL / public_read |
| delivery_assignments | 10 | ops | driver/orders | ✅ | – | admin ALL / driver-scoped / deny_anon |
| drivers | 5 | ops | **user_id (ไม่มี FK → auth.users)** | – | – | admin ALL / scoped read / self_update |
| delivery_zones | 3 | ops | – | – | – | admin / public_read |
| products | 10 | catalog | category_id→categories, delivery_round_id | – | root | is_admin ALL / public read (is_available=true) |
| product_categories | 5 | catalog | menu_section_id | – | root | is_admin / public read (is_active) |
| menu_sections | 0 | catalog | – | – | root | is_admin / public read (is_active) |
| menu_schedule | 0 | catalog ops | – | – | ✅ | is_admin / published anon read |
| media_assets | 9 | media | (url-based) | – | ✅ | is_admin / public read |
| mascot_overrides | 0 | brand/presentation | – | – | – | is_admin / anon read true |
| reviews | 0 (canonical) | review | product_id CASCADE | – | ✅ | admin / own_insert / public read is_verified |
| preorder_votes | 0 | pre-order | product_id CASCADE | – | ✅ | admin ALL / public read (anon INSERT ถูกปิด = migration 058) |
| business_settings | 5 | settings (key/value jsonb) | – | – | – | is_admin ALL / anon ALL **qual=false (safe)** / auth read true |
| profiles | 71 | identity (role='admin' → is_admin) | user_id→auth.users | – | – | admin / own limited |
| customers | 34 | customer identity | user_id→auth.users | – | – | admin / own |
| อื่นๆ | – | inventory(4)/recipes(6)/promotions(1)/ai_*/notifications(338)/audit_logs(1147)/track_order_attempts(31)/pre_orders(1) | ต่างกัน | – | – | ส่วนใหญ่ deny-anon pattern (qual=false) |

**Observations สำคัญ (จาก prod, ไม่ใช่ docs):**
1. **Ownership ปัจจุบัน = single implicit tenant ทั้งระบบ** — ทุกตารางเป็น global, is_admin() = `profiles.role='admin'` ครอบทุก table (FOR ALL policies จำนวนมาก)
2. **anon ALL policies 15 ตัว** — ส่วนใหญ่เป็น "deny pattern" (qual=false) ซึ่งปลอดภัย แต่มีบางตัวเป็น public read จริง (mascot_overrides, media_assets, delivery_rounds, promotions) → ตอน tenant isolation ต้องเช็คทุกตัวว่า tenant B ต้องไม่เห็นของ tenant A
3. `drivers.user_id` ไม่มี FK ไป auth.users — rider identity bind ผ่าน JWT+RLS (assignments_scoped_read) แล้ว
4. `order_number` = `BMB-YYYYMMDD-NNN` **global sequence** (สุ่ม 3 หลัก + วันที่) — TEN-D03 = A จึงเป็น no-op ใน phase แรก
5. business_settings = 5 keys จริง (ดู §6)
6. `mascot_overrides` = brand/presentation layer (0 rows) — Tenant↔Brand model ยังไม่ขัด prod facts
7. **order_items.product_id มี FK RESTRICT → products** — TEN-03 ห้าม hard-delete product ข้าม tenant

## 2. TEN-D01 — CATALOG OWNERSHIP = A (TENANT-OWNED)

Canonical ownership graph (proposal เท่านั้น — ไม่ implement ใน gate นี้):

```text
tenants
 ├── TENANT CATALOG (tenant_id บนทุกตาราง):
 │     menu_sections → product_categories → products
 │     menu_schedule (bound กับ products/categories)
 │     product_addon_groups / addon_groups / addons (ยังไม่พบเป็นตารางหลักใน prod — ตรวจซ้ำใน TEN-02 ก่อน implement)
 │     media_assets (tenant_id + storage layout ใน TEN-03 ขึ้นไป)
 │
 ├── OPERATIONS (per TEN-D02 = shared pool ภายใน tenant):
 │     drivers, delivery_rounds, delivery_zones, delivery_assignments (ผ่าน orders)
 │
 ├── ORDERS SPINE (per TEN-D03 = global order_number):
 │     orders/order_items/order_status_history/payment_intents → tenant_id nullable → backfill → verify → enforce
 │     ⚠️ ห้ามแตะ format/spine (HARD RULE)
 │
 └── BRANDS (TEN-05):
       brands (1:N tenant), tenant.default_brand_id
       mascot_overrides → Brand-owned (0 rows, ย้ายได้ง่าย)
```

**Dependency จริงที่ค้นพบ (ต่างจากเอกสารเดิมเล็กน้อย):** `products.delivery_round_id` FK ผูก catalog เข้ากับ delivery_rounds โดยตรง → TEN-03 (catalog) ต้องไปพร้อม/หลัง TEN-04 (operations) สำหรับ field นี้ → ลำดับปรับ: TEN-02 → TEN-04-lite → TEN-03 (ดู §9)

## 3. TEN-D02 — DRIVER POOL = A (SHARED WITHIN TENANT)

- `drivers` = 5 rows, identity ผ่าน `user_id` + JWT; `assignments_scoped_read` ใช้ `drivers.user_id = auth.uid()` → **Driver authority เป็น user-bound อยู่แล้ว**
- เพิ่ม `drivers.tenant_id` (nullable → backfill → enforce) **ไม่ต้องแก้** JWT claim/assign RPC/state machine — เพียงเพิ่มเงื่อนไข tenant เข้า policy และ RPC checks ภายหลัง
- คำตอบตาม decision: **Driver belongs to Tenant, NOT Brand** ✅
- ต้องระวัง: `upsert_driver` (security definer) และ RPC ที่เกี่ยว driver ต้อง pass tenant context ใน TEN-06

## 4. TEN-D03 — ORDER NUMBER = A (GLOBAL)

- format `BMB-YYYYMMDD-NNN` global แล้ว (ตัวอย่างจริง: `BMB-20260928-293` / `-415` / `-883`); orders.customer_ref→auth.users
- **รองรับ tenancy โดยไม่สร้าง second order system:** เพิ่ม `orders.tenant_id` (nullable→backfill→enforce), order_number/id/state machine/history คงเดิมทุกอย่าง — tenant dimension ใช้ query/RLS เท่านั้น

## 5. TEN-D04 — STRIPE = A (CENTRALIZED)

- prod: `payment_intents` 56 rows; edge functions: `create-checkout`, `stripe-webhook`, `stripe-refund`; payment RPCs — ทั้งหมด order_number-keyed
- **Future extension boundary (documentation only):** payment_intents.metadata มีอยู่แล้ว → เมื่อขยาย per-tenant Stripe ให้เพิ่ม `tenant_id` บน payment_intents + metadata; webhook routing ตาม metadata tenant (ไม่เปลี่ยน central secret phase 1) — **ห้าม** สร้าง per-tenant account ตอนนี้
- ไม่มีการแก้ webhook / payment authority ใน gate นี้ ✅

## 6. TEN-D06 — business_settings SPLIT (inventory ครบ 5 keys)

| key | ค่า (prod จริง) | classify | target owner |
|---|---|---|---|
| `delivery_policy` | {currency:THB, min_order:0, radius_km:10} | TENANT_OPERATIONAL | Tenant |
| `hours` | {open:8:00, close:20:00} | TENANT_OPERATIONAL | Tenant |
| `kitchen_location` | {address, lat, lng} | TENANT_OPERATIONAL | Tenant |
| `operating_hours` | {morning/midday/evening/same_day/pre_order_open = true} | TENANT_OPERATIONAL | Tenant |
| `order_policy` | {preorder_max_days:50, max_items_per_order:50, pre_order_lead_days:1, cancel_window_minutes:5} | TENANT_OPERATIONAL | Tenant |

- **AMBIGUOUS: ไม่มี** · **BRAND_PRESENTATION: ไม่มีอยู่ใน business_settings** (branding อยู่ที่ code/assets + mascot_overrides) → **ไม่ต้องย้ายข้อมูลใด** · PLATFORM_GLOBAL: currency อาจยกเป็น platform default ภายหลัง (ชั่วคราวถือ TENANT_OPERATIONAL)
- ห้ามย้าย/แก้ keys ใน gate นี้ ✅ — TEN-05 จะเพิ่ม brand-owned storage ใหม่ ไม่ rename เดิม

## 7. TEN-D05 — ROUTING (phase 1 = QR/link param `?store=`)

- **ยืนยัน: PWA ปัจจุบันยังไม่มี `?store=` param / brand resolution point ใดๆ ใน code** — single-store routing ธรรมดา
- Future resolution point (proposal): entry (`src/main.tsx`/`App.tsx`) — parse `?store=` → resolve tenant + default brand → theme/mascot/context → fallback = default BMB tenant (backward-compatible)
- Cloudflare Pages: static SPA — phase 1 ทำฝั่ง client ทั้งหมด (ไม่ต้องแตะ infra)
- ไม่ implement ใน gate นี้ ✅

## 8. BRAND MODEL AUDIT

- Model (tenants 1:N brands + tenant.default_brand_id) **ไม่ขัด prod facts**
- Ownership proposal: mascot_overrides / theme / logo / favicon / OG / mascot = **Brand-owned**; brand media = rows ใน media_assets (เพิ่ม brand_id nullable); product images = **Tenant-owned** (TEN-D01); default fallback assets = **Platform-global**

## 9. STAGED MIGRATION PLAN (PROPOSAL ONLY — ห้าม execute)

ลำดับที่แก้ตาม evidence (`products.delivery_round_id` dependency):

```text
TEN-02  Core entities: tenants, brands (nullable-only, no backfill yet)
TEN-04-lite  tenant_id (nullable) บน ops: drivers, delivery_rounds, delivery_zones → backfill=1 tenant → verify → enforce
TEN-03  tenant_id บน catalog: menu_sections, product_categories, products, menu_schedule, (addons ถ้ามี) → backfill → verify → enforce (คู่กับ media_assets + storage layout)
TEN-05  Brand linkage: tenant.default_brand_id, mascot/theme ownership (ย้ายเชิงตรรกะ, ไม่ลบ)
TEN-06  RLS isolation rewrite (§10)
TEN-07  Runtime routing phase 1 (?store=)
TEN-08  Migration/backfill ข้อมูลจริง + Stripe/edge metadata ขยาย
TEN-09  Isolation E2E
```

ทุก migration: `nullable → backfill → verify → enforce` — **ห้าม ADD NOT NULL ทันที, ห้าม destructive** · Catalog visibility gate triggers (migration 055) ต้องรู้จัก tenant เมื่อ enforce

## 10. RLS ISOLATION CONTRACT (PROPOSAL ONLY)

```text
platform_admin  (profiles.role='admin' + platform flag) → cross-tenant
tenant_admin    (profiles.role='tenant_admin', profiles.tenant_id=T) → own tenant only
customer        → public/customer-safe data ของ tenant ที่ resolve จาก routing
driver          → own tenant (drivers.tenant_id=T) + own assignment scope (user_id=auth.uid() เดิม)
service_role    → trusted backend only (bypass RLS เทียบเท่าปัจจุบัน)
```

- FOR ALL policies ที่ใช้ is_admin() (~30+) จะกลายเป็น tenant-aware ใน TEN-06 ทั้งชุด — ความเสี่ยง: policy ครอบทุก table → ต้องมี RLS test matrix ใน TEN-09
- ตรวจ "anon ALL (15 policies)" ทุกตัวตอน enforce — deny-patterns (qual=false) ปล่อยเดิมได้
- Pattern เดิมใช้ได้: is_admin() = security definer อ่าน profiles.role → ขยายเป็น is_tenant_admin(t)

## สถานะ

IMPLEMENTED: — (audit-only) · CONNECTED: probe scripts อ่าน prod จริง · DEPLOYED: — · RUNTIME VERIFIED: inventory อ่านจาก prod ณ 2026-09-29 (read-only) · DOCUMENTED: รายงานนี้ + BMB_STORAGE_PLATFORM_BLOCKER.md · MISSING: Owner approval ของ ownership matrix + staged plan + RLS contract ก่อน TEN-02 · BLOCKED: Catalog Runtime Verify (ตาม storage platform blocker) · DEFERRED: TEN-02..TEN-09 ทั้งหมด, RE-D4, CAT-03B, CAT-04, Open-Shop


