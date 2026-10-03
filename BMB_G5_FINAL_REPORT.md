# BMB_G5_FINAL_REPORT.md

Gate: **G5 — AI MODEL ROUTING**
วันที่: 2026-10-03
ภาษา: ไทย (technical identifier คงเป็น English ตามจริง)

## สรุปสถานะ GATE

```text
G5 = HOLD
BLOCKER เดียว: production deploy ของ ai-proxy รุ่น G5 ยังทำไม่ได้
เหตุผล: ไม่มี SUPABASE_ACCESS_TOKEN บนเครื่องนี้ (ไฟล์ .env.local มีชื่อแต่ค่าว่าง
และไม่มี stored token ที่ %USERPROFILE%\.supabase, ไม่มี deploy workflow ใน GitHub Actions)
```

โค้ด G5 implementation และ test suite **เสร็จและผ่านครบ** — ขาดเพียง "DEPLOY + RUNTIME VERIFIED บน production"
(ต้องให้ Owner จัดหา `SUPABASE_ACCESS_TOKEN` หรือ deploy เอง จากนั้นรัน `node e2e/g5RuntimeProbe.cjs` จะได้ evidence ทันที)

## Baseline

```text
HEAD before:        adb013a (G5 audit commit)
origin/main before: adb013a
WORKTREE before:    CLEAN
```

## Implementation (ไฟล์ที่แก้/สร้างจริง)

| ไฟล์ | สถานะ | หน้าที่ |
|---|---|---|
| `supabase/functions/_shared/aiPolicy.ts` | IMPLEMENTED (ใหม่) | Canonical task → model policy (single source of truth, D5-01/D5-05) |
| `supabase/functions/_shared/aiRateLimit.ts` | IMPLEMENTED (ใหม่) | Sliding-window per-caller limiter + caller key แบบ hash (ไม่เก็บ token) |
| `supabase/functions/_shared/aiTimeout.ts` | IMPLEMENTED (ใหม่) | `fetchWithTimeout` + `TimeoutError` (F2 fix) |
| `supabase/functions/_shared/aiStructuredOutput.ts` | IMPLEMENTED (ใหม่) | Structured-output contract: extractJson → validate → accept/reject (F4 fix) |
| `supabase/functions/ai-proxy/index.ts` | IMPLEMENTED (แก้) | Routing gateway: task validation, server-side model selection, timeout, fallback retry 1 ครั้ง, rate limit, usage log, `routing` metadata ใน response |
| `src/lib/aiModels.ts` | IMPLEMENTED (แก้) | Re-export policy จาก `_shared/aiPolicy.ts` + `resolveModelA()` (compat เดิม) |
| `src/lib/aiService.ts` | IMPLEMENTED (แก้) | ส่ง `task: 'chat'/'streaming'/'recommendation'` + recommendation ใช้ structured validation |
| `src/lib/aiToolCalling.ts` | IMPLEMENTED (แก้) | ส่ง `task: 'tool_support'` (tools param ยัง dormant — D5-03) |
| `src/__tests__/aiRouting.test.ts` | IMPLEMENTED (ใหม่) | T-G5-01..T-G5-18 |
| `e2e/g5RuntimeProbe.cjs` | IMPLEMENTED (ใหม่) | Production probe (read-only, ไม่สร้าง persistent data) |

ห้ามแตะ: `channel-webhook`, HMAC logic, Meta secrets, Page binding, `social_events`,
tenant/brand authority, automation-worker, Stripe — **ยืนยันผ่าน `git diff --name-only` แล้ว (ไม่มีไฟล์ G4 ใน diff)**

## Model Routing (task → policy — ไม่มี secret)

