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
  applyOrderModify,
  attachCustomizersToDraft,
  bitePoseForState,
  buildBiteGreeting,
  chatStatusLabel,
  extractCustomizers,
  getGreetingIndex,
  isBiteState,
  matchHelpTopic,
  parseOrderIntent,
  pickFavoriteProducts,
  pickTopAvailable,
  pickTrendingProducts,
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

  it('uses a returning-shopper flavour when returning=true (verified evidence)', () => {
    const r = buildBiteGreeting({ index: 0, returning: true })
    expect(r).toMatch(/กลับมาแล้ว|Hey!|ยินดีต้อนรับกลับ/)
    // default (non-returning) is the normal base, not returning
    expect(buildBiteGreeting({ index: 0 })).not.toMatch(/กลับมาแล้ว|Hey!/)
  })

  it('keeps 7 returning variants and 7 normal variants distinct', () => {
    const ret = Array.from({ length: 7 }, (_, i) => buildBiteGreeting({ index: i, returning: true }))
    expect(new Set(ret).size).toBe(7)
    const norm = Array.from({ length: 7 }, (_, i) => buildBiteGreeting({ index: i }))
    expect(new Set(norm).size).toBe(7)
  })
})

describe('pickFavoriteProducts', () => {
  it('prefers verified favorite-category products, then featured, deterministic', () => {
    const catalog = [
      product('f1', 'ของหวานA', 40, { category_id: 'cat-sweet', is_featured: true }),
      product('f2', 'ของหวานB', 45, { category_id: 'cat-sweet' }),
      product('g1', 'จานหลัก', 70, { is_featured: true, category_id: 'cat-main' }),
      product('g2', 'จานหลัก2', 80, { category_id: 'cat-main', is_available: false }),
    ]
    const favs = pickFavoriteProducts(catalog, ['cat-sweet'], 3)
    expect(favs.map((p) => p.id).slice(0, 2)).toEqual(['f1', 'f2'])
    // sold-out never appears
    expect(favs.some((p) => p.id === 'g2')).toBe(false)
  })

  it('falls back to featured-then-name when no favorites known', () => {
    const catalog = [
      product('x', 'ข้าวผัด', 40, { is_featured: true }),
      product('y', 'ส้มตำ', 45),
      product('z', 'ไก่ทอด', 60, { is_featured: true }),
    ]
    const favs = pickFavoriteProducts(catalog, [], 2)
    expect(favs).toHaveLength(2)
  })
})

describe('parseOrderIntent / applyOrderModify (NL order like-a-human)', () => {
  it('detects "order like before" from natural Thai phrases', () => {
    expect(parseOrderIntent('สั่งเหมือนเดิม').likeBefore).toBe(true)
    expect(parseOrderIntent('เอาเหมือนเมื่อวาน').likeBefore).toBe(true)
    expect(parseOrderIntent('เอาของเมื่อวาน').likeBefore).toBe(true)
    expect(parseOrderIntent('สวัสดีครับ').likeBefore).toBe(false)
  })

  it('extracts modify-from/to from "เปลี่ยน X เป็น Y"', () => {
    const intent = parseOrderIntent('เอาของเมื่อวาน แต่เปลี่ยนน้ำเป็นชาเขียว')
    expect(intent.likeBefore).toBe(true)
    expect(intent.modifyFrom).toContain('น้ำ')
    expect(intent.modifyTo).toContain('ชาเขียว')
  })

  it('swaps the matching order line for the requested catalog product', () => {
    const catalog = [
      product('p_rice', 'ข้าวมันไก่', 60, { category_id: 'c1' }),
      product('p_water', 'น้ำผลไม้', 25, { category_id: 'c2' }),
      product('p_tea', 'ชาเขียวเย็น', 35, { category_id: 'c3' }),
    ]
    const order = {
      order_number: 'B-100',
      items: [
        { product_id: 'p_rice', product_name: 'ข้าวมันไก่', quantity: 1 },
        { product_id: 'p_water', product_name: 'น้ำผลไม้', quantity: 1 },
      ],
    }
    const res = applyOrderModify(order, catalog, { modifyFrom: 'น้ำ', modifyTo: 'ชาเขียว' })
    expect(res.replacedFrom).toBe('น้ำผลไม้')
    expect(res.replacedTo).toBe('ชาเขียวเย็น')
    expect(res.draft.map((d) => d.product.name).sort()).toEqual(['ข้าวมันไก่', 'ชาเขียวเย็น'])
    expect(res.total).toBe(60 + 35)
  })

  it('order-like-before without a modification = plain order-again draft', () => {
    const catalog = [product('p_rice', 'ข้าวมันไก่', 60), product('p_water', 'น้ำผลไม้', 25)]
    const order = {
      items: [
        { product_id: 'p_rice', product_name: 'ข้าวมันไก่', quantity: 1 },
        { product_id: 'p_water', product_name: 'น้ำผลไม้', quantity: 2 },
      ],
    }
    const res = applyOrderModify(order, catalog, {})
    expect(res.draft).toHaveLength(2)
    expect(res.total).toBe(60 + 25 * 2)
    expect(res.replacedFrom).toBeUndefined()
  })

  it('attachCustomizersToDraft attaches note + customizations to the target line', () => {
    const draft = [product('p1', 'Rice', 60), product('p2', 'Tea', 35)].map((p) => ({ product: p, quantity: 1 }))
    const customizers = [{ key: 'note', value: 'ADD EGG', note: 'ADD EGG' }]
    const out = attachCustomizersToDraft(draft, customizers, 'p2')
    expect(out[0].note).toBeUndefined()
    expect(out[1].note).toBe('ADD EGG')
    expect(out[1].customizations).toEqual({ note: 'ADD EGG' })
    expect(out[0].customizations).toBeUndefined()
  })

  it('attachCustomizersToDraft targets the first line when no id given', () => {
    const draft = [product('p1', 'Rice', 60)].map((p) => ({ product: p, quantity: 1 }))
    const out = attachCustomizersToDraft(draft, [{ key: 'note', value: 'SPICY', note: 'SPICY' }])
    expect(out[0].note).toBe('SPICY')
    expect(out[0].customizations).toEqual({ note: 'SPICY' })
  })

  it('attachCustomizersToDraft is a no-op with no customizers', () => {
    const draft = [product('p1', 'Rice', 60)].map((p) => ({ product: p, quantity: 1 }))
    expect(attachCustomizersToDraft(draft, [])).toBe(draft)
  })

  it('parseOrderIntent exposes an empty customizers array when no flags are present', () => {
    expect(parseOrderIntent('hello').customizers).toEqual([])
  })
})

