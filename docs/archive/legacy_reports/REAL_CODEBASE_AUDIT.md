
## 2. Security Findings (Evidence-Based)

### 2.1 Critical Severity Issues (Must Fix Before Production)

| # | Issue | Location | Evidence | Risk |
|---|-------|----------|----------|------|
| C1 | localStorage as user database | bmbAdminApi_users.ts:21-23 | storageGet<User[]>('bmb_users', []) | Data theft, impersonation |
| C2 | Client-side password verification | bmbStorage.ts:102-104 | erifyPassword() with bcrypt in browser | Password brute force |
| C3 | Frontend financial total calculation | cartStore.ts:97-111 | 	otal = Math.max(0, subtotal - discount + state.deliveryFee) | Revenue fraud |
| C4 | Simulated payment confirmation | paymentGateway.ts:94-110 | status: 'completed' after 1.5s delay | Fake payments |
| C5 | No order state machine enforcement | bmbAdminApi_orders.ts:130-153 | updateOrderStatus() accepts any status | Status manipulation |
| C6 | Hardcoded admin password hash | bmbAdminApi_users.ts:106 | ADMIN_DEFAULT_HASH = '$...' | Account takeover |
| C7 | No RLS enforcement on client data writes | Multiple files | Client inserts directly to Supabase | Data injection |

### 2.2 High Severity Issues

| # | Issue | Location | Evidence | Risk |
|---|-------|----------|----------|------|
| H1 | Dual data stores (localStorage + Supabase) | 10+ files | preOrderService.ts fallback pattern | Data inconsistency |
| H2 | Promotion system not in database | promotionIntelligence.ts:101-103 | storageGet<Promotion[]>('bmb_promotions', DEFAULT_PROMOTIONS) | Promo manipulation |
| H3 | Review system not in database | reviewApi.ts:18-20 | storageGet<Review[]>('bmb_reviews', []) | Fake reviews |
| H4 | Audit log not in database | auditLog.ts:44-45 | const LOG_STORAGE_KEY = 'bmb_audit_logs' | Audit tampering |
| H5 | Inventory not synced with Supabase | inventoryStore.ts:35-39 | Zustand store vs DB table | Stock mismatch |
| H6 | No media library | Multiple files | Base64 in localStorage | Image management |

### 2.3 Authentication Flow (Current - BROKEN)

`
App Boot (main.tsx)
    ↓
initializeAdmin() → creates admin user in localStorage (CRITICAL)
    ↓
checkAuth() → reads from localStorage 'bmb_auth' (CRITICAL)
    ↓
User Login (LoginPage)
    ↓
authenticateUser(email, password) → reads localStorage 'bmb_users' (CRITICAL)
    ↓
verifyPassword() → bcrypt comparison (client-side) (CRITICAL)
    ↓
setCustomer() → stores in authStore (Zustand) + localStorage (OK)
    ↓
Admin Route Check (AdminRoute)
    ↓
isAdmin() → queries Supabase 'profiles' table (OK)
    BUT...
    authStore.customer.role → from localStorage (CRITICAL MISMATCH)
`

**Critical Security Issues:**
1. 🔴 **User database is in localStorage** — anyone can access/modify
2. 🔴 **Password verification is client-side** — bcrypt runs in browser
3. 🔴 **Admin initialization at boot** — pre-computed hash in source code
4. ⚠️ **Dual auth sources** — localStorage vs Supabase profiles mismatch
5. ⚠️ **No session management** — localStorage can be cleared/edited

---

## 3. Data Flow Analysis

### 3.1 Customer Order Flow (Current Implementation)