```text
task                      | primary              | fallback             | maxTokens | timeout | status
chat                      | qwen/qwen3.7-flash   | z-ai/glm-5.3-flash   | 700       | 30s     | ACTIVE
streaming                 | qwen/qwen3.7-flash   | z-ai/glm-5.3-flash   | 700       | 45s     | ACTIVE
recommendation            | qwen/qwen3.7-flash   | z-ai/glm-5.3-flash   | 300       | 30s     | ACTIVE
voice_stt                 | google/gemini-2.5-flash | whisper-large-v3 (Groq) | 300 | 60s | ACTIVE
tool_support              | qwen/qwen3.7-flash   | z-ai/glm-5.3-flash   | 1000      | 30s     | ACTIVE
content_automation        | qwen/qwen3.7-flash   | z-ai/glm-5.3-flash   | 700       | 60s     | ACTIVE
admin_ai / support        | qwen/qwen3.7-flash   | z-ai/glm-5.3-flash   | 700       | 30s     | ACTIVE
social_comment_classify   | —                    | —                    | 300       | 30s     | RESERVED
social_reply_draft        | —                    | —                    | 500       | 30s     | RESERVED
social_post_draft         | —                    | —                    | 700       | 60s     | RESERVED
```

กติกา (D5-01): client ส่ง `model` มาได้ แต่ ai-proxy **รับเฉพาะ id ที่ policy ของ task อนุมัติ** (primary/fallback) —
id อื่นถูก **IGNORE** แล้วใช้ policy primary; `model_id` / `provider` / `endpoint` เป็น dead keys ทั้งหมด;
**ไม่มีช่องทางใดให้ client ขยาย whitelist**
## Security (model / task / provider injection)

Unit-level (ผ่าน test — ดูหัวข้อ Tests):

- **Model injection** (`openai/gpt-4o`): ignore → ใช้ `qwen/qwen3.7-flash`, `clientModelAccepted=false` ✅
- **Provider/endpoint injection**: dead keys, upstream URL เป็น constant เดียว (`OPENROUTER_URL`), ไม่มี code path อ่านค่าจาก client ✅
- **Task injection** (`not_a_task`): 400 `invalid_task`; reserved task → 400 `task_reserved_not_active` ✅
- **Secret exposure**: ไม่มี `sk-or-*` / `OPENROUTER_API_KEY` / `GROQ_API_KEY` / `BOTNOI_API_KEY` ในไฟล์ client ใด ๆ (scan ผ่าน test T-G5-15); usage log เก็บเฉพาะ caller-hash/task/model/status ไม่มี prompt/secret ✅
- **Authority**: ai-proxy ไม่มี DB write path ใด ๆ (ไม่มี `.rpc()`/insert/order/payment RPC — scan ผ่าน test) ✅

Production-level (runtime จริง — ผลจาก `e2e/g5RuntimeProbe.cjs` วันนี้):

```text
R1_no_auth        → 401 unauthorized                    = ตรง expected
R2..R6            → 200 รับทุก model/task (ไม่มี routing metadata/reject)
สรุป: deployed ai-proxy ยังเป็นรุ่นก่อน G5 → ตรงตาม blocker (ต้อง deploy รุ่นใหม่)
```

## Structured Output (schema validation evidence)

- `parseStructuredOutput` / `parseStructuredListOutput`: malformed JSON, empty response, missing required field, wrong type, invalid enum, array-of-object validation — **ผ่าน test T-G5-09/10/11 ทั้งหมด** (fail-closed: reject → คืน non-AI fallback ไม่มี business mutation)
- ต่อใช้จริงแล้ว: `getMenuRecommendations()` ใช้ validator แทน regex เดิม

## Rate/Usage (D5-02)

- In-memory sliding window **20 ครั้ง/60 วินาที/caller** (per isolate — cold start รีเซ็ต, จงใจ minimal ไม่แตะ schema/queue ของ G8)
- `429 rate_limited` + `retryAfterMs` เมื่อเกิน; usage evidence ผ่าน structured log `{event:'ai_usage', caller: callerKey, task, model, status, attempts}`
- ไม่ต้องใช้ DB migration ใด ๆ (ตรงเงื่อนไข HARD STOP ก่อน migration — ไม่มี schema ใหม่)

## AI Authority (STEP 7)

ยืนยันทุก caller จาก audit (9 จุด): AI output **ไม่สามารถ** เปลี่ยนราคา/confirm payment/modify stock/เปลี่ยน delivery fee/cancel/refund/เปลี่ยน order state/kitchen state/dispatch/delivery ได้โดยตรง

