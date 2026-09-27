# BMB_02_PRODUCTION_DATABASE_REALITY.md
**Phase 2 — Database & Production Reality Audit (READ-ONLY)**
**Audit date:** 2026-09-27 · **Method:** 37 SELECT probe queries ผ่าน Supabase Management API + Edge Function listing (ไม่มี write ใด ๆ)
**Raw evidence:** `e2e/prod-phase2-audit.json` · probe script: `e2e/prodAuditPhase2.cjs`

## 1. Production Identity

```
Project ref:        ivkdfognyiwjcmrhcnwz
Project name:       bitemebaby2016-coder's Project
Org:                tyoaemkqwhkmdubbvjrm
PostgreSQL:         17.6.1.166 (supabase/.temp/postgres-version)
Region pooler:      aws-0-ap-northeast-2 (supabase/.temp/pooler-url)
Linked project:     supabase/.temp/linked-project.json
Frontend:           Cloudflare Pages (bitemebaby-5f7.pages.dev)
Probe access:       SUPABASE_ACCESS_TOKEN จาก process env (ไม่เปิดเผยค่า)
```

## 2. Production Migration State (จาก supabase_migrations.schema_migrations จริง)

Production บันทึก **39/39 migrations (001–039)** ครบทุกตัวใน repo — รวม 035–039 ที่ README ยังไม่รู้จัก

| Migration | Local | Production | Match |
|---|---|---|---|
| 001–039 ทั้งหมด | ✅ | ✅ (recorded เต็มลำดับ) | ✅ |

รายชื่อทั้ง 39 = `e2e/prod-phase2-audit.json → data.migration_history` (001 initial_schema ... 039 weekly_menu_and_mode_controls)

**DRIFT ที่พบ:** migration chain ครบ แต่ **Edge Functions deploy จริง 4/14** (ดู BMB_02_EDGE_FUNCTION_PRODUCTION_AUDIT.md) และพบ production objects ที่ต้องเทียบ body-level กับ migration (menu_schedule + publish_menu_schedule/set_menu_schedule/get_menu_for_date/quote_pre_order/validate_pre_order_delivery — น่าจะมาจาก 039)

## 3. Production Schema Inventory (จริง)

**Tables (public):** ai_conversations, ai_customer_memory, ai_recommendations, audit_logs, business_settings, content_approvals, customers, delivery_assignments, delivery_rounds, delivery_zones, drivers, inventory, inventory_transactions, loyalty_points, media_assets, mascot_overrides, menu_schedule, notification_prefs, notifications, order_items, orders, payment_intents, pre_orders, preorder_votes, product_categories, production_batch_items, production_batches, products, profiles, promotions, provider_orders, public_profiles, recipes, reviews, system_errors

**Enums จริง (business-critical):**
- `order_mode = SAME_DAY, PRE_ORDER` (enum จริง)
- `order_status = pending, confirmed, preparing, ready_for_dispatch, dispatched, in_transit, arrived, delivered, cancelled, failed`
- `payment_status = pending, paid, refund, partially_refunded`
- `payment_method = promptpay_qr, credit_card, cash_on_delivery`
- `delivery_method = self_delivery, grab_rider, linemen_rider, foodpanda_rider`
- `round_period = morning, midday, evening`

**Functions:** 103 (public) — ส่วนใหญ่ SECURITY DEFINER (`create_order_with_items` def_len=13,523 · `record_payment_result` 3,221 · `confirm_offline_payment` 2,464 · `transition_order_status` 2,030 · `ensure_rounds_for_date` 2,624)

**RLS:** เปิดทุก table (probe rls ไม่มีแถว rls_on=false) · policies + grants รายละเอียดใน BMB_02_RLS_PRODUCTION_AUDIT.md

**Data volume จริง:** orders=17 · order_items=14 · products=9 · delivery_rounds=15 · payment_intents=13 · profiles=5 · pre_orders=1 · promotions=1 · inventory=4 · recipes=6 · audit_logs=31 · **drivers=0 · delivery_assignments=0 · reviews=0 · content_approvals=0**

