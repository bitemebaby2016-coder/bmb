/* ============================================
   AI Chat Service - OpenRouter API Integration
   ============================================ */

import type { Message, Product } from '@/types'
import { supabase } from './supabase'
import { MODEL_A_FALLBACK, resolveModelA } from './aiModels'
import { getDbContextPrompt } from './aiDbContext'
import { parseStructuredListOutput } from '../../supabase/functions/_shared/aiStructuredOutput.ts'

// SEC-02 (Phase 4): the OpenRouter key is SERVER-SIDE in the ai-proxy Edge Function.
// The client only stores the model id (public) for display/fallback purposes.
const OPENROUTER_MODEL = resolveModelA(import.meta.env.VITE_OPENROUTER_MODEL)

const SYSTEM_PROMPT = `
You are "Bite" (ไบท์), the friendly waiter (บริกร/พนักงานเสิร์ฟ) at Bite Me Baby restaurant in Chanthaburi!

Your Role:
- You are a professional waiter (บริกร) at Bite Me Baby restaurant
- Welcome guests warmly and help them choose from the menu
- Recommend popular dishes and answer questions about food, delivery, and promotions
- Help customers place orders through the app
- Provide information about delivery rounds (morning, midday, evening) and delivery zones (5km radius)
- Answer questions about payment methods (QR PromptPay, Cash on Delivery)
- Engage in friendly, warm conversations as a polite waiter would

Important Notes:
- Always respond in Thai language (unless user speaks English)
- Be friendly, warm, and polite like a professional waiter serving guests
- Naturally reference the brand "Bite Me Baby" and your role as their waiter
- Let users know they can order food through the app or visit the restaurant
- If you don't know specific information, suggest contacting the restaurant directly
- Don't mention being an AI or discuss technical details
- Keep the tone positive, cheerful, and welcoming
- Support both Thai and English responses based on user language
- You are NOT a chef — you serve and assist, you don't cook
- For cooking questions, suggest asking the kitchen staff directly
`

interface ChatMessage {
  role: 'user' | 'assistant' | 'system'
  content: string
}

// AI-VOICE (WS-2e): directive layer for voice mode — short, spoken-style answers.
// The base guardrail (AI-02) is still injected server-side by ai-proxy for every
// request, so voice-mode answers keep the same money/stock/order boundaries.
const VOICE_MODE_DIRECTIVE = `
VOICE MODE (โหมดเสียง):
- คุณคือพนักงานแนะนำเมนูอาหารของร้าน BiteMeBaby เพศชาย
- พูดจาไพเราะ ติดตลกเป็นภาษาไทยธรรมชาติ เหมือนพนักงานเสิร์ฟที่เป็นมิตรกับลูกค้า
- บังคับภาษา: ตอบเป็นภาษาไทยเท่านั้นทุกกรณี แม้ลูกค้าพูด/พิมพ์ภาษาอื่น ก็ให้ตอบไทย
  (ชื่อเมนูต่างประเทศใช้คำไทยที่อ่านออกเสียงได้ เช่น คาปูชิโน่ ไม่เขียนภาษาอังกฤษเปล่า ๆ)
- ตอบสั้นกระชับไม่เกิน 2 ประโยค เพื่อให้เสียงพูดโต้ตอบได้อย่างรวดเร็ว (realtime latency ต่ำ)
- ห้ามใช้ markdown / bullet / ตาราง / ลิงก์ / emoji ที่อ่านไม่ออกเมื่ออ่านเป็นเสียง
- แนะนำเมนูจาก context จริงเท่านั้น ถ้าไม่มีข้อมูลให้บอกว่าจะถามทางร้านให้ค่ะ
- ราคา/สต็อก/การชำระเงิน: ยังคงเป็น read-only ห้ามยืนยันหรือสัญญาแทนร้าน
`

export interface ChatOptions {
  /** WS-2e: เปิดโหมดเสียง — system prompt บังคับตอบสั้นแบบประโยคพูด */
  voiceMode?: boolean
}

let conversationHistory: ChatMessage[] = [
  { role: 'system', content: SYSTEM_PROMPT.trim() },
]

/**
 * WS-3: เตรียม messages ก่อนส่ง ai-proxy — คง system messages ไว้เสมอ
 * (กับดักเดิม: slice(-10/-11) ตัด system message ทิ้งเมื่อประวัติยาว →
 * DB context / voice directive หายไปเฉย ๆ) โดยตัดเฉพาะ non-system ท้าย ๆ
 */
