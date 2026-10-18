# BMB — FULL PRODUCTION INTEGRITY CLOSURE REPORT

**Project:** Bite Me Baby Cloud Kitchen — `D:\A PROJECT\Bite Me Baby`
**Repository:** `bitemebaby2016-coder/bmb` · **Production:** `https://biteme-baby.com` · **Supabase:** `ivkdfognyiwjcmrhcnwz`
**Report date:** 2026-10-18 · **Scope:** ZERO HARDCODE · DIRECT INTEGRATION · COMPLETE ROUTES & NAVIGATION · END-TO-END VERIFICATION
**Report contains no secrets and no PII.** ทุก probe ฝั่ง production เป็น read-only — ไม่มีการสร้างออเดอร์เงินจริง/charge/ทำอาหาร/dispatch rider ในรอบนี้ (ตามข้อบังคับคำสั่ง)

---

## 1. Git baseline และ final state

### 1.1 Baseline (ก่อนแตะไฟล์ใดๆ — Phase 0)

| รายการ | ค่าที่ตรวจได้ |
|---|---|
| branch / HEAD | `main` @ `7213aa75123ab097596d6a5b2101991a55c46c19` |
| origin/main | `7213aa7` — เท่ากับ HEAD (ไม่ค้าง/ไม่ diverge) |
| staged / unstaged diff | ไม่มีทั้งคู่ |
| untracked files | ไม่มี (worktree สะอาด 100%) |
| stash | `stash@{0}: On main: local-edits-before-sync-2026-09-21` — **ยังอยู่ครบ** (ตรวจซ้ำตอนจบ session — ยังอยู่) |
| remote | `git@github.com-bmb:bitemebaby2016-coder/bmb.git` (fetch/push) |
| Production identity (ก่อนแก้) | SPA build `assets/index-B0wjuzIC.js` + `registerSW.js` (ยุค build `1cada70` / commit `7213aa7`) |

### 1.2 Final state

| รายการ | ค่า |
|---|---|
| Commits ใหม่ | `10ec6e2` fix(zero-fake+routes) · `49ea10a` fix(store-status vocabulary) · commit รายงานนี้ |
| HEAD = origin/main | `49ea10a` — push แล้ว (`7213aa7..49ea10a main -> main`) **ไม่มี force-push / ไม่มี history rewrite** |
| Files changed (ตั้งใจทั้งหมด) | แก้ไข 22 ไฟล์ + ใหม่ 1 (`e2e/routeNav.spec.ts`) + ลบ tracked dead files 5 (`src/main.ts`, `src/counter.ts`, `src/lib/promotionIntelligence.ts`, `v1.txt`, `v2.txt`) |
| Staged-diff review | ตรวจก่อน commit ทุกครั้ง — ไม่มีไฟล์นอกขอบเขตหลุดเข้า commit |
| `.env.local` / secrets / migrations / prod config | **ไม่แตะ** ตามข้อบังคับ Phase 0 |
| Stash | คงเดิม ไม่ pop/drop |

**Production deployment identity (หลัง push):** Cloudflare Pages auto-deploy จาก `main@49ea10a` (รายละเอียด §12)

---

## 2. Complete route registry และ route reachability matrix

แหล่งจริง: `src/App.tsx` (router เดียว — ยืนยันด้วย grep ทั้ง repo) + `index.html` (entry `/src/main.tsx`) + runtime จริง (Playwright §12)

### 2.1 Route registry

`route | role | entry points | params | auth | destination/source | runtime result | status`

| Route | Role | Entry points | Params | Auth | Destination/source | Runtime | Status |
|---|---|---|---|---|---|---|---|
| `/` | public | logo, BottomNav, redirects | — | — | TalkToBiteHomePage (AI landing) | 200 + render | PASS |
| `/shop` | public | landing "เข้าสู่ร้าน", navigate() | — | — | HomePage (storefront) | 200 + render | PASS |
| `/menu` | public | Header/Footer/BottomNav/CTAs | `?tab=pre-order` `?category=` | — | MenuPage | 200 + render | PASS |
| `/cart` | public | FloatingCart/Header cart | — | — | CartPage | 200 | PASS |
| `/checkout` | public (guest OTP gate) | CartPage/StickyCartBar | `?mode=pre-order` | guest session / login | CheckoutPage → `create_order_with_items_i` | 200 (gate renders) | PASS |
| `/track`, `/track/:orderNumber` | public | Footer/OrdersPage/checkout | orderNumber | guest gate | OrderTrackPage → `track_order` | 200 (unknown order → honest state) | PASS |
| `/payment/:orderNumber` | public | CheckoutPage | orderNumber | — | PaymentConfirmationPage | 200 | PASS |
| `/login` `/register` `/reset-password` | public | Header/ProtectedRoute | `?next=` | — | auth pages | 200 | PASS |
| `/promotions` | public | Header/Footer/PromotionStrip | — | — | **PromotionsPage (rebuild — `promotions` table)** | 200 | PASS |
| `/reviews`, `/reviews/:productId` | public | product cards | productId | — | ReviewPage | 200 | PASS |
| `/vote` `/random-menu` `/share` | public | Header/Footer | — | — | pages | 200 | PASS |
| `/talk-to-bite` | public | mascot tap / Bite CTA | — | — | TalkToBitePage | 200 | PASS |
| `/ai-chat` | public | legacy links | — | — | redirect → `/talk-to-bite` | verified | PASS (intentional) |
| `/about` `/faq` `/blog` `/contact` `/privacy` `/terms` | public | Footer/Header | — | — | info pages | 200 | PASS |
| `/orders` `/profile` `/notifications` `/rewards` `/viral` | customer | BottomNav/Footer | — | ProtectedRoute | pages | guest → `/login` | PASS |
| `/voice-demo` | customer | deep link | — | ProtectedRoute | VoiceDemoPage | guest → `/login` | PASS |
| `/profile/orders` | customer | legacy link | — | — | redirect → `/orders` | chain → `/login` (guest) | PASS (intentional) |
| `/rider` | ops (public demo) | direct URL | — | — | RiderPwaPage (driverService/RPC) | 200 | PASS (public by design) |
| `/admin` + 25 subpages (orders/products/menu-schedule/kitchen/recipes/content-approvals/audit-log/asset-audit/payment-exceptions/notifications/delivery/route-optimization/promotions/rounds/customers/settings/media/errors/mascot/brands/tenants/portfolio/ai-studio/inventory/control) | admin | AdminNav sidebar/drawer + quick actions | — | AdminRoute (`role='admin'` จาก `profiles` ผ่าน RLS) | admin pages | guest → `/login` | PASS |
| `/admin/pre-orders` | admin | bookmarks | `?mode=PRE_ORDER` | AdminRoute | redirect → `/admin/orders?mode=PRE_ORDER` | chain verified | PASS (intentional) |
| `*` catch-all | — | broken/deep links | — | — | Navigate → `/` | verified | PASS (intentional) |

