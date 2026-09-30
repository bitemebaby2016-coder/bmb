# BMB_W5_H2_TEST_ORDER_E2E — TEST TRANSACTION LIFECYCLE (FULL SOFTWARE E2E)

**Wave:** W5-2 · **Date:** 2026-09-28 · **Mode:** TEST DATA / QA identity ONLY (Owner-approved OPTION A: temporary QA admin)
**VERDICT: H2 = PASS · SOFTWARE E2E = PASS (RUNTIME VERIFIED full lifecycle) · PHYSICAL DELIVERY = DEFERRED (separate gate)**

Status labels: IMPLEMENTED / DEPLOYED / RUNTIME VERIFIED / PASS / BLOCKED / DEFERRED

## 1. Executive Summary
- Full canonical **software** lifecycle RUNTIME VERIFIED on production for order `PO-20260929-131` (QA identity): `pending → confirmed → preparing → ready_for_dispatch → (assignment) → dispatched(OUT_FOR_DELIVERY) → in_transit → arrived → delivered`, paid via real **Stripe TEST** webhook, with tracking / order history / notifications / audit / admin visibility / idempotency evidence.
- **Physical Delivery = DEFERRED** (operational pilot, separate gate — แยกจาก Software E2E ตาม Owner directive; no external rider called).
- 3 product bugs found & fixed/deployed: migration 051 (track phone normalization), EF `phone-auto-login` reuse path, EF `create-checkout` single-open-PI guard.

## 2. Environment
- Supabase prod `ivkdfognyiwjcmrhcnwz` · PWA build @ HEAD (WORKTREE clean at end) · Stripe **pk_test / TEST MODE** · migrations 050/051 APPLIED · EFs `phone-auto-login` v7 / `create-checkout` (guarded) DEPLOYED · `e2e/w5w2-before.json`, `e2e/w5w2-test-order.json`, `e2e/w5w2-pi-guard.json`

## 3. QA Identity — RUNTIME VERIFIED (PASS)
- Canonical EF `phone-auto-login`: `QA W52` / `+66990000003` (E.164) · customer `cust-66990000003` · auth user `32d8d700-…` · temp `profiles.role='admin'` during Phase B only, **REVOKED → 'customer' after** (ev `admin_promotion.revoke`). Post-revoke boundary: `assign_driver` → `400 ERR_FORBIDDEN` ✓. NO real customer data.

## 4. Test Order Definition
- PRE_ORDER · `prod-5` (server price 85.00) ×1 · round `round-20260929-morning` (auto `ensure_rounds_for_date`) · 2026-09-29 · `credit_card` · `self_delivery` · dropoff kitchen + ~170m · QA address only

## 5. Before Snapshot — PASS
- qa_customers=0 · preorder products 3 · future rounds 0 (→ created canonically) · orders baseline 157 · EFs DEPLOYED

## 6. Customer Order Creation — RUNTIME VERIFIED (PASS)
- `create_order_with_items`: `PO-20260929-131` · 85.00 + delivery_fee 25.00 = 110.00 · PRE_ORDER · `source_channel=PWA` · `duplicate:false` · 1 order · no direct INSERT
## 11. Delivery — RUNTIME VERIFIED (PASS, canonical; PHYSICAL = DEFERRED)
- `upsert_driver` (`QA W52 Driver` / `+66990000100`) → `assign_driver` → 1 `delivery_assignments` row + driver busy + audit `delivery_assigned`
- OUT_FOR_DELIVERY = `ready_for_dispatch → dispatched` (vocab "Out for Delivery") · rider canonical hops (test driver): accept → picked_up → in_transit → delivered · order `dispatched→in_transit→arrived→delivered`
- **No external rider; no physical miles — purely canonical software state transitions**

## 12. Tracking (W5-1 final proof) — RUNTIME VERIFIED (PASS)
- RPC `track_order`: correct phone (E.164 และ local 099…, migration 051) → `found:true`, status=`delivered`, tracking-fields only (**no PII/address/coords**) · wrong phone / wrong number → `found:false`
- /track UI guest gate: delivered + receipt_url, **0 PII leak**; wrong phone → rejected (`w5w2-track-delivered.png`)

## 13. Notifications — RUNTIME VERIFIED (PASS, scope note)
- persisted `notifications`: **ORDER_CREATED = 1** (no duplicates). Status-change notifications render via client `notificationStore` map (order_dispatched "Out for Delivery", order_delivered…) — not persisted rows (existing architecture). No duplicate side effects.

## 14. Audit Trail — RUNTIME VERIFIED (PASS)
- `order_status_history` = **8 rows** (pending CUSTOMER + 7 ADMIN) — authoritative, unforgeable (RLS + in-txn trigger)
- `audit_logs` = **20 rows** (order_status_change per transition + delivery_assigned + …)