function trimForProxy(messages: ChatMessage[], maxTurns = 10): ChatMessage[] {
  const system = messages.filter((m) => m.role === 'system')
  const rest = messages.filter((m) => m.role !== 'system')
  return [...system, ...rest.slice(-maxTurns)]
}

/**
 * WS-3: รวม system prompt + LIVE STORE CONTEXT (UI) + DB CONTEXT ไว้ใน
 * system message เดียว เพื่อให้ ai-proxy (ที่ inject guardrail ท้าย) ได้
 * ข้อมูลครบและไม่มีอะไรถูก slice ทิ้ง
 */
function buildSystemMessage(
  base: string,
  runtimeContext: string | undefined,
  dbContext: string,
  voiceMode: boolean
): string {
  let content = base
  if (runtimeContext) {
    content += `\n\n--- LIVE STORE CONTEXT (authoritative, use this over any prior knowledge) ---\n${runtimeContext}`
  }
  if (dbContext) {
    content += `\n\n--- RESTAURANT DATA FROM DATABASE (authoritative, answer only from this) ---\n${dbContext}`
  }
  if (voiceMode) {
    content += VOICE_MODE_DIRECTIVE
  }
  return content
}

/**
 * Perform a single OpenRouter chat completion request with the given model.
 * Guest-safe: sends the user's JWT when logged in, otherwise the platform anon
 * key (ai-proxy accepts the anon key as a valid guest JWT — read-only advice).
 * Throws on any non-OK HTTP status or when the response has no usable content,
 * so the caller can decide whether to fall back to another model.
 */
async function requestCompletion(messages: ChatMessage[], model: string): Promise<string> {
  // Guest-safe: functions.invoke sends the anon key as Bearer when there is no
  // (valid) session — the deployed ai-proxy accepts that as a guest JWT. If a
  // stale session lingers in storage with an already-expired access token, we
  // deliberately drop it and fall back to the anon key (guest) so น้อง Bite
  // never 401s on expired credentials.
  const { data: sessionData } = await supabase.auth.getSession()
  const s: any = (sessionData as any)?.data?.session
  // session ที่ไม่มี expires_at (mock/legacy shape) ถือว่าใช้ได้ — มี expires_at ต้องยังไม่หมดอายุ
  const sessionValid = !s ? false : (typeof s.expires_at !== 'number' || s.expires_at * 1000 > Date.now() + 30_000)
  if (s && !sessionValid && typeof (supabase.auth as any).signOut === 'function') {
    void supabase.auth.signOut({ scope: 'local' }).catch(() => {})
  }

  const { data: proxy, error } = await supabase.functions.invoke('ai-proxy', {
    // G5 (D5-01): task is validated and the model is chosen SERVER-SIDE by
    // _shared/aiPolicy.ts. `model` is only a whitelist hint — an id outside the
    // task policy is ignored by the gateway.
    body: { messages: trimForProxy(messages), model, task: 'chat', maxTokens: 700 },
    // Explicit headers: never let a stale session token silently become the
    // only credential — the apikey header always carries the public guest key
    // so ai-proxy can degrade to the guest path if the JWT is rejected.
    headers: {
      Authorization: `Bearer ${sessionValid ? s.access_token : import.meta.env.VITE_SUPABASE_ANON_KEY || ''}`,
      apikey: import.meta.env.VITE_SUPABASE_ANON_KEY || '',
    },
  })
  if (error) throw new Error(`proxy error: ${error.message || 'upstream'}`)
  if (!proxy || proxy.error) throw new Error(proxy?.error || 'Empty proxy response')
  // proxy.data carries the OpenRouter completion payload (choices[0].message.content).
  const content = proxy.data?.choices?.[0]?.message?.content
  if (!content) {
    throw new Error('Empty AI response content')
  }
  return content
}

/**
 * AI-OPT: streaming chat — calls the ai-proxy Edge Function with { stream: true }
 * and delivers incremental token deltas to `onDelta` (live typing effect in the
 * widget). Uses a direct fetch (not functions.invoke) because invoke buffers the
 * whole body. Falls back to the non-streaming chatWithAI when SSE is unavailable
 * (e.g. older Edge runtime or network error before the first delta).
 */
