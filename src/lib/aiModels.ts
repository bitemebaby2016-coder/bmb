// ============================================
// Bite Me Baby - AI Model A Configuration
// ============================================
// G5 (STEP 2): this file is the CLIENT-FACING re-export of the canonical
// server-side policy in supabase/functions/_shared/aiPolicy.ts.
// The policy lives in ONE place; the client can only ever receive the
// server-approved model ids and can never extend/override them.
//
// Policy (owner directive 2026-10-01, supersedes 2026-09-25):
//   Primary  : Qwen 3.7 Flash     - qwen/qwen3.7-flash     (OpenRouter, ~free)
//   Fallback : Z-AI GLM 5.3 Flash - z-ai/glm-5.3-flash    (OpenRouter, ~free)
// Both ids verified against https://openrouter.ai/api/v1/models on 2026-10-01.
//
// G5 routing contract (Owner decisions D5-01..D5-05, locked 2026-10-03):
//   client -> task -> server-side task policy -> approved model -> OpenRouter.
//   A client-supplied model id is honoured ONLY when it is already approved
//   by the server policy for that task; any other id is ignored server-side.
//   Keep in sync: .env / .env.example (VITE_OPENROUTER_MODEL) and
//   supabase/functions/ai-proxy/index.ts (DEFAULT_MODEL now = task policy).

export {
  MODEL_A_PRIMARY,
  MODEL_A_FALLBACK,
  TASK_POLICY,
  DEFAULT_TASK,
  resolveTaskPolicy,
  pickModelForTask,
  sanitizeRoutingRequest,
  CLIENT_ROUTING_KEYS,
} from '../../supabase/functions/_shared/aiPolicy.ts'
export type { AiTask, AiTaskPolicy, RoutingDecision, TaskResolution } from '../../supabase/functions/_shared/aiPolicy.ts'

import { MODEL_A_PRIMARY } from '../../supabase/functions/_shared/aiPolicy.ts'

/**
 * Resolve the Model A id to use for a request.
 * - `VITE_OPENROUTER_MODEL` (if set in env) is the admin override.
 * - Otherwise default to Qwen 3.7 Flash.
 * (G5: this value is only a display/compat value - the server policy stays
 * authoritative and ignores any non-approved id.)
 */
export function resolveModelA(envModel: string | undefined): string {
  return envModel || MODEL_A_PRIMARY
}