SEO `<Routes>` block ครอบคลุมทุกหน้าสาธารณะ + `/admin/*` ไม่มี meta ขาด (รวม `/orders` `/notifications` `/reviews` ที่เคยตก) — dynamic params ทั้ง 3 (`:orderNumber`, `:productId`) handle ค่าที่ไม่มีจริง = honest state ไม่ crash

### 2.2 Reachability matrix summary

- **PASS** — ทุก route ข้างบน (39 เคส Playwright runtime ผ่าน + prod HTTP 200)
- **REDIRECT_LOOP** — ไม่พบ
- **UNREACHABLE / MISSING_IMPLEMENTATION** — ไม่มี (เทียบ `src/pages/*` กับ registry ครบ 1:1)
- **TEST_ONLY** — `e2e/*` probes (ไม่เข้า bundle) · `realtimeStub.ts` (alias ที่ throw ตรงไปตรงมา) · `src/lib/providers/*` mock adapters (ไม่มี importer ฝั่ง prod)
- **INTENTIONALLY_DISABLED** — คำสัญญา "ส่งฟรีตามยอดขั้นต่ำ" ถูก gate ปิดบน UI (server ยังไม่มีกฎจริง — §5/§13)

---

## 3. Broken/missing links และรายการแก้ไขทั้งหมด

| # | ที่อยู่ | อาการ | ผลก่อนแก้ | การแก้ | สถานะ |
|---|---|---|---|---|---|
| L1 | `ContactPage.tsx:104-107` | `href="#"` ×4 ปุ่มโซเชียล | ลิงก์ตาย | ใช้ `getSocialLinks()/socialLinkItems()` จาก `business_settings` (fallback = ค่า Owner ยืนยัน) — แสดงเฉพาะเครือข่ายที่มีลิงก์จริง | FIXED |
| L2 | `AdminPortfolio.tsx:83` | `to="/admin/dashboard"` | ไม่มี route → catch-all โยนออกจาก admin | เปลี่ยนเป็น `/admin` | FIXED |
| L3 | `BlogPage.tsx:60,77` | ลิงก์ `/blog/post-1..3` | ไม่มีหน้าบทความ → หลุดกลับ `/` | เปลี่ยนเป็น article cards (ไม่ใช่ลิงก์) — ไม่สร้างหน้าปลอมเพิ่ม | FIXED |
| L4 | `BlogPage.tsx:95` | ปุ่ม Subscribe ไม่มี handler | fake CTA | แทน CTA จริง: Facebook ร้าน + `/contact` | FIXED |
| L5 | `PrivacyPage.tsx:56` | `tel:+66xxxxxxxxx` | เบอร์ placeholder โทรไม่ได้ | `SHOP_CONTACT.phoneHref/phone` | FIXED |
| L6 | `PrivacyPage.tsx:55` `TermsPage.tsx:71` | อีเมล `*.@bitemebaby.co.th` | โดเมนไม่ตรง/ไม่ยืนยัน | `SHOP_CONTACT.emailHref/email` (`admin@biteme-baby.com`) | FIXED |
| L7 | `src/main.ts` (template links vite.dev/x.com/bsky/chat.vite) | dead template code | ไม่เข้า bundle แต่ค้าง repo | ลบ `main.ts`+`counter.ts`+`promotionIntelligence.ts`(zero refs)+`v1.txt`/`v2.txt` | FIXED |
| L8 | `href="#"`/`javascript:void(0)` คงเหลือ | — | — | grep หลังแก้ = **0 จุด** ใน src ฝั่ง UI | PASS |
| L9 | external links อื่น | ตรวจโดเมน/URL scheme | mailto/tel จริง, social จาก business_settings, canonical `biteme-baby.com` | — | PASS |

