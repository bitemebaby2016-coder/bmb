// ============================================
// Bite Me Baby â€” Admin UI helpers (PHASE 6+ M1 CLOSURE)
// ============================================

export interface AdminNavItem {
  to: string
  label: string
  icon: string
}

/** Master admin navigation */
export const ADMIN_NAV_ITEMS: AdminNavItem[] = [
  { to: '/admin', label: 'à¸ à¸²à¸žà¸£à¸§à¸¡', icon: '\uD83D\uDCCA' },
  { to: '/admin/orders', label: 'à¸­à¸­à¹€à¸”à¸­à¸£à¹Œ', icon: '\uD83D\uDCE6' },
  { to: '/admin/products', label: 'à¹€à¸¡à¸™à¸¹', icon: '\uD83C\uDF7D\uFE0F' },
  { to: '/admin/menu-schedule', label: 'à¸•à¸²à¸£à¸²à¸‡à¹€à¸¡à¸™à¸¹', icon: '\uD83D\uDDD3\uFE0F' },
  { to: '/admin/kitchen', label: 'à¸„à¸£à¸±à¸§/à¸œà¸¥à¸´à¸•', icon: '\uD83C\uDF73' },
  { to: '/admin/recipes', label: 'à¸ªà¸¹à¸•à¸£à¸­à¸²à¸«à¸²à¸£', icon: '\uD83E\uDDEA' },
  { to: '/admin/marketing', label: 'à¸à¸²à¸£à¸•à¸¥à¸²à¸”', icon: '\uD83D\uDCE3' },
  { to: '/admin/content-approvals', label: 'à¸•à¸£à¸§à¸ˆà¹€à¸™à¸·à¹‰à¸­à¸«à¸²', icon: '\uD83D\uDED6\uFE0F' },
  { to: '/admin/rounds', label: 'à¸£à¸­à¸šà¸ˆà¸±à¸”à¸ªà¹ˆà¸‡', icon: '\uD83D\uDD50' },
  { to: '/admin/promotions', label: 'à¹‚à¸›à¸£à¹‚à¸¡à¸Šà¸±à¹ˆà¸™', icon: '\uD83C\uDF81' },
  { to: '/admin/customers', label: 'à¸¥à¸¹à¸à¸„à¹‰à¸²', icon: '\uD83D\uDC65' },
  { to: '/admin/inventory', label: 'à¸ªà¸•à¹‡à¸­à¸à¸§à¸±à¸•à¸–à¸¸à¸”à¸´à¸š', icon: '\uD83E\uDD55' },
  { to: '/admin/delivery', label: 'à¸ˆà¸±à¸”à¸ªà¹ˆà¸‡', icon: '\uD83D\uDED5' },
  { to: '/admin/audit-log', label: 'à¸šà¸±à¸™à¸—à¸¶à¸à¸à¸²à¸£à¸—à¸³à¸‡à¸²à¸™', icon: '\uD83D\uDCCB' },
  { to: '/admin/asset-audit', label: 'à¸•à¸£à¸§à¸ˆà¸£à¸¹à¸›à¸ªà¸´à¸™à¸„à¹‰à¸²', icon: '\uD83D\uDD0D' },
  { to: '/admin/pos', label: 'POS à¸«à¸™à¹‰à¸²à¸£à¹‰à¸²à¸™', icon: 'ðŸ§¾' },
  { to: '/admin/reports', label: 'à¸£à¸²à¸¢à¸‡à¸²à¸™à¸à¸²à¸£à¹€à¸‡à¸´à¸™', icon: 'ðŸ“Š' },
  { to: '/admin/notifications', label: 'à¸à¸²à¸£à¹à¸ˆà¹‰à¸‡à¹€à¸•à¸·à¸­à¸™', icon: '\uD83D\uDD14' },
  { to: '/admin/errors', label: 'à¸›à¸±à¸à¸«à¸²à¸£à¸°à¸šà¸š', icon: '\uD83E\uDE79' },
  { to: '/admin/media', label: 'à¸„à¸¥à¸±à¸‡à¸£à¸¹à¸›à¸ à¸²à¸ž', icon: '\uD83D\uDDBC\uFE0F' },
  { to: '/admin/portfolio', label: 'à¸œà¸¥à¸‡à¸²à¸™', icon: '\uD83D\uDDBC\uFE0F' },
  { to: '/admin/ai-studio', label: 'à¸ªà¸•à¸¹à¸”à¸´à¹‚à¸­ AI', icon: '\uD83E\uDD16' },
  { to: '/admin/settings', label: 'à¸•à¸±à¹‰à¸‡à¸„à¹ˆà¸²à¸£à¹‰à¸²à¸™', icon: '\u2699\uFE0F' },
  // TEN-06: White-label control plane entries
  { to: '/admin/tenants', label: 'à¸­à¸‡à¸„à¹Œà¸à¸£/à¸£à¹‰à¸²à¸™à¸„à¹‰à¸²', icon: '\uD83C\uDFE2' },
  { to: '/admin/brands', label: 'à¹à¸šà¸£à¸™à¸”à¹Œ', icon: '\uD83C\uDFF3\uFE0F' },
  { to: '/admin/control', label: 'à¸„à¸§à¸šà¸„à¸¸à¸¡à¸£à¹‰à¸²à¸™', icon: '\uD83D\uDED4\uFE0F' },
]

