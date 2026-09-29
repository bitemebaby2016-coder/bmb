# BMB — TEN-04: BRAND / PRESENTATION TENANCY IMPLEMENTATION CONTRACT

**Baseline:** `11cef87` (TEN-03 deployed)
**Gate type:** AUDIT + CONTRACT DESIGN — NO migration/RLS/RPC/schema change
**Evidence source:** production query, local repo, existing docs

---

## A. PRODUCTION FACTS (verified at `11cef87`)

| Item | Value | Notes |
|------|-------|-------|
| Tenants table rows | 1 | `tenant-bmb-001` (active) |
| Brands table rows | 0 | Table exists via migration-059, no FK enforcement |
| Products tenant_id | ALL = 'tenant-bmb-001' | NOT NULL enforced (TEN-03) |
| Products count | 10 | All same-day/preorder=FALSE; featured=prod-1,3,5 |
| Product categories | 5 | dish,rice,curry,drink,dessert |
| Menu sections | 0 | Empty in current deployment |
| Orders | 202 | order_items=199 |
| Media assets | 9 | products_with_image_url=9 |
| Mascot overrides | 0 | Empty — 9 default poses only |
| business_settings | 5 keys | delivery_policy,hours,kitchen_location,operating_hours,order_policy |
| profiles.is_platform | TRUE | 1 row (platform admin, verified by is_owner=true) |
| tables total | 42 | pg_tables count from production |
| default_brand_id anywhere | NONE | No brand-scoped config exists |

### business_settings values
```json
{ "delivery_policy": { currency:"THB", min_order:0, radius_km:10 } }
{ "hours": { open:"8:00", close:"20:00" } }
{ "kitchen_location": { address:"Bite Me Baby Kitchen", lat:10.7016, lng:102.1429 } }
{ "operating_hours": { morning_open:true, midday_open:true, evening_open:true, same_day_open:true, pre_order_open:true } }
{ "order_policy": { preorder_max_days:50, max_items_per_order:50, pre_order_lead_days:1, cancel_window_minutes:5 } }
```

### Existing brand infrastructure
| Entity | Exists? | Status |
|--------|---------|--------|
| brands table | YES | migration-059, columns=id(PK),tenant_id(FK nullable),name,logo_url,color_scheme(plaintext),created_at,updated_at. 0 rows. |
| mascot_overrides | YES | migration-021, columns=role_name(PK),media_url,alt,updated_at. 0 rows. No tenant/brand scope. |
| business_settings | YES | key(PK),value(JSONB),created_at,updated_at. Global only. No tenant/brand scope. |
| CSS theme tokens | 34 vars hardcoded | index.css @theme block: brand-primary #F97316, brand-bg #FFF7ED, fonts Nunito+Quicksand. Zero runtime theming. |
---

## B. CURRENT SCHEMA (TEN-04 relevant tables)

### Tenants (migration-059)
```sql
CREATE TABLE tenants (id TEXT PK, name TEXT NOT NULL, slug TEXT UNIQUE, status TEXT CHECK('active'/'inactive'/'suspended'), created_at, updated_at)
-- 1 row: tenant-bmb-001 | "Bite Me Baby" | "bite-me-baby" | active
```

### Brands (migration-059) — MINIMAL
```sql
CREATE TABLE brands (id TEXT PK, tenant_id TEXT REFERENCES tenants(id), name TEXT DEFAULT '', logo_url TEXT DEFAULT '', color_scheme TEXT DEFAULT '', created_at, updated_at)
-- 0 rows. Missing: slug, display_name, is_active, is_default, theme_tokens jsonb, tagline, status
```

### mascot_overrides (migration-021) — GLOBAL ONLY
```sql
CREATE TABLE mascot_overrides (role_name TEXT PK, media_url TEXT, alt TEXT, updated_at)
-- 0 rows. No tenant_id or brand_id column. All poses shared globally.
-- Roles: greeting, cooking, delivering, empty_cart, checkout, thanks, pointing, thumbsup (8 roles x ~3 poses each)
```