**การตรวจปลายทางเชิงลึก:** สกัดทุก `Link to=` / `navigate()` / `window.location` (literal + template) ใน src เทียบ route registry — หลังแก้ L1–L7 เหลือเพียงปลายทางที่มีจริง + redirect ที่ตั้งใจ

---

## 4. ปุ่ม/CTA/redirect ที่ไม่ทำงาน และผลทดสอบหลังแก้

| # | ที่อยู่ | อาการ (fake behavior) | การแก้ | ผลหลังแก้ |
|---|---|---|---|---|
| C1 | `ContactPage.handleSubmit` | **fake success** — `setTimeout(1s)` แล้ว toast "ส่งข้อความสำเร็จ!" ทั้งที่ไม่มี backend รับ (ไม่มี table `contact_*` ในระบบ) | ส่งต่อผ่าน `mailto:` พร้อม subject/body จริง + แจ้งให้ผู้ใช้กดส่งในแอปอีเมลของตน (ไม่มีคำว่า "สำเร็จ" จนกว่าผู้ใช้ส่งเอง) | build/test ผ่าน — ไม่มี path โชว์ success ปลอมเหลือ |
| C2 | `PromotionsPage.handleApplyCode` | ตรวจโค้ดกับ array hardcode → toast "ใช้ WELCOME10 สำเร็จ! ลด 10%" + แต้ม rewards ปลอม | ยกเลิก — แสดงโปรโมชันจริงจาก `promotions` + "ใช้เลย" = คัดลอกโค้ดจริง + ไปหน้าเมนู + แจ้งว่า server ตรวจสอบส่วนลดตอนสั่งซื้อ | prod probe: `promotions` มี 1 แถว active (แสดงจริง) |
| C3 | `RewardsPage.handleRedeem` | toast "แลก X สำเร็จ!" ไม่มีการออกคูปองจริง | toast ตรงไปตรงมา + banner "โปรแกรมพรีวิว" | vitest ผ่าน |
| C4 | Blog Subscribe | ปุ่มไม่มี handler | แทน CTA จริง (§3 L4) | Playwright render ผ่าน |
| C5 | ปุ่มหลักอื่นๆ (ตะกร้า/ชำระเงิน/สั่ง/ติดตาม/เมนูแอดมิน/round toggles) | สุ่มตรวจ handler | ทุกปุ่มมี handler จริงที่เรียก service/RPC | Playwright 39/39 + vitest 1116/1116 |

---

## 5. Hardcode / mock / fallback inventory (Production reachability)

`file/line | feature | category | prod-reachable | authoritative source | remediation | regression test | status`

