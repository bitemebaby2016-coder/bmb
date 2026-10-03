// ============================================
// Bite Me Baby — AI Routing Policy (G5, D5-01/D5-05)
// ============================================
// SERVER-SIDE single source of truth for task → model policy.
// Imported by:
//   - supabase/functions/ai-proxy/index.ts (Deno, runtime enforcement)
//   - src/lib/aiModels.ts (re-export so the client can only ever see the
//     server-approved ids — the client can NEVER extend this list)
//
// Policy (owner directive 2026-10-01 + G5 owner decisions 2026-10-03):
//   Primary  : qwen/qwen3.7-flash      (OpenRouter, ~free)
//   Fallback : z-ai/glm-5.3-flash      (OpenRouter, ~free)
//
// Rules locked by Owner (D5-01):
//   - A client-supplied model id is accepted ONLY if it equals a model that
//     this policy already approves for the task (primary or fallback).
//     Any other id is IGNORED → the task policy primary is used instead.
//   - Client-supplied `model_id` / `provider` / `endpoint` keys are ignored
//     unconditionally (no provider/endpoint override exists anywhere).
//   - Only ACTIVE tasks may be executed. RESERVED tasks are policy-defined
//     for G6/G7 but MUST NOT be executed by ai-proxy in G5.

export const MODEL_A_PRIMARY = 'qwen/qwen3.7-flash'
export const MODEL_A_FALLBACK = 'z-ai/glm-5.3-flash'

export type AiTask =
  | 'chat'
  | 'streaming'
  | 'recommendation'
  | 'voice_stt'
  | 'tool_support'
  | 'content_automation'
  | 'admin_ai'
  | 'support'
  // G5: RESERVED / POLICY-DEFINED — no social execution in G5 (D5-05)
  | 'social_comment_classify'
  | 'social_reply_draft'
  | 'social_post_draft'

export interface AiTaskPolicy {
  primary: string
  fallback: string
  /** Hard cap for max_tokens on this task — client maxTokens is clamped. */
  maxTokens: number
  /** Upstream timeout (ms) — fail-safe, no business mutation is ever possible. */
  timeoutMs: number
  /** ACTIVE = executable now · RESERVED = policy-defined only (G6/G7). */
  status: 'ACTIVE' | 'RESERVED'
}

export const TASK_POLICY: Record<AiTask, AiTaskPolicy> = {
  chat: { primary: MODEL_A_PRIMARY, fallback: MODEL_A_FALLBACK, maxTokens: 700, timeoutMs: 30_000, status: 'ACTIVE' },
  streaming: { primary: MODEL_A_PRIMARY, fallback: MODEL_A_FALLBACK, maxTokens: 700, timeoutMs: 45_000, status: 'ACTIVE' },
  recommendation: { primary: MODEL_A_PRIMARY, fallback: MODEL_A_FALLBACK, maxTokens: 300, timeoutMs: 30_000, status: 'ACTIVE' },
  voice_stt: { primary: 'google/gemini-2.5-flash', fallback: 'whisper-large-v3 (Groq)', maxTokens: 300, timeoutMs: 60_000, status: 'ACTIVE' },
  tool_support: { primary: MODEL_A_PRIMARY, fallback: MODEL_A_FALLBACK, maxTokens: 1000, timeoutMs: 30_000, status: 'ACTIVE' },
  content_automation: { primary: MODEL_A_PRIMARY, fallback: MODEL_A_FALLBACK, maxTokens: 700, timeoutMs: 60_000, status: 'ACTIVE' },
  admin_ai: { primary: MODEL_A_PRIMARY, fallback: MODEL_A_FALLBACK, maxTokens: 700, timeoutMs: 30_000, status: 'ACTIVE' },
  support: { primary: MODEL_A_PRIMARY, fallback: MODEL_A_FALLBACK, maxTokens: 700, timeoutMs: 30_000, status: 'ACTIVE' },
  social_comment_classify: { primary: MODEL_A_PRIMARY, fallback: MODEL_A_FALLBACK, maxTokens: 300, timeoutMs: 30_000, status: 'RESERVED' },
  social_reply_draft: { primary: MODEL_A_PRIMARY, fallback: MODEL_A_FALLBACK, maxTokens: 500, timeoutMs: 30_000, status: 'RESERVED' },
  social_post_draft: { primary: MODEL_A_PRIMARY, fallback: MODEL_A_FALLBACK, maxTokens: 700, timeoutMs: 60_000, status: 'RESERVED' },
}

export const DEFAULT_TASK: AiTask = 'chat'

export type TaskResolution =
  | { ok: true; task: AiTask; policy: AiTaskPolicy }
  | { ok: false; reason: 'invalid_task' | 'reserved_task' }

/** Server-side task validation (STEP 3): unknown task → invalid_task, reserved → reserved_task. */
export function resolveTaskPolicy(task: unknown): TaskResolution {
  const t = typeof task === 'string' ? task.trim() : ''
  if (!t) return { ok: true, task: DEFAULT_TASK, policy: TASK_POLICY[DEFAULT_TASK] }
  const policy = (TASK_POLICY as Record<string, AiTaskPolicy | undefined>)[t]
  if (!policy) return { ok: false, reason: 'invalid_task' }
  if (policy.status !== 'ACTIVE') return { ok: false, reason: 'reserved_task' }
  return { ok: true, task: t as AiTask, policy }
}

export interface RoutingDecision {
  task: AiTask
  model: string
  /** true = the client-supplied id was an approved model for this task */
  clientModelAccepted: boolean
}

/**
 * STEP 1 (D5-01): choose the model SERVER-SIDE.
 * A client-supplied id passes only when it is already approved by the task
 * policy; every other id (or provider/endpoint-shaped keys) is ignored and
 * the policy primary is used. There is NO path to extend the whitelist.
 */
export function pickModelForTask(task: AiTask, policy: AiTaskPolicy, requestedModel: unknown): RoutingDecision {
  const accepted =
    typeof requestedModel === 'string' &&
    (requestedModel === policy.primary || requestedModel === policy.fallback)
  return {
    task,
    model: accepted && typeof requestedModel === 'string' ? requestedModel : policy.primary,
    clientModelAccepted: accepted,
  }
}

/**
 * STEP 9: strip every client-supplied routing key. `model` is resolved through
 * the whitelist; `model_id` / `provider` / `endpoint` are dead keys — this
 * helper makes that explicit and unit-testable.
 */
export function sanitizeRoutingRequest(payload: {
  model?: unknown
  model_id?: unknown
  provider?: unknown
  endpoint?: unknown
  task?: unknown
}): { task: unknown; model: unknown } {
  void payload.model_id
  void payload.provider
  void payload.endpoint
  return { task: payload.task, model: payload.model }
}

/** Keys a client may influence — everything else (incl. provider/endpoint) is ignored. */
export const CLIENT_ROUTING_KEYS = ['task', 'model'] as const
