/* ============================================
   AI Chat Service - OpenRouter API Integration
   ============================================ */

import type { Message, Product } from '@/types'

const OPENROUTER_API_KEY = import.meta.env.VITE_OPENROUTER_API_KEY
const OPENROUTER_API_URL = 'https://openrouter.ai/api/v1/chat/completions'
const OPENROUTER_MODEL = import.meta.env.VITE_OPENROUTER_MODEL || 'qwen/qwen3.7-flash'

if (!OPENROUTER_API_KEY) {
  console.error(
    '[Bite Me Baby] ⛔ VITE_OPENROUTER_API_KEY is REQUIRED but NOT SET.\n' +
      'Copy .env.example → .env.local and fill in your OpenRouter API key.\n' +
      'The app cannot run without a valid API key — no fallback keys allowed for security.'
  )
}

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

export async function chatWithAI(userMessage: string): Promise<string> {
  try {
    const messages = [...conversationHistory, { role: 'user' as const, content: userMessage }];
    
    const response = await fetch(OPENROUTER_API_URL, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${OPENROUTER_API_KEY}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': window.location.href,
        'X-Title': 'Bite Me Baby App'
      },
      body: JSON.stringify({
        model: OPENROUTER_MODEL,
        messages: messages.slice(-11), // Keep last 10 messages + system
        max_tokens: 500,
        temperature: 0.7,
      })
    });

    if (!response.ok) {
      throw new Error(`API error: ${response.status}`);
    }

    const data = await response.json();
    const aiResponse = data.choices?.[0]?.message?.content || 'ขอโทษค่ะ ฉันไม่ได้รับข้อความที่ถูกต้อง กรุณาลองอีกครั้งนะ 😊';
    
    conversationHistory.push({ role: 'user' as const, content: userMessage });
    conversationHistory.push({ role: 'assistant' as const, content: aiResponse });
    
    return aiResponse;
  } catch (error) {
    console.error('OpenRouter API Error:', error);
    return 'ขอโทษค่ะ เกิดข้อผิดพลาดในการเชื่อมต่อ กรุณาลองใหม่อีกครั้งนะ 🙏';
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

    const response = await fetch(OPENROUTER_API_URL, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${OPENROUTER_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: OPENROUTER_MODEL,
        messages: [
          { role: 'system', content: 'คุณคือ AI Recommendation Engine ที่แนะนำเมนูอาหาร' },
          { role: 'user', content: prompt }
        ],
        max_tokens: 300,
        temperature: 0.8,
      })
    })

    if (!response.ok) return products.slice(0, 3)

    const data = await response.json()
    const content = data.choices?.[0]?.message?.content || '[]'
    
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
