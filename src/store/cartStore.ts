// ============================================
// Bite Me Baby — Cart Store (Phase 3B: ONE mode-locked order path)
// ============================================
// Single canonical cart used by Menu/Home/Cart/Checkout. Owns the
// SAME_DAY / PRE_ORDER isolation semantics previously duplicated in
// `src/stores/useCartStore.ts` (that file is now a delegating shim):
//   - a non-empty cart is locked to one order mode;
//   - mismatched add → `pendingMode` + 'needs_confirmation'
//     (the global CartIsolationModal surfaces the approval prompt; user
//     confirms ⇒ clear the previous cart then switch).
// Prices here are DISPLAY ONLY — the server re-derives subtotal/discount/
// delivery fee/total at order creation (migrations 016/025).
// ============================================

import { create } from "zustand"
import type { CartItem, Promotion, Product } from "@/types"
import type { OrderMode } from "@/config/platformConfig"
import { addOnTotalFor } from "@/lib/addonDisplay"

export type AddToCartResult = 'added' | 'needs_confirmation'

interface CartStore {
  items: CartItem[]
  couponCode: string
  appliedPromotion: Promotion | null
  subtotal: number
  discount: number
  deliveryFee: number
  total: number
  isCheckoutOpen: boolean
  // ✅ Phase 3B: mode isolation (canonical orders.order_mode vocabulary)
  order_mode: OrderMode | null
  /** Set when a mode-mismatch awaits the user's approval to clear the cart. */
  pendingMode: OrderMode | null
  /** Running display subtotal (Bite AI upsell / free-shipping logic). */
  cartTotal: number

  // Actions
  addItem: (product: Product, quantity?: number, customizations?: Record<string, any>, mode?: OrderMode) => AddToCartResult
  removeItem: (productId: string) => void
  updateQuantity: (productId: string, quantity: number) => void
  clearCart: () => void
  setCouponCode: (code: string) => void
  setAppliedPromotion: (promo: Promotion | null) => void
  setDeliveryFee: (fee: number) => void
  setCheckoutOpen: (open: boolean) => void
  /** Called by the isolation modal on "ยืนยัน": clear the old cart, then apply the new mode. */
  confirmModeSwitch: () => void
  /** Called by the isolation modal on "ยกเลิก": keep the current cart untouched. */
  cancelModeSwitch: () => void

  // Calculations
  recalculate: () => void
  getCartCount: () => number
}

export const useCartStore = create<CartStore>((set, get) => ({
  items: [],
  couponCode: '',
  appliedPromotion: null,
  subtotal: 0,
  discount: 0,
  deliveryFee: 0,
  total: 0,
  isCheckoutOpen: false,
  order_mode: null,
  pendingMode: null,
  cartTotal: 0,

  addItem: (product, quantity = 1, customizations = {}, mode = 'SAME_DAY') => {
    const { order_mode, pendingMode, items } = get()

    // A switch is already awaiting confirmation — keep waiting.
    if (pendingMode) return 'needs_confirmation'

    // ✅ Isolation rule: a non-empty cart is locked to one order mode.
    if (order_mode !== null && order_mode !== mode && items.length > 0) {
      set({ pendingMode: mode })
      return 'needs_confirmation'
    }

    set((state) => {
      const existingItem = state.items.find(item => item.product.id === product.id)
      let newItems: CartItem[]
      
      if (existingItem) {
        newItems = state.items.map(item =>
          item.product.id === product.id
            ? { ...item, quantity: item.quantity + quantity }
            : item
        )
      } else {
        // Client-side add-on estimate only — the server re-derives the price
        // (migration 016 compute_addons_price) at order creation.
        const unit = Number(product.price) + addOnTotalFor({ product, customizations })
        newItems = [...state.items, {
          product,
          quantity,
          customizations,
          subtotal: unit * quantity
        }]
      }
      
      return { items: newItems, order_mode: state.order_mode ?? mode }
    })
    get().recalculate()
    return 'added'
  },

  removeItem: (productId: string) => {
    set((state) => ({
      items: state.items.filter(item => item.product.id !== productId)
    }))
    get().recalculate()
  },

  updateQuantity: (productId: string, quantity: number) => {
    if (quantity <= 0) {
      get().removeItem(productId)
      return
    }
    
    set((state) => ({
      items: state.items.map(item =>
        item.product.id === productId
          ? { ...item, quantity, subtotal: (Number(item.product.price) + addOnTotalFor(item)) * quantity }
          : item
      )
    }))
    get().recalculate()
  },

  clearCart: () => set({ items: [], couponCode: '', appliedPromotion: null, subtotal: 0, discount: 0, deliveryFee: 0, total: 0, order_mode: null, pendingMode: null, cartTotal: 0 }),

  setCouponCode: (code: string) => set({ couponCode: code }),

  setAppliedPromotion: (promo) => set({ appliedPromotion: promo }),

  setDeliveryFee: (fee) => {
    set({ deliveryFee: fee })
    get().recalculate()
  },

  setCheckoutOpen: (open) => set({ isCheckoutOpen: open }),

  confirmModeSwitch: () => {
    const { pendingMode } = get()
    if (!pendingMode) return
    // Clear the previous cart before switching operational modes.
    set({ items: [], subtotal: 0, discount: 0, total: 0, cartTotal: 0, order_mode: pendingMode, pendingMode: null })
  },

  cancelModeSwitch: () => {
    if (!get().pendingMode) return
    set({ pendingMode: null })
  },

  recalculate: () => {
    const state = get()
    const subtotal = state.items.reduce((sum, item) => sum + item.subtotal, 0)
    const discount = state.appliedPromotion 
      ? state.appliedPromotion.type === 'fixed_discount' 
        ? Math.min(state.appliedPromotion.discount_value, subtotal)
        : state.appliedPromotion.type === 'percentage_discount'
          ? Math.min(subtotal * (state.appliedPromotion.discount_value / 100), state.appliedPromotion.max_discount_cap || subtotal)
          : 0
      : 0
    
    const total = Math.max(0, subtotal - discount + state.deliveryFee)
    const cartTotal = subtotal
    
    set({ subtotal, discount, total, cartTotal })
  },

  getCartCount: () => get().items.reduce((sum, item) => sum + item.quantity, 0)
}))