# STRIPE GATE - LIVE VERIFY REPORT (Bite Me Baby)

> Date: 2026-09-19 (local session)
> Project: Supabase `ivkdfognyiwjcmrhcnwz` (production) | Stripe: test mode
> Supersedes: `STRIPE_WEBHOOK_PRELIVE_AUDIT` v1 (2026-09-18, pre-deploy review)
> Method: LIVE probes only. Evidence > claims. No fake success.

---

## VERDICT (STRIPE GATE)

| Gate | Result |
|------|--------|
| Edge Functions deployed (`create-checkout`, `stripe-webhook`) | PASS - live (probes below) |
| Webhook rejects unsigned / invalid signature (HTTP 400) | PASS - live |
| `STRIPE_WEBHOOK_SECRET` configured on the EF | PASS - re-issued + verified live (signed 200) |
| `verify_jwt` on `create-checkout` (platform 401, missing auth) | PASS - live |
| Migration 007 anon EXECUTE revoke | PASS - live (anon -> PGRST202) |
| Order RPC `create_order_with_items` runtime | PASS - live (migration 009 applied by owner; real orders created) |
| Migration 008 (payment/order-state RPCs) | PASS - live (confirmed via OpenAPI: all 008 RPCs present; smoke T3-T6 prove them) |
| Stripe signature verification code (WebCrypto) | **FIXED this session** - was silently broken: `crypto.subtle.sign` got RAW BYTES instead of an imported `CryptoKey`, so EVERY signature check threw -> all real deliveries got 400 (finding F8) |
| create-checkout intent row (#652: pre-set `payment_intent_id`) | **FIXED this session** - now `NULL`; first webhook delivery applies the result (finding F9) |
| **STRIPE GATE - signed webhook smoke + payment DB verify** | ✅ **PASSED (2026-09-19)** - T1..T6 all green live (Section 8) |
| 9 pre-existing EF directories | 0 files each (empty shells). **Per owner: NOT deployed.** |

---

## 1. Pipeline status (owner workflow)

| # | Step | Status (2026-09-19) |
|---|------|--------------------|
| 1 | AI DEV LIVE VERIFY | DONE - this report (all probes real) |
| 2 | deploy `create-checkout` | DONE - live (re-deployed this session with fix F9) |
| 3 | deploy `stripe-webhook` | DONE - live (re-deployed this session with fix F8) |
| 4 | signed webhook smoke test | ✅ **PASS** - T3 200 `{"received":true,"result":"paid"}` (local HMAC + REAL Stripe delivery) |
| 5 | duplicate webhook test | ✅ **PASS** - T4 + real `events resend`: 200 idempotent, no double payment |
| 6 | invalid signature test | ✅ **PASS** - T1/T2 HTTP 400 `ERR_INVALID_SIGNATURE` |
| 7 | payment DB verification | ✅ **PASS** - T6: intent `completed`, order `paid` |

## 2. Live probes recorded this session

| Probe | Endpoint | Result (live) |
|-------|----------|----------------|
| GET webhook (no auth needed) | /functions/v1/stripe-webhook | 200 `{"ok":true,"service":"stripe-webhook"}` |
| GET create-checkout (no JWT) | /functions/v1/create-checkout | 401 `UNAUTHORIZED_NO_AUTH_HEADER` (verify_jwt active) |
| POST webhook empty/unsigned body | /functions/v1/stripe-webhook | 400 `{"error":"ERR_INVALID_SIGNATURE"}` |
| POST webhook invalid signature (HMAC with wrong key) | same | 400 `{"error":"ERR_INVALID_SIGNATURE"}` |
| anon RPC `create_order_with_items` | /rest/v1/rpc/... | 404 PGRST202 (EXECUTE revoked: anon can no longer see/run it) |
| authenticated RPC `create_order_with_items` (real user, valid payload) | same | SQL **42883** `extract_epoch(...) does not exist` (function exists but body is broken) |
| service_role RPC probes (`record_payment_result`, `transition_order_status`, `create_payment_intent_record`, `submit_offline_payment_reference`, `confirm_offline_payment`, `mark_payment_failed`, `order_transition_allowed`, `guard_order_status_transition`) | /rest/v1/rpc/... | ALL 404 PGRST202 = **migration 008 NOT applied** |
| Stripe API `GET /v1/webhook_endpoints` | api.stripe.com | 401 `api_key_expired` (sk_test_...51UGp...EnMIKo is expired) |
| Orders table (service_role) | /rest/v1/orders | rows: `BMB-20260917-526` (promptpay_qr) and `TEST-001` - **no credit_card order exists** |
| Business settings (008 table) | /rest/v1/business_settings | EXISTS + `kitchen_location` row -> 008 Phase-D tables were applied earlier, but the payment RPC section is NOT |

## 3. Webhook 12-point checklist (delta since v1)

All 12 points of the v1 checklist remain satisfied in source (unchanged code), and are now
additionally covered by live behavior: points 7 (invalid -> 400), 8 (process event),
9 (idempotent), 10 (amount mismatch -> 400) are code-wise as v1; the live 200-path
(point 8 end-to-end) is blocked only by missing migration 008 (below).

## 4. ROOT CAUSE - why "signed webhook smoke cannot return 200"

Chain that must all be TRUE for HTTP 200 `{"received":true,"result":"paid"}`:

1. A real `credit_card` order must exist -> `create_order_with_items` is now **broken at
   runtime** (missing `extract_epoch`) -> new migration **009** fixes the body (written).
2. The EF must be able to call `record_payment_result` -> the RPC does not exist live
   (migration **008** not applied) -> a correctly signed event currently returns **HTTP 500**
   with a "could not find function" error, not 200.
3. The webhook secret (`whsec_...`) must be known to the smoke runner -> it is set on the EF
   (proved by the 400s) but is intentionally never stored in the repo/chat; the owner flow
   below keeps it local.

Additionally the Stripe test key in `.env` is **expired**, so even the `create-checkout`
Stripe API call cannot be exercised end-to-end until the owner rotates it.

## 5. What this session CHANGED (repo)

| File | Change |
|------|--------|
| `.env` / `.env.local` | rewritten as strict `KEY=VALUE` (no comment lines, no secrets). Fixes the CLI parse error pattern `failed to parse environment file ... in variable name near '#'`; removed `VITE_SUPABASE_SERVICE_ROLE_KEY`, `VITE_STRIPE_SECRET_KEY`, stale anon key. Working anon key from `.env.local` kept. |
| `supabase/migrations/009_fix_007_extract_epoch.sql` | NEW - `CREATE OR REPLACE` of `create_order_with_items` with portable `extract(epoch from ...)`. Body verified byte-equal to 007 except that one line. |
| `e2e/webhook-smoke.cjs` | NEW - live smoke tool for steps 4-7 (T1 unsigned, T2 invalid sig, T3 signed 200, T4 duplicate, T5 no-order 202, T6 DB verify). Negative path (T1/T2) ran green against the live EF this session. |
| `.gitignore` | + `supabase/secrets.local.env` (local-only server secrets pattern) |

## 6. OWNER UNBLOCK (exact order)

1. **Supabase Dashboard -> SQL Editor**: run `supabase/migrations/009_fix_007_extract_epoch.sql`,
   then `supabase/migrations/008_payment_state_machine_and_phase_d.sql` (008 is idempotent;
   business_settings already exists -> `IF NOT EXISTS` handles it). Alternative with DB
   password: `supabase db push` from the project dir.
2. **Stripe Dashboard -> Developers -> Webhooks**: create endpoint
   `https://ivkdfognyiwjcmrhcnwz.supabase.co/functions/v1/stripe-webhook` for
   `payment_intent.succeeded` + `payment_intent.payment_failed` -> copy `whsec_...`.
3. Set + keep the secrets out of the repo:
   - `supabase secrets set STRIPE_SECRET_KEY=sk_test_...` (new, non-expired key)
   - `supabase secrets set STRIPE_WEBHOOK_SECRET=whsec_...`
   (`STRIPE_WEBHOOK_SECRET` is already set on the EF; re-set only if changed.)
4. Rotate the service-role key (it existed in the working `.env`; purged this session).
5. Re-run the gate:
   `node e2e/webhook-smoke.cjs --order BMB-... --amount 172 --secret whsec_... --service-key sb_secret_...`
   (or put the two secrets in `supabase/secrets.local.env`, gitignored, and pass `--secret file:` / `--service-key file:`).

## 7. 9 EF forensic (owner directive honored)

`ai-daily-report`, `calculate-promotion`, `check-inventory`, `daily-report`,
`generate-rewards`, `inventory-reorder`, `random-menu-draw`, `track-share`, `vote-menu`
= **0 files each, never deployed, nothing references them**. Per owner: **DO NOT deploy
these empty shells** just to make the dashboard look complete - they stay as honest
"planned" placeholders until actually implemented (Phase C / later).

## 8. STRIPE GATE FINAL - ✅ PASSED (2026-09-19)

### 8a. Live smoke result (real Stripe test-mode traffic + local HMAC)

Commands that produced the evidence (all against the deployed functions):

```
node e2e/webhook-smoke.cjs --order BMB-20260919-489 --amount 111 --secret <whsec> --service-key <service_role>
  PASS T1 unsigned -> 400  {"error":"ERR_INVALID_SIGNATURE"}
  PASS T2 invalid  -> 400  {"error":"ERR_INVALID_SIGNATURE"}
  PASS T5 no-order -> 202  {"received":true,"note":"no order_number in metadata"}
  PASS T3 signed   -> 200  {"received":true,"result":"paid"}
  PASS T4 duplicate-> 200  {"received":true,"result":"paid"}
  PASS T6 DB       -> payment_intents.status=completed, orders.payment_status=paid
```

Real Stripe delivery chain also verified end-to-end:
- order `BMB-20260919-830` -> `create-checkout` EF -> real PaymentIntent `pi_3UHD1d3...`
- `stripe payment_intents confirm ... --payment-method pm_card_visa` (succeeded, 10100 minor)
- Stripe signed `payment_intent.succeeded` -> webhook EF (verified signature) -> `record_payment_result`
- DB after delivery: `orders.payment_status = "paid"`, `payment_intents.status = "completed"`
  with `payment_intent_id`/`completed_at` set by the webhook
- duplicate: `stripe events resend <evt> --webhook-endpoint <new endpoint>` -> 200 idempotent,
  DB unchanged (no double payment)

### 8b. Two code bugs fixed this session (root causes of the stuck gate)

- **F8 (the big one): WebCrypto key misuse in `stripe-webhook`.** The code called
  `crypto.subtle.sign('HMAC', {name:'HMAC',hash:'SHA-256'}, key, data)` with `key` =
  RAW BYTES from `TextEncoder`. WebCrypto requires an imported `CryptoKey`, so every call
  threw `TypeError: ... Argument 2 is not of type CryptoKey`, was swallowed by the `catch`,
  and `verifyStripeSignature` returned `false` for EVERY event - real Stripe deliveries
  were all rejected with HTTP 400 (permanent, no retry). Fix: `crypto.subtle.importKey('raw', ...)`.
  Regression: `src/__tests__/stripeWebhookSignature.test.ts` (5 tests).
- **F9: `create-checkout` pre-set `payment_intent_id`** on the intent row, so
  `record_payment_result`'s replay guard matched it on the first legit delivery ->
  webhook "succeeded" (200) but the order never left `pending`. Fix: insert `payment_intent_id = NULL`,
  let the webhook set it. Regression: mock + `paymentStateMachine.test.ts`
  "010 regression: checkout-created pending intent ...".

### 8c. Configuration realigned

- New Stripe test webhook endpoint `we_1UHCw83yHrQLTgfKtQwJJI8O` (url =
  `.../functions/v1/stripe-webhook`, events `payment_intent.succeeded` + `.payment_failed`).
- EF secret updated: `supabase secrets set STRIPE_WEBHOOK_SECRET=<whsec of the new endpoint>`.
- The pre-existing endpoint `we_1UH30B3yHrQLTgfKjqCCv2SK` is left enabled but its secret no
  longer matches the EF (its deliveries now 400). Owner may delete it in the Stripe Dashboard
  to avoid noise.

### 8d. Residual notes (honesty)

- **Migration 010 (backstop)** `supabase/migrations/010_fix_record_payment_result_idempotency.sql`
  is written but NOT applied: it makes `record_payment_result` treat only terminal
  (`completed`/`failed`) rows as replays. With fix F9 deployed, new orders complete correctly
  without it; order `BMB-20260919-616` (created under the OLD EF behavior, pre-set PI id) is a
  live example of the residual case - its event is validated by the EF (200) but the RPC
  short-circuits, so that test order stays `pending`. Apply 010 at the next DB window to repair
  that semantic. (Offline suite already enforces the 010 behavior.)
- Service-role key `sb_secret_...` used for this session still works live (owner's rotation
  item C-5 remains open).
- Test data created & cleaned: smoke users deleted; test orders `BMB-20260919-249` (manually
  paid for RPC probing) and `BMB-20260919-489`/`-830` (paid via webhook) remain in the DB as durable evidence.
- Tools: `e2e/webhook-smoke.cjs` now also resolves `--secret <NAME>` / `--service-key <NAME>`
  from environment variables (so `--secret STRIPE_WEBHOOK_SECRET` works when that var is set).

---
### 8e. ⚠️ Incident 2026-09-19 — secret-dispatch regression (FIXED + re-verified)

- **Symptom**: after the webhook endpoint was re-issued via Stripe CLI several times,
  `e2e/webhook-smoke.cjs` returned `ERR_INVALID_SIGNATURE (400)` for every live signed delivery.
- **Root cause (incident)**: commit `ac7d262` (service-key rotation) accidentally rewrote the
  env read for the Stripe **signature** secret in `stripe-webhook/index.ts` from
  `STRIPE_WEBHOOK_SECRET` to the Supabase service-role key name — so the deployed EF verified
  HMAC against the service-role key instead of the `whsec_...`, rejecting all genuine traffic.
  The same over-reach hit `create-checkout/index.ts` (Stripe Bearer read the service-role key
  instead of `STRIPE_SECRET_KEY`).
- **Second root cause**: the value configured on Supabase for `STRIPE_WEBHOOK_SECRET` was NOT
  `whsec_Vy7d2Y55MFgQgGOTIWBvjx8B8rpzssTZ` (digest on Supabase `1c00d76c...`, expected
  `c9027c36...`). It was re-set via `supabase secrets set STRIPE_WEBHOOK_SECRET=...` and the
  digest re-checked (`c9027c36...` confirmed).
- **Fix**: restored `STRIPE_WEBHOOK_SECRET` (signature) and `STRIPE_SECRET_KEY` (Stripe API
  Bearer); the Supabase service-role key stays in use only for the privileged Supabase client.
  Redeployed `stripe-webhook` + `create-checkout`.
- **Re-verification (live)**: `node e2e/webhook-smoke.cjs --order BMB-WHVER-20260919105254
  --amount 123 --secret whsec_Vy7d2Y55MFgQgGOTIWBvjx8B8rpzssTZ --service-key ...` →
  T1 400 / T2 400 / T5 202 / T3 200 / T4 200 / T6 `paid`+`completed` →
  `WEBHOOK_SMOKE pass=true` (evidence: `e2e/webhook-smoke-result.json`).
- **Committed**: `032ca7e` (pushed to `origin/main`).

---