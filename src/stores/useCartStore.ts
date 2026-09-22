// ============================================
// Bite Me Baby — Cart Isolation Engine (Phase 3B: delegating shim)
// ============================================
// The SINGLE cart implementation now lives in `src/store/cartStore.ts` (which
// owns the SAME_DAY / PRE_ORDER isolation semantics + the live order path).
// This module keeps the historical isolation-store API for its existing
// consumers/tests (CartIsolationModal surface, `cartIsolationStore.test.ts`)
// by mirroring the canonical store — ONE effective order path, no duplicated
// state machine.
// ============================================

import { create } from 'zustand'
import { useCartStore as useBaseCartStore } from '@/store/cartStore'
import type { CartItem } from '@/types'
import type { Product } from '@/types'
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

function toIsolationItems(items: CartItem[]): IsolationCartItem[] {
  return items.map((i) => ({
    id: i.product.id,
    name: i.product.name,
    price: Number(i.product.price) || 0,
    quantity: i.quantity,
  }))
}

function baseItemToIso(id: string, name: string, price: number, quantity: number): Product {
  return {
    id,
    name,
    price,
    description: '',
    category_id: '',
    image_url: '',
    is_available: true,
    is_featured: false,
    is_preorder: false,
    prep_minutes: 0,
    sort_order: 0,
    created_at: '',
  } as Product
}

export const useCartStore = create<CartIsolationStore>((set) => {
  // Mirror the canonical store state (single source of truth).
  const base = useBaseCartStore.getState()
  useBaseCartStore.subscribe((s) => {
    set({
      items: toIsolationItems(s.items),
      order_mode: s.order_mode,
      pendingMode: s.pendingMode,
      cartTotal: s.cartTotal,
    })
  })

  return {
    items: toIsolationItems(base.items),
    order_mode: base.order_mode,
    pendingMode: base.pendingMode,
    cartTotal: base.cartTotal,

    addToCart: (item, mode) =>
      useBaseCartStore.getState().addItem(
        baseItemToIso(item.id, item.name, item.price, item.quantity),
        item.quantity,
        {},
        mode,
      ),

    confirmModeSwitch: () => useBaseCartStore.getState().confirmModeSwitch(),
    cancelModeSwitch: () => useBaseCartStore.getState().cancelModeSwitch(),
    clearCart: () => useBaseCartStore.getState().clearCart(),
  }
})