### business_settings — GLOBAL KEY-VALUE STORE
```sql
CREATE TABLE business_settings (key TEXT PK, value JSONB DEFAULT '{}', created_at, updated_at)
-- 5 keys, all global. No tenant/brand scope. Covers delivery/hours/location/operating_hours/order_policy.
```

### Profiles (migration-065/066) — TENANT-AWARE
```sql
profiles (id UUID PK, role TEXT, tenant_id TEXT, is_owner BOOLEAN, is_platform BOOLEAN, is_active BOOLEAN, email, phone, name, avatar_url, created_at, updated_at)
-- is_tenant_admin(text) function created in migration-065 for tenant-aware admin checks.
```

---

## C. EXISTING BRAND INFRASTRUCTURE GAP ANALYSIS

| Requirement | Current State | Gap Severity |
|-------------|---------------|-------------|
| Brands table exists | Yes (7 columns via migration-059) | LOW |
| default_brand_id on tenants | None | HIGH |
| Brand slug field | None | HIGH |
| Brand status/publish toggle | None | MEDIUM |
| Structured color scheme | Single TEXT column (unstructured) | MEDIUM |
| Theme token system | Hardcoded CSS only (index.css @theme block, 34 vars) | HIGH |
| Typography config | Fixed fonts Nunito+Quicksand | MEDIUM |
| Mascot per brand | Global overrides only (no scope) | MEDIUM |
| Business settings per brand | Fully global | HIGH |
| Logo variants | Single logo_url column | LOW |
| Social/Og metadata | None | LOW |
| Custom favicon support | Build-time only | LOW |

---

## D. TENANT → BRAND OWNERSHIP MATRIX

```
Tenant (OPERATIONAL OWNER)
├── Operations: drivers, delivery_rounds, delivery_zones, assignments
├── Catalog: products/categories/sections/addons/schedule/product_addon_groups
├── Default Brand ID: NEW FIELD on tenants table
│
└── Brands (PRESENTATION OWNER)
    ├── Identity: name, slug, tagline, description, logo(s)
    ├── Visual: theme_tokens(JSONB), typography, social/og
    └── Mascot: overrides scoped per brand OR NULL=default(shared)
```

| Entity | Owner | tenant_id | brand_id | RLS Scope |
|--------|-------|-----------|----------|-----------|
| tenants | Platform | N/A | N/A | platform_admin only |
| brands | Tenant | YES(FK→tenants.id) | self | tenant_admin of owning tenant; public read published |
| catalog | Tenant | YES(NOT NULL) | derive from tenant | tenant-aware |
| business_settings | Tenant | PROPOSED | derived | tenant-scoped; public read published subset |
| mascots | Tenant+Brand | PROPOSED | PROPOSED | tenant-aware; NULL=read-all(shareable default) |
| theme_tokens | Brand | derive | self | tenant-aware(public read published) |

---

## E. BRAND FIELDS REQUIRED (Migration-ready schema)

| Field | Type | Required? | Current? | Notes |
|-------|------|-----------|----------|-------|
| id | TEXT PK | YES | YES | Existing |
| tenant_id | TEXT FK→tenants | YES | YES(nullable) | SET NOT NULL after backfill |
| name | TEXT | YES | YES | Existing |
| slug | TEXT UNIQUE(composite) | YES | NO | Per-tenant uniqueness: UNIQUE(slug, tenant_id) |
| display_name | TEXT | YES | NO | Human-readable shown to customers |
| tagline | TEXT | NO | NO | Short description under logo |
| description | TEXT | NO | NO | Full brand description |
| logo_url_primary | TEXT | YES | YES(rename) | Existing logo_url explicit primary |
| logo_url_icon | TEXT | NO | NO | Apple touch icon / favicon reference |
| color_scheme | TEXT → JSONB | PARTIAL | YES(plaintext) | Migrate to structured theme object |
| status | TEXT enum | YES | NO | active/inactive/suspended |
| is_default | BOOLEAN | YES | NO | Brand used for routing fallback |
| is_published | BOOLEAN | YES | NO | Controls public/customer visibility |
| theme_tokens | JSONB | YES | NO | Controlled keyset: primary_color, secondary_color, accent_color, bg_base, surface_color, text_base, font_display, font_body |
| created_at | TIMESTAMPTZ | YES | YES | Existing |
| updated_at | TIMESTAMPTZ | YES | YES | Existing |

