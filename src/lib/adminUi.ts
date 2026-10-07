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
  { to: '/admin/menu-schedule', label: 'Menu Schedule', icon: '\uD83D\uDDD3\uFE0F' },
  { to: '/admin/kitchen', label: 'Kitchen/Production', icon: '\uD83C\uDF73' },
  { to: '/admin/recipes', label: 'Recipes/BOM', icon: '\uD83E\uDDEA' },
  { to: '/admin/content-approvals', label: 'Approve', icon: '\uD83D\uDED6\uFE0F' },
  { to: '/admin/rounds', label: 'Rounds', icon: '\uD83D\uDD50' },
  { to: '/admin/promotions', label: 'Promotions', icon: '\uD83C\uDF81' },
  { to: '/admin/customers', label: 'Customers', icon: '\uD83D\uDC65' },
  { to: '/admin/inventory', label: 'Inventory', icon: '\uD83E\uDD55' },
  { to: '/admin/delivery', label: 'Delivery', icon: '\uD83D\uDED5' },
  { to: '/admin/audit-log', label: 'Audit Log', icon: '\uD83D\uDCCB' },
  { to: '/admin/asset-audit', label: 'Asset Audit', icon: '\uD83D\uDD0D' },
{ to: '/admin/payment-exceptions', label: 'Payments', icon: '\uD83D\uDCB3' },
  { to: '/admin/notifications', label: 'Notifications', icon: '\uD83D\uDD14' },
  { to: '/admin/route-optimization', label: 'Route', icon: '\uD83D\uDDFA\uFE0F' },
  { to: '/admin/errors', label: 'Errors', icon: '\uD83E\uDE79' },
  { to: '/admin/media', label: 'Media', icon: '\uD83D\uDDBC\uFE0F' },
  { to: '/admin/portfolio', label: 'Portfolio', icon: '\uD83D\uDDBC\uFE0F' },
  { to: '/admin/ai-studio', label: 'AI Studio', icon: '\uD83E\uDD16' },
  { to: '/admin/settings', label: 'Settings', icon: '\u2699\uFE0F' },
  { to: '/admin/mascot', label: 'Mascot', icon: '\uD83E\uDD16' },
  // TEN-06: White-label control plane entries
  { to: '/admin/tenants', label: 'Tenants', icon: '\uD83C\uDFE2' },
  { to: '/admin/brands', label: 'Brands', icon: '\uD83C\uDFF3\uFE0F' },
  { to: '/admin/control', label: 'Control', icon: '\uD83D\uDED4\uFE0F' },
]

/** Whether the header / bottom nav should show the Admin link. */
export function shouldShowAdminLink(role: string | null | undefined, email?: string | null): boolean {
  // F-01 FIX (Wave 1): legacy email fallback (admin@bmb.co.th / owner@bmb.co.th)
  // ถูกถอดออกตาม Owner Decision 12 (ROTATE & REVOKE public credential) —
  // สิทธิ์ admin ต้องอิง profiles.role จาก DB ผ่าน RLS เท่านั้น ห้ามอิง email ฝั่ง client
  void email
  return role === 'admin'
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
  return { name: '', icon: '\uD83C\uDF7D\uFE0F', sort_order: 0, is_active: true, menu_section_id: '' }
}

