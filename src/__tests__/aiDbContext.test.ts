// ============================================
// Bite Me Baby — AI DB Context Builder tests (WS-3)
// Offline: supabase client is mocked with a chainable in-memory fake.
// ============================================

import { describe, it, expect, vi, beforeEach, type Mock } from 'vitest'

// In-memory "database" + query recorder — the builder must query through the
// public client only (anon key + RLS), never service role.
const queries: string[] = []

function makeChainableFake(db: Record<string, unknown[]>) {
  return {
    from(table: string) {
      queries.push(table)
      const rows = db[table] ?? []
      const builder: any = {
        select: () => builder,
        eq: () => builder,
        order: () => builder,
        limit: () => builder,
        then: (resolve: (v: { data: unknown[]; error: null }) => void) =>
          resolve({ data: rows, error: null }),
      }
      return builder
    },
  }
}

vi.mock('@/lib/supabase', () => {
  let currentDb: Record<string, unknown[]> = {}
  const client = {
    from: (table: string) => makeChainableFake(currentDb).from(table),
    __setDb: (db: Record<string, unknown[]>) => { currentDb = db },
  }
  return { supabase: client, default: client }
})

import { supabase } from '@/lib/supabase'
import {
  getDbContextPrompt,
  invalidateDbContext,
  resetDbContextCacheForTests,
  hasDbContextCache,
} from '@/lib/aiDbContext'

function seedDb(): Record<string, unknown[]> {
  return {
    products: [
      { id: 'p1', name: 'ขนมครก', price: 30, category_id: 'c-dessert', is_available: true, is_featured: true },
      { id: 'p2', name: 'ข้าวเหนียวมะม่วง', price: 65, category_id: 'c-dessert', is_available: true, is_featured: false },
      { id: 'p3', name: 'ชาเย็น', price: 25, category_id: 'c-drink', is_available: false, is_featured: false },
    ],
    product_categories: [
      { id: 'c-dessert', name: 'ขนมหวาน' },
      { id: 'c-drink', name: 'เครื่องดื่ม' },
    ],
    promotions: [
      { name: 'โปรเปิดร้าน', description: null, discount_type: 'percentage', discount_value: 10, min_order_amount: 100, end_date: '2026-10-31', is_active: true },
    ],
    business_settings: [
      { key: 'opening_hours', value: { open: '08:00', close: '20:00' } },
    ],
  }
}

beforeEach(() => {
  resetDbContextCacheForTests()
  queries.length = 0
  ;(supabase as any).__setDb(seedDb())
})

describe('aiDbContext builder (WS-3)', () => {
  it('builds a compact context with menu grouped by category name', async () => {
    const text = await getDbContextPrompt(true)
    expect(text).toContain('ขนมหวาน')
    expect(text).toContain('ขนมครก 30฿★แนะนำ')
    expect(text).toContain('ข้าวเหนียวมะม่วง 65฿')
  })

  it('separates unavailable items (ห้ามบอกว่าสั่งได้)', async () => {
    const text = await getDbContextPrompt(true)
    expect(text).toContain('หมดวันนี้')
    expect(text).toContain('ชาเย็น')
  })

  it('includes active promotions with discount summary', async () => {
    const text = await getDbContextPrompt(true)
    expect(text).toContain('PROMOTIONS')
    expect(text).toContain('โปรเปิดร้าน')
    expect(text).toContain('ลด 10%')
    expect(text).toContain('ขั้นต่ำ 100฿')
  })

  it('includes store settings', async () => {
    const text = await getDbContextPrompt(true)
    expect(text).toContain('STORE SETTINGS')
    expect(text).toContain('opening_hours')
  })

  it('appends the anti-hallucination directive (ตอบจาก context เท่านั้น)', async () => {
    const text = await getDbContextPrompt(true)
    expect(text).toContain('ห้ามมโน')
    expect(text).toContain('ห้ามปรับราคาเอง')
  })

  it('caches — second call does not re-query the DB', async () => {
    await getDbContextPrompt(true)
    const afterFirst = queries.length
    expect(afterFirst).toBeGreaterThan(0)
    expect(hasDbContextCache()).toBe(true)
    queries.length = 0
    await getDbContextPrompt()
    expect(queries.length).toBe(0)
  })

  it('invalidateDbContext forces a fresh fetch', async () => {
    await getDbContextPrompt(true)
    invalidateDbContext()
    queries.length = 0
    await getDbContextPrompt()
    expect(queries.length).toBeGreaterThan(0)
  })

  it('skips a failed table but keeps the rest', async () => {
    const db = seedDb()
    db.promotions = [] // empty promotion table → ok:false alone doesn't fail all
    ;(supabase as any).__setDb(db)
    const text = await getDbContextPrompt(true)
    expect(text).toContain('MENU')
    expect(text).not.toContain('PROMOTIONS')
  })

  it('returns "" when every table fails (no context — model must not invent data)', async () => {
    ;(supabase as any).__setDb({})
    const text = await getDbContextPrompt(true)
    expect(text).toBe('')
    expect(hasDbContextCache()).toBe(true) // cached as empty to avoid hammering a broken DB
  })

  it('caps context size under the ~1500-token budget', async () => {
    const db = seedDb()
    const many = Array.from({ length: 300 }, (_, i) => ({
      id: `x${i}`,
      name: `เมนูยาวมากเดิมพันทดสอบขนาด-${i}`,
      price: 10,
      category_id: 'c-dessert',
      is_available: true,
      is_featured: false,
    }))
    db.products = many
    ;(supabase as any).__setDb(db)
    const text = await getDbContextPrompt(true)
    expect(text.length).toBeLessThanOrEqual(3500)
    expect(text.endsWith('...')).toBe(true)
  })
})

// Silence unused-var lint of the Mock type import (used by editor hints only)
void (undefined as unknown as Mock)