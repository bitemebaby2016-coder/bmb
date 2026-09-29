# BMB — TENANCY OWNER DECISION CONTRACT (TEN-D01..D06)

**ฐาน:** `df2de9f` (WL-TENANCY-00 closed) · **docs-only — ไม่มี schema/RLS/RPC/Admin/PWA/Stripe/delivery change** · อ้าง: `BMB_WHITE_LABEL_TENANCY_ARCHITECTURE.md` + 37-table data matrix + CATALOG AUDIT
**สถานะ: READY FOR OWNER DECISION / NOT READY FOR IMPLEMENTATION**

---

## DECISION TABLE

| Decision | Topic | Current Production Reality | Options | Owner Decision |
|---|---|---|---|---|
| TEN-D01 | Catalog Ownership | ไม่มี tenant/brand id; catalog = product_categories→products | A=Tenant / B=Brand | **PENDING** |
| TEN-D02 | Driver Pool | drivers pool เดียว; assign_driver global | A=Shared ใน tenant / B=ต่อ brand | **PENDING** |
| TEN-D03 | Order ID/Number | order_number TEXT UNIQUE + order_id TEXT canonical; FK: order_items, osh, delivery_assignments, provider_orders; payment ผูก order_number | A=global คงเดิม / B=tenant-prefix | **PENDING** |
| TEN-D04 | Stripe Model | account เดียว, webhook เดียว, refund EF admin-only + Idempotency-Key, ledger metadata | A=Centralized / B=per tenant / C=per brand | **PENDING** |
| TEN-D05 | Customer Routing | ไม่มี resolver (โดเมนเดียว) | subdomain→custom→QR/link→fallback | **PENDING** |
| TEN-D06 | business_settings | global 5 keys (hours, operating_hours, delivery_policy, order_policy, kitchen_location) | A=Tenant / B=Brand / C=split | **PENDING** |

---

## TEN-D01 — CATALOG OWNERSHIP

### Option A: Tenant-owned
- Menu/Section (CAT-D01=B): ผูก tenant · Category/Product: tenant_id ที่ product_categories (anchor), products สืบทอด FK · Add-ons: สืบทอดผ่าน product · Promotions/Menu Schedule/Rounds/Zones: tenant scope ตรงไปตรงมา
- PWA: resolver→tenant→catalog ของ tenant; fallback BMB · Admin ต่อ tenant (RLS)
- RLS: policy ใหม่เฉพาะตาราง anchor + derived subquery ที่เหลือ — risk ต่ำสุด
- Multi-brand future: brand หลายตัวใน tenant **แชร์ catalog เดียว** — เหมาะ cloud kitchen เมนูร่วม; brand ต่างเมนูสมบูรณ์ = ต้อง tenant ใหม่

### Option B: Brand-owned
- anchor = brands (product_categories.brand_id) — แต่ละ brand เมนูต่างกันสมบูรณ์ในครัวเดียว
- ผล: ตอบ "แบรนด์ต่างเมนู" ตรง · แต่ menu_schedule/promotions/rounds/inventory/production ต้องตัดสิน scope ต่อ brand หรือ tenant ผสม · Admin เลือก brand ปัจจุบันตลอด · RLS ผูก profile→brands
- ผลต่อ CAT-01..05: complexity สูงขึ้นทันทีแม้ยัง single-store

**คำถามเสริม (ถ้า B):** promotions/rounds/inventory scope ต่อ brand หรือ tenant?

## TEN-D02 — DRIVER POOL

**จริงปัจจุบัน:** `drivers` pool เดียว · `assign_driver` + driver JWT (p_driver_phone contract 041) · delivery_assignments ผูก order · Bite Drive (020)

### Option A: Shared pool across brands within tenant
- ไรเดอร์หนึ่งคนส่งทุก brand ใน tenant — เหมาะ cloud kitchen กลุ่มเดียว · drivers ต้องการ tenant_id (หรือคง global ช่วงแรก) · dispatch ไม่กรอง brand · Bite Drive/external: scope ต่อ tenant · Risk: ต่ำ (ไม่แตะ JWT contract)

### Option B: Separate pool per brand
- drivers.brand_id + dispatch กรองต่อ brand + scoped read/JWT เพิ่มเงื่อนไข · ไรเดอร์ลงทะเบียนซ้ำต่อ brand · Risk: กลาง — แตะ driver RPC contract + งาน 3B-2D เดิม

