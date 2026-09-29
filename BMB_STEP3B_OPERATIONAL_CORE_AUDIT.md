# BMB_STEP3B_OPERATIONAL_CORE_AUDIT

**STEP 3B-1 — Operational Control Audit (READ-ONLY).** Project `ivkdfognyiwjcmrhcnwz`. Base `HEAD==origin/main==527a18b`.
Method: SOURCE + PRODUCTION DB (read-only). No code/migration/deploy/mutation. Docs used only as references — capability judged from source + live DB.

---

## 1. Current production evidence (read-only, live DB)
- **36/36 operational RPCs PRESENT** (order create/transition/confirm, pre-order, rounds/capacity, kitchen/production, driver, tracking, notifications, audit, payment).
- **Canonical state machine** (`order_transition_allowed`, migration 008): `pending→confirmed→preparing→ready_for_dispatch→dispatched→in_transit→arrived→delivered` + `→cancelled|failed` from any pre-terminal state. Mutations flow **only** through `transition_order_status` RPC (direct UPDATE blocked by RLS+trigger, migration 008 P0-6).
- **orders** (202 rows, TEST/QA): statuses exercised = pending/confirmed/ready_for_dispatch/dispatched/delivered/cancelled; payment = pending/paid/refund/partially_refunded; mode = SAME_DAY + PRE_ORDER — **single canonical spine**, no separate pre-order table.
- **payment_intents** (56): credit_card completed/refunded/partially_refunded/pending; promptpay_qr pending/processing/completed → payment exception states real.
- **delivery_assignments**: driver lifecycle columns present (`assigned_at, accepted_at, picked_up_at, in_transit_at, delivered_at, cancelled_at`); distribution = assigned 6, accepted 4.
- **order_status_history** (274): `from_status, to_status, changed_at, actor_type, actor_id, reason, metadata` → server traceability with actor.
- **drivers** = 5 · **track_order_attempts** = 31 · **notifications** = 338 (all Transactional) · **audit_logs** = 964.

## 2. Operational matrix
Status ∈ {RUNTIME VERIFIED, IMPLEMENTED, CONNECTED, DEPLOYED, MISSING, BLOCKED, DEFERRED}

| # | Area | Capability (source + DB) | Status | Authority | Notes / 3B-x |
|---|------|--------------------------|--------|-----------|---------------|
| 1 | Orders | create (create_order_with_items), list/detail (AdminOrders, RLS admin), status via transition_order_status RPC, payment state | **RUNTIME VERIFIED** | RPC + RLS | CT-01..05; prod distribution pending/confirmed/delivered/cancelled |
| 2 | Pre-order / scheduled | canonical spine `order_mode=PRE_ORDER`, quote_pre_order, create/cancel_pre_order; AdminPreOrders (list+cancel) | **IMPLEMENTED** (spine+UI) · **UI GAP** (operational detail) | RPC | Pre-order page shows scheduled_date only; **round/cutoff/capacity/pending-paid-confirmed filter missing** → **3B-2B** |
| 3 | Kitchen / production | production_batches/items + create_production_batch + kitchen_queue + get_kitchen_summary (019, deployed) + AdminKitchen | **IMPLEMENTED / DEPLOYED** | RPC (019) | RPCs deployed (ERR-control); full batch→preparing→ready_for_dispatch wiring to verify → **3B-2C** |
| 4 | Delivery / dispatch | compute_delivery_fee_rpc + delivery_zones/rounds; assign_driver + driver RPCs (020) | **IMPLEMENTED / DEPLOYED** | RPC (020) | Admin DeliveryManagement must drive `assign_driver` RPC (verify not local-only mock) → **3B-2D** |
| 5 | Driver assignment | driver_login, assign_driver, driver_accept_assignment, driver_update_delivery_status, my_deliveries; **RiderPwaPage** UI | **RUNTIME VERIFIED** (reassign CT-03) / lifecycle → **3B-2D** | RPC (020) | Full accept→in_transit→delivered flow to verify end-to-end |
| 6 | Customer tracking | `/track/:orderNumber` → OrderTrackPage + track_order RPC; own-only (RLS own_read) | **IMPLEMENTED / CONNECTED** | RPC + RLS | Verify own-order only + shows canonical status → **3B-2** |
| 7 | Payment / refund exception | payment_intents + record_payment_result + confirm_offline_payment + stripe-webhook + stripe-refund EF | **RUNTIME VERIFIED (STEP 2)** | RPC/EF | CT-04 (full/partial/idempotent/over-refund). Exception VIEW (pending confirms, refunds list) light UI → **3B-2E** (no new logic) |
| 8 | Capacity / round / cutoff | delivery_rounds (cutoff/capacity/current_count) + ensure_rounds_for_date + increment/decrement + order_setting + pre-order policy (038) | **IMPLEMENTED** | RPC | Capacity enforced in create_order; AdminRounds capacity UI present |
| 9 | Notifications (operational) | notifications + create_notification RPC + AdminNotifications + notificationService | **CONNECTED** (infra) | RPC + client | Event→notification wiring (order received→kitchen, ready→dispatch, delivered) to confirm/complete → **3B-2** (in-app only; FROZEN: no SMS/email/push/pg_cron) |
| 10 | Audit trail | order_status_history (server, actor) + append_audit_log + audit_logs + AuditLogPage | **RUNTIME VERIFIED** | RPC/trigger | CT-02/03/05 observed; order_status_history=274 |

