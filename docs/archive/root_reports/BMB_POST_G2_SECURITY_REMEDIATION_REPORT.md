# BMB — POST-G2 SECURITY REMEDIATION REPORT

วันที่: 2026-10-02 · Owner command: POST-G2 SECURITY REMEDIATION + G3 READINESS GATE
Precondition: G2-RV = PASS (Owner-certified, BMB_GATE2_ASSET_BRAND_CONTROL_REPORT.md)

## LEGACY FUNCTION AUDIT (Phase 1)

Function: `public.is_tenant_admin(p_tenant_id text)` — STABLE, SECURITY DEFINER, `SET search_path='public'`, owner postgres, GRANT authenticated/service_role, REVOKE PUBLIC.

Defect (confirmed on production dump + live probe):
```sql
SELECT role, COALESCE(tenant_id,'tenant-bmb-001') INTO v_role, p_tenant_id FROM profiles ...
-- p_tenant_id OVERWRITTEN by caller tenant => final compare caller==caller => always TRUE
-- live pre-fix probe: is_tenant_admin('tenant-b') = true as tenant-A admin
```

### Caller matrix (production DB via pg_dump schema — ไม่พึ่ง repo search เพียงอย่างเดียว)

| Caller | Uses `is_tenant_admin()`? | Expected semantics | Risk if replaced | Replacement |
|---|---|---|---|---|
| RLS addon_groups_tenant_admin_manage | YES (USING+CHECK, row tenant_id) | caller admin of row tenant | none — canonical semantics | fixed in place |
| RLS addons_tenant_admin_manage | YES | same | none | fixed in place |
| RLS brands_tenant_admin_manage | YES | same | none | fixed in place |
| RLS business_settings_branch_admin_manage | YES (branch_id IS NULL branch) | same | none | fixed in place |
| RLS mascots_tenant_admin_manage | YES (tenant branch; NULL rows allowed by policy's own OR-branch, not by fn) | same | none | fixed in place |
| RLS menu_schedule_tenant_admin_manage | YES | same | none | fixed in place |
| RLS menu_sections_tenant_admin_manage | YES | same | none | fixed in place |
| RLS product_addon_groups_tenant_admin_manage | YES | same | none | fixed in place |
| RLS product_categories_tenant_admin_manage | YES | same | none | fixed in place |
| RLS products_tenant_admin_manage | YES | same | none | fixed in place |
| RLS media_assets_tenant_write | NO — uses is_tenant_admin_of (106) | — | — | — |
| Views / triggers / function bodies / RPCs | NONE (0 hits in pg_dump; 0 pg_depend view refs) | — | — | — |
| Frontend / admin API / scripts / tests / automation | NONE (repo search 694 files: docs only, 0 code refs) | — | — | — |

Production data preconditions (live probes):
- NULL-tenant rows in the 10 caller tables: **0 / 10 tables** → strict NULL deny = no lockout
- profiles: 71 rows, ALL tenant_id='tenant-bmb-001'; roles: 1 platform admin (is_platform), 7 tenant admin, 63 customer → no NULL-caller fallback needed
## CONTRACT DECISION (Phase 2)

Canonical = `is_tenant_admin_of(p_tenant_id)` semantics, proved against migration 106 deployed body:
1. caller tenant == target tenant
2. platform admin explicit (profiles.is_platform, checked before tenant match)
3. no cross-tenant
4. NULL no bypass - HOLE FOUND in deployed is_tenant_admin_of: COALESCE(p_tenant_id,'') vs caller '' => ''=''=TRUE; tightened in 108 (explicit NULL/'' deny)
5. SECURITY DEFINER + SET search_path='public' (both)
6. authority derives from auth.uid() only
7. parameter never overwritten (local v_target)

## MIGRATION DESIGN (Phase 3)

`108_remediate_tenant_authority.sql` (NEW migration; historical files untouched):
- replaces BOTH function bodies in place, signatures preserved (10 policies keep working)
- parameter shadowing fixed: local v_target, no SELECT INTO p_tenant_id
- explicit NULL/empty-target DENY in both functions
- NULL-caller-tenant admin: DENY (no 'tenant-bmb-001' fallback mapping)
- platform behavior preserved explicitly; no privilege broadening; grants re-asserted
- compatibility: verified no lockout possible (0 NULL rows, all profiles tenant-set)

## SECURITY TEST MATRIX (Phase 4 - isolated DB, real role switching + JWT claims)

T12 admin-a: own=ALLOW / cross=DENY (legacy fn) | T13 admin-b symmetric | T14 admin-a via is_tenant_admin_of
T15 anonymous=DENY (ACL: no EXECUTE) | T16 NULL/empty target=DENY (both fns) | T16b NULL-caller-tenant admin=DENY
T17 parameter integrity: no INTO p_tenant_id in either body | T18 platform admin explicit ALLOW
T19 products cross-tenant write DENIED via RLS (remediated fn) | T19b own-tenant write allowed (no lockout)
ALL PASSED (isolated)

## REGRESSION (Phase 5)

- RLS matrix T1-T11 with 108 applied: ALL PASSED (T1 updated to post-106 contract: anon SELECT on media_assets public-read boundary; orders denied; active-only)
- migration 107 isolated note: production data migration (preconditions production-specific); policy/FK behavior covered by T11+T19
- npm test: 367/367 PASS | lint PASS | build PASS (3.63s)
- secret scan: 0 real secrets (3 comment-only mentions of service_role)

## PRODUCTION VERIFICATION (Phase 6 - read-only probes, BEGIN/ROLLBACK, no data mutation)

| Probe | Result |
|---|---|
| is_tenant_admin('tenant-bmb-001') as tenant admin | TRUE |
| is_tenant_admin('tenant-b') as tenant admin | FALSE (pre-fix: TRUE) |
| is_tenant_admin_of cross / NULL | FALSE / FALSE |
| is_tenant_admin(NULL) / is_tenant_admin_of(NULL) as tenant admin | FALSE / FALSE |
| platform admin cross-tenant | TRUE (explicit) / NULL target FALSE |
| parameter integrity on prod def | no shadowing, param copied, search_path safe |
| anonymous | deny-by-ACL (REVOKE PUBLIC; grant only authenticated/service_role - verified in prod dump) |

108 deployed to production: EXIT=0.

## BRAND-SCOPE READINESS AUDIT (Phase 7)

Authority model: profiles.role + tenant_id ONLY - no brand-level admin concept exists (arch docs + schema confirm).

| Dimension | Evidence | Verdict |
|---|---|---|
| TENANT AUTHORITY | T20: tenant admin mutates BOTH A1+A2 brand assets (same tenant, by design) | tenant-scoped governance |
| BRAND AUTHORITY | T21: cross-tenant brand asset DENIED - boundary is tenant-level RLS + brand FK, NOT brand-level RLS | partial - per-brand operation scoping remains app-layer (as G2 report stated) |
| PLATFORM AUTHORITY | T18/T9: platform admin explicit cross-tenant + global | full |
| PUBLIC READ | T22 + T1: active A1+A2 visible, inactive hidden, orders denied | active-only boundary |
| Runtime resolver | T23 precondition + browser E2E I+H: approved wins per brand_id; wrong-brand selection impossible via tenant boundary + brand_id keying | precondition verified |

NOT full brand isolation - evidence = FK integrity + tenant RLS + active-only public read. A tenant admin CAN mutate both its brands assets; brand-level authority separation would require new design (defer to G3 contract).

## VERDICT

| Gate | Status |
|---|---|
| LEGACY FUNCTION AUDIT | PASS (10 policies, 0 other callers, defect root-caused) |
| CALLER AUDIT | PASS (production pg_dump + repo, matrix above) |
| REMEDIATION | PASS (migration 108, signatures preserved, no broadening) |
| RLS REGRESSION | PASS (T1-T11 + T12-T23, 367 unit tests, lint, build) |
| PRODUCTION VERIFICATION | PASS (read-only probes table above) |
| BRAND-SCOPE AUDIT | PASS with explicit limitation (tenant-level authority; no brand-level RLS by design) |
| tests/lint/build | PASS |
| HEAD == origin/main | PASS (post-push verify) |
| WORKTREE | CLEAN |

G3 READY = YES - legacy tenant authority = safe, RLS regression = PASS, brand-scope semantics = explicit, production verification = PASS.

Per Owner command: STOP - G3 implementation NOT started; awaiting Owner review of this report.
