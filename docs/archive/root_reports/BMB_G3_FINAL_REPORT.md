# BMB G3 — SOCIAL EVENTS FOUNDATION · FINAL REPORT

วันที่: 2026-10-02 · Owner decisions locked: D1 G3=Social Events Foundation · D2 schema §6 + UNIQUE(platform,event_id) + 90-day retention · D3 Auto-Post single-brand · Hard constraints HC-1..HC-7 ตาม Owner command

Status legend: IMPLEMENTED / CONNECTED / DEPLOYED / RUNTIME VERIFIED / CODE VERIFIED / DOCUMENTED / MISSING / BLOCKED / DEFERRED

## Migration

| Item | Status |
|---|---|
| Migration ID | **109_g3_social_events_foundation.sql** — IMPLEMENTED + DEPLOYED (production EXIT=0, no ERROR lines) |
| `social_events` table (full §6 partition: ingestion / processing state 7 statuses / AI state / action state / reply delivery / audit) | IMPLEMENTED + DEPLOYED |
| `uq_social_events_platform_event` UNIQUE(platform,event_id) | IMPLEMENTED + DEPLOYED (unique_ok=1 probe) |
| brand→tenant integrity FK `fk_social_events_brand_tenant (tenant_id,brand_id)→brands(tenant_id,id)` (107 boundary) | IMPLEMENTED + DEPLOYED |
| `channel_page_bindings` (server-side page→tenant mapping, platform_admin ALL policy, service_role grants) | IMPLEMENTED + DEPLOYED |
| CHECK constraints: identifiers <> '', platform/event_type/status/action_type/reply_status enums | IMPLEMENTED + DEPLOYED |
| Retention 90 days | DOCUMENTED (cleanup scheduler intentionally NOT created — Owner D2) |

## RLS / grants (production-verified probes)

| Item | Status |
|---|---|
| social_events anon access | RUNTIME VERIFIED — **anon_grants=0** (ACL DENY; probe anon_exec=false) |
| social_events authenticated | RUNTIME VERIFIED — SELECT only (auth_select=1); EXECUTE on ingest = false (probe4) |
| social_events service_role | DEPLOYED — ALL grants (ingestion transport only, HC-2) |
| Policy social_events_tenant_read (SELECT, is_tenant_admin_of) | DEPLOYED + RUNTIME VERIFIED (isolated S6c/S6d) |
| Policy social_events_platform_read (SELECT, is_platform_admin) | DEPLOYED + RUNTIME VERIFIED (isolated S6e) |
| Policy channel_page_bindings_platform_admin (ALL, platform only) | DEPLOYED + RUNTIME VERIFIED (isolated S7: tenant admin hidden via ACL deny) |
| Row-level behavior proven on isolated DB (S1–S8) | RUNTIME VERIFIED — production matches via identical deployed definitions |

## Webhook boundary (Owner hard constraints)

| Item | Status |
|---|---|
| HMAC verification (raw-body HMAC-SHA256, invalid → 401 pre-fetch) | CODE VERIFIED + RUNTIME VERIFIED (harness test 2) |
| Fail-closed: APP_SECRET missing → 500 no processing; VERIFY_TOKEN missing → 500 | CODE VERIFIED + RUNTIME VERIFIED (harness tests 1, 3) |
| Page allowlist (unbound page → rejected + audit channel_event_rejected; NO order path) | CODE VERIFIED + RUNTIME VERIFIED (harness test 4; DB-level S4) |
| Server-side tenant derivation (tenant NEVER in ingest call args — proven) | CODE VERIFIED + RUNTIME VERIFIED (harness test 5; DB S5) |
| Strict platform/event_type validation + NULL/empty deny | RUNTIME VERIFIED (S3 + production probe svc_null_reject=REJECTED) |
| DB idempotency | RUNTIME VERIFIED (S2) + **CONCURRENT test PASSED**: 2 parallel sessions → INSERTED + DUPLICATE, ROWS=1 |
| Duplicate → mark existing row DUPLICATE, no reprocessing | RUNTIME VERIFIED (S2, harness test 6) |
| Ingestion/event-state ONLY (no business-state columns; no order mutation path) | RUNTIME VERIFIED (S8) + create_order path untouched |
| service_role = transport only, NOT the security boundary | DOCUMENTED + enforced by composition (HMAC + fail-closed + allowlist + validation + DB uniqueness) |
## Ingestion RPC

