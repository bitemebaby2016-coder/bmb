# BMB_CURRENT_STATE_2026-09-20.md

> **วันที่ตรวจ:** 2026-09-20 · **Commit:** `887944f1c45bc28ee3d84b13d1642e45ab414791` (2026-09-20 21:26 +0700, working tree clean)
> **บทบาทเอกสารนี้:** ความจริงของระบบ ณ วันที่ล่าสุด (truth lock) — ตอบคำถามเดียว: "วันนี้ระบบมีอะไรจริง?"
> **ห้ามใช้** README หรือเอกสารเก่าเป็น source of truth — ลำดับความจริง: Actual Code > DB/Migrations > Edge Functions > Tests > Production Evidence > Docs > README

---

## 1. Executive Summary

Bite Me Baby = production customer ลำดับแรกของ "Cloud Kitchen Operating Platform" ร้านเปิดขายจริง (Grab + social channels) และมี PWA ของตัวเองรับออเดอร์จริงบน production (Cloudflare Pages + Supabase project `ivkdfognyiwjcmrhcnwz`)

**แกนเงิน-ออเดอร์ (money/order spine) เป็น server-authoritative จริง:** ราคา/ยอดรวม derive จาก DB เท่านั้น (RPC `create_order_with_items`, migration 007), payment ถูกบันทึกผ่าน webhook ที่ verify signature + idempotent + amount-match (migration 008 + Edge Function `stripe-webhook`) — **ผ่าน production smoke test จริง 6/6 test เมื่อ 2026-09-19**

**ช่องว่างที่ใหญ่ที่สุดวันนี้ (ไม่ใช่ visual):** (1) pre-order ยังใช้ราคาฝั่ง client (`preOrderService.ts`) + rounds ถูก hardcode ใน client, (2) inventory ไม่มีการหักสต็อกอัตโนมัติเมื่อขาย, (3) ไดรเวอร์เป็น MOCK, (4) OpenRouter API key เปิดเผยใน client bundle, (5) ไม่มี CI/lint pipeline เอกสารเก่าประกาศ "100% complete" เกินจริงหลายจุด — เอกสารชุดนี้ (CURRENT_STATE + MASTER_PRODUCT_SPEC + 100% CLOSURE BOOK) คือฐานความจริงใหม่

## 2. Current Production Reality

| ช่องทาง | สถานะจริง | Evidence |
|---|---|---|
| ร้านเปิดขายจริงผ่าน Grab + social | ใช้งานจริง (ธุรกิจจริง) | Owner statement |
| PWA production URL | `https://bitemebaby-5f7.pages.dev` (Cloudflare Pages) | `e2e/prod-smoke.json` (2026-09-17: load 2796ms, 0 console errors) |
| Supabase production | `https://ivkdfognyiwjcmrhcnwz.supabase.co` | `e2e/webhook-smoke-result.json`, `e2e/runE2E.cjs` |
| ออเดอร์จริงผ่าน PWA | มี (e2e สร้างออเดอร์จริง `BMB-20260919-442`, `PO-20260919-430` บน DB production 2026-09-19) | `e2e/e2e-result.json` |
| Stripe webhook บน EF ที่ deploy แล้ว | VERIFIED (T1–T6 ผ่านหมด บน production EF) | `e2e/webhook-smoke-result.json` |

## 3. Repository Snapshot

