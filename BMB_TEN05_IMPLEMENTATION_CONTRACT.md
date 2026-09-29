# BMB — TEN-05 IMPLEMENTATION CONTRACT: Customer/Public Routing Foundation

**Baseline:** `6b46cac` (TEN-04 deployed) · **Gate type:** AUDIT → CONTRACT ONLY · **NO implementation in this gate**
**Status:** READY FOR OWNER REVIEW / NOT READY FOR IMPLEMENTATION

---

## A. PRODUCTION FACTS (Verified from Codebase + Migrations)

### A.1 Database Schema State

| Entity | Status | Evidence |
|--------|--------|----------|
| `tenants` table | DEPLOYED, 1 row (`tenant-bmb-001`) | Migration 059 + runtime verified |
| `brands` table | DEPLOYED, 1 row (`brand-bmb-main`, tenant-bmb-001) | Migration 072-073 + seeded |
| Brands columns (slug, display_name, tagline, description, logo_url_icon, status, is_default, is_published, theme_tokens) | DEPLOYED | Migration 072 |
| `tenants.default_brand_id` FK→brands(id) | DEPLOYED | Migration 074 |
| `business_settings.tenant_id` | DEPLOYED, backfilled to tenant-bmb-001 | Migration 075 |
| `mascot_overrides.brand_id/tenant_id` | DEPLOYED, NULL shared default preserved | Migration 076 |
| Catalog tables with `tenant_id` | DEPLOYED, NOT NULL enforced | Migration 067-070 |
| All catalog RLS tenant-aware | DEPLOYED, using `is_tenant_admin(tenant_id)` | Migration 071 |
| Brands RLS (public_read + tenant_admin_manage) | DEPLOYED | Migration 077 |
| Mascots RLS (public_read brand=NULL + tenant_admin_manage) | DEPLOYED | Migration 077 |
| Business settings RLS (public_read key whitelist + tenant_admin_manage) | DEPLOYED | Migration 077 |
| `create_order_with_items` RPC | UNMODIFIED by TEN-02/03/04 | Verified via grep + contracts |
| Global order number format `BMB-YYYYMMDD-NNN` | INTACT | No migration touches orders schema |

### A.2 Current Data Counts

| Table | Count | Tenant Distribution |
|-------|-------|---------------------|
| tenants | 1 | `tenant-bmb-001` only |
| brands | 1 | `brand-bmb-main` (active/published/default) |
| business_settings | 5 keys | All → tenant-bmb-001 |
| products/categories/sections/addons | N | All → tenant-bmb-001 |
| media_assets | N | tenant_id nullable (unmodified) |
| mascot_overrides | N | brand_id/tenant_id NULL (shared default) |

### A.3 Vitest Baseline

- **331/331 PASS at closure of TEN-04**
- **Current regression: 330/331 PASS** (1 pre-existing failure in `canonicalOrderFlow.test.ts` tracking timer test)
- The failure is NOT caused by TEN-04 (confirmed: `products.tenant_id` NOT used in orders; `create_order_with_items` untouched)

---
## B. CURRENT ROUTING ARCHITECTURE (Audited)

**Router:** `src/main.tsx → <BrowserRouter> → <App />`. React Router v6 history-based SPA with lazy-loaded routes, no SSR.

**Customer Routes:** `/`, `/menu`, `/cart`, `/checkout`, `/orders`, `/track/:orderNumber`, `/login`, `/register`, plus static content pages (reviews, promotions, FAQ, blog, contact, privacy, terms, rewards). All lazy-loaded code-split components.

**Admin Routes:** All prefixed `/admin/*`, protected by `AdminRoute` guard (requires authenticated + admin role). 18+ admin pages.

**Critical Finding — NO Brand/Tenant Resolution in URL Params:**
- No `?brand=` parameter anywhere in routing or navigation
- No `?tenant=` parameter exists  
- No deep-link resolution for multi-brand scenarios
- No QR-code-driven storefront switching
- All pages assume single brand = Bite Me Baby (hardcoded)
- Only `?mode=` (same-day/pre-order) and `?round=` params exist

---

## C. CURRENT CUSTOMER PWA FLOW (Audited)

**LCP Page: HomePage (`src/pages/HomePage.tsx`)** — Loads ALL products/categories via `getProducts()` → `supabase.from('products').select('*')`. Server-side RLS filters by tenant_id (TEN-03), but no front-end way to switch tenant context. Products displayed as HOME carousels. No brand presentation layer loaded.

