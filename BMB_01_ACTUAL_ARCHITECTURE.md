# BMB_01_ACTUAL_ARCHITECTURE.md
**Phase 1 — Actual Architecture Reconstruction (STRICT EXECUTION)**
**Audit date:** 2026-09-27 · **Basis:** source code + execution paths เท่านั้น (ไม่ใช้ README เป็น truth)
**ทุกข้ออ้างมี evidence file:line — สิ่งที่ยืนยันไม่ได้ระบุ UNKNOWN / NOT VERIFIED**

---

## 1. Executive Summary

BMB จริง ๆ คือ **Supabase-centric PWA** ที่ order transaction เป็น server-authoritative ผ่าน PostgreSQL RPC (`create_order_with_items`, `transition_order_status`, `record_payment_result` ฯลฯ) โดย frontend ถูกบังคับให้เป็น display-only ด้านราคา/ค่าส่ง

แต่ topology จริง **ไม่เรียบร้อย**: มี 2 ระบบ store (cart ×2, state machine client-side) ทำงานขนาน, มี menu 2 แหล่ง (DB products + static lib), มี client-side order state machine ที่ "จำลอง" lifecycle แยกจาก DB, worktree เก่า 2 ต้นปนใน build/test, และ **ไม่พบ Make.com หรือ external channel integration ใด ๆ ใน code** (automation = client-side notification event เท่านั้น)

Authority หลักยืนยันได้: order create/status/payment/price/fee = **DB RPC + trigger + RLS** · Payment PAID ทางการเดียวคือ Stripe webhook → `record_payment_result` หรือ admin → `confirm_offline_payment` (COD/PromptPay) — ไม่พบ client path ที่ mark paid ได้ตรง ๆ จาก code ที่ scan

## 2. Actual System Topology (verified)

```mermaid
flowchart LR
  subgraph Clients
    C[Customer PWA]
    A[Admin PWA - 17 pages]
    R[Rider PWA]
  end
  subgraph Supabase["Supabase ivkdfognyiwjcmrhcnwz"]
    AUTH[Supabase Auth]
    DB[(PostgreSQL - 39 migrations)]
    RPC[RPC functions]
    EF[Edge Functions x14]
    ST[Storage bmb-images]
  end
  S[Stripe API]
  O[OpenRouter AI API]

  C -->|anon client supabase.ts| AUTH
  C -->|REST .from() + .rpc()| DB
  C -->|functions.invoke| EF
  A -->|REST CRUD + RPC| DB
  A -->|functions.invoke| EF
  R -->|REST via driverService| DB
  EF -->|service_role| DB
  EF -->|REST| S
  EF -->|REST| O
  DB -.trigger guard.- RPC
```

หมายเหตุ: ไม่พบ Make.com, Facebook/Messenger/LINE webhook receiver หรือ channel integration ใน code จริง (§16)

## 3. Frontend Architecture

- Entry: `src/main.tsx` → `src/App.tsx` (routes + lazy loading) · `src/counter.ts` / `src/main.ts` = Vite scaffold dead code
- State: Zustand — **สองโฟลเดอร์ขนาน `src/store/` + `src/stores/` ทั้งคู่ ACTIVE**:
  - `@/store/cartStore` → CheckoutPage.tsx:14, FloatingCart.tsx:7, Header.tsx:2, MenuPage
  - `@/stores/useCartStore` → BiteMascot.tsx:17, CartIsolationModal.tsx:10
  - → **cart มี 2 implementation จริง — cart ที่ customer จ่ายเงินผ่าน = `store/cartStore`**; `stores/useCartStore` = isolation-preview concept ที่ยังถูก render ผ่าน CartIsolationModal/BiteMascot
- Config: `src/config/platformConfig.ts` (DEFAULT_PLATFORM_CONFIG + usePlatformConfigStore) — client-side config store
- SEO: `SeoHelmet.tsx` + `seo.ts` (react-helmet-async)

## 4. Customer PWA Architecture (order journey จริง)

