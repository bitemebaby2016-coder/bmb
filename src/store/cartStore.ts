// ============================================
// Bite Me Baby — Cart Store (Phase 3B + TEN-05 Context Isolation)
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
// 
// TEN-05 ADDITION (RD-03: Strict Context Isolation):
//   - Each cart item tracks `__context_tenant_id` at time of addition.
//   - Context change detection: compare stored context against new resolved
//     context before allowing add-to-cart. If tenants differ → MUST clear.
//     If brands within same tenant differ → STRICT ISOLATION: also clear.
//   - No silent merge across context boundaries.
// ============================================

import { create } from "zustand"
import type { CartItem as CartItemType, Promotion, Product } from "@/types"
import type { OrderMode } from "@/config/platformConfig"
import { addOnTotalFor } from "@/lib/addonDisplay"

export type AddToCartResult = 'added' | 'needs_confirmation' | 'context_blocked'

interface CartStore {
  items: Array<CartItemType & { __context_tenant_id?: string }>
  couponCode: string
  appliedPromotion: Promotion | null
  subtotal: number
  discount: number
  deliveryFee: number
  total: number
  isCheckoutOpen: boolean
  order_mode: OrderMode | null
  pendingMode: OrderMode | null
  cartTotal: number
  // ✅ TEN-05: Current active context (set/replaced by BrandProvider)
  active_context_tenant_id: string | null
  active_context_brand_id: string | null

  addItem: (product: Product, quantity?: number, customizations?: Record<string, any>, mode?: OrderMode) => AddToCartResult
  removeItem: (productId: string) => void
  updateQuantity: (productId: string, quantity: number) => void
  clearCart: () => void
  setCouponCode: (code: string) => void
  setAppliedPromotion: (promo: Promotion | null) => void
  setDeliveryFee: (fee: number) => void
  setCheckoutOpen: (open: boolean) => void
  confirmModeSwitch: () => void
  cancelModeSwitch: () => void
  /** TEN-05: Resolve whether cart survives context change */
  resolveContextChange: (newTenantId: string, newBrandId: string) => 'cleared' | 'kept' | 'error'
  /** TEN-05: Set active context AND clear incompatible cart atomically */
  setContextAndClearIfIncompatible: (tenantId: string, brandId: string) => void

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
  active_context_tenant_id: null,
  active_context_brand_id: null,

  addItem: (product, quantity = 1, customizations = {}, mode = 'SAME_DAY') => {
    const { order_mode, pendingMode, items, active_context_tenant_id, active_context_brand_id } = get()

    // A switch is already awaiting confirmation — keep waiting.
    if (pendingMode) return 'needs_confirmation'

    // Check context compatibility before adding
    if (items.length > 0) {
      const firstItem = items[0]
      const itemTenant = firstItem.__context_tenant_id
      if (itemTenant && itemTenant !== active_context_tenant_id) {
        console.warn('[CartStore] Context mismatch: cannot add item from different tenant.')
        return 'context_blocked'
      }
    }

    // ✅ Isolation rule: a non-empty cart is locked to one order mode.
    if (order_mode !== null && order_mode !== mode && items.length > 0) {
      set({ pendingMode: mode })
      return 'needs_confirmation'
    }

    set((state) => {
      const existingItem = state.items.find(item => item.product.id === product.id)
      let newItems: Array<CartItemType & { __context_tenant_id?: string }>
      
      if (existingItem) {
        newItems = state.items.map(item =>
          item.product.id === product.id
            ? { ...item, quantity: item.quantity + quantity }
            : item
        )
      } else {
        const unit = Number(product.price) + addOnTotalFor({ product, customizations })
        newItems = [...state.items, {
          product,
          quantity,
          customizations,
          subtotal: unit * quantity,
          __context_tenant_id: active_context_tenant_id!
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

  // TEN-05: Resolve whether cart survives context change
  resolveContextChange: (newTenantId: string, newBrandId: string) => {
    const { items } = get()
    if (items.length === 0) return 'kept'
    
    // Check if ANY item belongs to a DIFFERENT tenant
    const hasCrossTenant = items.some(item => 
      item.__context_tenant_id && item.__context_tenant_id !== newTenantId
    )
    
    if (hasCrossTenant) return 'cleared' // Security boundary crossed
    // Same tenant but different brand → STRICT ISOLATION (RD-03): clear
    return 'cleared'
  },

  // TEN-05: Atomic context set + incompatible cart clear
  setContextAndClearIfIncompatible: (tenantId: string, brandId: string) => {
    const decision = get().resolveContextChange(tenantId, brandId)
    
    if (decision === 'cleared') {
      const count = get().getCartCount()
      if (count > 0) {
        console.warn(`[CartStore] Context changed (t=${tenantId}, b=${brandId}) — clearing ${count} incompatible items.`)
        get().clearCart()
      }
    }
    set({ active_context_tenant_id: tenantId, active_context_brand_id: brandId })
  },

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