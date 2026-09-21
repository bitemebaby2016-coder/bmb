// ============================================
// Bite Me Baby — Kitchen Core tests (Phase 2: INV-01/02, KIT-01/02)
// ============================================

import { describe, it, expect } from 'vitest'
import {
  bomFeasibility,
  summarizeBatchItems,
  type IngredientRequirement,
} from '@/lib/kitchenService'

function req(id: string, name: string, per: number, stock: number): IngredientRequirement {
  return {
    ingredient_id: id,
    ingredient_name: name,
    unit: 'kg',
    quantity_per_unit: per,
    required: per,
    current_stock: stock,
    min_stock: 1,
    feasible: stock >= per,
  }
}

describe('bomFeasibility (KIT-02 — availability จากสูตร)', () => {
  it('returns feasible when every ingredient covers the quantity', () => {
    const r = bomFeasibility([req('i1', 'ข้าว', 0.25, 5), req('i2', 'ไข่', 1, 10)], 1)
    expect(r.feasible).toBe(true)
    expect(r.blocking).toHaveLength(0)
    expect(r.minSaturation).toBeGreaterThan(1)
  })

  it('flags infeasible + lists blocking ingredients when stock is short', () => {
    const r = bomFeasibility([req('i1', 'ข้าว', 0.25, 0.1), req('i2', 'ไข่', 1, 10)], 1)
    expect(r.feasible).toBe(false)
    expect(r.blocking).toEqual(['ข้าว'])
  })

  it('empty recipe = always feasible (no BOM defined yet)', () => {
    expect(bomFeasibility([], 5).feasible).toBe(true)
  })
})

describe('summarizeBatchItems (KIT-01 — งานต่อ batch ครัว)', () => {
  it('aggregates per-product totals and unique order count', () => {
    const rows = summarizeBatchItems([
      { item_id: 'a', order_number: 'BMB-1', product_name: 'ผัดไทย', quantity: 2, status: 'queued' },
      { item_id: 'b', order_number: 'BMB-2', product_name: 'ผัดไทย', quantity: 3, status: 'queued' },
      { item_id: 'c', order_number: 'BMB-2', product_name: 'แกงเขียวหวาน', quantity: 1, status: 'queued' },
    ])
    const padThai = rows.find((r) => r.product_name === 'ผัดไทย')
    expect(padThai?.quantity).toBe(5)
    expect(padThai?.orderCount).toBe(2)
    expect(rows).toHaveLength(2)
    // sorted by quantity desc
    expect(rows[0].product_name).toBe('ผัดไทย')
  })
})