describe('R73f — canonical customization vocabulary ↔ Thai (audit gap: customize mapping)', () => {
  it('maps "เพิ่มไข่" family to extra_egg:true (shape kitchenControl expects)', () => {
    expect(extractCustomizers('เพิ่มไข่')).toEqual([{ key: 'extra_egg', value: true, note: 'เพิ่มไข่' }])
    expect(extractCustomizers('ไข่เพิ่ม')).toEqual([{ key: 'extra_egg', value: true, note: 'เพิ่มไข่' }])
  })

  it('maps spice phrases to the canonical spicy levels (None/Mild/Hot)', () => {
    expect(extractCustomizers('เผ็ดน้อย')).toEqual([{ key: 'spicy', value: 'Mild', note: 'เผ็ดน้อย' }])
    expect(extractCustomizers('ไม่เผ็ด')).toEqual([{ key: 'spicy', value: 'None', note: 'ไม่เผ็ด' }])
    expect(extractCustomizers('เผ็ดมาก')).toEqual([{ key: 'spicy', value: 'Hot', note: 'เผ็ด' }])
    expect(extractCustomizers('เอาเผ็ด')).toEqual([{ key: 'spicy', value: 'Hot', note: 'เผ็ด' }])
  })

  it('maps "ไม่น้ำแข็ง" family to no_ice:true', () => {
    expect(extractCustomizers('ไม่น้ำแข็ง')).toEqual([{ key: 'no_ice', value: true, note: 'ไม่น้ำแข็ง' }])
    expect(extractCustomizers('ไม่ใส่น้ำแข็ง')).toEqual([{ key: 'no_ice', value: true, note: 'ไม่น้ำแข็ง' }])
  })

  it('handles combined phrases in one utterance (order preserved, one key each)', () => {
    const out = extractCustomizers('เพิ่มไข่ ไม่เผ็ด ไม่น้ำแข็ง')
    expect(out.map((c) => c.key)).toEqual(['extra_egg', 'spicy', 'no_ice'])
    expect(out.map((c) => c.value)).toEqual([true, 'None', true])
  })

  it('falls back to the plain note key outside the vocabulary (never invented)', () => {
    expect(extractCustomizers('เพิ่มผักชี')).toEqual([{ key: 'note', value: 'เพิ่ม ผักชี', note: 'เพิ่ม ผักชี' }])
    expect(extractCustomizers('ไม่ใส่หอม')).toEqual([{ key: 'note', value: 'ไม่ใส่ หอม', note: 'ไม่ใส่ หอม' }])
    expect(extractCustomizers('อร่อยมาก')).toEqual([])
  })
})

