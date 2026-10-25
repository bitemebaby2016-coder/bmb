// ============================================
// Bite Me Baby — Cart Store (Phase 3B + TEN-05 Context Isolation)
// ============================================
// Single canonical cart used by Menu/Home/Cart/Checkout. Owns the
// SAME_DAY / PRE_ORDER semantics (R5c 2026-10-23):
//   - one cart = ONE order; a cart with any menu-calendar line ships as
//     PRE_ORDER on the menu date (general items ride along in the same order);
//     no menu-calendar line = SAME_DAY only (no free-date pre-order);
//   - NO mode-switch / cart-clear popup (CartIsolationModal is gone) —
//     `deriveCartMode` derives the mode from the lines themselves.
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

export type AddToCartResult = 'added' | 'context_blocked' | 'blocked'

/**
 * R5c (Owner 2026-10-23): โหมดออเดอร์ของตะกร้า = ผลจากเนื้อตะกร้าเอง
 * - มีบรรทัดที่เพิ่มแบบ "จองล่วงหน้า" (เมนูจากปฏิทินแอดมิน) ≥ 1 → ทั้งตะกร้า = PRE_ORDER
 *   (สินค้าทั่วไปติดไปกับรอบพรีออเดอร์ในออเดอร์เดียว — ไม่แยก 2 ออเดอร์)
 * - ไม่มีเมนูปฏิทินในตะกร้า = SAME_DAY เท่านั้น (ไม่มีพรีออเดอร์วันอิสระ)
 */
export function deriveCartMode(items: ReadonlyArray<{ line_mode?: OrderMode } | undefined>): OrderMode | null {
  if (!items || items.length === 0) return null
  return items.some((i) => (i?.line_mode ?? 'SAME_DAY') === 'PRE_ORDER') ? 'PRE_ORDER' : 'SAME_DAY'
}

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

/**
 * [G&R 153] ฐานส่วนลดของแคมเปญที่จำกัดสินค้า — ยอดรวมบรรทัดที่สินค้าอยู่ใน scope
 * คืน undefined เมื่อแคมเปญลดทั้งออเดอร์ (evaluateCoupon ใช้ subtotal เอง)
 */
function eligibleForPromotion(
  items: Array<{ product: { id: string }; subtotal: number }>,
  promo: PromotionRow,
): number | undefined {
  if (promo.applies_to !== 'specific_products') return undefined
  const ids = new Set(promo.scope_product_ids ?? [])
  return items
    .filter((i) => ids.has(i.product.id))
    .reduce((sum, i) => sum + Math.max(0, i.subtotal), 0)
}

interface CartStore {
  items: Array<CartItemType & { __context_tenant_id?: string; line_mode?: OrderMode; __line_key?: string }>
  couponCode: string
  /** [G&R 154] โค้ดแนะนำเพื่อน (Deep-link ?ref= / ReferralBox) — อ้างอิงที่ checkout เท่านั้น ไม่ลดราคา */
  referralCode: string
  appliedPromotion: PromotionRow | null
  subtotal: number
  discount: number
  deliveryFee: number
  total: number
  isCheckoutOpen: boolean
  order_mode: OrderMode | null
  cartTotal: number
  // ✅ TEN-05: Current active context (set/replaced by BrandProvider)
  active_context_tenant_id: string | null
  active_context_brand_id: string | null

  addItem: (product: Product, quantity?: number, customizations?: Record<string, any>, mode?: OrderMode) => AddToCartResult
  removeItem: (productId: string, lineKey?: string) => void
  updateQuantity: (productId: string, quantity: number, lineKey?: string) => void
  clearCart: () => void
  setCouponCode: (code: string) => void
  setReferralCode: (code: string) => void
  setAppliedPromotion: (promo: PromotionRow | null) => void
  setDeliveryFee: (fee: number) => void
  setCheckoutOpen: (open: boolean) => void
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
  referralCode: '',
  appliedPromotion: null,
  subtotal: 0,
  discount: 0,
  deliveryFee: 0,
  total: 0,
  isCheckoutOpen: false,
  order_mode: null,
  cartTotal: 0,
  active_context_tenant_id: null,
  active_context_brand_id: null,
  isHydrated: false,
  setHydrated: () => set({ isHydrated: true }),

