// ============================================
// Bite Me Baby — AI Tool Calling System
// Allows AI to call functions (getMenu, getOrders, etc.)
// ============================================

import { chatWithAI } from './aiService'
import type { Product } from '@/types'
import { getProducts, getProduct } from './bmbAdminApi_products'
import { getOrders, getOrder } from './bmbAdminApi_orders'
import { getReviews, getAverageRating } from './reviewApi'
import { getCategories } from './bmbAdminApi_products'

export interface ToolCall {
  id: string
  name: string
  arguments: Record<string, any>
  result: any
  created_at: string
}

// Tool definitions
const TOOLS = {
  getMenu: {
    name: 'get_menu',
    description: 'Get menu items with filters',
    parameters: {
      category: { type: 'string', description: 'Category filter (dish, rice, curry, drink, dessert)' },
      available: { type: 'boolean', description: 'Only show available items' },
      featured: { type: 'boolean', description: 'Only show featured items' }
    }
  },
  getOrder: {
    name: 'get_order',
    description: 'Get order details by order number',
    parameters: {
      order_number: { type: 'string', description: 'Order number (e.g., BMB-20260915-001)' }
    }
  },
  getProduct: {
    name: 'get_product',
    description: 'Get product details by ID',
    parameters: {
      product_id: { type: 'string', description: 'Product ID' }
    }
  },
  getReviews: {
    name: 'get_reviews',
    description: 'Get reviews for a product',
    parameters: {
      product_id: { type: 'string', description: 'Product ID' }
    }
  },
  getCategories: {
    name: 'get_categories',
    description: 'Get all product categories',
    parameters: {}
  }
}

// Execute a tool call
export async function executeToolCall(toolName: string, args: Record<string, any>): Promise<any> {
  switch (toolName) {
    case 'get_menu': {
      const products = await getProducts()
      let filtered = products
      
      if (args.category) {
        filtered = filtered.filter((p: Product) => p.category_id === args.category)
      }
      if (args.available !== undefined) {
        filtered = filtered.filter((p: Product) => p.is_available === args.available)
      }
      if (args.featured) {
        filtered = filtered.filter((p: Product) => p.is_featured)
      }
      
      return {
        success: true,
        data: filtered.map((p: Product) => ({
          id: p.id,
          name: p.name,
          price: p.price,
          category_id: p.category_id,
          is_available: p.is_available,
          is_featured: p.is_featured
        }))
      }
    }

    case 'get_order': {
      const order = getOrder(args.order_number)
      if (!order) {
        return { success: false, error: 'Order not found' }
      }
      return { success: true, data: order }
    }

    case 'get_product': {
      const product = getProduct(args.product_id)
      if (!product) {
        return { success: false, error: 'Product not found' }
      }
      return { success: true, data: product }
    }

    case 'get_reviews': {
      const reviews = getReviews(args.product_id)
      const averageRating = getAverageRating(args.product_id)
      return { success: true, data: { reviews, average_rating: averageRating } }
    }

    case 'get_categories': {
      const categories = getCategories()
      return { success: true, data: categories }
    }

    default:
      return { success: false, error: `Unknown tool: ${toolName}` }
  }
}

// Get tool definitions
export function getToolDefinitions() {
  return TOOLS
}

// AI can call tools - enhanced chatWithAI with tool support
export async function chatWithToolSupport(
  userMessage: string,
  conversationHistory: Array<{ role: string; content: string }>,
  customerPreferences?: Record<string, any>
): Promise<{ response: string; toolCalls: ToolCall[] }> {
  const toolCalls: ToolCall[] = []
  
  // Build system prompt with tool definitions
  const toolDefinitionsJson = JSON.stringify(getToolDefinitions())
  
  const systemPrompt = `
You are "Bite" (ไบท), a friendly waiter at Bite Me Baby restaurant.

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

  // Send to OpenRouter with tool calling support
  try {
    const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${import.meta.env.VITE_OPENROUTER_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: import.meta.env.VITE_OPENROUTER_MODEL || 'qwen/qwen3.7-flash',
        messages: [
          { role: 'system', content: systemPrompt },
          ...conversationHistory,
          { role: 'user', content: userMessage }
        ],
        tools: Object.values(TOOLS).map(tool => ({
          type: 'function',
          function: {
            name: tool.name,
            description: tool.description,
            parameters: tool.parameters
          }
        })),
        tool_choice: 'auto',
        max_tokens: 1000,
        temperature: 0.7
      })
    })

    if (!response.ok) {
      throw new Error(`API error: ${response.status}`)
    }

    const data = await response.json()
    const assistantMessage = data.choices?.[0]?.message
    
    // Extract tool calls if any
    if (assistantMessage?.tool_calls) {
      for (const toolCall of assistantMessage.tool_calls) {
        const toolName = toolCall.function.name
        const args = JSON.parse(toolCall.function.arguments)
        
        const result = await executeToolCall(toolName, args)
        toolCalls.push({
          id: toolCall.id,
          name: toolName,
          arguments: args,
          result,
          created_at: new Date().toISOString()
        })
      }
    }

    const responseContent = assistantMessage?.content || 'ขอทษค่ะ ันไม่ได้รับข้อความที่ถกต้อง'
    
    return {
      response: responseContent,
      toolCalls
    }
  } catch (error) {
    console.error('Tool call error:', error)
    return {
      response: 'ขอทษค่ะ เกิดข้อผิดพลาด กรุาลองใหม่อีกครั้งนะ 🙏',
      toolCalls: []
    }
  }
}