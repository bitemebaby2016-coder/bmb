# BMB SOCIAL AI — NEXT GATE AUDIT (FOUNDATION REPAIR + ASSET INVENTORY)

Gate: Owner-authorized next gate after S0.1 acceptance · Date: 2026-10-02
Mode: **AUDIT ONLY** — no migration, no code change, no schema change, no Meta config, no commit, no push.

## 1. Owner decisions accepted

| ID | Decision | How honored in this gate |
|---|---|---|
| D-01 | B-1 must be resolved before Social AI | Root cause fully traced (§5); no fix applied |
| D-02 | Durable event processing + DB-level idempotency required | Contract designed (§6); not implemented |
| D-03 | `social_events` approved in principle; schema audited before migration | Field-by-field audit (§6) |
| D-04 | Comment auto-reply approved in principle | Treated as target state, not built |
| D-05 | Page allowlist mandatory | Control designed (§7) |
| D-06 | Model tiers configuration-driven | Contract designed (§8) |
| D-07/D-08 | Auto-Post: durable record + idempotency + approval gate ON | Reflected in §6/§12 |
| D-09/D-10 | `src/lib.zip` untouched; `rls_check.txt` never committed | Both untouched this gate |
| D-11 | No credentials anywhere in repo/client | No secrets written; `.env.example` untouched |
| D-12 | No Meta production config | Only checklist (§9) |
| D-13 | Payment/order isolated, evidence-driven | B-1 root cause is evidence-only (§5) |
| D-14 | Canonical order spine only | Contract forbids social-order system (§6) |
| D-15 | Full durable chain required | §6/§10 define the chain |

## 2. Asset inventory

See `BMB_SOCIAL_AI_ASSET_INVENTORY.md` (companion artifact). Headline facts:
- Facebook comment auto-reply requires **no image assets** (text-only).
- Auto-Post images should reuse the canonical `media_assets`/`bmb-images` path — no new storage contract.
- `contentAutomation.ts` is a localStorage draft generator only — **not** Auto-Post infrastructure.
- Production media shape (legacy base64 rows) remains **UNVERIFIED** (no DB access).

## 3. Existing asset structure

- `public/`: favicon, og-image.png, PWA icons, mascots (18 poses), review screenshots (38 + 37 small), drink/snack SVGs, PromptPay QR, brand logos, fonts, `_headers`, manifest, sitemap.
- `src/assets/`: `hero.png` + EMPTY `images/` and `logo/` directories.
- Consumers verified by grep: `MascotBadge.tsx`, `CustomerReviewCard.tsx`, `index.html` OG meta, `vite.config.ts` manifest.
- **No root-level `/assets/` social directory exists. No current code needs one.**

## 4. Proposed root asset directory — NOT CREATED

**Recommendation: DO NOT create a root asset directory now.**

- Comment auto-reply (D-04) needs zero assets.
- Auto-Post (D-07/D-08) must reuse `media_assets`/Storage `bmb-images` — a parallel `/assets/social/` would duplicate the canonical media path.
- Any future static brand kit is partially served by existing `public/` (mascots, Logo_Sticker_Circle).

```
PROPOSED ROOT ASSET DIRECTORY: (none — deferred)
PURPOSE: n/a — no current code path requires it
CONSUMERS: none today; future auto_post worker will consume media_assets URLs instead
FILES REQUIRED: none
NOT NEEDED: /assets/social/*, /assets/templates/*, any placeholder or generated images
```

Deferred trigger: only if Owner later approves templated/watermarked posts should `public/brand/` (inside the existing public convention, not a new root) be proposed again.

## 5. B-1 root cause (AUDIT COMPLETE — IMPLEMENTATION BLOCKED pending Owner gate)

Trace executed end-to-end without modifying anything:

```
canonicalOrderFlow.test.ts §18 (lines 300-336)
  → supabase.rpc('create_order_with_items')   [ONE order only; spy asserts no 2nd call — line 320]
  → createPaymentIntent (promptpay)           [create_payment_intent_record]
  → mark_payment_failed
  → retry createPaymentIntent                 [still no order creation]
  → lines 325-326: SELECT * FROM orders WHERE order_number = onum → 2 ROWS  ← FAIL
```

- **ROOT CAUSE**: order-number generation is **check-then-insert (TOCTOU) with NO UNIQUE constraint**.
  - Evidence: `025_canonical_order_rpc.sql` lines 280-295 (`BMB-YYYYMMDD-###`, `### = floor(random()*900)+100`, `SELECT EXISTS(...)` retry ≤5, then plain INSERT) and `007_server_authoritative_order.sql` lines 206-218 (same pattern).
  - Grep over ALL 103 migrations for `UNIQUE ... order_number` → **zero matches**. `orders.order_number` is not unique-constrained.