`
Customer PWA
    ↓
HomePage → loads products from Supabase (OK)
    ↓
MenuPage → filter products by category (OK)
    ↓
CartPage → add to cartStore (Zustand) (Client-side only)
    ↓
CheckoutPage → calculate totals in cartStore (Client-side calculation)
    ↓
    ├── Select delivery round (from delivery_rounds table) (OK)
    ├── Select delivery method (hardcoded providers) (Not configurable)
    ├── Enter address (No address validation)
    └── Select payment method (PromptPay / COD) (No real payment)
    ↓
createOrder() → inserts to Supabase 'orders' + localStorage fallback (Dual store)
    ↓
createPaymentIntent() → creates payment_intents record (Simulated)
    ↓
confirmPayment() → SETS status to 'completed' AFTER 1.5s delay (SIMULATED)
    ↓
PaymentConfirmationPage → shows success (OK)
    ↓
OrderTrackPage → reads from Supabase 'orders' (OK)
`

**Critical Gaps:**
1. ❌ No server-side price verification
2. ❌ No real payment processing (Stripe not integrated)
3. ❌ No webhook verification for payment status
4. ❌ Client can manipulate cart totals before checkout
5. ❌ No inventory reservation at order time

### 3.2 Admin Order Management Flow

`
Admin Dashboard → loads stats from getDashboardStats()
    ↓
    ├── todayOrders: filters orders by date (OK)
    ├── todayRevenue: sums total_amount (From client data)
    ├── pendingOrders: filters by status (OK)
    └── lowStockItems: reads from inventoryStore (localStorage) (Not synced)
    ↓
AdminOrders → loads orders from getOrders() (OK)
    ↓
    ├── Update status: updateOrderStatus() → Supabase (No state validation)
    ├── Update payment: updateOrderPayment() → Supabase (No auth check)
    └── Trigger notifications: notificationStore (in-memory) (Not persisted)
`

**Critical Gaps:**
1. ❌ No authorization check before status update
2. ❌ No state machine validation (can skip states)
3. ❌ Revenue calculations from potentially manipulated data
4. ❌ Notifications not persisted to database

---

## 4. Test Analysis

### 4.1 Unit Tests (Vitest)

| Metric | Value | Notes |
|--------|-------|-------|
| Total tests | 26 | src/__tests__/api.test.ts |
| Test environment | jsdom + mocked localStorage | test-setup.ts |
| Supabase mock | In-memory (supabaseMock.ts) | Not real Supabase |
| Coverage | Unknown | No coverage report generated |
| Real DB tests | 0 | No integration tests |
| E2E tests | Unknown | Playwright config exists but results not verified |

### 4.2 Test Coverage by Feature

| Feature | Tests | Real DB | Real Auth | Real Payment | Status |
|---------|-------|---------|-----------|--------------|--------|
| Products API | 5 tests | Mock | N/A | N/A | PARTIAL |
| Categories API | 2 tests | Mock | N/A | N/A | PARTIAL |
| Orders API | 3 tests | Mock | N/A | N/A | PARTIAL |
| Pre-orders API | 2 tests | Mock | N/A | N/A | PARTIAL |
| Delivery providers | 4 tests | N/A | N/A | N/A | VERIFIED (logic) |
| Payment gateway | 0 tests | N/A | N/A | Simulated | MISSING |
| Auth system | 0 tests | N/A | localStorage | N/A | MISSING |
| RLS policies | 0 tests | Not tested | N/A | N/A | MISSING |
| Security | 0 tests | N/A | Not tested | N/A | MISSING |

### 4.3 Test Environment Issues

`	ypescript
// test-setup.ts - localStorage mock
const localStorageMock = (() => {
  let store: Record<string, string> = {}
  return {
    getItem: (key: string) => store[key] || null,
    setItem: (key: string, value: string) => { store[key] = value },
    // ...
  }
})()
Object.defineProperty(globalThis, 'localStorage', { value: localStorageMock })

// api.test.ts - Supabase mock
vi.mock('@/lib/supabase', async () => {
  const { createSupabaseMock } = await import('./helpers/supabaseMock')
  return {
    supabase: createSupabaseMock(),
    supabaseAdmin: null,
    isAdmin: async () => false,  // Always returns false
    // ...
  }
})
`

**Problem:** Tests verify logic against mocks, NOT against real Supabase / real localStorage. This means:
- RLS policies are never tested
- Auth bypass is never detected
- Payment simulation is never caught
- Data inconsistency between stores is never found