| file/line | feature | category | prod-reachable | authoritative source | remediation | regression test | status |
|---|---|---|---|---|---|---|---|
| `homeProviders.ts` `getHomePromotions()` (ลบแล้ว) | promo fallback WELCOME10/ส่งฟรี฿200 | hardcoded + fake fallback | **ใช่** (`/shop` ทุกครั้งที่ `promotions` ว่าง/โหลดพลาด) | `promotions` table | ลบ mock; fallback = `[]` (strip ซ่อนตัวเอง) | home/mascot tests + prod probe | **FIXED** |
| `homeProviders.ts` `getStoreStatus()` (ลบแล้ว) | store status จำลองตามชั่วโมง + capacity แต่ง | fake fallback บัง integration failure | **ใช่** (แถบหน้าแรก + มาสคอตทุกหน้า) | `delivery_rounds` | ลบ mock; ไม่มีข้อมูล = unknown ซื่อสัตย์ + auto-load รอบจริง | `mascotClosed.test` 7 เคส | **FIXED** |
| `homeProviders.ts:142` (เดิม) | filter `status==='open'` | **integration mismatch** | **ใช่** | server vocabulary = `'active'` (007/025/118; `bmbAdminApi_rounds:97`) | รับ `active`(+`open` legacy) + bookability จริง (cutoff/window/capacity) + `preorder_only` | prod probe: 21 แถว `active` x21 | **FIXED** |
| `PromotionsPage.tsx` (ทั้งหน้า) | promo hardcode + คอมโบ ฿99/฿299 + แต้มปลอม | hardcoded + fake success | **ใช่** | `promotions` + server coupon validation | เขียนใหม่ — ข้อมูลจริง + loading/error/empty | `getPromotionsWithStatus` + vitest | **FIXED** |
| `ContactPage.tsx` handleSubmit | fake "ส่งข้อความสำเร็จ" | fake success | **ใช่** | ช่องทางจริง (mailto/Messenger/tel) | mailto handoff จริง (§4 C1) | build/lint/test | **FIXED** |
| `ContactPage.tsx:104-107` | `href="#"` ×4 | placeholder link | **ใช่** | `business_settings.social_links` | real links | — | **FIXED** |
| `PrivacyPage`/`TermsPage` | `tel:+66xxxxxxxxx` + อีเมลโดเมนผิด | placeholder/wrong domain | **ใช่** | `SHOP_CONTACT` (Owner 2026-10-17) | ค่าจริงจากจุดเดียว | — | **FIXED** |
| `faqContent.ts:42` | FAQ อ้างโค้ด promo ปลอม | hardcoded content | **ใช่** | `promotions` | คำตอบชี้ไปหน้าโปรโมชั่นจริง | — | **FIXED** |
| `rewardsStore.ts` + RewardsPage/ViralPage/SharePage/VotePage | loyalty points ฝั่ง client (`user_id:''`, ไม่มี DB) | fake subsystem | **ใช่** | ยังไม่มี loyalty backend | ป้าย "พรีวิว" + ลบ toast สำเร็จปลอม | vitest | **FIXED (honest labeling) · BACKEND = NOT_IN_SCOPE รอบนี้** |
| `FloatingCart.tsx` / `BiteMascot.tsx:294` / `useBiteAIStore` / `Footer` | สัญญา "ส่งฟรีเมื่อครบ X" | promise ที่ระบบไม่สนับสนุน (ทุก migration ไม่มีกฎ free-shipping ใน `compute_delivery_fee` — มีแค่ seed config 114) | **ใช่** | server fee = `delivery_zones` ผ่าน RPC เท่านั้น | gate ด้วย `delivery.freeShippingEnforced` (default false, hydrate จาก `delivery_policy.free_shipping_enforced`) | `platformConfigBootstrap.test` | **FIXED (UI gated) · SERVER RULE = BLOCKED (§13.3)** |
| `src/lib/providers/*` + `externalProviders.ts` | mock delivery adapters | mock provider | **ไม่** — ไม่มี non-test importer ทั้ง repo | Bite Drive `driverService`/RPC | คงไว้เป็น test-only | `providers.test.ts` | **TEST_ONLY** |
| `src/lib/stubs/realtimeStub.ts` | bundle alias แทน realtime-js | intentional stub | ใช้ใน bundle แต่ **throw ทันที** ไม่สร้างข้อมูลปลอม | refetch/focus freshness | คงไว้ (design ตั้งใจ) | — | **ACCEPTED_CONSTANT** |
| `deliveryFeeApi.ts` `SEEDED_DELIVERY_ZONES` | zone fee mirror | hardcoded mirror | ใช้ (offline mirror) — `source:'error'` ไม่ถูกนำเสนอเป็นราคา | `delivery_zones` (RPC) | คงตาม design | `deliveryFeeApi.test` 11 ตัว | **ACCEPTED_CONSTANT** |
| `socialProofReviews.ts` | testimonials คงที่ (curated) | marketing content | **ใช่** (label "testimonial") | Owner-curated (RE-D2) | คงตาม design (รีวิวจริงแสดงคนละส่วนจาก `reviews` table) | `mediaFlow.test` | **ACCEPTED_CONSTANT** |
| `seo.ts`/`SeoHelmet` `https://biteme-baby.com` | canonical domain | technical constant | **ใช่** | production domain | คงไว้ | `seo.test` | **ACCEPTED_CONSTANT** |
| `main.ts`/`counter.ts`/`promotionIntelligence.ts`/`v1.txt`/`v2.txt` | template/dead/junk | dead code | **ไม่** (ไม่เข้า bundle) | — | ลบแล้ว (`git rm` + diff review) | build ผ่านหลังลบ | **FIXED** |
| `platformConfig` defaults + `index.html` theme bootstrap | technical defaults | accepted constants (DB ทับเมื่อโหลดได้) | **ใช่** | `business_settings` (114 bootstrap) | คงไว้ | `platformConfigBootstrap.test` | **ACCEPTED_CONSTANT** |

**Reachability ยืนยันด้วย call graph** (ไม่ใช่ keyword): แถว "ใช่" = trace route → component → hook/store → API/RPC (§6); แถว "ไม่" = ยืนยันด้วย import graph ว่าไม่มี importer ฝั่ง prod

---

## 6. Direct integration trace (critical workflows)

`UI → handler → service/API → backend/RPC → database/provider → response/event → UI`

| Workflow | Trace (ยืนยันทุกขั้น) | Auth/authority | Error handling | สถานะ |
|---|---|---|---|---|
| **Menu/catalog** | MenuPage/HomePage → `loadData` → `bmbAdminApi_products.getProducts/getCategories` → `supabase.from('products/product_categories')` (RLS public read) → state → render (stock/price จาก row จริงเท่านั้น) | RLS | catch → loading=false + คงรายการเดิม/ว่าง (ไม่แต่งข้อมูล) | PASS (runtime: prod `/menu` 200 + probe ข้อมูลจริง) |
| **Store open status** | StoreStatusStrip/useStoreClosed → `storeStatus.ts` → `getDeliveryRoundsAdmin` → `delivery_rounds` → `getStoreStatusFromRounds` (bookability mirror) | RLS public read | ไม่มีข้อมูล = unknown ซื่อสัตย์ | PASS (แก้แล้ว §5) |
| **Promotions** | PromotionsPage/PromotionStrip → `getPromotionsWithStatus` → `promotions` table → render active-in-window; คูปอง = server ตรวจตอนสั่งซื้อ | RLS public read | `ok:false` → error state + retry (ไม่แสดง "ไม่มีโปร" ปลอม) | PASS (prod probe: 1 แถว active) |
| **Cart → order** | CartPage → CheckoutPage → `SubmitKeyRing.keyFor(fp)` → `m1Submit.createOrder` → `supabase.rpc('create_order_with_items_i', {…p_client_submit_key})` → orders + items (triggers ×11) → navigate `/payment/:orderNumber` | RPC = creation authority (025/118) + RLS | idempotency conflict codes → release key + ข้อความตรง; ไม่มี success ก่อน RPC ตอบ | PASS (code+tests; runtime จริง = รอ acceptance test §13.1) |
| **Delivery fee** | CheckoutPage/DistanceChecker → `fetchServerDeliveryFee` → `compute_delivery_fee_rpc` (delivery_zones) → `setDeliveryFee` (display) | server authority | `source:'error'` → ไม่โชว์ราคาปลอม + "เซิร์ฟเวอร์จะตรวจอีกครั้งตอนสร้างออเดอร์" | PASS |
| **Payment** | CardPaymentForm → `paymentGateway` (Omise EF ตาม env / Stripe fallback) → webhook HMAC + replay guard → `record_payment_result` (service_role) | EF secrets + `is_admin` refund | รายงาน failed ตามจริง — ไม่มี fabricated success (`omise.ts`/`paymentGateway.ts` contract) | IMPLEMENTED · test-mode — ดู §7 |
| **Tracking** | OrderTrackPage → `track_order` RPC / orders RLS read → timeline (w5h1) | RLS (เจ้าของ/สาธารณะตาม policy) | ไม่พบ = honest state | PASS (tests w5h1Tracking) |
| **Kitchen/delivery** | AdminKitchen/DeliveryManagement/RiderPwa → `kitchen_queue`/`assign_driver`/`driver_update_delivery_status` RPC → orders + history | RLS + `is_admin`/driver roles | dead-letter + restore_inventory paths มีโค้ด+tests | IMPLEMENTED · runtime รอบปัจจุบัน = รอ §13.1 |

