# BMB TEN-06 HANDOFF â€” PRODUCTION CLOSURE PENDING

**Session End Date:** 2026-09-30  
**Previous Phase:** TEN-05 = PASS / DEPLOYED / PUSHED  
**Current Phase:** TEN-06 = PARTIAL (code complete, migration NOT deployed)  
**Next Phase:** TEN-06 Runtime Verification â†’ TEN-07 (Branch/Location Operations)

---

## ðŸ”´ BLOCKER â€” MUST BE DONE FIRST

### Migration Deployment (PENDING)

Two migrations must be deployed to production BEFORE any runtime verification:

#### 1. Migration 079 â€” Tenant CRUD RPCs + RLS Rewrite
File: `supabase/migrations/079_tenant_crud_rpc_and_rls.sql`

Contains:
- **RLS Rewrite:** tenants table policies changed from `is_admin()` to `tenant-aware is_tenant_admin(tenant_id)`
- **5 Canonical PostgreSQL RPCs:**
  - `tenant_list_admin()` â€” List all tenants (admin/tenant_admin role check)
  - `tenant_get_admin(p_tenant_id)` â€” Get single tenant (platformâ†’any, tenantâ†’own only)
  - `tenant_create_admin(p_name, p_slug)` â€” Create tenant (platform admin ONLY, slug normalization, duplicate check)
  - `tenant_update_admin(p_tenant_id, p_name, p_slug, p_status)` â€” Update tenant metadata (auth checks, slug uniqueness)
  - `tenant_set_status(p_tenant_id, p_status)` â€” Status toggle (enum validation active/inactive/suspended)

#### 2. Migration 080 â€” Default Brand Authority (Additive)
File: `supabase/migrations/080_tenant_default_brand.sql`

Contains:
- **1 Canonical PostgreSQL RPC:**
  - `tenant_set_default_brand(p_tenant_id, p_brand_id)` â€” Set default brand for tenant (brand must belong to same tenant, must be active+published)

### How to Deploy:

**Option A â€” Dashboard SQL Editor (recommended):**
1. Go to https://app.supabase.com/project/ivkdfognyiwjcmrhcnwz/sql/new
2. Copy/paste content of each migration file and Run separately
3. Verify no errors

**Option B â€” CLI (if authentication works):**
```bash
cd 'D:\A PROJECT\Bite Me Baby'
npx supabase db push --linked --include-all
```

âš ï¸ DO NOT proceed with runtime verification until migrations are deployed.

---

## âœ… WHAT IS ALREADY COMMITTED/PUSHED (Local Only)

HEAD = dac2530 | origin/main = dac2530 | WORKTREE DIRTY (4 files staged)

### Files Committed to Git:

| File | Type | Purpose |
|------|------|---------|
| `src/lib/adminTenantContext.ts` | NEW | Zustand store + hook for activeTenantId, activeBrandId, isAdminScopePlatform |
| `src/lib/adminTenantApi.ts` | NEW | Thin API wrapper calling all 6 PostgreSQL RPCs |
| `src/components/TenantSelector.tsx` | NEW | Popover dropdown UI for platform admins to list/select tenants |
| `src/pages/admin/AdminTenants.tsx` | NEW | Full tenant management page with create/edit/status/default-brand-selector |
| `src/config/platformConfig.ts` | MODIFIED | Removed hardcoded bmb-main, added dynamic fallback via BrandProvider |
| `src/lib/brandResolver.ts` | MODIFIED | Removed hardcoded tenant-bmb-001, added null-safe global fallback |
| `src/lib/bmbAdminApi_products.ts` | MODIFIED | All queries now respect adminTenantContext.activeTenantId |
| `src/lib/adminUi.ts` | MODIFIED | Added Tenants + Brands nav items to admin navigation |
| `src/App.tsx` | MODIFIED | Wire TEN-06 context initialization, added /admin/tenants route |
| `supabase/migrations/079_tenant_crud_rpc_and_rls.sql` | NEW | RLS rewrite + 5 RPCs (NEEDS DEPLOY) |
| `supabase/migrations/080_tenant_default_brand.sql` | NEW | Additive RPC for default brand authority (NEEDS DEPLOY) |

### Files NOT to Commit (Cleanup Scripts):
| File | Action |
|------|--------|
| `fix_admin_tenants.cjs` | DELETE before final commit (node.js helper script) |

---

## 📋 LOCAL GATE STATUS (Before Migration Deploy)