export interface AdminNavGroup {
  id: string
  label: string
  items: AdminNavItem[]
}

/**
 * Grouped navigation for the desktop Sidebar / mobile drawer (single nav set).
 * Invariant (asserted in tests): flatten(groups) === ADMIN_NAV_ITEMS (same set,
 * every item exactly once) â€” groups are presentation only, never a second menu.
 */
export const ADMIN_NAV_GROUPS: AdminNavGroup[] = [
  {
    id: 'overview',
    label: '\u0E2A\u0E33\u0E01\u0E2D\u0E1A',
    items: [
      { to: '/admin', label: 'à¸ à¸²à¸žà¸£à¸§à¸¡', icon: '\uD83D\uDCCA' },
      { to: '/admin/control', label: 'à¸„à¸§à¸šà¸„à¸¸à¸¡à¸£à¹‰à¸²à¸™', icon: '\uD83D\uDED4\uFE0F' },
    ],
  },
  {
    id: 'orders',
    label: '\u0E2D\u0E2D\u0E40\u0E14\u0E2D\u0E23\u0E4C \u0E41\u0E25\u0E30 \u0E04\u0E38\u0E13',
    items: [
      { to: '/admin/orders', label: 'à¸­à¸­à¹€à¸”à¸­à¸£à¹Œ', icon: '\uD83D\uDCE6' },
      { to: '/admin/pos', label: 'POS à¸«à¸™à¹‰à¸²à¸£à¹‰à¸²à¸™', icon: 'ðŸ§¾' },
      { to: '/admin/kitchen', label: 'à¸„à¸£à¸±à¸§/à¸œà¸¥à¸´à¸•', icon: '\uD83C\uDF73' },
      { to: '/admin/recipes', label: 'à¸ªà¸¹à¸•à¸£à¸­à¸²à¸«à¸²à¸£', icon: '\uD83E\uDDEA' },
      { to: '/admin/rounds', label: 'à¸£à¸­à¸šà¸ˆà¸±à¸”à¸ªà¹ˆà¸‡', icon: '\uD83D\uDD50' },
    ],
  },
  {
    id: 'menu',
    label: '\u0E40\u0E21\u0E19\u0E39 \u0E41\u0E25\u0E30 \u0E1D\u0E23\u0E21\u0E2D\u0E1A\u0E1E\u0E34\u0E40\u0E28\u0E29',
    items: [
      { to: '/admin/products', label: 'à¹€à¸¡à¸™à¸¹', icon: '\uD83C\uDF7D\uFE0F' },
      { to: '/admin/menu-schedule', label: 'à¸•à¸²à¸£à¸²à¸‡à¹€à¸¡à¸™à¸¹', icon: '\uD83D\uDDD3\uFE0F' },
      { to: '/admin/promotions', label: 'à¹‚à¸›à¸£à¹‚à¸¡à¸Šà¸±à¹ˆà¸™', icon: '\uD83C\uDF81' },
      { to: '/admin/content-approvals', label: 'à¸•à¸£à¸§à¸ˆà¹€à¸™à¸·à¹‰à¸­à¸«à¸²', icon: '\uD83D\uDED6\uFE0F' },
      { to: '/admin/marketing', label: 'à¸à¸²à¸£à¸•à¸¥à¸²à¸”', icon: '\uD83D\uDCE3' },
    ],
  },
  {
    id: 'customers',
    label: '\u0E25\u0E38\u0E01\u0E04\u0E19\u0E16\u0E32 \u0E41\u0E25\u0E30 \u0E04\u0E27\u0E19\u0E40\u0E17\u0E1E\u0E19\u0E31\u0E14',
    items: [
      { to: '/admin/customers', label: 'à¸¥à¸¹à¸à¸„à¹‰à¸²', icon: '\uD83D\uDC65' },
      { to: '/admin/notifications', label: 'à¸à¸²à¸£à¹à¸ˆà¹‰à¸‡à¹€à¸•à¸·à¸­à¸™', icon: '\uD83D\uDD14' },
      { to: '/admin/media', label: 'à¸„à¸¥à¸±à¸‡à¸£à¸¹à¸›à¸ à¸²à¸ž', icon: '\uD83D\uDDBC\uFE0F' },
      { to: '/admin/portfolio', label: 'à¸œà¸¥à¸‡à¸²à¸™', icon: '\uD83D\uDDBC\uFE0F' },
      { to: '/admin/ai-studio', label: 'à¸ªà¸•à¸¹à¸”à¸´à¹‚à¸­ AI', icon: '\uD83E\uDD16' },
    ],
  },
  {
    id: 'system',
    label: '\u0E23\u0E30\u0E1A \u0E41\u0E25\u0E30 \u0E15\u0E23\u0E27\u0E08\u0E2A\u0E2D\u0E1A',
    items: [
      { to: '/admin/inventory', label: 'à¸ªà¸•à¹‡à¸­à¸à¸§à¸±à¸•à¸–à¸¸à¸”à¸´à¸š', icon: '\uD83E\uDD55' },
      { to: '/admin/reports', label: 'à¸£à¸²à¸¢à¸‡à¸²à¸™à¸à¸²à¸£à¹€à¸‡à¸´à¸™', icon: 'ðŸ“Š' },
      { to: '/admin/delivery', label: 'à¸ˆà¸±à¸”à¸ªà¹ˆà¸‡', icon: '\uD83D\uDED5' },
      { to: '/admin/audit-log', label: 'à¸šà¸±à¸™à¸—à¸¶à¸à¸à¸²à¸£à¸—à¸³à¸‡à¸²à¸™', icon: '\uD83D\uDCCB' },
      { to: '/admin/asset-audit', label: 'à¸•à¸£à¸§à¸ˆà¸£à¸¹à¸›à¸ªà¸´à¸™à¸„à¹‰à¸²', icon: '\uD83D\uDD0D' },
      { to: '/admin/errors', label: 'à¸›à¸±à¸à¸«à¸²à¸£à¸°à¸šà¸š', icon: '\uD83E\uDE79' },
      { to: '/admin/settings', label: 'à¸•à¸±à¹‰à¸‡à¸„à¹ˆà¸²à¸£à¹‰à¸²à¸™', icon: '\u2699\uFE0F' },
      { to: '/admin/tenants', label: 'à¸­à¸‡à¸„à¹Œà¸à¸£/à¸£à¹‰à¸²à¸™à¸„à¹‰à¸²', icon: '\uD83C\uDFE2' },
      { to: '/admin/brands', label: 'à¹à¸šà¸£à¸™à¸”à¹Œ', icon: '\uD83C\uDFF3\uFE0F' },
    ],
  },
]

