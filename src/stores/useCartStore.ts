// ============================================
// Bite Me Baby — Cart Isolation Engine
// ============================================
// Global operational state `order_mode: 'SAME_DAY' | 'PRE_ORDER' | null`.
// On `addToCart` we intercept the item's mode against the active mode:
//   - matching        -> append, order stays consistent.
//   - mismatched      -> set `pendingMode` and return 'needs_confirmation'
//                        (the global CartIsolationModal surfaces the approval
//                        prompt; user confirms ⇒ clear previous cart then switch).
// Decoupled from any UI — components only read state / call actions.

import { create } from 'zustand'
import type { OrderMode } from '@/config/platformConfig'

export interface IsolationCartItem {
  id: string
  name: string
  price: number
  quantity: number
  mode?: OrderMode
}

export type AddToCartResult = 'added' | 'needs_confirmation'

interface CartIsolationStore {
  items: IsolationCartItem[]
  order_mode: OrderMode | null
  /** Set when a mode-mismatch awaits the user's approval to clear the cart. */
  pendingMode: OrderMode | null
  /** Subtotal of current items (used by Bite AI upsell / free-shipping logic). */
  cartTotal: number

  addToCart: (item: IsolationCartItem, mode: OrderMode) => AddToCartResult
  /** Called by the modal on "ยืนยัน": clear the old cart, then apply the new mode. */
  confirmModeSwitch: () => void
  /** Called by the modal on "ยกเลิก": keep the current cart untouched. */
  cancelModeSwitch: () => void
  clearCart: () => void
}

export const useCartStore = create<CartIsolationStore>((set, get) => ({
  items: [],
  order_mode: null,
  pendingMode: null,
  cartTotal: 0,

  addToCart: (item, mode) => {
    const { order_mode, pendingMode, items } = get()

    // A switch is already awaiting confirmation — keep waiting.
    if (pendingMode) return 'needs_confirmation'

    // Isolation rule: a non-empty cart is locked to one order mode.
    if (order_mode !== null && order_mode !== mode && items.length > 0) {
      set({ pendingMode: mode })
      return 'needs_confirmation'
    }

    const existing = items.find((i) => i.id === item.id)
    const nextItems = existing
      ? items.map((i) => (i.id === item.id ? { ...i, quantity: i.quantity + item.quantity } : i))
      : [...items, { ...item, mode }]

    set({
      items: nextItems,
      order_mode: order_mode ?? mode,
      cartTotal: nextItems.reduce((sum, i) => sum + i.price * i.quantity, 0),
      pendingMode: null,
    })
    return 'added'
  },

  confirmModeSwitch: () => {
    const { pendingMode } = get()
    if (!pendingMode) return
    // Clear the previous cart before switching operational modes.
    set({ items: [], cartTotal: 0, order_mode: pendingMode, pendingMode: null })
  },

  cancelModeSwitch: () => {
    if (!get().pendingMode) return
    set({ pendingMode: null })
  },

  clearCart: () => set({ items: [], cartTotal: 0, order_mode: null, pendingMode: null }),
}))
