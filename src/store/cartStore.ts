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
import type { CartItem as CartItemType, Product } from "@/types"
import type { PromotionRow } from "@/lib/bmbAdminApi_promotions"
import { evaluateCoupon } from "@/lib/promotionClient"
import type { OrderMode } from "@/config/platformConfig"
import { addOnTotalFor } from "@/lib/addonDisplay"
import { showToast } from "@/components/ui/ToastContainer"

export type AddToCartResult = 'added' | 'needs_confirmation' | 'context_blocked' | 'blocked'

/**
 * P0 WS4 (2026-10-14): stable identity for one cart LINE = product + mode +
 * options (object key order insensitive). Same product with DIFFERENT options
 * = separate lines (before: the 2nd add silently merged and DROPPED its
 * options); same product+mode+options merges quantities.
 */
export function lineKeyFor(
  productId: string,
  mode: OrderMode | undefined,
  customizations: Record<string, unknown> | undefined,
): string {
  const keys = Object.keys(customizations ?? {}).sort()
  const sig = JSON.stringify(keys.map((k) => [k, (customizations ?? {})[k]]))
  return `${productId}::${mode ?? 'SAME_DAY'}::${sig}`
}

interface CartStore {
  items: Array<CartItemType & { __context_tenant_id?: string; line_mode?: OrderMode; __line_key?: string }>
  couponCode: string
  appliedPromotion: PromotionRow | null
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
  removeItem: (productId: string, lineKey?: string) => void
  updateQuantity: (productId: string, quantity: number, lineKey?: string) => void
  clearCart: () => void
  setCouponCode: (code: string) => void
  setAppliedPromotion: (promo: PromotionRow | null) => void
  setDeliveryFee: (fee: number) => void
  setCheckoutOpen: (open: boolean) => void
  confirmModeSwitch: () => void
  cancelModeSwitch: () => void
  /** TEN-05: Resolve whether cart survives context change */
  resolveContextChange: (newTenantId: string, newBrandId: string) => 'cleared' | 'kept' | 'error'
  /** TEN-05: Set active context AND clear incompatible cart atomically */
  setContextAndClearIfIncompatible: (tenantId: string, brandId: string) => void

  /** D01: true once persisted-cart hydration has finished (even if nothing
      was stored) — lets Checkout avoid mistaking "restoring" for "empty". */
  isHydrated: boolean
  setHydrated: () => void

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
  isHydrated: false,
  setHydrated: () => set({ isHydrated: true }),

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

    // ✅ M1 (Owner Wave 2D-1, supersedes OD-4 single-mode lock): a cart may
    // REPRESENT eligible lines of both modes — a mismatched add no longer
    // discards. Each line keeps its own `line_mode`; `order_mode` stays the
    // primary (first) mode until checkout splitting (2D-2). Blocked ONLY when
    // the line is explicitly ineligible for its requested mode (server
    // (025 §5) remains the authority — this is an early, clear client guard).
    if (order_mode !== null && order_mode !== mode && items.length > 0) {
      const avail = product.is_available !== false
      // Lenient on missing flags (server 025 is the authority); block only on
      // an EXPLICIT canonical false (disabled for this mode).
      const eligible = mode === 'PRE_ORDER'
        ? product.available_preorder !== false
        : product.available_same_day !== false
      if (!avail || !eligible) {
        console.warn('[CartStore] Mixed line blocked: product not eligible for its mode.')
        return 'blocked'
      }
    }