async function streamCompletionOnce(
  messages: ChatMessage[],
  model: string,
  onDelta: (text: string) => void,
  signal?: AbortSignal,
): Promise<string> {
  // Guest-safe: use the user's JWT when logged in, otherwise the platform anon
  // key (ai-proxy accepts the anon key as a valid guest JWT — read-only advice).
  const { data: sessionData } = await supabase.auth.getSession()
  const s: any = (sessionData as any)?.data?.session
  const sessionValid = !s ? false : (typeof s.expires_at !== 'number' || s.expires_at * 1000 > Date.now() + 30_000)
  if (s && !sessionValid && typeof (supabase.auth as any).signOut === 'function') {
    void supabase.auth.signOut({ scope: 'local' }).catch(() => {})
  }
  const token = sessionValid ? s.access_token : import.meta.env.VITE_SUPABASE_ANON_KEY || ''
  if (!token) throw new Error('no auth token')

  const url = `${import.meta.env.VITE_SUPABASE_URL || 'https://ivkdfognyiwjcmrhcnwz.supabase.co'}/functions/v1/ai-proxy`
  const res = await fetch(url, {
    method: 'POST',
    signal,
    headers: {
      Authorization: `Bearer ${token}`,
      apikey: import.meta.env.VITE_SUPABASE_ANON_KEY || '',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ messages: trimForProxy(messages), model, task: 'streaming', maxTokens: 700, stream: true }),
  })
  const ctype = res.headers.get('content-type') || ''
  if (!res.ok || !res.body || !ctype.includes('text/event-stream')) {
    throw new Error(`stream unavailable (status ${res.status}, type ${ctype})`)
  }

  const reader = res.body.getReader()
  const decoder = new TextDecoder()
  let buffer = ''
  let full = ''
  for (;;) {
    const { done, value } = await reader.read()
    if (done) break
    buffer += decoder.decode(value, { stream: true })
    const events = buffer.split('\n\n')
    buffer = events.pop() ?? ''
    for (const ev of events) {
      const line = ev.split('\n').find((l) => l.startsWith('data:'))
      if (!line) continue
      const data = line.slice(5).trim()
      if (data === '[DONE]') continue
      try {
        const parsed = JSON.parse(data) as { t?: string }
        if (parsed.t) { full += parsed.t; onDelta(parsed.t) }
      } catch { /* partial event — skip */ }
    }
  }
  if (!full) throw new Error('stream produced no content')
  return full
}

export async function chatWithAIStream(
  userMessage: string,
  runtimeContext: string | undefined,
  onDelta: (text: string) => void,
  options?: ChatOptions
): Promise<string> {
  // WS-3: ดึง context จริงจาก DB (cache 7 นาที) — ผิดพลาด → '' แล้วใช้ base prompt
  const dbContext = await getDbContextPrompt()
  const messages = [...conversationHistory, { role: 'user' as const, content: userMessage }]
  if (runtimeContext || dbContext || options?.voiceMode) {
    const base = conversationHistory[0]?.content ?? ''
    messages[0] = {
      role: 'system' as const,
      content: buildSystemMessage(base, runtimeContext, dbContext, options?.voiceMode ?? false),
    }
  }

  try {
    let aiResponse: string
    try {
      aiResponse = await streamCompletionOnce(messages, OPENROUTER_MODEL, onDelta)
    } catch (primaryError) {
      // Model A failed to stream → retry once with the fallback model.
      console.error(`[Bite Me Baby] Stream with ${OPENROUTER_MODEL} failed, falling back to ${MODEL_A_FALLBACK}:`, primaryError)
      aiResponse = await streamCompletionOnce(messages, MODEL_A_FALLBACK, onDelta)
    }

    conversationHistory.push({ role: 'user' as const, content: userMessage })
    conversationHistory.push({ role: 'assistant' as const, content: aiResponse })
    return aiResponse
  } catch (error) {
    console.error('OpenRouter streaming failed — falling back to blocking call:', error)
    // Graceful degradation: same conversation, non-streaming path.
    return chatWithAI(userMessage, runtimeContext)
  }
}