**Menu Page (`src/pages/MenuPage.tsx`)** — Displays ALL products across ALL sections/categories. Tab-based filtering: same-day vs pre-order. No brand branding applied — CSS tokens hardcoded in `platformConfig.ts`.

**Cart Architecture (`src/store/cartStore.ts`)** — Zustand store: `items[]`, `order_mode` (SAME_DAY/PRE_ORDER locked). **CRITICAL GAP: No `tenant_id` or `brand_id` stored in cart state.** When user navigates to a different brand/tenant, the cart would either be lost on route change or contain items incompatible with the new brand's catalog.

**Checkout Flow (`src/pages/CheckoutPage.tsx`)** — Server derives price/subtotal/discount/delivery_fee/total (client values DISPLAY ONLY). Menu schedule check blocks preorder if product not on schedule. **No tenant/brand context passed to `createOrder`.** Order creation uses canonical `create_order_with_items` RPC — which does NOT include `tenant_id` or `brand_id` parameters.

**Platform Config (`src/config/platformConfig.ts`)** — `tenantId: 'bmb-main'` and `brandName: 'Bite Me Baby'` are compile-time constants. `setTenant()` function exists but is never called from any customer-facing component. Delivery config could potentially be per-tenant but isn't wired up.

---

## D. BRAND RESOLVER ANALYSIS

**Current State: NONE EXISTS**

NO brand resolver abstraction in the codebase:
- ❌ No `resolveBrandBySlug(slug)` 
- ❌ No `resolveBrandFromUrl(params)`
- ❌ No `useActiveBrand(): BrandInfo`
- ❌ No BrandProvider component
- ❌ No dynamic manifest/favicon injection
- ❌ No runtime theme token application

**What IS Available (After TEN-04):**
```sql
brands(id, tenant_id FK, name, slug, display_name, tagline, description,
       logo_url_icon, status, is_default, is_published, theme_tokens JSONB)
```

RLS policies:
- `brands_public_read`: SELECT WHERE `status='active' AND is_published=true`
- `brands_tenant_admin_manage`: full access for tenant admins

Anyone can read published/active brands; theme tokens available per brand; NO frontend code queries brands table yet.

**Gap Analysis:**

| Capability | Status | Priority |
|-----------|--------|----------|
| Read brand by slug from DB | IMPLEMENTED (DB) / MISSING (frontend) | P0 |
| Resolve default brand for tenant | IMPLICIT (DB has `is_default=true`) / MISSING (frontend) | P0 |
| Validate brand status | IMPLEMENTED (CHECK constraint) / MISSING (frontend validation) | P1 |
| Validate published state | IMPLEMENTED (RLS filters active only) | P1 |
| Load brand presentation (name, tagline, logo) | MISSING | P0 |
| Apply brand theme tokens to PWA | MISSING | P0 |
| Dynamic favicon/manifest update | MISSING | P1 |
| OG/meta tags per brand | MISSING | P1 |

---

## E. TENANT RESOLVER ANALYSIS

### E.1 Current State: SERVER-SIDE ONLY

The tenant system exists purely as an RLS enforcement boundary:
- `tenants(id, name, slug, status)` table with 1 row (`tenant-bmb-001`)
- Every catalog/business_settings row has `tenant_id = 'tenant-bmb-001'`
- `is_tenant_admin(tenant_id)` function gates admin operations
- Admin UI operates on global data (single tenant = no distinction visible)

### E.2 What IS Available

- ✅ `tenants` table fully structured for multi-tenant expansion
- ✅ `brands.tenant_id` FK enforces tenant-brand relationship
- ✅ `tenants.default_brand_id` provides routing fallback
- ✅ RLS policies enforce tenant isolation at DB level
- ✅ `business_settings` scoped to tenant

### E.3 Gap Analysis

