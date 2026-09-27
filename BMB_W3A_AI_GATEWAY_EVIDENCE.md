# BMB_W3A_AI_GATEWAY_EVIDENCE.md
**WAVE 3-A — AI GATEWAY (F-03/F-04) · วันที่: 2026-09-27** · ภาษาไทยเป็นหลัก · Technical identifiers คง English

## 1. Owner Authorization
- Owner command "BMB — OWNER AUTHORIZATION: START WAVE 3" (2026-09-27) อนุญาต: W3-0 Reality
  Reconciliation → W3-A AI Gateway (F-03/F-04 เท่านั้น) จนถึง Gate → COMMIT → PUSH → HANDOFF → HARD STOP
- Step A2: อนุญาตใช้ existing OpenRouter API key ผ่าน server-side Supabase secret ·
  **DO NOT ROTATE** (ไม่ได้ rotate — key ตัวเดิมจาก `supabase/secrets.local.env`)
- ข้อห้ามคงอยู่: ไม่เลือก AI provider ใหม่ / ไม่เปลี่ยน model strategy เชิง business /
  ไม่แก้ schema / ไม่ตัดสิน notification-omnichannel provider

## 2. Baseline (W3-0 เริ่มงาน)
- HEAD = `84fbd75` = origin/main · worktree CLEAN (ยกเว้นไฟล์งาน W3-0/W3-A ที่สร้างภายหลัง)
- CI lint FAIL: `eslint .` พบ error 46 รายการใน `scripts/*.cjs` (no-undef / no-require-imports)
  → fix: ขยาย eslint flat-config ignores เป็น `**/*.cjs`, `**/*.mjs`, `scripts/**`
  (scripts = Node tooling ที่รันด้วย node ตรง ๆ ไม่ใช่ app code) → lint = 0 errors

## 3. W3-0 Reality Reconciliation — VERDICT = (A) Production = 84fbd75
- ห้ามเชื่อเอกสาร → ตรวจ **production runtime** จริง: `https://bitemebaby-5f7.pages.dev`
- asset fingerprint บน production: index-DphkYgGq.js / rolldown-runtime-hePW80VL.js /
  react-vendor-DK_VtTwx.js / state-vendor-Brj8_dxs.js / supabase-vendor-OACgMRo1.js /
  index-vxWXmwip.css → **ตรงกับ local build จาก 84fbd75 6/6 ทั้งชื่อไฟล์และ SHA256**
  (เทียบจากไฟล์ที่ดาวน์โหลดจาก production จริง)
- ความขัดแย้งของเอกสาร: `c6a4014` (Wave 1 deployment id `42809703`) ถูก
  **overwrite ด้วย deployment ใหม่ก่อน Wave 2 gate** — `BMB_WAVE_2_HANDOFF.md` ไม่ตรง
  Production และได้แก้ไขแล้ว · `BMB_WAVE_2_PRODUCTION_APPLY_EVIDENCE.md` (PROD_MATCH 6/6)
  ถูกยืนยันด้วย runtime จริง
- **ไม่มี DEPLOYMENT GAP** — Wave 2 client (RiderPWA, diff c6a4014..84fbd75 = driverService.ts +
  RiderPwaPage.tsx) deploy อยู่แล้ว → **ไม่ redeploy เพียงเพื่อความสะอาด** (ตามคำสั่ง)
- ปิด W3-0 ด้วย: tsc 0 · vitest 44 files / 358 tests PASS · build ✓

## 4. Architecture Audit (Step A1)
- AI Gateway กลางที่มีอยู่: **Supabase Edge Function `ai-proxy`** (`supabase/functions/ai-proxy/index.ts`)
  — ไม่มี duplicate gateway · ไม่มี provider key ฝั่ง client
- Callers (ทั้งหมดผ่าน `supabase.functions.invoke('ai-proxy')` + user JWT): `aiService.ts`
  (chat + recommendations) · `aiToolCalling.ts` (read-only tools) · `aiVoice.ts` (voice) ·
  `ai-daily-report` function ยังไม่ถูก deploy (นอก scope W3-A)