```
HomePage (BiteHero, DrinksSection/SnacksSection ← STATIC lib data)
  → MenuPage (getProducts ← bmbAdminApi_products ← DB products — DB-backed จริง)
  → OrderBuilderModal / FoodMenuCard → store/cartStore (mode-locked)
  → CartPage → CheckoutPage
      - auth gate: ไม่ login → /login (CheckoutPage.tsx:73-78)
      - rounds: listRoundsForDate ← DB delivery_rounds (id = round-YYYYMMDD-<key>)
      - fee: fetchServerDeliveryFee → RPC compute_delivery_fee_rpc (fallback local-mirror)
      - policy: getBusinessSettings.order_policy.pre_order_lead_days (DISPLAY ONLY)
      - client gate SAME_DAY: cutoff_time + capacity (CheckoutPage.tsx:161-184, ICT assumption)
      - client gate PRE_ORDER: scheduledDate >= today+leadDays (CheckoutPage.tsx:186-189)
  → handlePlaceOrder → RPC create_order_with_items
      (payload ไม่มีราคา/ค่าส่ง — server derive ทั้งหมด; order_mode + scheduled_date เฉพาะ PRE_ORDER)
  → createPaymentIntent (promptpay/cod → RPC create_payment_intent_record;
      credit_card → EF create-checkout → Stripe PI server-side)
  → writeAuditLog → notificationStore trigger (client-side only)
  → PaymentConfirmationPage (submit TXN → RPC submit_offline_payment_reference → 'processing')
  → OrderTrackPage / OrdersPage (getOrders/getOrder)
```

Classification: CheckoutPage = UI + client pre-gates (redundant guard — RPC enforce อีกชั้น) · MenuPage = READ MODEL (DB) · DrinksSection/SnacksSection = **UI เป็น DATA OWNER เอง (STATIC lib)** ← contradiction (§24)

## 5. Admin Architecture

- Route guard: `AdminRoute` ตรวจ `fetchProfileRole()` จาก DB profiles (App.tsx:86-107) — ไม่ใช่ localStorage flag (คำกล่าวเก่า D16 = CONTRADICTED โดย code ปัจจุบัน)
- 17 admin pages → `bmbAdminApi_*` (12 modules)
- Write path สองแบบ:
  - **Orders:** status ผ่าน RPC `transition_order_status` + DB trigger (bmbAdminApi_orders.ts:178-190) · offline payment → `confirm_offline_payment` (admin-only, rule-gated) · `mark_payment_failed` (:214-230)
  - **Products/Inventory/Media/Customers ฯลฯ:** direct table CRUD ผ่าน anon client + RLS (bmbAdminApi_inventory.ts:39-76, bmbAdminApi_products.ts:82, bmbAdminApi_media.ts:51-67)
  - Refund: EF `stripe-refund` (bmbAdminApi_orders.ts:264)
- Admin → Customer effect (code-level): ราคา/availability (products → getProducts + RPC re-check), rounds/capacity (delivery_rounds → listRoundsForDate + RPC), settings (business_settings.order_policy) · runtime จริงรอ Phase 6 live test

## 6. Rider Architecture

- `RiderPwaPage` + `RiderPod.tsx` + `driverService.ts` — session ใน localStorage (`bmb_driver_session`, RiderPwaPage.tsx:20)
- `components/dashboard/RiderPWA.tsx` ใช้ **client-side useOrderStateMachine** + haversine — implementation ที่สองของ "rider console"
- delivery lifecycle DB objects (contracts 020/036) มีใน e2e SQL — สถานะ production รอ Phase 2/7

## 7-8. Backend / Supabase Architecture

- Client เดียวทั้ง app: anon-only `supabase.ts:28` — ไม่พบ service-role client ใน src
- 14 Edge Functions; active call sites จาก client: `ai-proxy` (aiService.ts:53,121), `create-checkout` (paymentGateway.ts:66), `stripe-refund` (bmbAdminApi_orders.ts:264), `stripe-webhook` (Stripe เรียกเข้า)
- EF ใช้ service key env `bmb_backend_production_supabase_service_role_key` (stripe-webhook/index.ts:112)
- stripe-webhook: verify HMAC (whsec) → 400 ถ้าไม่ผ่าน → `record_payment_result` (service_role) · unhandled = 202 · ไม่มี order_number = 202 (index.ts:94-157)

## 9. Database Interaction Map (caller → method → target)