## 15. Idempotency / Duplicate Safety — PASS (incl. payment guard fixed)
- 1 order · 8 history rows · single paid/delivered · reassign still **1** assignment row · dup rider delivered → `ERR_ALREADY_DELIVERED` · `delivered→delivered` ok but **history unchanged** · `delivered→confirmed` → `400 ERR_INVALID_TRANSITION` (history unchanged) · webhook replay per PI idempotent
- **PAYMENT FINDING (INVESTIGATED + FIXED + DEPLOYED + RUNTIME VERIFIED):**
  - Path: `create-checkout` created a NEW PI per invocation (no guard) → resume produced **3 successful TEST charges** (110 THB each) on one order.
  - Fix: (a) terminal `payment_status` → **409 ERR_ORDER_ALREADY_PAID**; (b) else REUSE latest open PI (Stripe GET) instead of new. DEPLOYED.
  - Probe `e2e/w5w2-pi-guard.json` PASS: fresh order → 2× create-checkout → **same PI**, exactly 1 row (client_secret), owner-cancelled, **zero charges**. Already-paid → 409. Root-cause: API-deployed function lost custom service-role secret env → added `SUPABASE_SERVICE_ROLE_KEY` fallback.

## 16. Database Evidence — RUNTIME VERIFIED (READ-ONLY)
- orders delivered/paid PRE_ORDER · order_items 1 row · history 8 rows (list §14) · notifications ORDER_CREATED=1 · audit 20 · delivery_assignments 1 row → delivered · no unrelated mutation (baseline 157)

## 17. Regression — PASS
- tsc 0 · vitest **195/195** (baseline W5-1 195 → 195, delta 0) · lint 0 · build PASS · secret scan 239 files 0 hits · scheduler `automation-scheduler.yml` latest runs success (incl. test window) · RLS probes 5/5

## 18. Cleanup Status — READ-ONLY INVENTORY (NO delete — รอ Owner approval)
| Artifact | ค่า | หมายเหตุ cleanup |
|---|---|---|
| Software E2E order | `PO-20260929-131` (delivered/paid, PRE_ORDER) | เก็บเป็น test data หรือ Owner สั่ง cleanup |
| Guard orders | `BMB-20260928-900` (cancelled, SAME_DAY), `BMB-20260928-322` (cancelled, SAME_DAY) + rounds instantiated | test artifacts |
| QA auth/customer | `+66990000001`,`+66990000002` (orphan reuse-bug), `+66990000003` (used; role restored to customer) | ลบ destructive ต้อง Owner approve |
| QA driver | `QA W52 Driver` (`+66990000100`) in `drivers` (status available) | ลบโดย Owner |
| Stripe TEST charges | 3 × 110.00 (test mode) `pi_3UKWV33…/pi_3UKWWA3…/pi_3UKWX13…` | refund ผ่าน Dashboard/EF (admin) — Owner |
| Pending/orphan PIs | 2 pending rows on PO (pre-guard) + uncancelled PIs from BMB-20260928-900 (no DB row) | ปล่อยตามธรรมชาติ หรือ Owner สั่งลบ |

## 19. Known Limitations / Findings
1. **Software E2E = RUNTIME VERIFIED · Physical Delivery = DEFERRED (separate operational pilot, needs Owner-approved test driver/destination).** "DELIVERED" in this report = canonical software state transition, NOT physical food delivery.
2. **FIXED + DEPLOYED:** EF `create-checkout` single-open-PI guard (double-charge risk closed).
3. **FIXED + DEPLOYED (v7):** EF `phone-auto-login` reuse path.
4. **FIXED:** migration 051 track phone normalization.
5. Status-change notifications are event-map (client) only, not persisted rows — pre-existing; unchanged.

## 20. Final Gate
```
W5-2 GATE = PASS (Software E2E)
H2 = PASS
SOFTWARE E2E (transaction + payment + order lifecycle + delivery state + tracking + notifications + audit) = RUNTIME VERIFIED
PHYSICAL DELIVERY PILOT = DEFERRED / SEPARATE GATE (NOT YET VERIFIED — not a software failure)
Overall "fully operational" = NOT claimed until pilot passes
QA admin = REVOKED (restored to customer) · PII = none leaked
FROZEN (ไม่ถูกแตะ): OTP/SMS · P1-1 · Meta E2E · Payment Events · Web Push ·
  Email/LINE · pg_cron · Supabase Pro/PITR · new providers
NEXT: STOP after W5-2 (do not auto-start W5-3) — FINAL PRODUCTION READINESS REPORT + await Owner decision
```

## 7. Payment — RUNTIME VERIFIED (PASS)
- EF `create-checkout` → real Stripe TEST PI → **Stripe.js confirmCardPayment `tok_visa` → succeeded** (no real money)

## 8. Webhook — RUNTIME VERIFIED (PASS)
- REAL Stripe → EF `stripe-webhook` (sig verified) → `record_payment_result` → `paid`, intent `completed` (+ id/completed_at) < 60s

## 9. Confirmation — PASS
- `pending` + `paid` + PRE_ORDER badge via tracking UI (screenshots)

## 10. Kitchen Lifecycle — RUNTIME VERIFIED (PASS, temp QA admin + canonical `transition_order_status`)
- pending→confirmed · confirmed→preparing · preparing→ready_for_dispatch — all `ok`, history rows `ADMIN`. No SQL force, no fake transition.