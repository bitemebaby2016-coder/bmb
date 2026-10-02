# BMB_G5_AI_ROUTING_AUDIT.md

Gate: **G5 — AI MODEL ROUTING**
Phase: **AUDIT ONLY (no implementation in this pass)**
Date: 2026-10-03
Baseline at audit time: `HEAD = origin/main = 2171e83`, `WORKTREE = CLEAN` (verified live).
G4 status unchanged: `HOLD — EXTERNAL META REVIEW / APPROVAL`. Nothing in G4/channel-webhook/social_events was touched during this audit.

---

## 1. Scope of audit

1. AI providers/models/configuration currently in code
2. Every existing AI caller
3. Environment variables / secrets **by NAME ONLY** (values never read/printed)
4. Current model selection logic
5. Fallback behavior
6. Timeout / error behavior
7. Cost/usage controls
8. All callers that could invoke AI
9. Whether any caller can currently use AI output as business authority

---

## 2. Providers & models (verified in code)

Single upstream LLM provider: **OpenRouter** (`https://openrouter.ai/api/v1/chat/completions`, hard-coded in `supabase/functions/ai-proxy/index.ts:17`).

Model registry — `src/lib/aiModels.ts` (single source of truth, per owner directive 2026-10-01):

| Role | Model id | Location |
|---|---|---|
| Primary (Model A) | `qwen/qwen3.7-flash` | `MODEL_A_PRIMARY` |
| Fallback (Model A) | `z-ai/glm-5.3-flash` | `MODEL_A_FALLBACK` |
| Env override | `VITE_OPENROUTER_MODEL` | `resolveModelA()` — admin override |
| Edge default | `qwen/qwen3.7-flash` | `ai-proxy DEFAULT_MODEL` (line 141), synced comment with aiModels.ts |

Auxiliary AI paths (not chat-completion):

| Path | Provider | Where |
|---|---|---|
| STT (voice transcription) | `google/gemini-2.5-flash` via OpenRouter; fallback `whisper-large-v3` via **Groq** (`GROQ_API_KEY`) | `ai-proxy mode=transcribe` (STT_PRIMARY_MODEL, GROQ_STT_URL) |
| TTS | Edge-TTS → Google TTS → Botnoi (`BOTNOI_API_KEY`) — no OpenRouter | `supabase/functions/voice-tts/index.ts` |

---

## 3. Environment variables / secrets (NAMES ONLY)

Client (`VITE_*`, public by design):

- `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`
- `VITE_OPENROUTER_MODEL` — **model id only (public), no key**
- `VITE_VOICE_SERVER_TTS`
- (non-AI: Stripe publishable, Grab/Lineman sandbox, Google Maps, Mapbox)

Server-side (Supabase Edge secrets, set via `supabase secrets set`):

- `OPENROUTER_API_KEY` — used only in `ai-proxy` (`Deno.env.get`)
- `GROQ_API_KEY` — optional STT fallback in `ai-proxy`
- `BOTNOI_API_KEY` — optional TTS fallback in `voice-tts`
- `AUTOMATION_TOKEN` — automation-worker (G8 scope, not AI)
- `CHANNEL_WEBHOOK_APP_SECRET`, `VERIFY_TOKEN` — G4 scope, **not touched**

No `OPENROUTER_API_KEY` or `sk-or-*` value found in `src/` (client uses model id only — SEC-02 holds). Historical `VITE_OPENROUTER_API_KEY` references exist only in **old docs / scratch scripts at root** (e.g. `write_docs_admin.py`, `sec02_check.ps1`, stale `bmb/` doc copies), not in shipped code.

---

## 4. AI callers (complete inventory)

| # | Caller | Entry | Path to LLM |
|---|---|---|---|
| 1 | `src/components/ai/BiteAIChat.tsx` | `chatWithAI()` | ai-proxy |
| 2 | `src/pages/ai/AiChatPage.tsx` | `chatWithAI()` (+memory context) | ai-proxy |
| 3 | `src/lib/aiVoice.ts` (AIVoiceService) | chat via `callOpenRouter()` → ai-proxy (incl. STT `mode=transcribe`); TTS via `voice-tts` | ai-proxy / voice-tts |

---

## 8. Authority audit — can AI output become business authority today?