| Caller | Method | Target | R/W | Purpose |
|---|---|---|---|---|
| CheckoutPage | rpc | `create_order_with_items` (025 v3) | W | สร้าง order ทั้งสอง mode |
| paymentGateway | rpc | `create_payment_intent_record` / `submit_offline_payment_reference` | W | PromptPay/COD intent |
| stripe-webhook EF | rpc (service) | `record_payment_result` | W | mark paid/failed idempotent |
| bmbAdminApi_orders | rpc | `transition_order_status`, `confirm_offline_payment`, `mark_payment_failed` | W | lifecycle + offline payment |
| deliveryFeeApi | rpc | `compute_delivery_fee_rpc` (020) | R | fee quote |
| aiServerMemory | rpc | `get_ai_memory`, `save_ai_memory` | R/W | AI memory |
| contentApproval | rpc | `submit_content_for_approval`, `review_content` | R/W | AI content gate |
| customerIntelligenceServer | rpc | `customer_intelligence` | R | CRM view |
| auditLog | rpc | `append_audit_log` | W | audit |
| admin APIs | .from CRUD | products, inventory, media_assets, delivery_rounds, promotions, profiles ฯลฯ | R/W | admin management (RLS-gated) |
| paymentGateway | invoke | `create-checkout` EF | W | Stripe PI |
| aiService | invoke | `ai-proxy` EF | R | LLM (key server-side) |
| bmbAdminApi_orders | invoke | `stripe-refund` EF | W | refund |

## 10-12. Order / Preorder / Same-day Architecture

- **ONE canonical creation RPC สำหรับสอง mode**: `create_order_with_items` รับ `p_order_mode`/`p_scheduled_date` (migration 025 v3 — CheckoutPage.tsx:4-9) — แยกโดยพารามิเตอร์ ไม่ใช่คนละ pipeline
- Rule enforcement matrix (จาก code + tests api.test.ts:216-341; production runtime รอ Phase 2):
  - Product availability: UI + **RPC (ERR_PRODUCT_UNAVAILABLE)**
  - Price/promotion: client DISPLAY ONLY · **RPC authoritative (promotion จากตาราง promotions เท่านั้น)**
  - Round/capacity: client gate (CheckoutPage.tsx:179-183) + **RPC (ERR_ROUND_NOT_FOUND / ERR_ROUND_CLOSED / ERR_CAPACITY_FULL)**
  - Cutoff: client เฉพาะ SAME_DAY (CheckoutPage.tsx:161-177; **PRE_ORDER ไม่มี client cutoff — มีแต่ lead-days**) + RPC (enforcement จริงยืนยันจาก migrations 017/024/025/038 ใน Phase 2)
  - Empty order/missing name: **RPC (ERR_EMPTY_ORDER ฯลฯ)**
- Delivery fee: server derive ซ้ำภายใน create RPC + `compute_delivery_fee_rpc` สำหรับ UI
- **Client-side order state machine แยกอยู่:** `orderStateMachine.ts` + `stores/useOrderStateMachine.ts` (ใช้ใน dashboard CustomerTimeline, RiderPWA) — transition allow-list ฝั่ง client — UI model เท่านั้น (DB trigger + RPC เป็น authority)
- `availabilityEngine.ts` = pure client truth-table (quota/cutoff) — UI hint, ไม่ใช่ authority

## 13. Payment Architecture (authority พิสูจน์จาก code)

```
credit_card:   CheckoutPage → createPaymentIntent('credit_card')
               → EF create-checkout (JWT required; amount RE-DERIVED จาก orders.total_amount;
                 STRIPE_SECRET_KEY ฝั่ง EF เท่านั้น) → Stripe PI
               → Stripe signed webhook → EF stripe-webhook (HMAC whsec verify)
               → rpc record_payment_result (service_role) → orders.payment_status='paid'
PromptPay/COD: CheckoutPage → createPaymentIntent → rpc create_payment_intent_record
               (server re-validate p_amount กับ orders.total_amount)
               → ลูกค้า submit TXN → rpc submit_offline_payment_reference (pending→processing)
               → Admin confirm → rpc confirm_offline_payment (admin-only, rule-gated: COD ต้อง delivered)
PAID authority = DB RPC เท่านั้น (record_payment_result / confirm_offline_payment)
Client ไม่มี path mark paid — PaymentConfirmationPage แค่ submit TXN (ไม่เคย self-mark paid)
```

