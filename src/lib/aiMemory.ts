// ============================================
// Bite Me Baby — AI Memory System
// Stores conversation history and customer context
// ============================================

import { storageGet, storageSet, storageRemove } from './bmbStorage'

export interface MemoryEntry {
  id: string
  customer_id: string
  type: 'conversation' | 'preference' | 'order_history' | 'feedback'
  key: string
  value: any
  created_at: string
  updated_at: string
}

export interface CustomerMemory {
  customer_id: string
  name: string | null
  preferred_dietary: string[]
  favorite_categories: string[]
  order_frequency: string
  average_order_value: number
  last_order_date: string | null
  total_orders: number
  total_spent: number
  feedback: string[]
  created_at: string
  updated_at: string
}

const MEMORY_PREFIX = 'bmb_ai_memory_'

// Get all memories for a customer
export function getCustomerMemory(customerId: string): CustomerMemory | null {
  const raw = storageGet<CustomerMemory | null>(MEMORY_PREFIX + customerId, null)
  return raw
}

// Update customer memory
export function updateCustomerMemory(customerId: string, updates: Partial<CustomerMemory>): CustomerMemory {
  const existing = getCustomerMemory(customerId) || {
    customer_id: customerId,
    name: null,
    preferred_dietary: [],
    favorite_categories: [],
    order_frequency: 'unknown',
    average_order_value: 0,
    last_order_date: null,
    total_orders: 0,
    total_spent: 0,
    feedback: [],
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  }

  const updated = {
    ...existing,
    ...updates,
    updated_at: new Date().toISOString()
  }

  storageSet(MEMORY_PREFIX + customerId, updated)
  return updated
}

// Store conversation message
export function storeConversationMessage(customerId: string, role: 'user' | 'assistant', content: string) {
  const conversations = storageGet<MemoryEntry[]>(MEMORY_PREFIX + customerId + '_conversations', [])
  
  const entry: MemoryEntry = {
    id: `msg-${Date.now()}`,
    customer_id: customerId,
    type: 'conversation',
    key: `msg-${Date.now()}`,
    value: { role, content },
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  }

  conversations.push(entry)
  storageSet(MEMORY_PREFIX + customerId + '_conversations', conversations.slice(-50)) // Keep last 50 messages
}

// Get conversation history
export function getConversationHistory(customerId: string): MemoryEntry[] {
  return storageGet<MemoryEntry[]>(MEMORY_PREFIX + customerId + '_conversations', [])
}

// Store user preference
export function storePreference(customerId: string, key: string, value: any) {
  const memories = storageGet<MemoryEntry[]>(MEMORY_PREFIX + customerId + '_preferences', [])
  
  const entry: MemoryEntry = {
    id: `pref-${Date.now()}`,
    customer_id: customerId,
    type: 'preference',
    key,
    value,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  }

  memories.push(entry)
  storageSet(MEMORY_PREFIX + customerId + '_preferences', memories)
}

// Get user preferences
export function getPreferences(customerId: string): Record<string, any> {
  const memories = storageGet<MemoryEntry[]>(MEMORY_PREFIX + customerId + '_preferences', [])
  const prefs: Record<string, any> = {}
  
  memories.forEach(m => {
    prefs[m.key] = m.value
  })
  
  return prefs
}

// Store order history reference
export function storeOrderReference(customerId: string, orderId: string, orderData: any) {
  const orders = storageGet<MemoryEntry[]>(MEMORY_PREFIX + customerId + '_orders', [])
  
  const entry: MemoryEntry = {
    id: `order-${orderId}`,
    customer_id: customerId,
    type: 'order_history',
    key: orderId,
    value: orderData,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  }

  orders.push(entry)
  storageSet(MEMORY_PREFIX + customerId + '_orders', orders.slice(-20)) // Keep last 20 orders
}

// Get order history
export function getOrderHistory(customerId: string): MemoryEntry[] {
  return storageGet<MemoryEntry[]>(MEMORY_PREFIX + customerId + '_orders', [])
}

// Store feedback
export function storeFeedback(customerId: string, feedback: string) {
  const memories = storageGet<MemoryEntry[]>(MEMORY_PREFIX + customerId + '_feedback', [])
  
  memories.push({
    id: `fb-${Date.now()}`,
    customer_id: customerId,
    type: 'feedback',
    key: `fb-${Date.now()}`,
    value: feedback,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  })

  storageSet(MEMORY_PREFIX + customerId + '_feedback', memories)
}

// Get feedback history
export function getFeedbackHistory(customerId: string): MemoryEntry[] {
  return storageGet<MemoryEntry[]>(MEMORY_PREFIX + customerId + '_feedback', [])
}

// Clear all memory for a customer
export function clearCustomerMemory(customerId: string): void {
  storageRemove(MEMORY_PREFIX + customerId)
  storageRemove(MEMORY_PREFIX + customerId + '_conversations')
  storageRemove(MEMORY_PREFIX + customerId + '_preferences')
  storageRemove(MEMORY_PREFIX + customerId + '_orders')
  storageRemove(MEMORY_PREFIX + customerId + '_feedback')
}

// Get memory summary for AI context
export function getMemorySummary(customerId: string): string {
  const memory = getCustomerMemory(customerId)
  if (!memory) return ''

  const parts: string[] = []
  
  if (memory.name) {
    parts.push(`ลกค้าชื่อ ${memory.name}`)
  }
  
  if (memory.preferred_dietary.length > 0) {
    parts.push(`ชอบอาหาร: ${memory.preferred_dietary.join(', ')}`)
  }
  
  if (memory.favorite_categories.length > 0) {
    parts.push(`หมวดหม่ที่ชอบ: ${memory.favorite_categories.join(', ')}`)
  }
  
  if (memory.total_orders > 0) {
    parts.push(`สั่ง ${memory.total_orders} ครั้ง รวม ${memory.total_spent.toFixed(0)} บาท`)
  }
  
  return parts.join(' | ')
}