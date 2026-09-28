# BMB_STEP2_CT04_CLOSURE_REPORT

**STEP 2 — CT-04 Blocker Closure** (2026-09-28).
Owner-authorized fix of the CT-04 runtime configuration/integration defect, then CT-04 retest.
**CT-04 = PASS → HARD STOP per FAILURE RULE.** CT-05 NOT started. No commit/push (GIT RULE).

---

## FINAL REPORT (Owner format)

```
CONFIG ROOT CAUSE = Deployed stripe-refund/stripe-webhook read service-role key ONLY from the
    custom rotated name `bmb_backend_production_supabase_service_role_key` (no fallback). That
    custom secret is NOT resolvable in the Edge Function runtime (project secret store lists it,
    but runtime env is empty) → stripe-refund returned ERR_NOT_CONFIGURED, stripe-webhook 500.
    create-checkout worked because it has a `SUPABASE_SERVICE_ROLE_KEY` fallback.
    SECOND defect (masked by the first): stripe-refund verified admin via a raw user-token SELECT
    on `public.profiles`; production grants do NOT allow `authenticated` to SELECT profiles (RLS
    by design) → 42501 → ERR_FORBIDDEN for every caller including real admins.

FIX = (1) Add canonical `|| Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')` fallback to stripe-refund
    + stripe-webhook (same binding as create-checkout; no new secret, no schema change).
    (2) stripe-refund admin check switched to the canonical `is_admin()` RPC (the same authority
    used by every admin RPC/policy in the codebase; profiles is deliberately RLS-locked).

FILES CHANGED =
    supabase/functions/stripe-refund/index.ts   (config binding + is_admin admin check; + F3 param)
    supabase/functions/stripe-webhook/index.ts  (config binding + comment)

DEPLOY:
    stripe-refund = DEPLOYED  v8 → v9 (config) → v10 (is_admin);  verify_jwt=true
    stripe-webhook = DEPLOYED v46 → v47 (config);  verify_jwt=false

CT-04 = PASS

FULL REFUND   = PASS  (BMB-20260928-247, 110.00) re_...110 -> order refund, PI refunded, ledger 11000
PARTIAL REFUND= PASS  (BMB-20260928-714, amount 44) -> order partially_refunded, PI partially_refunded, ledger 4400
DASHBOARD charge.refunded = PASS  (BMB-20260928-420) direct Stripe TEST refund + signed webhook -> 200
    refund_synced, order refund, PI refunded, refund_ids=[ch_...]
IDEMPOTENCY   = PASS  (repeat full refund -> 400 ERR_REFUND_ALREADY_EXISTS)
OVER-REFUND   = PASS  (amount 220 -> 400 ERR_REFUND_AMOUNT_EXCEEDS)

Vitest       = 194 passed (24 files)   [targeted payment/refund = 24 passed]
TypeScript   = 0 errors
Lint         = 0 errors
Build        = OK (2.81s)
Secret Scan  = 0 hits (build 239 files + tracked source; local gitignored secrets.local.env excluded)

HEAD       = 4be4175b644ce995d10afe4cce6c3cf4ea865cde
origin/main= 4be4175b (no push)
WORKTREE   = DIRTY (STEP 2 F1-F4 + CT-04 config/integration fixes uncommitted)

STEP 2     = CT-04 CLOSED (CT-01..CT-04 PASS). STEP 2 closure pending Owner final-review/commit.
CT-05      = NOT STARTED
```

---

## Evidence artifacts

- `e2e/ct-1.json` CT-01 PASS · `e2e/ct-2.json` CT-02 PASS · `e2e/ct-3.json` CT-03 PASS · `e2e/ct-4.json` **CT-04 PASS**
- `BMB_STEP2_CT_HARDSTOP_REPORT.md` (the CT-04 failure that triggered this closure)
- `e2e/ct-admin-check.cjs` (admin-check audit: is_admin RPC true; profiles user-token SELECT 42501)
- `e2e/ct-secrets-check.cjs` (secrets present/non-empty, values never printed)
- `e2e/ct-deploy-probe.cjs` (deployed versions/verify_jwt + probes)
- Git diff of the fix: `git --no-pager diff supabase/functions/stripe-refund/index.ts supabase/functions/stripe-webhook/index.ts`

## Transparency / disclosures

1. Two defects fixed (config binding + admin check), both runtime/integration — within the Owner-authorized CT-04 scope. No schema/migration, no payment-architecture change, no refund-business-rule change, no admin-permission change.
2. During local gate, one full Vitest run had 1 failure: a network-dependent `api.test.ts` test (ai-proxy upstream 429 fallback). It passed 194/194 on rerun; unrelated to this change.
3. CT-04 harness was corrected so the PARTIAL/OVER-refund assertions send the EF's real field (`amount` in major units) — the initial harness sent `amount_minor` (ignored by the EF), which made every call a full refund. The platform (deployed v10) behaved correctly.
4. No secret values printed anywhere; only names/booleans and non-empty flags.

## HARD STOP

CT-04 PASS → execution stops per FAILURE RULE. **CT-05 NOT started; nothing committed or pushed.** Awaiting Owner review of this report + diff before any STEP 2 closure action or CT-05.