  addItem: (product, quantity = 1, customizations = {}, mode = 'SAME_DAY') => {
    const { items, active_context_tenant_id, active_context_brand_id } = get()

    // Check context compatibility before adding
    if (items.length > 0) {
      const firstItem = items[0]
      const itemTenant = firstItem.__context_tenant_id
      if (itemTenant && itemTenant !== active_context_tenant_id) {
        console.warn('[CartStore] Context mismatch: cannot add item from different tenant.')
        return 'context_blocked'
      }
    }

    // R5c (Owner 2026-10-23): ไม่มีการสลับโหมด/ล้างตะกร้าอีกต่อไป — สินค้าทุกชิ้น
    // อยู่ในตะกร้าเดียวและส่งร่วมรอบเดียวกัน (เมนูปฏิทินในตะกร้า = พรีออเดอร์ทั้งออเดอร์)
    // (preorder_ok/same_day_ok ยังคงเป็น gate ตอน submit — server 025/142 คือ authority)

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

      return { items: newItems }
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

  clearCart: () => set({ items: [], couponCode: '', referralCode: '', appliedPromotion: null, subtotal: 0, discount: 0, deliveryFee: 0, total: 0, order_mode: null, cartTotal: 0 }),

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

  setCouponCode: (code: string) => {
    set({ couponCode: code })
    // Owner fix 2026-10-19: ใส่โค้ดแล้วสรุปราคาต้องขยับทันที (เดิม discount ค้าง 0
    // จนกว่าจะมี event อื่นมาเรียก recalculate — ดูเหมือน "โปรโมชั่นใช้ไม่ได้")
    get().recalculate()
  },

  setReferralCode: (code: string) => {
    // [G&R 154] ไม่เรียก recalculate — โค้ดแนะนำเพื่อนไม่กระทบราคา (รางวัลออกตอนออเดอร์ผ่านสถานะ)
    set({ referralCode: code })
  },

  setAppliedPromotion: (promo) => {
    set({ appliedPromotion: promo })
    get().recalculate()
  },

  setDeliveryFee: (fee) => {
    set({ deliveryFee: fee })
    get().recalculate()
  },

  setCheckoutOpen: (open) => set({ isCheckoutOpen: open }),

  recalculate: () => {
    const state = get()
    const subtotal = state.items.reduce((sum, item) => sum + item.subtotal, 0)
    // REAL promotion rule (mirror of migration 114 + 153 — see promotionClient):
    // discount comes only from a live `promotions` row evaluated with the same
    // code lookup / date window / min-order / scope / max-cap / usage-cap math
    // the server applies. The legacy fake vocabulary (fixed_discount/percentage_discount)
    // is gone — a real row that fails the rule yields a truthful 0 here and the
    // server re-derives the authoritative amount at order creation anyway.
    // NOTE: kill switch / budget ไม่ได้ตรวจใน sync path นี้ (ไม่ยิง network) —
    // จุดบังคับจริง = fetchCouponEvaluation/revalidateCouponForSubmit ก่อนส่งออเดอร์ + server
    const evaluation = state.appliedPromotion
      ? evaluateCoupon([state.appliedPromotion], state.couponCode, subtotal, new Date(), {
          eligibleSubtotal: eligibleForPromotion(state.items, state.appliedPromotion),
        })
      : null
    const discount = evaluation?.ok ? evaluation.discountAmount : 0

    const total = Math.max(0, subtotal - discount + state.deliveryFee)
    const cartTotal = subtotal

    // R5c: โหมดของตะกร้า = ผลจากบรรทัดในตะกร้า (เมนูปฏิทิน ≥ 1 = พรีออเดอร์ทั้งออเดอร์)
    set({ subtotal, discount, total, cartTotal, order_mode: deriveCartMode(state.items) })
  },

  getCartCount: () => get().items.reduce((sum, item) => sum + item.quantity, 0)
}))