---

## 5. Hard-coded Business Logic Map

### 5.1 Hard-coded Values (Should Be Configurable)

| Value | Location | Current | Should Be |
|-------|----------|---------|-----------|
| Kitchen latitude | Multiple files | 10.7016 | Configurable via admin |
| Kitchen longitude | Multiple files | 102.1429 | Configurable via admin |
| Delivery radius | externalProviders.ts | 5 km | Configurable |
| Morning cutoff | preOrderService.ts | 06:00 | Configurable |
| Midday cutoff | preOrderService.ts | 10:00 | Configurable |
| Evening cutoff | preOrderService.ts | 15:00 | Configurable |
| Morning capacity | preOrderService.ts | 50 | Configurable |
| Midday capacity | preOrderService.ts | 40 | Configurable |
| Evening capacity | preOrderService.ts | 45 | Configurable |
| Grab base fee | externalProviders.ts | 40 | Configurable |
| Grab per km fee | externalProviders.ts | 8 | Configurable |
| Lineman base fee | externalProviders.ts | 35 | Configurable |
| Lineman per km fee | externalProviders.ts | 7 | Configurable |
| Foodpanda base fee | externalProviders.ts | 38 | Configurable |
| Foodpanda per km fee | externalProviders.ts | 7.5 | Configurable |
| Self delivery base fee | externalProviders.ts | 30 | Configurable |
| Self delivery per km fee | externalProviders.ts | 4 | Configurable |
| Admin email | bmbAdminApi_users.ts | admin@bmb.co.th | Configurable |
| Admin password hash | bmbAdminApi_users.ts:106 | Pre-computed bcrypt | Should be set via UI |
| Welcome promo code | promotionIntelligence.ts | WELCOME10 | Configurable |
| Free shipping threshold | promotionIntelligence.ts | 200 | Configurable |

### 5.2 Hard-coded Content (Should Be CMS-managed)

| Content | Location | Status |
|---------|----------|--------|
| Hero section text | HomePage.tsx | Hardcoded |
| Promotion cards | HomePage.tsx:327-351 | Hardcoded |
| SEO metadata | seo.ts | Partially hardcoded |
| Social proof reviews | socialProofReviews.ts | Curated (manual) |
| Site config | seo.ts:7-14 | Hardcoded |

---

## 6. Duplicate / Dead Code

### 6.1 Dead Code

| File | Issue | Recommendation |
|------|-------|----------------|
| src/counter.ts | Vite template leftover | Delete |
| src/components/cart/ | Empty directory | Delete or implement |
| src/components/menu/ | Empty directory | Delete or implement |
| src/components/order/ | Empty directory | Delete or implement |
| src/components/promotion/ | Empty directory | Delete or implement |
| src/components/review/ | Empty directory | Delete or implement |
| src/components/delivery/ | Empty directory | Delete or implement |
| src/components/inventory/ | Empty directory | Delete or implement |
| src/components/rewards/ | Empty directory | Delete or implement |
| src/components/share/ | Empty directory | Delete or implement |
| src/components/viral/ | Empty directory | Delete or implement |
| src/components/vote/ | Empty directory | Delete or implement |
| src/components/random/ | Empty directory | Delete or implement |
| src/hooks/ | Empty directory | Delete or implement |

### 6.2 Duplicate Logic

| Duplicate | Location A | Location B | Issue |
|-----------|-----------|-----------|-------|
| Storage helpers | bmbStorage.ts | externalProviders.ts:224-239 | Same storageGet/storageSet reimplemented |
| Price calculation | cartStore.ts:97-111 | CheckoutPage.tsx:54-58 | Total calculated in two places |
| Provider cost | externalProviders.ts:114-128 | CheckoutPage.tsx:54-58 | Cost calculated twice |

---

## 7. Critical Gaps Summary

### 7.1 Security Gaps (Must Fix Before Production)

