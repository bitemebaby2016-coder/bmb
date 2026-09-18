# STRIPE_WEBHOOK_PRELIVE_AUDIT — Bite Me Baby

> Date: 2026-09-18 | Scope: `supabase/functions/stripe-webhook` pre-production
> verification against the 12-point checklist + Supabase `verify_jwt` config.
> Evidence = live probes on the production project (`ivkdfognyiwjcmrhcnwz`).

---

## VERDICT

| Gate | Result |
|------|--------|
| Source correctness (12-point checklist) | ✅ **READY TO DEPLOY** (after fixes R2–R4 applied in this session) |
| Deploy from this machine | ⛔ **BLOCKED** — no `supabase` CLI login (no access token in `~\.supabase`); only the owner can run the deploy |
| Runtime secret | ⛔ **BLOCKED** — `STRIPE_WEBHOOK_SECRET` (whsec_...) is a *separate* secret the owner sets themselves after creating the endpoint in the Stripe Dashboard. **I do NOT create/fake it and do NOT ask for it in chat.** |
| Pre-existing gap (outside webhook) | ⚠️ **REQUIRED FIX R1** — migration 007 EXECUTE-revoke still NOT effective live |

---

## 1. Source-verification checklist (live evidence)

| # | Requirement | Status | Where / evidence |
|---|-------------|--------|------------------|
| 1 | Reads `STRIPE_WEBHOOK_SECRET` | ✅ | `index.ts:85` `Deno.env.get('STRIPE_WEBHOOK_SECRET')` |
| 2 | Does NOT use `VITE_STRIPE_WEBHOOK_SECRET` | ✅ | grep `VITE_STRIPE_WEBHOOK` over `supabase/functions` = 0 hits |
| 3 | No hardcoded `whsec_...` | ✅ | grep `whsec_[alnum]` = 0 hits (only a code comment mentions the prefix) |
| 4 | Raw request body BEFORE signature verification | ✅ | `index.ts:83` `await req.text()` → verification at `:90` |
| 5 | Reads `Stripe-Signature` header | ✅ | `index.ts:84` `req.headers.get('stripe-signature')` |
| 6 | Real Stripe signature verification | ✅ | HMAC-SHA256 over `${t}.${payload}` with `crypto.subtle.sign` + **timing-safe compare** (R4) + 5-min timestamp window |
| 7 | Invalid signature ⇒ **HTTP 400** | ✅ | `index.ts:90-93` returns 400 (**fixed — was 401**, R2) |
| 8 | Valid signature ⇒ process event | ✅ | switch `payment_intent.succeeded` / `payment_intent.payment_failed` |
| 9 | Duplicate event idempotent | ✅ | RPC `record_payment_result` checks existing `payment_intent_id` → `idempotent:true`; plus unique partial index `uq_payment_intents_provider_id` (migration 008) |
| 10 | Amount / order mismatch rejected | ✅ | RPC raises `ERR_AMOUNT_MISMATCH` / `ERR_ORDER_NOT_FOUND`; EF maps to **HTTP 400** (R3) so Stripe does not retry a permanent mismatch |
| 11 | Payment update via trusted backend authority | ✅ | EF uses **service-role client** (`SUPABASE_SERVICE_ROLE_KEY`) → RPC `record_payment_result`; live probe: anon → `42501 permission denied for function` = EXECUTE is service_role-only |
| 12 | Client cannot set payment status | ✅ | no client path updates `payment_status`; no client code can execute `record_payment_result`; admin path uses `confirm_offline_payment` (is_admin-gated) |

## 2. SUPABASE CONFIG — `verify_jwt`

- **`supabase/config.toml` did not exist** → created this session.
- `[functions.stripe-webhook] verify_jwt = false` ✅ — REQUIRED because Stripe
  sends **no Supabase JWT**; with `verify_jwt = true` the platform would reject
  every Stripe request before the handler runs. The handler itself performs the
  Stripe signature verification (checklist #6).
- `[functions.create-checkout] verify_jwt = true` — clients invoke with their
  own JWT; platform-level rejection of anonymous callers = defense-in-depth.
## 3. REQUIRED FIXES

| ID | Item | Status |
|----|------|--------|
| R1 | **Migration 007 `REVOKE EXECUTE … FROM PUBLIC` still not effective live.** Live probe: anon `create_order_with_items` → `P0001 ERR_NOT_AUTHENTICATED` (function executed) — expected `42501` if revoked. Low blast radius (the function self-rejects anon), but the REVOKE/GRANT section of 007 must be re-run so execution is actually restricted to `authenticated`. | ⚠️ owner SQL Editor |
| R2 | invalid signature `401` → `400` | ✅ fixed + committed |
| R3 | permanent business rejections mapped to `400` (no infinite Stripe retry) | ✅ fixed + committed |
| R4 | timing-safe hex compare for signature verification | ✅ fixed + committed |

## 4. DEPLOY BLOCKERS (environment, not code)

| # | Block | Unblock |
|---|-------|---------|
| B1 | `supabase` CLI is not logged in on this machine (`~\.supabase` has no access token) | owner: `supabase login` (with a **read/write access token** from Dashboard → Account → Access Tokens) |
| B2 | `STRIPE_WEBHOOK_SECRET` is not set anywhere — it only exists after a webhook endpoint is created in the Stripe Dashboard | owner (never pasted in chat): create endpoint → copy signing secret → `supabase secrets set STRIPE_WEBHOOK_SECRET=whsec_...` |
| B3 | Stripe Dashboard endpoint not configured to target this project | owner: endpoint URL `https://ivkdfognyiwjcmrhcnwz.supabase.co/functions/v1/stripe-webhook`, events `payment_intent.succeeded` + `payment_intent.payment_failed` |

## 5. Deploy sequence (owner)

```bash
# 1. (already done by owner) STRIPE_SECRET_KEY set on Supabase
supabase secrets set STRIPE_SECRET_KEY=sk_test_...

# 2. after creating the Stripe webhook endpoint in the Stripe Dashboard:
supabase secrets set STRIPE_WEBHOOK_SECRET=whsec_...      # value NEVER shared in chat

# 3. login + link + deploy ONLY the two real functions (the other 9 dirs are empty shells):
supabase login
supabase link --project-ref ivkdfognyiwjcmrhcnwz
supabase functions deploy create-checkout stripe-webhook

# 4. live webhook smoke (Stripe Dashboard → "Send test webhook"):
#    - payment_intent.succeeded for a test PaymentIntent with
#      metadata.order_number of a REAL order → expect HTTP 200 {"received":true,"result":"paid"}
#    - duplicated delivery → second one still 200, no double-payment row
#    - tampered body / bad signature → expect HTTP 400 ERR_INVALID_SIGNATURE
```

## 6. Final note

No secret was created or assumed. No `whsec_...` value appears in this repo or
this session. Deployment is deliberately not performed until R1 is addressed
(or explicitly accepted by the owner) and B1–B3 are cleared by the owner.

---

**END OF STRIPE_WEBHOOK_PRELIVE_AUDIT**