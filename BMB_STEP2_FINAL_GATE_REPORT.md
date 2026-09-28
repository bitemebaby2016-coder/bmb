# BMB_STEP2_FINAL_GATE_REPORT

**STEP 2 — COMMERCE INTEGRITY · FINAL VERIFICATION GATE** (2026-09-28)
**Owner command executed per contract:** no EF deployment authorized → controlled tests scoped accordingly.

---

## 1. Environment / Config Report (per Owner §1 — "ตรวจ এবং report environment/config قبل")

| Item | Value | Status |
|------|-------|--------|
| Supabase project (production DB) | `ivkdfognyiwjcmrhcnwz` | confirmed |
| Stripe key | `sk_test_...` | ✅ TEST mode (no real money) |
| Webhook secret | `whsec_...` | present |
| Test admin / customer / driver1 / driver2 | qa-admin / qa-customer / qa-driver / qa-driver2 | in `supabase/secrets.local.env` |
| `SUPABASE_ACCESS_TOKEN` | available in shell env | deploy + evidence queries possible |
| `create-checkout` / `stripe-refund` / `stripe-webhook` verify_jwt | true / true / false | per `config.toml` |
| EF deploy to prod | **NOT AUTHORIZED** (Owner re-issued command without option B/C) | ⛔ blocked |

**Preflight live probes (read-only, 2026-09-28):**
- `GET /functions/v1/stripe-refund` → 200 `{ok:true,service:"stripe-refund"}`
- `GET /functions/v1/create-checkout` → 405 (POST-only, deployed)
- `GET /functions/v1/ai-proxy` → 405 · `phone-auto-login` → 405 · `automation-worker` → 405 (deployed)
- `GET /functions/v1/daily-report` → 404 (not deployed = DEFERRED, pg_cron FROZEN — not a bug)
- `GET /functions/v1/stripe-webhook` → **"TypeError: fetch failed"** ⚠️ (deployed webhook GET not healthy on probe)

**Preflight test-data inventory (baseline; already in prod DB):**
- QA/credit-card test orders incl. `PO-20260929-131` (delivered/paid), `BMB-20260928-900`, `BMB-20260928-322` (cancelled)
- Multiple pending `promptpay_qr` orders (`BMB-20260927-*`)
- QA drivers `drv-qa-w2-01/02`, `drv-…-c10a` (status `busy`); many `delivery_assignments`
- Cleanup baseline recorded — see §4

---

## 2. Controlled Test Matrix Result

| ID | Scope | Requires EF deploy? | Result |
|----|-------|--------------------|--------|
| **CT-01** Single-open-PI | create-checkout reuse + already-paid 409 | **deploy create-checkout (F1)** | **PARTIAL / BLOCKED.** Prior evidence `e2e/w5w2-pi-guard.json` (2026-09-28, old deployed code) = PASS. **BUT** `e2e/w5w2-test-order.json` shows `same:false` (F1 silent-insert-failure flakiness). F1 fix is source-only; cannot be re-verified live without deploy. |
| **CT-02** Cancellation | canonical cancel + state/payment/audit | No (RPC) | **NOT RE-RUN THIS GATE** — cannot close overall; prior evidence in `e2e/w5w2-test-order.json`. |
| **CT-03** Reassignment | assign A → fail → assign B | No (RPC) | **NOT RE-RUN THIS GATE** — same; prior evidence in `e2e/w5w2-test-order.json`. |
| **CT-04** Refund (FULL+PARTIAL; F2; F3) | stripe-refund + stripe-webhook | **deploy stripe-refund (F3)+stripe-webhook (F2)** | **BLOCKED** ⛔ — deployed EFs lack F2/F3; cannot runtime-verify without deploy (not authorized). |
| **CT-05** Offline payment | RPC | No (RPC) | **NOT RE-RUN THIS GATE** — same. |

**Decision (contract-compliant):** CT-04 cannot execute without unauthorized EF deploy → gate cannot close. I declined a partial, closure-impossible, production-mutating harness (CT-02/03/05 only) per Owner §1 HARD STOP.
---

## 3. Failure / Block Report (Owner §3 format)