- **Frontend:** React 18.3 + TypeScript (strict) + Vite 7 + Tailwind 4 + zustand 5 + react-router 6 + react-helmet-async + vite-plugin-pwa (workbox)
- **หน้าจอ:** 36 pages (`src/pages/`) — customer 18, admin 12, AI chat 1, login/register 2, เนื้อหา/อื่น ๆ
- **Library layer:** ~40 ไฟล์ใน `src/lib/` (order/payment/delivery/AI/SEO/storage/audit…)
- **Stores:** 2 โฟลเดอร์ — `src/store/` (auth, cart, inventory, location, notification, orderBuilder, rewards) + `src/stores/` (useCartStore, useOrderStateMachine, useDeliveryRouter, useBiteAIStore) — มี cart store ซ้ำ 2 ชุด (legacy + new) → tech debt
- **Edge Functions (Deno):** `create-checkout`, `stripe-webhook`, `stripe-refund`, `phone-auto-login`
- **Migrations:** 001–016 + `HANDOFF_002_SCHEMA.md` + `supabase/config.toml`
- **Tests:** 11 ไฟล์ / **106 tests ผ่านทั้งหมด** (vitest, in-memory Supabase mock) — วัดจริง 2026-09-20 (8.45s)
- **E2E:** `e2e/runE2E.cjs` (Playwright + system Chrome — **ยืม node_modules จากโปรเจกต์อื่น**), `prodSmoke.cjs`, `webhook-smoke.cjs` + evidence JSON + screenshots
- **Build (วัดจริง 2026-09-20):** ผ่าน — `index` chunk 348.60 kB (gzip 106.32 kB), `supabase` chunk 214.75 kB (gzip 55.14 kB), มี `dist/sw.js` + workbox (PWA generate จริง)
- **CI/Lint:** ❌ ไม่มี GitHub Actions, **ไม่มี lint script จริง** (`npm run lint` → "Missing script")

## 4. Architecture Reality

```text
[Browser/PWA] React SPA (zustand, localStorage fallback ผ่าน bmbStorage)
   │  anon key + Supabase Auth session (JWT)
   ▼
[Supabase Postgres]  RLS + RPC (SECURITY DEFINER) = authority ของราคา/ออเดอร์/การชำระเงิน
   ▲                         ▲
   │ supabase-js             │ service_role (เฉพาะใน EF env)
[Edge Functions] create-checkout / stripe-webhook / stripe-refund / phone-auto-login
   ▲
[Stripe API] PaymentIntent + webhook (signature HMAC-SHA256, idempotent)
```

- หลักการที่บังคับใช้จริงตั้งแต่ 2026-09-18: **client = input layer เท่านั้น** — ส่ง price/subtotal/total มาก็ถูกละทิ้ง (migration 007 header: "NOT ACCEPTED")
- ข้อยกเว้นที่ยังฝืนหลักนี้: **pre_orders** (ดู §6, §24) และ **audit log** (localStorage, ดู §15)

## 5. Customer Flow (จริงจาก code + e2e)

Landing (BiteHero + mascots) → Menu (FoodMenuCard, same-day/pre-order split, availability engine quota+cutoff) → Product/Add-ons (016) → Cart (versioned cart v1/v2 + CartIsolationModal) → Checkout (เลือก round/method/ที่อยู่ + lat-lon) → **RPC create_order_with_items (auth จำเป็น)** → Payment (PromptPay TXN / COD / บัตรผ่าน Stripe) → Tracking (OrderTrackPage + CustomerTimeline) → Orders history/Profile

- e2e ผ่านครบทุก step รวม empty-cart mascot state (2026-09-19)
- Guest สร้างออเดอร์ไม่ได้ตั้งแต่ 007 (EXECUTE เฉพาะ `authenticated`)

## 6. Order Flow (state ที่มีจริง)

**ฝั่ง server (authority):** `orders.status` เริ่ม `'pending'` (007) → เปลี่ยนได้เฉพาะผ่าน RPC `transition_order_status` + trigger guard `guard_order_status_transition` (allow-list, บล็อก direct UPDATE ด้วย) — matrix อยู่ใน migration 008
**ฝั่ง client (display):** same-day `Created→Accepted→Preparing→Ready for Pickup→Dispatched→Delivered`, pre-order `Booked→Allocated→Batch Production→Ready for Pickup→Dispatched→Delivered`; `Cancelled` จากสถานะ non-terminal ใดก็ได้, `Failed` เฉพาะจาก `Dispatched` (`src/lib/orderStateMachine.ts` + `src/stores/useOrderStateMachine.ts`)
**Capacity:** 007 ล็อก round capacity แบบ atomic (FOR UPDATE) + 006 decrement `delivery_rounds.current_count` เมื่อ cancel/fail
**⚠️ ความเสี่ยง:** มี 2 vocabulary (server enum vs ภาษา timeline ลูกค้า) ต้องมี mapping ที่ยืนยันแล้ว — ใส่ไว้ใน Phase 0/1 และ **pre_orders** มี status set ต่างหมด ('pending'...'expired') และราคาเป็น client-side (P1) — ดู §24