- **WHY THE TEST EXPECTS 1**: the test creates exactly one order (spy-enforced); one logical order = one row.
- **WHY RUNTIME PRODUCES 2**: the suite runs test files **in parallel against a shared persistent Supabase database**. Two concurrent `create_order_with_items` calls can randomly select the same `###` (only 900 candidates/day), both pass the `EXISTS` check, and both INSERT → duplicate `order_number` rows. This is a real race, not a flaky mock.
- **PRODUCTION RELEVANCE**: the same race exists for real concurrent customers — duplicate order numbers under load. Latent production defect, not merely a test artifact.
- **MINIMUM FIX SCOPE (proposal only — NOT applied)**: add `CREATE UNIQUE INDEX uq_orders_order_number ON orders(order_number)` + change generation to catch `unique_violation` and retry (or sequence-based generator). Purely additive to the RPC; no business-logic change (D-13).
- **RISK TO EXISTING PAYMENT FLOW**: low — payment intents key off `order_number`; the fix only prevents duplicate numbering. Requires production migration with a pre-check that no duplicate order_numbers already exist.
- **REGRESSION TESTS REQUIRED**: concurrent-creation test (N parallel creates → N distinct numbers); re-run of existing §18 test to green.
- **Classification: AUDIT COMPLETE / IMPLEMENTATION BLOCKED** (awaiting Owner authorization for the migration in a later gate).

## 6. B-2 / B-3 durable Social AI event contract (design only - no table created)

Field ownership partition:

| Layer | Fields | Notes |
|---|---|---|
| Ingestion | id, event_id (external), platform, page_id, event_type (comment/message/mention), sender_id, sender_name, content, payload (raw JSONB), received_at, tenant_id, brand_id | Payload retention: raw JSONB 90 days (Owner decision open) |
| Processing state | status (RECEIVED/PROCESSING/SUCCEEDED/FAILED/RETRYABLE/IGNORED/DUPLICATE), attempts, last_error, last_attempt_at, processed_at, claimed_at | Status machine supports all 7 states Owner listed |
| AI state | ai_model, ai_reply_text, ai_validated, ai_guardrail_flags | Non-authoritative; reply text only |
| Action state | action_type (none/reply/order), order_number (reference to canonical orders - never a copy) | D-14: no business state duplicated |
| Reply delivery | reply_status (pending/sent/failed), reply_provider_id, reply_attempted_at | Separate from processing so reply-succeeded/DB-failed and DB-succeeded/reply-failed splits are representable |
| Audit | created_at, updated_at + existing audit_logs entries | audit_logs stays trace-only, NOT a queue |