1. 🔴 **Move authentication to Supabase** — Stop using localStorage for users/passwords
2. 🔴 **Server-side price verification** — Calculate totals on backend, not client
3. 🔴 **Real payment integration** — Stripe webhook verification required
4. 🔴 **Order state machine enforcement** — Backend must validate transitions
5. 🔴 **Remove hardcoded admin credentials** — Set via admin UI or Supabase

### 7.2 Data Integrity Gaps

6. ⚠️ **Unify data stores** — Choose localStorage OR Supabase, not both
7. ⚠️ **Move promotions to Supabase** — promotions table needed
8. ⚠️ **Move reviews to Supabase** — reviews table needed
9. ⚠️ **Move audit log to Supabase** — audit_logs table needed
10. ⚠️ **Sync inventory with Supabase** — Real-time stock tracking

### 7.3 Business Logic Gaps

11. ⚠️ **Configurable business parameters** — Delivery fees, rounds, capacity
12. ⚠️ **Media library** — Image upload/management system
13. ⚠️ **Round/capacity management UI** — Admin must adjust dynamically
14. ⚠️ **Address validation** — Delivery address verification
15. ⚠️ **Inventory reservation** — Reserve stock at order time

### 7.4 Testing Gaps

16. ❌ **Integration tests** — Test against real Supabase
17. ❌ **Security tests** — Test RLS policies, auth bypass, data injection
18. ❌ **E2E tests** — Full order flow test (real payment simulation)
19. ❌ **Performance tests** — Lighthouse + real device testing

---

## 8. Files / Components Affected by Critical Issues

### 8.1 Authentication System

| File | Issue | Severity |
|------|-------|----------|
| src/store/authStore.ts | localStorage auth | CRITICAL |
| src/lib/bmbAdminApi_users.ts | localStorage users + hardcoded hash | CRITICAL |
| src/main.tsx | Admin seeding at boot | CRITICAL |
| src/lib/supabase.ts | isAdmin() queries profiles but authStore ignores it | High |
| src/components/layout/Layout.tsx | No auth check in layout | High |

### 8.2 Payment System

| File | Issue | Severity |
|------|-------|----------|
| src/lib/paymentGateway.ts | Simulated payment | CRITICAL |
| src/pages/CheckoutPage.tsx | Client-side total calculation | CRITICAL |
| src/store/cartStore.ts | Client-side financial math | CRITICAL |
| src/pages/PaymentConfirmationPage.tsx | Shows fake success | High |

### 8.3 Order System

| File | Issue | Severity |
|------|-------|----------|
| src/lib/bmbAdminApi_orders.ts | No state machine validation | High |
| src/pages/admin/AdminOrders.tsx | Direct status updates | High |
| src/lib/preOrderService.ts | Dual store pattern | High |

### 8.4 Data Stores

| File | Issue | Severity |
|------|-------|----------|
| src/lib/bmbStorage.ts | localStorage wrapper | High |
| src/lib/auditLog.ts | localStorage audit log | High |
| src/lib/promotionIntelligence.ts | localStorage promotions | High |
| src/lib/reviewApi.ts | localStorage reviews | High |
| src/store/inventoryStore.ts | localStorage inventory | High |

---

## 9. Database Impact

### 9.1 Current Database State (Post-Migration 005)

**Tables with RLS enabled:**
- ✅ products — Secure mode
- ✅ product_categories — Secure mode
- ✅ delivery_rounds — Secure mode
- ✅ orders — Secure mode
- ✅ order_items — Secure mode
- ✅ pre_orders — Secure mode
- ✅ payment_intents — Secure mode
- ✅ profiles — Secure mode + is_admin() function
- ✅ customers — Secure mode
- ✅ inventory — Secure mode

**Missing tables (needed for full functionality):**
- ❌ promotions — Currently localStorage-only
- ❌ reviews — Currently localStorage-only
- ❌ audit_logs — Currently localStorage-only
- ❌ media_assets — No media library
- ❌ business_settings — No configurable parameters
- ❌ delivery_zones — Hardcoded radius

### 9.2 Migration Needed