## 7. Payment Flow (evidence ต่อ method)

| Method | สถานะ | Evidence |
|---|---|---|
| **credit_card (Stripe)** | **PARTIAL** — webhook path VERIFIED / card loop ยังไม่มีหลักฐาน transaction บัตรจริงแบบครบวงจร | `create-checkout/index.ts` (JWT verify → ownership ผ่าน RLS → amount re-derive จาก DB → Stripe PI ฝั่ง server), `stripe-webhook` T1–T6 ผ่านจริง (400 unsigned/invalid, 202 no-metadata, 200 paid, replay idempotent, DB verify paid); แต่ T3/T6 ใช้ intent row ที่ seed ไว้ (`pi-smoke-prep-...`) ไม่ใช่การชาร์จบัตรจริง |
| **promptpay_qr** | **LIVE** (offline-reference model) | RPC `create_payment_intent_record` (amount ถูก re-check กับ DB) → ลูกค้ากรอก TXN (`submit_offline_payment_reference`, pending→processing) → admin confirm (`confirm_offline_payment`) — มี unit test + e2e payment step / **ยังไม่มีการเชื่อมธนาคารอัตโนมัติ (MISSING — design decision ปัจจุบัน)** |
| **cash_on_delivery** | **LIVE** | `confirm_offline_payment` บังคับ `order.status='delivered'` ก่อน mark paid (008) + test ครอบคลุม |
| **Refund** | **PARTIAL** | EF `stripe-refund` (admin-only, Idempotency-Key, server-side) + `stripeRefundLogic`/`stripeWebhookSignature` tests; ยังไม่มีหลักฐาน refund จริงบน production |
| Idempotency / replay | **VERIFIED** | unique partial index `payment_intents(payment_intent_id)` (008+010) + T4 replay → 200 ไม่มีแถวซ้ำ |
| Amount authority | **VERIFIED** | `record_payment_result` amount-match กับ `orders.total_amount`, ERR_AMOUNT_MISMATCH → 400 (Stripe ไม่ retry) |

## 8. Kitchen Flow

- **มีจริง:** delivery rounds (DB `delivery_rounds` + capacity + cutoff), server บังคับ capacity ตอนสร้างออเดอร์ (007), availability engine quota+cutoff (client display), Admin จัดการ rounds (`AdminRounds.tsx`, `DeliveryManagement.tsx`), status transitions ฝั่ง server
- **ยังไม่มี:** production batch/BOM/recipe system, production queue แยกจาก order queue, วงจร "ORDER→CAPACITY→BATCH→KITCHEN→READY→DELIVERY" แบบครบ → **PARTIAL**

## 9. Inventory

- มีตาราง `inventory` + `inventory_transactions` (RLS admin-only, 006) + `InventoryPage.tsx` + low-stock heuristic + `inventoryPrediction.ts` (heuristic ฝั่ง client)
- **MISSING:** การหักสต็อกอัตโนมัติเมื่อออเดอร์ถูกสร้าง/ยืนยัน — 007 ไม่แตะ inventory; สินค้าหมดปิดขายด้วย `products.is_available` (manual) → ความเสี่ยง sold-out มื้อล้น (P1)

## 10. Delivery / Bite Drive

