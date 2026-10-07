// ============================================
// Bite Me Baby — Talk to Bite: pure logic tests
// ============================================
// Offline + deterministic. No supabase / AI / network. These helpers only
// translate real data into drafts — they hold no business authority.
// ============================================

import { describe, it, expect } from 'vitest'
import type { Product } from '@/types'
import {
  BITE_STATES,
  bitePoseForState,
  buildBiteGreeting,
  chatStatusLabel,
  getGreetingIndex,
  isBiteState,
  pickTopAvailable,
  resolveOrderAgainFromOrder,
  sumDraftTotal,
} from '@/lib/talkToBite'

function product(id: string, name: string, price: number, opts: Partial<Product> = {}): Product {
  return {
    id,
    name,
    description: '',
    price,
    category_id: '',
    image_url: '',
    is_available: true,
    is_featured: false,
    is_preorder: false,
    prep_minutes: 0,
    sort_order: 0,
    created_at: '',
    ...opts,
  }
}

const CATALOG = [
  product('p1', 'ส้มตำ', 45, { is_featured: true }),
  product('p2', 'ไก่ทอด', 60),
  product('p3', 'ผลไม้รวม', 55),
  product('p4', 'ก๋วยเตี๋ยว', 50, { is_available: false }),
  product('p5', 'ข้าวผัด(เลิก)ย', 40, { archived: true }),
]

describe('Bite state system', () => {
  it('exposes the full unified state set', () => {
    expect(BITE_STATES).toContain('WELCOME')
    expect(BITE_STATES).toContain('LISTENING')
    expect(BITE_STATES).toContain('RECOMMENDING')
    expect(BITE_STATES).toContain('ORDER_DRAFT')
    expect(BITE_STATES).toContain('ORDER_CONFIRM')
  })

  it('isBiteState validates guards (rejects junk / accepts valid)', () => {
    expect(isBiteState('SUCCESS')).toBe(true)
    expect(isBiteState('THINKING')).toBe(true)
    expect(isBiteState('nonsense')).toBe(false)
    expect(isBiteState(undefined)).toBe(false)
  })

  it('maps each state to a real shipped mascot pose', () => {
    expect(bitePoseForState('THINKING')).toBe('thinking')
    expect(bitePoseForState('ORDER_DRAFT')).toBe('shopping')
    expect(bitePoseForState('SUCCESS')).toBe('success')
    expect(bitePoseForState('ERROR')).toBe('sad')
    expect(bitePoseForState('GOODBYE')).toBe('bye')
    expect(bitePoseForState('IDLE')).toBe('ready')
  })

  it('chatStatusLabel is non-empty for every state', () => {
    for (const s of BITE_STATES) expect(chatStatusLabel(s).length).toBeGreaterThan(0)
  })
})

describe('pickTopAvailable', () => {
  it('keeps only sellable items and honors featured-then-name order', () => {
    const top = pickTopAvailable(CATALOG, 3)
    expect(top.map((p) => p.id)).toEqual(['p1', 'p2', 'p3'])
  })

  it('returns empty for an empty / all-sold-out catalog', () => {
    expect(pickTopAvailable([], 3)).toEqual([])
    expect(pickTopAvailable([product('x', 'หมด', 1, { is_available: false })], 3)).toEqual([])
  })

  it('is deterministic across calls', () => {
    const a = pickTopAvailable([...CATALOG].reverse(), 3).map((p) => p.id)
    const b = pickTopAvailable(CATALOG, 3).map((p) => p.id)
    expect(a).toEqual(b)
  })
})

