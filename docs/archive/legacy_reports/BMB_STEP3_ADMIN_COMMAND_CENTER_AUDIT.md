# BMB_STEP3_ADMIN_COMMAND_CENTER_AUDIT

**STEP 3 — Admin / Cloud Kitchen Command Center · REAL CODE CLOSURE AUDIT (READ-ONLY)**
Date: 2026-09-28 · Project: `ivkdfognyiwjcmrhcnwz` · Mode: **AUDIT ONLY — no code/migration/deploy/data change**

**Method / Source-of-truth priority applied:** ① Production DB/runtime (read-only queries, RLS, schema, row counts) ② Actual source ③ Migrations/contracts ④ Architecture docs ⑤ README/old docs ⑥ AI assumptions. Docs were NOT accepted as proof of capability.

**Evidence captured read-only:** 38 RLS-enabled tables; RLS policy quals; `orders`/`delivery_rounds`/`products`/`reviews` schema; routine inventory; row counts; EF inventory (7 deployed). No data mutated.

`Status` ∈ {IMPLEMENTED, CONNECTED, DEPLOYED, RUNTIME VERIFIED, DOCUMENTED ONLY, MISSING, BLOCKED, DEFERRED, REGRESSION}

| Area | Capability | UI | Backend | DB Contract | Production | Runtime | Auth | Status | Evidence |
|------|------------|----|---------|-------------|-----------|---------|------|--------|----------|
| A | Dashboard server-side aggregate (orders/revenue/pending/workload) | AdminDashboard | **NONE** (no `dashboard_*` RPC) | orders / inventory / profiles | orders=202 inv=4 | client reads ok | **CLIENT (count/sum in browser)** | **IMPLEMENTED(DB) + BACKEND GAP** | `bmbAdminApi_users.getDashboardStats`: getOrdersAggregated+getOrdersSince+getInventory+getUsers → client math; also a 2nd dup in `bmbAdminApi_orders` |
| A | Production/kitchen workload on dashboard | ✗ (AdminKitchen separate) | get_kitchen_summary / kitchen_queue | production_batches | present | RPC deployed | server | **MISSING on dashboard** | no dashboard card |
| A | Delivery workload / payment-exception / operational alerts on dashboard | ✗ | ✗ | — | — | — | — | **MISSING on dashboard** | no aggregate/card |
| B | Orders list/detail/items/add-ons | AdminOrders | getOrders (RLS admin) + order_items hydrate | orders / order_items | 202 orders | CT reads | server (RLS is_admin) | **IMPLEMENTED · RUNTIME VERIFIED** | CT-01..05; items+addons live |
| B | Order status (allow-list + audit) | AdminOrders | transition_order_status RPC + trigger | order_status_history | 274 hist | CT-02/03 | server | **RUNTIME VERIFIED** | CT-02/03 |
| B | Payment state | AdminOrders | record_payment_result / confirm_offline / stripe EF | payment_intents | 56 | STEP2 | server | **RUNTIME VERIFIED (STEP 2)** | CT-01/04/05 |
| B | source_channel / external_ref_id / order_mode / scheduled_date / round / items / price / fees | list show | columns present (canonical spine) | orders | 202 | schema ok | server | **IMPLEMENTED (DB contract)** | orders cols |
| B | Cancellation / refund visibility | AdminOrders/PreOrders | cancel_order RPC / stripe-refund EF | orders + ledger | — | CT-02/04 | server | **RUNTIME VERIFIED / VERIFIED STEP 2** | CT-02, CT-04 |
| C | order_mode (SAME_DAY/PRE_ORDER) + scheduled_date + quote_pre_order + validate_pre_order_delivery (single spine) | AdminPreOrders/AdminOrders | RPCs | orders (one table) | 202 | RPC deployed | server | **IMPLEMENTED (single system)** | no second order system; PreOrders filters canonical orders |
| C | cutoff / round / capacity surfaced on pre-order page | partial (scheduled_date only) | ensure_rounds_for_date, increment/decrement | delivery_rounds | 23 | — | server | **CONNECTED / UI-partial** | AdminPreOrders.tsx |
| C | Pre-order queue / workflow | basic list + cancel | — | — | — | — | — | **PARTIAL / UI GAP** | no pump/queue |
| D | Kitchen queue / prep state / round-date grouping / actionable flow | AdminKitchen | create_production_batch, kitchen_queue, get_kitchen_summary | production_batches/items | present | RPC deployed | server (RPC) | **IMPLEMENTED / DEPLOYED** | migration 019 |
| E | Delivery queue / driver assign / status / fee / identity | DeliveryManagement / RouteOptimization | driver_login, assign_driver, my_deliveries, driver_update_delivery_status, compute_delivery_fee_rpc | drivers 5 / assignments 10 / zones 3 / rounds 23 | present | **CT-03** | server (RPC+RLS) | **IMPLEMENTED / RUNTIME VERIFIED (reassign)** | CT-03; migration 020 |
| E | External rider / Grab / Lineman / Foodpanda provider | — | — | delivery_method enum | — | — | — | **FROZEN / OUT-OF-SCOPE** | Owner directive |
| F | Categories / products / price / desc / availability / display | AdminProducts (+AddonsEditor) | RLS admin CRUD | products 10 / product_categories 5 | present | read ok | server (RLS is_admin) | **IMPLEMENTED** | products cols; bmbAdminApi_products |
| F | Add-ons (server-authoritative price) | AddonsEditor | compute_addons_price (server) | products.addons JSONB | present | — | server | **IMPLEMENTED** | migration 016 |
| F | Images | AdminMedia | storage bmb-images + media_assets | media_assets 0 | empty | — | server | **CONNECTED (contract only, empty)** | media_assets=0 |
| G | Stock / low-stock / recipes / BOM / prod↔ingredient | InventoryPage / AdminRecipes | update_inventory_status, get_inventory_requirements, list_recipes_with_inventory, deduct/restore | inventory 4 / inventory_transactions / recipes | present | RPC deployed | server | **IMPLEMENTED** | migrations 019/026 |
| G | **Anonymous inventory read** | — | — | inventory | — | — | — | **SECURITY / DATA GAP** | `inventory_public_read` USING(true) |
| H | Promotions CRUD / active / eligibility / pricing authority | AdminPromotions | RLS admin CRUD + authoritative apply in create_order | promotions 1 | present | RT (auth-promo) | server | **IMPLEMENTED / RUNTIME VERIFIED** | api.test.ts; create_order |
| I | Customers / order-history / contact / linkage / privacy RLS | AdminCustomers | RLS (admin all, own_read); getCustomersAdmin; getCustomersWithStats | customers 30 | present | read ok | server (RLS) | **IMPLEMENTED** | customers_anon qual=false |
| J | Reviews management UI | ✗ | reviews_admin_manage (RLS) | reviews 0 | empty | — | server (RLS) | **BACKEND present / ADMIN UI GAP** | no AdminReviews page |
| J | Loyalty | ✗ | loyalty_points (table) | 0 | — | — | — | **BACKEND only / no UI / DEFERRED** | table only |
| K | Reports (sales/delivery/production/inventory/date+channel) | ✗ (no AdminReports) | **NONE** | — | — | — | — | **MISSING / DOCUMENTED ONLY** | Master spec lists Reports; no page/RPC |
| L | Business hours / rounds / zones / rules / max_preorder_days | AdminSettings / AdminRounds / DeliveryMgmt | business_settings (RLS admin), ensure_rounds, zones | business_settings 5 | present | read ok | server (RLS) | **IMPLEMENTED (partial) / CONNECTED** | subset of keys; max_preorder_days not admin-configurable |
| M | Notifications record/dispatch/unread/read/retry | AdminNotifications | create_notification RPC (event-driven) | notifications 338 | present | RPC deployed | server (RPC) | **IMPLEMENTED (event-driven)** | migration 021; scheduler NOT VERIFIED |
| N | Audit actor/action/entity/time/admin | AuditLogPage | append_audit_log RPC + admin_read | audit_logs 964 | present | **CT-02/03/05** | server | **IMPLEMENTED / RUNTIME VERIFIED** | CT evidence |
| O | Payment / refund / exception visibility + canonical links | AdminOrders | stripe-refund EF + ledger metadata | payment_intents.metadata | — | STEP2 | server | **VERIFIED FROM STEP 2** | CT-04 |

