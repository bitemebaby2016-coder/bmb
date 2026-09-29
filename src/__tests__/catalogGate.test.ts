// ============================================
// Bite Me Baby — CAT-01: server-enforced catalog visibility gate
// (migration 055 trg_catalog_visibility_gate mirrored by supabaseMock)
// ============================================

import { describe, it, expect, vi, beforeEach } from 'vitest'

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

import { supabase } from '@/lib/supabase'

describe('CAT-01 · catalog visibility gate at order time (server-enforced)', () => {
  beforeEach(async () => {
    await (supabase as any).__reset?.()
    ;(supabase as any).__setNoAdmin?.(false)
    const tables = (supabase as any).__tables
    tables.menu_sections = [{ id: 'sec-1', name: 'Section A', slug: 'sec-a', description: '', sort_order: 1, is_active: true, created_at: '', updated_at: '' }]
    tables.product_categories = tables.product_categories.map((c: any) => ({ ...c, archived: false, menu_section_id: c.id === 'cat-1' ? 'sec-1' : null }))
    tables.products = tables.products.map((p: any) => ({ ...p, archived: false }))
  })

  const order = (productId: string) => (supabase as any).rpc('create_order_with_items', {
    p_order_mode: 'SAME_DAY',
    p_delivery_round_id: 'round-1',
    p_customer_name: 'QA',
    p_customer_phone: '0900000000',
    p_items: [{ product_id: productId, quantity: 1, options: {} }],
  })

  it('control: normal order passes the catalog gate', async () => {
    const res = await order('prod-1') // cat-1 → sec-1 active
    expect(res.error).toBeNull()
    expect(res.data.order_number).toBeTruthy()
  })

  it('archived product → ERR_PRODUCT_ARCHIVED', async () => {
    ;((supabase as any).__tables.products.find((p: any) => p.id === 'prod-1') as any).archived = true
    const res = await order('prod-1')
    expect(res.error?.code).toBe('ERR_PRODUCT_ARCHIVED')
  })

  it('archived category → ERR_CATEGORY_ARCHIVED', async () => {
    ;((supabase as any).__tables.product_categories.find((c: any) => c.id === 'cat-1') as any).archived = true
    const res = await order('prod-1')
    expect(res.error?.code).toBe('ERR_CATEGORY_ARCHIVED')
  })

  it('inactive category → ERR_CATEGORY_CLOSED', async () => {
    ;((supabase as any).__tables.product_categories.find((c: any) => c.id === 'cat-1') as any).is_active = false
    const res = await order('prod-1')
    expect(res.error?.code).toBe('ERR_CATEGORY_CLOSED')
  })

  it('closed governing section → ERR_SECTION_CLOSED', async () => {
    ;((supabase as any).__tables.menu_sections.find((s: any) => s.id === 'sec-1') as any).is_active = false
    const res = await order('prod-1')
    expect(res.error?.code).toBe('ERR_SECTION_CLOSED')
  })
})
