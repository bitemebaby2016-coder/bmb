// ============================================
// Bite Me Baby — Order Builder (upsell / add-on / topping modal)
// Grab & 7-Eleven style: when the customer adds an item we show a sheet to
//   - pick toppings / add-ons (from products.addons),
//   - add recommended companion items (rule-based upsell),
// then add everything to the cart. Add-on prices are re-derived SERVER-SIDE
// (migration 016 → create_order_with_items), so the client only passes choices.
// ============================================

import { create } from 'zustand'
import type { Product } from '@/types'

export interface AddOnChoice {
  addonId: string
  addonName: string
  selections: string[]
  note?: string
}

export interface OrderBuilderResult {
  product: Product
  quantity: number
  addOns: AddOnChoice[]
  addOnTotal: number
  recommended: Product[]
}

interface OrderBuilderState {
  open: boolean
  product: Product | null
  catalog: Product[]
  onConfirm: ((result: OrderBuilderResult) => void) | null
  openBuilder: (
    product: Product,
    catalog: Product[],
    onConfirm: (result: OrderBuilderResult) => void,
  ) => void
  closeBuilder: () => void
}

/** Rule-based upsell picks: prefer different categories, then featured, limit N. */
export function pickRecommendations(product: Product, catalog: Product[], max = 4): Product[] {
  const others = (catalog || [])
    .filter((p) => p.id !== product.id && p.is_available !== false)
  const same = others.filter((p) => p.category_id === product.category_id)
  const diff = others.filter((p) => p.category_id !== product.category_id)
  const ranked = [
    ...diff.filter((p) => p.is_featured),
    ...same.filter((p) => p.is_featured),
    ...diff,
    ...same,
  ]
  const seen = new Set<string>()
  const out: Product[] = []
  for (const p of ranked) {
    if (seen.has(p.id)) continue
    seen.add(p.id)
    out.push(p)
    if (out.length >= max) break
  }
  return out
}

export const useOrderBuilderStore = create<OrderBuilderState>((set) => ({
  open: false,
  product: null,
  catalog: [],
  onConfirm: null,
  openBuilder: (product, catalog, onConfirm) => {
    document.body.classList.add('ob-lock')
    set({ open: true, product, catalog, onConfirm })
  },
  closeBuilder: () => {
    document.body.classList.remove('ob-lock')
    set({ open: false, product: null, catalog: [], onConfirm: null })
  },
}))