**New migrations required:**
1. 006_add_promotions_table.sql — Promotion management
2. 007_add_reviews_table.sql — Review system (Supabase-backed)
3. 008_add_audit_logs_table.sql — Audit log (Supabase-backed)
4. 009_add_business_settings.sql — Configurable parameters
5. 010_add_media_assets.sql — Media library
6. 011_add_delivery_zones.sql — Dynamic delivery zones

---

## 10. Recommendations Priority

### Phase 1: Security Hardening (Critical)

1. Migrate authentication to Supabase Auth + RLS
2. Implement server-side price calculation
3. Integrate real Stripe payments with webhook verification
4. Enforce order state machine on backend
5. Remove hardcoded admin credentials

### Phase 2: Data Unification (High)

6. Move promotions, reviews, audit logs to Supabase
7. Unify inventory between localStorage and Supabase
8. Implement media library with Supabase Storage
9. Add business settings table

### Phase 3: Admin Completeness (Medium)

10. Build round/capacity management UI
11. Build promotion management UI
12. Build business settings UI
13. Build media library UI

### Phase 4: Testing (Medium)

14. Write integration tests against real Supabase
15. Write security tests (RLS, auth, injection)
16. Write E2E tests for critical flows
17. Add performance testing

### Phase 5: Polish (Low)

18. Remove dead code and empty directories
19. Implement missing components
20. Add address validation
21. Implement inventory reservation

---

## 11. Version Summary

| Component | Version | Notes |
|-----------|---------|-------|
| React | 19.2.18 | Latest stable |
| Vite | 8.2.2 | Latest stable |
| TypeScript | 5.9.3 | Downgraded from 6.0.2 |
| Tailwind CSS | 4.3.3 | CSS-first config |
| Zustand | 5.0.15 | Latest stable |
| React Router | 7.18.3 | Latest stable |
| Supabase JS | 2.116.0 | Latest stable |
| Stripe | 22.6.1 | Test mode only |
| Vitest | 3.1.1 | Latest stable |
| bcryptjs | 3.0.3 | Dynamic imported |

### 11.1 Migration Status Update (2026-09-22)

Original audit baseline listed migrations 001→004 as the "migration needed" section. **Production has progressed to 34/34 migrations applied (001–034):**

- Migrations 005–006: RLS hardening (Wave 1)
- Migrations 007–010: Order RPC, payment state machine, webhook infrastructure (Phase C/D)
- Migrations 011–022: Kitchen core, Bite Drive, Phase 4–7 admin + AI (Phase 5–7 shipped)
- Migrations 023–028: Canonical order domain, round lifecycle, operational guarantees (Wave 2)
- Migrations 029–032: Grant repair, EXECUTE drift fixes (Wave 2.5)
- Migrations 033–034: Table-ACL alignment + production ACL drift remediation (**Wave 3 VERIFIED**)

All tables documented in sections 9.1 are now present and managed via Supabase CLI migrations. See `AI_WORK_STATE.md` §Migrations for registry.

---

## 12. Environment Variables

| Variable | Source | Status |
|----------|--------|--------|
| VITE_SUPABASE_URL | .env.local | Configured |
| VITE_SUPABASE_ANON_KEY | .env.local | Configured |
| VITE_SUPABASE_SERVICE_ROLE_KEY | .env.local | Configured |
| VITE_OPENROUTER_API_KEY | .env.local | Configured |
| VITE_OPENROUTER_MODEL | .env.example | z-ai/glm-5.2:free |
| VITE_STRIPE_PUBLISHABLE_KEY | .env | Placeholder |
| VITE_STRIPE_SECRET_KEY | .env | Test key (not real) |
| VITE_STRIPE_WEBHOOK_SECRET | .env | Placeholder |
| VITE_GRAB_SANDBOX_CLIENT_ID | .env | Mock |
| VITE_GRAB_SANDBOX_CLIENT_SECRET | .env | Mock |
| VITE_LINEMAN_SANDBOX_API_KEY | .env | Mock |

---

**END OF REAL CODEBASE AUDIT**
*Generated: 2026-09-18 | Target: commit e007d08 | Principle: Evidence > Claims*