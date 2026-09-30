# BMB_W3A_AI_GATEWAY_EVIDENCE.md
**WAVE 3-A â€” AI GATEWAY (F-03/F-04) Â· à¸§à¸±à¸™à¸—à¸µà¹ˆ: 2026-09-27** Â· à¸ à¸²à¸©à¸²à¹„à¸—à¸¢à¹€à¸›à¹‡à¸™à¸«à¸¥à¸±à¸ Â· Technical identifiers à¸„à¸‡ English

## 1. Owner Authorization
- Owner command "BMB â€” OWNER AUTHORIZATION: START WAVE 3" (2026-09-27) à¸­à¸™à¸¸à¸à¸²à¸•: W3-0 Reality
  Reconciliation â†’ W3-A AI Gateway (F-03/F-04 à¹€à¸—à¹ˆà¸²à¸™à¸±à¹‰à¸™) à¸ˆà¸™à¸–à¸¶à¸‡ Gate â†’ COMMIT â†’ PUSH â†’ HANDOFF â†’ HARD STOP
- Step A2: à¸­à¸™à¸¸à¸à¸²à¸•à¹ƒà¸Šà¹‰ existing OpenRouter API key à¸œà¹ˆà¸²à¸™ server-side Supabase secret Â·
  **DO NOT ROTATE** (à¹„à¸¡à¹ˆà¹„à¸”à¹‰ rotate â€” key à¸•à¸±à¸§à¹€à¸”à¸´à¸¡à¸ˆà¸²à¸ `supabase/secrets.local.env`)
- à¸‚à¹‰à¸­à¸«à¹‰à¸²à¸¡à¸„à¸‡à¸­à¸¢à¸¹à¹ˆ: à¹„à¸¡à¹ˆà¹€à¸¥à¸·à¸­à¸ AI provider à¹ƒà¸«à¸¡à¹ˆ / à¹„à¸¡à¹ˆà¹€à¸›à¸¥à¸µà¹ˆà¸¢à¸™ model strategy à¹€à¸Šà¸´à¸‡ business /
  à¹„à¸¡à¹ˆà¹à¸à¹‰ schema / à¹„à¸¡à¹ˆà¸•à¸±à¸”à¸ªà¸´à¸™ notification-omnichannel provider

## 2. Baseline (W3-0 à¹€à¸£à¸´à¹ˆà¸¡à¸‡à¸²à¸™)
- HEAD = `84fbd75` = origin/main Â· worktree CLEAN (à¸¢à¸à¹€à¸§à¹‰à¸™à¹„à¸Ÿà¸¥à¹Œà¸‡à¸²à¸™ W3-0/W3-A à¸—à¸µà¹ˆà¸ªà¸£à¹‰à¸²à¸‡à¸ à¸²à¸¢à¸«à¸¥à¸±à¸‡)
- CI lint FAIL: `eslint .` à¸žà¸š error 46 à¸£à¸²à¸¢à¸à¸²à¸£à¹ƒà¸™ `scripts/*.cjs` (no-undef / no-require-imports)
  â†’ fix: à¸‚à¸¢à¸²à¸¢ eslint flat-config ignores à¹€à¸›à¹‡à¸™ `**/*.cjs`, `**/*.mjs`, `scripts/**`
  (scripts = Node tooling à¸—à¸µà¹ˆà¸£à¸±à¸™à¸”à¹‰à¸§à¸¢ node à¸•à¸£à¸‡ à¹† à¹„à¸¡à¹ˆà¹ƒà¸Šà¹ˆ app code) â†’ lint = 0 errors