**ข้อสังเกตข้อมูล:** ออเดอร์จริงล่าสุด = 2026-09-19 · delivery_rounds ล่าสุด = 2026-09-25 (ไม่มี round 2026-09-26/27 ณ audit date — อธิบายได้: rounds instantiate on-demand โดย `ensure_rounds_for_date(p_date)` ที่ client เรียกผ่าน listRoundsForDate (bmbAdminApi_rounds.ts:76) — live behavior ยืนยันใน Phase 3)

## 4. Order Spine (production reality)

```
orders(id text PK, order_number text, customer_ref uuid→profiles, customer_id text,
       delivery_round_id→delivery_rounds, order_mode order_mode NOT NULL default SAME_DAY,
       scheduled_date date NULL, status order_status default pending,
       payment_status payment_status default pending, payment_method payment_method,
       delivery_method delivery_method default self_delivery,
       dropoff lat/lng, is_outside_self_zone boolean,
       subtotal/delivery_fee/service_fee/discount_amount/tax_amount/total_amount numeric)
order_items(id, order_id→orders.id, product_id→products, quantity, unit_price,
       customizations jsonb, item_total)
payment_intents(order_number, amount, method, status, provider, stripe fields...)
```

- Order→Items→Product→Round→Payment ยืนยันด้วย constraints + **orphan_items = 0**
- orders_with_round = 14/17 (3 ที่ไม่มี round = test artifacts 2026-09-19: BMB-WHVER-20260919105254, BMB-LIVE-20260919074017, BMB-LIVE-20260919073600)

## 5. Data Integrity (aggregate)

| ตรวจ | ผล | ตัดสิน |
|---|---|---|
| orphan order_items | 0 | ✅ |
| PAID ที่ไม่มี payment_intents completed | **2** (test artifacts 2026-09-19) | ⚠️ อธิบายได้ ไม่ใช่ลูกค้าจริง |
| payment state ผสม | paid 8 · refund 1 (มี PI 'refunded' จริง — refund flow ทำงานจริง 1 ครั้ง) | ✅ |
| invalid order_mode | 16 SAME_DAY, 1 PRE_ORDER — อยู่ใน enum | ✅ |
| drivers / delivery_assignments | 0 / 0 | ⚠️ dispatch ไม่เคยใช้จริง |
| duplicate order_number | ไม่พบ (PK/unique) | ✅ |

## 6. Preorder / Same-day Production Enforcement (จาก function defs)

- `create_order_with_items` (13,523 chars) **refs cutoff=true, refs max_capacity=true** → cutoff/capacity/price/mode อยู่ใน RPC จริง
- `enforce_pre_order_window` (refs cutoff) · `enforce_pre_order_cancel_window` · `enforce_menu_gate` · `enforce_operating_hours` (triggers ต่อ orders/pre_orders)
- `ensure_rounds_for_date` (refs cutoff + capacity) — round-YYYYMMDD-<key> instantiate per date
- `validate_pre_order_delivery`, `quote_pre_order`, `create_pre_order_with_items`, `cancel_pre_order`

**Round/cutoff/capacity = DB เท่านั้น ไม่ hardcode** (delivery_rounds จริง: morning cutoff 05:00 cap 60 · evening cutoff 16:00 cap 100 ฯลฯ)

**Enforcement matrix (production-verified ที่ระดับ function body/trigger):**

