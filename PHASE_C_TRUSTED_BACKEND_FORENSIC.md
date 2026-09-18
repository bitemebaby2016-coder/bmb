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

**FINDING C4 (NEW 2026-09-19, live):** `create_order_with_items` exists and is
authenticated-only, but EVERY call fails at runtime:
`42883 function extract_epoch(timestamp with time zone) does not exist`.
Migration 007 used the non-portable `extract_epoch(clock_timestamp())`.
**Fix written:** `supabase/migrations/009_fix_007_extract_epoch.sql`
(`CREATE OR REPLACE` with portable `extract(epoch from ...)`; body verified
identical to 007 except that one expression). **Not applied yet** (owner DB).
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
| C-1 | deploy `create-checkout` + `stripe-webhook` | ✅ **DONE live** (both deployed + probed; re-deployed this session) |
| C-2 | `supabase secrets set STRIPE_SECRET_KEY / STRIPE_WEBHOOK_SECRET` | 🟡 **PARTIAL** — webhook secret verified set (unsigned → 400); `STRIPE_SECRET_KEY` from `.env` is **EXPIRED** (Stripe API `api_key_expired`) → rotate |
| C-3 | Apply migration 008 to the live DB (SQL Editor) | ❌ **STILL BLOCKED (owner)** — payment/state RPCs `PGRST202` (verify: `record_payment_result` etc.) |
| C-4 | 007 REVOKE/GRANT | ✅ **EFFECTIVE** (anon → `PGRST202` re-probed 2026-09-19) — closed |
| C-4b | 007 runtime bug `extract_epoch` (FINDING C4) | ❌ **NEW** — fix written in `migrations/009_fix_007_extract_epoch.sql`; apply with C-3 |
| C-5 | Rotate service-role key (earlier bundle leak) | ❌ **PENDING (owner)** — key was present again in working `.env`; purged 2026-09-19 |
| C-6 | `stripe-refund` EF — write before admin refunds go live | backlog (admin-only, server-side) |
| C-7 | Storage bucket `bmb-images` + `media_assets` wiring (media library) | deploy-time |

**Phase C verdict:** payment + order-state authority has moved server-side with
verifiable contracts (offline suite simulates every RPC/EF path). The TRUSTED
BACKEND is *code-complete for P0-5/P0-6*; **deployment is owner/CLI-blocked**
(items C-1..C-5) and must NOT be mistaken for done.

---

**END OF PHASE C FORENSIC**