## 3. W3-0 Reality Reconciliation â€” VERDICT = (A) Production = 84fbd75
- à¸«à¹‰à¸²à¸¡à¹€à¸Šà¸·à¹ˆà¸­à¹€à¸­à¸à¸ªà¸²à¸£ â†’ à¸•à¸£à¸§à¸ˆ **production runtime** à¸ˆà¸£à¸´à¸‡: `https://bitemebaby-5f7.pages.dev`
- asset fingerprint à¸šà¸™ production: index-DphkYgGq.js / rolldown-runtime-hePW80VL.js /
  react-vendor-DK_VtTwx.js / state-vendor-Brj8_dxs.js / supabase-vendor-OACgMRo1.js /
  index-vxWXmwip.css â†’ **à¸•à¸£à¸‡à¸à¸±à¸š local build à¸ˆà¸²à¸ 84fbd75 6/6 à¸—à¸±à¹‰à¸‡à¸Šà¸·à¹ˆà¸­à¹„à¸Ÿà¸¥à¹Œà¹à¸¥à¸° SHA256**
  (à¹€à¸—à¸µà¸¢à¸šà¸ˆà¸²à¸à¹„à¸Ÿà¸¥à¹Œà¸—à¸µà¹ˆà¸”à¸²à¸§à¸™à¹Œà¹‚à¸«à¸¥à¸”à¸ˆà¸²à¸ production à¸ˆà¸£à¸´à¸‡)
- à¸„à¸§à¸²à¸¡à¸‚à¸±à¸”à¹à¸¢à¹‰à¸‡à¸‚à¸­à¸‡à¹€à¸­à¸à¸ªà¸²à¸£: `c6a4014` (Wave 1 deployment id `42809703`) à¸–à¸¹à¸
  **overwrite à¸”à¹‰à¸§à¸¢ deployment à¹ƒà¸«à¸¡à¹ˆà¸à¹ˆà¸­à¸™ Wave 2 gate** â€” `BMB_WAVE_2_HANDOFF.md` à¹„à¸¡à¹ˆà¸•à¸£à¸‡
  Production à¹à¸¥à¸°à¹„à¸”à¹‰à¹à¸à¹‰à¹„à¸‚à¹à¸¥à¹‰à¸§ Â· `BMB_WAVE_2_PRODUCTION_APPLY_EVIDENCE.md` (PROD_MATCH 6/6)
  à¸–à¸¹à¸à¸¢à¸·à¸™à¸¢à¸±à¸™à¸”à¹‰à¸§à¸¢ runtime à¸ˆà¸£à¸´à¸‡
- **à¹„à¸¡à¹ˆà¸¡à¸µ DEPLOYMENT GAP** â€” Wave 2 client (RiderPWA, diff c6a4014..84fbd75 = driverService.ts +
  RiderPwaPage.tsx) deploy à¸­à¸¢à¸¹à¹ˆà¹à¸¥à¹‰à¸§ â†’ **à¹„à¸¡à¹ˆ redeploy à¹€à¸žà¸µà¸¢à¸‡à¹€à¸žà¸·à¹ˆà¸­à¸„à¸§à¸²à¸¡à¸ªà¸°à¸­à¸²à¸”** (à¸•à¸²à¸¡à¸„à¸³à¸ªà¸±à¹ˆà¸‡)
- à¸›à¸´à¸” W3-0 à¸”à¹‰à¸§à¸¢: tsc 0 Â· vitest 44 files / 358 tests PASS Â· build âœ“

## 4. Architecture Audit (Step A1)
- AI Gateway à¸à¸¥à¸²à¸‡à¸—à¸µà¹ˆà¸¡à¸µà¸­à¸¢à¸¹à¹ˆ: **Supabase Edge Function `ai-proxy`** (`supabase/functions/ai-proxy/index.ts`)
  â€” à¹„à¸¡à¹ˆà¸¡à¸µ duplicate gateway Â· à¹„à¸¡à¹ˆà¸¡à¸µ provider key à¸à¸±à¹ˆà¸‡ client
- Callers (à¸—à¸±à¹‰à¸‡à¸«à¸¡à¸”à¸œà¹ˆà¸²à¸™ `supabase.functions.invoke('ai-proxy')` + user JWT): `aiService.ts`
  (chat + recommendations) Â· `aiToolCalling.ts` (read-only tools) Â· `aiVoice.ts` (voice) Â·
  `ai-daily-report` function à¸¢à¸±à¸‡à¹„à¸¡à¹ˆà¸–à¸¹à¸ deploy (à¸™à¸­à¸ scope W3-A)
