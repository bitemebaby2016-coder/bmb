// ============================================
// Bite Me Baby — Server AI Memory (AI-03, migration 021)
// Conversations + customer context persisted PER AUTH USER on the server so
// memory follows the customer across devices. The local heuristic store stays
// as the fast offline cache; this module is the authoritative sync bridge.
// ============================================

import { supabase } from './supabase'
import { updateCustomerMemory, getCustomerMemory, storeConversationMessage, getConversationHistory, type CustomerMemory } from './aiMemory'

export interface ServerMemoryShape {
  name?: string | null
  preferred_dietary?: string[]
  favorite_categories?: string[]
  order_frequency?: string
  average_order_value?: number
  last_order_date?: string | null
  total_orders?: number
  total_spent?: number
  feedback?: string[]
  recent_conversation?: Array<{ role: 'user' | 'assistant'; content: string }>
  [key: string]: unknown
}

/** Load the authoritative server memory for the current auth user. */
export async function loadServerMemory(): Promise<ServerMemoryShape | null> {
  const { data, error } = await supabase.rpc('get_ai_memory')
  if (error) return null
  return (data as unknown as { memory?: ServerMemoryShape }).memory ?? null
}

/** Persist memory for the current auth user. */
export async function saveServerMemory(memory: ServerMemoryShape): Promise<boolean> {
  const { error } = await supabase.rpc('save_ai_memory', { p_memory: memory })
  return !error
}

/** Flatten the local customer memory into the server shape. */
export function toServerShape(local: Pick<CustomerMemory, 'name' | 'preferred_dietary' | 'favorite_categories' | 'order_frequency' | 'average_order_value' | 'last_order_date' | 'total_orders' | 'total_spent' | 'feedback'>): ServerMemoryShape {
  return {
    name: local.name,
    preferred_dietary: local.preferred_dietary,
    favorite_categories: local.favorite_categories,
    order_frequency: local.order_frequency,
    average_order_value: local.average_order_value,
    last_order_date: local.last_order_date,
    total_orders: local.total_orders,
    total_spent: local.total_spent,
    feedback: local.feedback,
  }
}

/** Merge server memory over local (server wins on shared keys, missing keys keep local). */
export function mergeIntoLocal(customerId: string, server: ServerMemoryShape): CustomerMemory {
  const updates: Partial<CustomerMemory> = {}
  for (const key of ['name', 'order_frequency'] as const) {
    if (server[key] != null) updates[key] = server[key] as never
  }
  for (const key of ['preferred_dietary', 'favorite_categories', 'feedback'] as const) {
    if (Array.isArray(server[key])) updates[key] = server[key] as never
  }
  for (const key of ['average_order_value', 'total_orders', 'total_spent'] as const) {
    if (typeof server[key] === 'number') updates[key] = server[key] as never
  }
  if (server.last_order_date) updates.last_order_date = server.last_order_date
  return updateCustomerMemory(customerId, updates)
}

/** One-shot bridge: load server memory → merge into local → return merged. */
export async function hydrateMemoryFromServer(customerId: string): Promise<CustomerMemory | null> {
  const server = await loadServerMemory()
  if (!server) return getCustomerMemory(customerId)
  return mergeIntoLocal(customerId, server)
}

/** Push the local memory (incl. recent conversation tail) to the server. */
export async function pushLocalMemoryToServer(customerId: string): Promise<boolean> {
  const local = getCustomerMemory(customerId)
  if (!local) return false
  const shape = toServerShape(local)
  const recent = getConversationHistory(customerId).slice(-10).map((e) => ({ role: e.value.role, content: e.value.content }))
  if (recent.length > 0) shape.recent_conversation = recent
  return saveServerMemory(shape)
}

/** Convenience: store a message locally then immediately sync to server. */
export async function storeConversationMessageSynced(customerId: string, role: 'user' | 'assistant', content: string): Promise<void> {
  storeConversationMessage(customerId, role, content)
  void pushLocalMemoryToServer(customerId).catch(() => {})
}