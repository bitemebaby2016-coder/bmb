# PWA CANONICAL ORDER CONSUMER AUDIT — PHASE 3B · GATE A

- **Project:** Bite Me Baby (customer PWA)
- **Baseline:** commit `a9ab8cd` (Phase 3A shipped: migration 028 + contracts_028 PASS local & production)
- **Audit date:** 2026-09-22
- **Method:** full read of every consumer surface in `src/` (pages, lib, stores, components) against canonical backend migrations **023–028** (read directly from `supabase/migrations/`) and contract suites `e2e/contracts_023_order_spine.sql` / `e2e/contracts_028_payment_confirmation_kitchen.sql` (PASS, local + production).
- **Mode of this document:** GATE A output per implementation-command §20. **No implementation was performed.**

---

## 0. EXECUTIVE VERDICT

**The canonical backend exists and is contract-proven. The customer PWA does not consume it.**

| Layer | State | Evidence |
|:--|:--|:--|
| DB domain (023) | ✅ LIVE | `orders.order_mode` ('SAME_DAY'/'PRE_ORDER' enum) + `orders.scheduled_date` (backfilled from rounds); `products.available_same_day` / `available_preorder` (+ `is_preorder` kept as **one-directional alias** synced by trigger `products_sync_mode_alias`); `production_batch_items.order_mode`; `business_settings 'order_policy'` = `{"max_items_per_order":20,"pre_order_lead_days":1,"cancel_window_minutes":5}` |
| Round lifecycle (024) | ✅ LIVE | Canonical cutoffs 08:00/10:30/16:00 (Asia/Bangkok); `order_setting()`; `ensure_rounds_for_date(date)` → **deterministic round ids `round-YYYYMMDD-<key>`**; legacy `pre_orders` rows **migrated into `orders`** (PO- numbers preserved); `pre_orders` now a **read-only archive** (anon DENY, auth own-SELECT, admin SELECT, no writes) |
| Canonical RPC (025) | ✅ LIVE | `create_order_with_items` **v3 — 14 params incl. `p_order_mode`, `p_scheduled_date`**: auth → mode validate → round `FOR UPDATE` must be `active` → SAME_DAY: round date must be today + cutoff not passed; PRE_ORDER: scheduled_date required, `> today`, `>= order_setting('pre_order_lead_days',1)`, must equal round date → capacity check → product mode gate **both directions** (`ERR_PRODUCT_MODE_NOT_ALLOWED`) → add-on price server-derived → D-1 qty cap → SAME_DAY advisory inventory guard → promotion from table → delivery fee server-derived from coords → INSERT orders (status `pending`, payment_status `pending`) + order_items (authoritative unit_price) → audit → returns authoritative jsonb. **`cancel_order(p_order_number, p_reason)`** (owner: pending-only inside D-5 window; admin: any non-delivered; idempotent; capacity release via trigger; inventory restore; cancels `delivery_assignments`; **cancel ≠ refund** — refund stays admin `stripe-refund` EF). Capacity-release trigger `release_round_capacity_on_terminal` (payment failure keeps the slot). Legacy pre-order RPCs are **shims**: `create_pre_order_with_items` → delegates to canonical (mode PRE_ORDER), `cancel_pre_order` → routes migrated rows to `cancel_order` |
| Inventory aggregate (026) / Kitchen (027) | ✅ LIVE | `create_production_batch(p_delivery_round_id, p_scheduled_date, p_order_mode)` — canonical source = `orders` + `order_items` (both modes; PRE_ORDER reaches the kitchen) |
| Operational guarantees (028) | ✅ LIVE | `confirmed ⇒ inventory deducted` DB invariant; batch idempotency (no order twice); round-template hardening |
| Contract suites | ✅ PASS | contracts_023 T1–T20 (mode gate both ways, cutoff before/exactly/after, capacity create/full/cancel/idempotent-cancel/corruption, inventory, payment amount-match + COD-on-PRE_ORDER, kitchen both modes, delivery tier + **forged client distance**, migration consistency) · contracts_028 T1–T20 — **local + production** |

**Customer PWA reality (all verified in code, citations in §1–§8):**

1. PWA still depends on `pre_orders` (read path) and on the legacy RPC `create_pre_order_with_items` (write path) — §24 #1/#2 evidence.
2. Tracking (`/track/:orderNumber`) is a **100% client-side simulation** — `useState('preparing')` + `setInterval` that "advances" hardcoded statuses every 30 s, hardcoded items/total/round/date — reads **nothing** from the DB — §24 #5 evidence.
3. Checkout round mapping is **hardcoded `{morning:'round-1', midday:'round-2', evening:'round-3'}`** — wrong after migration 024 (real ids are `round-YYYYMMDD-<key>`); same-day checkout would fail with `ERR_ROUND_NOT_FOUND` on any date other than the seed date.
4. Delivery provider/tier/fee are **client-computed** (`externalProviders` hardcoded fees, `min_distance_km = 1`) and **gate** the place-order button; the server-fee API (`compute_delivery_fee_rpc`) exists but is unused by checkout.
5. PRE_ORDER has **no customer flow**: no date picker, no round picker, no address, **no payment**, hardcoded `today + 3 days` lead, then jumps straight to the fake tracking page.
6. No customer cancellation UI exists at all.
7. No payment-retry UI exists; `credit_card` (Stripe) is fully wired in the backend but unreachable in the UI.

