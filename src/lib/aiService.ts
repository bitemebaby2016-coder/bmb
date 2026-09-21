/* ============================================
   AI Chat Service - OpenRouter API Integration
   ============================================ */

import type { Message, Product } from '@/types'
import { supabase } from './supabase'
import { MODEL_A_FALLBACK, resolveModelA } from './aiModels'

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

let conversationHistory: ChatMessage[] = [
  { role: 'system', content: SYSTEM_PROMPT.trim() },
]

/**
 * Perform a single OpenRouter chat completion request with the given model.
 * Throws on any non-OK HTTP status or when the response has no usable content,
 * so the caller can decide whether to fall back to another model.
 */
async function requestCompletion(messages: ChatMessage[], model: string): Promise<string> {
  const { data: proxy, error } = await supabase.functions.invoke('ai-proxy', {
    body: { messages: messages.slice(-11), model, maxTokens: 500 },
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

export async function chatWithAI(userMessage: string): Promise<string> {
  const messages = [...conversationHistory, { role: 'user' as const, content: userMessage }]

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
    const { data: proxy, error } = await supabase.functions.invoke('ai-proxy', {
      body: {
        messages: [
          { role: 'system', content: 'คุณคือ AI Recommendation Engine ที่แนะนำเมนูอาหาร' },
          { role: 'user', content: prompt }
        ],
        model: OPENROUTER_MODEL,
        maxTokens: 300,
      },
    })
    if (error || !proxy || proxy.error) return products.slice(0, 3)
    const content = proxy.data?.choices?.[0]?.message?.content || '[]'
    
    // Parse JSON response
    const jsonMatch = content.match(/\[[\s\S]*\]/)
    if (jsonMatch) {
      const recommended = JSON.parse(jsonMatch[0]) as Array<{ id: string; name: string; reason: string }>
      return recommended
        .map((r: { id: string; name: string; reason: string }) => products.find((p: Product) => p.id === r.id))
        .filter((p: Product | undefined): p is Product => p !== undefined)
        .slice(0, 3)
    }

    return products.filter(p => p.is_available).slice(0, 3)
  } catch (error) {
    console.error('Recommendation API Error:', error)
    const apiModule = await import('@/lib/bmbAdminApi_products')
    return (await apiModule.getProducts())
      .filter(p => p.is_available)
      .slice(0, 3)
  }
}