---

## Section detail (status disposition)

### VERIFIED (real, proven at runtime/DB this gate + STEP 2)
- **Orders** list/detail/status/payment/cancel/refund — DB-backed, RLS admin, RUNTIME VERIFIED (CT-01..05).
- **Payment + Refund admin (O)** — VERIFIED FROM STEP 2 (CT-04 full+partial+webhook sync+idempotency+over-refund). No regression found.
- **Driver reassignment (E)** — CT-03.
- **Audit trail (N)** — observed live in CT-02/03/05; append_audit_log RPC + admin_read(RLS).
- **Promotions pricing authority (H)** — server-authoritative discount applied in create_order (regression-tested).
- **RLS admin boundaries** — confirmed via policy quals: admin ALL via `is_admin()` on orders/products/promotions/inventory/customers/media/rounds/zones/reviews/recipes/menu_schedule/drivers; anon **denied** (qual=false) on customers/notifications/audit/business_settings.

### IMPLEMENTED BUT NOT RUNTIME VERIFIED (DB+RPC present; not re-live-exercised this gate — beyond STEP 2 CT scope)
- Kitchen/production RPCs (D): create_production_batch, kitchen_queue, get_kitchen_summary — deployed (ERR-control PASS in earlier gate); full CRUD flow not re-probed here.
- Delivery RPCs (E) beyond reassignment; compute_delivery_fee_rpc.
- Inventory RPCs (G): update_inventory_status, get_inventory_requirements, list_recipes_with_inventory, deduct/restore.
- Notifications (M): create_notification RPC deployed; dispatch path not re-run this gate.

