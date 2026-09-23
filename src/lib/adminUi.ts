// ============================================
// Bite Me Baby — Admin UI helpers (PHASE 6+ M1 CLOSURE)
// ============================================

export interface AdminNavItem {
  to: string
  label: string
  icon: string
}

/** Master admin navigation */
export const ADMIN_NAV_ITEMS: AdminNavItem[] = [
  { to: '/admin', label: 'Dashboard', icon: '\uD83D\uDCCA' },
  { to: '/admin/orders', label: 'Orders', icon: '\uD83D\uDCE6' },
  { to: '/admin/pre-orders', label: 'Pre-Orders', icon: '\uD83D\uDCC5' },
  { to: '/admin/products', label: 'Menu', icon: '\uD83C\uDF7D\uFE0F' },
  { to: '/admin/kitchen', label: 'Kitchen/Production', icon: '\uD83C\uDF73' },
  { to: '/admin/recipes', label: 'Recipes/BOM', icon: '\uD83E\uDDEA' },
  { to: '/admin/content-approvals', label: 'Approve', icon: '\uD83D\uDED6\uFE0F' },
  { to: '/admin/rounds', label: 'Rounds', icon: '\uD83D\uDD50' },
  { to: '/admin/promotions', label: 'Promotions', icon: '\uD83C\uDF81' },
  { to: '/admin/customers', label: 'Customers', icon: '\uD83D\uDC65' },
  { to: '/admin/inventory', label: 'Inventory', icon: '\uD83E\uDD55' },
  { to: '/admin/delivery', label: 'Delivery', icon: '\uD83D\uDED5' },
  { to: '/admin/audit-log', label: 'Audit Log', icon: '\uD83D\uDCCB' },
  { to: '/admin/route-optimization', label: 'Route', icon: '\uD83D\uDDFA\uFE0F' },
  { to: '/admin/errors', label: 'Errors', icon: '\uD83E\uDE79' },
  { to: '/admin/media', label: 'Media', icon: '\uD83D\uDDBC\uFE0F' },
  { to: '/admin/settings', label: 'Settings', icon: '\u2699\uFE0F' },
  { to: '/admin/mascot', label: 'Mascot', icon: '\uD83E\uDD16' },
  { to: '/admin/control', label: 'Control', icon: '\uD83D\uDED4\uFE0F' },
]

/** Whether the header / bottom nav should show the Admin link. */
export function shouldShowAdminLink(role: string | null | undefined, email?: string | null): boolean {
  if (role === 'admin') return true
  const legacy = (email ?? '').trim().toLowerCase()
  return legacy === 'admin@bmb.co.th' || legacy === 'owner@bmb.co.th'
}

/** Normalize a category heading name into a URL-safe slug. */
export function slugifyCategory(name: string): string {
  const slug = (name ?? '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
  return slug || ('cat-' + Date.now())
}

/** True when the image source is a data-URL or http(s). */
export function isImageSourceValid(source: string | null | undefined): boolean {
  if (!source) return false
  const pattern = /^(data:image\/(png|jpe?g|webp|gif);base64,)/i
  const httpPattern = /^https?:\/\/[^\s]+$/i
  return pattern.test(source) || httpPattern.test(source)
}

/** Blank category form defaults. */
export function blankCategoryForm() {
  return { name: '', icon: '\uD83C\uDF7D\uFE0F', sort_order: 0, is_active: true }
}