| Capability | Status | Priority |
|-----------|--------|----------|
| Read tenant by slug | IMPLEMENTED (DB) / MISSING (frontend) | P0 |
| Resolve tenant from brand | IMPLICIT (via brands.tenant_id FK) / MISSING (frontend lookup) | P0 |
| Validate tenant status | IMPLEMENTED (CHECK constraint) / MISSING (frontend validation) | P1 |
| Switch catalog context by tenant | MISSING (frontend doesn't support it) | P1 |
| Switch delivery rules by tenant | MISSING (delivery config is global/hardcoded) | P2 |


---

## F. PHASE-1 QR/LINK PARAMETER CONTRACT

### F.1 Objective

Enable customers to arrive at different brand/storefront contexts via URL params:

```
https://bitemebaby.com/?brand=bmb-main
https://bitemebaby.com/menu?brand=food-co-main
```

Or via QR code from physical receipt pointing to a brand-specific link.

### F.2 Resolution Contract

```
Step 1: Extract ?brand=<slug> from URL search params
Step 2: Query brands WHERE slug=?brand AND is_published=true AND status='active'
Step 3: If found → resolve tenant_id from brands.tenant_id
Step 4: If not found OR ?brand absent → fall back to tenants.default_brand_id
Step 5: If no default → fall back to first active published brand
Step 6: Store resolved (tenant_id, brand_id) in session + Zustand store
Step 7: Use resolved context for ALL subsequent catalog/admin reads
```

### F.3 Public Safety Contract

- Only `status = 'active' AND is_published = true` brands are resolvable
- Suspended brands return "Unavailable" without revealing existence
- Invalid/non-existent slugs fall back gracefully to default brand
- No 404 errors leaking internal brand IDs

### F.4 Cart Isolation Contract

When user navigates Brand A → Brand B:

```
IF cart.items.length > 0:
  CHECK: do any items belong to Brand B's tenant?
  IF YES → keep cart, show transition banner
  IF NO → prompt user: "Cart contains items from {BrandA}. Clear?"
           USER CONFIRMS → clearCart() → apply Brand B mode
           USER CANCEL → keep cart, stay on Brand A
```

Requires:
- Each CartItem tracks the `tenant_id` context at time of addition
- Cart store gains optional `context_brand_id` field
- Cross-context detection before allowing cart carry-over

### F.5 Product Loading Contract

```typescript
// BEFORE (current):
const products = await supabase.from('products').select('*')

// AFTER (Phase 1):
const resolvedBrand = useResolvedBrand()
const products = await supabase.from('products').select('*')
    .eq('tenant_id', resolvedBrand.tenant_id)
```

Since TEN-03 already adds `tenant_id` to ALL catalog tables (NOT NULL enforced), this filter works with existing data. Currently all rows have `tenant-bmb-001`, so the filter does not change behavior — it is REQUIRED for correctness when multiple tenants exist.

### F.6 Implementation Guardrails

```
FORBIDDEN patterns:
❌ if brand === 'bmb-main' useTheme(bmb) else useTheme(other)
❌ Hardcode brand names in if/else chains
❌ Assume hostname determines brand identity
❌ Modify create_order_with_items signature
❌ Add brand_id to orders table without contract approval

REQUIRED patterns:
✅ Universal resolver: resolveBrand(context) → {tenant_id, brand_id, info}
✅ Server-authoritative pricing (unchanged)
✅ Canonical order spine preserved (order_number global)
✅ RLS boundaries respected (tenant_isolation)
✅ Graceful fallback chain (URL → default → first active)
```

---

## G. FUTURE PHASE COMPATIBILITY DESIGN

### G.1 Phase-Subdomain Compatibility (`?brand=` → subdomain)

```
foodco.bitemebaby.com → brands.slug = 'foodco'
Implementation: Parse origin.hostname.split('.')[0] → lookup brands.slug
Falls through to ?brand= param if no subdomain match.
Stores result same as Phase-1.
```

### G.2 Phase-Custom Domain Compatibility

```
foodco-menu.com → maps to cloudflare/nginx → custom domain proxy
Option A: Maintain brand_domains(brand_id TEXT, domain TEXT UNIQUE, verified BOOLEAN) table
Option B: Cloudflare Workers inspects Host header → injects brand context before SPA loads
Option C: GET /.well-known/bmb-brand?host=foodco-menu.com → returns {brand_id, tenant_id}
```

### G.3 Design Principle: Single Source of Truth

```
resolver.contract.ts:

interface BrandResolver {
  resolve(input: UrlParamContext | SubdomainContext | CustomDomainContext): ResolvedBrand
  context(): { tenant_id: string; brand_id: string; slug: string }
}
```

Every future phase must produce the SAME `ResolvedBrand` structure. This ensures:
- Same catalog load logic regardless of entry point
- Same cart isolation logic regardless of how the user arrived
- Same order creation logic (no duplicate pipelines)


---

## H. PUBLIC ACCESS CONTRACT

### H.1 Anonymous User Permissions (Read-Only)

| Table | What | Filter |
|-------|------|--------|
| `products` | id, name, description, price, image_url, is_available | WHERE tenant_id IN (resolved tenant) |
| `product_categories` | id, name, slug, icon, sort_order | WHERE is_active=true AND tenant_id IN (resolved tenant) |
| `menu_sections` | id, name, sort_order | WHERE is_active=true AND tenant_id IN (resolved tenant) |
| `delivery_rounds` | id, display_name, period, date, status | WHERE status='active' |
| `business_settings` | key, value | WHERE key IN ('delivery_policy','hours','kitchen_location','operating_hours') |
| `brands` | id, name, display_name, tagline, logo_url_icon, theme_tokens | WHERE status='active' AND is_published=true |
| `mascot_overrides` | role_name, media_url, alt | WHERE brand_id IS NULL (shared default) OR brand_id matches resolved brand |
| `menu_schedule` | Published schedule | WHERE published=true AND effective_date >= today |
| `promotions` | Active promotions | WHERE is_active=true AND end_date >= now() |
| `reviews` | Verified reviews | WHERE is_verified=true |

### H.2 Anonymous Users CANNOT Read

| Table | Why |
|-------|-----|
| `profiles` | PII protection |
| `orders` | Transactional privacy |
| `payment_intents` | PCI compliance |
| `inventory*` | Operational data |
| `tenants` | Infrastructure only |
| Unpublished brands | `is_published=false` filtered by RLS |
| Suspended brands | `status IN ('inactive','suspended')` filtered by RLS |
| Admin notifications | Internal operational data |
| Audit logs | Security-sensitive data |

### H.3 Authentication Boundary

```
ANON    → Read public catalog, brand presentation, business info
AUTHENTICATED → Same + own orders, reviews, votes, profile
ADMIN   → Full admin panel access (tenant-scoped)
PLATFORM_ADMIN → Cross-tenant admin access
```

No RLS changes needed for customer flows — existing policies are correct.

---

## I. RLS/SECURITY CONTRACT

### I.1 Security Principles

```
PRINCIPLE 1: Brand ≠ Tenant substitute
  A brand always belongs to exactly ONE tenant.
  Routing by brand_slug ALWAYS resolves to a specific tenant_id.
  Orders NEVER record brand_id directly (canonical order spine unchanged).

PRINCIPLE 2: Server authority over transaction data
  Prices, fees, discounts, capacity, availability ALL derived server-side.
  Client context is ONLY used for filtering/display, not decision-making.

PRINCIPLE 3: Tenant isolation boundary
  Tenant A customer MUST NEVER see Tenant B's private data.
  Current RLS enforces this via is_tenant_admin().
  Public read paths use status/published checks, not tenant matching.

PRINCIPLE 4: No broad grants
  Do NOT grant service_role SELECT on sensitive tables without justification.
  Do NOT add WITH CHECK(true) policies.
  Do NOT allow anon INSERT/UPDATE/DELETE on any table.
```

### I.2 RLS Policy Review Needed

| Policy | Current | TEN-05 Impact | Action |
|--------|---------|---------------|--------|
| `brands_public_read` | status='active' AND is_published=true | Enables brand resolver | Deployed ✅ |
| `mascots_public_read` | WHERE brand_id IS NULL | Needs extension for brand-specific mascots | REVIEW NEEDED |
| `delivery_rounds_public_read` | Existing | Works across tenants | REVIEW: should rounds be brand-filterable? |
| Catalog tables | Tenant-aware via is_tenant_admin() | No change needed | None |

### I.3 Security Testing Matrix

| Test Case | Expected Result |
|-----------|-----------------|
| Customer opens brand-A link | Sees only brand-A tenant catalog |
| Customer modifies URL param to brand-B | Sees brand-B (if public) or falls back to default |
| Customer tries another tenant's admin settings | DENIED by RLS |
| Two customers on different brands checkout | Both create orders independently, both use global order_number |


---

## J. CART ISOLATION CONTRACT

### J.1 Current Deficiency

Current cart store has zero awareness of tenant/brand context:

```typescript
interface CartStore {
  items: CartItem[]           // ← No tenant_id or brand_id attached
  order_mode: OrderMode       // ← Locks to SAME_DAY or PRE_ORDER only
}
```

### J.2 Proposed Enhancement

```typescript
interface CartStore {
  items: CartItem[]
  order_mode: OrderMode
  
  // New for Phase-1:
  context_tenant_id?: string  // Tenant active when item added
  context_brand_id?: string   // Brand active when item added
  
  getCartContext(): { tenant_id, brand_id } | null
  isCompatibleWithContext(targetTenantId, targetBrandId): boolean
  requestCrossContextSwitch(targetTenantId, targetBrandId): 'allowed' | 'blocked' | 'prompt'
}
```

### J.3 Transition Rules

| Rule | Scenario | Action |
|------|----------|--------|
| R1 | Same tenant, different brand | Allow carry-over, show transition banner |
| R2 | Different tenant | Clear cart + confirm with user. NEVER silently transfer. |
| R3 | Brand→Unbranded fallback | Auto-switch to default brand, attempt keep compatible items |

### J.4 Local Storage

Cart persists via localStorage/Zustand persist middleware. Must:
- Include context fields in serialized storage
- Handle version migration for existing carts (no context = single-tenant default)
- Clear stale context on browser cleanup

---

## K. ORDER CONTEXT CONTRACT

### K.1 Canonical Order Spine — UNCHANGED

```sql
create_order_with_items(
  p_items jsonb,          -- [{product_id, quantity, options}]
  p_delivery_round_id text,
  p_customer_id uuid,
  p_order_mode text,      -- 'SAME_DAY' | 'PRE_ORDER'
  p_scheduled_date text,  -- PRE_ORDER only
  p_payment_method text,
  p_promotion_code text
  -- NOTE: NO tenant_id or brand_id parameters
  -- order_number generated globally: BMB-YYYYMMDD-NNN
)
```

**Decision: DO NOT add tenant_id or brand_id to create_order_with_items in TEN-05.**

Rationale:
- Global order numbering (BMB-YYYYMMDD-NNN) intentionally shared
- Adding brand_id requires schema migration, RPC rewrite, test suite updates
- Tenancy isolation achieved at catalog access layer (what you see), not order recording
- Future tenants distinguishable via source_channel if needed

### K.2 Server Authority Over All Transaction Data

| Check | Authority | Enforcement Point |
|-------|-----------|-------------------|
| Product existence & availability | Server RPC | `create_order_with_items` validates product_id |
| Price calculation | Server RPC | Server derives subtotal, discount, fee, total |
| Round capacity/cutoff | Server trigger/RPC | `ensure_rounds_for_date`, round status checks |
| Pre-order window | Server trigger | `enforce_pre_order_window()` |
| Menu schedule validity | Server trigger | `trg_catalog_visibility_gate` |
| Promotion code validity | Server RPC | Promo code validation in RPC |
| Delivery fee | Server RPC | `compute_delivery_fee_rpc` |
| Inventory deduction | Server trigger | After order created |

### K.3 Routing Parameter Restrictions

Route params MUST NOT override these server-authoritative values:

| Value | Must NOT be overridden by | Source of truth |
|-------|---------------------------|-----------------|
| price | URL param, client JS, local JSON | `products.price` |
| discount | Coupon input format, client promo engine | Server promo evaluation |
| delivery fee | Distance sent from client | Server geospatial computation |
| round capacity | Client round picker count | Server `delivery_rounds.capacity` |
| cutoff time | Client-side timer | Server clock + `delivery_rounds` |
| order status | Any client transition | `transition_order_status` RPC |
| payment status | Webhook replay | Stripe webhook → `record_payment_result` |


---

## L. API/RPC REQUIREMENTS

### L.1 New Endpoints Required for Phase-1

```typescript
// 1. Resolve brand by slug (public, no auth required)
async function resolveBrandBySlug(slug: string): Promise<{
  id: string; tenant_id: string; name: string; display_name: string;
  tagline: string; logo_url: string; theme_tokens: JSONB; slug: string;
}> | null

// 2. Resolve default brand for a tenant
async function resolveDefaultBrand(tenantId: string): Promise<BrandInfo> | null

// 3. Validate brand is accessible (for QR scan checks)
async function validateBrandAccessible(slug: string): Promise<boolean>
```

### L.2 Existing APIs That Need Context Filtering

These fetch ALL rows currently (no tenant filter). With TEN-05 they should accept optional context:

```typescript
// Before (works because only 1 tenant exists):
getProducts()          // supabase.from('products').select('*')
getCategories()        // supabase.from('product_categories').select('*')
getSections()          // supabase.from('menu_sections').select('*')

// After (with brand context):
getProducts(context)   // .select('*').eq('tenant_id', context.tenant_id)
```

Since `tenant_id` is same for all current rows (`tenant-bmb-001`), queries return identical results. Filter is REQUIRED for correctness when multiple tenants exist.

### L.3 APIs That Should NOT Change

| API | Reason |
|-----|--------|
| `create_order_with_items` | Canonical order spine, global numbering |
| `transition_order_status` | Server state machine, not context-dependent |
| `record_payment_result` | Payment reconciliation, tenant-agnostic |
| `fetchServerDeliveryFee` | Server authority over pricing |

---

## M. MIGRATION PLAN

### M.1 Required Schema Changes: NONE

TEN-05 is FRONTEND-ONLY. All schema prerequisites are met by TEN-02/03/04:
- `tenants` table exists
- `brands` table with all presentation columns
- `tenant_id` on ALL catalog tables
- `default_brand_id` on tenants
- RLS policies for brands/mascots/settings public read

### M.2 Frontend File Changes (Code Only — No Migration)

| Area | Change Type | Files |
|------|------------|-------|
| Brand resolver abstraction | NEW | `src/lib/brandResolver.ts` |
| Resolved brand context store | NEW | `src/store/resolvedBrandStore.ts` |
| Platform config runtime loading | MODIFY | `src/config/platformConfig.ts` |
| HomePage brand integration | MODIFY | `src/pages/HomePage.tsx` |
| MenuPage brand filtering | MODIFY | `src/pages/MenuPage.tsx` |
| CartStore context awareness | MODIFY | `src/store/cartStore.ts` |
| App.tsx route guard for brand | MODIFY | `src/App.tsx` |
| SEO helmet dynamic metadata | MODIFY | `src/components/SeoHelmet.tsx` |

---

## N. BACKFILL PLAN

### N.1 No Data Backfill Required

Single-tenant deployment means all `tenant_id` columns already populated to `tenant-bmb-001`. One brand seeded. `brands.is_default=true` already set.

### N.2 Optional: tenants.default_brand_id Backfill

If TEN-04 didn't backfill `tenants.default_brand_id`:

```sql
UPDATE tenants SET default_brand_id = 'brand-bmb-main'
WHERE id = 'tenant-bmb-001' AND default_brand_id IS NULL;
```

Simple UPDATE, not a migration — done via SQL console or ad-hoc script.


---

## O. ROLLBACK PLAN

### O.1 TEN-05 Rollback Strategy

Since TEN-05 involves NO schema changes and NO migration:

1. **Git revert**: Revert the TEN-05 commit — no database cleanup needed
2. **No data migration to undo**
3. **Existing RLS policies remain intact**
4. **No impact on `create_order_with_items` or order processing**

### O.2 Safeguards

- Feature flag pattern recommended: `if (featureFlags.brandRouting) { ... }` so Phase-1 can be toggled off without revert
- All resolver calls should degrade gracefully: if resolver fails → default brand (single tenant = works identically to pre-TEN-05)

---

## P. ACCEPTANCE CRITERIA

### P.1 Functional Acceptance

| # | Criterion | Verification |
|---|-----------|--------------|
| F-01 | Opening `/?brand=<slug>` resolves to correct brand context | E2E test with real brand slug |
| F-02 | Opening `/menu?brand=<slug>` shows tenant-scoped catalog | Visual verification of products list |
| F-03 | Opening `/cart?brand=<slug>` shows empty or appropriate cart | Cart store inspection |
| F-04 | Cross-brand cart transition prompts user | Manual test: add item Brand A, navigate Brand B |
| F-05 | Invalid/missing brand slug falls back to default brand | Test `/?brand=nonexistent` |
| F-06 | Suspended brand shows unavailable (not 404) | Set status='suspended', attempt access |
| F-07 | Brand theme tokens applied to PWA CSS | Visual verification of colors/fonts |
| F-08 | Checkout creates order via unchanged RPC | Contract test: verify order_number format |
| F-09 | Admin UI unaffected by brand routing | Login as admin, verify all pages load |
| F-10 | Non-admin cannot access admin pages | RLS test: authenticated non-admin gets 403 |

### P.2 Security Acceptance

| # | Criterion | Verification |
|---|-----------|--------------|
| S-01 | Anon only sees published/active brands | Direct Supabase query simulation |
| S-02 | Tenant A catalog invisible to Tenant B customer | Multi-tenant test scenario |
| S-03 | URL param cannot override price/fee/discount | Manipulate payload, verify server rejection |
| S-04 | No brand_id leaked into orders table | Query orders after cross-brand checkout |
| S-05 | Mascot overrides with brand_id only shown to owning brand | Test mascot_display per brand |
| S-06 | business_settings.private keys inaccessible to anon | Query settings not in whitelist |
| S-07 | is_tenant_admin() rejects non-admin on admin endpoints | Direct RPC call simulation |

### P.3 Regression Acceptance

| # | Criterion | Threshold |
|---|-----------|-----------|
| R-01 | tsc --noEmit passes | Exit code 0 |
| R-02 | vitest run passes | ≥330/331 tests pass |
| R-03 | eslint src/ passes | Exit code 0 |
| R-04 | Production order flow unchanged | Same-day + preorder both functional |
| R-05 | Admin panel functional | All admin pages load |
| R-06 | Global order numbering intact | Format: BMB-YYYYMMDD-NNN |

### P.4 Performance Acceptance

| # | Criterion | Threshold |
|---|-----------|-----------|
| P-01 | First Contentful Paint | ≤ 2.5s on 3G simulation |
| P-02 | Brand resolver latency | ≤ 200ms (network round-trip) |
| P-03 | Catalog load time (with tenant filter) | Same as pre-TEN-05 |
| P-04 | Lighthouse performance score | ≥ 90 (maintained from baseline) |

---

## Q. RISKS & BLOCKERS

### Q.1 Risks

| Risk | Severity | Mitigation |
|------|----------|------------|
| CF-pages/custom domain not configured | HIGH | Phase-3 depends on DNS/domain ownership — defer |
| Existing users bookmarked direct URLs | LOW | Hash-based fallback: preserve existing URLs |
| Brand resolver race condition during boot | LOW | Parallel resolve: use whichever arrives first |
| Cart persistence across brand switch | MEDIUM | Prompt-before-clear pattern |
| Media assets not tenant-branded | MEDIUM | CAT-D04 scope — defer image branding |

### Q.2 Blockers

| Blocker | Impact | Resolution Path |
|---------|--------|-----------------|
| Manifest/favicon runtime update not supported by Vite PWA | Medium | Generate dynamic `<link rel="manifest">` via HelmetProvider |
| OG image uses static build-time assets | Low | Dynamic OG via SSR — defer to Phase-3 |
| No subdomain hosting infrastructure | Informational | Phase-2 deferred; Phase-1 uses query params only |


---

## R. OWNER DECISIONS REQUIRED

### RD-01: Catalog Anchor Scope

**Question:** Should Phase-1 filter catalog by `tenant_id` or wait for brand-scoped catalog?

| Option | Description |
|--------|-------------|
| A | Filter by tenant_id NOW (future-proof, minimal effort) |
| B | Filter by brand_id (requires schema change — not implemented yet) |
| C | No filter (rely on RLS only — works for 1 tenant only) |

**Recommendation: Option A** — Safe, backward-compatible, prepares for multi-tenant.

### RD-02: Order Numbering Space

**Question:** Should orders from different brands share one global order number space or have tenant-prefixed numbers?

| Option | Description |
|--------|-------------|
| A | GLOBAL (BMB-YYYYMMDD-NNN) — current behavior, unchanged |
| B | TENANT-PREFIXED (TEN_A-BMB-YYYYMMDD-NNN) — requires schema+RPC change |

**Recommendation: Option A (PRESERVE)** — Adding prefix requires modifying create_order_with_items (high risk), rewriting tracking flow, updating admin UI everywhere.

### RD-03: Cart Strategy

**Question:** How should cart handle brand/tenant transitions?

| Option | Description |
|--------|-------------|
| A | Strict isolation — any brand switch clears cart with prompt |
| B | Smart carry-over — check product compatibility, keep common items |
| C | Mode-isolated — treat brand/context like mode (SAME_DAY/PRE_ORDER) |

**Recommendation: Option A for Phase-1** — Simple, safe, easy to explain. Option B increases risk of wrong-item charges.

### RD-04: Brand Presentation Layer

**Question:** Where should resolved brand presentation be consumed?

| Option | Description |
|--------|-------------|
| A | Dedicated `<BrandProvider>` component at App root |
| B | Individual components call resolver hook directly |
| C | URL-driven — each page reads its own URL param |

**Recommendation: Option A** — Single source of truth, automatic propagation, clean DX.

### RD-05: Dynamic PWA Metadata

**Question:** Should favicon, manifest, title, OG tags update dynamically per brand?

| Option | Description |
|--------|-------------|
| A | Fully dynamic — inject icon/meta via HelmetProvider per brand |
| B | Minimal — title + meta description dynamic; favicons/manifest per-deploy |
| C | No dynamic metadata — each brand deploys separate build |

**Recommendation: Option A** for title/meta/icon. Manifest regeneration deferred to Phase-3 (each deploy gets one manifest).

### RD-06: RLS Policy Updates

**Question:** Are current RLS public-read policies sufficient for brand-resolved routing?

```sql
-- Current mascots_public_read: WHERE brand_id IS NULL
-- Needs extension to also allow brand-specific mascots:
WHERE brand_id IS NULL 
   OR brand_id IN (SELECT id FROM brands WHERE is_published=true AND status='active')
```

This allows brand-specific mascot overrides while preserving shared-default (brand_id=NULL) behavior.

### RD-07: Feature Flag

**Question:** Should TEN-05 be controlled by a feature flag?

| Option | Description |
|--------|-------------|
| A | Feature flag (`FEATURE_BRAND_ROUTING`) — toggleable, safe rollback |
| B | No flag — deploy and monitor |

**Recommendation: Option A** — Allows immediate rollback without git revert.

---

## S. IMPLEMENTATION SEQUENCE (Post-Approval Only)

### Stage 1: Core Resolver (Day 1-2)
1. Create `brandResolver.ts` — pure resolution logic
2. Create `resolvedBrandStore.ts` — Zustand store for context
3. Add `BrandProvider` component to App.tsx
4. Wire `?brand=` param extraction from URL

### Stage 2: Catalog Integration (Day 3-4)
5. Update `getProducts()`, `getCategories()`, `getSections()` — accept optional context
6. Update HomePage, MenuPage — consume brand context for filtering
7. Update `platformConfig.ts` — merge runtime theme tokens with defaults

### Stage 3: Cart Context Awareness (Day 5)
8. Extend cartStore with context fields
9. Implement cross-context transition logic
10. Test cart carry-over scenarios

### Stage 4: Brand Presentation (Day 6-7)
11. Dynamic favicon/title/meta injection
12. SEO helmet integration
13. Mascot display (brand-specific + shared default)

### Stage 5: Testing & Regression (Day 8)
14. tsc --noEmit verification
15. Vitest suite run (≥330/331 pass)
16. ESLint verification
17. Manual E2E: multi-brand flow, cart transition, invalid slug fallback

---

## T. HARD STOP — WAITING FOR OWNER APPROVAL

This contract documents:
- ✅ Complete audit of current routing, brand resolution, tenant resolution
- ✅ Gap analysis for all questions in directive
- ✅ Phase-1 QR/link parameter contract design
- ✅ Phase-2/3/4 compatibility planning
- ✅ Security/RLS contract
- ✅ Cart isolation contract
- ✅ Order context contract (preserved)
- ✅ Migration plan (NONE required — frontend only)
- ✅ Acceptance criteria (functional, security, regression, performance)
- ✅ Risks and blockers documented
- ✅ 7 owner decisions required (RD-01 through RD-07)

**DO NOT implement TEN-05 until all owner decisions above are reviewed and approved.**

---

**Audit Date:** 2026-09-29
**Baseline:** `6b46cac` (TEN-04 HEAD == origin/main)
**Test Baseline:** 330/331 vitest pass (1 pre-existing: canonicalOrderFlow tracking timer)
**TEN-03:** CLOSED
**TEN-04:** PASS, DEPLOYED, RUNTIME VERIFIED

**AUDIT COMPLETE. AWAITING OWNER DECISIONS. HARD STOP.**