| Test | Result | Notes |
|------|--------|-------|
| tsc --noEmit | PASS | No TypeScript errors after code changes |
| vitest run | 331/331 PASS | No regression from baseline |
| eslint src/ | PASS | After running --fix |

---

## 🎯 NEXT SESSION TASKS — STEP BY STEP

### Step 1: Confirm Migration Deploy
Deploy migrations 079 + 080 via Dashboard SQL Editor OR CLI push before runtime verification.

### Step 2: Production Runtime Verification

RLS Tests: Verify policies exist with:
SELECT tablename, policyname, cmd, roles FROM pg_policies WHERE tablename = 'tenants';
Expected: tenants_platform_admin_manage, tenants_public_read, tenants_deny_anon_write

RPC Tests: Verify all 6 functions exist and callable:
SELECT routine_name FROM information_schema.routines WHERE routine_schema = 'public' AND routine_name LIKE 'tenant_%';
Expected: list_admin, get_admin, create_admin, update_admin, set_status, set_default_brand

Call SELECT * FROM tenant_list_admin(); as platform admin → should return tenant-bmb-001

Frontend Tests: Open /admin/tenants in browser as platform admin
- Tenant list renders, "+ Create Tenant" button visible
- Click Create -> fill form -> submit -> verify success toast
- Select different tenant from Active Context badge -> products/settings update accordingly

Isolation Tests: Switch to any tenant context -> open /admin/products
- Only products for that tenant shown (not all products)

### Step 3: Fix Any Issues Found During Runtime

### Step 4: Final Code Cleanup & Commit
cd D:\A PROJECT\Bite Me Baby && git add -A && git rm -f fix_admin_tenants.cjs 2>nul || true && git commit -m "TEN-06: Close tenant default brand authority + production closure" && git push origin main && prove HEAD == origin/main AND WORKTREE CLEAN

### Step 5: HARD STOP - Do NOT start TEN-07 in same session

---

## 📁 KEY FILE LOCATIONS

`
Project Root: D:\A PROJECT\Bite Me Baby

Migrations (NEED DEPLOY):
- supabase/migrations/079_tenant_crud_rpc_and_rls.sql  <- DEPLOY FIRST
- supabase/migrations/080_tenant_default_brand.sql     <- DEPLOY SECOND

Core TEN-06 Implementation:
- src/lib/adminTenantContext.ts    <- Zustand store + hook
- src/lib/adminTenantApi.ts        <- RPC thin wrappers (list/get/create/update/setStatus/setDefaultBrand)
- src/components/TenantSelector.tsx <- Popover UI component
- src/pages/admin/AdminTenants.tsx <- Full tenant management page

Modified Files (TEN-06 changes):
- src/config/platformConfig.ts     <- Dynamic tenant extraction from BrandProvider
- src/lib/brandResolver.ts         <- Null-safe global fallback
- src/lib/bmbAdminApi_products.ts  <- Admin context awareness (getProducts respects activeTenantId)
- src/lib/adminUi.ts               <- Added Tenants + Brands nav items
- src/App.tsx                      <- Route /admin/tenants + context wiring

Existing Dependencies (NOT created by TEN-06):
- src/store/resolvedBrandStore.ts   <- TEN-05 unchanged
- src/components/BrandProvider.tsx  <- TEN-05 unchanged
- src/store/cartStore.ts            <- TEN-05 unchanged
`

---

## ⚡ CRITICAL REMINDERS FOR NEXT AGENT

1. **DO NOT** assume migrations are deployed. Check production first.
2. **DO NOT** create fake second tenant for testing. Use existing tenant-bmb-001 only.
3. **DO NOT** change order schema, order_number, payment, or delivery state machine.
4. **DO NOT** bypass RLS to make UI work.
5. **ALWAYS** verify RPC calls against production using Supabase client.
6. **RUN** tsc + vitest + eslint after any code change before committing. Maintain 331/331 test pass rate.
7. **HARD STOP** after TEN-06 closes — do NOT start TEN-07 in same session.
8. **BRANCH concept is DEFERRED** to TEN-07 — no schema changes for it now.
9. **DISTANCE CONFIGURATION is DEFERRED** — still hardcoded 5km at delivery.biteDriveMaxDistanceKm.
10. **White-label config is PARTIAL** — PlatformConfig works but distance settings not yet DB-driven.

---

*Document created: 2026-09-30 by TEN-06 implementation agent*
*Status: Code complete, pending production migration deployment*
*Next agent action: Deploy migrations -> Runtime verify -> Finalize TEN-06*