- **TEST ID:** CT-04 (Refund, F2/F3) — plus CT-01 (F1 live re-verify)
- **Expected:** execute FULL + PARTIAL refund via deployed EF; partial → `partially_refunded` / full → `refunded`; `charge.refunded` syncs back; over-refund + idempotency protected.
- **Actual:** not executable — deployed `stripe-refund`/`stripe-webhook` are the OLD (pre-F2/F3) code.
- **Root cause:** STEP 2 fixes exist in source only; Edge Function deploy to prod project `ivkdfognyiwjcmrhcnwz` was **not authorized** by Owner (command re-issued without selecting deploy option).
- **File/function/RPC:** `supabase/functions/stripe-refund/index.ts:226` (F3), `supabase/functions/stripe-webhook/index.ts` `charge.refunded` (F2), `supabase/functions/create-checkout/index.ts` (F1).
- **Severity:** HIGH (blocks STEP 2 closure).
- **Recommended fix:** Owner authorizes `supabase functions deploy` (or Management-API deploy) for `create-checkout`, `stripe-webhook`, `stripe-refund`; then re-run CT-01..CT-05.

---

## 4. Cleanup Classification (Owner §4) — *no new test artifacts created this gate*

| Artifact | Class |
|---|---|
| `e2e/ct-preflight-probe.cjs` (read-only preflight script) | KEEP FOR EVIDENCE (harmless, read-only) |
| `e2e/ct-preflight-probe.json` (read-only inventory) | KEEP FOR EVIDENCE |
| `BMB_STEP2_COMMERCE_INTEGRITY_IMPLEMENTATION.md` | KEEP (source-of-truth) |
| Pre-existing prod test rows (`PO-20260929-131`, `BMB-2026092*`, QA drivers, assignments) | OWNER ACTION — do not delete without approval |

**No DELETE / REFUND / MUTATE performed this gate.** ✅

---

## 5. Regression (Owner §5)

| Check | Result |
|-------|--------|
| Vitest | ✅ 24 files / **194 passed** |
| TypeScript (tsc) | ✅ 0 errors (build step) |
| Lint (eslint) | ✅ 0 errors |
| Build (`tsc && vite build`) | ✅ built in 21.11s (2 pre-existing non-blocking INEFFECTIVE_DYNAMIC_IMPORT warnings) |
| Secret scan (`dist/`, 237 files) | ✅ **0 hits** (no sk_test/sk_live/whsec/sb_secret/service_role in build output) |

---

## 6. Git Gate (Owner §6) — **NOT ADVANCED — deferred pending Owner decision**

- HEAD (local main) = `4be4175b644ce995d10afe4cce6c3cf4ea865cde`, branch `main`, up to date with `origin/main`.
- STEP 2 changes are **uncommitted** (F1–F4 in source + `BMB_STEP2_*` docs).
- **Did NOT commit/push** because STEP 2 gate is not closed (CT-04 blocked) and Owner has not directed a commit of a non-closed state.

---

## 7. FINAL REPORT (Owner §7 required format)

```
STEP 2 — FINAL GATE

CT-01 Single-open-PI       BLOCKED (F1 fix source-only; live re-verify needs deploy) [prior old-code evidence: PASS]
CT-02 Cancellation          NOT RE-RUN (no path to closure)
CT-03 Reassignment         NOT RE-RUN (no path to closure)
CT-04 Refund               BLOCKED (F2/F3 fixes source-only; needs EF deploy — not authorized)
CT-05 Offline Payment       NOT RE-RUN (no path to closure)

Regression:
Vitest = 194 passed (24 files)
TypeScript = 0 errors
Lint = 0 errors
Build = OK (21.11s)
Secret Scan = 0 hits (237 files)

F1 = FIXED (source) — NOT runtime-verified (deploy required)
F2 = FIXED (source) — NOT runtime-verified (deploy required)
F3 = FIXED (source) — NOT runtime-verified (deploy required)
F4 = FIXED (removed) — verified via 194-test regression ✅

Production mutation = NONE this gate (read-only preflight only)
Real money = NONE (sk_test only)
Test artifacts remaining = pre-existing prod test rows (OWNER ACTION to classify/delete)

HEAD = 4be4175b644ce995d10afe4cce6c3cf4ea865cde (local main)
origin/main = 4be4175b (no push attempted)
WORKTREE = DIRTY w/ STEP 2 source fixes (deliberately uncommitted)
```

---

## 8. HARD STOP

**STEP 2 = NOT CLOSED.** CT-04 (and full CT-01 F1 live re-verify) require deploying the fixed Edge Functions, which the Owner did not authorize. All STEP 2 code fixes are complete and regression-green; the remaining blocker is an Owner decision to authorize EF deployment to prod project `ivkdfognyiwjcmrhcnwz`. Per Owner §8, this report is NOT an authorization to begin STEP 3. **STEP 3 = NOT STARTED.**