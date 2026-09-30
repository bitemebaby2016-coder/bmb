# BMB_W5_FINAL_PRODUCTION_READINESS_REPORT

**Date:** 2026-09-28 · **Consolidates:** W5-0 (Product/Readiness Audit), W5-1 (H1 Security Patch), W5-2 (Software E2E) · Mode: READ-ONLY consolidation (this report adds/modifies nothing in production)

---

## 1. Final Verdict

```text
H1 = CLOSED                                            (anonymous PII exposure patched + RUNTIME VERIFIED)
H2 = CLOSED                                            (full software lifecycle RUNTIME VERIFIED with TEST identity)
SOFTWARE = PASS / RUNTIME VERIFIED
PHYSICAL DELIVERY = DEFERRED / NOT VERIFIED            (separate gate — NOT implied by software "delivered")
```

> **CRITICAL CLARIFICATION:** In every artifact of W5-2, the status **`delivered`** proves the **software state machine** advanced through all canonical states with real DB rows, real Stripe TEST payment, and real tracking. It does **NOT** prove that food ever travelled to a customer. Readiness for **real operational delivery is a separate, still-open gate** (see Part C spec).

---

## 2. Software Readiness — PASS / RUNTIME VERIFIED

| Component | Verdict | Evidence |
|---|---|---|
| **H1 — Anonymous PII security patch** | **CLOSED** | `e2e/w5h1-probes.json` = **5/5 PASS / 0 fail**: anon direct-select orders → 401 · anon `select *` → 401 · `track_order` deployed → `{found:false}` · anti-enumeration identical shape ×3 · anon `track_order_attempts` → 401. Migration 050 dropped `orders_anon_read`; migration 051 normalized tracking phone. Guest phone gate on `/track` (no PII for wrong/unknown). |
| **H2 — Software transaction lifecycle** | **CLOSED / RUNTIME VERIFIED** | `e2e/w5w2-test-order.json` phase B: `PO-20260929-131` advanced **`pending→confirmed→preparing→ready_for_dispatch→(assign)→dispatched(OUT_FOR_DELIVERY)→in_transit→arrived→delivered`** with 8 `order_status_history` rows + 20 `audit_logs` rows. QA admin **PROMOTED → REVOKED**; post-revoke `assign_driver` = `ERR_FORBIDDEN` ✓. |
| **Payment TEST lifecycle** | **VERIFIED** | Real Stripe **TEST** PaymentIntent (`pk_test`/`tok_visa` confirm = `succeeded`) → real `stripe-webhook` (sig verified) → `record_payment_result` → `paid` + intent `completed` < 60s. No real money. |
| **Tracking security** | **VERIFIED** | `track_order` (E.164 **and** local 099… phone) → `found:true`, tracking-fields only, **0 PII/0 internal**; wrong → `found:false`. `/track` UI guest gate correct/wrong behaviour — `w5w2-track-delivered.png`. |
| **Notifications / audit / history** | **VERIFIED** | `notifications` ORDER_CREATED = 1 (no dup). `order_status_history` = 8 unforgeable rows. `audit_logs` = 20 rows. |
| **PaymentIntent single-open-PI guard** | **VERIFIED** | Fixed+deployed+probed: `e2e/w5w2-pi-guard.json` PASS — 2× `create-checkout` → **same PI**, exactly 1 `payment_intents` row, zero charges; already-paid → **409 `ERR_ORDER_ALREADY_PAID`**. (Pre-fix finding in §4.) |
| **Idempotency / duplicate safety** | **VERIFIED** | Reassign → 1 assignment row · dup rider deliver → `ERR_NOT_A_DRIVER` · `delivered→delivered` ok, history unchanged · `delivered→confirmed` → `ERR_INVALID_TRANSITION` · webhook per-PI replays idempotent. |
| **QA admin privilege** | **REVOKED** | `prior_role=customer`, now `role=customer` (uid `32d8d700-…`). Re-verified post-commit. |
| **Regression suite** | **PASS** | tsc 0 · vitest **195/195** (delta 0) · lint 0 · build PASS · secret scan **239 files / 0 hits** · scheduler runs success · RLS probes 5/5. |
| **Frozen scope** | **Unchanged** | OTP/SMS · P1-1 · Meta E2E · Payment Events · Web Push · Email/LINE · pg_cron · Supabase Pro/PITR · race optimization — none touched. |

## 3. Physical Delivery — DEFERRED / NOT VERIFIED

- **NOT VERIFIED:** no real food delivered, no external rider (Grab) called, no real customer/destination used. All "delivery" in W5-2 is **software state** (`dispatched`, `in_transit`, `arrived`, `delivered`) against a QA driver record on synthetic coordinates.
- **DEFERRED:** separate gate, awaiting Owner approval of a test driver + test destination (Part C).

## 4. Honesty Notes (retained from W5-2)

1. **Payment guard pre-fix:** `w5w2-test-order.json` records the *first* guard probe with `b_reuse_same_pi.same=false` — at that moment `create-checkout` made a **new** PI per invocation (3 successful TEST charges, 330 THB test money, all Stripe TEST). Bug found in QA → **fixed** in `create-checkout` (single-open-PI reuse + 409 already-paid), deployed, re-verified via `w5w2-pi-guard.json` at HEAD `03f2389`.
2. **Phone format:** W5-1 found tracking broken for local-typed phones (`099…` vs `+66…`); migration 051 normalized — RUNTIME VERIFIED.
3. **EF env:** API-redeploys can drop the custom service-role secret env; `create-checkout` now has the `SUPABASE_SERVICE_ROLE_KEY` fallback.
4. **No operational claim:** W5 PASS covers **software** only; real-world ops need the pilot.

---

## 5. Consolidated Wave-5 Gate History

| Gate | Result | HEAD |
|---|---|---|
| W5-0 Product/Readiness Audit | STOP & REPORT (HIGH×2) — set scope | `c0cb1a7` |
| W5-1 H1 Security Patch | CLOSED — probes 5/5, vitest 195/195 | `37dbf0c` |
| W5-2 Software E2E | CLOSED — lifecycle RUNTIME VERIFIED, guard fixed | `03f2389` |

**HEAD == origin/main == `03f2389` · WORKTREE CLEAN** (re-verified for Part D).