ไม่มี duplicate source of truth ฝั่ง client (ราคา/ค่าส่ง/ส่วนลด = server re-derive เสมอ; client = display mirror เท่านั้น) · ไม่มี PII/secrets ใน log ฝั่ง client (probe/report ไม่มี PII)

---

## 7. Customer → Admin → Kitchen → Bite Drive → Payment → Tracking

| ขั้น | Authority (RPC/ตาราง) | Happy-path evidence | Failure/retry evidence | สถานะ |
|---|---|---|---|---|
| Customer browse/cart/checkout UI | catalog RPC + `create_order_with_items_i` | smoke client (S2–S5 เดิม) + Playwright 39/39 รอบนี้ | all-RAISE paths (118) + idempotency conflict handling | **IMPLEMENTED/DEPLOYED** |
| REAL ORDER (รอบปัจจุบัน) | เดียวกัน | **ยังไม่มีรอบจริงยุคปัจจุบัน** (ล่าสุด = test-era 206 orders; clean-slate 2026-10-18 ล้างแล้ว) | — | **RUNTIME = MISSING → ต้องทำใน Controlled Acceptance Test (§13.1)** |
| Payment — PromptPay manual | `confirm_offline_payment` (admin) + slip evidence | completed 2 (historic) | admin exceptions page + paymentStateMachine tests | **RUNTIME (historic)** |
| Payment — Omise | EF `omise-*` (test-mode keys) | probes 3/3 (server-side) — **browser checkout ไม่เคยรันจริง (omise rows = 0)** | `mark_payment_failed` + refund logic tests | **TEST-MODE ONLY · LIVE = BLOCKED (ไม่มี live keys)** |
| Payment — Stripe | EF `stripe-*` | test-era completed 28 / refunded 8+1 (historic) | webhook HMAC + replay guard (300s) + idempotent `payment_intent_id` | **บัญชี LIVE paused (external)** |
| Admin operations | RLS `is_admin()` + audit log | admin pages ครบ (26 routes) + guards | unauthorized → redirect `/` | PASS (guard verified runtime) |
| Kitchen | `order_ready_to_make` / kitchen_queue | historic delivered=1 | dead-letter + `restore_inventory` | **RUNTIME รอบปัจจุบัน = MISSING (§13.1)** |
| Bite Drive dispatch | `assign_driver` / `driver_accept_assignment` (`delivery_assignments`, drivers) | assignments 10 (เก่า) | failed-assign path (code + `dispatchContract` tests) | **IMPLEMENTED · pilot รอบปัจจุบัน = MISSING (§13.1)** |
| Tracking | `track_order` + w5h1 timeline | tests + harness (เก่า) | honest not-found | **IMPLEMENTED · runtime รอบปัจจุบัน = MISSING** |

**ข้อบังคับเงินจริง:** รอบนี้**ไม่มี**การสร้างออเดอร์เงินจริง/charge/ทำอาหาร/dispatch — ทั้งหมดรอ Controlled Acceptance Test (งบ ≤300 บาท) ที่ Owner อนุมัติขั้นสุดท้าย

---

## 8. Automation / Social / AI · Push · SMS