**No backend weakening is required** (§24 #10 not triggered). One **additive** enabler is proposed for owner decision (§8): `GRANT EXECUTE ON FUNCTION public.ensure_rounds_for_date(date) TO authenticated;` so the PRE_ORDER date picker can instantiate rounds server-side (exactly what the legacy shim does internally today).

Proceed to implementation per §10 after owner confirmation of the single decision in §8-D.

## 1. LEGACY CONSUMERS

### 1.1 `pre_orders` table consumers (every occurrence in customer code)

| # | file · function | current behavior | new canonical replacement | risk | action |
|:--|:--|:--|:--|:--|:--|
| L1 | `src/lib/preOrderService.ts` · `getPreOrders()` | `SELECT * FROM pre_orders` + **merges localStorage fallback `bmb_pre_orders`** (fake/local rows can appear as orders) | read `orders` (RLS own; PRE_ORDER rows included via `order_mode`) | 🔴 duplicate/ghost orders | MIGRATE (then DELETE fallback) |
| L2 | `src/pages/OrdersPage.tsx` · `load()` → `getPreOrders({customerId})` | renders a separate "📅 การจองล่วงหน้า" section sourced from the archive table | single canonical list from `orders` | 🔴 every migrated pre-order now shows **twice** (archive + canonical, same PO- number) | MIGRATE |
| L3 | `src/lib/preOrderService.ts` · `createPreOrder()` | RPC `create_pre_order_with_items` — **today this is a shim that lands a canonical `orders` row**, but the PWA then treats the result as a `PreOrder` and caches it in localStorage | call `create_order_with_items` with `p_order_mode='PRE_ORDER'`, `p_scheduled_date`, `p_delivery_round_id` directly | 🟠 new PWA must not call the legacy shim (§3 of brief) | MIGRATE |
| L4 | `src/lib/preOrderService.ts` · `cancelPreOrder()` | RPC `cancel_pre_order` (routes to `cancel_order` for migrated rows) | call `cancel_order` directly | 🟡 | MIGRATE |
| L5 | `src/lib/preOrderService.ts` · `updatePreOrderStatus()` | **direct `UPDATE pre_orders SET status…`** from the client (client-authoritative status mutation attempt) | none — archive is frozen; canonical transitions only via server RPCs | 🟠 dead + conceptually client-authoritative | DELETE |
| L6 | `src/lib/preOrderService.ts` · `getPreOrderStats()` | aggregates over archive rows | admin reporting reads `orders` (`order_mode`) | 🟡 unused by customer flow (verified: no importer) | DEPRECATE |
| L7 | `src/lib/preOrderService.ts` · `validatePreOrder()` | client-only checks: `product.is_preorder`, round chosen, "date in future" — **no lead time, client authority** | preflight display from `order_policy` (lead days); server 025 enforces (`ERR_LEAD_TIME`, `ERR_PRODUCT_MODE_NOT_ALLOWED`) | 🟡 | MIGRATE |
| L8 | `src/lib/preOrderService.ts` · `getPreOrderRounds(date)` | reads `delivery_rounds` for a date (correct source, legacy shape) | rounds API in §10 Wave 1 (`listRoundsForDate`) | 🟢 source already DB | KEEP (absorb) |

| L9 | `src/lib/preOrderService.ts` · types `PreOrder`/`PreOrderStatus`, storage key `bmb_pre_orders` | legacy island vocabulary + localStorage island | canonical `OrderForm` + `orderVocabulary` | 🟡 | DELETE after migration |
| L10 | `src/pages/HomePage.tsx` · `handlePreOrder()` | direct `createPreOrder` with **no login guard, no date/round picker** (`FoodMenuCard` sends `deliveryRoundId:''`), fallback `product.scheduled_date` or **hardcoded `today+3`** (`defaultPreorderDate()`), **hardcoded kitchen coords as delivery coords** (`10.7016,102.1429`), empty address → toast → `navigate('/track/PO-…')` | mode-aware builder → canonical checkout (`?mode=PRE_ORDER`) | 🔴 no payment, no address, no real scheduling | MIGRATE |
| L11 | `src/pages/MenuPage.tsx` · `handlePreOrder()` | same as L10 + resolves round only for the toast text | same as L10 | 🔴 | MIGRATE |
| L12 | `src/components/FoodMenuCard.tsx` · `handlePreOrder` + JSX | **pre-order button rendered unconditionally** (even on same-day cards), payload always `deliveryRoundId:'', scheduledDate:''`; not gated by `available_preorder` | gate on `available_preorder` (+ `is_available`); SAME_DAY-only products must NOT offer pre-order | 🟠 UX promises what server rejects | MIGRATE |
| L13 | `src/lib/homeProviders.ts` · product split (`if (p.is_preorder)`) · `src/pages/MenuPage.tsx` tab filter · `src/components/home/ReviewCarouselSection.tsx` (`mode = product.is_preorder ? …`) | UI mode derived from deprecated alias `is_preorder` | `available_same_day` / `available_preorder` (the one-way alias trigger keeps these alive meanwhile — migration 023 names exactly these consumers) | 🟡 display-only today | MIGRATE |
| L14 | `src/lib/bmbAdminApi_products.ts` · `getSameDayProducts()` / `getPreorderProducts()` (`.eq('is_preorder', …)`) | product queries on the deprecated alias | `.eq('available_same_day'/'available_preorder', …)` | 🟡 | MIGRATE |

### 1.2 Legacy-logic sweep required by §2 of the brief

| Pattern searched | Occurrences in customer PWA | Classification |
|:--|:--|:--|
| `pre_orders` (table) | L1, L2, L5, L6, L9 | per-table above |
| `is_preorder` (UI authority) | L12, L13, L14, `HomePage.handleReviewCta`, `MenuPage` mode const | MIGRATE to canonical flags |
| hardcoded order status | `OrderTrackPage` `statusSteps` + `useState('preparing')` | DELETE (§4) |
| hardcoded tracking timers | `OrderTrackPage` `setInterval(…30000)` advancing status + toast | DELETE (§4) |
| client-only cutoff | `defaultPreorderDate()` = today+3 (HomePage, MenuPage); **no** cutoff display at all in checkout | MIGRATE |
| client-only delivery distance | `externalProviders.getBestProvider/calculateProviderCost` (client haversine, `min_distance_km: 1` on grab/lineman) + `deliveryRouter`/`platformConfig` (5 km tier, flat 25) | MIGRATE (§5) |
| client-only price | `cartStore.recalculate` (subtotal/discount/total), `OrderBuilderModal.addOnTotal/grandTotal` (mirror of 016 math), `FoodMenuCard`/`HomeProductCard` price text | KEEP **DISPLAY ONLY** (verified never submitted) |
| client-only delivery fee | `CheckoutPage` effect → `useCartStore.setState({ deliveryFee: providerCost, total: … })` | MIGRATE (§5) |
| payment success assumptions / fake paid | none found (P0-5 held): no `?success=true`, no localStorage paid flag; `isPaid` strictly from `order.payment_status` | KEEP (guard with tests, Wave 10) |
| hardcoded round keys | `CheckoutPage:97` `({ morning:'round-1', midday:'round-2', evening:'round-3' })[selectedRound] ‖ selectedRound` | 🔴 CRITICAL — DELETE (§5) |
| hardcoded `distance_km: 0` | `CheckoutPage:105` (legacy; server derives from dropoff coords — contracts_023 T18 proves forged distance is ignored) | cleanup |

## 2. CANONICAL CONSUMERS (already correct — KEEP)

| # | file · symbol | behavior | verdict |
|:--|:--|:--|:--|
| C1 | `src/lib/bmbAdminApi_orders.ts` · `createOrder()` | `OrderInput` has **no price fields** (comment: "intentionally NO price/subtotal/discount/delivery_fee/total_amount"); payload keys match the 025-v3 RPC exactly (`p_items … p_distance_km`); returns authoritative `OrderResult` | KEEP + **extend** with `p_order_mode` / `p_scheduled_date` (Wave 1) |
| C2 | `src/lib/paymentGateway.ts` | server-authoritative contract (EF `create-checkout`; `create_payment_intent_record` with server amount-match; `submit_offline_payment_reference`; `confirm_offline_payment`; `mark_payment_failed`; refund client-call blocked) | KEEP |
| C3 | `src/pages/PaymentConfirmationPage.tsx` | reads order + intents from DB; PromptPay TXN submit only (`pending→processing`, "the client cannot mark paid"); COD panel = collected at door; `isPaid` only from server `payment_status` | KEEP + retry/intent-selection/polling additions (Wave 8) |
| C4 | `src/components/order/OrderBuilderModal.tsx` + `src/store/orderBuilderStore.ts` | add-on estimate mirrors 016 math **display-only**; submits ids/choices only | KEEP |
| C5 | `src/lib/orderVocabulary.ts` | canonical server↔client↔provider status maps (PAY-04), mode-aware (`serverToClientStatus(server, mode)`) | KEEP — `OrderTrackPage` must adopt it (Wave 7) |
| C6 | `src/components/delivery/DistanceChecker.tsx` + `src/lib/deliveryRouter.ts` | two-tier **display** panel ("additive informational panel" per its own comment in CheckoutPage) | KEEP as display; feed numbers from `fetchServerDeliveryFee` (Wave 4) |
| C7 | `src/lib/deliveryFeeApi.ts` · `fetchServerDeliveryFee()` | wraps RPC `compute_delivery_fee_rpc` (020) with a local mirror fallback | **MIGRATE**: exists but unused by checkout — wire in (Wave 4) |
| C8 | `src/store/cartStore.ts` · `addItem` | client unit estimate documented as display-only ("server re-derives, migration 016") | KEEP + mode-lock port (Wave 3) |
| C9 | `src/store/authStore.ts` + `src/lib/supabase.ts` | identity = Supabase Auth (JWT); role from `profiles` via RLS; no localStorage identity | KEEP |
| C10 | `src/lib/bmbAdminApi_orders.ts` · `getOrders/getOrder/getOrdersByCustomer` + `hydrateOrderItems` | orders + order_items read via RLS-own | KEEP + surface `order_mode`/`scheduled_date` (Wave 6) |
| C11 | `bmbAdminApi_orders.updateOrderStatus` → RPC `transition_order_status` | server-side allow-list + guard trigger + 028 deduct invariant (admin path) | KEEP (out of customer scope) |
| C12 | `src/lib/kitchenService.ts` | wraps 019/027/028 admin kitchen RPCs (`create_production_batch` requires `is_admin()`); **not imported by any customer page** (verified) | KEEP |

## 3. PRE_ORDER CONSUMERS (§16 routing verdict included)

- **No separate PRE_ORDER route/page exists.** The only route surface is `/checkout` (+ deep-link `?mode=pre-order` read at `CheckoutPage:23` as `deepLinkMode`, used **only** to show a static banner at lines 196–203 — `handlePlaceOrder` ignores it and always creates a SAME_DAY `BMB-` order with the hardcoded round mapping). Nothing to delete; per the brief the preferred shape is exactly what exists: **`/checkout?mode=SAME_DAY` | `/checkout?mode=PRE_ORDER`** made mode-aware.
- `HomePage.handlePreOrder` / `MenuPage.handlePreOrder` / `FoodMenuCard.handlePreOrder` / `HomeProductCard.handleCta` are the four pre-order entry points (§1.1 L10–L13). They bypass cart + address + payment entirely and jump to `/track/PO-…` (the fake page).
- `preOrderService` (L1–L9) is the only pre-order data layer.
- **Kitchen reachability (§24 #9):** backend already supports it — `create_production_batch` batches from `orders` for both modes (027), and 024 migrated all legacy `pre_orders` rows into `orders` with `order_mode='PRE_ORDER'` (T19 consistency PASS). Once the PWA creates PRE_ORDER through the canonical RPC (Wave 5), pre-orders reach the canonical kitchen automatically. Live verification in §22 will prove it.
- **Cart isolation engine (`src/stores/useCartStore.ts` + `CartIsolationModal`)** exists with SAME_DAY/PRE_ORDER locking and is mounted globally in `Layout` — **but the live order path uses the other store** (`src/store/cartStore.ts`), so the isolation modal never triggers. Two parallel carts = the §16 "avoid duplicate checkout implementations" hazard, resolved in Wave 3.

## 4. TRACKING SIMULATION CONSUMERS (§12 — CRITICAL)

- **`src/pages/OrderTrackPage.tsx` = 100% simulation.** Evidence (full file read):
  - `const [orderStatus, setOrderStatus] = useState('preparing')` — fake initial status;
  - `useEffect` → `const interval = setInterval(() => { … setOrderStatus(statusSteps[currentIndex + 1].key); showToast(…) }, 30000)` — **the page advances its own lifecycle on a timer**;
  - hardcoded `statusSteps` chain (pending → confirmed → preparing → ready_for_dispatch → dispatched → delivered);
  - order details are literals: order date = `new Date()` (always today), round = `รอบเช้า`, items = `ผัดไทย x2, ข้าวแกง x1`, total = `230 บาท`, ETA = `'15 นาที'`;
  - **zero DB reads** — not even `getOrder`.
  - → **REWRITE (Wave 7):** GET/READ `orders` (+ items, latest `payment_intents` status, `delivery_assignments` status) → render via `orderVocabulary` → poll/refresh only. The UI must never mutate the lifecycle.
- `src/components/dashboard/RiderPWA.tsx` — rider demo on the public `/rider` route calls `transition('Delivered')` on the **client-only** state machine (no DB write, no supabase import). Not part of the customer flow; flagged: never wire it to the DB without server authority. KEEP (demo) / out of scope.
- `src/stores/useOrderStateMachine.ts` + `src/lib/orderStateMachine.ts` — client state-machine engine used by `AdminControlPage` (admin advance → `updateOrderStatus` → RPC `transition_order_status`) and `CustomerTimeline` (display). KEEP; the **new tracking page must NOT use the advance()/transition() path** — read-only.
- `src/components/ai/BiteMascot.tsx` — `setInterval` micro-hook keyed on section id `'pre-order'` (cosmetic nudge timer). KEEP (no order state).

## 5. CLIENT-AUTHORITY BUSINESS LOGIC (§7 price / §8 distance)

**Price (§7):**
- `src/store/cartStore.ts` `recalculate()` — client `subtotal/discount/total` (promotion math included). **Classified DISPLAY ONLY:** `createOrder(OrderInput)` has no price fields and 025 recomputes everything; verified `CheckoutPage` sends only items/round/method/address/coords/customer/payment/distance.
- Gap (not a violation, a bug): the cart's `discount` is fake — `appliedPromotion` is never set (CartPage coupon button shows a toast only) and `promotion_code` is never sent to the RPC → server-side promotions are unreachable. Wave 4 wires `promotion_code`; display totals become server-derived after create.
- `OrderBuilderModal` totals + `FoodMenuCard`/`HomeProductCard`/`CartPage` price text — display-only, mirror math documented. KEEP.

**Distance / tier / fee (§8):**
- `src/lib/externalProviders.ts` — `DEFAULT_PROVIDERS` with hardcoded `base_fee/per_km_fee/min_distance_km/max_distance_km` (grab & lineman `min_distance_km: 1`; foodpanda 0–5 km) + client haversine. `CheckoutPage` effect picks "best provider" and **disables the place-order button until a client provider is chosen** (`disabled={isProcessing || !selectedProvider}`) — client-authoritative validity.
- Server reality (025 + contracts_023 T18): fee/tier derive from dropoff coords server-side; forged client distance is ignored; `self_delivery` is always valid. The known historical `min_distance_km = 1` must not block <1 km customers — with `self_delivery` default it doesn't; the client gate must go.
- `DistanceChecker` panel + `platformConfig` (5 km / ฿25 / 12%) — display-only defaults; keep as display, numbers from `fetchServerDeliveryFee`.
- `CheckoutPage:105 distance_km: 0` — legacy constant; harmless (coords authoritative) but removed for clarity.

**Cutoffs / capacity (§5/§6):**
- No cutoff display in checkout at all; `defaultPreorderDate()` today+3 contradicts server lead `pre_order_lead_days = 1`. Server is authority (`ERR_CUTOFF_PASSED`, `ERR_LEAD_TIME`, `ERR_CAPACITY_FULL`, `ERR_ROUND_CLOSED`); UI must display round cutoff + capacity state from `delivery_rounds` and surface server error codes verbatim.

## 6. PAYMENT CONSUMERS (§9 COD / PromptPay / Stripe, §10 retry)

| Surface | Current state | Required change |
|:--|:--|:--|
| Method picker (`CheckoutPage` radio) | only `promptpay_qr` / `cash_on_delivery` | KEEP both; add `credit_card` when Stripe keys are configured (backend EF `create-checkout` + `stripe-webhook` are live and contract-tested) |
| COD (§9) | order → COD selected → `payment_status='pending'` from RPC → confirmation page says "เงินจะถูกเก็บตอนส่งของ"; `confirm_offline_payment` requires `delivered` server-side; **never displays Paid for COD** | KEEP (guard with test) |
| PromptPay (§9) | TXN submit → `submit_offline_payment_reference` (pending→processing) → kitchen/admin confirms; `isPaid` only from server | KEEP + failed-state display + retry (Wave 8) |
| Stripe (§9) | `paymentGateway.createCheckout` → EF (server-derived amount) → webhook `record_payment_result`; **client never marks paid; no `?success=true`/localStorage trust found** | UI unreachable today — surface option; after confirm, state read from server only |
| Retry (§10) | **No retry UI exists.** `PaymentConfirmationPage` grabs `intents[0]` (newest by `created_at desc`) without filtering to a pending/processing intent — with retries this can show a stale intent; no failed display; no "same order, new attempt" path; page loads order once (no polling) | Wave 8: select active intent (`pending`/`processing`), show `failed` + Retry → `createPaymentIntent(order.order_number, …)` for the **same order** (no second order, no cart touch, no assumption the first intent is current); poll order/intent state every ~20 s |
| Fake-paid audit | none found in customer UI (P0-5 held) | regression tests in Wave 10 |

## 7. CANCELLATION CONSUMERS (§13)

- **No customer cancel UI exists** — verified across `OrdersPage`, `OrderTrackPage`, `ProfilePage` (only TermsPage text mentions a 5-minute window). Today a customer cannot cancel anything from the PWA.
- Legacy path `preOrderService.cancelPreOrder` → `cancel_pre_order` (025 shim routes migrated rows to `cancel_order`) — new code must call **`cancel_order(p_order_number, p_reason)`** directly (GRANT `authenticated` ✓).
- Canonical rules the UI must honor (025 cancel_order body):
  - **owner:** only `status = 'pending'`, only inside `cancel_window_minutes` (D-5, seeded 5), and for PRE_ORDER additionally `scheduled_date > today` (Bangkok) → `ERR_CANCEL_WINDOW_PASSED` surfaced as a readable message;
  - **idempotent:** cancelling an already-cancelled order returns `ok/idempotent` (no error);
  - **capacity** released by trigger; **inventory** restored only if the order had reached confirmed/preparing; **delivery assignment** cancelled if any;
  - **cancelled ≠ refunded:** `cancel_order` does NOT touch `payment_status`; for a paid order it returns a note that refund is an admin follow-up via the `stripe-refund` EF. UI rule: a paid cancelled order shows "ยกเลิก — รอดำเนินการคืนเงิน" and only becomes "คืนเงินแล้ว" when `payment_status = 'refund'` (set by the admin refund EF). NEVER show refunded for a plain cancel.
- `transition_order_status` also permits owner `pending→cancelled` (008 allow-list) — `cancel_order` is preferred (single transaction incl. assignment cancel + window policy).

## 8. RLS / SECURITY FINDINGS (§17)

| Check | Result | Evidence |
|:--|:--|:--|
| Customer A reads B's order | ✅ blocked | 006 `orders_own_read USING (customer_ref = auth.uid() OR is_admin())`; anon SELECT only `delivered/cancelled` (007-era `customer_phone = auth.email()` policy superseded by 006) |
| Customer A cancels B's order | ✅ blocked | `cancel_order` authz (`ERR_FORBIDDEN` unless admin/owner) + window rules |
| Customer A reads B's payment | ✅ blocked | `payment_intents` anon DENY / auth own (005/006); `PaymentConfirmationPage` loads intents per own order number only |
| Customer writes `price / payment_status / order status / delivery fee` directly | ✅ blocked | 006 `orders_own_update USING (false)` — customers can never UPDATE orders rows via SQL; status changes only via RPCs (guard trigger + allow-list + 028 confirmed⇒deducted invariant); money fields written only by SECURITY DEFINER RPCs |
| Customer calls `create_production_batch` | ✅ blocked | 027/028 require `is_admin()`; `kitchenService` not imported by customer pages |
| AI order access (`aiToolCalling.get_order`) | ✅ RLS-bound | same `getOrder` read path → own rows only; no mutation tools registered |
| `pre_orders` archive | ✅ frozen | 024: anon DENY, auth own-SELECT, admin SELECT; no write policies; `migrated_order_id` traceability |
| Profiles escalation | ✅ guarded | 014 `guard_profile_mutation` (role/is_active/id) |

**Gaps requiring owner decision (additive, non-weakening):**

- **§8-D1 (needed for the §5 date picker):** `ensure_rounds_for_date(date)` has **no EXECUTE grant to `authenticated`** in 024 (only `order_setting` was revoked from PUBLIC/anon; no grant list). The legacy shim calls it internally (SECURITY DEFINER), but the canonical checkout cannot instantiate a future date's rounds from the UI. Proposal: `GRANT EXECUTE ON FUNCTION public.ensure_rounds_for_date(date) TO authenticated;` — the function is `SECURITY DEFINER` with strict validation (ERR_MISSING_DATE/ERR_DATE_IN_PAST, deterministic ids, template validation hardened in 028); granting it exposes exactly the action the shim already performs on behalf of a customer today. Alternative (no grant): the UI lists only dates that already have active rounds — worse UX and can strand the customer on `ERR_ROUND_NOT_FOUND`. **This is the only backend touch in Phase 3B.**
- **§8-D2 (display-only):** reading `business_settings 'order_policy'` from the customer UI (lead days / cancel window for display). If the table's read policy is admin-only, the UI keeps server defaults (`order_setting` fallback 1 day / 5 min) and relies on server error codes; verify the policy during implementation before deciding.

## 9. KEEP / MIGRATE / DEPRECATE / DELETE MAP (consolidated)

| Verdict | Items |
|:--|:--|
| **KEEP** | `bmbAdminApi_orders.createOrder/getOrder(s)` (extend fields) · `paymentGateway` (all RPC wrappers) · `PaymentConfirmationPage` core (server-state reads, TXN submit, COD panel) · `OrderBuilderModal/orderBuilderStore` (display-only estimates) · `orderVocabulary` (adopt into track) · `DistanceChecker` panel (display) · `cartStore.addItem` estimate (display-only) · `authStore` · `kitchenService` (admin) · `useOrderStateMachine/orderStateMachine` (admin/display only) · `RiderPWA` (client-only demo; never DB-wired) · routes `/checkout`, `/track/:orderNumber`, `/payment/:orderNumber`, `/orders` (no new PRE_ORDER route) |
| **MIGRATE** | `preOrderService.createPreOrder` → `create_order_with_items(mode)` · `cancelPreOrder` → `cancel_order` · `getPreOrders` → orders read · `OrdersPage` pre-orders section → one canonical list · `HomePage/MenuPage handlePreOrder` → mode-aware checkout · `FoodMenuCard/HomeProductCard/ReviewCarouselSection/homeProviders/bmbAdminApi_products` `is_preorder` → `available_same_day/available_preorder` · `CheckoutPage` hardcoded round map → `listRoundsForDate(today)` · client provider gate/fee → server quote (`fetchServerDeliveryFee`) + `self_delivery` default · `validatePreOrder` → settings-driven preflight · `preOrderService.getPreOrderRounds` → orderApi rounds reader · `/profile/orders` dead link → `/orders` · `PaymentConfirmationPage` intent selection → active-intent filter + retry + polling |
| **DEPRECATE** | `preOrderService.getPreOrderStats` (no customer importer) · `PRE_ORDER_STATUS_LABEL` legacy vocabulary in `OrdersPage` · `deepLinkMode` banner-only behavior (becomes real mode state) · client "best provider" selection UI (demoted to display/log) |
| **DELETE** | `OrderTrackPage` simulation (setInterval/statusSteps/hardcoded literals/`useState('preparing')`) · `preOrderService.updatePreOrderStatus` · localStorage fallbacks (`bmb_pre_orders` merge) · `CheckoutPage` hardcoded round map + `distance_km: 0` · `defaultPreorderDate()` (today+3) after settings-driven default lands · duplicate `stores/useCartStore` order-path logic after port (keep as test-facing shim) |

## 10. EXACT IMPLEMENTATION PLAN (ordered; frontend-only except §8-D1)

**Wave 1 — Canonical order API layer (foundation)**
1. New `src/lib/orderApi.ts` (or extend `bmbAdminApi_orders.ts`):
   - `createCanonicalOrder(input: CanonicalOrderInput)` → RPC `create_order_with_items` with **all 14 params incl. `p_order_mode`, `p_scheduled_date`** (no price fields ever);
   - `cancelOrder(orderNumber, reason)` → RPC `cancel_order`;
   - `listRoundsForDate(date)` → (pending §8-D1) `ensure_rounds_for_date(date)` then `SELECT delivery_rounds WHERE scheduled_date = date AND status='active' ORDER BY delivery_start` — returns id, display_name, cutoff_time, delivery_start/end, max/current capacity;
   - `quoteDeliveryFee(params)` → thin wrapper over `fetchServerDeliveryFee`;
   - mode vocabulary: `'SAME_DAY' | 'PRE_ORDER'` (align with `platformConfig.OrderMode`; kill the `'same-day' | 'pre-order'` lowercase union in `src/types/index.ts:532` usage on order paths).
2. Extend `OrderForm`/hydration to surface `order_mode`, `scheduled_date`, round display name.

**Wave 2 — Product mode (§4)**
3. `bmbAdminApi_products`: read/return `available_same_day` + `available_preorder`; `getSameDayProducts/getPreorderProducts` switch to canonical columns (admin upsert keeps alias mirror sync — server trigger handles it).
4. UI consumers switch: `MenuPage` tab filter, `homeProviders` split, `ReviewCarouselSection`, `FoodMenuCard` (gate pre-order button by `available_preorder`; same-day button by `available_same_day`), `HomeProductCard` cta. Support SAME_DAY-only / PRE_ORDER-only / BOTH (both-mode cards show both CTAs). Client displays availability; server gate remains authority (`ERR_PRODUCT_MODE_NOT_ALLOWED` surfaced).

**Wave 3 — One cart, mode-locked (§16)**
5. Port the isolation semantics (`order_mode`, `pendingMode`, `needs_confirmation`) from `src/stores/useCartStore.ts` into the live `src/store/cartStore.ts`; repoint `CartIsolationModal` + `BiteMascot` reads to the live store; keep `stores/useCartStore` as a thin re-export shim so `cartIsolationStore.test.ts` and `CartIsolationModal` semantics stay green (no existing test deleted). Result: one cart implementation, mode isolation actually enforced (a PRE_ORDER item never coexists with SAME_DAY items).

**Wave 4 — SAME_DAY checkout hardening (§6/§7/§8 — no regression)**
6. `CheckoutPage`:
   - round selection = `listRoundsForDate(today)` (DELETE hardcoded `morning→round-1` map and the query-param `'morning'` default; show cutoff + capacity state);
   - delivery fee display = `quoteDeliveryFee` (server RPC) — client estimates labeled DISPLAY ONLY; **remove the client gate** (`!selectedProvider` disabling place-order); default `delivery_method='self_delivery'`, coords passed for server tier/fee; provider info stays display/log only;
   - send `promotion_code` from the coupon field; show server-derived totals on the confirmation (post-create) step;
   - remove `distance_km: 0`;
   - `createCanonicalOrder({ …, order_mode:'SAME_DAY' })` (no `p_scheduled_date` — server sets today's round date);
   - keep `createPaymentIntent(order.order_number, order.total_amount …)` (server-returned amount) and the `/payment/:orderNumber` handoff.

**Wave 5 — PRE_ORDER customer flow (§5 — new)**
7. `/checkout?mode=PRE_ORDER` (same route, mode-aware; `deepLinkMode` becomes real state):
   - date picker: min date = today + lead (display value from `order_policy` if readable per §8-D2, else 1; server enforces `ERR_LEAD_TIME`);
   - round picker from `listRoundsForDate(date)` (cutoff/capacity shown);
   - address + payment identical to SAME_DAY (reuse the same checkout sections — no duplicate implementation);
   - submit `createCanonicalOrder({ …, order_mode:'PRE_ORDER', scheduled_date })` → server returns `PO-…` → same payment page → track.
8. Entry points rewired: `HomePage.handlePreOrder` / `MenuPage.handlePreOrder` / `FoodMenuCard` / `HomeProductCard` put the product into the mode-locked cart (or deep-link straight to `/checkout?mode=PRE_ORDER`) — **no direct RPC from product cards anymore**; login guard before checkout (existing redirect pattern; server also raises `ERR_NOT_AUTHENTICATED`).
9. `preOrderService.ts` reduced to what existing tests need until re-pointed; then delete `createPreOrder / cancelPreOrder / updatePreOrderStatus / getPreOrders / validatePreOrder / getPreOrderStats` + `bmb_pre_orders` storage (§9 DELETE list). New PWA code calls **only** `orderApi`.

**Wave 6 — Order history & detail (§14/§15)**
10. `OrdersPage`: single canonical list from `getOrders()` (+ hydrated items); show `order_number`, `order_mode` badge, `scheduled_date`, round display name, canonical status (`orderVocabulary.getServerStatusLabel`), `payment_status`, `total`; remove the pre_orders section + legacy label map; fix `/profile/orders` → `/orders`.
11. Order detail = the track page's detail card (canonical fields incl. delivery method/status) — no separate PRE_ORDER detail page.

**Wave 7 — Tracking (§12)**
12. Rewrite `OrderTrackPage`: load order by `:orderNumber` (`getOrder` — RLS: own when logged in, delivered/cancelled visible anonymously), hydrated items, latest intent status, delivery assignment status if present; render via `orderVocabulary` mode-aware timeline (`serverToClientStatus(server, order_mode)`); **poll every ~20 s (read-only)**; real order date / round / items / server totals; ETA = display text only (round-based), never a progression timer; explicit `cancelled` / `failed` states; payment banner strictly from server state; zero timers touching status.

**Wave 8 — Payment UX (§9/§10)**
13. `PaymentConfirmationPage`: poll order + intents; intent selection = active (`pending`/`processing`) else latest; `failed` → Retry button → `createPaymentIntent` for the **same order** (never a new order/cart); server errors surfaced verbatim; Stripe path: `createCheckout` + client_secret confirm — paid state arrives via webhook (`record_payment_result`); never trust `?success=true` or client callbacks alone; COD unchanged.

**Wave 9 — Cancellation (§13)**
14. `OrdersPage` + track page: cancel affordance when `status='pending'` (hint shows the window from §8-D2 display); call `cancelOrder`; render `cancelled` from server state; paid+cancelled → "ยกเลิก — รอดำเนินการคืนเงิน" until `payment_status='refund'`; idempotent cancel tolerated.

**Wave 10 — Tests (§18) + gates**
15. New/updated vitest in `src/__tests__`:
    - **mode:** same-day-only rejected in PRE_ORDER, preorder-only rejected in SAME_DAY, both-mode allowed both ways (UI-level mirrors of contracts_023 T1/T4/T5);
    - **pre_order:** min-lead date selection, round list per date, create payload includes `p_order_mode/p_scheduled_date`, `PO-` result flows to the payment page;
    - **payment:** COD never paid before delivered; PromptPay TXN→processing without self-paid; Stripe state server-only (`?success` ignored); retry reuses the same order (assert no second `createOrder`, no cart mutation); active-intent selection;
    - **cancellation:** pending cancel OK; non-pending → server error surfaced; paid-cancelled shows cancelled-not-refunded; idempotent cancel;
    - **tracking:** renders server status; **no timer mutates status** (status changes only after refetch); refresh reflects server state; mode-aware labels;
    - **delivery:** server-quote display for <1 km / 1 / 4.99 / 5 / >5 km; forged client distance cannot change the submitted order (payload assertion: no client fee field);
    - keep every existing suite green — `api.test.ts`, `paymentStateMachine.test.ts`, `cartIsolationStore.test.ts`, `orderStateMachine.test.ts`, `orderVocabulary.test.ts`, `deliveryRouter.test.ts`, `deliveryFeeApi.test.ts`, `providers.test.ts`, `phases5_7.test.ts` — behavior-preserving updates only, **no test deleted merely to go green**.
16. Gates: `vitest` → `build` → `lint` → `contracts_023` + `contracts_028` (backend unchanged) → frontend integration pass → live verification (brief §22: SAME_DAY create→payment/COD→confirmation→kitchen visibility; PRE_ORDER create→payment/COD→confirmation→kitchen visibility incl. `create_production_batch` pickup; cancel via UI; tracking reads DB state) → docs reconciliation (§23) → commit/push.

**Backend touch summary (only if §8-D1 approved):** one additive GRANT on the 024 function; no policy weakened; no behavior migrated. Everything else in Phase 3B is `src/` (+ tests) work.

## 11. STOP-CONDITION STATUS (§24) — pre-implementation evidence

| # | Stop condition | Today (Gate A) | After Wave plan |
|:--|:--|:--|:--|
| 1 | PWA depends on `pre_orders` | 🔴 YES (L1/L2/L9) | ✅ closed (Waves 5/6) |
| 2 | PWA creates separate PRE_ORDER records | 🟠 structural: PWA calls the legacy shim; the shim already writes canonical `orders` | ✅ closed (Wave 5: canonical RPC only) |
| 3 | client can mark payment paid | ✅ NO (verified) | ✅ kept + tests |
| 4 | client can determine delivery fee | 🔴 UI-side (client provider cost + order gate) | ✅ closed (Wave 4) |
| 5 | tracking mutates state | 🔴 client simulation | ✅ closed (Wave 7) |
| 6 | retry creates second order | n/a (no retry exists) | ✅ guarded (Wave 8 tests) |
| 7 | customer accesses another customer's order | ✅ NO (RLS) | ✅ kept + live check |
| 8 | same-day regresses | risk during rewire | ✅ guarded (Wave 4 + Wave 10) |
| 9 | PRE_ORDER cannot reach canonical kitchen | ✅ backend solved (024/027); frontend path required | ✅ closed (Wave 5 + live §22) |
| 10 | backend contract weakened | ✅ NO — only additive GRANT proposed | ✅ §8-D1 decision |

---
**Gate A complete.** Implementation starts only after the owner confirms §8-D1 (additive `ensure_rounds_for_date` GRANT) and the Wave plan. Implementation baseline remains `a9ab8cd`.

## 12. WAVE EXECUTION RECONCILIATION (§23) — 2026-09-22

Phase 3B ("Bite Me Baby" customer PWA consumes the canonical order backend end-to-end)
was executed on top of the owner-gated wave whose ONLY backend change is migration
`029_ensure_rounds_grant.sql` (one additive GRANT). Evidence, scope and open items:

**Gates (all green at commit time):**
- `vitest run` — 22 files / **179 tests passed** (was 171; +7 §18 cases in the new
  `src/__tests__/canonicalOrderFlow.test.ts`, +1 tier grid in `deliveryFeeApi.test.ts`).
- `npm run build` — `tsc` clean, `vite build ✓ 7.10s`, dist + PWA assets generated.
- `npm run lint` — exit 0, zero findings.
- `contracts_023` + `contracts_028` + `contracts_029` — all PASS on the local stack.

**§18 test coverage added (spec-faithful):**
- tracking: fake-timer proof that elapsed polls never mutate status; read-only poll
  loop (getOrder + getPaymentIntents ×3) inserts zero rows; server `transition_order_status`
  visible only through refetch.
- delivery: `createOrder` rpc args allow-listed to `p_*` inputs only (no `p_total_amount`,
  `p_delivery_fee`, `p_subtotal`, `p_discount_amount`, `p_tax_amount`, `p_service_fee`);
  forged `p_distance_km=9999` cannot move subtotal (65×2=130) — total = subtotal −
  discount + server fee `min(30 + 4·km + 2·qty, 9999)`; tier grid 0.99/1/4.99/5→25,
  5.01/9.99→45, 10.01/19.99→80 mirrors server zones.
- payment: COD `confirm_offline_payment` rejected `ERR_COD_NOT_DELIVERED` (payment stays
  pending); `refundPayment` client-refused (`SERVER_SIDE_ONLY`); checkout only through
  the `create-checkout` Edge Function (server-minted client_secret); retry after
  `mark_payment_failed` = 2nd intent on the SAME order (no 2nd order, cart untouched,
  active intent pending).

**§22 live verification — `e2e/live_verify_022.sql` (kept as a repeatable gate):**
13 PASS notices against the real local stack (`supabase_db_ivkdfognyiwjcmrhcnwz`,
role-impersonated customer/admin/anon via JWT claims, ONE transaction, ROLLBACK):
SAME_DAY PromptPay create `BMB-*` (server total, capacity 0→1) → intent pending→processing
→ admin batch + `kitchen_queue` visibility → full stepwise status chain →delivered →
kitchen confirm → paid → customer tracking reads (orders/items/intents); COD guard
(customer confirm rejected; admin pre-delivery rejected `ERR_COD_NOT_DELIVERED`, status
stayed pending; post-delivery → paid); customer self-cancel `cancel_order` → cancelled +
capacity 3→2; cross-tenant RLS (foreign order 0 rows, cancel rejected); PRE_ORDER
`ensure_rounds_for_date` (029 GRANT exercised live) → `PO-*` (cap 1), forged
`scheduled_date` rejected `ERR_ROUND_DATE_MISMATCH`, future-date kitchen batch/queue visible.
*Scope honesty:* "UI cancel" was verified at the RPC layer (`cancel_order` — the exact RPC
the UI button calls); a real browser click-through was NOT automated in this environment.

**Live finding F-1 (pre-existing, NOT fixed in this wave — outside the approved scope):**
`order_transition_allowed` (migration 008) is a plpgsql CASE *statement without ELSE*;
any off-allow-list transition raises internal `case not found` instead of returning false /
`ERR_INVALID_TRANSITION`. Transitions are still safely rejected (no security hole), but the
error surface is ugly. Proposed owner-approved follow-up: tiny migration adding
`ELSE RETURN false` semantics + contract probe.

**Owner-blocked (unchanged):** production apply of migration 029 requires
`SUPABASE_ACCESS_TOKEN` (Management API). After apply: rerun `contracts_029` / `023` /
`028` against production and verify rounds/capacity audit.

**Cleanup done before this commit:** local-only port overrides removed from
`supabase/config.toml` (54321-54324 defaults restored); all `_*.txt`/`_*.sql` probe temp
files deleted; `supabase/020_corrupted_backup.txt` deleted (020 was restored from HEAD
earlier in the session).

## 13. WAVE 2 EXECUTION LOG (2026-09-22) — F-1 fix (migration 030) + real-browser cancel
## click-through + production migration state
# (post-fa93f9d wave: closes the §22 scope-honesty note and the "ยังไม่เคยรัน" migration question)

**F-1 FIXED (owner-approved in chat: "อนุมัติ ต่อเลย")**

- `supabase/migrations/030_order_transition_allowed_else.sql` — CREATE OR REPLACE of the LIVE
  4-arg `order_transition_allowed(p_from, p_to, p_is_admin, p_is_owner)` adding exactly ONE
  functional line `ELSE RETURN false;` to the admin CASE. Body otherwise identical to the live
  definition at fa93f9d (proven via `pg_get_functiondef`); signature / SECURITY DEFINER /
  search_path / allow-list / owner branch / EXECUTE grants (service_role only) all unchanged.
- **Proof of the bug (pre-fix):** `e2e/contracts_030_transition_else.sql` run BEFORE applying 030
  died exactly at G2 with `ERROR: case not found` + `HINT: CASE statement is missing ELSE part`
  (G1 allow-list regression still passed) — root cause reproduced live, not inferred.
- **After 030 applied** (local `supabase migration up` is blocked by the CLI's remote-drift
  check against stale remote history rows — see §13 production state — so it was applied via
  psql from the same file + registered in local history): the same suite PASSES 4/4 + ROLLBACK:
  G1 allow-list regression intact (admin chain / identity / owner cancel) · G2 off-allow-list
  pairs return false WITHOUT case_not_found · G3 end-to-end admin `transition_order_status` on a
  forced-delivered PRE_ORDER order rejected with the CONTRACTED `ERR_INVALID_TRANSITION`
  (delivered→cancelled and delivered→failed; order untouched) · G4 owner `cancel_order`
  end-to-end (pending + window + future PRE_ORDER date) with capacity released 2→1.
- **No regression:** `e2e/live_verify_022.sql` re-run AFTER 030 → 13/13 PASS (§22 gates intact).
- **Full gates:** vitest 179/179 (22 files) · eslint clean · `npm run build` PASS.

**Real-browser cancel click-through — the §22 scope-honesty gap, now CLOSED**

`e2e/cancelClickThrough.cjs` (Playwright + system Chrome, headless, LOCAL stack ONLY) — **11/11
steps PASS** (`e2e/cancel-clickthrough-result.json`, screenshots `e2e/screenshots/ct-01..06`):

1. real login through `/login` (customer created via local auth admin API, deleted in `finally`);
2. real SAME_DAY order created through the FULL UI (menu → add → upsell sheet → cart →
   checkout → round picker → place-order → PromptPay txn submit → `/track/BMB-*`);
3. CANCEL **clicked on the tracking page** (`data-testid="track-cancel"`) → success toast
   "ยกเลิกออเดอร์สำเร็จ" + cancelled state text + cancel button hidden after refetch;
4. server truth under the customer's own RLS: `orders.status='cancelled'` + round capacity
   released 1→0 (`cancel_order` → capacity trigger);
5. second real order → CANCEL **clicked on `/orders`** (`data-testid="cancel-<order_number>"`)
   → same toast + row label "ยกเลิก" + button gone;
6. server truth again: `cancelled` + capacity 1→0.

Gate runbook: the script auto-resolves the REAL local API port (see F-2 below), waits for the
async round picker, and picks a round whose cutoff is genuinely still open — widening TODAY's
cutoffs via local psql ONLY when the gate runs after every cutoff (local test data; NOT a code
path). Console noise during the run: only `getBusinessSettings` 403 (F-3 below) — display-only,
graceful.

**Findings from the click-through environment (informational, NOT changed in this wave)**

- **F-2 (machine-level):** TWO local supabase stacks run concurrently on this machine
  (Bite Me Baby + selfprint-v3-react). BMB's actual API gateway is `127.0.0.1:54331`, while
  `supabase status -o env` reports the default `54321` — owned by the OTHER project's stack
  (its schema is a digital-twin app: `twin_*` tables). The gate scripts therefore probe
  candidate ports and pin the one that serves THIS project's schema (`products` resolves).
- **F-3 (grants gap):** `service_role` holds NO table privileges on `delivery_rounds`
  (42501 hint: "GRANT SELECT ON public.delivery_rounds TO service_role"), and `authenticated`
  lacks SELECT on `business_settings` (checkout logs 403 from `getBusinessSettings`, degrades
  gracefully). The RLS-hardening lineage never re-issued table grants for later-created tables.
  Flagged for a future owner-approved grants pass; no behavior hole (RLS stays authoritative).

**Production migration state — answering "มิเกรชั่นของวันนี้ทั้งหมดยังไม่เคยรันเลย ให้รันยังไง"**
(all READ-ONLY evidence; NO production write happened in this wave)

- Local stack: 001→030 applied AND recorded in `supabase_migrations.schema_migrations`
  (030 applied + registered this session; contracts_030 + live_verify_022 green).
- Production `ivkdfognyiwjcmrhcnwz`: `supabase migration list` (CLI connects read-only without
  an access token) shows **001→027 applied + RECORDED; 028, 029 (+ new 030) are NOT on
  production** — "ยังไม่เคยรัน" is therefore true exactly for 028/029(+030); 023–027 already
  shipped earlier. Fingerprint probes with the publishable key (read-only) confirm the
  023/024-era objects exist on production: `delivery_rounds` table + `orders.order_mode`
  column return 200 on production REST.
- `supabase db push --dry-run` prints EXACTLY the pending set:
  `028_phase3a_operational_guarantees · 029_ensure_rounds_grant · 030_order_transition_allowed_else`
  → **one `supabase db push`** applies them in order and RECORDS history. Do NOT re-run
  023–027 manually. Production history carries 3 stale rows (031, 032, 20260812000002) from an
  old refactor whose files no longer exist — they do NOT block `db push`; optional later
  cleanup: `supabase migration repair --status reverted 031 032 20260812000002`.
- New tooling (committed with this wave): `e2e/prodCheckMigrations.cjs` (read-only
  local-vs-remote sentinel diff: migration history, functions, tables, F-1 ELSE presence, 029
  grant; `--remote` mode token-gated via `SUPABASE_ACCESS_TOKEN`) and `e2e/prodApplyMigrations.cjs`
  (Management API apply, ONE file per query, BOM/CRLF/NUL sanitized, transaction-wrapped when
  not self-wrapped, stops at first failure, explicit `--files 028,029,030` only).
- Post-apply verification (unchanged from §23): rerun `contracts_023` / `contracts_028` /
  `contracts_029` / `contracts_030` against production + re-check the rounds/capacity audit.
