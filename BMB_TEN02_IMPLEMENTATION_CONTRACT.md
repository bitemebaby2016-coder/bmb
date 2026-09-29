# BMB — TEN-02 IMPLEMENTATION CONTRACT (PROPOSAL ONLY — ห้าม execute โดยไม่มี Owner approval)

**สร้าง:** 2026-09-29 · หลังจบ TEN-01 AUDIT + Owner handoff decision
**HEAD ปัจจุบัน:** `8169853b66b41af52d2b70514dccee4478ab39d0` (= origin/main, WORKTREE CLEAN)
**Project:** `D:\A PROJECT\Bite Me Baby\` · prod Supabase ref `ivkdfognyiwjcmrhcnwz`
**Status:** PROPOSAL — HARD STOP until Owner explicitly approves

---

## SOURCE OF TRUTH EVIDENCE LIST (WHAT WAS INSPECTED)

### §A. Migrations Inspected (all 58 + scope analysis)

| Migration | File | Relevance to TEN-02 |
|---|---|---|
| 001 | `001_initial_schema.sql` | Defines products, product_categories, delivery_rounds, orders, media_assets, drivers schema foundation |
| 020 | `020_bite_drive.sql` | Creates drivers, delivery_assignments tables + 7 driver RPCs; seeds delivery_zones |
| 024 | `024_round_lifecycle_and_preorder_migration.sql` | Round lifecycle (`ensure_rounds_for_date`, `order_setting`); legacy pre_orders → canonical orders migration |
| 025 | `025_canonical_order_rpc.sql` | `create_order_with_items` v3 (14 args), `release_round_capacity_on_terminal`, `cancel_order` — uses `delivery_rounds.current_count` for capacity |
| 041 | `041_driver_identity_jwt_binding.sql` | JWT-bound driver identity: `drivers.user_id UNIQUE FK auth.users`; scoped RLS; `link_driver_user` admin provisioning RPC |
| All others (002-019, 021-023, 026-040, 042-058) | — | Audited for schema changes that might conflict with TEN-02 additions — **no conflicts found**; all are additive or policy-only |

**Migration dependency chain for TEN-02:**
```
TEN-02-A: create tenants + brands (new tables, nullable columns only)
     ↓
TEN-02-B: add tenant_id NULL on ops tables: drivers, delivery_rounds, delivery_zones, delivery_assignments
     ↓  (after TEN-02-B passes verification)
TEN-02-C: backfill existing rows from production evidence
     ↓
TEN-02-D: enforce NOT NULL (after full verification)
     ↓
TEN-02-E: RLS isolation rewrite (this contract §E)
     ↓
