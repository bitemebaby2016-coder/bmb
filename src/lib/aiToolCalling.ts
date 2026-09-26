// ============================================
// Bite Me Baby — AI Tool Calling System (SECURE)
// Allows AI to call functions via ai-proxy Edge Function
// SEC-02: API key lives ONLY server-side in Edge Function
// ============================================

import { supabase } from './supabase'
import type { Product } from '@/types'
import { getProducts, getProduct } from './bmbAdminApi_products'
import { getOrders, getOrder } from './bmbAdminApi_orders'
import { getReviews, getAverageRating } from './reviewApi'
import { getCategories } from './bmbAdminApi_products'
import { MODEL_A_FALLBACK, resolveModelA } from './aiModels'

export interface ToolCall {
  id: string
  name: string
  arguments: Record<string, any>
  result: any
  created_at: string
}

const TOOLS = {
  getMenu: {
    name: 'get_menu',
    description: 'Get menu items with filters',
    parameters: {
      type: 'object',
      properties: {
        category: { type: 'string', description: 'Category filter (dish, rice, curry, drink, dessert)' },
        available: { type: 'boolean', description: 'Only show available items' },
        featured: { type: 'boolean', description: 'Only show featured items' }
      }
    }
  },
  getOrder: {
    name: 'get_order',
    description: 'Get order details by order number',
    parameters: {
      type: 'object',
      properties: {
        order_number: { type: 'string', description: 'Order number (e.g., BMB-20260915-001)' }
      },
      required: ['order_number']
    }
  },
  getProduct: {
    name: 'get_product',
    description: 'Get product details by ID',
    parameters: {
      type: 'object',
      properties: {
        product_id: { type: 'string', description: 'Product ID' }
      },
      required: ['product_id']
    }
  },
  getReviews: {
    name: 'get_reviews',
    description: 'Get reviews for a product',
    parameters: {
      type: 'object',
      properties: {
        product_id: { type: 'string', description: 'Product ID' }
      },
      required: ['product_id']
    }
  },
  getCategories: {
    name: 'get_categories',
    description: 'Get all product categories',
    parameters: {
      type: 'object',
      properties: {}
    }
  }
}

function getToolDefinitions() {
  return Object.values(TOOLS).map(tool => ({
    type: 'function',
    function: {
      name: tool.name,
      description: tool.description,
      parameters: tool.parameters
    }
  }))
}

export async function executeToolCall(toolName: string, args: Record<string, any>): Promise<any> {
  switch (toolName) {
    case 'get_menu': {
      const products = await getProducts()
      let filtered = products
      if (args.category) filtered = filtered.filter((p: Product) => p.category_id === args.category)
      if (args.available !== undefined) filtered = filtered.filter((p: Product) => p.is_available === args.available)
      if (args.featured) filtered = filtered.filter((p: Product) => p.is_featured)
      return {
        success: true,
        data: filtered.map((p: Product) => ({
          id: p.id, name: p.name, price: p.price,
          category_id: p.category_id, is_available: p.is_available, is_featured: p.is_featured
        }))
      }
    }
    case 'get_order': {
      const order = await getOrder(args.order_number)
      if (!order) return { success: false, error: 'Order not found' }
      return { success: true, data: order }
    }
    case 'get_product': {
      const product = await getProduct(args.product_id)
      if (!product) return { success: false, error: 'Product not found' }
      return { success: true, data: product }
    }
    case 'get_reviews': {
      const reviews = getReviews(args.product_id)
      const averageRating = getAverageRating(args.product_id)
      return { success: true, data: { reviews, averageRating } }
    }
    case 'get_categories': {
      const categories = await getCategories()
      return { success: true, data: categories }
    }
    default:
      return { success: false, error: `Unknown tool: ${toolName}` }
  }
}

/**
 * Chat with AI using tool calling via ai-proxy Edge Function (SECURE).
 * Falls back from Model A (Nemotron) to Qwen 3.7 Flash on failure.
 */
export async function chatWithToolSupport(
  userMessage: string,
  conversationHistory: Array<{ role: string; content: string }>,
  customerPreferences?: Record<string, any>
): Promise<{ response: string; toolCalls: ToolCall[] }> {
  const toolCalls: ToolCall[] = []
  const toolDefinitionsJson = JSON.stringify(getToolDefinitions())
  const systemPrompt = `You are "Bite" (ไบต์), a friendly waiter at Bite Me Baby restaurant.

You can use these tools to help customers:
${toolDefinitionsJson}

When a customer asks for information that requires a tool, call the tool and use the result to answer.
Always respond in Thai language unless the customer speaks English.

Tools available:
- get_menu: Get menu items with filters
- get_order: Get order details
- get_product: Get product details
- get_reviews: Get product reviews
- get_categories: Get product categories

Customer preferences: ${customerPreferences ? JSON.stringify(customerPreferences) : 'none'}
`
  const modelA = resolveModelA(import.meta.env.VITE_OPENROUTER_MODEL)
  const sendRequest = async (model: string) => {
    const { data: proxy, error } = await supabase.functions.invoke('ai-proxy', {
      body: {
        messages: [
          { role: 'system', content: systemPrompt },
          ...conversationHistory.slice(-10),
          { role: 'user', content: userMessage }
        ],
        model, maxTokens: 1000, temperature: 0.7,
        tools: getToolDefinitions(), tool_choice: 'auto'
      }
    })
    if (error) throw new Error(`proxy error: ${error.message || 'upstream'}`)
    if (!proxy || proxy.error) throw new Error(proxy?.error || 'Empty proxy response')
    return proxy.data
  }
  try {
    let data: any
    try { data = await sendRequest(modelA) }
    catch (primaryError) {
      console.error(`[Bite Me Baby] Model A (${modelA}) failed, falling back to ${MODEL_A_FALLBACK}:`, primaryError)
      data = await sendRequest(MODEL_A_FALLBACK)
    }
    const assistantMessage = data?.choices?.[0]?.message
    if (assistantMessage?.tool_calls) {
      for (const toolCall of assistantMessage.tool_calls) {
        const toolName = toolCall.function.name
        const args = JSON.parse(toolCall.function.arguments)
        const result = await executeToolCall(toolName, args)
        toolCalls.push({ id: toolCall.id, name: toolName, arguments: args, result, created_at: new Date().toISOString() })
      }
    }
    const responseContent = assistantMessage?.content || 'ขอโทษค่ะ ไม่ได้รับข้อความที่ถูกต้อง'
    return { response: responseContent, toolCalls }
  } catch (error) {
    console.error('Tool call error:', error)
    return { response: 'ขอโทษค่ะ เกิดข้อผิดพลาด กรุณาลองใหม่อีกครั้งนะ 🙏', toolCalls: [] }
  }
}