describe('resolveOrderAgainFromOrder', () => {
  const pastOrder = {
    items: [
      { product_id: 'p1', product_name: 'ส้มตำ', quantity: 2 },
      { product_id: 'p2', product_name: 'ไก่ทอด', quantity: 1 },
      { product_id: 'p4', product_name: 'ก๋วยเตี๋ยว', quantity: 1 },
      { product_id: 'nope', product_name: 'ของที่ไม่มีแล้ว', quantity: 1 },
    ],
  }

  it('drafts only still-available items with current prices', () => {
    const res = resolveOrderAgainFromOrder(pastOrder, CATALOG)
    expect(res.count).toBe(3) // 2x pesto + 1x fried
    expect(res.total).toBe(45 * 2 + 60 * 1)
    expect(res.draft.map((d) => d.product.id).sort()).toEqual(['p1', 'p2'])
    expect(res.draft.find((d) => d.product.id === 'p1')?.quantity).toBe(2)
  })

  it('reports sold-out / removed products separately, never in the draft', () => {
    const res = resolveOrderAgainFromOrder(pastOrder, CATALOG)
    expect(res.unavailable.map((u) => u.name)).toEqual(['ก๋วยเตี๋ยว', 'ของที่ไม่มีแล้ว'])
    expect(res.draft.some((d) => d.product.id === 'p4')).toBe(false)
  })

  it('returns an empty draft when nothing survives', () => {
    const res = resolveOrderAgainFromOrder({ items: [{ product_id: 'p4', product_name: 'หมด', quantity: 1 }] }, CATALOG)
    expect(res.draft).toEqual([])
    expect(res.count).toBe(0)
    expect(res.total).toBe(0)
    expect(res.unavailable).toHaveLength(1)
  })

  it('is robust to malformed / missing order data', () => {
    const res = resolveOrderAgainFromOrder({ items: undefined }, CATALOG)
    expect(res.draft).toEqual([])
    expect(res.total).toBe(0)
  })
})

describe('sumDraftTotal', () => {
  it('computes draft subtotal from current prices', () => {
    const draft = [
      { product: CATALOG[0], quantity: 2 },
      { product: CATALOG[1], quantity: 1 },
    ]
    expect(sumDraftTotal(draft)).toBe(45 * 2 + 60)
  })
})

describe('getGreetingIndex / buildBiteGreeting (7-day rotation)', () => {
  it('returns a stable 0..6 index that advances daily', () => {
    const d0 = new Date(2026, 0, 1, 12, 0, 0) // midday — exact-day arithmetic (+24h/+7d) is TZ-safe
    const i0 = getGreetingIndex(d0)
    expect(i0).toBeGreaterThanOrEqual(0)
    expect(i0).toBeLessThanOrEqual(6)
    // Exact same instant → same index
    expect(getGreetingIndex(new Date(d0.getTime()))).toBe(i0) // padded for determinism
    // Next day → next index (mod 7)
    expect((getGreetingIndex(new Date(d0.getTime() + 24 * 3600 * 1000)) - i0 + 7) % 7).toBe(1)
    // 7 days later → same index again
    expect(getGreetingIndex(new Date(d0.getTime() + 7 * 24 * 3600 * 1000))).toBe(i0)
  })

  it('produces 7 distinct greetings across the rotation (day 0..6)', () => {
    const texts = Array.from({ length: 7 }, (_, i) => buildBiteGreeting({ index: i }))
    expect(new Set(texts).size).toBe(7)
  })

  it('never personalises a guest / no-name greeting', () => {
    const guest = buildBiteGreeting({ index: getGreetingIndex() })
    expect(guest).toBeTruthy()
    expect(guest).not.toContain('ครับคุณ')
  })

  it('prepends a VERIFIED name and avoids double greeting', () => {
    const named = buildBiteGreeting({ index: 0, name: 'สมชาย' })
    expect(named).toContain('สวัสดีครับคุณสมชาย')
    // Original leading greeting is stripped → only ONE สวัสดีครับ reference
    expect(named.match(/สวัสดีครับ/g)?.length).toBe(1)
  })

  it('ignores an email-shaped "name" (never greets with an address)', () => {
    const g = buildBiteGreeting({ index: 1, name: 'user@example.com' })
    expect(g).not.toContain('ครับคุณ')
    expect(g).toBe(buildBiteGreeting({ index: 1 }))
  })

  it('appends a favorite-category nudge only when verified', () => {
    const g = buildBiteGreeting({ index: 2, name: 'แอน', favoriteCategory: 'ของหวาน' })
    expect(g).toContain('ของหวาน')
    const withCatOnly = buildBiteGreeting({ favoriteCategory: 'ของหวาน' })
    expect(withCatOnly).toContain('ของหวาน')
  })
})