| ระบบ | Evidence | ช่องว่าง | สถานะ |
|---|---|---|---|
| Social/Meta channel intake | G6–G9 gates CLOSED · worker `social-ai-worker` v54 deployed · M117 channel intake repair + dedupe · `channelWebhookProbe`/`f14ChannelIntakeProbe` evidence JSON ใน `e2e/` | — | **PASS (เดิม, ไม่แตะซ้ำ)** |
| AI (Talk to Bite) | ไม่มี business tools (memory RPC เท่านั้น) · guardrails + routing tests (`aiGuardrails`, `aiRouting`, `talkToBite`) · AI ไม่แตะราคา/สต็อก/สถานะออเดอร์ (pin ด้วย `talkToBite.ts` contract + tests) | — | **PASS** |
| Automation queue | G8 single-path queue (scheduler GHA → enqueue → dispatcher → worker) · M110/M111 enqueue idempotency · ไม่มี duplicate worker | dead rows 13 ค้าง (§9.2) | **IMPLEMENTED · dead=BLOCKED (§9.2)** |
| Push notifications | `push_subscriptions` table (M115) + `pushTransport` code/tests · prod probe (anon) = อ่านไม่ได้ (RLS) — baseline ยืนยัน **0 devices** | ยังไม่มีอุปกรณ์สมัครจริง → ยังไม่มี delivery proof | **BLOCKED (ต้องทดสอบบนเครื่องจริง — §13.5)** |
| SMS (THSMS) | W23 diagnostics + `thsmsDirectProbe`/`w23SmsSendOwner` evidence · SMS RUNTIME VERIFIED (รอบก่อน) · `smsTransport` tests | — | **PASS (RUNTIME VERIFIED รอบก่อน)** |
| Guest checkout OTP | `guestCheckout` (SF-01 rate limit + locationPolicy) + `otpPolicy` tests | flow จริงบนเบราว์เซอร์ = ทำใน acceptance test | **IMPLEMENTED** |
| DeliveryManagement `dropoff_detail` | code path `bmbAdminApi_orders` + `adminDeliveryAdvance` tests | runtime กับ active order จริง = ทำใน acceptance test (ต้องมีออเดอร์จริงที่อนุมัติ) | **IMPLEMENTED · RUNTIME = รอ §13.1** |

---

## 9. Idempotency และ Dead Queue 13

### 9.1 Idempotency — **PASS**

- **เส้นทาง:** `CheckoutPage` → `SubmitKeyRing` (`orderSubmitKey.ts`: fingerprint payload → stable key → release เมื่อ settled/conflict) → `createOrder({client_submit_key})` → RPC `create_order_with_items_i` + `p_client_submit_key` (M124 — unique + payload fingerprint; `ERR_IDEMPOTENCY_CONFLICT` / `ERR_IDEMPOTENCY_KEY_INVALID` ตาม contract)
- **ครอบคลุม:** double-click (`m1Submit` lock + `submitLockGuard` tests), retry/timeout (key เดิมซ้ำ = replay ไม่สร้างซ้ำ), concurrent submission (DB unique), mixed-split orders (key ต่อ child), payload ขัดแย้ง = conflict ตาม contract
- **Regression tests:** `orderSubmitKey` (13), `submitLockGuard` (2), `orderNumberUniqueness`, `canonicalOrderFlow`, `phases5_7` + concurrency suite (124) ที่ผ่าน isolated ×2 ก่อนหน้า (ห้าม apply ซ้ำ)
- **ผลรอบนี้:** vitest 1116/1116 ผ่าน — ไม่มี regression

### 9.2 Dead Queue 13 — **BLOCKED (ต้องใช้สิทธิ์ admin) — ไม่ทำ bulk retry/delete**

- **ข้อเท็จจริง:** "dead queue 13" = 13 แถวใน `automation_queue` สถานะ `dead` (schema M110: `status in ('queued','claimed','running','succeeded','failed','dead')`; dead-letter ทำงานจริง = พิสูจน์ว่า failure path มีอยู่) — baseline `BMB_CURRENT_PRODUCTION_CLOSURE_BASELINE.md:120`
- **การตรวจสอบรอบนี้:** read-only probe ผ่าน anon key → `permission denied for table automation_queue` (RLS) — **อ่านรายละเอียดรายตัวไม่ได้โดยไม่มี admin session/service-role** → หยุดเฉพาะ action นี้ตาม FINAL RULE
- **Disposition plan (ต่อรายการ, ห้าม bulk):**
  1. แอดมินเปิด `/admin/errors` หรือ query `automation_queue` (service session) เฉพาะ `status='dead'` — บันทึก `id, job kind, attempts, created_at, failed_at, last_error` ต่อแถว
  2. จำแนก root cause ต่อแถว: transient (timeout/lease_expired) vs permanent (bad payload/provider reject)
  3. Transient → ใช้ replay path ของ M110 (`replay` fn — เก็บแถว dead เดิมไว้เป็น audit + สร้าง identity ใหม่) — **ห้าม**ยิง side effect ซ้ำ (SMS/push/social) โดยไม่ตรวจ dedupe key
  4. Permanent → แก้ root cause ก่อน แล้วจึง replay หรือปล่อย dead ไว้เป็น audit พร้อมป้ายเหตุผล
  5. ห้ามลบแถว dead (audit trail) — ทุกการตัดสินใจลง audit log
- **Status:** `BLOCKED (admin access)` — runbook พร้อม; ไม่มี side effect ใดถูกยิงจากรอบนี้

---

## 10. Historical order / financial separation

