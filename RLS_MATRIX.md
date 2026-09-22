# RLS_MATRIX — Bite Me Baby

> Version 2.0 | Baseline (this revision): `dc6e7ca` | Date: 2026-09-22 | Phase 3B · after migration 033
> Source of truth: LIVE local DB (supabase_db_ivkdfognyiwjcmrhcnwz) — policy layer from `pg_policies`,
> grant layer from `has_table_privilege` probe (`e2e/prodCheckGrants.cjs`).
> Version 1.x (Phase-B baseline, migrations 001/003/005) preserved in `RLS_MATRIX_v1_phaseB_baseline.md`.

## Legend
- **anon** = unauthenticated (anon key) · **auth** = authenticated (Auth JWT) · **admin** = `is_admin()`
- **S/I/U/D** = SELECT/INSERT/UPDATE/DELETE
- **Policy layer (RLS)**: which policies exist · **Grant layer (ACL)**: what PostgREST actually enforces
- **F-5 candidates** = permissive policy (USING=true / open) but NO grant → dormant, no real access

---

## 1. Policy layer (RLS) — post-033 state

| Table | anon | auth (user) | admin | Notes / F-5 |
|-------|------|-------------|-------|-------------|
| `products` | S WHERE is_available | S WHERE is_available | ALL | — |
| `product_categories` | S WHERE is_active | S WHERE is_active | ALL | — |
| `delivery_rounds` | S WHERE status=active | S WHERE status=active | ALL | — |
| `delivery_zones` | S WHERE is_active | S WHERE is_active | ALL | — |
| `promotions` | S WHERE is_active | S WHERE is_active | ALL | — |
| `orders` | S WHERE status IN (delivered,cancelled) | S own/uid; I own; U where-false (dead) | ALL | — |
| `reviews` | S WHERE is_verified | own S/I/U | ALL | — |
| `preorder_votes` | S true + I true (**active by design**, grants match) | S true + I true | ALL | storefront vote capture |
| `profiles` | S true F-5 (`profiles_public_read`) | S own (uid=id); U own (uid=id) | ALL | anon **grant-blocked**; reads route via `public_profiles` view (no-PII) |
| `payment_intents` | ALL true F-5 (`payment_intents_policy`) | own S; own I | ALL | **fully un-granted** — dormant; never add grants |
| `inventory` | S false (`inventory_anon_read`) | S true F-5 (`inventory_public_read`) grant-blocked | ALL | anon denied; auth read dormant |
| `inventory_transactions` | S false | own/admin | ALL | — |
| `media_assets` | S true F-5 | S true F-5 + I/U/D (**033 grant**) | ALL | anon dormant; auth S/I/U/D active (admin app) |
| `mascot_overrides` | S true (**033 anon grant**) | S/I/U/D (**033**) | ALL | storefront mascot fixed |
| `business_settings` | S false | S true (**033 grant — checkout 403 fixed**) | ALL | — |
| `content_approvals` | S false | S own/admin (**033 grant**) | ALL | — |
| `customers` | false | S own/admin | ALL | — |
| `drivers` | false | S true (granted 031-era) | ALL | — |
| `delivery_assignments` | false | S admin-or-driver-phone | ALL | — |
| `notification_prefs` | false | S/I/U/D own | ALL | — |
| `notifications` | false | S own; U own | ALL | — |
| `loyalty_points` | false | S own | ALL | — |
| `ai_conversations` | false | own-or-admin | ALL | — |
| `ai_recommendations` | false | own-or-admin | ALL | — |
| `ai_customer_memory` | false | own-read | ALL | — |
| `pre_orders` (024 archive) | S false | S own | ALL | **writes via SECURITY DEFINER RPC only; 033 revoked auth I/U/D** |
| `audit_logs` | false | S own or admin | ALL | — |
| `system_errors` | false | S admin | ALL | — |
| `provider_orders` | false | own | ALL | — |
| `production_batches` / `production_batch_items` | false | admin | ALL | — |

---
## 2. Grant layer (ACL) — after 033 (probe `e2e/prodCheckGrants.cjs`)

### anon (canonical read set)
- SELECT: `products`, `product_categories`, `delivery_rounds`, `reviews`, `promotions`,
  `preorder_votes`, `orders` (006 set) **+ `mascot_overrides` (033)** · **no write anywhere**
  · no REFERENCES/TRIGGER/TRUNCATE residue (033 cleaned every public rel)

