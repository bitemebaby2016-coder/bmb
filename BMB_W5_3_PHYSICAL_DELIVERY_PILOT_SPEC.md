# BMB_W5_3_PHYSICAL_DELIVERY_PILOT_SPEC

**Wave:** W5-3 · **Status:** SPECIFICATION ONLY — **NO REAL DELIVERY YET.** Requires Owner approval before any execution.
**Mode agreed with Owner:** physical delivery is **independent from Software E2E** (W5-2 closed separately). This is a fresh, isolated gate.

---

## 0. Hard constraints (inviolable for the pilot)
- **NO** call to Grab / any external rider provider.
- **NO** food sent to a real customer; TEST destination only (kitchen-owned test address).
- **NO** real payment — Stripe TEST (`pk_test`) or pre-approved offline reference; never live.
- **NO** real customer PII; reserved QA/test identity only.
- **NO** frozen provider enabled (OTP/SMS · Web Push · Email/LINE · Meta) — status/delivery updates stay in-app/DB only.
- **NO** pg_cron modification · **NO** Supabase plan/PITR change · **NO** race optimization change.
- **NO** schema/business-rule change unless a discovered regression forces it (then STOP + explicit justification).

## 1. Objectives
Prove the **physical** leg only — that a driver record can accept, travel to a test destination, and complete delivery — driving the SAME canonical state machine W5-2 verified, now with a physically-taken route. Software state flow is already verified; the pilot adds **real rider action + real arrival** evidence.

---

## 3. Exact test prerequisites
1. Owner approval of this spec + a named **TEST DRIVER** (kitchen staff) and a named **TEST DESTINATION** (≤5 km from kitchen, kitchen-owned/QA).
2. Supabase up; Stripe still `pk_test`; HEAD == origin/main; WORKTREE CLEAN; all W5 migrations applied.
3. A disposable test order target (§4) + an available test driver record.
4. A run sheet: start time, planned route distance (assert ≤5 km), driver device, test-customer phone, expected end state.

## 4. Test entity requirements
- **TEST DRIVER:** one real human operator holding the QA driver record `QA W52 Driver` (`+66990000100`, `QA TEST VEHICLE`); must have a phone on-hand to confirm each canonical step. Reuse `drv-…-c10a`. (If unavailable, `upsert_driver` a new QA driver — no real driver data.)
- **TEST DESTINATION:** a kitchen-owned address / test point ≤5 km from `kitchen_location` (10.7016, 102.1429); real walkable/drivable path so arrival is genuinely observed; fixed QA coordinates; no real customer PII.
- **TEST ORDER:** a fresh QA order (reserved phone, e.g. `+66990000004`) for a test product with `self_delivery`, `credit_card` (TEST), scheduled for the pilot morning round; must start `paid` (TEST) before dispatch. NOT `PO-20260929-131` (stays untouched as closed evidence).

## 5. Required admin / operator action
1. Operator creates the test order via canonical `create_order_with_items` + TEST payment (`create-checkout` + `tok_visa`) → `paid/confirmed`.
2. Operator runs kitchen transitions `confirmed→preparing→ready_for_dispatch`.
3. Operator `upsert_driver` (if new) → `assign_driver` → capture `1` assignment row + driver `busy`.
4. Operator transitions `ready_for_dispatch→dispatched` (OUT_FOR_DELIVERY).
5. **Driver** performs `accept → picked_up → in_transit → arrived → delivered` via driver RPCs (note: W5-2 these refused a non-driver with `ERR_NOT_A_DRIVER` — driver token/role required).
6. Operator + test customer capture tracking/UI evidence at each stage.

## 6. Expected state transitions & evidence at every stage
| Stage | Driver/Operator action (canonical) | Evidence required |
|---|---|---|
| paid/confirmed | TEST payment succeeds | Stripe TEST `succeeded` + `orders.payment_status=paid` |
| preparing → ready_for_dispatch | kitchen transitions `ok` | order state + 1 history row each |
| assigned | `assign_driver` `ok` | 1 `delivery_assignments` row; driver busy |
| dispatched | `ready_for_dispatch→dispatched` `ok` | state + history + client "Out for Delivery" |
| accepted | driver `accept` `ok` | `accepted_at` set |
| picked_up | driver `picked_up` `ok` | `picked_up_at` set; driver departed |
| in_transit | driver `in_transit` `ok` | `in_transit_at` set; live `track_order` shows delivered=no |
| arrived | driver `arrived` `ok` | `arrived_at` set; at destination |
| delivered | driver `delivered` `ok` | order ends `delivered`; `track_order` shows delivered; test customer confirms receipt; audit row |
| Throughout | every stage | `order_status_history` append + `audit_logs` row via existing triggers; screenshots (tracking UI live) |