## 3. Exact blockers to actually run the restaurant
- **B1 (3B-2B)** — Admin pre-order surface lacks round / cutoff / capacity / scheduled-date / paid-vs-confirmed operational filtering → operator can't run pre-orders.
- **B2 (3B-2C)** — Kitchen production end-to-end (batch → preparing → ready_for_dispatch) must be wired/verified so kitchen knows what to make and what is ready.
- **B3 (3B-2D)** — Admin dispatch must drive the **real** `assign_driver` RPC + driver PWA accept/in_transit/delivered; verify DeliveryManagement is RPC-backed, not a local-mock route.
- **B4 (3B-2E)** — Payment-exception visibility (pending-action confirms, failed, refunds) — a light view; do NOT add payment logic (existing is sufficient + STEP-2-verified).
- **B5 (3B-3)** — Command-center aggregation is **client-side**; needs an authoritative, admin-guarded **server-side summary RPC** (Dashboard = read model only).
- **B6 (3B-4)** — No daily operational report/close (orders/sales/payment/delivery completion/exceptions) → owner cannot close the day.

## 4. Recommended implementation order (each sub-gate: CODE→TEST→PROD-VERIFY→EVIDENCE→COMMIT→PUSH→STOP)
1. **3B-2 A** Order control hardening (confirm classify PRE_ORDER/SAME_DAY, round/date, payment+delivery state, transitions canonical-only).
2. **3B-2 B** Pre-order operational queue on canonical spine (round/cutoff/capacity/paid/confirmed visibility + queue).
3. **3B-2 C** Kitchen/production control (verified batch→preparing→ready_for_dispatch; production visibility; no customer access to internal inventory).
4. **3B-2 D** Delivery/dispatch (assign_driver RPC wiring, driver lifecycle, reassignment, dispatched/in_transit/arrived/delivered, exception visibility).
5. **3B-2 E** Payment-exception view (light; existing logic reused).
6. **3B-3** Dashboard server-side summary RPC + read-model cards (TODAY: orders/pre/same-day/paid/preparing/ready/out-for-delivery/delivered/cancelled/payment+delivery exceptions/kitchen workload). Admin-guarded; no PII/inventory leak.
7. **3B-4** Minimum daily report/close (daily orders, sales/payment summary, cancelled/refunded, delivery completion, operational exceptions).

## 5. NOT needed before opening (DEFER)
Reviews admin · Loyalty · Media polish · Mascot · AI chat/customer-intelligence · demand forecasting · external rider providers · content-approval CMS · marketing/BI analytics · theme/UI polish.

## 6. Owner decisions required
1. Approve 3B-2(A–E)→3B-3→3B-4 sequencing (one sub-gate at a time).
2. **Driver model for pilot**: admin-driven dispatch into RiderPwaPage (internal Bite Drive) sufficient? Physical Delivery Pilot stays gated.
3. **Operational notifications surface**: FROZEN blocks SMS/email/push/pg_cron → confirm in-app (customer OrdersPage/track refresh) + Admin is the acceptable pilot surface (no new notification architecture).
4. Confirm **no real customer / LIVE money / physical delivery** until explicit Physical Pilot authorization.
5. TEST/QA order cleanup (202 rows) — Owner action (not required to open pilot if isolated).

## 7. Security posture (no regression / no new leak)
- Admin RLS boundaries intact; **G-SEC-01/G-SEC-01b CLOSED + RUNTIME VERIFIED** (527a18b).
- Customer track = own order only (RLS own_read + track_order guard). Driver = scoped (my_deliveries by phone; drivers_scoped_read).
- All new 3B-2/3/4 RPCs must be `is_admin()`-guarded (canonical) and must NOT expose PII or internal inventory (follow G-SEC-01/01b pattern).
- FROZEN items untouched (OTP/SMS, Meta, Facebook, Payment events, Web Push/VAPID, Email, LINE, pg_cron, Supabase Pro/PITR, external rider, race P1-1, Make.com, canonical RPC bypass, SQL force state, service-role exposure).

## 🔴 HARD STOP
3B-1 = **AUDIT ONLY · COMPLETE**. No code/migration/deploy/commit/push performed. Awaiting Owner decision before **3B-2**.