### authenticated
- 006-era app set kept; `public_profiles` SELECT kept
- **033 new grants**: `business_settings` S · `content_approvals` S · `media_assets` S/I/U/D ·
  `mascot_overrides` S/I/U/D
- **033 revoked**: `pre_orders` I/U/D (archive = RPC-write-only) ·
  `public_profiles` I/U/D (**SECURITY: view runs with owner rights → view-write = RLS bypass**)

### service_role
- **033**: GRANT ALL on every public table+view, USAGE+SELECT on all sequences,
  + `ALTER DEFAULT PRIVILEGES FOR ROLE postgres` (future objects) — platform-canonical restore

---

## 3. Vulnerability postures changed by 033

| Item | Before 033 | After 033 |
|------|------------|-----------|
| `public_profiles` view-write (anon/auth had I/U/D from 004 wide-grant era) | **RLS bypass**: view executes as owner → `profiles` RLS never applies → cross-user profile write possible | **CLOSED** (auth I/U/D revoked; verified 401/403 via REST) |
| REFERENCES/TRIGGER/TRUNCATE residue (anon+auth, every public rel) | noisy ACL != policy | **cleaned** |
| `service_role` missing grants (Stripe webhooks/jobs 403) | degraded server-side paths | **restored** + defaults |
| storefront mascot broken (anon no SELECT on `mascot_overrides`) | dead feature | **fixed** (grant = `mascot_overrides_anon_read`) |
| checkout 403 (`business_settings`) | display-only degradation | **fixed** (grant = `business_settings_auth_read`) |
| AdminMedia / AdminMascot CRUD dead | admin UI 403 | **fixed** |

---

## 4. F-5 — permissive-but-un-granted policies (documented, dormant by design)

Wide-open policies that survive only because the grant layer blocks them.
**Defense-in-depth via grants — do NOT add grants without fixing the policy first:**

1. `payment_intents_policy` — ALL (S/I/U/D) for anon+authenticated, USING=true. Fully un-granted (dormant).
2. `inventory_public_read` — SELECT (anon,authenticated) USING=true. anon blocked by `inventory_anon_read=false`;
   auth un-granted. Dormant.
3. `profiles_public_read` — SELECT (anon,authenticated) USING=true. No anon/authenticated grant on `profiles`
   (reads route through `public_profiles` view). Dormant.
4. `recipes_anon_read` — SELECT anon USING=true. anon grant absent. Dormant.
5. `media_assets_public_read` — SELECT (anon,authenticated) USING=true. anon dormant;
   **authenticated grant (033) makes this ACTIVE** — by design (app media is public-read to signed-in users).

---

## 5. Verification status (2026-09-22, local stack)

| Suite | Result |
|-------|--------|
| `033` self-probe (during apply) | PASS |
| `e2e/prodCheckGrants.cjs` (grant probe) | 7/7 PASS — residue=0 · extra-select=0 · mascot anon=granted · profiles-write=0 · pre_orders-write=0 · new-grants=10/10 · service_role-missing=0 |
| Contract suites 023/028/029/030/033 (psql -f, BEGIN..ROLLBACK) | 5/5 exit=0 PASS |
| REST probe (local PostgREST :54331, forged auth JWT) | anon GET products → 200 · anon GET mascot_overrides → 200 · auth GET business_settings → 200 · auth POST public_profiles → **403** · anon POST public_profiles → **401** · anon GET business_settings → **401** |
| Registration | `schema_migrations` row `033|table_acl_alignment` |

> Production apply + verification: **PENDING** — requires owner `SUPABASE_ACCESS_TOKEN`
> (Management API) or a CLI login; see `AI_WORK_STATE.md` WAVE 3.

---

## 6. Historical baseline (v1.x, Phase B — superseded)

> Full text preserved in `RLS_MATRIX_v1_phaseB_baseline.md` (baseline `e6b3e65`, 2026-09-18,
> analysis of migrations 001/003/005). Summary of what was true then and is NOT true now:

- `orders` anon read was overbroad (`phone IS NOT NULL` → PII leak) — **closed later**
- `profiles` anon read ALL (PII leak) — closed by 006 → `public_profiles` no-PII view
- `inventory` public read (surplus/price leak) — closed by `inventory_anon_read=false`
- 9 tables were `p_public_all` permissive (anon CRUD) — all since policy-gated;
  grant layer re-verified by 033
- 004-era wide grants (`GRANT ALL ON ALL TABLES TO anon, authenticated`) — the residue
  that 031/032 (EXECUTE) and 033 (tables/views) repaired