| Item | Status |
|---|---|
| ingest_social_event(platform,event_id,page_id,event_type,sender_id,sender_name,content,payload) -> text | IMPLEMENTED + DEPLOYED |
| SECURITY DEFINER + SET search_path=public | DEPLOYED + RUNTIME VERIFIED (probe5 secdef=true safe_path=true) |
| EXECUTE: service_role ONLY; anon/authenticated denied | DEPLOYED + RUNTIME VERIFIED (probes 3/4) |
| No caller-supplied tenant parameter (HC-1) | RUNTIME VERIFIED (probe no_tenant_param=true + harness test 5) |
| brand derived from brands.is_default per tenant (D3 single-brand; NOT hard-coded) | RUNTIME VERIFIED (S5) |

## Tests (all actually executed)

| Suite | Result |
|---|---|
| Replay full migration chain (110 files, fresh bare container) | REPLAY_OK FAILURES=0 |
| G2 RLS matrix T1-T11 (with 106/108) | ALL PASSED |
| Post-G2 remediation matrix T12-T23 | ALL PASSED |
| G3 social events S1-S8 | ALL PASSED |
| Concurrent duplicate ingestion (2 parallel sessions) | PASSED (INSERTED/DUPLICATE/ROWS=1) |
| Webhook boundary harness (e2e/g3_webhook_boundary.mjs - runs real Edge Function source) | 11/11 PASSED |
| npm test | 367/367 PASS (41 files) |
| lint | PASS |
| build | PASS (built in 24.31s) |
| secret scan (109 + webhook + harness + tests + patches) | 0 hits |

## Production verification (read-only; event_rows=0, binding_rows=0 - NO test data)

| Probe | Result |
|---|---|
| ingest(NULL,...) as service_role | REJECTED (HC-5) |
| ingest(unbound page) as service_role | UNBOUND_PAGE (HC-1, no row written) |
| anon / authenticated EXECUTE on ingest | false / false (DENY) |
| service_role EXECUTE | true (transport only) |
| SECURITY DEFINER + search_path=public | true / true |
| No tenant parameter in function | true |
| Grants: anon=0, authenticated=SELECT, policies=3, tables=2, unique=1 | VERIFIED |

## Deferred (per Owner decisions - NOT implemented)

- Brand-scoped Auto-Post / brand-level authority - DEFERRED (D3)
- AI tier registry, retry scheduler job, cleanup automation - DEFERRED to later gates
- Meta external configuration (page ids, app secret) - BLOCKED on external dependency; channel_page_bindings EMPTY (fail-closed until Owner binds pages)

## Git / harness notes

- New: 109 migration · replay/tests/g3_social_events.sql · replay/patches/{g3_align,replay_base}.sql · e2e/g3_webhook_boundary.mjs
- Modified: channel-webhook/index.ts (ingestion boundary block only) · replay/manifest.txt (+1 patch line) · replay/replay.ps1 (bare-postgres bootstrap only)
- Harness note: bare supabase/postgres needed replay_base patch (storage skeleton + auth.jwt stub + auth.uid contract alignment + gotrue columns) - REPLAY TOOL ONLY, never deployed; historical migration files untouched.

## FINAL GATE

| Gate | Status |
|---|---|
| Approved scope implemented | YES |
| Production deployed | YES (109 EXIT=0) |
| Runtime verified | YES (S1-S8 + concurrency + webhook harness 11/11 + production probes) |
| Required security tests pass | YES |
| G2 regression passes | YES (T1-T23) |
| HEAD == origin/main | VERIFY BELOW (post-push) |
| Worktree CLEAN | VERIFY BELOW (post-commit) |

G3 = PASS (subject to the two VERIFY BELOW lines)

## GATE VERIFICATION (executed post-commit)

- HEAD == origin/main = **6fe7c7f** (VERIFIED, post-push)
- WORKTREE = **CLEAN** (VERIFIED, git status empty)

## FINAL VERDICT

```
G3 = PASS
================================================================
- Approved scope implemented (migration 109 + webhook boundary ONLY)
- Production deployed (109 EXIT=0)
- Runtime verified (S1-S8 + concurrent race + webhook harness 11/11)
- Security tests pass (HC-1..HC-7 all evidenced)
- G2 regression passes (T1-T23)
- HEAD == origin/main = 6fe7c7f
- Worktree CLEAN
================================================================
STOP - G4..G9 ยังไม่เริ่ม รอ Owner command ต่อไป
```