- ai-proxy = read-only advice + guardrail ฝัง server-side เสมอ (client ตัดไม่ได้)
- `aiToolCalling` มีเฉพาะ getter (`get_menu/get_order/get_product/get_reviews/get_categories`) — test บังคับว่าไม่มี mutation tool
- `contentAutomation` publish ผ่าน RPC gate `submit_content_for_approval`/`review_content` เท่านั้น
- order/payment/kitchen mutations ยังผ่าน canonical RPC เท่าเดิม — **ไม่พบ caller ที่ violating → ไม่มี HARD STOP**

## Tests (ตัวเลขจาก test runner จริง)

| Suite | ผล |
|---|---|
| `src/__tests__/aiRouting.test.ts` (T-G5-01..18) | **31/31 passed** |
| Regression `npm test` เต็ม | **42 test files / 398 tests — ทั้งหมด passed** (รวม `AI Model A Configuration` เดิม 2 tests ไม่พัง) |
| `npx tsc --noEmit` | 0 error |
| `npm run lint` (ESLint) | 0 problem |
| `npm run build` (tsc + vite) | success |
| `esbuild` syntax check `ai-proxy` | 0 error |

Test matrix ครอบคลุม: T-G5-01 (valid task), 02 (invalid task), 03 (model), 04 (provider), 05 (primary), 06 (fallback), 07 (timeout), 08 (bounded failure), 09–11 (structured), 12 (rate limit), 13 (duplicate invocation safety), 14 (unauthorized), 15 (secret scan), 16 (authority), 17 (reserved social), 18 (dormant `chatWithToolSupport`)

## Runtime (production verification จริง)

```text
DEPLOYED ai-proxy รุ่น G5   = MISSING (BLOCKED: ไม่มี SUPABASE_ACCESS_TOKEN)
RUNTIME VERIFIED รุ่น G5    = BLOCKED — รอ deploy ก่อน (probe พร้อมรัน: node e2e/g5RuntimeProbe.cjs)
RUNTIME VERIFIED auth 401   = ผ่านจริงบน production แล้ว (R1)
AI traffic ที่ใช้ใน probe     = free model, maxTokens ≤ 20, 2 ครั้ง (minimal)
persistent data ที่สร้าง     = ไม่มี (ไม่มี order/payment/social event ถูกสร้าง)
```

## D5 decisions closure

- **D5-01** Model whitelist: IMPLEMENTED ✅
- **D5-02** Rate/usage counter (minimal): IMPLEMENTED ✅ (ไม่สร้าง G8 architecture)
- **D5-03** `chatWithToolSupport`: KEEP DOCUMENTED ✅ — dormant/fail-safe ยืนยันโดย test (proxy ไม่ forward `tools`; executeToolCall fail-closed; ไม่เปิดใช้อัตโนมัติ)
- **D5-04** `bmb/` stale copy: **DOCUMENTED — DEFERRED CLEANUP** (ไม่แตะ; ตรวจแล้วไม่มีผลต่อ build/test/lint เพราะอยู่นอก `tsconfig include`/`vitest include`)
- **D5-05** Task scope: IMPLEMENTED ตาม actual callers + reserved social tasks = **RESERVED / POLICY-DEFINED** ✅

## G4

```text
G4 = HOLD — EXTERNAL META REVIEW / APPROVAL
G5 does not depend on completing Meta review.
```

## สิ่งที่ต้องทำต่อเพื่อปิด G5 (เมื่อ Owner พร้อม)

1. จัดหา `SUPABASE_ACCESS_TOKEN` (หรือ Owner deploy เอง):
   `$env:SUPABASE_ACCESS_TOKEN = <token>; npx supabase functions deploy ai-proxy --project-ref ivkdfognyiwjcmrhcnwz`
2. รัน: `node e2e/g5RuntimeProbe.cjs` → คาด `G5 RUNTIME PROBE = PASS (6/6)`
3. อัปเดตรายงานนี้: `DEPLOYED = ai-proxy vG5` + `RUNTIME VERIFIED` แล้วปิด gate

**ข้อควรระวัง:** `.env.local` ไม่มีค่า token (และถูกล้าง BOM ระหว่างงานนี้ — deploy ยังติดเพราะไม่มีค่า) — ห้าม commit ค่า token ลง repo