- **Router (pricing logic) LIVE:** two-tier — Tier 1 Bite Drive ≤ maxKm ค่าส่งคงที่ / Tier 2 external quote + markup (`deliveryRouter.ts`, haversine; pure + unit-tested)
- **Bite Drive (ไรเดอร์ร้านเอง): LIVE** แต่ **driver assignment = MOCK** (code ระบุเอง "temporary MOCK drivers")
- **External providers: ไม่ LIVE** — Grab = sandbox (env มี key รอ live contract), LINEMAN = sandbox, Foodpanda = mockup_pending (`externalProviders.ts` ระบุสถานะไว้ใน code เอง)
- **มีจริง:** `delivery_zones` (public read active, admin write), พิกัดลูกค้า (015), `provider_orders` + สถานะ requested→…→delivered, `RouteOptimizationPage`
- **MISSING:** live API integration กับ Grab/LINEMAN, ETA จริง, dispatch อัตโนมัติ

## 11. Bite AI

- **โมเดลจริง:** Model A = GLM 5.2 (free) ผ่าน OpenRouter + fallback Qwen 3.7 Flash — fallback ถูก trigger จริงเมื่อเจอ 429 (เห็นจาก log ตอนรัน test 2026-09-20)
- **Tool calling = READ-ONLY** (get_menu, get_order, get_product, get_reviews, get_categories) — AI **ไม่มีอำนาจ** ต่อราคา/สต็อก/ออเดอร์/เงิน (ตรงหลัก platform)
- **Defect เล็ก:** `aiToolCalling.ts` `case 'get_order'` เรียก `getOrder(...)` **ไม่ await** → ตรวจ `!order` ไม่มีทางถูกต้อง (P2 bug)
- **คุย/บริบท:** `BiteAIChat` + `useBiteAIStore` + `aiMemory.ts` (heuristic) + persist ใน `ai_conversations` (RLS: anon deny, own/admin)
- **P1 Security:** `VITE_OPENROUTER_API_KEY` ถูก bundle ลง client — ใครก็ดึง key ไปใช้ได้ (ดู §15)

## 12. Customer Intelligence

- มี: `customers` table (RLS: anon deny, own/admin), loyalty points (client store), `customerIntelligence.ts` (heuristic: preferences/frequency/AOV/segmentation ฝั่ง client), CustomerTimeline component
- ยังไม่มี: segmentation/timeline ที่คำนวณฝั่ง server และ feed กลับสู่ recommendation แบบ authoritative → **PARTIAL**

## 13. Admin / Command Center (feature-by-feature)

| พื้นที่ | ไฟล์ | สถานะ |
|---|---|---|
| Dashboard stats | `AdminDashboard.tsx` (today orders/revenue/pending) | LIVE |
| Orders (transition + payment confirm/refund) | `AdminOrders.tsx` + `bmbAdminApi_orders.ts` (RPC-based) | LIVE |
| Products/Categories/Add-ons | `AdminProducts.tsx`, `AddonsEditor` (016) | LIVE |
| Rounds / Delivery mgmt | `AdminRounds.tsx`, `DeliveryManagement.tsx` | LIVE |
| Inventory | `InventoryPage.tsx` | LIVE (แต่ไม่มี auto-deduct) |
| Customers / Promotions | `AdminCustomers.tsx`, `AdminPromotions.tsx` | LIVE |
| Media library (bucket `bmb-images` + `media_assets`) | `AdminMedia.tsx` | LIVE (policy 011 — owner ใช้งานได้แล้ว) |
| Settings (business_settings) | `AdminSettings.tsx` | LIVE |
| Audit log | `AuditLogPage.tsx` | PARTIAL — **เก็บใน localStorage เท่านั้น** (`bmb_audit_logs`, cap 5000) ไม่ใช่ DB |
| Route optimization / Rider PWA | `RouteOptimizationPage.tsx`, `RiderPwaPage.tsx` | PARTIAL (heuristic + mock drivers) |
| **Mascot self-service (แอดมินเปลี่ยนมาสคอตเอง)** | — | **MISSING** — owner อนุมัติ requirement แล้ว (2026-09-20) → Closure Book ADMIN-07, ทำใน Phase 4 |

