// ============================================
// Bite Me Baby — G5 AI Routing tests (T-G5-01..T-G5-18)
// Owner decisions D5-01..D5-05. Offline suite — no live AI traffic,
// no production mutations, no secrets.
// ============================================

import { describe, it, expect, vi } from 'vitest'

import proxySrc from '../../supabase/functions/ai-proxy/index.ts?raw'
import aiToolCallingSrc from '../lib/aiToolCalling.ts?raw'
import aiModelsSrc from '../lib/aiModels.ts?raw'
import aiServiceSrc from '../lib/aiService.ts?raw'
import aiVoiceSrc from '../lib/aiVoice.ts?raw'

import {
  MODEL_A_PRIMARY,
  MODEL_A_FALLBACK,
  TASK_POLICY,
  resolveTaskPolicy,
  pickModelForTask,
  sanitizeRoutingRequest,
} from '@/lib/aiModels'
import { SlidingWindowRateLimiter, callerKeyFromToken } from '../../supabase/functions/_shared/aiRateLimit.ts'
import { fetchWithTimeout, TimeoutError } from '../../supabase/functions/_shared/aiTimeout.ts'
import {
  parseStructuredOutput,
  parseStructuredListOutput,
} from '../../supabase/functions/_shared/aiStructuredOutput.ts'

const PROXY_SRC = proxySrc

// ---------- T-G5-01 / T-G5-02: task validation (STEP 3) ----------
describe('T-G5-01/02: task validation (server policy allowlist)', () => {
  it('accepts a valid ACTIVE task with policy', () => {
    const r = resolveTaskPolicy('chat')
    expect(r.ok).toBe(true)
    if (r.ok) expect(r.policy.status).toBe('ACTIVE')
  })

  it('defaults to chat when no task is sent (backward compatible)', () => {
    const r = resolveTaskPolicy(undefined)
    expect(r.ok).toBe(true)
    if (r.ok) expect(r.task).toBe('chat')
  })

  it('rejects an invalid task', () => {
    const r = resolveTaskPolicy('make_me_admin')
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.reason).toBe('invalid_task')
  })
})

// ---------- T-G5-03/04: client model/provider injection (D5-01) ----------
describe('T-G5-03/04: client model/provider injection is neutralised', () => {
  it('ignores a non-whitelisted model id → policy primary is used', () => {
    const d = pickModelForTask('chat', TASK_POLICY.chat, 'openai/gpt-4o')
    expect(d.model).toBe(MODEL_A_PRIMARY)
    expect(d.clientModelAccepted).toBe(false)
  })

  it('accepts only ids already approved by the task policy (compat with client fallback chain)', () => {
    expect(pickModelForTask('chat', TASK_POLICY.chat, MODEL_A_PRIMARY).model).toBe(MODEL_A_PRIMARY)
    expect(pickModelForTask('chat', TASK_POLICY.chat, MODEL_A_FALLBACK).model).toBe(MODEL_A_FALLBACK)
  })

  it('drops model_id / provider / endpoint keys entirely', () => {
    const s = sanitizeRoutingRequest({
      model: 'openai/gpt-4o',
      model_id: 'openai/gpt-4o',
      provider: 'https://evil.example.com',
      endpoint: 'https://evil.example.com/v1',
    })
    expect(s.task).toBeUndefined()
    expect(JSON.stringify(s)).not.toContain('evil.example.com')
  })

  it('provider/endpoint cannot change the upstream URL (policy regression guard)', () => {
    expect(PROXY_SRC).toMatch(/const OPENROUTER_URL = 'https:\/\/openrouter\.ai\/api\/v1\/chat\/completions'/)
    expect(PROXY_SRC).not.toMatch(/payload\.(provider|endpoint)/)
  })
})