/** Whether the header / bottom nav should show the Admin link. */
export function shouldShowAdminLink(role: string | null | undefined, email?: string | null): boolean {
  // F-01 FIX (Wave 1): legacy email fallback (admin@bmb.co.th / owner@bmb.co.th)
  // à¸–à¸¹à¸à¸–à¸­à¸”à¸­à¸­à¸à¸•à¸²à¸¡ Owner Decision 12 (ROTATE & REVOKE public credential) â€”
  // à¸ªà¸´à¸—à¸˜à¸´à¹Œ admin à¸•à¹‰à¸­à¸‡à¸­à¸´à¸‡ profiles.role à¸ˆà¸²à¸ DB à¸œà¹ˆà¸²à¸™ RLS à¹€à¸—à¹ˆà¸²à¸™à¸±à¹‰à¸™ à¸«à¹‰à¸²à¸¡à¸­à¸´à¸‡ email à¸à¸±à¹ˆà¸‡ client
  // 129: staff (POS/kitchen counter) à¹€à¸«à¹‡à¸™à¸¥à¸´à¸‡à¸à¹Œà¹à¸­à¸”à¸¡à¸´à¸™à¹„à¸”à¹‰à¹€à¸Šà¹ˆà¸™à¸à¸±à¸™ â€” RLS à¸ˆà¸³à¸à¸±à¸”à¸‚à¹‰à¸­à¸¡à¸¹à¸¥à¸•à¸²à¸¡ role
  void email
  return role === 'admin' || role === 'staff'
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

/** Blank category form defaults (à¸£à¸°à¸šà¸šà¸«à¸±à¸§à¸‚à¹‰à¸­à¹€à¸¡à¸™à¸¹à¹€à¸”à¸µà¸¢à¸§ â€” à¹„à¸¡à¹ˆà¸¡à¸µà¸Šà¸±à¹‰à¸™ Section à¹à¸¥à¹‰à¸§). */
export function blankCategoryForm() {
  return { name: '', icon: '\uD83C\uDF7D\uFE0F', sort_order: 0, is_active: true }
}