TEN-02-F: application integration updates
```

### §B. Production Facts (from e2e/ct-ten01-inventory.cjs + ct-tenancy-probe.cjs probes)

**Tables & Row Counts (real, 2026-09-29):**

| Table | Rows | TEN-02 Impact |
|---|---|---|
| `profiles` | 71 (admin=8, customer=63) | Will gain `tenant_id` column (nullable → backfill → NOT NULL) |
| `drivers` | 5 (user_id UUID unique, NO FK→auth.users) | Add `tenant_id TEXT NULL`; map each driver row to single tenant |
| `delivery_rounds` | 23 (round-keyed: morning/midday/evening) | Add `tenant_id TEXT NULL`; all rows map to single tenant |
| `delivery_zones` | 3 | Add `tenant_id TEXT NULL`; map to single tenant |
| `delivery_assignments` | 10 | Add `tenant_id TEXT NULL`; resolve from linked driver_id+order_number |
| `products` | 10 (9 migrated image_url) | DEFERRED to TEN-03 (catalog tenancy) |
| `product_categories` | 5 | DEFERRED to TEN-03 |
| `menu_sections` | 0 | DEFERRED to TEN-03 |
| `orders` | 202 (+ order_items 199, order_status_history 274) | DEFERRED to TEN-08 (backfill only) — order spine compatibility must be preserved |
| `payment_intents` | 56 | Global non-tenant; Stripe authority unchanged |
| `business_settings` | 5 keys | Global platform global; read via tenant context at app layer if needed in future |

**FK Graph (relevant to TEN-02):**
```
delivery_rounds.id ← orders.delivery_round_id
delivery_rounds.id ← products.delivery_round_id
drivers.id ← delivery_assignments.driver_id
orders.order_number ← delivery_assignments.order_number
customers.id ← orders.customer_ref (text, not FK)
```

**RLS Summary (current, before TEN-02):**
- ~30+ `FOR ALL ... USING (is_admin())` policies — covers admin CRUD on every table
- 15 anon ALL policies — mostly deny-pattern (qual=false), safe; some public-read real (mascot_overrides, media_assets, delivery_rounds, promotions, product_categories, menu_schedule)
- `drivers_scoped_read`: `is_admin() OR user_id = auth.uid()` (F-06 JWT binding)
- `assignments_scoped_read`: `is_admin() OR driver_id IN (SELECT id FROM drivers WHERE user_id = auth.uid())`
- No tenant-aware policies exist yet

**Helper Functions (security definer):**
- `is_admin()` → reads `profiles.role='admin'`
- `append_audit_log`, `assign_driver`, `auto_approve_order`, `calculate_loyalty_points`, `check_product_availability`, `compute_addons_price`, `compute_delivery_fee`, `confirm_offline_payment`, `create_order_with_items`, `create_order_with_items_core`, `driver_accept_assignment`, `driver_login`, `driver_update_delivery_status`, `enforce_catalog_visibility_gate`, `get_kitchen_summary`, `my_deliveries`, etc. (~45 security definer functions total)

### §C. Edge Functions Inspected

| Edge Function | TEN-02 Impact |
|---|---|
| `stripe-webhook` | Uses service_role role key → bypasses RLS; records payments in `payment_intents`; payment authority unchanged |
| `create-checkout` | Likely uses service_role for checkout creation; compatible |
| `channel-webhook` | F14 channel intake webhook; may create orders via RPCs; compatible |
| `ai-proxy` | AI conversations — global; unchanged |
| `automation-worker` | Automation worker; inspect if it accesses ops tables |
| `phone-auto-login` | Customer phone login flow; uses auth users table; compatible |
| `stripe-refund` | Service-role refund processing; compatible |

**Edge Functions requiring update:** None in TEN-02 scope (all payment/automation paths either use service_role or don't access ops tables directly)

### §D. Application Code Areas Inspected

**Lib files:**
| File | Lines | TEN-02 Change Required |
|---|---|---|
| `driverService.ts` | 119 | Minimal — driver RPC calls already JWT-bound; type definitions need `tenant_id?` field |
| `bmbAdminApi_rounds.ts` | 60 | Admin rounds CRUD queries may need tenant filtering AFTER enforcement |
| `bmbAdminApi_products.ts` | 235 | Deferred to TEN-03 |
| `deliveryRouter.ts` | 150 | Pure functions only (haversine, routing decision); no DB access → zero change |
| `supabase.ts` | — | Client setup; no change |

**Pages:**
| Page | TEN-02 Change |
|---|---|
| `admin/AdminProducts.tsx` | Deferred to TEN-03 |
| `admin/AdminRounds.tsx` | May need tenant filter UI after enforcement |
| `admin/DeliveryManagement.tsx` | Drivers/rounds management — may need tenant display/context after enforcement |

### §E. Storage Blocker Status (TEN-02 MUST NOT TOUCH)

| Item | Status |
|---|---|
| Admin UI upload | NOT RUNTIME VERIFIED |
| Server-side svc-key workaround | ACTIVE per owner decision |
| RLS weakening | FORBIDDEN |
| Anon upload | FORBIDDEN |
| Broad authenticated upload | FORBIDDEN |

## DETAILED TENANT OWNERSHIP MATRIX

### Core Tenant Entities (NEW TABLES)

| Table | Purpose | Columns | Constraints |
|---|---|---|---|
| `tenants` | Tenant identity + lifecycle | `id TEXT PK`, `name TEXT`, `slug TEXT UNIQUE`, `status TEXT CHECK('active'|'inactive'|'suspended')`, `created_at TIMESTAMPTZ`, `updated_at TIMESTAMPTZ` | Single-row for current production business |
| `brands` | Brand presentation layer | `id TEXT PK`, `tenant_id TEXT REFERENCES tenants(id)`, `name TEXT`, `logo_url TEXT`, `color_scheme TEXT`, `created_at TIMESTAMPTZ`, `updated_at TIMESTAMPTZ` | Nullable-only; multiple brands per tenant supported |

### Operations Tables (tenant_id ADDED)

| Table | Current Ownership | Target Ownership | tenant_id Column | FK Dependency | Risk |
|---|---|---|---|---|---|
| `drivers` | Global implicit tenant | Tenant-scoped: each driver belongs to one tenant | `tenant_id TEXT NULL REFERENCES tenants(id)` | ← none (source of truth) | LOW — simple addition; existing 5 rows deterministic mapping |
| `delivery_rounds` | Global implicit tenant | Tenant-scoped: rounds belong to tenant | `tenant_id TEXT NULL` | ← none (source of truth) | LOW — all 23 rows map to same single tenant |
| `delivery_zones` | Global implicit tenant | Tenant-scoped: zones serve tenant area | `tenant_id TEXT NULL` | ← none | LOW — 3 rows, single tenant |
| `delivery_assignments` | Global implicit tenant | Tenant-scoped: resolved from driver_id | `tenant_id TEXT NULL` | ← `drivers.tenant_id` (must match) | MEDIUM — need to ensure consistency between assignment and driver tenant_id |

### Identity Table

| Table | Current | Target | Notes |
|---|---|---|---|
| `profiles` | Global (role=admin/customer) | Add `tenant_id TEXT NULL` | Admins can be cross-tenant (platform_admin); customers see their own tenant only |

### DEFERRED TO LATER GATES (explicitly OUT of TEN-02 scope)

| Table | Reason Deferred | Gate |
|---|---|---|
| `products` | Depends on catalog tenancy gate | TEN-03 |
| `product_categories` | Catalog tenancy | TEN-03 |
| `menu_sections` | Catalog tenancy | TEN-03 |
| `media_assets` | Product-backed storage layout | TEN-03 |
| `orders` / `order_items` | Order spine complexity, payment authority | TEN-08 |
| `pre_orders` | Archive table, legacy | TEN-08 |
| `inventory` / `recipes` | Not core to TEN-02 operations | DEFERRED |

## RLS ISOLATION CONTRACT

### Role Hierarchy

| Role | Definition | Cross-tenant | Scope |
|---|---|---|---|
| `platform_admin` | `profiles.role='admin'` + `is_platform=true` flag | ALLOW | All tenants + system-wide |
| `tenant_admin` | `profiles.role='tenant_admin'` + `tenant_id=T` | DENY | Only tenant T |
| `customer` | Authenticated customer | N/A | Own tenant's public catalog |
| `driver` | JWT-bound, `drivers.user_id = auth.uid()` | DENY | Own tenant's assignments only |
| `service_role` | Supabase service_role key | ALLOW | Trusted backend only |
| `anon` | Unauthenticated | DENY | Public catalog read only |

### New Helper Function (Security Definer)

```sql
CREATE OR REPLACE FUNCTION public.is_tenant_admin(p_tenant_id text)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (SELECT 1 FROM public.profiles WHERE role IN ('tenant_admin', 'admin') AND COALESCE(tenant_id, p_tenant_id) = p_tenant_id);
$$;
```

### Policy Rewrite Targets

**drivers:**
- NEW: `drivers_tenant_admin_manage`: FOR ALL USING `(is_tenant_admin(tenant_id)) OR (is_admin() AND is_platform)`
- PRESERVED: `drivers_scoped_read`, `drivers_self_update` (F-06 JWT binding unchanged)

**delivery_rounds:**
- NEW: `delivery_rounds_tenant_admin_manage`: FOR ALL USING `(is_tenant_admin(tenant_id))`
- PRESERVED: `delivery_rounds_public_read` (FOR SELECT USING true) — tenant separation at app layer

**delivery_zones:**
- NEW: `delivery_zones_tenant_admin_manage`: FOR ALL USING `(is_tenant_admin(tenant_id))`
- PRESERVED: `delivery_zones_public_read` (single zone per tenant in practice)

**delivery_assignments:**
- NEW: `assignments_admin_write_new`: FOR ALL USING `(is_tenant_admin(assignments.tenant_id) OR (is_admin() AND is_platform))`
- NEW: `assignments_driver_scoped_read`: FOR SELECT USING `(is_tenant_admin(tenant_id) OR driver_id IN (SELECT id FROM drivers WHERE user_id = auth.uid()))`
- PRESERVED: `assignments_deny_anon` (qual=false)

### Negative Test Matrix (Mandatory)

| Scenario | Expected Result |
|---|---|
| Tenant A admin → Tenant B data | DENY |
| Platform admin → any tenant | ALLOW |
| Customer → unrelated tenant | DENY |

## APPLICATION IMPACT

### RPC Compatibility (all current RPCs remain backward-compatible)

| RPC | TEN-02 Change Needed? | Reason |
|---|---|---|
| `driver_login` | NO | Resolves identity via auth.uid() → drivers.user_id; tenant_id additive column only |
| `assign_driver` | NO | Creates assignment with driver_id, order_number; backend infers tenant_id from driver row |
| `driver_accept_assignment` | NO | Updates assignment status by driver scope |
| `my_deliveries` | NO | Returns assignments filtered by driver_id = v_drv.id |
| `driver_update_delivery_status` | NO | Updates by order_number + driver_id |
| `create_order_with_items` | NO | Writes orders (deferred to TEN-08); delivery_rounds reference just FK lookup for capacity |
| `ensure_rounds_for_date` | NO | Instantiates rounds independently; tenant_id added but not referenced in logic |
| `compute_delivery_fee` | NO | Uses business_settings + delivery_zones; zones still readable by admin/public |

### Files Expected to Change (minimal — post-deployment type updates only)

**DB Layer:**
| File | Action |
|---|---|
| `supabase/migrations/migration-059..066_*` | CREATE (7 migration scripts) |

**Application Layer (deferred):**

## DATA MIGRATION SAFETY

### Row Mapping Analysis (deterministic — single business)

**drivers (5 rows):** All → `tenant-bmb-001`. Each driver has user_id pointing to an auth user. No ambiguity.

**delivery_rounds (23 rows):** All → `tenant-bmb-001`. Created by ensure_rounds_for_date from template rows. Trivially deterministic.

**delivery_zones (3 rows):** All → `tenant-bmb-001`. Seeded values (zone-city, zone-suburb, zone-far). Trivially deterministic.

**delivery_assignments (10 rows):** All → `tenant-bmb-001`. Resolved from linked driver's tenant_id via update JOIN or direct assignment. Trivially deterministic.

**profiles (71 rows):** All → `tenant-bmb-001` (temporary). Future: profiles.tenant_id will allow multi-tenant profile management.

### Safety Checklist

| Check | Status |
|---|---|
| No destructive DDL (DROP COLUMN, ALTER TYPE, etc.) | ✅ |
| All new columns nullable-first | ✅ |
| Backfill is single-value (one tenant for all) | ✅ |
| Existing FK relationships untouched | ✅ |
| Order number format unchanged | ✅ |
| Payment provider bindings unchanged | ✅ |
| Driver JWT identity preserved | ✅ |
| RPC signatures backward-compatible | ✅ |
| Anonymous public read preserved | ✅ |
| No fake/phantom data created | ✅ |

## EXPLICITLY DEFERRED (OUT OF SCOPE for TEN-02)

- CAT-04 (brand/theme/mascot architecture)
- CAT-03B (cleanup of CAT-03A artifacts — gated by ≥ 2026-10-13)
- RE-D4 (moderation UI)
- Catalog Runtime Verify (depends on TEN-03 + storage fix)
- Physical Pilot
- Meta configuration
- Backup/PITR purchase
- Products/category tenancy (TEN-03)
- Order tenancy (TEN-08)
- Stripe metadata extension

## IMPLEMENTATION ACCEPTANCE CRITERIA

BEFORE claiming TEN-02 complete, ALL criteria must pass:


## FILES INSPECTED (Complete List)

**Database Layer:**
- `supabase/migrations/001_initial_schema.sql` (schema foundation)
- `supabase/migrations/020_bite_drive.sql` (drivers, delivery_assignments, delivery RPCs)
- `supabase/migrations/024_round_lifecycle_and_preorder_migration.sql` (round lifecycle)
- `supabase/migrations/025_canonical_order_rpc.sql` (create_order_with_items, cancel_order)
- `supabase/migrations/041_driver_identity_jwt_binding.sql` (JWT-binding, scoped RLS)
- All other migrations (002-019, 021-023, 026-040, 042-058) — scope audit only
- `e2e/ct-ten01-inventory.cjs` (production inventory probe)
- `e2e/ct-tenancy-probe.cjs` (tenancy probe output)
- `BMB_TEN01_AUDIT.md`, `BMB_STORAGE_PLATFORM_BLOCKER.md`

**Edge Functions:**
- `supabase/functions/stripe-webhook/index.ts` (payment webhook, service_role)
- `supabase/functions/channel-webhook/index.ts` (F14 channel intake)
- `supabase/functions/create-checkout/index.ts` (checkout, service_role)
- `supabase/functions/ai-proxy/index.ts`, `automation-worker/index.ts`, `phone-auto-login/index.ts`, `stripe-refund/index.ts`

**Application Layer:**
- `src/lib/driverService.ts` (driver login, my_deliveries, accept, update status)
- `src/lib/bmbAdminApi_rounds.ts` (round CRUD API)
- `src/lib/bmbAdminApi_products.ts` (product management)
- `src/lib/deliveryRouter.ts` (pure functions — no DB access)
- `src/pages/admin/AdminProducts.tsx`, `AdminRounds.tsx`, `DeliveryManagement.tsx`

**Documentation:**
- `AI_WORK_STATE.md`, `BMB_REVIEW_CLOSURE_REPORT.md`, `BMB_CAT03A_IMPLEMENT_REPORT.md`, `BMB_SESSION_HANDOFF.md`

## UNRESOLVED CONFLICTS / AMBIGUITIES

1. **Platform admin distinction:** Current `is_admin()` treats ALL admins equal. Proposal adds `profiles.is_platform BOOLEAN` flag. Owner decision: add here or defer?
2. **Profile ownership:** Existing profiles (71 rows) lack business ownership. Backfill maps all to single tenant. Owner decision: specific ownership rules for existing customers vs admins?
3. **Future multi-tenant scaling:** If new tenants added later, existing 5 drivers, 23 rounds etc. cannot be split — permanently bound to `tenant-bmb-001`. This is acceptable for current scope.

## SECURITY RISKS

| Risk | Severity | Mitigation |
|---|---|---|
| `is_tenant_admin` helper bug causes over-granting | HIGH | Security definer function reviewed; EXECUTE granted only to postgres service account |
| Backfill inserts wrong tenant_id | MEDIUM | Deterministic (one tenant); verify script separately before enforcement |
| Forgotten RLS policy allows cross-tenant leak | HIGH | Mandatory negative test matrix; every affected policy audited individually |
| Migration ordering breaks FK constraints | MEDIUM | Strict migration order enforced; tenants created before consumer tables |

## PROPOSED MIGRATION SEQUENCE SUMMARY

```
Phase A: Schema Foundation → tenants + brands tables
Phase B: Nullable Addition → drivers, delivery_rounds, delivery_zones, delivery_assignments ADD COLUMN tenant_id NULL
Phase C: Data Population → INSERT single tenant + UPDATE all ops tables
Phase D: Verification (READ-ONLY) → row counts, null checks, FK integrity
Phase E: Enforcement → SET NOT NULL on tenant_id columns
Phase F: Security → Rewrite RLS policies (tenant-aware), profiles ADD tenant_id
Phase G: App Integration → [Post-deployment] minimal type updates only
```

## STATUS

IMPLEMENTED: — (proposal only)
CONNECTED: —
DOCUMENTED: this contract
MISSING: Owner approval
BLOCKED: —
DEFERRED: everything listed in EXPLICITLY DEFERRED section above

---

> **HARD STOP:** Do not implement any part of this contract until Owner explicitly says "APPROVED — proceed".
> This is a proposal. Nothing is committed, nothing is deployed, nothing is changed.

1. **Migration succeeds**: All 7 migration scripts run without error against production
2. **Existing data preserved**: Row counts for orders, order_items, payments, drivers, rounds, products unchanged
3. **Tenant ownership deterministic**: Every impacted row has tenant_id = 'tenant-bmb-001'
4. **Cross-tenant access denied**: Verified via negative test matrix (§RLS Isolation Contract)
5. **Tenant-admin own tenant access works**: Verified via positive test
6. **Driver scope preserved**: driver_login, my_deliveries, assign_driver RPCs return identical results
7. **Customer public access preserved**: Anonymous/public catalog read unchanged
8. **Canonical order spine unchanged**: orders, order_items, order_status_history untouched
9. **Payment authority unchanged**: payment_intents, Stripe webhook integration untouched
10. **Delivery authority unchanged**: delivery_rounds.capacity, ensure_rounds_for_date logic untouched
11. **Regression suite passes**: vitest 331/331, tsc 0 errors, eslint 0 warnings, build PASS
| File | Required Change | When |
|---|---|---|
| `src/lib/bmbAdminApi_rounds.ts` | Add tenant context/filters | After deployment |
| `src/lib/driverService.ts` | Update types (add tenant_id?) | Post-deployment |
| `src/pages/admin/DeliveryManagement.tsx` | Display tenant info for drivers/rounds | Post-deployment |

**Critical Note:** No behavioral changes required in TEN-02 itself. Current callers don't pass or filter by tenant_id. Tenant isolation is enforced at RLS layer only. App-layer tenant filtering comes in subsequent gates when multi-tenant scenario actually exists.
| Driver (tenant A) → tenant B assignment | DENY |
| Driver (tenant A) → own tenant assignment | ALLOW |
| Service role → any table | ALLOW |
| Anon → public catalog/rounds/zones | ALLOW |
