// ============================================
// Bite Me Baby — AI Model A Configuration
// ============================================
// Model A is the primary chat model used by the AI waiter (Bite) and all
// AI-powered features (chat, tool calling, content automation).
//
// Policy (owner directive 2026-10-01, supersedes 2026-09-25):
//   Primary  : Qwen 3.7 Flash            — qwen/qwen3.7-flash            (OpenRouter, ~free)
//   Fallback : Z-AI GLM 5.3 Flash        — z-ai/glm-5.3-flash           (OpenRouter, ~free)
// Both ids verified against https://openrouter.ai/api/v1/models on 2026-10-01.
// If the primary model fails (HTTP error / network / rate limit), the caller
// retries once with the fallback model before returning a friendly error.
// ⚠️ Keep in sync: .env / .env.example (VITE_OPENROUTER_MODEL) and
// supabase/functions/ai-proxy/index.ts (DEFAULT_MODEL).

export const MODEL_A_PRIMARY = 'qwen/qwen3.7-flash'
export const MODEL_A_FALLBACK = 'z-ai/glm-5.3-flash'

/**
 * Resolve the Model A id to use for a request.
 * - `VITE_OPENROUTER_MODEL` (if set in env) is the admin override.
 * - Otherwise default to Qwen 3.7 Flash.
 */
export function resolveModelA(envModel: string | undefined): string {
  return envModel || MODEL_A_PRIMARY
}
