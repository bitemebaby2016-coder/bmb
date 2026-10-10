// ============================================
// Bite Me Baby — Cart Persistence (Owner D01, 2026-10-10)
// ============================================
// Convenience cache ONLY — browser storage is untrusted and may be stale:
//   - persists the minimum selection data: product id, quantity,
//     customizations, order mode, coupon code. NEVER prices, totals,
//     discounts, stock, payment state or order state.
//   - hydration and pre-checkout revalidation rebuild items through the
//     canonical cartStore.addItem path against the CURRENT catalog
//     (getProducts = trusted source used by all pages), so display prices /
//     subtotals always come from fresh catalog data and the server keeps
//     re-deriving everything at order creation (RPC 025).
//   - removed / unavailable / mode-conflicting items are dropped EXPLICITLY
//     (reported + toast) — never silently turned into an incorrect order.
//   - restoring or revalidating a cart never creates an Order, Payment,
//     stock reservation or any business mutation.
// Context isolation (TEN-05): with FEATURE_BRAND_ROUTING OFF (current prod)
// BrandProvider never clears carts at boot; when the flag is ON someday, the
// boot resolution clears any non-empty cart by its existing RD-03 design —
// hydration is best-effort under that flag and re-runs only at next boot.
// ============================================

import { useCartStore } from '@/store/cartStore'
import type { Product } from '@/types'
import type { OrderMode } from '@/config/platformConfig'
import { showToast } from '@/components/ui/ToastContainer'

export const CART_STORAGE_KEY = 'bmb-cart-v1'
const SCHEMA_VERSION = 1

export interface StoredCartItem {
  productId: string
  quantity: number
  customizations?: Record<string, string | string[]>
  /** display-only hint for explicit drop notices (never persisted — see parse) */
  name?: string
}

export interface StoredCart {
  v: number
  savedAt: string
  order_mode: OrderMode | null
  couponCode: string
  items: StoredCartItem[]
}

export interface CartDrop {
  productId: string
  name: string
  reason: 'missing' | 'unavailable' | 'mode_conflict' | 'blocked'
}

export interface RestoreReport {
  restored: number
  dropped: CartDrop[]
}

interface SerializeSource {
  items: Array<{ product: Product; quantity: number; customizations?: Record<string, string | string[]> }>
  order_mode: OrderMode | null
  couponCode: string
}

/** Keep only plain string / string[] customization values (JSON-safe, minimal). */
function plainCustomizations(cust: unknown): Record<string, string | string[]> | undefined {
  if (!cust || typeof cust !== 'object' || Array.isArray(cust)) return undefined
  const out: Record<string, string | string[]> = {}
  for (const [key, value] of Object.entries(cust as Record<string, unknown>)) {
    if (typeof value === 'string') out[key] = value
    else if (Array.isArray(value) && value.every((v) => typeof v === 'string')) out[key] = value as string[]
  }
  return Object.keys(out).length > 0 ? out : undefined
}

/** Minimal serialization — ids/qty/customizations/mode/coupon only. */
export function serializeCart(state: SerializeSource): string {
  const payload: StoredCart = {
    v: SCHEMA_VERSION,
    savedAt: new Date().toISOString(),
    order_mode: state.order_mode ?? null,
    couponCode: typeof state.couponCode === 'string' ? state.couponCode : '',
    items: (state.items || [])
      .map((item) => ({
        productId: String(item.product?.id ?? ''),
        quantity: Math.max(1, Math.floor(Number(item.quantity) || 1)),
        customizations: plainCustomizations(item.customizations),
      }))
      .filter((row) => row.productId.length > 0),
  }
  return JSON.stringify(payload)
}

/** Strict shape validation — malformed / tampered / future-version → null. */
export function parseStoredCart(raw: string | null): StoredCart | null {
  if (!raw) return null
  let data: unknown
  try { data = JSON.parse(raw) } catch { return null }
  if (!data || typeof data !== 'object' || Array.isArray(data)) return null
  const c = data as Record<string, unknown>
  if (c.v !== SCHEMA_VERSION) return null
  if (!Array.isArray(c.items)) return null
  const orderMode: OrderMode | null =
    c.order_mode === 'PRE_ORDER' || c.order_mode === 'SAME_DAY' ? c.order_mode : null
  const items: StoredCartItem[] = []
  for (const row of c.items as unknown[]) {
    if (!row || typeof row !== 'object' || Array.isArray(row)) return null
    const item = row as Record<string, unknown>
    if (typeof item.productId !== 'string' || item.productId.length === 0) return null
    const qty = Number(item.quantity)
    if (!Number.isFinite(qty) || qty < 1) return null
    items.push({
      productId: item.productId,
      quantity: Math.min(99, Math.floor(qty)),
      customizations: plainCustomizations(item.customizations),
    })
  }
  return {
    v: SCHEMA_VERSION,
    savedAt: typeof c.savedAt === 'string' ? c.savedAt : '',
    order_mode: orderMode,
    couponCode: typeof c.couponCode === 'string' ? c.couponCode : '',
    items,
  }
}

