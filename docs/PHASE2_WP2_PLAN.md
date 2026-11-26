# WP2 — Purchase Order Database / RPC / API (Implementation Plan)

## Goal
Promote the staged WP2 reference into a real, applied (test-DB) migration + TypeScript API + DB integration tests, prove it on real Postgres (Docker replay), commit/push atomically, then continue to WP3. No production writes.

## Verified Starting State
- HEAD = origin/main = `1cd696a`, working tree clean. WP1 ACCEPTED + PUSHED.
- Schema 219-223 present: `purchase_orders`, `purchase_order_lines`, `po_number_seq` (219); `goods_receipts/_lines` (220); `purchase_price_history` append-only (221); `inventory_transactions` ext (222); RLS `has_org_row_scope` 17 policies (223).
- Role predicates (m146): `is_staff/is_admin/is_finance/is_inventory`. Audit: `append_audit_log` (m018).
- Staged reference: `supabase/staged_workflows/wp2_po_workflow_rpc.sql` (generate_po_number + create/update/submit/approve).
- Integration pattern: `e2e/contracts_phase2_219_223.sql` (BEGIN…ROLLBACK, `set_config` jwt + `SET ROLE authenticated`).
- Replay harness: `e2e/ci/w2_run_replay_full.bat` → `w2_fresh_replay_full.sh` (Docker postgres:16, applies 001..latest, runs contract suites).
- API pattern: `src/lib/bmbAdminApi_*.ts` via `supabase.rpc(...)`. Types in `src/types/index.ts`. Static tests in `src/__tests__/contracts_*.test.ts`.
- Next migration number = **224**. PurchaseHub exists in `src/components/admin/AdminHubs.tsx` (Phase 1 tabs) — WP3 extends it, NOT WP2.

## Critical Defect to Resolve in WP2
- Staged WP2 `update_purchase_order` / `submit_purchase_order` call `public.has_staff_branch_scope(v_po.branch_id)` — **this function does not exist in any migration** (would fail at runtime). `has_org_row_scope(tenant,branch)` already enforces tenant+branch isolation and is called immediately before. **Fix: remove the redundant `has_staff_branch_scope` calls; rely on `has_org_row_scope`.** Keep `create_purchase_order` inline branch guard (ERR_FORBIDDEN_BRANCH) as-is.

## WP2 Scope (backend only — no UI)
1. Migration **224_purchase_order_rpcs.sql** — promote staged SQL (schema-only deps 219/223), with the defect fix + audit trail (`append_audit_log` on create/submit/approve) + `GRANT EXECUTE … TO authenticated`. SECURITY DEFINER with internal role + `has_org_row_scope` gates.
2. Types in `src/types/index.ts`: `PurchaseOrder`, `PurchaseOrderLine`, `PurchaseOrderForm`, `PurchaseOrderLineForm`, `POStatus`.
3. API `src/lib/bmbAdminApi_purchaseOrders.ts`: `createPurchaseOrder`, `updatePurchaseOrder`, `submitPurchaseOrder`, `approvePurchaseOrder`, `getPurchaseOrders`, `getPurchaseOrderById` (real `supabase.rpc` + table reads; no mock).
4. Integration test `e2e/contracts_wp2_224.sql` (real DB): create/number-gen, line validation (supplier active, conversion>0, price fallback), optimistic-lock concurrency, duplicate-submit reject, invalid-transition reject, role gates (creator vs finance/admin), branch/tenant scope, rollback.
5. Static contract test `src/__tests__/contracts_224_po_rpcs.test.ts` (source-contract on 224 SQL).
6. Wire 224 contract into `e2e/ci/w2_fresh_replay_full.sh` (and `contract-tests.yml` if it enumerates suites).

## Ordered Task Checklist
1. [ ] Read staged WP2 + 219/223 (done) and confirm defect.
2. [ ] Write `supabase/migrations/224_purchase_order_rpcs.sql` (promote + fix + audit + grants).
3. [ ] Add PO types to `src/types/index.ts`.
4. [ ] Add `src/lib/bmbAdminApi_purchaseOrders.ts`.
5. [ ] Write `e2e/contracts_wp2_224.sql` integration contract.
6. [ ] Write `src/__tests__/contracts_224_po_rpcs.test.ts` static contract.
7. [ ] Wire 224 into `e2e/ci/w2_fresh_replay_full.sh`.
8. [ ] Run Docker replay (`e2e/ci/w2_run_replay_full.bat`) → expect migrations OK incl. 224 + phase2 contracts + new WP2 contract ALL GREEN.
9. [ ] Run `npx vitest run` (full), `npm run lint`, `npx tsc --noEmit` → all green.
10. [ ] Atomic commit + push; verify HEAD=origin/main, clean.
11. [ ] Docs sync: MASTER_STATUS, WORK_QUEUE, CHANGELOG (R111), AI_WORKING_STATE handoff r8.
12. [ ] Begin WP3 (extend PurchaseHub with PO UI) automatically.

## Test Matrix (WP2 acceptance)
- DB integration (real Postgres): PO number from seq; create draft + lines; supplier/conv/price validation; update optimistic-lock (stale version → ERR); duplicate submit (status gate); approve role gate (finance/admin only) + committed price write; invalid transition (approve draft); tenant/branch scope (cross-branch deny); rollback.
- RLS/role/branch: creator can edit own draft; finance cannot create; inventory cannot approve; cross-branch staff denied.
- Regression: full replay 001→224 + Phase 1/2 contracts remain ALL GREEN.

## Gates (in order)
- Docker replay ALL GREEN (migrations + contracts + WP2 contract).
- `npx vitest run` (no watch), `npm run lint`, `npx tsc --noEmit`, `npm run build`.
- No production DB writes; production ledger stays 218.

## Commit
- Atomic: `WP2: PO workflow RPC (migration 224) + API + DB integration tests`.
- Push to origin/main; confirm clean.

## Risks / Notes
- 224 applies to TEST DB only (replay). Production NOT authorized.
- Do not modify applied migrations 219-223. Do not duplicate PO/Supplier systems.
- `has_staff_branch_scope` removal is the only business-logic touch; justified by non-existence (proven) + redundant with `has_org_row_scope`.
- If 224 apply fails twice → STOP, Mandatory Halt Report.