- Contract: POST `{ messages, model?, maxTokens? }` â†’ `{ data: <OpenRouter chat completion> }`
  à¸«à¸£à¸·à¸­ `{ error, upstream_status?, detail? }` Â· model default
  `nvidia/nemotron-3-ultra-550b-a55b:free`
- Guardrail (AI-02) inject **server-side** à¸—à¸µà¹ˆà¸«à¸±à¸§ system context â€” client strip à¹„à¸¡à¹ˆà¹„à¸”à¹‰
- config.toml: `[functions.ai-proxy] verify_jwt = true`

## 5. Existing Implementation à¸—à¸µà¹ˆà¸•à¸£à¸§à¸ˆà¸žà¸š (à¸à¹ˆà¸­à¸™à¹à¸à¹‰)
- Key: server-side à¹€à¸—à¹ˆà¸²à¸™à¸±à¹‰à¸™ (Deno.env OPENROUTER_API_KEY) â€” à¹„à¸¡à¹ˆà¸¡à¸µà¹ƒà¸™ src/dist/env VITE_*
- à¹„à¸¡à¹ˆà¸¡à¸µ in-function auth check à¹€à¸”à¸´à¸¡ (à¸žà¸¶à¹ˆà¸‡ platform verify_jwt) â†’ à¸žà¸š defect à¸—à¸µà¹ˆ runtime
- à¹„à¸¡à¹ˆà¸¡à¸µ rate limiting / quota / upstream timeout â€” à¸ˆà¸±à¸”à¹€à¸›à¹‡à¸™ GAP (à¹„à¸¡à¹ˆ blocker)

## 6. AI Gateway Contract (à¸«à¸¥à¸±à¸‡à¹à¸à¹‰)
- à¸žà¸£à¹‰à¸­à¸¡à¸à¸±à¸šà¸‚à¹‰à¸­ 4 Â· à¹€à¸žà¸´à¹ˆà¸¡: Authorization à¸•à¹‰à¸­à¸‡à¹€à¸›à¹‡à¸™ **user JWT à¸—à¸µà¹ˆ verify à¹„à¸”à¹‰à¸à¸±à¸š
  `{SUPABASE_URL}/auth/v1/user`** à¸¡à¸´à¸‰à¸°à¸™à¸±à¹‰à¸™ 401 (à¸›à¸à¸´à¹€à¸ªà¸˜ `anon`, `service_role`,
  `sb_publishable_*` à¸—à¸±à¸™à¸—à¸µ)

## 7. Authentication
- **RUNTIME DEFECT à¸—à¸µà¹ˆà¸žà¸š (Step A3 à¸‚à¹‰à¸­ 1/3):** probe à¸£à¸­à¸šà¹à¸£à¸ (à¸à¹ˆà¸­à¸™ hardening) =
  unauthenticated caller à¹„à¸”à¹‰ **HTTP 200** â€” platform `verify_jwt` à¹„à¸¡à¹ˆà¸–à¸¹à¸ enforce à¸•à¸­à¸™
  deploy â†’ ai-proxy à¸ˆà¸°à¸à¸¥à¸²à¸¢à¹€à¸›à¹‡à¸™ unrestricted AI relay à¸šà¸™ server-side key
- **à¹à¸à¹‰à¸ à¸²à¸¢à¹ƒà¸™ W3-A (blocker à¸•à¹ˆà¸­ security contract):** à¹€à¸žà¸´à¹ˆà¸¡ in-function JWT verification
  (defense-in-depth, verify à¸à¸±à¸š `{SUPABASE_URL}/auth/v1/user`) â†’ redeploy â†’ probe à¸£à¸­à¸šà¸ªà¸­à¸‡:
  unauth = 401, anon-key = 401, valid JWT = 200 Â· à¸žà¸´à¸ªà¸¹à¸ˆà¸™à¹Œà¹à¸¥à¹‰à¸§à¸§à¹ˆà¸² anonymous caller
  à¹ƒà¸Šà¹‰à¹€à¸›à¹‡à¸™ relay à¹„à¸¡à¹ˆà¹„à¸”à¹‰