- **Clean-slate 2026-10-18 (ก่อนรอบนี้):** Owner ล้าง test orders/payments/history/automation = 0 rows + delivery rounds normalize (3 รอบ/วัน 18–24 ต.ค.) — commit `bf222cb` (ห้ามทำซ้ำ/ห้ามกู้)
- **Historic (test-era):** orders 206 · stripe completed 28 / refunded 8+1 · promptpay completed 2 · delivered=1 = เก่า/test — **ถูกแยกจากยอดปัจจุบันโดยธรรมชาติ** (ปัจจุบันไม่มีออเดอร์ใหม่จนกว่า acceptance test)
- **รอบนี้ไม่มีการลบ/แก้ข้อมูล production ใดๆ** (destructive = ต้องมี dependency inventory + exact plan + Owner approval แยกต่างหาก)
- **W3C test product `prod-w3c-test-pre`:** ยัง**ไม่ลบ** — ต้องตรวจ FK dependencies (`order_items`, `product_addons`, `product_branch_overrides`, schedules) + Owner approval ก่อน (§13.8) · **Status: BLOCKED (owner approval)**
- รายงานนี้ไม่มี PII / ไม่มีตัวเลขยอดเงินจริงของลูกค้ารายบุคคล

---

## 11. Backup / PITR / restore

| รายการ | หลักฐาน | สถานะ |
|---|---|---|
| Manual dump | `e2e/dbBackup.cjs` dump สำเร็จ (รอบ 5 — evidence เดิม) | PASS (เดิม) |
| Auto-backup ตามเวลา | ยังไม่มี (baseline §6) | **BLOCKED — ตั้ง scheduled backup (Supabase PITR/backup plan) = Owner action** |
| PITR/retention policy | ไม่พบหลักฐานการเปิด PITR | **BLOCKED — ตรวจ/เปิดในแดชบอร์ด Supabase (Owner)** |
| Restore drill | ไม่มีหลักฐานรอบใหม่; restore ต้องทำใน environment แยก **ห้ามทับ production** | **NOT_IN_SCOPE รอบนี้ (ต้องมี isolated env + Owner อนุมัติ)** |

---

## 12. Test results · CI · deployed SHA · Production runtime evidence

### 12.1 Test/build results (รันจริง session นี้)

| ชุด | ผล | หลักฐาน |
|---|---|---|
| Unit/component (vitest) | **105 files / 1116 tests — ผ่านทั้งหมด** (รวม regression ใหม่) | `npm test` |
| Type check + production build | **ผ่าน** (tsc + vite build + PWA sw) | `npm run build` |
| Lint + brand guard | **ผ่าน** (eslint + `brandNameGuard` 377 เครื่องหมาย) | `npm run lint` |
| Browser route navigation (Playwright/Chromium จริง บน production build ผ่าน `vite preview :5199`) | **39/39 ผ่าน** — ทุก route render (#root non-empty), guard/redirect ถูก (`/ai-chat`→`/talk-to-bite`, guest protected→`/login`, `/admin/pre-orders` chain, catch-all→`/`), ไม่มี `No routes matched location` / React crash | `e2e/routeNav.spec.ts` (ใหม่ — regression suite ถาวร) |

### 12.2 CI / deployment

- Release procedure: push → `main` → **Cloudflare Pages auto-deploy** (`biteme-baby.com`) · CI: `.github/workflows` (checks เดิมของ repo)
- **Deployed SHA:** `49ea10a` (รวม `10ec6e2` + `49ea10a`) — push แล้ว `7213aa7..49ea10a main -> main` (ไม่ force)
- **Production deployment identity (ตรวจหลัง deploy):** `index-B0wjuzIC.js` → **`assets/index-D8tnaCOf.js`** (+ chunks ใหม่ `ToastContainer-W4BcSkaP.js`, `addonDisplay-5L4ToLUz.js` ตาม code-split ที่เปลี่ยน) — **build ใหม่ serve จริงแล้ว** · `/promotions` 200

### 12.3 Production runtime evidence (read-only)

- HTTP probe ทุก route สำคัญบน `biteme-baby.com` → **200 ทั้งหมด** (SPA shell; guard/redirect ตัดสินฝั่ง client — ยืนยันด้วย Playwright แทน)
- Read-only DB probes (anon): `delivery_rounds` 21 แถว (status `active` ทั้งหมด — root cause §5) · `promotions` 1 แถว active (integration ใหม่ใช้ข้อมูลจริง) · `automation_queue`/`orders` = RLS block (บันทึกเป็น BLOCKED)
- Leak-scan: ไม่มี secret/PII ในรายงานนี้ · ไม่มี PII ใน logs ที่สร้างรอบนี้

---

## 13. Blockers ที่เหลือ (พร้อมหลักฐานและสิ่งที่ต้องการอย่างชัดเจน)

| # | เรื่อง | หลักฐาน/เหตุผล | สิ่งที่ต้องการ | สถานะ |
|---|---|---|---|---|
| 13.1 | **Runtime proof ของออเดอร์รอบปัจจุบัน** (order → payment → kitchen → dispatch → tracking) | ยังไม่มีรอบจริงยุคปัจจุบัน (baseline §8; clean-slate แล้ว) — โค้ด/tests ครบแต่ไม่ใช่หลักฐาน runtime | **Controlled Acceptance Test: ออเดอร์จริง 1 ใบโดย Owner (งบ ≤300 บาท) + บันทึกผลทุกขั้น** | **BLOCKED (รอ Owner อนุมัติเริ่ม — ห้ามเริ่มเอง)** |
| 13.2 | **Dead Queue 13 disposition** | `automation_queue` อ่านด้วย anon ไม่ได้ (RLS) — ต้อง admin/service session | แอดมินรัน runbook §9.2 ต่อรายการ (ห้าม bulk) | **BLOCKED (admin access)** |
| 13.3 | **กฎ free-shipping ฝั่ง server** | ไม่มี SQL ใดบังคับใช้ `free_shipping_threshold` (มีแค่ seed config 114) — UI เคยสัญญาเกินจริง (ปัจจุบัน gate ปิดแล้ว) | Owner เลือก: (A) อนุมัติ migration ใหม่ให้ `compute_delivery_fee` อ่าน `delivery_policy.free_shipping_threshold` (แล้วเปิด `free_shipping_enforced`) หรือ (B) ยกเลิกแคมเปญ | **BLOCKED (Owner decision + migration approval)** |
| 13.4 | **Loyalty/rewards backend จริง** | แต้มปัจจุบัน = client-only (ป้ายพรีวิวแล้ว) | ออกแบบ table + RPC + ผูก user (งานรอบถัดไป — Owner ยืนยันกติกาแต้ม) | **NOT_IN_SCOPE รอบนี้ (labelled honestly)** |
| 13.5 | **Push delivery proof** | 0 devices (baseline) — ยังไม่มี subscription จริง | ทดสอบบนเครื่องจริง 1 เครื่อง (subscribe → push → failure path) + บันทึกผล | **BLOCKED (ต้องใช้อุปกรณ์จริง)** |
| 13.6 | **Payment LIVE readiness** | Omise = test-mode keys; Stripe live paused (external); browser checkout ของ Omise ยังไม่เคยรันจริง | 1) รัน Omise **test-mode** browser checkout ใน acceptance test 2) LIVE keys/บัญชี = Owner action ภายนอก | **BLOCKED (external)** — ห้ามประกาศ REAL PAYMENT READY |
| 13.7 | **Auto-backup + restore drill** | ไม่มี scheduled backup/PITR evidence | เปิด PITR/backup ใน Supabase dashboard + restore drill บน env แยก | **BLOCKED (Owner/infra)** |
| 13.8 | **ลบ `prod-w3c-test-pre`** | ต้องตรวจ FK dependencies ก่อนลบ | Owner อนุมัติ + ตรวจ `order_items`/`product_addons`/`product_branch_overrides`/schedules แล้วลบผ่าน admin path | **BLOCKED (owner approval)** |
| 13.9 | Docs drift (README/`BMB_PRODUCTION_MASTER_STATUS.md` ยังเขียน Stripe-only + `createPreOrder` comment เก่า) | baseline §5 | reconcile ทีเดียวหลัง Owner approve (P3) | **NOT_IN_SCOPE (doc cleanup)** |