**No.** Verified code-level:

- `ai-proxy` guardrail: read-only advice only; no authority tools; `tools` param not forwarded (tool path dormant).
- `aiToolCalling.ts`: all 5 tools (`get_menu/get_order/get_product/get_reviews/get_categories`) are **read-only getters**; client-side execution, no writes.
- `contentAutomation.ts`: AI generates drafts only; publishing goes through `submit_content_for_approval` / `review_content` RPC gate (publish only when approved) — AI cannot publish directly.
- Order/payment/kitchen/dispatch mutations go exclusively through canonical RPCs (`transition_order_status`, `record_payment_result`, `confirm_offline_payment`, `compute_delivery_fee_rpc`, etc.). No AI output feeds any mutation path.
- AI memory (`get_ai_memory`/`save_ai_memory`) = preference storage, not authority.

## 9. Security findings (to be addressed/confirmed at G5 implementation)

| # | Finding | Severity | Note |
|---|---|---|---|
| F1 | `ai-proxy` accepts **arbitrary client-supplied `model` id** forwarded to OpenRouter (`payload.model || DEFAULT_MODEL`) | **MEDIUM-HIGH** | Violates "no arbitrary model supplied by untrusted client". Client can steer to expensive/non-free models → cost risk. G5 routing must whitelist model ids server-side per task. |
| F2 | No upstream timeout / retry budget in ai-proxy | MEDIUM | G5 must add timeout + bounded retry; must remain read-only so no duplicate business actions possible. |
| F3 | No rate limiting / usage cap / usage ledger | MEDIUM | Owner decision: minimal per-user rate limit on ai-proxy now, or defer? |
| F4 | No structured output contract (JSON schema/validation) for machine-consumed AI outputs (`getMenuRecommendations` does ad-hoc regex JSON parse with graceful fallback; G6/G7 will need a real contract) | MEDIUM | Required by G5 design before G6 (comment classification/drafts) can build on it. |
| F5 | Streaming path uses same auth/guardrail — acceptable | LOW | Keep. |
| F6 | CORS `*` on ai-proxy — acceptable because JWT/anon-key auth + read-only | LOW | Keep, document. |
| F7 | `bmb/` directory contains a large **untracked stale copy** of the project (only 1 doc file tracked) with old code/docs | LOW (confusion risk) | Recommend owner decide: ignore/delete. Not touched during audit. |
| F8 | `chatWithToolSupport` dormant (proxy drops `tools`) | INFO | Either delete or document as intentionally dormant in G5 contract. |

## 10. G5 required design (proposal, pending Owner confirmation)

A single task-routing module (server-authoritative, in `ai-proxy` or a shared server module):

```text
task ∈ {chat_advice, menu_recommendation, content_draft, social_comment_classify, social_reply_draft, social_post_draft, voice_stt}
→ allowed model ids (server-side whitelist ONLY — closes F1)
→ timeout (explicit AbortSignal)
→ retry policy (bounded, read-only-safe)
→ fallback model
→ structured output contract (validated; malformed → fail-closed friendly error)
→ failure behavior (no fake success, no business mutation ever)
```

AI output stays untrusted intelligence; all mutations remain canonical RPC (unchanged).

## 11. OWNER DECISIONS REQUIRED before G5 implementation

1. **F1 (model whitelist):** enforce a server-side model whitelist per task in `ai-proxy` and reject non-whitelisted `payload.model`? *(Recommended: YES — this is the core of G5.)*
2. **F3 (rate limit/usage control):** implement a minimal per-JWT rate limit / usage counter on `ai-proxy` now, or defer to G8/G10? *(Recommend: minimal counter now, ledger optional.)*
3. **F8 (dormant tool calling):** keep `chatWithToolSupport` dormant (documented) or remove it? *(Recommend: document as dormant, remove if unused by G9.)*
4. **F7 (stale `bmb/` copy):** ignore (default) or request cleanup? *(No action without Owner instruction — out of G5 scope.)*
5. **Task list scope:** confirm the task names in §10 (especially reserving `social_comment_classify` / `social_reply_draft` / `social_post_draft` for G6/G7) so routing is built once, not redesigned per gate.

---

## RESULT

```text
G5 AUDIT = READY / HARD STOP
```

