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
| Webhook rejects unsigned / invalid signature (HTTP 400) | PASS - live (**twice**, probes below) |
| `STRIPE_WEBHOOK_SECRET` configured on the EF | PASS - live (unsigned -> 400, NOT 500) |
| `verify_jwt` on `create-checkout` (platform 401, missing auth) | PASS - live |
| Migration 007 anon EXECUTE revoke | PASS - live (anon -> PGRST202; was P0001 on 09-18) |
| Order RPC `create_order_with_items` runtime | FAIL - live: `42883 function extract_epoch(timestamp with time zone) does not exist` -> **migration 009 fixes it (written, not applied)** |
| Migration 008 (payment/order-state RPCs) | FAIL - NOT applied live (service_role probes -> PGRST202) -> **signed-webhook 200 is impossible until applied** |
| Stripe secret key (`.env` copy) | FAIL - **EXPIRED** (`api_key_expired`) -> owner rotates key |
| **STRIPE GATE (signed 200 smoke + payment DB verify)** | **NOT PASSED** - blocked on owner actions (Section 6) |
| 9 pre-existing EF directories | confirmed **0 files** each (empty shells). **Per owner: DO NOT DEPLOY.** |

---

## 1. Pipeline status (owner workflow)

| # | Step | Status (2026-09-19) |
|---|------|--------------------|
| 1 | AI DEV LIVE VERIFY | DONE - this report (all probes real) |
| 2 | deploy `create-checkout` | DONE - live (re-deployed this session, `supabase functions deploy`) |
| 3 | deploy `stripe-webhook` | DONE - live |
| 4 | signed webhook smoke test | BLOCKED - see root-cause (Section 4); tool `e2e/webhook-smoke.cjs` ready |
| 5 | duplicate webhook test | BLOCKED - follows 4 |
| 6 | invalid signature test | PASS - live (HTTP 400 `ERR_INVALID_SIGNATURE`) |
| 7 | payment DB verification | BLOCKED - follows 4; tool T6 ready |

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

---

**END OF STRIPE GATE - LIVE VERIFY REPORT (2026-09-19)**