Idempotency key: UNIQUE (platform, event_id) at DB level (hard constraint - not query-based like today's webhook). DUPLICATE = insert conflict -> mark existing row, no reprocessing.

Anti second-order-system guarantees (D-14):
- The table holds NO price, NO payment state, NO inventory, NO delivery state - those exist only in canonical tables.
- Order intent flows exclusively through create_order_with_items with p_source_channel/p_external_ref_id; social_events stores only the resulting order_number reference.
- Status enum describes PROCESSING lifecycle only; business states (paid/shipped/etc.) are forbidden values.

Verdict: a social_events table designed as above CAN safely support RECEIVED/PROCESSING/SUCCEEDED/FAILED/RETRYABLE/IGNORED/DUPLICATE without becoming a second order system. Schema audit passes in principle; the migration itself remains blocked.

## 7. B-4 page allowlist (design only)

- CURRENT TRUST BOUNDARY: app-level HMAC signature (CHANNEL_WEBHOOK_APP_SECRET) only. Any object=page payload signed by the app is accepted; entry.id is used but never validated (channel-webhook lines 141-151).
- CURRENT GAP: no page scoping - a second page added to the same Meta app would be auto-processed; FACEBOOK_GROUP detection trusts value.group_id metadata.
- PROPOSED CONTROL: server-side env secret FACEBOOK_ALLOWED_PAGE_IDS (comma-separated Page IDs) read in channel-webhook via Deno.env.get. Alternative (business_settings DB row) considered and rejected for now: the webhook already trusts env secrets and env keeps the fail-closed default simpler.
- WHERE: inside channel-webhook after signature verification, before processEntry.
- FAIL-CLOSED: secret unset/empty -> reject every entry with channel_event_rejected audit + HTTP 200 (drain semantics preserved).
- OWNER CONFIGURATION REQUIRED: real Page ID(s) via supabase secrets set (D-11: never in repo).
- TEST CASES: (1) entry.id in allowlist -> processed; (2) entry.id not in allowlist -> rejected + audited; (3) secret missing -> all rejected; (4) allowlist still enforced when signature passes.
- No implementation performed.

## 8. B-5 AI tier contract (configuration-driven per D-06)

Current verified state: src/lib/aiModels.ts has only Model A (qwen/qwen3.7-flash primary, z-ai/glm-5.3-flash fallback) via resolveModelA(envModel). ai-proxy uses payload.model || DEFAULT_MODEL.

Proposed contract (env-driven, no hard-coded IDs in logic):

| Field | TIER_1 (social reply) | TIER_2 (structured/tool) | TIER_3 (content gen) | TIER_4 (final fallback) |
|---|---|---|---|---|
| provider/model | EXTERNAL VERIFICATION REQUIRED (env VITE_OPENROUTER_MODEL_TIER_1 + server mirror) | EXTERNAL VERIFICATION REQUIRED | EXTERNAL VERIFICATION REQUIRED | EXTERNAL VERIFICATION REQUIRED |
| purpose | real-time comment/DM replies | order-intent extraction, JSON output | Auto-Post captions | last resort |
| fallback tier | TIER_4 | TIER_4 | TIER_4 | none (fail) |
| retryable errors | 429, 5xx, network/timeout | same | same | same |
| non-retryable | 400, 401, 402, 403 | same | same | same |
| timeout | 15s (proposed) | 20s | 30s | 30s |
| max attempts | 1 primary + 1 fallback | same | same | 0 |

- Model availability must NOT be assumed from docs - actual OpenRouter model-list verification is EXTERNAL VERIFICATION REQUIRED before S1.
- Server/client model-ID duplication risk: ai-proxy DEFAULT_MODEL must read the same env source as the client, or tier selection should move fully server-side (recommended).
- Production AI configuration untouched this gate.

## 9. B-6 Meta dependency checklist (placeholders only - nothing configured)

| Item | Status | Owner provides |
|---|---|---|
| Meta App | NOT CONFIGURED | App ID (non-secret, e.g. <META_APP_ID>) |
| Page | NOT CONFIGURED | Page name/URL |
| Page ID | NOT CONFIGURED | <FACEBOOK_PAGE_ID> -> feeds allowlist (B-4) |
| Page Access Token | NOT CONFIGURED | <FACEBOOK_PAGE_ACCESS_TOKEN> -> Supabase secrets only |
| App Secret | NOT CONFIGURED (slot exists: CHANNEL_WEBHOOK_APP_SECRET - probed live at S0.1) | confirm privately |
| Verify Token | CONFIGURED slot (probe -> 403 proves token exists) | confirm value privately |
| Required permissions | NOT GRANTED | pages_read_engagement, pages_manage_metadata, pages_messaging, pages_read_user_content |
| Webhook subscription | ENDPOINT DEPLOYED (S0.1 probe) | subscribe page object; fields: feed, messages, messaging_postbacks |
| Graph API version | UNVERIFIED | pin version at S3 |
| App Review | NOT SUBMITTED | business verification + permission review |
| Token lifecycle | UNDESIGNED | long-lived page token + refresh plan (S6) |
| Production callback URL | EXISTS structurally | https://ivkdfognyiwjcmrhcnwz.supabase.co/functions/v1/channel-webhook |

## 10. B-7 retry architecture (where retries belong)

| Mechanism | Suitable as primary retry? | Reason |
|---|---|---|
| GitHub Actions scheduler | NO (for user-facing) | best-effort 5-min cadence, no automatic retry, minute-resolution eventIds (S0.1 F-4) |
| Existing automation-worker | PARTIALLY | proven deployment + idempotency, but fire-once semantics today |
| Durable queue (social_events) | YES - PRIMARY | status machine + attempts + RETRYABLE states (section 6) |
| Scheduled retry | YES - as the DRIVER of the queue | a scheduler tick claims RETRYABLE rows with backoff |
| Manual replay | YES - safety net | admin action to requeue FAILED rows |

Conclusion: retries belong INSIDE the queue row lifecycle (attempts/backoff/max-attempts on social_events), driven by a scheduler tick; GitHub Actions remains the trigger but must never be the retry authority. No implementation performed.

## 11. B-8 timeout analysis (ai-proxy upstream)

- Current fetch behavior: plain fetch(OPENROUTER_URL, ...) - no AbortSignal, no timeout of any kind (ai-proxy line 276).
- Failure mode: a hung upstream holds the Edge Function request open until platform limit; client sees long latency or silent failure; no in-function retry possible.
- Minimum timeout (proposed): 15s chat / 30s STT - bounded by Meta webhook response expectations and UX.
- Retry interaction: with a timeout the EF returns a clean 504 -> the existing client-side single fallback-model retry becomes meaningful instead of waiting indefinitely.
- Fallback interaction: timeout counts as a retryable error in the section-8 contract.
- Risk of duplicate AI requests: client retry after timeout while the original eventually completes -> two completions. Mitigation (future): idempotency key per request, or accept last-write for chat (harmless for read-only advice; HARMFUL if used for Social AI replies - hence reply sending must be queue-driven, not client-driven, per sections 6/10).
- No code changed.

## 12. Exact implementation boundaries (for the FUTURE authorized gate - not executed)

| Work item | Allowed files | Forbidden |
|---|---|---|
| B-1 fix | one new migration (unique index + RPC retry), no test edits | touching payment business logic |
| B-2/B-3 | one new migration social_events per section 6 | any order/business state in the table |
| B-4 | channel-webhook/index.ts allowlist block only | changing order/identity logic |
| B-5 | aiModels.ts tier registry + ai-proxy tier param | hard-coded model IDs in logic |
| B-7 | automation-worker new job + GHA workflow tick | changing existing 3 jobs semantics |
| B-8 | timeout wrapper in ai-proxy fetch | changing guardrails/models |

## 13. Test matrix (current gate)

| Test | Status | Evidence |
|---|---|---|
| npm test | 1 failed / 357 passed (358) - matches expected baseline exactly | canonicalOrderFlow section 18 line 326 (B-1 race) |
| npm run lint | PASS (eslint clean) | output captured this gate |
| npm run build | PASS (tsc + vite, PWA precache 133 entries) | output captured this gate |
| channel-webhook dedupe race test | MISSING TEST | none exists |
| scheduler retry test | MISSING TEST | none exists |
| Meta signature verify test | MISSING TEST | none exists |

## 14. Runtime verification matrix

| Claim | Method | Result | Status |
|---|---|---|---|
| Test baseline unchanged | npm test executed this gate | 1 failed / 357 passed | RUNTIME VERIFIED |
| Lint/build | executed | PASS | RUNTIME VERIFIED |
| Asset files exist | filesystem listing | full public/ + src/assets listing | RUNTIME VERIFIED |
| Asset consumers | grep of real imports | MascotBadge/CustomerReviewCard/index.html | SOURCE VERIFIED |
| og-image reachable on domain | not probed | - | UNVERIFIED |
| B-1 no unique constraint | grep over 103 migrations | 0 matches | SOURCE VERIFIED (DB runtime UNVERIFIED) |
| Meta dependencies | not configured | - | BLOCKED - EXTERNAL DEPENDENCY |

## 15. Remaining blockers

| # | Blocker | Status vs S0.1 |
|---|---|---|
| B-1 | duplicate order_number race (no UNIQUE constraint) | ROOT CAUSE FOUND - fix awaiting authorization |
| B-2/B-3 | no durable queue | contract designed; migration blocked |
| B-4 | no page allowlist | control designed |
| B-5 | no model tiers | contract designed; EXTERNAL VERIFICATION REQUIRED |
| B-6 | Meta App/tokens/permissions | BLOCKED - EXTERNAL DEPENDENCY |
| B-7 | no retry authority | design settled (section 10) |
| B-8 | no upstream timeout | design settled (section 11) |
| B-9 | production DB shape unverifiable (no credentials) | BLOCKED - EXTERNAL DEPENDENCY |

## 16. Owner decisions still required

1. Authorize the B-1 fix migration (unique index + retry) as an isolated, evidence-driven change (D-13).
2. Confirm allowed Page ID(s) for FACEBOOK_ALLOWED_PAGE_IDS (B-4/D-05).
3. Approve tier-count and timeout values in section 8, then order external model verification.
4. Payload retention period for social_events (proposed 90 days).
5. Approve the social_events migration for the NEXT gate (D-03 -> schema in section 6).
6. Decide whether Auto-Post is brand-scoped (brand_id) at launch or single-brand.
7. Provide (or authorize a safe probe of) read-only production DB access to clear B-9.
8. Confirm src/lib.zip disposition after Owner inspection (D-09) - untouched by this gate.
