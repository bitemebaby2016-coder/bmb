# BMB_W5_H2_TEST_ORDER_E2E — TEST TRANSACTION LIFECYCLE

**Wave:** W5-2 · **Date:** 2026-09-28 · **Mode:** TEST DATA / QA identity ONLY
**VERDICT: H2 = NOT CLOSED (BLOCKED at KITCHEN stage) — Customer-side chain = RUNTIME VERIFIED**

Status labels: IMPLEMENTED / DEPLOYED / RUNTIME VERIFIED / PASS / BLOCKED / DEFERRED

## 1. Executive Summary
- **Customer-side chain (identity → PRE_ORDER creation → Stripe TEST payment → real webhook → paid → tracking → history → notifications/audit) = RUNTIME VERIFIED on production** (`e2e/w5w2-test-order.json`, order `PO-20260929-131`)
- **KITCHEN / DELIVERY-ASSIGNMENT / OUT_FOR_DELIVERY / DELIVERED = BLOCKED** — no QA admin identity exists (transition_order_status canonical guard correctly refuses non-admin; Owner must supply admin test credentials or approve creating a QA admin) + no test driver identity for assignment
- **Physical Delivery = DEFERRED** (operational pilot, separate gate — แยกจาก Software E2E ตาม Owner directive)
- 2 product bugs found & fixed during QA verify: W5-1 tracking phone-format mismatch (migration 051), EF `phone-auto-login` reuse-path broken (patched + deployed v7)

## 2. Environment
- Supabase prod `ivkdfognyiwjcmrhcnwz` · PWA build @ HEAD 37dbf0c (local preview) · Stripe = **pk_test / TEST MODE** · Migration 050/051 = APPLIED · before-snapshot `e2e/w5w2-before.json`

## 3. QA Identity — RUNTIME VERIFIED (PASS)
- Created via **canonical EF `phone-auto-login`** (supported quick-login): `QA W52` / phone `+66990000003` (E.164 required), customer row `cust-66990000003`, auth user `32d8d700-…`, session minted by the EF. NO real customer data used.

## 4. Test Order Definition
- PRE_ORDER · product `prod-5` (ลุยสวนหมู+กุ้ง, server price 85.00) ×1 · round `round-20260929-morning` (auto-instantiated via canonical `ensure_rounds_for_date`) · scheduled_date `2026-09-29` · `credit_card` · `self_delivery`, dropoff = kitchen + ~170m (test point) · QA address only

## 5. Before Snapshot — PASS (`e2e/w5w2-before.json`)
- qa_customers=0 (reuse impossible → created fresh) · preorder products 3 · future rounds 0 (→ created via canonical ensure) · orders baseline 157 · EFs DEPLOYED


## 6. Customer Order Creation — RUNTIME VERIFIED (PASS)
- `create_order_with_items` (025 v3): `PO-20260929-131` · subtotal 85.00 + delivery_fee 25.00 (canonical `compute_delivery_fee`) = total 110.00 · `order_mode=PRE_ORDER` · `source_channel=PWA` · `duplicate:false` · exactly 1 order · NO direct INSERT

## 7. Payment — RUNTIME VERIFIED (PASS)
- EF `create-checkout` (QA JWT) → real Stripe TEST PaymentIntent (amount 110 re-derived from DB) → **Stripe.js confirmCardPayment `tok_visa` → status `succeeded`** (no real money)

## 8. Webhook — RUNTIME VERIFIED (PASS)
- REAL Stripe delivery → EF `stripe-webhook` (signature verified) → `record_payment_result` → `orders.payment_status = paid`, intent `completed` + `payment_intent_id` + `completed_at` (observed < 60s)

## 9. Confirmation — PASS
- Canonical state verified via tracking UI (`pending` + `paid`, PRE_ORDER badge) — screenshots `e2e/screenshots/w5w2-*.png`

## 10. Kitchen Lifecycle — **BLOCKED (STOP per rule 9)**
- `transition_order_status(pending→confirmed)` with QA JWT → `P0001 ERR_INVALID_TRANSITION` (canonical admin guard refuses non-admin) — evidence `stages.kitchen_transition_attempt`
- **Blocker:** production has NO QA admin identity (admin = `is_admin()` via `profiles.role='admin'`; promoting a QA user = administrative mutation → requires Owner approval per rule 0)
- CONFIRMED→PREPARING→READY = NOT RUNTIME VERIFIED (no fake transition, no SQL force)

## 11. Delivery — **BLOCKED / DEFERRED**
- Assignment blocked upstream by §10 + no test driver identity (rule 10: STOP before assignment) · `delivery_assignments` for the test order = 0 rows (no fake row created)
- Physical delivery pilot = DEFERRED (needs approved test driver + test destination)