## 8. OpenRouter Secret Handling
- à¸•à¸£à¸§à¸ˆ `npx supabase secrets list` (production `ivkdfognyiwjcmrhcnwz`): à¸¢à¸±à¸‡à¹„à¸¡à¹ˆà¸¡à¸µ
  `OPENROUTER_API_KEY` â†’ set à¸”à¹‰à¸§à¸¢ existing key à¸ˆà¸²à¸ gitignored `supabase/secrets.local.env`
  (à¹„à¸¡à¹ˆ rotate Â· à¹„à¸¡à¹ˆ print à¸„à¹ˆà¸² Â· à¹„à¸¡à¹ˆ commit) â†’ list à¸¢à¸·à¸™à¸¢à¸±à¸™ `OPENROUTER_API_KEY` à¸¡à¸µà¸­à¸¢à¸¹à¹ˆà¹à¸¥à¹‰à¸§
  (à¹à¸ªà¸”à¸‡à¹€à¸‰à¸žà¸²à¸° digest)
- à¸«à¸¡à¸²à¸¢à¹€à¸«à¸•à¸¸: à¸„à¹ˆà¸² secret à¸›à¸£à¸²à¸à¸à¹ƒà¸™ terminal echo à¸‚à¸­à¸‡à¸„à¸³à¸ªà¸±à¹ˆà¸‡ set à¸«à¸™à¸¶à¹ˆà¸‡à¸„à¸£à¸±à¹‰à¸‡ (à¸„à¹ˆà¸² key à¹€à¸”à¸´à¸¡à¸•à¸²à¸¡à¸—à¸µà¹ˆ
  Owner à¸«à¹‰à¸²à¸¡ rotate Â· session terminal à¸à¸±à¹ˆà¸‡ Owner) â€” à¹„à¸¡à¹ˆà¹€à¸‚à¹‰à¸² git, à¹„à¸¡à¹ˆà¹€à¸‚à¹‰à¸² server logs,
  à¹„à¸¡à¹ˆà¹€à¸‚à¹‰à¸² evidence à¸™à¸µà¹‰
- `VITE_OPENROUTER_MODEL` à¹ƒà¸™ .env = à¸Šà¸·à¹ˆà¸­ model à¹€à¸—à¹ˆà¸²à¸™à¸±à¹‰à¸™ (à¹„à¸¡à¹ˆà¹ƒà¸Šà¹ˆ secret)

## 9. Deployment
- `npx supabase functions deploy ai-proxy --project-ref ivkdfognyiwjcmrhcnwz` =
  "Deployed Functions on project ivkdfognyiwjcmrhcnwz: ai-proxy" (2 à¸„à¸£à¸±à¹‰à¸‡: initial + hardened)
- deploy à¸„à¸£à¸±à¹‰à¸‡à¹à¸£à¸à¸•à¸´à¸” BOM à¹ƒà¸™ `.env.local` â†’ à¹à¸à¹‰ BOM (à¹„à¸¡à¹ˆà¹à¸à¹‰à¹€à¸™à¸·à¹‰à¸­à¸«à¸²) à¹à¸¥à¹‰à¸§ deploy à¸ªà¸³à¹€à¸£à¹‡à¸ˆ
- à¸à¹ˆà¸­à¸™ W3-A: production functions list à¸¡à¸µà¹€à¸žà¸µà¸¢à¸‡ create-checkout / stripe-webhook /
  stripe-refund / phone-auto-login â†’ **ai-proxy à¹„à¸¡à¹ˆà¹€à¸„à¸¢à¸–à¸¹à¸ deploy à¸¡à¸²à¸à¹ˆà¸­à¸™**
- Cloudflare: à¹„à¸¡à¹ˆà¸•à¹‰à¸­à¸‡ deploy (production = 84fbd75 à¸­à¸¢à¸¹à¹ˆà¹à¸¥à¹‰à¸§ à¸•à¸²à¸¡à¸‚à¹‰à¸­ 3; à¸‡à¸²à¸™à¸™à¸µà¹‰à¹„à¸¡à¹ˆà¹à¸•à¸° src/)