**คำถามเสริม (ถ้า A):** drivers คง global ตอน phase แรก (single tenant) ได้ไหม?

## TEN-D03 — ORDER ID / ORDER NUMBER CONTRACT

**จริงปัจจุบัน:** `orders.id` (order_id) TEXT PK canonical + `order_number` TEXT UNIQUE · FK: order_items.order_id, order_status_history/delivery_assignments/provider_orders.order_number · payment_intents ผูก order_number · Stripe metadata/refund idempotency · external_ref_id/channel-webhook (048) ผูก order_number

- **order_id (canonical PK): คง format เดิม global unique** — single order spine ไม่แตก
- **order_number:** transition = คง global unique เดิม; อนาคต (B): `<tenant-prefix>-<seq>` + UNIQUE(tenant_id, order_number) แต่ **ต้องรักษา global-unique ด้วย** (webhook/FK ผูก order_number ทุกที่)
- **ห้าม migrate เลขเดิม** — contract ระดับ format เท่านั้น (implement ใน TEN-07)
- **เลือก:** (A) คง global unique ตลอด (แนะนำเริ่ม) / (B) tenant-prefix + scoped unique เมื่อมี tenant หลายเจ้า

## TEN-D04 — STRIPE MODEL

**จริงปัจจุบัน:** account เดียว · webhook เดียว · refund EF (admin-only, Idempotency-Key, ledger metadata.refunded_total_minor) · payment events E2E frozen

- **A: Centralized** — webhook/idempotency/refund/reconciliation เดิมทำงานต่อ; เงินทุก tenant รวมบัญชีเดียว (แยกสมุดราย tenant นอก platform) — เหมาะ phase เริ่ม (tenant เป็นของ Owner เอง)
- **B: per tenant** — Connect/แยกบัญชี; webhook route ต่อ account, secrets/audit/reconciliation แยก — เปลี่ยน payment spine = gate ใหญ่แยก, BLOCKED จนมี multi-store จริง
- **C: per brand** — หนักสุด; เมื่อ brand = legal entity ต่างกัน

**แนะนำลำดับ:** A ก่อน → B เมื่อ tenant ต่างเจ้าของ → C เมื่อ legal แยก

## TEN-D05 — CUSTOMER ROUTING

**จริงปัจจุบัน:** โดเมนเดียว (bitemebaby.com), ไม่มี resolver (DOCUMENTED เท่านั้น)

เสนอ canonical priority: **1) subdomain 2) custom domain (ตาราง mapping) 3) QR/store link param (?t=) 4) fallback = default tenant (BMB)**
- ผล: resolver รันก่อน render → brand/theme/catalog ตาม tenant ที่ resolve · manifest/icon = build-time (DOCUMENTED แล้ว)
- **ยืนยันจาก Owner:** priority นี้ canonical หรือไม่? + โดเมนหลักที่ใช้ + เริ่ม support level ไหนก่อน (แนะนำ: link param ก่อน — ไม่แตะ DNS; subdomain ต่อ)

## TEN-D06 — BUSINESS_SETTINGS SCOPE

**จริงปัจจุบัน:** global 5 keys: hours · operating_hours (mode gates) · delivery_policy (radius/currency) · order_policy (cutoff/preorder) · kitchen_location

- **A: Tenant ทั้งตาราง** — ง่าย, settings เป็นของร้านโดยตรง
- **B: Brand ทั้งตาราง** — ไม่เหมาะ: operating_hours/delivery เป็นของครัวไม่ใช่ brand
- **C (แนะนำ): split ownership** — operational (hours/operating_hours/delivery_policy/order_policy/kitchen_location) = **Tenant** · branding/identity/contact-display = **Brand** (อยู่ใน brands ตาม Q2 — ไม่ duplicate)

**กติกา:** หนึ่ง field หนึ่ง authority — ห้ามเขียน brand data ลง business_settings/env/static JSON ซ้ำ (Q2)

---

## CROSS-CONTRACT DEPENDENCY ANALYSIS