| Rule | Frontend | RPC | EF | DB Constraint/Trigger | Actual Authority |
|---|---|---|---|---|---|
| ราคา/subtotal/total | DISPLAY ONLY | create_order_with_items | — | — | **RPC** |
| promotion discount | DISPLAY ONLY | create_order_with_items | — | — | **RPC** |
| delivery fee | compute_delivery_fee_rpc (display) | create_order_with_items re-derive | — | — | **RPC** |
| product availability | getProducts filter | create_order_with_items | — | — | **RPC** |
| round closed/not found | client gate | create_order_with_items | — | — | **RPC** |
| capacity | client gate | create_order_with_items | — | — | **RPC** |
| SAME_DAY cutoff | client (ICT assumption) | create_order_with_items + enforce_operating_hours | — | trigger | **RPC/DB** |
| PRE_ORDER lead window | client | enforce_pre_order_window | — | trigger | **RPC/DB** |
| order status transition | display | transition_order_status | — | order_transition_allowed trigger | **DB** |
| mark paid (card) | — | — | stripe-webhook | record_payment_result | **EF+RPC** |
| mark paid (offline) | — | confirm_offline_payment | — | is_admin() guard | **RPC** |
| insert ownership | — | create_order_with_items | — | orders_own_create check(customer_ref=auth.uid()) | **DB** |

**SAME_DAY หลัง cutoff: production backend ปฏิเสธเองได้ — live runtime test = NOT VERIFIED (Phase 3)**

## 7. Payment Production State

- `record_payment_result` มีจริง (def 3,221 chars, idempotency ตาม 010) · `confirm_offline_payment` มีจริง (2,464 chars)
- payment_intents จริง: completed credit_card=5 · refunded credit_card=1 · pending promptpay=4 · processing promptpay=1 · pending credit_card=2 → **Stripe webhook path เคยทำงานจริง + refund จริง 1 ครั้ง**
- EF deployed: create-checkout (v33, verify_jwt=true), stripe-webhook (v41, verify_jwt=false — ถูกต้องสำหรับ webhook), stripe-refund (v3)

## 8. Delivery Production State

- DB: enum delivery_method 4 ทาง · `is_outside_self_zone` · delivery_zones (0-5/5-10/10-20 km) · drivers/delivery_assignments/provider_orders tables · driver RPC เต็มชุด
- **DATABASE + BACKEND รองรับ ≤5 km vs >5 km จริง**
- FRONTEND: CheckoutPage hardcode `self_delivery` (CheckoutPage.tsx:99,201) → customer เลือกไม่ได้
- **RUNTIME: drivers=0 · delivery_assignments=0 → ไม่เคยใช้จริงใน production**

## 9. Rider Authorization (production risk)

- Backend RPC identity = **p_driver_phone / p_driver_id (client-supplied)** — `driver_login(p_phone,p_name)` ตรวจกับ drivers table แต่ **ไม่พบการผูก JWT กับ driver identity**
- EXECUTE grants ราย function = ต้องยืนยันต่อใน BMB_02_RPC_PRODUCTION_AUDIT.md → จัด **SECURITY FINDING รอยืนยัน grant** (ถ้า authenticated เรียก driver_accept_assignment ได้ด้วยเบอร์ใด ๆ = serious)

## 10. Business Settings → Runtime (production จริง)

| key | value จริง | consumer ที่พิสูจน์แล้ว |
|---|---|---|
| order_policy | pre_order_lead_days=1, preorder_max_days=40, max_items_per_order=20, cancel_window_minutes=5 | CheckoutPage + enforce_pre_order_cancel_window |
| operating_hours | morning/midday/evening/same_day/pre_order_open = true | enforce_operating_hours (trigger) |
| delivery_policy | radius_km=10, min_order=0 | ต้อง trace ต่อ (Phase 6/8) |
| kitchen_location | lat 10.7016, lng 102.1429 | deliveryFeeApi origin |
| hours | open 10:00 close 22:00 | UNKNOWN consumer |

## 11. Menu Source Contradiction — PRODUCTION CONFIRMED

- DB products = 9 รายการ พร้อม `available_same_day`/`available_preorder` จริง (prod-6 = is_preorder=true)
- `menu_schedule` + `publish_menu_schedule`/`set_menu_schedule`/`get_menu_for_date` มีจริง (039)
- **HomePage DrinksSection/SnacksSection ยัง import static lib (DrinksSection.tsx:10, SnacksSection.tsx:10)** → ADMIN→DB ✓ · CUSTOMER(home)→HARDCODED LIB ✗