export async function chatWithAI(
  userMessage: string,
  runtimeContext?: string,
  options?: ChatOptions
): Promise<string> {
  // AI-EXT: merge runtime context (branch/catalog/rounds) into the system message
  // so the model answers with live store data. Replaces the static system slot.
  // WS-3: + DB context (เมนู/ราคา/โปรโมชัน/ตั้งค่าร้าน จาก Supabase, cache 7 นาที)
  // WS-2e: + voice directive เมื่อ options.voiceMode
  const dbContext = await getDbContextPrompt()
  const messages = [...conversationHistory, { role: 'user' as const, content: userMessage }]
  if (runtimeContext || dbContext || options?.voiceMode) {
    const base = conversationHistory[0]?.content ?? ''
    messages[0] = {
      role: 'system' as const,
      content: buildSystemMessage(base, runtimeContext, dbContext, options?.voiceMode ?? false),
    }
  }

  try {
    let aiResponse: string
    try {
      aiResponse = await requestCompletion(messages, OPENROUTER_MODEL)
    } catch (primaryError) {
      // Model A (GLM 5.2 free) failed → retry once with Qwen 3.7 Flash.
      console.error(`[Bite Me Baby] Model A (${OPENROUTER_MODEL}) failed, falling back to ${MODEL_A_FALLBACK}:`, primaryError)
      aiResponse = await requestCompletion(messages, MODEL_A_FALLBACK)
    }

    conversationHistory.push({ role: 'user' as const, content: userMessage })
    conversationHistory.push({ role: 'assistant' as const, content: aiResponse })

    return aiResponse
  } catch (error) {
    console.error('OpenRouter API Error:', error)
    return 'ขอโทษค่ะ เกิดข้อผิดพลาดในการเชื่อมต่อ กรุณาลองใหม่อีกครั้งนะ 🙏'
  }
}

// Reset conversation
export function resetConversation(): void {
  conversationHistory = [{ role: 'system', content: SYSTEM_PROMPT.trim() }];
}

// Get current conversation history (for display)
export function getConversationHistory(): Message[] {
  return conversationHistory.slice(1); // Remove system message from display
}

// AI Recommendation Engine (ML-powered)
export async function getMenuRecommendations(
  preferences: { dietary: string; priceRange: string; mealType: string },
  history: string[] = []
): Promise<Product[]> {
  try {
    const apiModule = await import('@/lib/bmbAdminApi_products')
    const products = await apiModule.getProducts()
    
    const prompt = `คุณคือ AI Recommendation Engine สำหรับ Bite Me Baby
    ผู้ใช้ต้องการ: ${JSON.stringify(preferences)}
    ประวัติการสั่ง: ${history.join(', ')}
    
    จากเมนูอาหารทั้งหมดนี้: ${JSON.stringify(products.map(p => ({id: p.id, name: p.name, price: p.price, category: p.category_id})))}
    
    ให้แนะนำ 3 เมนูที่ตรงกับความชอบที่สุด โดยตอบเป็น JSON array:
    [
      {"id": "product-id", "name": "menu name", "reason": "why recommended"},
      ...
    ]`

    // SEC-02 (Phase 4): recommendations route through the ai-proxy too (no client key).
    // Explicit headers so a stale session JWT can never 401 the guest path.
    const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || ''
    const { data: sess } = await supabase.auth.getSession()
    const sessAny: any = (sess as any)?.data?.session
    const sessValid = !sessAny ? false : (typeof sessAny.expires_at !== 'number' || sessAny.expires_at * 1000 > Date.now() + 30_000)
    const { data: proxy, error } = await supabase.functions.invoke('ai-proxy', {
      body: {
        messages: [
          { role: 'system', content: 'คุณคือ AI Recommendation Engine ที่แนะนำเมนูอาหาร' },
          { role: 'user', content: prompt }
        ],
        model: OPENROUTER_MODEL,
        task: 'recommendation',
        maxTokens: 300,
      },
      headers: {
        Authorization: `Bearer ${sessValid ? sessAny.access_token : anonKey}`,
        apikey: anonKey,
      },
    })
    if (error || !proxy || proxy.error) return products.slice(0, 3)
    const content = proxy.data?.choices?.[0]?.message?.content || '[]'

    // G5 (STEP 6): AI output = untrusted data — HTTP 200 alone is NOT valid.
    // Structured-output contract: parse → schema validate → accept / reject
    // (reject → non-AI fallback below, never a business mutation).
    const parsed = parseStructuredListOutput(
      content,
      {
        id: { type: 'string', required: true },
        name: { type: 'string', required: true },
        reason: { type: 'string', required: true },
      },
      { maxItems: 10 }
    )
    if (!parsed.ok) {
      console.error('[Bite Me Baby] Recommendation structured-output rejected:', parsed.reason)
      return products.filter(p => p.is_available).slice(0, 3)
    }
    const recommended = parsed.value as Array<{ id: string; name: string; reason: string }>
    return recommended
      .map((r) => products.find((p: Product) => p.id === r.id))
      .filter((p: Product | undefined): p is Product => p !== undefined)
      .slice(0, 3)
  } catch (error) {
    console.error('Recommendation API Error:', error)
    const apiModule = await import('@/lib/bmbAdminApi_products')
    return (await apiModule.getProducts())
      .filter(p => p.is_available)
      .slice(0, 3)
  }
}