// ---------- T-G5-05/06: model selection + fallback policy ----------
describe('T-G5-05/06: server-side model selection + fallback policy', () => {
  it('primary model is selected from server policy (qwen/qwen3.7-flash)', () => {
    expect(MODEL_A_PRIMARY).toBe('qwen/qwen3.7-flash')
    expect(TASK_POLICY.chat.primary).toBe(MODEL_A_PRIMARY)
  })

  it('fallback policy = z-ai/glm-5.3-flash for every general task', () => {
    expect(MODEL_A_FALLBACK).toBe('z-ai/glm-5.3-flash')
    for (const t of ['chat', 'streaming', 'recommendation', 'tool_support', 'content_automation', 'admin_ai', 'support'] as const) {
      expect(TASK_POLICY[t].fallback).toBe(MODEL_A_FALLBACK)
      expect(TASK_POLICY[t].status).toBe('ACTIVE')
    }
  })

  it('every ACTIVE task has a bounded timeout and maxTokens cap', () => {
    for (const [task, p] of Object.entries(TASK_POLICY)) {
      expect(p.timeoutMs, `timeout for ${task}`).toBeGreaterThan(0)
      expect(p.timeoutMs, `timeout for ${task}`).toBeLessThanOrEqual(60_000)
      expect(p.maxTokens, `maxTokens for ${task}`).toBeGreaterThan(0)
      expect(p.maxTokens, `maxTokens for ${task}`).toBeLessThanOrEqual(1000)
    }
  })
})
// ---------- T-G5-07/08: timeout + bounded failure (STEP 4/5) ----------
describe('T-G5-07/08: upstream timeout + bounded failure behavior', () => {
  it('aborts a hung upstream call with TimeoutError (fail-safe)', async () => {
    // stub fetch that honours the AbortSignal (like real fetch) but never resolves
    vi.stubGlobal('fetch', (_u: unknown, init?: RequestInit) =>
      new Promise<Response>((_res, rej) => {
        init?.signal?.addEventListener('abort', () => rej(new Error('The operation was aborted')))
      })
    )
    const t0 = Date.now()
    await expect(
      fetchWithTimeout('http://example.com/never', { method: 'GET' }, 50)
    ).rejects.toBeInstanceOf(TimeoutError)
    expect(Date.now() - t0).toBeLessThan(2000)
    vi.unstubAllGlobals()
  })

  it('passes through a fast upstream response untouched', async () => {
    const fake = new Response('ok', { status: 200 })
    vi.stubGlobal('fetch', vi.fn(async () => fake))
    const r = await fetchWithTimeout('http://example.com', { method: 'GET' }, 1000)
    expect(r.status).toBe(200)
    vi.unstubAllGlobals()
  })

  it('ai-proxy retries the fallback model at most ONCE (bounded, no G8 retry system)', () => {
    expect(PROXY_SRC.match(/const fallbackRes = await callUpstream\(modelUsed\)/g)?.length).toBe(1)
    expect(PROXY_SRC).not.toMatch(/for\s*\(.*attempt/i)
    expect(PROXY_SRC).not.toMatch(/pg_cron|make\.com/i)
  })
})

// ---------- T-G5-09/10/11: structured output contract (STEP 6) ----------
describe('T-G5-09/10/11: structured output validation (fail-closed)', () => {
  const schema = { id: { type: 'string' as const, required: true }, qty: { type: 'number' as const, required: true } }

  it('T-G5-09: malformed JSON / empty response is rejected', () => {
    expect(parseStructuredOutput('', schema).ok).toBe(false)
    expect(parseStructuredOutput('   ', schema).ok).toBe(false)
    expect(parseStructuredOutput('not json at all', schema).ok).toBe(false)
    expect(parseStructuredOutput('{"id": "a", "qty": 1', schema).ok).toBe(false)
    expect(parseStructuredOutput('```json\n{"id":"a","qty":1}\n```', schema).ok).toBe(true)
  })

  it('T-G5-10: missing required field is rejected', () => {
    expect(parseStructuredOutput('{"id": "a"}', schema).ok).toBe(false)
  })

  it('T-G5-11: wrong type / invalid enum is rejected; valid payload accepted', () => {
    expect(parseStructuredOutput('{"id": "a", "qty": "two"}', schema).ok).toBe(false)
    const enumSchema = {
      intent: { type: 'string' as const, required: true, enumValues: ['order', 'question'] },
    }
    expect(parseStructuredOutput('{"intent": "refund_everything"}', enumSchema).ok).toBe(false)
    expect(parseStructuredOutput('{"intent": "question"}', enumSchema).ok).toBe(true)
  })

  it('list outputs are validated per item (recommendation contract)', () => {
    const itemSchema = { id: { type: 'string' as const, required: true }, name: { type: 'string' as const, required: true }, reason: { type: 'string' as const, required: true } }
    expect(parseStructuredListOutput('[{"id":"p1","name":"ขนมครก","reason":"popular"}]', itemSchema).ok).toBe(true)
    expect(parseStructuredListOutput('[{"id":1,"name":"ขนมครก","reason":"popular"}]', itemSchema).ok).toBe(false)
    expect(parseStructuredListOutput('[{"id":"p1","name":"ขนมครก"}]', itemSchema).ok).toBe(false)
    expect(parseStructuredListOutput('{"id":"p1"}', itemSchema).ok).toBe(false)
  })
})

// ---------- T-G5-12/13: rate limit / usage control + duplicate safety ----------
describe('T-G5-12/13: rate limit / usage counter (D5-02) + duplicate invocation safety', () => {
  it('allows calls up to the limit then rejects with retryAfterMs', () => {
    const limiter = new SlidingWindowRateLimiter(3, 60_000)
    expect(limiter.hit('c1').allowed).toBe(true)
    expect(limiter.hit('c1').allowed).toBe(true)
    const third = limiter.hit('c1')
    expect(third.allowed).toBe(true)
    expect(third.remaining).toBe(0)
    const fourth = limiter.hit('c1')
    expect(fourth.allowed).toBe(false)
    expect(fourth.resetMs ?? 0).toBeGreaterThanOrEqual(0)
  })

  it('buckets callers independently and never stores raw tokens', () => {
    const limiter = new SlidingWindowRateLimiter(1, 60_000)
    expect(limiter.hit('caller-a').allowed).toBe(true)
    expect(limiter.hit('caller-b').allowed).toBe(true)
    expect(limiter.hit('caller-a').allowed).toBe(false)
    const key = callerKeyFromToken('sk-or-VERY-SECRET-TOKEN-VALUE')
    expect(key).not.toContain('sk-or-')
    expect(key.startsWith('caller-')).toBe(true)
  })

  it('duplicate invocation: inference is read-only — repeated calls cannot duplicate business state', () => {
    expect(PROXY_SRC).not.toMatch(/supabase\.from\(|\.rpc\(|SUPABASE_SERVICE_ROLE_KEY/)
    expect(PROXY_SRC).not.toMatch(/create_order|record_payment|transition_order/i)
  })
})
// ---------- T-G5-14: authorization boundary ----------
describe('T-G5-14: unauthorized caller is rejected by the gateway', () => {
  it('ai-proxy enforces bearer auth and never forwards client routing keys unfiltered', () => {
    expect(PROXY_SRC).toMatch(/return json\(\{ error: 'unauthorized' \}, 401\)/)
    expect(PROXY_SRC).toMatch(/sanitizeRoutingRequest\(payload\)/)
    expect(PROXY_SRC).toMatch(/resolveTaskPolicy\(routingInput\.task\)/)
    expect(PROXY_SRC).toMatch(/pickModelForTask\(resolved\.task, policy, routingInput\.model\)/)
  })
})

// ---------- T-G5-15: secret exposure scan ----------
describe('T-G5-15: secret exposure scan', () => {
  it('no OpenRouter secret value or sk-or- key in AI source files', () => {
    expect(PROXY_SRC).not.toMatch(/sk-or-[A-Za-z0-9_-]{8,}/)
    for (const [rel, src] of [
      ['lib/aiModels.ts', aiModelsSrc],
      ['lib/aiService.ts', aiServiceSrc],
      ['lib/aiVoice.ts', aiVoiceSrc],
      ['lib/aiToolCalling.ts', aiToolCallingSrc],
    ] as const) {
      expect(src, rel).not.toMatch(/sk-or-[A-Za-z0-9_-]{8,}/)
      expect(src, rel).not.toMatch(/OPENROUTER_API_KEY/)
      expect(src, rel).not.toMatch(/GROQ_API_KEY|BOTNOI_API_KEY/)
    }
  })

  it('rate-limit usage evidence contains no secrets and no prompt content', () => {
    for (const line of PROXY_SRC.match(/console\.log\(JSON\.stringify\(\{[^}]*\}\)\)/g) ?? []) {
      expect(line).not.toMatch(/apiKey|token|messages|content|prompt/)
    }
  })
})

// ---------- T-G5-16: AI authority boundary (STEP 7) ----------
describe('T-G5-16: AI output is never business authority', () => {
  it('all tool-calling tools are read-only getters (source-level contract)', () => {
    const toolNames = [...aiToolCallingSrc.matchAll(/name:\s*'([a-z_]+)'/g)].map((m) => m[1])
    expect(toolNames.length).toBeGreaterThanOrEqual(5)
    for (const n of toolNames) expect(n.startsWith('get_'), `${n} must be a getter`).toBe(true)
    // no write-shaped tool may exist anywhere in the file
    expect(aiToolCallingSrc).not.toMatch(/create_order|update_order|delete_|transition_|record_payment|refund/)
  })

  it('no mutation tool is reachable via executeToolCall', async () => {
    const { executeToolCall } = await import('@/lib/aiToolCalling')
    const mutationNames = [
      'transition_order_status', 'record_payment_result', 'confirm_offline_payment',
      'mark_payment_failed', 'compute_delivery_fee_rpc', 'cancel_order', 'refund_order',
      'create_order', 'assign_driver', 'complete_delivery',
    ]
    for (const name of mutationNames) {
      const r = await executeToolCall(name, {})
      expect(r.success, `${name} must not execute`).toBe(false)
    }
  })
})

// ---------- T-G5-17: reserved social tasks stay dormant (D5-05) ----------
describe('T-G5-17: reserved social tasks are policy-defined but NOT executable', () => {
  it('all three social tasks are RESERVED in policy', () => {
    for (const t of ['social_comment_classify', 'social_reply_draft', 'social_post_draft'] as const) {
      expect(TASK_POLICY[t].status).toBe('RESERVED')
    }
  })

  it('resolveTaskPolicy refuses to execute a reserved task', () => {
    const r = resolveTaskPolicy('social_reply_draft')
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.reason).toBe('reserved_task')
  })

  it('ai-proxy maps reserved_task to a 400 rejection (no social execution in G5)', () => {
    expect(PROXY_SRC).toMatch(/task_reserved_not_active/)
  })
})

// ---------- T-G5-18: dormant chatWithToolSupport stays fail-safe (D5-03) ----------
describe('T-G5-18: chatWithToolSupport remains dormant / fail-safe (D5-03)', () => {
  it('ai-proxy does NOT forward the tools param to OpenRouter (dormant by construction)', () => {
    expect(PROXY_SRC).not.toMatch(/tools:\s|tool_choice/)
  })

  it('client-side tool execution fails closed on unknown tools', async () => {
    const { executeToolCall } = await import('@/lib/aiToolCalling')
    const r = await executeToolCall('nonexistent_tool', {})
    expect(r.success).toBe(false)
    expect((r as { error?: string }).error).toMatch(/Unknown tool/)
  })

  it('chatWithToolSupport returns a friendly failure when the gateway errors', async () => {
    vi.doMock('@/lib/supabase', () => ({
      supabase: {
        functions: {
          invoke: vi.fn(async () => ({ data: null, error: { message: 'upstream 429' } })),
        },
      },
    }))
    vi.resetModules()
    const { chatWithToolSupport } = await import('@/lib/aiToolCalling')
    const res = await chatWithToolSupport('สวัสดี', [])
    expect(res.response).toContain('ขอโทษ')
    expect(res.toolCalls).toEqual([])
    vi.doUnmock('@/lib/supabase')
    vi.resetModules()
  })
})