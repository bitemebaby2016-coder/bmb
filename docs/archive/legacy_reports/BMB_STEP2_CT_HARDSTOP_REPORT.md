# BMB_STEP2_CT_HARDSTOP_REPORT

**STEP 2 — CONTROLLED TEST RUNTIME VERIFICATION · HARD STOP** (2026-09-28)
Owner-authorized CT-01..CT-05. **CI-04 failed → HARD STOP (per Owner FAILURE RULE). CT-05 NOT run.**

---

## 1. CT RESULTS

| CT | Result | Evidence |
|----|--------|----------|
| **CT-01** Single-open PaymentIntent | **PASS** | `e2e/ct-1.json` — same PI reused (`pi_3UKen…`, 2nd `reused:true`), exactly 1 open PI, already-paid → **409 ERR_ORDER_ALREADY_PAID** (canonical `record_payment_result`) |
| **CT-02** Customer Cancellation | **PASS** | `e2e/ct-2.json` — pending→cancelled by CUSTOMER (history + audit); paid+cancelled preserves `paid` + stays refund-eligible (resolution=CT-04) |
| **CT-03** Driver Reassignment | **PASS** | `e2e/ct-3.json` — Rider A→B reassignment, **exactly 1 assignment row** (unique order_number), 2 audit events, order `ready_for_dispatch` |
| **CT-04** Refund (F2/F3) | **FAIL → HARD STOP** | `e2e/ct-4.json` — see §2 |
| **CT-05** Offline Payment | **NOT RUN** | (blocked by CT-04 HARD STOP) |

---

## 2. CT-04 FAILURE REPORT (Owner FAILURE RULE format)

- **CT:** CT-04 — Refund (FULL + PARTIAL; F2 `charge.refunded` webhook sync; F3 PI/order status)
- **Expected:** deployed `stripe-refund` returns a refund; deployed `stripe-webhook` `charge.refunded` syncs DB; partial→`partially_refunded`, full→`refunded`; over-refund + idempotency protected.
- **Actual (reproducible):**
  - `stripe-refund` EF → **HTTP 500 `{"error":"ERR_NOT_CONFIGURED"}`** for ALL calls (partial, full, over-refund, idempotent) — even with a valid admin JWT.
  - `stripe-webhook` EF → **HTTP 500 `Internal Server Error`** when a signed `charge.refunded` is POSTed.
  - Direct Stripe **TEST** refund API → **HTTP 400** (no charge on the un-confirmed test PaymentIntent — a test-methodology gap, secondary).
  - DB after each: order stays `paid`, PI stays `completed`, refunded_total_minor=0 (no refund persisted).
- **Root cause (primary):** Deployed `stripe-refund` v8 returns `ERR_NOT_CONFIGURED` from its env guard (`if (!sk || !serviceKey || !supabaseUrl)`), meaning at runtime at least one of `STRIPE_SECRET_KEY` / `SUPABASE_URL` / `bmb_backend_production_supabase_service_role_key` is **empty in the function runtime** — despite all three being present AND non-empty at project-secret level (verified read-only, values never printed). `create-checkout` v40 works because it has a **`SUPABASE_SERVICE_ROLE_KEY` legacy fallback** which `stripe-refund`/`stripe-webhook` lack. Deployed `stripe-webhook` v46 500s similarly. → **deployed-runtime secret-binding gap** for these two functions.
  - *Note:* a naive no-auth probe returned 401 `ERR_NOT_AUTHENTICATED`, but that fires at the authHeader guard (before the env check); it does **not** prove env is configured — the valid-JWT path is the authoritative proof of `ERR_NOT_CONFIGURED`.
- **File/function/RPC:** `supabase/functions/stripe-refund/index.ts` (env guard ~lines 83–90; F3 at :226), `supabase/functions/stripe-webhook/index.ts` (F2 `charge.refunded`), deployed versions **8** / **46**.
- **Severity:** **HIGH** — blocks CT-04 and therefore STEP 2 closure. No refund executed; no money moved (TEST only).
- **Recommended fix (requires Owner decision — NOT executed):** (a) redeploy `stripe-refund` + `stripe-webhook` after confirming/refreshing their runtime secret binding, and/or (b) add a `SUPABASE_SERVICE_ROLE_KEY` fallback in their source for parity with `create-checkout`, then redeploy; then re-run CT-04.

---

## 3. Regression (local, this gate)

| Check | Result |
|-------|--------|
| Vitest | ✅ 194 passed (24 files) — from pre-run |
| TypeScript | ✅ 0 errors |
| Lint | ✅ 0 errors |
| Build | ✅ (21.11s) |
| Secret scan | ✅ 0 hits (237 files) |

---

## 4. State / DISCLOSURES

- Production mutations this gate: the 3 authorized EF deploys (create-checkout v40, stripe-webhook v46, stripe-refund v8); controlled test orders/PIs/refunds-results created during CT-01..04 (all TEST Stripe, labeled `[STEP2-CT]`).
- **No cleanup, no commit, no push, no deletion performed.**
- Transparency: my first CLI deploy used `--no-verify-jwt` (v39/45/7) then was corrected (v40/46/8) — disclosed earlier.
- CT-04 was attempted 3×: identical `ERR_NOT_CONFIGURED` each time (deterministic, not transient).

---

## 5. STATUS

```
CT-01 = PASS
CT-02 = PASS
CT-03 = PASS
CT-04 = FAIL (HARD STOP)
CT-05 = NOT RUN

F1 runtime = PASS (CT-01: reuse + already-paid; F1 persistence-injection not deterministically testable w/o schema tool — source/deploy fail-closed)
F2 runtime = FAIL (webhook Internal Server Error)
F3 runtime = FAIL (stripe-refund ERR_NOT_CONFIGURED)
F4 runtime = VERIFIED via 194-test regression (dead path removed)

Vitest = 194 · TypeScript = 0 · Lint = 0 · Build = OK · Secret scan = 0 hits

TEST ARTIFACTS = [STEP2-CT] orders/PIs/assignments (controlled TEST data; classified in cleanup block)
PRODUCTION MUTATIONS = 3 EF deploys + controlled TEST data only (TEST Stripe)
HEAD = 4be4175b644ce995d10afe4cce6c3cf4ea865cde
origin/main = 4be4175b (no push)
WORKTREE = DIRTY (STEP 2 fixes uncommitted)

STEP 2 = NOT CLOSED (CT-04 failed)
STEP 3 = NOT STARTED
```

---

## 6. HARD STOP

Per Owner FAILURE RULE, execution stops at the first failing CT. Awaiting Owner decision on the recommended fix for the deployed `stripe-refund`/`stripe-webhook` runtime secret-binding gap (redeploy vs. source fallback parity) before any re-run of CT-04/CT-05. No cleanup, no commit, no push until Owner reviews.