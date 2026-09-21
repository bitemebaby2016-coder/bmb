// ============================================
// Bite Me Baby — Advanced AI guardrails (Phase 5 — AI-02 advanced suite)
// Extends the base guardrails with adversarial detection: obfuscation,
// system-role impersonation, indirect injection & multi-step jailbreak shapes.
// ============================================

import { validateUserPrompt, assertReadOnlyTool, AI_TOOLS_READ_ONLY } from './aiGuardrails'

export interface AdversarialVerdict {
  allowed: boolean
  reason: string | null
  signalCount: number
}

const ADVERSARIAL_SIGNALS: Array<{ re: RegExp; reason: string }> = [
  { re: /(base64|b64|rot13|hex decode).*(system|price|stock|order|payment)/i, reason: 'obfuscation' },
  { re: /ign[o0]re all previous/i, reason: 'obfuscated_ignore' },
  { re: /role.?play.*(system|admin|developer)/i, reason: 'role_play' },
  { re: /pretend (you are|to be).*(system|admin)/i, reason: 'role_impersonation' },
  { re: /(say|print|repeat) (the )?(system )?(prompt|instructions)/i, reason: 'prompt_extraction' },
  { re: /ai.?proxy|openrouter|api.?key/i, reason: 'infra_disclosure' },
  { re: /first (do|complete) X then (do|change|confirm) Y.*(price|stock|order)/i, reason: 'multi_step_bypass' },
  { re: /(invisible|hidden|zero.?width|unicode) (char|text)/i, reason: 'encoding_evasion' },
]

/** Advanced scoring: counts how many adversarial signals a prompt triggers. */
export function assessAdversarialPrompt(prompt: string): AdversarialVerdict {
  const hits = ADVERSARIAL_SIGNALS.filter((s) => s.re.test(prompt)).map((s) => s.reason)
  const base = validateUserPrompt(prompt)
  if (!base.allowed) return { allowed: false, reason: `${base.reason} +adv`, signalCount: hits.length + 1 }
  if (hits.length > 0) return { allowed: false, reason: hits[0], signalCount: hits.length }
  return { allowed: true, reason: null, signalCount: 0 }
}

/** Peak tool-plan audit: list every tool call the model could attempt and assert all read-only. */
export function auditToolPlan(toolNames: string[]): { allowed: boolean; rejected: string[] } {
  const rejected = toolNames.filter((t) => !assertReadOnlyTool(t).allowed)
  return { allowed: rejected.length === 0, rejected }
}

export { AI_TOOLS_READ_ONLY }