    set((state) => {
      const key = lineKeyFor(product.id, mode, customizations)
      const lineId = (item: { __line_key?: string; product: Product; line_mode?: OrderMode; customizations: Record<string, any> }) =>
        item.__line_key ?? lineKeyFor(item.product.id, item.line_mode, item.customizations)
      const existingItem = state.items.find(item => lineId(item) === key)
      let newItems: Array<CartItemType & { __context_tenant_id?: string; line_mode?: OrderMode; __line_key?: string }>

      if (existingItem) {
        newItems = state.items.map(item => {
          if (lineId(item) !== key) return item
          const mergedQty = item.quantity + quantity
          // P0 WS4: recompute the line subtotal on merge — the old code kept the
          // stale subtotal while raising quantity → cart totals under-reported.
          return { ...item, quantity: mergedQty, subtotal: (Number(item.product.price) + addOnTotalFor(item)) * mergedQty }
        })
      } else {
        const unit = Number(product.price) + addOnTotalFor({ product, customizations })
        newItems = [...state.items, {
          product,
          quantity,
          customizations,
          subtotal: unit * quantity,
          __context_tenant_id: active_context_tenant_id!,
          line_mode: mode,
          __line_key: key,
        }]
      }

      return { items: newItems, order_mode: state.order_mode ?? mode }
    })
    get().recalculate()
    return 'added'
  },

  removeItem: (productId: string, lineKey?: string) => {
    set((state) => ({
      items: state.items.filter(item =>
        lineKey ? item.__line_key !== lineKey : item.product.id !== productId)
    }))
    get().recalculate()
  },

  updateQuantity: (productId: string, quantity: number, lineKey?: string) => {
    if (quantity <= 0) {
      get().removeItem(productId, lineKey)
      return
    }

    // P0 WS4: line-precise targeting (same product with different options can be
    // separate lines). No lineKey -> first line of that product (single-line
    // carts behave exactly as before).
    const target = lineKey
      ? get().items.find(i => i.__line_key === lineKey)
      : get().items.find(i => i.product.id === productId)
    if (!target) return
    
    set((state) => ({
      items: state.items.map(item =>
        item === target
          ? { ...item, quantity, subtotal: (Number(item.product.price) + addOnTotalFor(item)) * quantity }
          : item
      )
    }))
    get().recalculate()
  },

  clearCart: () => set({ items: [], couponCode: '', appliedPromotion: null, subtotal: 0, discount: 0, deliveryFee: 0, total: 0, order_mode: null, pendingMode: null, cartTotal: 0 }),

  // TEN-05: Resolve whether cart survives context change
  resolveContextChange: (newTenantId: string, newBrandId: string) => {
    const { items, active_context_tenant_id, active_context_brand_id } = get()
    if (items.length === 0) return 'kept'

    // P0 2026-10-14: context เดิมทุกประการ → คงตะกร้าไว้ (RD-03: ต้องเปลี่ยน
    // context เท่านั้นจึงล้าง — ของเดิมคืน 'cleared' ทุกกรณี = ล้างตะกร้าทิ้งเอง
    // ทุกครั้งที่ resolve ซ้ำด้วยค่าเดิม ทั้งที่ไม่มี boundary ใดถูกข้าม)
    if (active_context_tenant_id === newTenantId && active_context_brand_id === newBrandId) {
      return 'kept'
    }
    
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
        // P0 WS4: never discard items SILENTLY — tell the user why the cart went away.
        showToast('เปลี่ยนร้าน/บริบทการสั่ง — ตะกร้าเดิมถูกล้างเพื่อให้ราคาและสต็อกตรงกับร้านใหม่', 'warning')
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
    // REAL promotion rule (mirror of migration 114 — see promotionClient):
    // discount comes only from a live `promotions` row evaluated with the same
    // code lookup / date window / min-order / cap math the server applies.
    // The legacy fake vocabulary (fixed_discount/percentage_discount) is gone —
    // a real row that fails the rule yields a truthful 0 here and the server
    // re-derives the authoritative amount at order creation anyway.
    const evaluation = state.appliedPromotion
      ? evaluateCoupon([state.appliedPromotion], state.couponCode, subtotal)
      : null
    const discount = evaluation?.ok ? evaluation.discountAmount : 0

    const total = Math.max(0, subtotal - discount + state.deliveryFee)
    const cartTotal = subtotal

    set({ subtotal, discount, total, cartTotal })
  },

  getCartCount: () => get().items.reduce((sum, item) => sum + item.quantity, 0)
}))