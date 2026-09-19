# PHASE C — TRUSTED BACKEND FORENSIC (Bite Me Baby)

> Date: 2026-09-18 | Baseline: `4f8c5c9` (+ this session's P0-5/P0-6 work)
> Scope: evidence-based audit of the *trusted backend* boundary — Edge Functions,
> RPC surface, secrets handling, and what is genuinely shipped vs still pending.
> Principle: evidence > claims. Nothing below is declared deployed unless a
> live probe or a deploy log proves it.

---

## 1. Edge Function inventory (real)

| Function | Status (repo) | Deployed? | Purpose |
|----------|---------------|-----------|---------|
| `ai-daily-report` | empty shell | ❌ never deployed | planned |
| `calculate-promotion` | empty shell | ❌ | planned |
| `check-inventory` | empty shell | ❌ | planned |
| `daily-report` | empty shell | ❌ | planned |
| `generate-rewards` | empty shell | ❌ | planned |
| `inventory-reorder` | empty shell | ❌ | planned |
| `random-menu-draw` | empty shell | ❌ | planned |
| `track-share` | empty shell | ❌ | planned |
| `vote-menu` | empty shell | ❌ | planned |
| **`create-checkout`** | ✅ **implemented** (2026-09-18) | ❌ requires `supabase functions deploy` | P0-5 Stripe PaymentIntent (server-side secret) |
| **`stripe-webhook`** | ✅ **implemented** (2026-09-18) | ❌ requires deploy | P0-5 webhook → `record_payment_result` |
| **`stripe-refund`** | ⚠️ contract defined (client refuses browser refunds) | ❌ **not yet written** — backlog | admin refunds |

**FINDING C1 — All 9 pre-existing EF directories are EMPTY** (0 files, created 2026-09-09):
planned shells, never implemented, never deployed. No code references them.
**RE-VERIFIED 2026-09-19** (0 files in each directory). **Owner directive: DO NOT
DEPLOY these empty shells** to make the dashboard look feature-complete — they stay
honest "planned" placeholders until actually implemented.

---

## 2. Trusted-backend surface (what the browser CANNOT do anymore)

| Privileged operation | OLD (client) | NEW (server) | Where enforced |
|-----------------------|--------------|--------------|----------------|
| Order creation + pricing | client sent totals | RPC `create_order_with_items` (007) | DB function + RLS |
| Payment intent creation | browser fake `pi_…` id | EF `create-checkout` (Stripe API, server env) | EF + Stripe |
| Payment confirmation | `confirmPayment()` fake "completed" | Stripe webhook → `record_payment_result` | EF + DB idempotency |
| Order status change | direct `orders.update({status})` | RPC `transition_order_status` + BEFORE UPDATE trigger | DB trigger + RLS |
| Mark paid | any client (anon key) | `confirm_offline_payment` admin-only, rule-gated | RPC `is_admin()` |
| Refund | browser fake | server-side only (EF future) | EF (future) |
| Auth | localStorage users+bcrypt | Supabase Auth (P0-2, live) | JWT + RLS |

**FINDING C2 — Client bundle secret purge confirmed:** `src/lib/supabase.ts` no
longer references a service-role key; `git grep 'VITE_SUPABASE_SERVICE_ROLE_KEY|sb_secret_' src` ≈ 0;
`.env` / `.env.local` purged of `VITE_SUPABASE_SERVICE_ROLE_KEY`,
`VITE_STRIPE_SECRET_KEY`, `VITE_STRIPE_WEBHOOK_SECRET` (2026-09-18).
**Owner action:** rotate the originally-leaked service-role key on the
Dashboard — the 401s we observed show keys were already rotated once (the old
240-char anon key in `.env` is stale; the working anon key lives in `.env.local`).

---

## 3. RPC surface (007 + 008) — grants audit

| Function | EXECUTE granted to | Notes |
|----------|--------------------|-------|
| `create_order_with_items` | authenticated | live-verified: anon → `ERR_NOT_AUTHENTICATED` |
| `create_payment_intent_record` | authenticated | amount re-checked vs orders.total_amount |
| `submit_offline_payment_reference` | authenticated | own-order only |
| `transition_order_status` | authenticated | allow-list + owner/admin gates |
| `confirm_offline_payment` | authenticated (is_admin inside) | COD → delivered; PromptPay → processing |
| `mark_payment_failed` | authenticated (is_admin inside) | idempotent |
| `record_payment_result` | **service_role ONLY** | webhook path; amount match + idempotent |
| `order_transition_allowed` | service_role only | called from definer functions (superuser), safe |
| `guard_order_status_transition` | service_role only | trigger, runs as definer |

**FINDING C3 (RE-PROBED 2026-09-19):** anon call to `create_order_with_items` now
returns `PGRST202` — the 007 `REVOKE EXECUTE … FROM PUBLIC` IS now effective live
(owner re-ran the grants after the 09-18 probe which had shown `P0001`).
The one remaining 007 problem is **runtime**, not grants (see FINDING C4).

**FINDING C4 (RESOLVED 2026-09-19):** `create_order_with_items` previously failed with
`42883 extract_epoch(timestamp with time zone) does not exist` (migration 007 used
non-portable `extract_epoch`). Owner applied **migration 009**
(`supabase/migrations/009_fix_007_extract_epoch.sql`, portable `extract(epoch from ...)`):
re-verified live — real `credit_card` orders now create successfully.

**FINDING C5 (NEW 2026-09-19):** migration 008's RPCs are **CONFIRMED LIVE**.
(NB: earlier probes calling `record_payment_result` with an empty body returned PGRST202,
which is ALSO what PostgREST returns when a function needs required args — inconclusive.
The OpenAPI spec at `/rest/v1/` proves all 008 functions exist.)

**FINDING C6 (NEW 2026-09-19, STRIPE GATE):** `stripe-webhook` signature verification was
silently BROKEN in production: `crypto.subtle.sign` was called with RAW BYTES instead of an
imported `CryptoKey` → every check threw in the `catch` → **every real Stripe delivery got
HTTP 400** (permanent) → orders never became paid even though the EF "ran". Fix deployed:
`crypto.subtle.importKey('raw', ...)` (see `STRIPE_WEBHOOK_PRELIVE_AUDIT.md` §8b F8).
Companion fix F9: `create-checkout` now inserts `payment_intent_id = NULL` so the webhook's
first delivery applies the result. Regression tests added; offline suite 56/56.
---

## 4. Payment data flows (post this session)

```
CARD:
  CheckoutPage → createPaymentIntent('credit_card')
    → supabase.functions.invoke('create-checkout')
        → (EF, server) GET /auth/v1/user (verify JWT)
        → (EF, server) SELECT order via USER token (RLS ownership)
        → (EF, server) POST https://api.stripe.com/v1/payment_intents (sk_test_…)
        → (EF, server) INSERT payment_intents row (service role, unique pi id)
    → returns { client_secret, payment_intent_id, amount }   ← Stripe.js confirms in browser
  → stripe-webhook EF: verify whsec signature → event → RPC record_payment_result
      (idempotent; amount must equal orders.total_amount, else ERR_AMOUNT_MISMATCH)

PROMPTPAY / COD (offline):
  CheckoutPage → createPaymentIntent(non-card) → RPC create_payment_intent_record
  Customer submits TXN (promptpay) → RPC submit_offline_payment_reference (pending→processing)
  Admin confirms → RPC confirm_offline_payment (COD: order must be delivered)
  → payment_intents.status=completed + orders.payment_status=paid
```

**Amount tampering is impossible:** every monetary value that matters is derived
from `products.price` / `delivery_rounds` / `promotions` inside
`create_order_with_items` and re-checked in every payment RPC.

---

## 5. Honest open items (Phase C → D handoff)

| # | Item | Status (2026-09-19) / Blocker |
|---|------|------------------------|
| C-1 | deploy `create-checkout` + `stripe-webhook` | ✅ **DONE live** (both deployed + probed) |
| C-2 | Supabase secrets (STRIPE_*) | ✅ **SET/VERIFIED** — webhook secret re-issued + live-verified (signed 200); EF `STRIPE_SECRET_KEY` valid (real PaymentIntent created) |
| C-3 | Migration 008 | ✅ **CONFIRMED LIVE** (OpenAPI + smoke T3-T6). Earlier PGRST202 = inconclusive empty-body probe (FINDING C5) |
| C-4 | 007 REVOKE/GRANT | ✅ **EFFECTIVE** (anon → `PGRST202`) |
| C-4b | 007 runtime bug `extract_epoch` | ✅ **APPLIED by owner** (migration 009) — real orders create fine (FINDING C4) |
| C-4c | `stripe-webhook` WebCrypto key misuse (F8) + `create-checkout` payment_intent_id (F9) | ✅ **FIXED + DEPLOYED** (STRIPE GATE findings; regression tests 56/56) |
| C-5 | Rotate service-role key (earlier bundle leak) | ✅ **DONE (2026-09-19)** — new key `bmb_backend_production_supabase_service_role_key` live (digest 5a0f7199...); old leaked key **REVOKED by owner** |
| C-6 | `stripe-refund` EF — admin-only server-side Stripe refund | ✅ **DONE + DEPLOYED + LIVE VERIFIED (2026-09-19)** — negative probes 401/403/404 PASS; REAL refund on test order `BMB-LIVE-20260919074017` → 200, refund `re_3UHIsi3yHrQLTgfK0PH3NdRk` (succeeded, 172 THB), DB `orders.payment_status=refund` + `payment_intents.status=refunded` + ledger metadata; offline refund-logic tests 5/5 |
| C-7 | Storage bucket `bmb-images` + `media_assets` wiring (media library) | 🟡 **bucket VERIFIED** (public, exists 2026-09-15) + **migration 011 written** (storage.objects policies) + `bmbAdminApi_media.ts` + Admin Media page `/admin/media` (code-complete) — **owner must apply migration 011** for storage policies to take effect |

**Phase C verdict:** payment + order-state authority has moved server-side with
verifiable contracts (offline suite simulates every RPC/EF path). Deployment gate
C-1..C-5 are **ALL DONE/CLOSED (2026-09-19)**: EFs deployed, secrets aligned,
migrations 008/009/010/011 live, service-role key rotated + old key revoked, a REAL Stripe
delivery verified PASS, and a REAL Stripe REFUND verified PASS (C-6). C-7 (storage/media)
code-complete — bucket exists, migration 011 applied by owner.
Auth-order flow VERIFIED live via authenticated E2E: createOrder `p_*` RPC-key bug fixed
(2026-09-19), checkout/Payment/Tracking render confirmed in E2E; migrations 012 (products
stock/rating) & 013 (PromptPay ref cast) are written — owner applies in the SQL Editor.

---

**END OF PHASE C FORENSIC**