Admin guard: `AdminRoute` (App.tsx) + role จาก `profiles.role` (`is_admin()` ฝั่ง DB, hardening SET search_path ใน 006, guard กัน self-escalate role ใน 006-B7)

## 14. PWA / Mobile

- vite-plugin-pwa `autoUpdate`, manifest ภาษาไทย (theme #F97316), workbox precache glob — build ออก `sw.js` จริง (verified 2026-09-20)
- Prod smoke ผ่าน (0 console errors, load 2.8s) — **Lighthouse (2026-09-17): Perf 29 / A11y 82 / BP 100 / SEO 100** → Performance = OPEN gap (P2)
- Offline data mode: `bmbStorage.ts` localStorage fallback (hybrid — UX offline, DB ยังเป็น authority เมื่อ online)

## 15. Security

**สิ่งที่มีจริง (จาก migrations/EF):**
- Supabase Auth เป็นเจ้าของ identity (P0-2 fix): JWT session, hash ฝั่ง backend, `handle_new_user` hook สร้าง profile role='customer' อัตโนมัติ, กัน escalate role เอง (006-B7)
- RLS secure posture (005→006): drop `p_public_all_*` permissive ทั้ง 18 ตาราง → anon SELECT เฉพาะตารางสาธารณะ (products/categories/rounds/reviews/promotions/preorder_votes/orders), `customers`/`ai_conversations`/`ai_recommendations`/`payment_intents` ปิด anon, admin จัดการผ่าน `is_admin()` (014 ให้ owner-admin full access)
- Order/payment authority: RPC ทั้งหมด SECURITY DEFINER + SET search_path; `record_payment_result` EXECUTE เฉพาะ service_role; ลูกค้า/แอดมินใช้ RPC ที่กำหนดเท่านั้น; trigger บล็อก direct UPDATE status
- Edge Functions: verify JWT (`/auth/v1/user`), ownership ผ่าน RLS, webhook signature HMAC-SHA256 + timing-safe compare + 5-min window, amount-match, key rotation 2026-09-19 (`bmb_backend_production_supabase_service_role_key` — legacy `SUPABASE_SERVICE_ROLE_KEY` ยังเป็น fallback ใน code จนกว่าจะ retire)
- Secrets: `.env` ไม่ถูก commit; e2e ใช้ service key ผ่าน env เท่านั้น

**ช่องโหว่/ความเสี่ยงที่พบ (พิสูจน์จาก code จริง):**

| # | ปัญหา | ระดับ |
|---|---|---|
| S-1 | `VITE_OPENROUTER_API_KEY` อยู่ใน client bundle — ใช้ฟรี/ยิงหนักได้ | **P1** |
| S-2 | Pre-order (`pre_orders`) ราคา/ยอดมาจาก client (`preOrderService.ts`) — ยังไม่มี server-side re-derivation เหมือน orders (007) | **P1** (data/money integrity) |
| S-3 | anon read orders — **REST-level ตรวจแล้ว (PHASE 0 truth lock 2026-09-21): ปิดจริง** (anon 0 rows, service 2 rows) — เหลือยืนยัน policy string บน `pg_policies` ผ่าน SQL Editor (owner action) | P1 (เหลือ SQL confirm) |
| S-4 | Audit log เป็น client-side localStorage — แก้/ลบได้จาก browser, ไม่ผูก user session จริง | P2 |
| S-5 | Legacy service-role key env name ยังเป็น fallback ใน EF 2 ตัว | P2 |
| S-6 | Phone login ใช้ alias `phone@phone.bmb.local` (pattern hack) | P2 |
| S-7 | e2e พึ่ง playwright จาก `D:/selfprint-v3-react/node_modules` (ไม่ reproducible บนเครื่องใหม่) | P3 |

## 16. Tests

- **Unit/Integration:** 106/106 ผ่าน (11 files, vitest, in-memory Supabase mock) — วัดจริง 2026-09-20
- **ครอบคลุม:** order state machine (allow-list, skip/backward), payment contracts (amount tamper→ERR_AMOUNT_MISMATCH, COD เฉพาะ delivered, PromptPay pending→processing→paid), webhook signature/refund logic, availability engine, delivery router, cart isolation, AI model fallback, API layer
- **ไม่ครอบคลุม:** SQL functions จริงใน Postgres (mock จำลอง RPC — เสี่ยง drift กับ SQL จริง), admin UI flows, notification, offline recovery
- **E2E (ผ่านจริง 2026-09-19):** Playwright + system Chrome ต่อ production DB สร้าง user จริง→สั่งจริง→ชำระ→track; webhook smoke T1–T6; prod smoke (2026-09-17)
- **❌ ไม่มี:** CI pipeline (GitHub Actions), lint script, coverage report, e2e ฝั่ง admin

## 17. Production Verification (หลักฐานที่ "ใช้งานจริง" ได้)

| สิ่งที่พิสูจน์แล้วบน production | วันที่ | Evidence |
|---|---|---|
| Stripe webhook (signature/idempotent/amount/paid→DB) | 2026-09-19 | `e2e/webhook-smoke-result.json` |
| สร้างออเดอร์จริงผ่าน RPC 007 (same-day + pre-order) บน DB production | 2026-09-19 | `e2e/e2e-result.json` |
| PWA โหลดบน Cloudflare Pages ไม่มี error | 2026-09-17 | `e2e/prod-smoke.json` |
| Migrations 005–013 + 011/014 ถูก apply แล้ว (e2e/webhook ใช้ feature ที่ต้องมี migration เหล่านั้น) | 2026-09-19 | e2e evidence + owner confirmation |
| Tests 106/106 + build ผ่าน (tsc+vite, sw.js) | 2026-09-20 | รันใน session audit นี้ |
| **PHASE 0 TRUTH LOCK (read-only live verify) 48/48** — RLS anon posture (S-3 ปิดจริง), protected tables anon-blocked, public tables anon-readable, RPC 007/008/016 ทั้งหมดมี + guard ทำงาน, tables/columns/columns migration markers ครบ, storage bucket `bmb-images` มี, anon INSERT ถูกปฏิเสธ | **2026-09-21** | `e2e/truthLock.cjs` + `e2e/truth-lock-result.json` (48/48) |
| **ยังไม่มีหลักฐาน:** transaction บัตรจริงครบวงจร, refund จริง, Grab/LINEMAN live call, notification จริง, SQL dump `pg_policies` (owner ต้องรัน `e2e/truth-lock.sql` ใน SQL Editor) | — | — |

## 18. LIVE

PWA storefront (home/menu/product/cart/checkout/tracking) · Supabase Auth (email+phone+quick-login EF) · สร้างออเดอร์ server-authoritative (007) · order transitions ผ่าน RPC+trigger (008) · ค่าส่ง two-tier logic · delivery rounds capacity ฝั่ง server · PromptPay offline-reference + COD · Stripe webhook · Admin core (orders/products/rounds/inventory/customers/promotions/media/settings) · PWA install + precache

## 19. PARTIAL

credit_card checkout ครบวงจร (ขาด 1 บิลบัตรจริง) · Refund (EF พร้อม ยังไม่ทดสอบจริง) · Kitchen ops (ไม่มี batch/production queue) · Inventory (ไม่มี auto-deduct) · Pre-order (ราคา client-side + rounds hardcoded — S-2) · Bite Drive dispatch (mock drivers) · External providers (sandbox/mockup) · Audit log (client-side) · Rider PWA · Route optimization · Customer intelligence (heuristic) · Content automation (heuristic + promotion admin) · AI chat (มีจริง แต่ key ฝั่ง client + get_order bug)

## 20. SKELETON

(ไม่พบโมดูลที่เป็นแค่ interface ล้วน — โมดูล heuristic ทั้งหมดมี implementation จริงระดับ client-side)

## 21. MISSING

Server-side inventory deduction · Recipes/BOM → ingredient requirement → availability จากสูตร · Notification center (transactional/marketing/Bite/operational แยกช่อง) · Loyalty server-authoritative (points/redeem rules ฝั่ง DB) · Auto PromptPay bank verification · Live external provider API · Driver/vehicle management จริง · Mascot self-service สำหรับแอดมิน (อนุมัติแล้ว) · CI/lint/coverage · AI proxy ฝั่ง server · delivery fee จาก `delivery_zones` แบบ authoritative ใน RPC (ยังใช้ client distance input — p_distance_km "UI input, NOT financial")

## 22. BROKEN

- `aiToolCalling.ts get_order`: missing `await` (logic check พัง — P2)
- (ไม่พบ broken ระดับ blocking ใน flow เงิน/ออเดอร์ — ผ่าน test + smoke จริง)

## 23. DEFERRED

Voice/Intent module (cancelled ตาม Reality Map เดิม) · White-label multi-tenant (Phase 8) · Advanced route optimization หลายไดรเวอร์/ยานพาหนะ · ระบบ warehouse/procurement เต็มรูป

## 24. Known Risks

1. **Pre-order money integrity (S-2)** — ถ้ามีการแก้ราคาฝั่ง client ได้ จะกระทบรายได้จริง (P1 สูงสุดด้านเงิน)
2. **Mock–SQL drift** — test ผ่านเพราะ mock เลียนแบบ SQL เอง; ถ้า SQL เปลี่ยนโดยไม่ sync mock, test ให้ความมั่นใจลวง
3. **หักสต็อกไม่อัตโนมัติ** — เสี่ยงขายเกิน quota/stock ในมื้อที่คนสั่งหนัก
4. **Lighthouse Perf 29** — โหลดช้าบนมือถือจริง (bundle index 348 kB + supabase 215 kB)
5. **เอกสารเก่าเกินจริง** — เอกสาร 2026-09-17/18 เคยประกาศ "100% complete/19 tests" ทั้งที่จริงมี 106 tests + ระบบ Stripe/RLS ที่เอกสารไม่รู้จัก → ใช้เอกสารชุดนี้แทน
6. **Single-owner operations** — ไม่มี on-call/monitoring/error alerting ฝั่ง EF/webhook

## 25. Blocking Issues

ไม่มี blocker ระดับ "ธุรกิจเดินไม่ได้" ณ วัน audit — แต่ 2 ข้อต้องแก้ก่อนขยายปริมาณการขายจริง: **S-2 (pre-order price authority)** และ **S-1 (AI key เปิดเผย)**

## 26. Technical Debt

- Cart store ซ้ำ 2 ชุด (`src/store/cartStore.ts` vs `src/stores/useCartStore.ts`) + `src/store/` vs `src/stores/` คู่ขนาน
- `preOrderService.getPreOrderRounds()` hardcode rounds (client) ทั้งที่มี `delivery_rounds` ใน DB
- e2e พึ่ง playwright จาก node_modules โปรเจกต์อื่น
- ไม่มี lint/CI/coverage; audit log client-side; phone-alias hack; legacy key env fallback
- Status vocabulary ซ้อนกัน 3 ชั้น (server enum / client chain / provider_orders enum)

## 27. Current Commit

`887944f1c45bc28ee3d84b13d1642e45ab414791` — "feat(admin+assets): login error transparency (Thai guidance for Email-not-confirmed/invalid-credentials), wire new 3D mascot asset set (14 poses incl. thumbsup-approval path fix), Thai admin guide (login fix, 3 ways to promote admin)" (2026-09-20 21:26 +0700) — working tree clean

## 28. Last Verified Date

**2026-09-20** — tests + build รันใหม่ใน session นี้; e2e/webhook evidence ล่าสุด 2026-09-19; prod smoke 2026-09-17

## 29. Evidence References

| หลักฐาน | ตำแหน่ง |
|---|---|
| สร้างออเดอร์ server-authoritative | `supabase/migrations/007_server_authoritative_order.sql` |
| Payment/state machine + RPC ทั้งชุด | `supabase/migrations/008_payment_state_machine_and_phase_d.sql` (+009, 010, 013 แก้ idempotency) |
| RLS hardening + auth hook | `supabase/migrations/005…`, `006_rls_hardening_auth.sql`, `014_owner_admin_full_access.sql` |
| Stripe EF | `supabase/functions/create-checkout|stripe-webhook|stripe-refund/index.ts` |
| Webhook production smoke (T1–T6) | `e2e/webhook-smoke-result.json` |
| E2E ลูกค้าจริง (same-day + pre-order) | `e2e/e2e-result.json` + `e2e/screenshots/` |
| Prod smoke | `e2e/prod-smoke.json` |
| Tests/build วัน audit | รันจริง 2026-09-20: 106/106, build ✓ (sw.js สร้างแล้ว) |
| Client order/payment state machine | `src/lib/orderStateMachine.ts`, `src/lib/paymentGateway.ts`, `src/lib/deliveryRouter.ts`, `src/lib/availabilityEngine.ts` |
| สถานะ provider ตามจริง (sandbox/mock) | `src/lib/externalProviders.ts` (PROVIDER_API_STATUS) |

## 30. Next Required Actions

> **Roadmap v2 (2026-09-20 — scope revision):** phase plan ถูกแทนด้วยโครงสร้าง v2 — **Domain A** (PHASE 0–4) → **PWA-100-GATE** → REAL-WORLD PILOT → PATCH/HARDENING LOOP → **Milestone 1 = BMB PRODUCTION 100%** → PHASE 5–7 → SAAS PRODUCTIZATION GATE → **Domain B** (PHASE 8–15) → **Milestone 2 = BMB SAAS READY** · Future SaaS requirements (COM/RES/THEME/SITE/QR/DINE/CRM/MKT/REV/CAT/LOC/IAM/INV-PRO/ANA/AI-BIZ/AI-FC/WL/SAAS = 215 items) อยู่ Domain B = **DEFERRED ทั้งหมด และห้ามบล็อก PWA 100%** · รายละเอียด gate ทั้งหมด → `BMB_100_PERCENT_CLOSURE_BOOK.md` §A/A2/B+

1. **PHASE 0 — TRUTH LOCK: ดำเนินการแล้ว 2026-09-21** (REST-level 48/48 ผ่าน — `e2e/truth-lock-result.json`) ผล: S-3 ปิดจริงที่ระดับ REST, RPC/trigger/tables ทั้งหมดครบ, storage `bmb-images` พร้อม · **Owner action ค้าง:** รัน `e2e/truth-lock.sql` ใน Supabase SQL Editor เพื่อ dump `pg_policies` + migration markers (ปิด SEC-01 ชั้น SQL ให้สมบูรณ์)
2. Phase 1 (MONEY+ORDER): S-2 pre-order price authority, 1 บิลบัตรจริงครบวงจร (owner: จ่ายบัตรจริง 1 บิล), refund จริง 1 รายการ (owner), mapping สถานะเป็น vocabulary เดียว, SEC-03 server audit, QA-01 CI, QA-02 lint, QA-03 SQL contract tests, QA-04 e2e reproducible
3. Phase 2 (KITCHEN): inventory auto-deduct + recipe/BOM
4. รายละเอียดทั้งหมด → `BMB_100_PERCENT_CLOSURE_BOOK.md`

---

**End of Current State — เอกสารนี้ต้องอัปเดตทุกครั้งหลัง implement แต่ละ phase (ตาม Document Update Rule)**
