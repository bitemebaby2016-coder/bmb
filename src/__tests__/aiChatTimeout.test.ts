// ============================================
// Bite Me Baby — Chat-hang regression (launch-closure 2026-10-12)
// ============================================
// ก่อนแก้: ไม่มี timeout/AbortSignal ในสาย chat เลย — ai-proxy/Upstream ค้าง = Promise
// ค้าง = หน้า Talk-to-Bite ค้างถาวร (ปุ่มส่ง disable ตลอดกาล). ชุดนี้พิสูจน์ว่า
// ทุกเส้นทาง "จบ" พร้อม fallback ข้อความไทยภายในเวลาที่กำหนด — ด้วย timeout
// override ขนาดเล็กเพื่อให้รันเร็ว (ค่า production = CHAT_*_TIMEOUT_MS)
// ============================================

import { describe, it, expect, vi, afterEach } from 'vitest'

vi.mock('@/lib/supabase', async () => {
  const { createSupabaseMock } = await import('./helpers/supabaseMock')
  return {
    supabase: createSupabaseMock(),
    supabaseAdmin: null,
    getCurrentUser: async () => null,
    isAdmin: async () => false,
    default: null,
  }
})

import {
  chatWithAI,
  chatWithAIStream,
  resetConversation,
  CHAT_FALLBACK_THAI,
  CHAT_ATTEMPT_TIMEOUT_MS,
  CHAT_TOTAL_TIMEOUT_MS,
} from '@/lib/aiService'
import { MODEL_A_PRIMARY, MODEL_A_FALLBACK } from '@/lib/aiModels'

async function mockInvoke(handler: (body: any) => Promise<{ data: any; error: any }>) {
  const { supabase } = await import('@/lib/supabase')
  ;(supabase as any).__setInvokeHandler('ai-proxy', handler)
}

const hangForever = () => new Promise<{ data: any; error: any }>(() => { /* never settles */ })

describe('Chat-hang guard — chat must always settle', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
    resetConversation()
  })

  it('exports production-safe default budgets', () => {
    expect(CHAT_ATTEMPT_TIMEOUT_MS).toBeGreaterThan(0)
    expect(CHAT_TOTAL_TIMEOUT_MS).toBeGreaterThanOrEqual(CHAT_ATTEMPT_TIMEOUT_MS)
  })

  it('blocking chatWithAI with a hung ai-proxy resolves to the Thai fallback in-budget', async () => {
    await mockInvoke(hangForever)
    const t0 = Date.now()
    const reply = await chatWithAI('สวัสดี', undefined, { attemptTimeoutMs: 60, totalTimeoutMs: 220 })
    const elapsed = Date.now() - t0
    expect(reply).toBe(CHAT_FALLBACK_THAI)
    expect(elapsed).toBeLessThan(1_500)
  })

  it('chatWithAIStream aborts a stalled SSE fetch (AbortSignal fires) and still settles', async () => {
    await mockInvoke(hangForever)
    vi.stubGlobal('fetch', (_url: unknown, init?: { signal?: AbortSignal }) =>
      new Promise((_resolve, reject) => {
        const abort = () => reject(new DOMException('The operation was aborted.', 'AbortError'))
        if (init?.signal?.aborted) abort()
        else init?.signal?.addEventListener('abort', abort)
      }),
    )
    const t0 = Date.now()
    const reply = await chatWithAIStream('สวัสดี', undefined, () => {}, {
      attemptTimeoutMs: 60,
      totalTimeoutMs: 260,
    })
    const elapsed = Date.now() - t0
    expect(reply).toBe(CHAT_FALLBACK_THAI)
    expect(elapsed).toBeLessThan(2_000)
  })

  it('does not slow down or break the healthy path (model A fails once → model B answers)', async () => {
    const modelCalls: string[] = []
    await mockInvoke(async (body: any) => {
      modelCalls.push(body.model)
      if (body.model === MODEL_A_PRIMARY) return { data: null, error: { message: 'upstream 429' } }
      return {
        data: { data: { choices: [{ message: { content: 'ตอบ: ' + body.messages[body.messages.length - 1].content } }] } },
        error: null,
      }
    })
    const reply = await chatWithAI('ทดสอบระบบ', undefined, { attemptTimeoutMs: 1_000, totalTimeoutMs: 3_000 })
    expect(reply).toContain('ทดสอบระบบ')
    expect(modelCalls).toEqual([MODEL_A_PRIMARY, MODEL_A_FALLBACK])
  })
})