| Decision | ตาราง/ระบบที่กระทบ (จาก 37-table matrix) |
|---|---|
| TEN-D01 | products, product_categories, menu_schedule, promotions, delivery_rounds, delivery_zones, inventory, recipes, production_batches(+items), media_assets, mascot_overrides, business_settings, orders (catalog ref), order_items (product FK), ai_recommendations, preorder_votes, reviews, pre_orders — ถ้า B เพิ่ม brands เป็น anchor ของหลายรายการนี้ |
| TEN-D02 | drivers, delivery_assignments, orders (ownership ของการส่ง), driver JWT/RLS scoped read, Bite Drive (020), provider_orders (frozen providers อนาคต) |
| TEN-D03 | orders, order_items, order_status_history, delivery_assignments, payment_intents, provider_orders, track_order_attempts, channel-webhook (048), Stripe metadata, audit_logs payload |
| TEN-D04 | payment_intents, webhook secrets, refund EF, audit, reconciliation, provider frozen E2E |
| TEN-D05 | PWA bootstrap/resolver, brands, tenants, media/brand read path, manifest (build-time), Admin routing |
| TEN-D06 | business_settings, tenants, brands, mode gates (039), automation jobs (ต้องรู้ scope), delivery fee logic |

**ผลเชื่อมโยงสำคัญ:** TEN-D01 (A/B) เปลี่ยน scope ของอีกหลาย decision สืบเนื่อง (menu_schedule, promotions, rounds) — ควรตัดสิน TEN-D01 **ก่อนตัวอื่น**

## ARCHITECTURE RULES (ยืนยัน)

1. BMB ยังคงเป็น Cloud Kitchen (platform ที่เตรียมรับหลายร้าน)
2. ไม่มี Make.com / external automation
3. PostgreSQL = Order Hub / Source of Truth เดียว
4. AI ไม่มี transaction authority (price/payment/stock/capacity/fee/cancel/refund/order-state)
5. SAME_DAY + PRE_ORDER ใช้ canonical order spine เดียว
6. Order snapshot ห้ามถูกทำลายเพื่อ tenancy
7. Existing order state machine (008/030 + guard) คงเดิม
8. Existing payment authority คงเดิม (server-side, EF เดิม)
9. Existing dispatch authority คงเดิม (assign_driver + transition RPCs)
10. Tenancy = phased migration (TEN-01..09)
11. ห้าม blind-add tenant_id ทุกตาราง (derive ผ่าน FK ตาม contract)
12. ทุก migration: nullable → backfill → verify → enforce
13. Rollback ห้ามลบข้อมูล
14. Gate นี้ = zero production mutation (docs-only)

## CATALOG CONTRACT (สำหรับ CAT-01..06 ถัดไป — ยังไม่ implement)

```
Menu → Section → Category → Product → Add-on  (CAT-D01=B: Section = real entity, server-enforced)
```
- canonical DB source เท่านั้น — ไม่มี static/mock/duplicate frontend catalog (CAT-WL-00 ปิดแล้ว ต้องคงอยู่)
- Admin → DB → PWA พิสูจน์ต่อ gate
- Archive semantics (CAT-D04=B): แยก active / available / visible / archived — ไม่สลับความหมาย
- Server enforcement: หมวด/section ปิด → server ปฏิเสธ order จริง ไม่ใช่ซ่อน UI
- Existing order references: **order_items.product_id มี FK → products (errata)** — archive ต้องไม่ทำลาย FK, snapshot คงอยู่
- **order item snapshot preservation** = กฎเหล็กทุก migration

## WHITE-LABEL CONTRACT (สำหรับ WL-01..05 — ยังไม่ implement)

- **Brand = canonical entity** (brands, Q2=B) — ห้าม duplicate config ใน business_settings/frontend/env/static
- **Theme = controlled design tokens** จาก brand config (Q3=A) + validation/fallback
- **Mascot = mascot_overrides เดิม extend** (Q6=A) — ห้าม second mascot system
- **Media = media_assets + bmb-images** (CAT-D03=B; migrate แยก gate)
- **PWA title/OG = runtime ที่ technical รองรับ** (Q5=A); manifest/icon = build-time ชั่วคราว **แต่ต้อง DOCUMENTED ชัด** (WL-05)
- RLS ทุกตัว: public read / admin write — ห้าม public write, ห้าม service_role ใน browser

## HARD STOP

**READY FOR OWNER DECISION · NOT READY FOR IMPLEMENTATION** — ห้ามเริ่ม TEN-01 / WL-01 / CAT-01 · ห้ามสร้าง tenants/brands · ห้ามเพิ่ม tenant_id · ห้ามแก้ RLS/RPC/Admin/PWA — รอ Owner เลือก TEN-D01..D06 ก่อน