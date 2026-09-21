// ============================================
// Bite Me Baby — Server AI Memory tests (AI-03)
// ============================================

import { describe, it, expect, vi } from 'vitest'

// Offline Supabase mock — aiServerMemory round-trips through RPC (migration 021).
vi.mock('@/lib/supabase', async () => {
  const { createSupabaseMock } = await import('./helpers/supabaseMock')
  return {
    supabase: createSupabaseMock(),
    supabaseAdmin: null,
    default: null,
  }
})

describe('aiServerMemory (AI-03 — server memory + cross-device merge)', () => {
  it('persists then reloads the same memory through the RPC (round-trip)', async () => {
    const { saveServerMemory, loadServerMemory } = await import('@/lib/aiServerMemory')
    const shape = { name: 'สมชาย', favorite_categories: ['dish'] as string[] }
    expect(await saveServerMemory(shape)).toBe(true)
    const loaded = await loadServerMemory()
    expect(loaded?.name).toBe('สมชาย')
    expect(loaded?.favorite_categories).toEqual(['dish'])
  })

  it('flattens local customer memory into the server shape', async () => {
    const { toServerShape } = await import('@/lib/aiServerMemory')
    const local = {
      name: 'สมหญิง',
      preferred_dietary: ['vegetarian'],
      favorite_categories: ['drink'],
      order_frequency: 'monthly',
      average_order_value: 150,
      last_order_date: '2026-09-01',
      total_orders: 3,
      total_spent: 450,
      feedback: [],
    }
    const shape = toServerShape(local)
    expect(shape.name).toBe('สมหญิง')
    expect(shape.total_orders).toBe(3)
    expect(shape.total_spent).toBe(450)
  })

  it('server memory wins over local on merged keys', async () => {
    const { mergeIntoLocal } = await import('@/lib/aiServerMemory')
    const merged = mergeIntoLocal('cust-1', { name: 'Server Name', total_orders: 7 })
    expect(merged.name).toBe('Server Name')
    expect(merged.total_orders).toBe(7)
  })
})