---

## F. OPERATIONAL VS BRANDING BOUNDARY

### Operational settings (tenant-owned — already covered by TEN-01/02/03)

| Category | Keys | Location |
|----------|------|----------|
| Delivery policy | currency, min_order, radius_km | business_settings |
| Hours | open, close | business_settings |
| Location | address, lat, lng | business_settings |
| Operating mode | morning/midday/evening/same_day/pre_order | business_settings |
| Order policy | preorder_max_days, max_items, lead_days, cancel_window | business_settings |
| Catalog | products/categories/sections/addons/schedule | products/* tables |
| Drivers | drivers/rounds/zones/assignments | drivers/delivery_* tables |
| Orders | orders/items/payments | orders/order_items/payment_intents |

### Branding settings (brand-owned — TEN-04 scope)

| Category | Keys | Proposed Location |
|----------|------|-------------------|
| Identity | name, slug, tagline, description | brands.* columns |
| Logo | primary/icon URLs | brands.logo_* columns |
| Colors | primary(#RRGGBB), secondary, accent, bg_base, text_base | brands.theme_tokens jsonb |
| Typography | display_font, body_font, size_scale | brands.theme_tokens jsonb |
| Mascots | role→media_url mapping | mascot_overrides extended with brand_id |
| Social/Og | og_title, og_desc, og_image_url, twitter_handle | brands.theme_tokens jsonb |
| Favicon/App icon | apple_touch_icon, favicon_svg, favicon_ico | brands.logo_* |
| Customer-visible rules | payment methods, min order display text | brand-level settings (future) |

**Rule:** Never mix operational + branding in same entity. Separate queries, separate RLS policies, separate migration files.

---

## G. RLS CONTRACT

### brands table
| Role | SELECT | INSERT | UPDATE | DELETE |
|------|--------|--------|--------|--------|
| platform_admin | ALL rows (cross-tenant) | ALL | ALL | ALL |
| tenant_admin (own tenant) | Own tenant's brands | Own tenant | Own tenant | Own tenant |
| customer/public | Published brands only (status=active AND is_published=true) | DENY | DENY | DENY |
| driver | DENY | DENY | DENY | DENY |
| anon | Published brands (same as public) | DENY | DENY | DENY |
| service_role | ALL | ALL | ALL | ALL |

### mascots_extended (or mascot_overrides with brand_id/tenant_id)
| Role | SELECT | INSERT | UPDATE | DELETE |
|------|--------|--------|--------|--------|
| platform_admin | ALL | ALL | ALL | ALL |
| tenant_admin (own tenant) | Own tenant mascots (all brands + NULL/default) | Own tenant | Own tenant | Own tenant |
| customer/public | All mascots where brand_id IS NULL OR brand_id=resolved_brand | DENY | DENY | DENY |
| anon | Same as customer | DENY | DENY | DENY |

### business_settings (with tenant_id column)
| Role | SELECT | INSERT | UPDATE | DELETE |
|------|--------|--------|--------|--------|
| platform_admin | ALL | ALL | ALL | ALL |
| tenant_admin (own tenant) | Own tenant's settings | Own tenant | Own tenant | Own tenant |
| customer/public | Read-only published subset | DENY | DENY | DENY |
| driver | Same as customer | DENY | DENY | DENY |

---

## H. PUBLIC/CUSTOMER ACCESS CONTRACT

### Routing flow
```
Customer request arrives → resolve tenant/brand → render matching identity
```

Resolution priority (per WL-ARCHITECTURE §14):
1. **Subdomain** (`brandname.bitemebaby.io`) → lookup brands.slug → resolve tenant
2. **Custom domain** → lookup domain→brand mapping table → resolve brand
3. **QR/Link param** (`bitemebaby.io/?brand=xxx`) → parse param → match brands.slug
4. **Fallback** → default brand of default tenant (BMB)

**Guarantee:** Customer always sees ONE brand's presentation regardless of which tenant they're in. Cross-tenant brand exposure is impossible because tenant isolation happens at the database layer (tenant_id WHERE clause in every query).

Published brand visibility rule:
- Only brands with `status = 'active' AND is_published = true` visible to customers
- A brand without a matching tenant_id cannot be accessed (FK constraint enforced)
- Anonymous users cannot see inactive brands or internal brand metadata

---

## I. ADMIN ACCESS CONTRACT

Admin panel access model:
- **Platform admin** (`is_platform = true`): Can manage ANY brand across ALL tenants
- **Tenant admin** (`tenant_admin` role + tenant_id match): Can manage brands within their tenant ONLY

Admin capabilities per brand:
- Edit display_name, slug, tagline, description
- Upload/change logo(s) via existing media upload flow
- Configure theme_tokens (color picker + font selector in Admin Settings UI)
- Manage mascot overrides per brand (via MascotSettingsPage extension)
- Toggle brand status (activate/deactivate/publish/unpublish)
- View brand analytics (orders/revenue per brand for multi-brand tenants)

**IMPORTANT:** Tenant admins MUST NOT modify another tenant's brands. `brands.tenant_id` enforced in ALL admin RPCs and API calls.

---

## J. PLATFORM ADMIN ACCESS

Platform admin privileges:
- Create/modify/delete tenants
- Set default_brand_id on any tenant
- Assign brands between tenants (with audit log entry)
- Override any brand configuration
- View cross-brand analytics
- Activate/deactivate all brands globally

Must be distinguishable from tenant_admin in ALL RLS policies via `profiles.is_platform = true`.

---

## K. MEDIA RELATIONSHIP

Current state: `media_assets` is GLOBAL (no tenant_id) → `products.image_url` references storage paths.

TEN-04 changes:
- media_assets remains GLOBAL for now (shared asset pool across brands within a tenant)
- `brands.logo_*` columns reference media_assets.id OR direct URLs
- When tenant creates a brand, it starts with NO logos assigned
- Admin uploads media via existing flow → assigns to brand during brand setup
- Future TEN variant: media_assets gets tenant_id (NOT in TEN-04 scope)

**Storage impact:** NONE. The ES256 JWT upload blocker (documented in CAT-03A) remains unchanged. Service-role workaround stays active. Admin authenticated storage upload remains its existing documented blocker.

---

## L. ROUTING IMPLICATIONS

### TEN-D05 routing phases (from WL-ARCHITECTURE §14)

Phase 1 (current concept):
- QR code links: `https://bitemebaby.io/?tenant=bmb-001&brand=bmb-main`
- Simple URL parameter parsing in PWA root component
- Stores resolved tenant/brand in memory/state

Phase 2 (future implementation):
- Subdomain resolution: `bmb-main.bitemebaby.io` → DNS wildcard CNAME → edge function resolves `bmb-main` → brands.slug
- Edge function reads Host header, returns tenant/brand context headers

Phase 3 (future):
- Custom domains stored per brand in mapping table
- Cloudflare Workers / Vercel Edge Middleware intercepts request
- DNS TXT record verification for ownership

### TEN-04 requirement for Phase 2 compatibility:
- Slug field MUST be unique PER TENANT (not globally)
- Composite unique constraint: UNIQUE(slug, tenant_id) — NOT just slug alone
- This allows different tenants to use same brand slug without collision
- Routing contracts designed so Phase 1 does NOT block Phase 2/3

---

## M. MIGRATION PLAN

### Migration sequence (after Owner approval)

```
072_brands_enforce_constraints.sql       — NOT NULL tenant_id, add slug/is_default/is_active/status, rename color_scheme→theme_tokens, add UNIQUE(slug, tenant_id)
073_brand_seeding.sql                    — Insert default BMB brand for tenant-bmb-001 (slug="bmb-main")
074_tenants_add_default_brand.sql        — Add tenants.default_brand_id TEXT FK→brands(id)
075_business_settings_extend_tenant.sql  — Add tenant_id to business_settings, backfill existing all → 'tenant-bmb-001'
076_mascot_overrides_extend_brand.sql    — Add tenant_id + brand_id to mascot_overrides, backfill NULL (shared/default)
077_brands_rls_policies.sql              — Create tenant-aware RLS for brands + mascots + business_settings
```

### Idempotency strategy
- All migrations: ADD COLUMN IF NOT EXISTS / ALTER COLUMN SET NOT NULL (only after explicit backfill gate)
- Backfill step gates: ABORT with RAISE EXCEPTION if non-default tenant values found
- RLS policies: DROP POLICY IF EXISTS before CREATE
- Seeding: INSERT ... ON CONFLICT DO NOTHING

### Rollback safety
- Each migration is independent BEGIN/COMMIT
- Column additions reversible (DROP COLUMN)
- Data backfill reversible (SET NULL then update)
- RLS policy drops restore previous state
- NO destructive operations (no DROP TABLE, no DROP COLUMN on non-new columns)

---

## N. BACKFILL PLAN

| Table | New Column | Backfill Strategy | Gate |
|-------|-----------|-------------------|------|
| brands.tenant_id | SET NOT NULL | Current 0 rows → nothing to backfill | Verify 0 pre-existing non-null before enforcement |
| brands.theme_tokens | JSONB | Parse existing color_scheme TEXT → `{primary:'#F97316',secondary:'#FBBF24',...}` or use defaults | Validate JSONB schema against controlled keys |
| brands.slug | TEXT | Generate from brands.name (slugify, lowercase, hyphenate) | Check for uniqueness conflicts within same tenant |
| brands.is_default | BOOLEAN | First active brand per tenant = true | Verify each tenant has exactly 1 default |
| businesses_settings.tenant_id | TEXT | Update ALL existing rows → 'tenant-bmb-001' | Verify count matches 5 (all existing keys) |
| mascot_overrides.tenant_id | TEXT | Update ALL existing rows → NULL (shared/default) | No data loss — NULL means "readable across all tenants" |
| mascot_overrides.brand_id | TEXT | Update ALL existing rows → NULL (shared/default) | No data loss |
| tenants.default_brand_id | TEXT | Set to first active brand for tenant-bmb-001 | Verify FK target exists in brands table |

**Backfill rule:** If ANY pre-existing non-default values found → HARD STOP → report exact mismatch counts → do NOT proceed until resolved.

---

## O. ROLLBACK PLAN

Each migration has explicit rollback steps:

1. **072 (brands constraints):** `ALTER TABLE brands DROP CONSTRAINT IF EXISTS brands_slug_key; ALTER COLUMN tenant_id DROP NOT NULL;`
2. **073 (seeding):** `DELETE FROM brands WHERE id = 'brand-bmb-001';`
3. **074 (default_brand_id):** `ALTER TABLE tenants DROP COLUMN IF EXISTS default_brand_id;`
4. **075 (settings tenant_id):** `UPDATE business_settings SET tenant_id = NULL; ALTER TABLE business_settings DROP COLUMN tenant_id;`
5. **076 (mascot extension):** `ALTER TABLE mascot_overrides DROP COLUMN IF EXISTS tenant_id, brand_id;`
6. **077 (RLS):** `DROP POLICY IF EXISTS brands_tenant_admin_manage; DROP POLICY IF EXISTS mascots_tenant_admin_manage;` (restores original is_admin() policies)

Rollback order: REVERSE — 077 → 076 → 075 → 074 → 073 → 072



 |

---

## P. ACCEPTANCE CRITERIA

### Functional
- [ ] New tenant can create multiple brands during setup
- [ ] Each brand has unique slug WITHIN its tenant (UNIQUE(slug, tenant_id) enforced)
- [ ] Public pages show correct brand identity (logo, colors, fonts) based on resolved tenant/brand
- [ ] Admin can toggle brand publish status without affecting other tenants' brands
- [ ] Mascot overrides can be scoped per brand or shared across all brands (NULL = shared default)
- [ ] Business settings scoped by tenant do not leak between tenants

### Technical
- [ ] brands.tenant_id = NOT NULL after migration
- [ ] brands.unique(slug, tenant_id) enforces per-tenant slug uniqueness
- [ ] tenants.default_brand_id references valid brand (FK constraint)
- [ ] business_settings.tenant_id enables per-tenant settings
- [ ] mascot_overrides.tenant_id + brand_id enables per-brand mascots (NULL = default)
- [ ] All new tenant_id columns have proper indexes
- [ ] UNMATCHED = 0 for all affected tables
- [ ] ROW LOSS = 0
- [ ] CROSS-TENANT ORDER REFS still = 0

### Security
- [ ] Tenant A admin CANNOT read Tenant B brands
- [ ] Tenant A admin CANNOT mutate Tenant B mascots
- [ ] Customer cannot access unpublished brand data
- [ ] RLS policies tested with negative isolation tests
- [ ] No cross-tenant data exposure via RPC endpoints

---

## Q. RISKS / BLOCKERS

| Risk | Severity | Mitigation |
|------|----------|------------|
| color_scheme TEXT to JSONB migration may produce invalid data | MEDIUM | Parse existing value OR provide default palette; store original in migration manifest as evidence |
| business_settings scope change breaks existing RPCs reading settings globally | HIGH | Review every RPC that reads business_settings; add tenant_id WHERE clause; test all order flows before deploy |
| Mascot overrides NULL behavior confusing to admins | LOW | Document clearly: NULL means no brand-specific override, use default BMB mascot |
| Slug uniqueness collisions across tenants | LOW | Composite unique constraint (slug, tenant_id) prevents collision entirely |
| Public read permissions on brands with tenant_id adds complexity | MEDIUM | Ensure brands_public_read policy filters by status=active AND includes implicit tenant routing context |
| Frontend CSS @theme block is build-time only — theme_tokens require runtime injection | HIGH | Theme tokens need dynamic DOM manipulation or server-side CSS injection — NOT a simple column addition |
| Subdomain routing requires DNS wildcard + edge functions (out of TEN-04 scope) | HIGH | Contract designs for Phase 2 compatibility ONLY. Phase 1 URL params sufficient for launch |

---

## R. OWNER DECISIONS REQUIRED

| # | Question | Recommended Option | Alternatives |
|---|----------|-------------------|--------------|
| D1 | Should brands inherit tenant_id from parent tenant automatically? | Yes, auto-inherit on creation | A) Auto-inherit (recommended) B) Manual entry C) Both |
| D2 | What is the initial/default brand for an existing tenant? | Use Bite Me Baby name as default | A) Existing BMB name=default (recommended) B) Require manual setup C) Auto-create from tenant name |
| D3 | Should theme_tokens replace hardcoded CSS entirely, or coexist? | Coexist initially with CSS fallback | A) Replace (breaks builds temporarily) B) Coexist with CSS fallback (recommended) |
| D4 | Should mascots be brand-scoped from day one, or remain global defaults? | Global defaults with optional brand overrides | A) Per-brand immediately B) Global default + brand override (recommended) |
| D5 | business_settings: migrate existing 5 keys to tenant-scoped, or keep global + add new tenant keys? | Keep existing global + add new tenant-prefixed keys | A) Move all 5 to tenant scope B) Keep current global, add tenant keys alongside (recommended) |
| D6 | Should brand slug be generated automatically, or require manual entry? | Auto-generate from name, allow override | A) Fully auto B) Fully manual C) Auto-generate with override (recommended) |
| D7 | Is tenants.default_brand_id needed, or resolve via slug directly? | Add to tenants table for routing speed/fallback | A) Add to tenants (recommended) B) Derive from brands C) URL parameters only |

---

## HARD STOP WAIT FOR OWNER APPROVAL

This is AUDIT + CONTRACT DESIGN only.
NO migration created.
NO schema modified.
NO RLS changed.
NO code altered.

Owner review and explicit approval required before any implementation begins.

If READY FOR OWNER APPROVAL state confirmed: return to this checkpoint and begin TEN-04 implementation per approved contract.