Refund = EF `stripe-refund` (admin). Idempotency = replay guard ใน `record_payment_result` (migration 010)

## 14. Delivery Architecture

- Fee: `compute_delivery_fee_rpc` (migration 020, delivery_zones) — server authority; local-mirror (`deliveryFeeApi.ts:20-74`) = UI fallback เท่านั้น
- Method ใน CheckoutPage = hardcode `'self_delivery'` (CheckoutPage.tsx:99, 201) — ไม่มี UI เลือก Bite Drive vs external rider ใน flow หลัก
- Providers registry (`providers/registry.ts` + biteDrive/grab/lineman/foodpanda) มี code — consumer ที่ active พบเฉพาะ test + dashboard RiderPWA (client-side)
- Dispatch/driver assignment: `driverService.ts` + contracts 020/036 — production runtime = ยืนยันไม่ได้ (Phase 7)

## 15. AI Architecture

- LLM path เดียว: aiService.ts → EF `ai-proxy` (OPENROUTER_API_KEY ฝั่ง server) → OpenRouter; model fallback chain (`aiModels.ts`)
- Tool calling: `aiToolCalling.ts` — tools อ่านข้อมูลผ่าน admin API (getProducts/getOrders/reviews) — **read-only tools, ไม่พบ AI write path**
- AI memory: client store (`aiMemory`) + server RPC (`get_ai_memory`/`save_ai_memory`) — สองชั้น
- Content automation: `contentAutomation.ts` (generate) → approval gate (`contentApproval.ts` — publish เฉพาะ status='approved') — AI publish ไม่ได้ตรง
- สรุป code-level: AI = read/suggest/generate — ไม่พบ AI authority ต่อ price/payment/stock/refund/state

## 16. Automation Architecture

- **ไม่พบ Make.com / external webhook receiver ใน src หรือ supabase/functions** (scan → เจอแต่ในเอกสารเก่า)
- ที่มีจริง: client-side notification event system (`types/index.ts:425`) + EF ai-daily-report / daily-report / generate-rewards / inventory-reorder (ไม่พบ scheduler/cron config เรียก EF เหล่านี้ — DORMANT candidate)
- ข้อสรุป: omnichannel automation ณ repo ปัจจุบัน = **MISSING / FOUNDATION ONLY** (Supabase เป็น hub จริง แต่ไม่มีช่องทาง inbound จาก channel ภายนอกใน code)

## 17. External Integrations

| Service | จริง/โมเดล | Evidence |
|---|---|---|
| Stripe | REAL (server keys, webhook verify) | create-checkout/index.ts:40 · stripe-webhook/index.ts:94-113 |
| OpenRouter | REAL ผ่าน ai-proxy | ai-proxy/index.ts:12-14 |
| Google Maps / Mapbox | CONFIG ONLY — consumer runtime ยังไม่พบใน scan | .env.example:38-44 |
| Grab/LINE MAN/foodpanda | ADAPTER code + tests, ไม่พบ production dispatch path | providers/registry.ts:8-10 |
| Make.com / FB / Messenger / LINE | ไม่พบใน code | scan |

## 18. Authentication / Authorization

- Supabase Auth (email) + `phone-auto-login` EF · guest = anon client
- Authorization: RLS + grants (migrations 005/006/014/031-035) + admin RPC guard (`is_admin()`)
- Order write ต้อง authenticated (007 — anon → P0001/PGRST202 ตาม evidence เดิม; live รอ Phase 9)
- Admin: profiles.role + fetchProfileRole (App.tsx:94)
- **Rider session = localStorage (`bmb_driver_session`) — ไม่พบ JWT-backed rider auth ใน scan (ยืนยันต่อ Phase 9)**

## 19-21. Source-of-Truth / Transaction-Authority / Orchestration Map

