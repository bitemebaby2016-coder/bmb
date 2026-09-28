# BMB_STEP3_GAP_REGISTER

**STEP 3 (audit-only) → prioritized gaps. NOT implemented — awaiting Owner round-2 command.**

| ID | Area | Gap | Priority | Rationale |
|----|------|-----|----------|-----------|
| **G-SEC-01** | G Sensitivity | `inventory_public_read USING(true)` exposes stock/supplier/unit_price/cost to **anonymous** | **P0 (security — blocks Cloud Kitchen operational trust)** | cost+supplier+stock leak; contradicts admin-authority model |
| **G-REP-01** | K Reports | **No admin reports page / no reports RPC** | **P0** (Master Spec requires; admin cannot see sales/delivery/production aggregation) | core command-center capability absent |
| **G-DASH-01** | A Dashboard | No server-side aggregation RPC — counts/revenue/workload computed **client-side** (dup `getDashboardStats` in 2 libs) | **P1** (Owner Rule A: server authority) | client-computed authority; production/delivery/payment-alert cards missing |
| **G-DASH-02** | A Dashboard | Production workload / delivery workload / payment-exception / operational-alert cards absent | **P1** | Owner Rule A checklist incomplete |
| **G-REV-01** | J Reviews | reviews table+RLS exist; **no admin reviews UI** | **P2** | non-blocking admin visibility |
| **G-LOY-01** | J Loyalty | loyalty_points table only; **no UI** | **P3 / DEFERRED** | not a closure requirement per Owner |
| **G-PRE-01** | C Pre-order | Pre-order page surfaces scheduled_date only; cutoff/round/capacity **not surfaced**; no queue/pump | **P2** (operational separation partial) | admin still separated via order_mode filter + canonical spine |
| **G-MED-01** | F Media | media_assets = 0 rows (storage policies applied; unexercised) | **P2** | contract present, no data |
| **G-DATA-01** | B/Security | `orders_own_create` INSERT qual = NULL (latent direct-insert; canonical is RPC) | **P2** (defense-in-depth) | no client writes today |
| **G-SET-01** | L Settings | max_preorder_days / full delivery rules not admin-configurable in verified UI | **P2** | partial settings coverage |
| **G-NOT-01** | M Notifications | dispatch is event-driven RPC; **scheduler/automation dependency not runtime-verified** | **P3** | operational but unverified automation path |
| **G-NOT-02** | M/Delivery | notifications unread/read + retry/idempotency not re-probed this gate | **P3** | table+RLS+page present |

## Proposed implementation sequence (OWNER to approve — NOT executed)
1. **P0 — G-SEC-01**: fix `inventory` public-read RLS (administrator/authenticated-admin only) → migration + RLS re-grant. (Security first.)
2. **P0 — G-REP-01**: add Reports slice (sales/delivery/payment/production/inventory via **server-side RPC(s)** + AdminReports page).
3. **P1 — G-DASH-01/02**: add server-side dashboard-summary RPC (DB-backed counts/revenue/workload/payment-exceptions/alerts); remove client-agg duplication; wire dashboard cards.
4. **P2 — G-REV-01**: add reviews admin UI (approve/feature) on existing RLS.
5. **P2 — G-PRE-01 / G-MED-01 / G-DATA-01 / G-SET-01**: pre-order cutoff/round/capacity surfacing; media data-path; tighten orders INSERT policy (or route all writes via RPC); expose missing business_settings keys.
6. **P3 — G-LOY-01 / G-NOT-01/02**: loyalty UI; notification scheduler/retry verification.

Each step gated by its own regression (Vitest/tsc/lint/build/secret-scan) + read-only runtime probe before mutate.

**Owner decision points:** ① approve P0 security migration; ② confirm Reports/dashboard required for Admin closure (P0 vs P1); ③ scope of external-rider freeze stays; ④ order in which rounds are authorized.