- Audit complete; actual current architecture established above.
- Owner decisions in §11 are **blocking** for G5 implementation per directive.
- No code, no G4 file, no secrets touched in this pass.
- NEXT (after Owner decisions): G5 IMPLEMENT → TEST → RUNTIME VERIFY → EVIDENCE → `BMB_G5_FINAL_REPORT.md` → COMMIT/PUSH → HARD STOP. No G8/G6/G7 start in this execution.

| 4 | `src/lib/aiService.ts → chatWithAIStream()` | widget streaming | ai-proxy (`stream:true`) |
| 5 | `src/lib/aiService.ts → getMenuRecommendations()` | recommendation JSON | ai-proxy |
| 6 | `src/lib/aiToolCalling.ts → chatWithToolSupport()` | tool calling (`tools` param) | ai-proxy — **but ai-proxy does NOT forward `tools`; tool_calls path is dormant (fail-safe)** |
| 7 | `src/lib/contentAutomation.ts` | social post / email / blog / promo drafts via `chatWithAI()` → then `contentApproval` RPC gate (`submit_content_for_approval` → `review_content`, publish only when `approved`) | ai-proxy |
| 8 | `src/pages/admin/AdminAiStudio.tsx` | `chatWithAI()` polish (draft only) | ai-proxy |
| 9 | `src/stores/useBiteAIStore.ts`, `src/lib/aiMemory.ts`, `src/lib/aiServerMemory.ts`, `src/lib/aiDbContext.ts`, `src/lib/aiGuardrails.ts`, `src/lib/aiGuardrailsAdv.ts`, `src/lib/ai/aiContextBuilder.ts` | context/guardrail/memory support layers | DB/RPC/localStorage — no direct LLM |

Non-AI edge functions (`automation-worker`, `create-checkout`, `stripe-webhook`, `stripe-refund`, `phone-auto-login`, `channel-webhook`) contain **no LLM calls** (verified by scan).

---

## 5. Current model selection / routing logic

- **Selection:** client-side, single-purpose. Every caller resolves `resolveModelA(VITE_OPENROUTER_MODEL)` → one primary id; no task-based routing table exists yet. `ai-proxy` additionally accepts a client-supplied `payload.model` (`payload.model || DEFAULT_MODEL`, line 270).
- **Fallback:** primary → one retry with `MODEL_A_FALLBACK` in `chatWithAI`, `chatWithAIStream`, `chatWithToolSupport`, `aiVoice.callOpenRouter`. Voice also degrades server TTS → browser speechSynthesis.
- **Server-side injection:** `ai-proxy` prepends an immutable server-side `GUARDRAIL_SEGMENT` (AI-02: read-only, no price/stock/payment/order authority, prompt-injection resistant) and re-slices to last 10 non-system turns; it keeps all client system messages (DB context / voice directive).
- **Error shape:** non-OK upstream → `{error:'upstream error', upstream_status}` 502; callers convert failures into friendly Thai fallback text — no fake success.

## 6. Timeout / retry behavior

- **No explicit upstream timeout in ai-proxy** — plain `fetch()` to OpenRouter, no `AbortSignal.timeout`, no retry/backoff, no circuit breaker (relies on Edge Function wall-clock). Confirmed at lines ~276 (chat), ~160 (SSE); STT/TTS fetches also unbounded.
- **Client retry = exactly 1 fallback-model attempt** per call (no exponential backoff, no dedup token). Safe today only because all AI calls are **read-only** — retry cannot duplicate business writes since AI output cannot trigger writes.

## 7. Cost / usage controls

- **None found.** No rate limiting, no per-user quota, no usage ledger, no spend cap on `ai-proxy`. Previously recorded as known GAP (`BMB_W3A_AI_GATEWAY_EVIDENCE.md` §16). Free-tier models mitigate but do not remove the risk (OpenRouter quota burn by an authenticated user).
Note: docs (`bmb/BMB_06_*.md`, `BITEMEBABY_PRODUCT_REALITY_MAP.md`) still describe older model chains (`nvidia/nemotron-3-ultra:free`, `glm-5.2:free`). Those are **stale docs**; the live code (`aiModels.ts` 2026-10-01 policy, `ai-proxy` default) is authoritative. → DOC DRIFT, cosmetic.