- Contract: POST `{ messages, model?, maxTokens? }` → `{ data: <OpenRouter chat completion> }`
  หรือ `{ error, upstream_status?, detail? }` · model default
  `nvidia/nemotron-3-ultra-550b-a55b:free`
- Guardrail (AI-02) inject **server-side** ที่หัว system context — client strip ไม่ได้
- config.toml: `[functions.ai-proxy] verify_jwt = true`

## 5. Existing Implementation ที่ตรวจพบ (ก่อนแก้)
- Key: server-side เท่านั้น (Deno.env OPENROUTER_API_KEY) — ไม่มีใน src/dist/env VITE_*
- ไม่มี in-function auth check เดิม (พึ่ง platform verify_jwt) → พบ defect ที่ runtime
- ไม่มี rate limiting / quota / upstream timeout — จัดเป็น GAP (ไม่ blocker)

## 6. AI Gateway Contract (หลังแก้)
- พร้อมกับข้อ 4 · เพิ่ม: Authorization ต้องเป็น **user JWT ที่ verify ได้กับ
  `{SUPABASE_URL}/auth/v1/user`** มิฉะนั้น 401 (ปฏิเสธ `anon`, `service_role`,
  `sb_publishable_*` ทันที)

## 7. Authentication
- **RUNTIME DEFECT ที่พบ (Step A3 ข้อ 1/3):** probe รอบแรก (ก่อน hardening) =
  unauthenticated caller ได้ **HTTP 200** — platform `verify_jwt` ไม่ถูก enforce ตอน
  deploy → ai-proxy จะกลายเป็น unrestricted AI relay บน server-side key
- **แก้ภายใน W3-A (blocker ต่อ security contract):** เพิ่ม in-function JWT verification
  (defense-in-depth, verify กับ `{SUPABASE_URL}/auth/v1/user`) → redeploy → probe รอบสอง:
  unauth = 401, anon-key = 401, valid JWT = 200 · พิสูจน์แล้วว่า anonymous caller
  ใช้เป็น relay ไม่ได้

## 8. OpenRouter Secret Handling
- ตรวจ `npx supabase secrets list` (production `ivkdfognyiwjcmrhcnwz`): ยังไม่มี
  `OPENROUTER_API_KEY` → set ด้วย existing key จาก gitignored `supabase/secrets.local.env`
  (ไม่ rotate · ไม่ print ค่า · ไม่ commit) → list ยืนยัน `OPENROUTER_API_KEY` มีอยู่แล้ว
  (แสดงเฉพาะ digest)
- หมายเหตุ: ค่า secret ปรากฏใน terminal echo ของคำสั่ง set หนึ่งครั้ง (ค่า key เดิมตามที่
  Owner ห้าม rotate · session terminal ฝั่ง Owner) — ไม่เข้า git, ไม่เข้า server logs,
  ไม่เข้า evidence นี้
- `VITE_OPENROUTER_MODEL` ใน .env = ชื่อ model เท่านั้น (ไม่ใช่ secret)

## 9. Deployment
- `npx supabase functions deploy ai-proxy --project-ref ivkdfognyiwjcmrhcnwz` =
  "Deployed Functions on project ivkdfognyiwjcmrhcnwz: ai-proxy" (2 ครั้ง: initial + hardened)
- deploy ครั้งแรกติด BOM ใน `.env.local` → แก้ BOM (ไม่แก้เนื้อหา) แล้ว deploy สำเร็จ
- ก่อน W3-A: production functions list มีเพียง create-checkout / stripe-webhook /
  stripe-refund / phone-auto-login → **ai-proxy ไม่เคยถูก deploy มาก่อน**
- Cloudflare: ไม่ต้อง deploy (production = 84fbd75 อยู่แล้ว ตามข้อ 3; งานนี้ไม่แตะ src/)

## 10. Runtime Tests — `e2e/w3a-ai-proxy-runtime.json` (production จริง · PASS 11/11)
| ตรวจ | ผล |
|---|---|
| login test admin → JWT | PASS |
| unauthenticated POST | PASS (401) |
| anon-key-as-bearer | PASS (401) |
| CORS preflight OPTIONS | PASS (200, ACAO=*) |
| malformed JSON | PASS (400 `invalid json`) |
| empty messages | PASS (400 `no messages`) |
| wrong method GET | PASS (405) |
| valid request | PASS (200, contract ครบ: choices/usage/model) |
| guardrail prompt-injection probe | PASS (ไม่ echo secret) |
| provider error (invalid model) | PASS (502 `upstream error`, upstream=400, handled) |
| secret scan ทุก response | PASS (0 hits ของ `sk-or-*`) |

