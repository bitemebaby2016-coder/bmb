# BMB STEP 3B-2A — ORDERS OPERATIONAL CONTROL (EVIDENCE REPORT)

Base: `5c5f931` (HEAD == origin/main at start) · Project `ivkdfognyiwjcmrhcnwz`
Scope: Admin Orders = reliable operational control surface. NO new order architecture, NO UI redesign, canonical spine untouched.

## CODE PASS
- **GAP-A1 FIXED** — AdminOrders action buttons now render ONLY the canonical next hop via `adminOrderDisplay.nextForwardAction` (mirror of 008/030 allow-list). `ready_for_dispatch → 'delivered'` illegal button REMOVED → now `ready_for_dispatch → dispatched`.
- **GAP-A2 FIXED** — Cancel button now calls **`cancel_order` RPC** (atomic: authz + capacity release + inventory restore + delivery-assignment cancel + audit), for every non-terminal state, with operator reason prompt. `transition_order_status('cancelled')` path removed from cancel UI.
- **GAP-A3 FIXED** — card badges: order_mode (SAME_DAY/PRE_ORDER + scheduled_date) · round · payment state (pending/processing/paid/failed/partially_refunded/refunded) + method · **delivery-assignment state** (unassigned/assigned/accepted/picked_up/in_transit/delivered/exception via `delivery_assignments`, 020 lifecycle) · lazy "History / Audit" panel = `order_status_history` (040, actor) + `audit_logs` (018).
- **GAP-A4 FIXED** — status filter chips now cover dispatched/in_transit/arrived/failed + mode chips (All/SAME_DAY/PRE_ORDER → server-side `eq order_mode`).
- New files: `src/lib/adminOrderDisplay.ts` (pure display mirror; server stays sole authority), `src/__tests__/adminOrdersOp.test.ts`, `e2e/ct-3b2a-op.cjs` (read-only probe). Modified: `bmbAdminApi_orders.ts` (orderMode filter + 3 read helpers: `getOrderStatusHistory`, `getDeliveryAssignmentsFor`, `getOrderAuditTrail` — all RLS-scoped reads, graceful degrade).
- Authority: every action still goes through `transition_order_status` / `cancel_order` / `confirm_offline_payment` / `stripe-refund` EF. No direct UPDATE. No force status. No new RPC. FROZEN items untouched.

## TEST PASS
- `tsc --noEmit` 0 errors · `eslint` 0 · `npm run build` PASS · secret scan PASS
- Vitest **219/219** (26 files) — includes new `adminOrdersOp.test.ts` **20/20**: SAME_DAY/PRE_ORDER display, payment states (incl. exception states), delivery states (incl. exception), canonical allow-list valid/invalid (GAP-A1 regression: ready_for_dispatch→delivered BLOCKED), atomic cancel via cancel_order RPC, order_mode server-side filter, graceful degrade, no STEP-2 payment regression (suite includes paymentStateMachine/stripeRefundLogic/stripeWebhookSignature — all green).
- Non-admin/customer boundary: existing AdminRoute + RLS tests unchanged & green (`adminUi.test.ts`), `osh_admin_read`/`assignments_scoped_read` verified in prod (below).

## PRODUCTION VERIFY PASS (READ-ONLY — no mutation performed)
`e2e/ct-3b2a-op.cjs`:
- RLS live: `osh_admin_read` (SELECT, authenticated, is_admin) · `assignments_scoped_read` + `assignments_deny_anon` · `audit_logs_admin_read`/`own_read`/`anon`.
- Orders display columns ALL present (order_mode/scheduled_date/source_channel/external_ref_id/delivery_round_id/payment_status/payment_method).
- `order_status_history` full actor schema live · `delivery_assignments` full lifecycle columns live.
- Canonical authority live: `transition_order_status`, `order_transition_allowed`, `guard_order_status_transition`, `cancel_order`.
- Distribution (TEST/QA only): SAME_DAY 194 / PRE_ORDER 8; payment pending 163/paid 30/refund 8/partially_refunded 1; assignments assigned 6/accepted 4.
- No transition mutation was needed to prove state behavior — 008 machine + RPC transitions were already RUNTIME VERIFIED (STEP 2 CT-01..05, 3B-1); this gate adds read-model + display verification. No LIVE Stripe, no real order, no physical delivery.

## GIT
- Commit: `step3b-2a: admin orders operational control (canonical-only actions + mode/payment/delivery visibility + history/audit)` 
- HEAD == origin/main after push · WORKTREE CLEAN · ONE sub-gate only.

## HARD STOP
3B-2A = PASS → STOP. 3B-2B (Pre-order queue), Kitchen, Dispatch, Dashboard, Reports, Physical Delivery — NOT started; await Owner command.