/**
 * Rebuild stored selections against the CURRENT trusted catalog through the
 * canonical cartStore.addItem path (isolation semantics preserved). Explicitly
 * drops missing / unavailable / mode-conflicting rows and reports each one.
 */
export function restoreWithCatalog(stored: StoredCart, products: Product[]): RestoreReport {
  const byId = new Map(products.map((p) => [p.id, p]))
  const dropped: CartDrop[] = []
  let restored = 0
  for (const row of stored.items) {
    const product = byId.get(row.productId)
    if (!product) {
      dropped.push({ productId: row.productId, name: row.name || row.productId, reason: 'missing' })
      continue
    }
    if (product.is_available === false) {
      dropped.push({ productId: product.id, name: product.name, reason: 'unavailable' })
      continue
    }
    const mode: OrderMode = stored.order_mode ?? 'SAME_DAY'
    const res = useCartStore.getState().addItem(product, row.quantity, row.customizations ?? {}, mode)
    if (res === 'added') restored += 1
    else dropped.push({ productId: product.id, name: product.name, reason: res === 'needs_confirmation' ? 'mode_conflict' : 'blocked' })
  }
  if (restored > 0 && stored.couponCode) {
    useCartStore.getState().setCouponCode(stored.couponCode)
  }
  return { restored, dropped }
}

/**
 * Pre-checkout revalidation (D01): snapshot the current cart into the minimal
 * stored shape, clear it, then rebuild from the fresh catalog via the same
 * canonical path — prices/subtotals recalculate, stale rows drop explicitly.
 */
export function revalidateWithCatalog(products: Product[]): RestoreReport {
  const state = useCartStore.getState()
  if (state.items.length === 0) return { restored: 0, dropped: [] }
  const snapshot: StoredCart = {
    v: SCHEMA_VERSION,
    savedAt: '',
    order_mode: state.order_mode,
    couponCode: state.couponCode,
    items: state.items.map((item) => ({
      productId: item.product.id,
      quantity: item.quantity,
      customizations: plainCustomizations(item.customizations),
      name: item.product.name, // in-memory hint for the drop notice only
    })),
  }
  useCartStore.getState().clearCart()
  return restoreWithCatalog(snapshot, products)
}

/** Explicit user-facing notice for dropped items (Thai, matching app voice). */
export function reportToToastMessage(report: RestoreReport, context: 'hydrate' | 'checkout'): string | null {
  if (report.dropped.length === 0) return null
  const names = [...new Set(report.dropped.map((d) => d.name))].slice(0, 3).join(', ')
  const suffix = report.dropped.length > 3 ? ' และอื่น ๆ' : ''
  return context === 'hydrate'
    ? `นำรายการที่ใช้ไม่ได้ออกจากตะกร้า: ${names}${suffix}`
    : `อัปเดตรายการล่าสุด — เอาเมนูที่หมด/ถูกถอดออกแล้ว: ${names}${suffix}`
}

// ---------------- boot wiring ----------------

let initialized = false
let skipWrites = false
let writeTimer: ReturnType<typeof setTimeout> | null = null

function writeNow(): void {
  if (skipWrites) return
  try {
    const state = useCartStore.getState()
    if (state.items.length === 0 && !state.couponCode) {
      localStorage.removeItem(CART_STORAGE_KEY)
      return
    }
    localStorage.setItem(CART_STORAGE_KEY, serializeCart(state))
  } catch { /* private mode / quota — cart keeps working in-memory */ }
}

/**
 * Wire persistence once at app boot (main.tsx):
 *  - subscribe to selection changes -> debounced minimal write;
 *  - hydrate stored selections against the live catalog via the canonical
 *    addItem path, reporting dropped rows; never mutates anything server-side.
 */
export function initCartPersistence(fetchProducts: () => Promise<Product[]>): void {
  if (initialized || typeof window === 'undefined') return
  initialized = true

  useCartStore.subscribe((state, prev) => {
    if (state.items === prev.items && state.couponCode === prev.couponCode && state.order_mode === prev.order_mode) return
    if (writeTimer) clearTimeout(writeTimer)
    writeTimer = setTimeout(writeNow, 200)
  })

  skipWrites = true
  void (async () => {
    try {
      const stored = parseStoredCart(localStorage.getItem(CART_STORAGE_KEY))
      if (stored && stored.items.length > 0) {
        const catalog = await fetchProducts()
        const report = restoreWithCatalog(stored, catalog)
        const msg = reportToToastMessage(report, 'hydrate')
        if (msg) showToast(msg, 'warning')
        if (report.restored > 0) showToast(`กู้คืนตะกร้า ${report.restored} รายการให้แล้ว 🛒`, 'success')
        writeNow() // persist the reconciled (catalog-backed) state
      }
    } catch (e) {
      console.warn('[cartPersistence] hydration skipped (cart stays in-memory):', e)
    } finally {
      skipWrites = false
      useCartStore.getState().setHydrated()
    }
  })()
}

