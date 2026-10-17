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

export interface AdminNavGroup {
  id: string
  label: string
  items: AdminNavItem[]
}

/**
 * Grouped navigation for the desktop Sidebar / mobile drawer (single nav set).
 * Invariant (asserted in tests): flatten(groups) === ADMIN_NAV_ITEMS (same set,
 * every item exactly once) — groups are presentation only, never a second menu.
 */
export const ADMIN_NAV_GROUPS: AdminNavGroup[] = [
  {
    id: 'overview',
    label: '\u0E2A\u0E33\u0E01\u0E2D\u0E1A',
    items: [
      { to: '/admin', label: 'Dashboard', icon: '\uD83D\uDCCA' },
      { to: '/admin/control', label: 'Control', icon: '\uD83D\uDED4\uFE0F' },
    ],
  },
  {
    id: 'orders',
    label: '\u0E2D\u0E2D\u0E40\u0E14\u0E2D\u0E23\u0E4C \u0E41\u0E25\u0E30 \u0E04\u0E38\u0E13',
    items: [
      { to: '/admin/orders', label: 'Orders', icon: '\uD83D\uDCE6' },
      { to: '/admin/kitchen', label: 'Kitchen/Production', icon: '\uD83C\uDF73' },
      { to: '/admin/recipes', label: 'Recipes/BOM', icon: '\uD83E\uDDEA' },
      { to: '/admin/rounds', label: 'Rounds', icon: '\uD83D\uDD50' },
      { to: '/admin/payment-exceptions', label: 'Payments', icon: '\uD83D\uDCB3' },
    ],
  },
  {
    id: 'menu',
    label: '\u0E40\u0E21\u0E19\u0E39 \u0E41\u0E25\u0E30 \u0E1D\u0E23\u0E21\u0E2D\u0E1A\u0E1E\u0E34\u0E40\u0E28\u0E29',
    items: [
      { to: '/admin/products', label: 'Menu', icon: '\uD83C\uDF7D\uFE0F' },
      { to: '/admin/menu-schedule', label: 'Menu Schedule', icon: '\uD83D\uDDD3\uFE0F' },
      { to: '/admin/promotions', label: 'Promotions', icon: '\uD83C\uDF81' },
      { to: '/admin/content-approvals', label: 'Approve', icon: '\uD83D\uDED6\uFE0F' },
    ],
  },
  {
    id: 'customers',
    label: '\u0E25\u0E38\u0E01\u0E04\u0E19\u0E16\u0E32 \u0E41\u0E25\u0E30 \u0E04\u0E27\u0E19\u0E40\u0E17\u0E1E\u0E19\u0E31\u0E14',
    items: [
      { to: '/admin/customers', label: 'Customers', icon: '\uD83D\uDC65' },
      { to: '/admin/notifications', label: 'Notifications', icon: '\uD83D\uDD14' },
      { to: '/admin/media', label: 'Media', icon: '\uD83D\uDDBC\uFE0F' },
      { to: '/admin/portfolio', label: 'Portfolio', icon: '\uD83D\uDDBC\uFE0F' },
      { to: '/admin/ai-studio', label: 'AI Studio', icon: '\uD83E\uDD16' },
      { to: '/admin/mascot', label: 'Mascot', icon: '\uD83E\uDD16' },
    ],
  },
  {
    id: 'system',
    label: '\u0E23\u0E30\u0E1A \u0E41\u0E25\u0E30 \u0E15\u0E23\u0E27\u0E08\u0E2A\u0E2D\u0E1A',
    items: [
      { to: '/admin/inventory', label: 'Inventory', icon: '\uD83E\uDD55' },
      { to: '/admin/delivery', label: 'Delivery', icon: '\uD83D\uDED5' },
      { to: '/admin/route-optimization', label: 'Route', icon: '\uD83D\uDDFA\uFE0F' },
      { to: '/admin/audit-log', label: 'Audit Log', icon: '\uD83D\uDCCB' },
      { to: '/admin/asset-audit', label: 'Asset Audit', icon: '\uD83D\uDD0D' },
      { to: '/admin/errors', label: 'Errors', icon: '\uD83E\uDE79' },
      { to: '/admin/settings', label: 'Settings', icon: '\u2699\uFE0F' },
      { to: '/admin/tenants', label: 'Tenants', icon: '\uD83C\uDFE2' },
      { to: '/admin/brands', label: 'Brands', icon: '\uD83C\uDFF3\uFE0F' },
    ],
  },
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

/** Blank category form defaults (ระบบหัวข้อเมนูเดียว — ไม่มีชั้น Section แล้ว). */
export function blankCategoryForm() {
  return { name: '', icon: '\uD83C\uDF7D\uFE0F', sort_order: 0, is_active: true }
}