describe('R73f — order-again carries the real customizations/notes of past lines', () => {
  const catalog = [product('p1', 'ส้มตำ', 45), product('p2', 'ไก่ทอด', 60)]

  it('draft lines carry customizations + note from the past order', () => {
    const res = resolveOrderAgainFromOrder(
      {
        items: [
          {
            product_id: 'p1',
            product_name: 'ส้มตำ',
            quantity: 2,
            customizations: { extra_egg: true, spicy: 'Mild', addOns: [{ addonId: 'a1', selections: ['ปกติ'] }] },
            special_request: 'ไม่ใส่ถั่ว',
          },
          { product_id: 'p2', product_name: 'ไก่ทอด', quantity: 1 },
        ],
      },
      catalog,
    )
    const p1 = res.draft.find((d) => d.product.id === 'p1')
    expect(p1?.customizations).toEqual({ extra_egg: true, spicy: 'Mild', addOns: [{ addonId: 'a1', selections: ['ปกติ'] }] })
    expect(p1?.note).toBe('ไม่ใส่ถั่ว')
    const p2 = res.draft.find((d) => d.product.id === 'p2')
    expect(p2?.customizations).toBeUndefined()
    expect(p2?.note).toBeUndefined()
  })

  it('keeps note from item.note when special_request is absent', () => {
    const res = resolveOrderAgainFromOrder(
      { items: [{ product_id: 'p1', product_name: 'ส้มตำ', quantity: 1, note: 'เผ็ดน้อย' }] },
      catalog,
    )
    expect(res.draft[0].note).toBe('เผ็ดน้อย')
    expect(res.draft[0].customizations).toBeUndefined()
  })

  it('attachCustomizersToDraft merges new flags into the carried map (new wins)', () => {
    const res = resolveOrderAgainFromOrder(
      {
        items: [
          {
            product_id: 'p1',
            product_name: 'ส้มตำ',
            quantity: 1,
            customizations: { extra_egg: true, spicy: 'Mild' },
            note: 'ของเดิม',
          },
        ],
      },
      catalog,
    )
    const out = attachCustomizersToDraft(res.draft, [{ key: 'spicy', value: 'Hot', note: 'เผ็ด' }], 'p1')
    expect(out[0].customizations).toEqual({ extra_egg: true, spicy: 'Hot' })
    expect(out[0].note).toBe('ของเดิม、เผ็ด')
  })
})

describe('R73g — pickTrendingProducts (real sales ranking) + matchHelpTopic (contextual help)', () => {
  const catalog = [
    product('t1', 'ส้มตำ', 45, { is_featured: true }),
    product('t2', 'ไก่ทอด', 60),
    product('t3', 'ข้าวเหนียว', 15),
    product('t4', 'ของหมด', 20, { is_available: false }),
  ]

  it('ranks by real sold counts from menu_sales_stats', () => {
    const out = pickTrendingProducts(
      catalog,
      [
        { product_id: 't2', sold_count: 9 },
        { product_id: 't3', sold_count: 3 },
      ],
      3,
    )
    expect(out.map((p) => p.id)).toEqual(['t2', 't3', 't1'])
  })

  it('falls back to pickTopAvailable when no sales data (never fabricates)', () => {
    const out = pickTrendingProducts(catalog, [], 3)
    expect(out.map((p) => p.id).sort()).toEqual(['t1', 't2', 't3'])
    expect(pickTrendingProducts(catalog, null, 2)).toHaveLength(2)
  })

  it('tie-break = featured first (zero-sales items still eligible)', () => {
    const out = pickTrendingProducts(catalog, [{ product_id: 'zzz', sold_count: 1 }], 3)
    expect(out[0]?.id).toBe('t1')
  })

  it('never ranks unavailable/archived items even with sales', () => {
    const out = pickTrendingProducts(catalog, [{ product_id: 't4', sold_count: 99 }], 5)
    expect(out.some((p) => p.id === 't4')).toBe(false)
  })

  it('matchHelpTopic answers real how-to questions and ignores the rest', () => {
    expect(matchHelpTopic('สั่งยังไงครับ')?.title).toBe('วิธีสั่งอาหาร')
    expect(matchHelpTopic('คูปองใช้ยังไง')?.title).toBe('คูปอง/ส่วนลด')
    expect(matchHelpTopic('ติดตามออเดอร์หน่อย')?.title).toBe('ติดตามออเดอร์')
    expect(matchHelpTopic('วันนี้อากาศดีเนอะ')).toBeNull()
    expect(matchHelpTopic('')).toBeNull()
  })

  it('help answers stay factual (no fake promos/discounts)', () => {
    const t = matchHelpTopic('ส่วนลดมีอะไรบ้าง')
    expect(t?.answer).toContain('โค้ดส่วนลด')
    expect(t?.answer).not.toMatch(/ฟรี|ลด\s*\d+%/)
  })
})