### UI GAP
- **Reports (K)** — NO admin reports page (only route-ETA telemetry). Master Spec makes Reports an explicit area → **MISSING**.
- **Reviews (J)** — backend (table+RLS) exists, **no admin UI**.
- **Loyalty (J)** — table only, no UI.
- **Pre-order queue/workflow (C)** — list+cancel only; cutoff/round/capacity not surfaced.

### BACKEND GAP
- **Dashboard aggregation (A)** — no server-side aggregation RPC; counts/revenue/workload computed **in the browser** from DB reads (getOrdersAggregated/getDashboardStats). Owner Rule A requires server authority → migration needed. Dup `getDashboardStats` in two libs.
- **Production / delivery workload / payment-exception / operational alerts on dashboard (A)** — absent.

### SECURITY GAP
- **`inventory_public_read` USING(true)** — anonymous CAN read `inventory` (stock / supplier / unit_price / cost). Known 🔴 (RAW audit #10); must scope to authenticated-admin or drop public read.

### DATA / CONTRACT GAP
- **`media_assets` = 0 rows** (storage policies applied; no image rows exercised) → media integration contract-verified but unpopulated.
- **`reviews` = 0 rows**; `loyalty_points` = 0 rows.
- **`orders_own_create` INSERT qual = NULL** — any authenticated may direct-INSERT into `orders` (canonical path is `create_order_with_items` RPC); latent if any client writes directly (none does today). Low.
- **max_preorder_days** not surfaced as an admin-configurable setting (not in business_settings/rounds UI verified).

### BLOCKED
- None found blocking the audit itself.

### FROZEN / DEFERRED / OUT-OF-SCOPE
- **External rider providers** (Grab/Lineman/Foodpanda in `delivery_method` enum) — FROZEN / OUT-OF-SCOPE (Owner). Internal Bite Drive + self-delivery only.
- **STEP 4** — not started. **Physical Delivery Pilot** — not started.
- **Admin/UI/Delivery changes** — NOT authorized in this audit.
- Advanced analytics/loyalty SaaS items in Master Spec — DEFERRED (Domain B), not block.

### REGRESSION
- None found against STEP 2 evidence (aa43dc2). Refund/webhook/offline/cancel states still match CT evidence.

**HARD STOP — audit only. No implementation, no commit, no push.**

---

## STEP 3A APPENDIX — G-SEC-01 P0 SECURITY CLOSURE

> The original finding (G-SEC-01 above) is **preserved unchanged**. This appendix records the Phase A evidence and the minimal fix.

### Phase A evidence (production DB, read-only)
- `inventory` exposes sensitive columns: `current_stock, min_stock, max_stock, unit_price, supplier_name, supplier_phone, status, last_restocked_at`.
- Live RLS policies on `inventory`:
  | Policy | Cmd | Roles | Qual |
  |--------|-----|-------|------|
  | `inventory_admin_manage` | ALL | authenticated | `is_admin()` |
  | `inventory_anon_read` | SELECT | anon | `false` (deny) |
  | `inventory_public_read` | SELECT | **anon, authenticated** | **`true`** ← leak |
- Every `from('inventory')` in source is the **Admin InventoryPage** (`bmbAdminApi_inventory.ts`). **No customer/public workflow reads `inventory`** (menu surfaces read `products`). No legitimate anon path depends on it.
- Dependent RPCs (`get_inventory_requirements`, `list_recipes_with_inventory`, `deduct_inventory_for_order`, `restore_inventory_for_order`, `ensure_inventory_deducted_on_confirm`) are **SECURITY DEFINER + admin-guarded** (`ERR_FORBIDDEN`) → bypass RLS; **unaffected** by the policy change. `update_inventory_status` is non-SD, runs as invoker (admin-only via `is_admin`) — out of scope for the SELECT-leak.

### Phase C — minimal migration
- File: `supabase/migrations/052_g_sec01_inventory_public_read.sql`
- Change: **`DROP POLICY IF EXISTS inventory_public_read ON public.inventory;`**
- Preserved: `inventory_admin_manage` (admin read+write) and `inventory_anon_read` (deny). No schema/data/feature/order-spine change. Reversible in principle (create policy restores; restoring the *open* policy is not recommended).

### Closure status
- **CODE** (migration ready) · **LOCAL TEST** (admin read+mutation path — new `inventoryAdmin.test.ts`) · **PRODUCTION/DEPLOY = GATED — awaiting Owner approval** · **RUNTIME VERIFIED = post-deploy read-only probe prepared** (`e2e/ct-gsec01-verify.cjs`) · **REGRESSION = pending local suite** · **COMMIT = local-only (Commit A/B)** · Phase E deployment report → see STEP 3A status in the owner-facing report.

### STEP 3A closure-live verification (Owner-approved deploy, 2026-09-28)
- Migration `052_g_sec01_inventory_public_read.sql` **applied** (mgmt query → HTTP 201).
- Production policy state confirmed: `inventory_public_read` **ABSENT**; `inventory_admin_manage` (ALL, `is_admin()`) + `inventory_anon_read` (deny) **PRESENT**.
- Anonymous `SELECT inventory` → **DENIED** (REST status 401, PostgREST `42501`).
- Admin `inventory` read (throwaway admin via `is_admin()` harness) → **WORKS** (REST 200, 4 rows).
- Non-admin (authenticated customer) `inventory` read → **DENIED** (REST 200, 0 rows).

### ⚠ NEW BOUNDARY FOUND — HARD STOP (per Owner FAILURE RULE) — G-SEC-01 closure pending Owner decision
`get_inventory_requirements(p_product_id, qty)` (migration 019, SECURITY DEFINER, `GRANT ... TO authenticated`):
- Header comment states "**admin-guarded inside**", but the body only checks `auth.uid() IS NOT NULL` — **no `is_admin()` guard**.
- Live probe (non-admin/customer JWT) returned **200 `{"ok":true,... current_stock, min_stock ...}`** → **any authenticated user can read per-ingredient `current_stock` / `min_stock`** via this RPC.
- **Pre-existing** (NOT caused by migration 052) and **outside the authorized `052` scope** (Owner forbade RPC changes). Directly conflicts with G-SEC-01's "do not expose internal stock data" objective.
- Action per rule: **STOP, do NOT push**, report for Owner. Not rolled back; not modified.

### STEP 3A.1 / G-SEC-01b — Owner authorized; fix prepared + committed for deploy
- Migration `053_g_sec01b_inventory_requirements_guard.sql`: adds `IF NOT public.is_admin() THEN RAISE EXCEPTION 'ERR_FORBIDDEN';` **inside** `get_inventory_requirements` (canonical boundary, same as all admin RPCs/RLS). Calculation, return structure, pricing, stock mutation, order state, kitchen logic, and `GRANT ... TO authenticated` all **unchanged**.
- **Impact analysis (source-verified):** only caller is `kitchenService.getInventoryRequirements` (Admin/Kitchen); **no page / customer-PWA / Edge Function / order path** uses it; no alternative public-safe RPC exists; no order/payment/pre-order dependency.
- **Local (pre-deploy):** migration-contract check `e2e/ct-gsec01b-contract.cjs` → **8/8 PASS**; Admin inventory path `inventoryAdmin.test.ts` PASS; `vitest` **199/199**; `tsc` 0; `lint` 0; `build` PASS.
- Post-deploy verification → `e2e/ct-gsec01b-probe.cjs` (anon/non-admin denied, admin PASS; table anon/non-admin denied, admin PASS).

### STEP 3A.1 / G-SEC-01b — production deployment + runtime verification (PASS)
- Migration `053_g_sec01b_inventory_requirements_guard.sql` **applied** (mgmt query → HTTP 201).
- Post-deploy read-only probe (`e2e/ct-gsec01b-probe.cjs`):
  - **A** `get_inventory_requirements` anon → **DENIED** (401/`42501`)
  - **B** non-admin customer JWT → **DENIED** (`ERR_FORBIDDEN`)
  - **C** admin JWT → **PASS** (`ok:true`, `feasible`, requirements)
  - **D** direct `inventory` anon → **DENIED** (401)
  - **E** direct `inventory` non-admin → **DENIED** (0 rows)
  - **F** direct `inventory` admin → **PASS** (4 rows)
- Regression: `vitest` 199/199 · `tsc` 0 · `lint` 0 · `build` PASS.

## RESULT
- **G-SEC-01** (direct inventory table public read) = **CLOSED** (RUNTIME VERIFIED).
- **G-SEC-01b** (get_inventory_requirements unauthorized authenticated access) = **CLOSED** (RUNTIME VERIFIED).
- Throwaway probe profiles created for verification (`[STEP3A]`, `[STEP3A1]` ADMIN/CUST) — left for Owner cleanup per STEP 2 precedent (not removed; removal is a write).