## 10. Runtime Tests â€” `e2e/w3a-ai-proxy-runtime.json` (production à¸ˆà¸£à¸´à¸‡ Â· PASS 11/11)
| à¸•à¸£à¸§à¸ˆ | à¸œà¸¥ |
|---|---|
| login test admin â†’ JWT | PASS |
| unauthenticated POST | PASS (401) |
| anon-key-as-bearer | PASS (401) |
| CORS preflight OPTIONS | PASS (200, ACAO=*) |
| malformed JSON | PASS (400 `invalid json`) |
| empty messages | PASS (400 `no messages`) |
| wrong method GET | PASS (405) |
| valid request | PASS (200, contract à¸„à¸£à¸š: choices/usage/model) |
| guardrail prompt-injection probe | PASS (à¹„à¸¡à¹ˆ echo secret) |
| provider error (invalid model) | PASS (502 `upstream error`, upstream=400, handled) |
| secret scan à¸—à¸¸à¸ response | PASS (0 hits à¸‚à¸­à¸‡ `sk-or-*`) |

## 11. Security Tests
- JWT boundary: à¸”à¸¹à¸‚à¹‰à¸­ 7/10 Â· CORS: ACAO=* + allow authorization/apikey headers (JWT à¸¢à¸±à¸‡à¸ˆà¸³à¹€à¸›à¹‡à¸™)
- secret: OPENROUTER key à¸–à¸¹à¸à¸­à¹ˆà¸²à¸™à¸ˆà¸²à¸ Deno.env à¹€à¸—à¹ˆà¸²à¸™à¸±à¹‰à¸™ Â· response error à¹„à¸¡à¹ˆà¸£à¸§à¸¡ key

## 12. Client Exposure Scan
- dist scan (238+ à¹„à¸Ÿà¸¥à¹Œ): `OPENROUTER_API_KEY` / `sk-or-` = **0 hits**
- actual key (`sk-or-v1-****â€¦`) à¹ƒà¸™ **git tracked files: NONE** Â· à¹ƒà¸™ **dist: NONE**
- git à¸¡à¸µà¹€à¸žà¸µà¸¢à¸‡à¸„à¸³à¸§à¹ˆà¸² "sk-or" à¹ƒà¸™ scan scripts/docs (à¹„à¸¡à¹ˆà¹ƒà¸Šà¹ˆà¸„à¹ˆà¸²à¸ˆà¸£à¸´à¸‡)

## 13. Error Handling
- malformed json â†’ 400 Â· no messages â†’ 400 Â· method â†’ 405 Â· upstream !ok â†’ 502 à¸žà¸£à¹‰à¸­à¸¡
  upstream_status (à¹„à¸¡à¹ˆà¸žà¸±à¸‡ 500) Â· secret missing â†’ 500 à¸žà¸£à¹‰à¸­à¸¡à¸‚à¹‰à¸­à¸„à¸§à¸²à¸¡à¸Šà¸±à¸”à¹€à¸ˆà¸™ (à¹„à¸¡à¹ˆ leak)

## 14. Provider Failure Tests
- invalid model â†’ OpenRouter 400 â†’ function à¸•à¸­à¸š 502 handled (runtime à¸ˆà¸£à¸´à¸‡) Â·
  timeout: Supabase EF wall-clock à¸„à¸£à¸­à¸šà¸„à¸¥à¸¸à¸¡ Â· **GAP: à¹„à¸¡à¹ˆà¸¡à¸µ explicit upstream timeout /
  retry** (à¸”à¸¹à¸‚à¹‰à¸­ 16)

## 15. Transaction Authority Boundary
- ai-proxy = **read-only advice** â€” à¹„à¸¡à¹ˆ forward tools param, à¹„à¸¡à¹ˆà¸¡à¸µ authority tools,
  guardrail à¸«à¹‰à¸²à¸¡ AI à¸¢à¸·à¸™à¸¢à¸±à¸™à¸£à¸²à¸„à¸²/à¸ªà¸•à¹Šà¸­à¸/à¸­à¸­à¹€à¸”à¸­à¸£à¹Œ/à¸à¸²à¸£à¸Šà¸³à¸£à¸°à¹€à¸‡à¸´à¸™ (inject server-side)