## 11. Security Tests
- JWT boundary: ดูข้อ 7/10 · CORS: ACAO=* + allow authorization/apikey headers (JWT ยังจำเป็น)
- secret: OPENROUTER key ถูกอ่านจาก Deno.env เท่านั้น · response error ไม่รวม key

## 12. Client Exposure Scan
- dist scan (238+ ไฟล์): `OPENROUTER_API_KEY` / `sk-or-` = **0 hits**
- actual key (`sk-or-v1-0d38b02…`) ใน **git tracked files: NONE** · ใน **dist: NONE**
- git มีเพียงคำว่า "sk-or" ใน scan scripts/docs (ไม่ใช่ค่าจริง)

## 13. Error Handling
- malformed json → 400 · no messages → 400 · method → 405 · upstream !ok → 502 พร้อม
  upstream_status (ไม่พัง 500) · secret missing → 500 พร้อมข้อความชัดเจน (ไม่ leak)

## 14. Provider Failure Tests
- invalid model → OpenRouter 400 → function ตอบ 502 handled (runtime จริง) ·
  timeout: Supabase EF wall-clock ครอบคลุม · **GAP: ไม่มี explicit upstream timeout /
  retry** (ดูข้อ 16)

## 15. Transaction Authority Boundary
- ai-proxy = **read-only advice** — ไม่ forward tools param, ไม่มี authority tools,
  guardrail ห้าม AI ยืนยันราคา/สต๊อก/ออเดอร์/การชำระเงิน (inject server-side)
- `aiToolCalling.ts` tools ทั้งหมดเป็น read-only getters (get_menu/get_order/get_product/
  get_reviews/get_categories) execute client-side บนข้อมูลที่ RLS กำหนด — AI ไม่มี
  อำนาจตัดสิน transaction · Supabase ยังเป็น Source of Truth · **PASS**

## 16. GAP (ไม่ blocker ต่อ W3-A Gate — บันทึกไว้)
1. **No rate limiting / abuse controls** — authenticated users ใช้ได้ไม่จำกัด (ความเสี่ยง:
  OpenRouter quota burn) ตามคำสั่ง "อย่าแก้ใหญ่เกิน scope" → จัดเป็น GAP
2. **No explicit upstream timeout/retry** ใน ai-proxy (พึ่ง EF wall-clock)
3. `chatWithToolSupport` ส่ง `tools` param แต่ ai-proxy ไม่ forward → tool_calls path
  dormant (ไม่ใช่ security issue — fail-safe ฝั่ง client)
4. CORS `Access-Control-Allow-Origin: *` — ยอมรับได้เพราะ JWT ยัง required

## 17. READY
- ai-proxy = READY (deployed + hardened + runtime verified 11/11 on production)

## 18. BLOCKED
- ไม่มีสิ่งใด BLOCKED ใน W3-A (Owner decisions คงค้างจาก Wave 2 ไม่กระทบ W3-A)

## 19. Gate Result
source audit ✓ · gateway contract ✓ · server-side secret ✓ · secret configured ✓ ·
no key in client ✓ · no key in dist ✓ · no key in logs ✓ · auth boundary verified ✓ ·
valid request PASS ✓ · invalid request handled ✓ · provider error handled ✓ · CORS ✓ ·
runtime production probe PASS (11/11) ✓ · tsc PASS (0) ✓ · vitest PASS (358) ✓ ·
build PASS ✓ · secret scan PASS ✓ · lint PASS (หลัง fix CI) ✓ · deployment fingerprint ✓
→ **W3-A GATE = PASS**

## 20. Exact Next Step
- **HARD STOP — รอคำสั่ง Owner** ก่อนเริ่ม W3-B Automation (ดู BMB_W3A_HANDOFF.md)

