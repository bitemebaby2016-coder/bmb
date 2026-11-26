# BMB Phase 2 — Readiness & Handoff (WP10)

Generated: 2026-11-26 · HEAD = origin/main (see git) · Production ledger unchanged at 218 (NOT deployed)

## Scope delivered (WP2–WP9, all CODE_CLOSED + PUSHED)
| WP | Deliverable | Migration | Proof |
|----|-------------|-----------|-------|
| WP2 | PO workflow RPC + API | 224 | `e2e/contracts_wp2_224.sql` 10 cases |
| WP3 | PO UI (PurchaseHub tab) + E2E spec | — | API 5 tests · E2E LIVE_TEST_PENDING |
| WP4 | GRN workflow RPC + API | 225 | `e2e/contracts_wp4_225.sql` 8 cases |
| WP5 | Goods Receiving UI + E2E spec | — | API 3 tests · E2E LIVE_TEST_PENDING |
| WP6 | WAVG posting + reversal + idempotency | 226 | `e2e/contracts_wp6_226.sql` 9 cases |
| WP7 | Price History read API (INVOKER) | 227 | `contracts_wp7_wp8` 227.* |
| WP8 | PO Dashboard read API + Dashboard UI | 228 | `contracts_wp7_wp8` 228.* |
| WP9 | Full regression | — | Docker replay 001→228 ALL GREEN |

## Test evidence (all green)
- Docker replay fresh DB: `migrations=232 OK / 0 FAIL` + Phase 1 (124-213, 214-218) + Phase 2 (219-223, 224, 225, 226, 227/228) contracts ALL GREEN.
- `npx vitest run`: 256 files / 3,014 tests PASS. `npm run lint` 0. `npx tsc --noEmit` 0. `npm run build` PASS (PWA v1.3.0).
- Integration tests run on REAL Postgres (Docker), not static-only.

## Security posture
- All write RPCs SECURITY DEFINER with in-body role + `has_org_row_scope` (tenant+branch) gates (Owner C).
- Read APIs (227/228) SECURITY INVOKER → RLS (m223) enforced; proven branch isolation (invA sees only branch A; admin cross-branch).
- No production writes; production ledger stays 218.

## Remediations applied vs staged references
- Removed non-existent `has_staff_branch_scope()` (WP2/4/6) — redundant with `has_org_row_scope`.
- Asia/Bangkok date instead of UTC `CURRENT_DATE` (m190 gate) in 224/225/226.
- WP4 create gate = is_staff OR is_inventory (receiver is inventory).
- WP6 price-history committed row missing landed_cost value (column count) fixed.
- WP8 jsonb_agg subqueries wrapped (nested aggregate / GROUP BY staged bug).

## Known limitations / pending
- WP3/WP5 Playwright E2E specs are LIVE_TEST_PENDING — require staging server + DB 219-228 + admin/inventory auth (env BMB_E2E_EMAIL/PASSWORD). Not run in this environment (no dev server / no prod writes per rules).
- Production deployment NOT authorized — separate Owner approval required.
- Generated replay logs kept in working environment, not committed (Part A §5).

## Next
- Owner review + staging deployment of migrations 219-228 (apply order) → run E2E specs on staging → production deployment approval.