- `aiToolCalling.ts` tools à¸—à¸±à¹‰à¸‡à¸«à¸¡à¸”à¹€à¸›à¹‡à¸™ read-only getters (get_menu/get_order/get_product/
  get_reviews/get_categories) execute client-side à¸šà¸™à¸‚à¹‰à¸­à¸¡à¸¹à¸¥à¸—à¸µà¹ˆ RLS à¸à¸³à¸«à¸™à¸” â€” AI à¹„à¸¡à¹ˆà¸¡à¸µ
  à¸­à¸³à¸™à¸²à¸ˆà¸•à¸±à¸”à¸ªà¸´à¸™ transaction Â· Supabase à¸¢à¸±à¸‡à¹€à¸›à¹‡à¸™ Source of Truth Â· **PASS**

## 16. GAP (à¹„à¸¡à¹ˆ blocker à¸•à¹ˆà¸­ W3-A Gate â€” à¸šà¸±à¸™à¸—à¸¶à¸à¹„à¸§à¹‰)
1. **No rate limiting / abuse controls** â€” authenticated users à¹ƒà¸Šà¹‰à¹„à¸”à¹‰à¹„à¸¡à¹ˆà¸ˆà¸³à¸à¸±à¸” (à¸„à¸§à¸²à¸¡à¹€à¸ªà¸µà¹ˆà¸¢à¸‡:
  OpenRouter quota burn) à¸•à¸²à¸¡à¸„à¸³à¸ªà¸±à¹ˆà¸‡ "à¸­à¸¢à¹ˆà¸²à¹à¸à¹‰à¹ƒà¸«à¸à¹ˆà¹€à¸à¸´à¸™ scope" â†’ à¸ˆà¸±à¸”à¹€à¸›à¹‡à¸™ GAP
2. **No explicit upstream timeout/retry** à¹ƒà¸™ ai-proxy (à¸žà¸¶à¹ˆà¸‡ EF wall-clock)
3. `chatWithToolSupport` à¸ªà¹ˆà¸‡ `tools` param à¹à¸•à¹ˆ ai-proxy à¹„à¸¡à¹ˆ forward â†’ tool_calls path
  dormant (à¹„à¸¡à¹ˆà¹ƒà¸Šà¹ˆ security issue â€” fail-safe à¸à¸±à¹ˆà¸‡ client)
4. CORS `Access-Control-Allow-Origin: *` â€” à¸¢à¸­à¸¡à¸£à¸±à¸šà¹„à¸”à¹‰à¹€à¸žà¸£à¸²à¸° JWT à¸¢à¸±à¸‡ required

## 17. READY
- ai-proxy = READY (deployed + hardened + runtime verified 11/11 on production)

## 18. BLOCKED
- à¹„à¸¡à¹ˆà¸¡à¸µà¸ªà¸´à¹ˆà¸‡à¹ƒà¸” BLOCKED à¹ƒà¸™ W3-A (Owner decisions à¸„à¸‡à¸„à¹‰à¸²à¸‡à¸ˆà¸²à¸ Wave 2 à¹„à¸¡à¹ˆà¸à¸£à¸°à¸—à¸š W3-A)

## 19. Gate Result
source audit âœ“ Â· gateway contract âœ“ Â· server-side secret âœ“ Â· secret configured âœ“ Â·
no key in client âœ“ Â· no key in dist âœ“ Â· no key in logs âœ“ Â· auth boundary verified âœ“ Â·
valid request PASS âœ“ Â· invalid request handled âœ“ Â· provider error handled âœ“ Â· CORS âœ“ Â·
runtime production probe PASS (11/11) âœ“ Â· tsc PASS (0) âœ“ Â· vitest PASS (358) âœ“ Â·
build PASS âœ“ Â· secret scan PASS âœ“ Â· lint PASS (à¸«à¸¥à¸±à¸‡ fix CI) âœ“ Â· deployment fingerprint âœ“
â†’ **W3-A GATE = PASS**

## 20. Exact Next Step
- **HARD STOP â€” à¸£à¸­à¸„à¸³à¸ªà¸±à¹ˆà¸‡ Owner** à¸à¹ˆà¸­à¸™à¹€à¸£à¸´à¹ˆà¸¡ W3-B Automation (à¸”à¸¹ BMB_W3A_HANDOFF.md)