## 7. PASS criteria
- All 9 stages complete via **canonical RPCs** (no SQL force / no direct mutation).
- `order_status_history` reaches expected count; `audit_logs` clean; `delivery_assignments` reflects exact steps and timestamps.
- Test driver identity works end-to-end (`ERR_NOT_A_DRIVER` absent for the authorized driver); test customer tracking shows correct live status and final `delivered`.
- Distance ≤5 km (self-delivery); delivery fee matches policy; trip completed.
- Payment state unchanged by driver actions (stays `paid`, no double charge).
- No real customer PII touched; QA identity isolated.
- Regression suite still green (tsc/lint/build/vitest 195/195; secret scan; RLS probes).

## 8. FAIL / STOP criteria
- STOP **immediately** if: any attempt to call Grab/external rider; trip would exceed 5 km; route not verifiable; any real customer PII/destination would be exposed; any live-payment call; any frozen provider toggled; pg_cron/plan/PITR/race-opt modified; any non-canonical DB mutation (SQL force).
- FAIL if: driver RPC rejects the authorized driver (`ERR_NOT_A_DRIVER` wrongly); assignment doesn't persist; a canonical hop returns an unexpected error; `track_order` misreports during the run; delivery fee mismatch; any double-charge or payment-state drift.
- Any anomaly → **HALT**, capture DB/log snapshot, do not proceed; revert to §9.

## 9. Rollback / cleanup procedure (post-run)
- Move/cancel the pilot order to a terminal state; cancel any open TEST PIs on it (Stripe TEST); if a NEW driver was created, mark unavailable or delete (owner-approved).
- Restore driver `status` to available (or remove after pilot).
- Do **NOT** delete `PO-20260929-131` or any W5-2 evidence. Test-destination coordinates live only in the pilot order; ensure no real PII.
- If pilot FAILED, leave test artifacts in place for forensics; report; await Owner disposition.
- Optionally `SAFE DELETE` the pilot order + QA driver after approval (see Cleanup Audit).

---

## 10. Summary
W5-3 = one isolated physical run with a **named test driver → kitchen-owned ≤5 km destination → QA pre-paid TEST order**, exercising the same canonical state machine, proving the physical leg with driver-action + arrival evidence. **Independent from Software E2E; requires Owner approval; NO external rider, NO real food/customer/payment/PII; frozen scope untouched.**
---

## 2. Area audit (existing capability vs pilot intent)

| # | Area | Current (W5-2 verified) | Pilot intent |
|---|---|---|---|
| 1 | Driver assignment | `upsert_driver` + `assign_driver` → 1 `delivery_assignments` row, driver busy | Re-use identical commands; assign a real (test) driver |
| 2 | Driver identity | QA driver `drv-…-c10a` / `+66990000100` / `QA TEST VEHICLE` | **TEST DRIVER** = kitchen staff or dedicated QA, real human operating the vehicle |
| 3 | Destination handling | `self_delivery` with dropoff coords (~170 m from kitchen) | **TEST DESTINATION** ≤5 km, kitchen-owned/QA address |
| 4 | ≤5 km self-delivery rule | canonical `compute_delivery_fee` + radius guard | Pilot uses **self-delivery** inside radius (validate ≤5 km path) |
| 5 | >5 km external-rider boundary | boundary coded; **integration NOT enabled** (frozen) | **OUT OF PILOT SCOPE** — document only; STOP if trip exceeds 5 km |
| 6 | Delivery fee calculation | `compute_delivery_fee` (=25.00 in E2E), stored on order | Re-derived at create; assert equals expected for the chosen destination |
| 7 | Delivery status lifecycle | `ready_for_dispatch→dispatched→in_transit→arrived→delivered` (admin-driven) | Driver-driven canonical RPCs (`accept → picked_up → in_transit → delivered`) |
| 8 | Customer tracking | `track_order` RPC + `/track` gate (delivered shown) | Live status visible to the (test) customer during the run |
| 9 | Proof of delivery / completion evidence | DB status only | Driver-confirmed `delivered` + optional note/photo field IF schema allows (else DB state + audit). No new column without migration approval. |
| 10 | Cancel / failure / reassignment | `cancelled`, `ERR_ORDER_NOT_DISPATCHABLE`, `ERR_INVALID_TRANSITION` | Predefined failure drills (see §6) |
| 11 | Admin visibility | RLS admin sees order + driver + assignment | Operator dashboard shows live assignment/driver status |
| 12 | Customer visibility | tracking fields (no PII) | Test customer polling `track_order` during trip |
| 13 | Notifications | event-map client notifications (ORDER_CREATED persisted only) | Status events shown in-app to test customer/driver; no new channel |
| 14 | Audit trail | `order_status_history` + `audit_logs` (20 rows in E2E) | Same functions capture every pilot transition |
| 15 | Payment boundary | TEST mode end-to-end | Unchanged: driver action never touches payment state; payment already `paid` (TEST) before dispatch |
| 16 | No real-customer contamination | QA identity only | All phones/names/coords = reserved QA; verify no overlaps with real data |