| เรื่อง | Authority | Evidence |
|---|---|---|
| Order creation (price/fee/total/mode/capacity) | PostgreSQL RPC `create_order_with_items` + trigger | 025 v3 · api.test.ts:216-341 |
| Order status transition | DB RPC `transition_order_status` + BEFORE UPDATE trigger | bmbAdminApi_orders.ts:178-190 |
| Payment → PAID (card) | stripe-webhook EF → `record_payment_result` | stripe-webhook/index.ts:124-137 |
| Payment → PAID (offline) | `confirm_offline_payment` (admin-only, rule-gated) | bmbAdminApi_orders.ts:214 |
| Delivery fee | `compute_delivery_fee_rpc` + delivery_zones | 020 · deliveryFeeApi.ts:44 |
| Menu products | DB products (MenuPage) — **home sections ใช้ static lib** | DrinksSection.tsx:10 |
| Business settings | business_settings table | CheckoutPage.tsx:114 |
| Cart state / UI mode | **CLIENT (store/cartStore)** — UI state only | CheckoutPage.tsx:43 |
| Order lifecycle display | client orderStateMachine (UI model) | stores/useOrderStateMachine |
| AI memory | server RPC + client cache | aiServerMemory.ts:27-35 |
| Rider session | **CLIENT localStorage** ← ไม่ใช่ server authority | RiderPwaPage.tsx:20 |

Orchestration: ไม่มี orchestrator กลาง/async worker — orchestration = client ลำดับ call + DB trigger; Edge Functions เป็น on-demand worker

## 22. Duplicate / Legacy Architecture

| รายการ | การตัดสิน | Runtime ใช้ตัวไหน |
|---|---|---|
| `store/cartStore` vs `stores/useCartStore` | OVERLAPPING — สอง cart แยก state จริง | จ่ายเงิน = `store/cartStore`; `stores/useCartStore` active ผ่าน BiteMascot/CartIsolationModal (แสดงผลเท่านั้น) |
| client orderStateMachine vs DB trigger state machine | แยกชั้น (display vs authority) | DB |
| `drinksMenu/snacksMenu` vs DB products | OVERLAPPING สองแหล่งเมนู | home = static lib · MenuPage = DB |
| Review sources (realReviews/socialProofReviews/reviewApi) | OVERLAPPING | trace ไม่ครบ — UNKNOWN |
| `CustomerTimeline.tsx` ซ้ำ 2 ที่ | DUPLICATE | UNKNOWN |
| rider console (RiderPwaPage vs dashboard/RiderPWA) | DUPLICATE | UNKNOWN |
| 2 git worktrees (aspiring-flamingo @root, satisfying-aphid @src/.kilo) | REAL registered git worktrees | ไม่ถูก import โดย active code แต่ **vitest หยิบ test ไฟล์มารัน** |

**Stale worktree investigation:** (1) ไม่ถูก import โดย active code — imports ทั้งหมดอยู่ใน canonical tree (2) ถูก test เพราะ vitest glob `**/*.test.ts` เจอไฟล์ใน `src/.kilo/worktrees/...` (3) `git worktree list` = registered worktrees ที่ detached HEAD `1df7498` (src/.kilo) และ `511bfd4` (root .kilo) — ไม่ใช่ copied snapshot ธรรมดา (4) source แตกต่างจาก canonical: worktree มี `preOrderService.ts` + MenuPage import มัน — canonical ไม่มีแล้ว (5) สร้าง false test-count (358 = ~179×2) และ false-positive evidence; ไม่พบ false-negative
Recommendation (ไม่แก้ใน phase นี้): prune worktrees + exclude `.kilo/` จาก vitest/tsx config ในภายหลัง

## 23. Dormant Architecture

Candidates (มี code แต่ไม่พบ active runtime path): `demandForecasting.ts`, `inventoryPrediction.ts`, `routeOptimization.ts`, `customerIntelligence.ts` (client version), `externalProviders.ts`, `promotionIntelligence.ts`, `VoiceInterface.tsx`, `providers/grab|lineman|foodpanda`, EF `daily-report`/`ai-daily-report`/`generate-rewards`/`inventory-reorder`/`phone-auto-login`/`random-menu-draw`/`track-share`/`vote-menu` (ไม่พบ caller จาก client — อาจถูกเรียกจาก cron ภายนอก: NOT VERIFIED)

## 24. Contradictions

