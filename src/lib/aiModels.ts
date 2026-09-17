// ============================================
// Bite Me Baby — AI Model A Configuration
// ============================================
// Model A is the primary chat model used by the AI waiter (Bite) and all
// AI-powered features (chat, tool calling, content automation).
//
// Policy (owner directive 2026-09-17):
//   Primary  : GLM 5.2 (free)   — z-ai/glm-5.2:free   (OpenRouter, $0)
//   Fallback : Qwen 3.7 Flash   — qwen/qwen3.7-flash  (OpenRouter, ~free)
// If the primary model fails (HTTP error / network / rate limit), the caller
// retries once with the fallback model before returning a friendly error.

export const MODEL_A_PRIMARY = 'z-ai/glm-5.2:free'
export const MODEL_A_FALLBACK = 'qwen/qwen3.7-flash'

/**
 * Resolve the Model A id to use for a request.
 * - `VITE_OPENROUTER_MODEL` (if set in env) is the admin override.
 * - Otherwise default to GLM 5.2 (free).
 */
export function resolveModelA(envModel: string | undefined): string {
  return envModel || MODEL_A_PRIMARY
}
