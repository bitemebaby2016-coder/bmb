// ============================================
// addonDisplay — readable add-on/topping lines for cart & order pages
// ============================================
import { describe, it, expect } from 'vitest'
import {
  resolveAddOnLines,
  addOnLinesFromChoices,
  addOnTotalFor,
  addOnSummaryText,
  getAddonForId,
} from '@/lib/addonDisplay'
import type { Product, ProductAddon } from '@/types'

const ADDONS: ProductAddon[] = [
  { id: 'ad-cheese', product_id: 'p1', name: 'Extra cheese', price: 15, type: 'checkbox', options: ['Normal', 'Extra cheese', 'Extra cheese x2'], max_selections: 2 },
  { id: 'ad-egg', product_id: 'p1', name: 'Extra egg', price: 10, type: 'radio', options: ['None', 'Soft egg', 'Fried egg'], max_selections: 1 },
  { id: 'ad-note', product_id: 'p1', name: 'Note', price: 5, type: 'text', options: [], max_selections: 1 },
]

function makeProduct(): Product {
  return {
    id: 'p1', name: 'Bowl', description: '', price: 65,
    category_id: 'c1', image_url: '', is_available: true, is_featured: true,
    is_preorder: false, prep_minutes: 10, sort_order: 0, created_at: '',
    addons: ADDONS,
  }
}

describe('addonDisplay', () => {
  it('getAddonForId finds the group by id', () => {
    expect(getAddonForId(ADDONS, 'ad-cheese')?.name).toBe('Extra cheese')
    expect(getAddonForId(ADDONS, 'nope')).toBeNull()
  })

  it('resolveAddOnLines renders checkbox & radio selections with prices', () => {
    const lines = resolveAddOnLines(makeProduct(), {
      addOns: [
        { addonId: 'ad-cheese', selections: ['Normal', 'Extra cheese x2'], note: '' },
        { addonId: 'ad-egg', selections: ['Fried egg'], note: '' },
      ],
    })
    expect(lines).toHaveLength(2)
    expect(lines[0]).toMatchObject({ groupName: 'Extra cheese', selections: ['Normal', 'Extra cheese x2'], unitPrice: 15, units: 2, linePrice: 30 })
    expect(lines[1]).toMatchObject({ groupName: 'Extra egg', selections: ['Fried egg'], unitPrice: 10, units: 1, linePrice: 10 })
  })

  it('text-type add-ons render note and cost one unit', () => {
    const lines = resolveAddOnLines(makeProduct(), {
      addOns: [{ addonId: 'ad-note', selections: [], note: '  no onions  ' }],
    })
    expect(lines).toHaveLength(1)
    const line = lines[0]
    expect(line.groupName).toBe('Note')
    expect(line.note).toBe('no onions')
    expect(line.units).toBe(1)
    expect(line.linePrice).toBe(5)
    expect(line.kind).toBe('text')
  })

  it('empty selections are skipped (radio/checkbox)', () => {
    const lines = resolveAddOnLines(makeProduct(), { addOns: [{ addonId: 'ad-cheese', selections: [], note: '' }] })
    expect(lines).toHaveLength(0)
  })

  it('addOnTotalFor sums the add-on estimate', () => {
    const item: any = { product: makeProduct(), customizations: { addOns: [{ addonId: 'ad-cheese', selections: ['Extra cheese'], note: '' }] } }
    expect(addOnTotalFor(item)).toBe(15)
  })

  it('addOnSummaryText produces a readable one-liner', () => {
    const item: any = { product: makeProduct(), customizations: { addOns: [{ addonId: 'ad-egg', selections: ['Fried egg'], note: '' }] } }
    const text = addOnSummaryText(item)
    expect(text).toContain('Extra egg')
    expect(text).toContain('Fried egg')
    expect(text).toContain('+฿10')
  })

  it('addOnLinesFromChoices supports order snapshots without full product', () => {
    const lines = addOnLinesFromChoices(ADDONS, [{ addonId: 'ad-cheese', selections: ['Extra cheese'], note: '' }])
    expect(lines[0].groupName).toBe('Extra cheese')
    // unknown addon id still yields a line (fallback to id) for visibility
    const unknown = addOnLinesFromChoices(ADDONS, [{ addonId: 'ad-mystery', selections: ['X'], note: '' }])
    expect(unknown[0].groupName).toBe('ad-mystery')
  })
})