```
CONTRA-1 — Menu สองแหล่ง (HIGH)
Expected: DB products (admin แก้ → customer เห็น)
Actual: MenuPage = DB ✓; HomePage Drinks/Snacks = static lib (drinksMenu.ts/snacksMenu.ts)
Impact: Admin เปลี่ยนเครื่องดื่ม/ขนมใน DB → HomePage ไม่เปลี่ยน

CONTRA-2 — Client order state machine ขนานกับ DB state machine (MEDIUM)
Actual: dashboard/RiderPWA + CustomerTimeline ใช้ useOrderStateMachine (allow-list hardcode ฝั่ง client)
Risk: display drift ถ้า DB rules เปลี่ยน

CONTRA-3 — Cart สองตัว (MEDIUM)
Actual: store/cartStore (จ่ายจริง) vs stores/useCartStore (isolation preview)
Risk: state แยกกัน — สับสนได้ทั้ง dev และ UX

CONTRA-4 — Admin write ไม่ผ่าน canonical path เสมอ (MEDIUM)
Actual: orders = RPC ✓ แต่ products/inventory/media = direct CRUD (พึ่ง RLS เท่านั้น)
Risk: ไม่มี transaction authority เดียวกัน — ความปลอดภัยขึ้นกับ RLS ที่ยังไม่ได้ audit (Phase 9)
```

## 25. Architecture Gaps (code-level)

1. Delivery method hardcode `self_delivery` ใน CheckoutPage — Bite Drive/external rider ไม่อยู่ใน customer flow
2. Rider auth ไม่พบ server-side (localStorage session)
3. ไม่มี Make.com/omnichannel inbound path ใน code
4. EF dormant 8/14 (ไม่พบ caller/cron)
5. Google Maps config ไม่มี consumer ที่ยืนยันได้
6. ICT cutoff ฝั่ง client ใช้ assumption local clock = ICT (CheckoutPage.tsx:164)
7. ไม่พบ pagination/limit ใน scan แรกของ getOrders (ยังไม่ยืนยัน — รอ Phase 2+)

## 26. Evidence Index

- `git worktree list` output (main + 2 worktrees, 2026-09-27)
- Imports: CheckoutPage.tsx:14-28 · App.tsx:17-67 · DrinksSection.tsx:10 · SnacksSection.tsx:10 · homeProviders.ts:24 · RiderPwaPage.tsx:18
- RPC: bmbAdminApi_orders.ts:172,183,214,223 · deliveryFeeApi.ts:44 · aiServerMemory.ts:27,34 · contentApproval.ts:29,40 · customerIntelligenceServer.ts:26,35 · auditLog.ts:114
- EF: stripe-webhook/index.ts:81-159 · create-checkout/index.ts:40,58+ · ai-proxy/index.ts:14
- Payment contract: paymentGateway.ts:1-129
- Client gates: CheckoutPage.tsx:161-189
- Tests (offline mock): src/__tests__/api.test.ts:216-341
- Live run 2026-09-27: npm test = 358/358 (44 files — รวม worktree duplicate)

---

## 27. ARCHITECTURE CORRECTIONS (จาก Phase 2 production evidence)

```
ARCHITECTURE CORRECTION #1 — Edge Functions
Previous (Phase 1): 14 EF อยู่ใน repo · ai-proxy active ผ่าน aiService.ts
Actual: production deploy จริงเพียง 4 (create-checkout v33, stripe-webhook v41,
        stripe-refund v3, phone-auto-login v1) — ai-proxy ไม่ deploy
Evidence: Management API GET /functions (prod-phase2-audit.json → edge_functions)
Impact: Bite AI chat บน production น่าจะ broken (functions.invoke → 404) — live verify ใน Phase 3/9
Classification update: ai-proxy และอีก 10 EF = DORMANT-IN-CODE

ARCHITECTURE CORRECTION #2 — Driver delivery backend มีจริงมากกว่าที่คิด
Previous (Phase 1): driver/delivery lifecycle = ยืนยันไม่ได้, provider = adapter only
Actual: production มี driver RPC เต็มชุด (driver_login, driver_accept_assignment,
        driver_update_delivery_status, assign_driver, my_deliveries, upsert_driver) +
        delivery_assignments/driver tables + is_outside_self_zone + enum delivery_method 4 ทาง
Evidence: prod-phase2-audit.json (functions + orders_cols + enum_values)
Impact: DB/BACKEND รองรับ Bite Drive + external rider จริง; จุดอ่อน = identity ผ่าน p_driver_phone
```

**แก้เฉพาะข้อที่ production evidence พิสูจน์ผิด — history ของเอกสารไม่ rewrite**