## 12. Production vs Code Matrix (หัวใจ Phase 2)

| Capability | Code | Migration | Prod DB | RPC/EF | Runtime | Status |
|---|---|---|---|---|---|---|
| Order create server-authoritative | ✓ | 007/025 | ✓ | ✓ | ✓ (17 orders จริง) | READY |
| Order status transition | ✓ | 008/030 | ✓ | ✓ | ✓ (audit_logs=31) | READY |
| Payment card | ✓ | 008/010 | ✓ | ✓ | ✓ (PI completed 5 · refunded 1) | READY |
| Payment PromptPay/COD | ✓ | 008/013 | ✓ | ✓ | PARTIAL (ไม่มี promptpay paid จริง) | PARTIAL |
| Refund | ✓ | — | ✓ | ✓ | ✓ (1 ครั้ง) | READY |
| Preorder | ✓ | 017/024/038 | ✓ | ✓ | PARTIAL (1 order จริง) | PARTIAL |
| Same-day | ✓ | 017/024/038 | ✓ | ✓ | ✓ | READY |
| Rounds/cutoff/capacity | ✓ | 024/029 | ✓ | ✓ | ✓ (15 rounds) | READY |
| Delivery fee zones | ✓ | 020 | ✓ | ✓ | ✓ | READY |
| Bite Drive / external rider | ✓ | 020/036 | ✓ | ✓ | ✗ (drivers=0) | PARTIAL/DORMANT |
| Weekly menu schedule | ✓ | 039 | ✓ | ✓ | UNKNOWN consumer | PARTIAL/UNKNOWN |
| Kitchen batch | ✓ | 019/027 | ✓ | ✓ | UNKNOWN | UNKNOWN |
| Loyalty | ✓ | — | ✓ | ✓ | UNKNOWN | UNKNOWN |
| Inventory deduct | ✓ | 026 | ✓ | ✓ | PARTIAL | PARTIAL |
| Reviews | ✓ | — | ✓ (0 rows) | — | ✗ | PARTIAL |
| Edge Functions ที่เหลือ 10 ตัว | ✓ | — | — | ✗ ไม่ deploy | ✗ | DORMANT |

## 13. Production Contradictions (สรุป)

```
PROD-CONTRA-1: README ว่า 34/34 migrations → จริง 39/39 (README stale)
PROD-CONTRA-2: 14 EF ใน repo → deploy จริง 4 (10 DORMANT-in-code)
PROD-CONTRA-3: เอกสารว่า ".env purged secrets 2026-09-18" → .env จริง ณ audit date ยังมี
               VITE_SUPABASE_SERVICE_ROLE_KEY / VITE_STRIPE_SECRET_KEY / VITE_STRIPE_WEBHOOK_SECRET
               (src ไม่อ่านชื่อเหล่านี้แล้ว → ไม่ leak ลง bundle ณ ปัจจุบัน แต่ = CONFIGURATION RISK ซ้ำ)
PROD-CONTRA-4: delivery DB/BACKEND รองรับ external rider ครบ → FRONTEND hardcode self_delivery
PROD-CONTRA-5: admin แก้ products DB → HomePage drinks/snacks อ่าน static lib
```

## 14. NOT VERIFIED (Phase 2)

- Runtime behavior จริงของ cutoff/capacity บน live backend (Phase 3)
- body-level diff ของ 103 functions กับ migration files (ทำ keyword-level เท่านั้น)
- EXECUTE grants ราย function ละเอียด (ดู BMB_02_RPC_PRODUCTION_AUDIT.md)
- cron/scheduled jobs ฝั่ง Supabase
- payment_status enum ใช้ชื่อ 'refund' (ไม่ใช่ 'refunded') — INFO