## 18. Cleanup Status — READ-ONLY INVENTORY (NO delete — รอ Owner approval)
| Artifact | ค่า | แนะนำ |
|---|---|---|
| Test order | `PO-20260929-131` (pending/paid, PRE_ORDER) + rounds `round-20260929-*` | เก็บเป็น test data หรือ Owner สั่ง cleanup |
| QA auth users + customers rows | `+66990000001` (orphan, reuse-bug), `+66990000002` (orphan), `+66990000003` (ใช้จริง) | ลบผ่าน Auth admin = destructive → STOP, รอ Owner approve |
| Stripe TEST charges | 3 × 110.00 THB (test mode) — ดู §15 | คืนได้เฉพาะ Stripe Dashboard/EF refund (admin) — Owner decision |
| Pending PI rows | 2 rows (create-checkout side effect) | ปล่อยตามธรรมชาติ หรือลบโดย Owner |

## 19. Known Limitations / Findings (NEW)
1. **BLOCKER (H2):** no QA admin identity → kitchen/delivery/delivered transitions unproven. Options: (a) Owner ให้ test admin credentials หรือ (b) Owner approve promote 1 QA user → role='admin' ช่วงทดสอบ
2. **MEDIUM:** create-checkout multi-PI per order (double-charge risk) — backlog, รอ Owner decision
3. **MEDIUM (FIXED + DEPLOYED):** EF `phone-auto-login` reuse path พัง (admin users API ไม่รองรับ ?email= filter → "already registered" กับบัญชีเดิมเสมอ) — patched (paginated local match) + DEPLOYED v7 + RUNTIME VERIFIED
4. **FIXED:** W5-1 `track_order` phone format mismatch (local vs E.164) — migration 051 APPLIED
5. Physical delivery = DEFERRED (operational pilot)

## 20. Final Gate
```
W5-2 GATE = STOP at KITCHEN stage (per rule 9/26)
H2 = NOT CLOSED
TEST TRANSACTION PATH (customer side) = RUNTIME VERIFIED
Kitchen/Delivery/Delivered (admin-side lifecycle) = BLOCKED —
  exact blocker: missing QA admin identity (canonical guard working correctly)
Physical Delivery Pilot = DEFERRED
ไม่มีการประกาศ PRODUCTION READY / REAL CUSTOMER READY
FROZEN (ไม่ถูกแตะ): OTP/SMS · P1-1 · Meta E2E · Payment Events · Web Push ·
  Email/LINE · pg_cron · Supabase Pro/PITR · new providers
```


## 12. Tracking (W5-1 final proof) — RUNTIME VERIFIED (PASS)
- RPC `track_order`: correct phone (E.164 **และ** local 099… ผ่าน normalization ของ migration 051) → `found:true` tracking-fields only — **no PII/address/coords/internal fields** · wrong phone / wrong number → `found:false`
- /track UI (guest phone gate): correct → status shown with **0 PII leakage**; wrong phone → rejected

## 13. Notifications — RUNTIME VERIFIED (PASS)
- `notifications` row `evt-ord-PO-20260929-131-pending` (ORDER_CREATED) created exactly once — no duplicate notification side effects

## 14. Audit Trail — PASS
- `order_status_history`: exactly 1 event (NULL→pending, CUSTOMER, QA uid) · `audit_logs` queried (schema-aware) — no unexpected rows

## 15. Idempotency — PASS (order-level) + FINDING (provider-level)
- Order-level: 1 order · 1 history event · single `paid` state · no duplicate order/history/notification despite repeated payment runs
- **FINDING (MEDIUM, backlog):** `create-checkout` allows MULTIPLE PaymentIntents per order — resume runs produced **3 successful TEST charges (330 THB test money)** on the same order (`pi_3UKWV33…`, `pi_3UKWWA3…`, `pi_3UKWX13…`). Order state stays correct, but a customer re-invoking checkout could be charged more than once → needs single-open-PI guard (Owner decision; NOT fixed during W5-2)
- Webhook duplicate replay per PI = idempotent (prior gate T4 + 010 short-circuit; each PI here has exactly one `completed_at`)

## 16. Database Evidence — RUNTIME VERIFIED
- orders: 1 row as defined · order_items: 1 row (canonical price) · history/notification/PI rows as above · baseline 157 orders unchanged except test artifacts · no unrelated mutation

## 17. Regression — PASS
- tsc 0 · vitest **195/195** (W5-1 baseline 195 → 195, delta 0) · lint 0 · build PASS · secret scan 239 files 0 hits · scheduler `automation-scheduler.yml` latest runs #91–93 = completed/**success** (incl. during test window) · RLS probes re-run **5/5 PASS**
