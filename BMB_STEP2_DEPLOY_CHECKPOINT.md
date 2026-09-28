# BMB_STEP2_DEPLOY_CHECKPOINT

**STEP 2 — EF DEPLOY ONLY · MANDATORY CHECKPOINT REPORT** (2026-09-28)
Owner-authorized deploy of exactly 3 fixed Edge Functions to prod project `ivkdfognyiwjcmrhcnwz` (TEST mode). **HARD STOP — no CT-01..CT-05 run.**

---

## 1. Pre-deploy scope compliance (Owner DEPLOY RULES)

| Rule | Status |
|------|--------|
| 1. git diff = STEP 2 scope only | ✅ 3 EFs only (create-checkout +8, stripe-refund +2, stripe-webhook +72); verified F1/F2/F3 diffs |
| 2. source of 3 functions verified | ✅ reviewed diffs = exact F1/F2/F3 fixes |
| 3. deploy ONLY these 3 functions | ✅ CLI deployed `create-checkout stripe-refund stripe-webhook` only |
| 4. no migration | ✅ none run |
| 5. no schema change | ✅ none |
| 6. no production data mutation pre-deploy | ✅ none |
| 7. no LIVE Stripe mode | ✅ Stripe untouched (still sk_test) |
| 8. no secret exposure | ✅ no secret printed; token only in Authorization header |

---

## 2. DEPLOY RESULT

| Function | Status | Version (before → after) | verify_jwt |
|----------|--------|---------------------------|------------|
| create-checkout | **DEPLOYED** | 38 → 40 | true (config.toml) |
| stripe-webhook | **DEPLOYED** | 44 → 46 | false (config.toml) |
| stripe-refund | **DEPLOYED** | 8 ← (was 6) | true (config.toml) |

> **Transparency note (my error, corrected):** first CLI attempt was run with `--no-verify-jwt`, which temporarily set `verify_jwt=false` on all 3 (v39/45/7). I detected this (security regression for create-checkout/stripe-refund) and **immediately redeployed without the flag** (v40/46/8), restoring `verify_jwt=true` for create-checkout & stripe-refund per `config.toml`. Final deployed state is correct.

---

## 3. RUNTIME VERSION / HASH EVIDENCE

- Deployed **version numbers incremented** at deploy from the fixed STEP 2 working tree → fixes are now the live deployed code.
- `verify_jwt` values confirmed correct via Management API (true / false / true).
- Local source fingerprints (SHA-256 of fixed source): create-checkout `53fd60cc…`, stripe-webhook `c593a7db…`, stripe-refund `cabbaa00…`.
- **NOTE:** Platform `ezbr_sha256` is a **bundle hash** (not raw source bytes); raw and LF-normalized local hashes do not equal it, so byte-for-byte source equality is **not** provable via API metadata. The authoritative confirmation that deployed runtime == fixed source is a **behavioral probe**, which is a CT (CT-04 etc.) and is **checkpoint-forbidden** until Owner reviews + authorizes.

---

## 4. STRIPE MODE / PRODUCTION MUTATION

- **STRIPE MODE = TEST** (sk_test unchanged; no live key touched) ✅
- **Production DB = ivkdfognyiwjcmrhcnwz**
- **Other production mutation = NONE** (only the 3 authorized EF deploys)
- No CT01-05, no cleanup, no refund, no delete, no commit/push performed.

---

## 5. GIT STATE

- HEAD (local main) = `4be4175b644ce995d10afe4cce6c3cf4ea865cde`, branch `main`
- origin/main = `4be4175b…` (no push attempted)
- WORKTREE = **DIRTY** — STEP 2 source fixes (F1–F4) uncommitted (deployed from working tree); docs + e2e evidence untracked.

---

## 6. CHECKPOINT STATUS — AWAITING OWNER

```
DEPLOY:
create-checkout = DEPLOYED (v40)
stripe-webhook  = DEPLOYED (v46)
stripe-refund   = DEPLOYED (v8)

RUNTIME VERSION / HASH:
- version bumps + verify_jwt correct (true/false/true)
- ezbr = bundle hash (not source byte hash); byte equality not provable w/o CT
- local source SHA recorded (fingerprint)

STRIPE MODE = TEST
Production DB = ivkdfognyiwjcmrhcnwz
Other production mutation = NONE (3 EF deploys only)

HEAD = 4be4175b644ce995d10afe4cce6c3cf4ea865cde
origin/main = 4be4175b (no push)
WORKTREE = DIRTY (STEP 2 fixes uncommitted)
```

**HARD STOP.** Await Owner review of deployment evidence + explicit command to begin CONTROLLED TEST RUNTIME VERIFICATION (CT-01..CT-05). This deploy is **NOT** STEP 2 closure and **NOT** a CT PASS.