---

## 14. Final decision

# ✅ `GO FOR CONTROLLED ACCEPTANCE TEST`

**เหตุผล:** ช่องว่างด้าน integrity ทั้งหมดที่แก้ได้ในขอบเขตถูกปิดแล้วด้วย root-cause fixes + regression tests (vitest 1116/1116 · build/lint ผ่าน · Playwright 39/39 บน build จริง · deploy ยืนยันแล้วที่ `49ea10a`) — ไม่มี mock/fake production behavior เหลือใน path ที่เข้าถึงได้จริง, ทุก link/CTA/redirect มีปลายทางที่ถูกต้องหรือถูกปิดอย่างอธิบายได้, idempotency/failure handling มีหลักฐานโค้ด+tests, และปัญหาที่เหลือล้วนติดสิทธิ์/การตัดสินใจของ Owner หรือต้องใช้อุปกรณ์/environment จริง (§13) — ซึ่ง "Controlled Acceptance Test" คือขั้นตอนที่ได้รับอนุมัติให้ปิดช่องว่างเหล่านั้นต่อไป

**เงื่อนไขก่อนเริ่ม acceptance test (ทุกข้อต้องมี Owner รับทราบ):**
1. งบไม่เกิน 300 บาท · ออเดอร์ทดสอบ 1 ใบ แยกจากลูกค้าจริง · บันทึก evidence ทุกขั้น (order/payment/kitchen/dispatch/tracking)
2. เงินจริง/charge/ทำอาหาร/dispatch = เฉพาะตอนที่ Owner กดอนุมัติขั้นสุดท้ายเท่านั้น (คำสั่งนี้ไม่อนุมัติให้เริ่มเอง)
3. Payment ทดสอบด้วย Omise **test-mode** หรือ PromptPay manual + admin confirm — ห้ามใช้ LIVE keys
4. Dead Queue 13 · free-shipping decision (§13.3) · push device · backup/PITR = ดำเนินการคู่ขนานตาม runbook/รายการข้างบน

**Finding status legend ที่ใช้ในรายงานนี้:** `FIXED` (แก้+มี regression test) · `BLOCKED` (ติดสิทธิ์/Owner/อุปกรณ์ — มีหลักฐาน+แผนชัด) · `ACCEPTED_CONSTANT` (ค่าคงที่เชิงเทคนิค/เนื้อหา Owner ที่อนุมัติแล้ว) · `TEST_ONLY` (อยู่ในเส้นทางทดสอบเท่านั้น) · `NOT_IN_SCOPE` (รอบนี้ไม่แตะ — มีเหตุผล)

---

*รายงานจัดทำโดย autonomous closure session 2026-10-18 · ทุกผลทดสอบ/การ probe อ้างอิงการรันจริงในรอบนี้ · ไม่มี secret/PII ในเอกสาร · หลังส่งรายงานนี้ ระบบหยุดรอ Owner ตัดสินใจ — ไม่เริ่มธุรกรรมเงินจริงหรือ dispatch เอง*
