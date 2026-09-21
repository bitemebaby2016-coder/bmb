// ============================================
// Bite Me Baby — Admin UI helpers (PHASE 6 UI/admin completion)
// Pure, testable helpers for admin navigation, category headings and
// image handling. No Supabase calls here — UI pages consume these.
// ============================================

export interface AdminNavItem {
  to: string
  label: string
  icon: string
}

/** Master admin navigation — every /admin route that should be reachable. */
export const ADMIN_NAV_ITEMS: AdminNavItem[] = [
  { to: '/admin', label: 'แดšборд', icon: '📊' },
  { to: '/admin/orders', label: 'ออเดอร์', icon: '📦' },
  { to: '/admin/products', label: 'เมนู', icon: '🍽️' },
  { to: '/admin/content-approvals', label: 'อนุมতি', icon: '🛡️' },
  { to: '/admin/rounds', label: 'รอบ', icon: '🕐' },
  { to: '/admin/promotions', label: 'โปรโม', icon: '🎁' },
  { to: '/admin/customers', label: 'ลูกค้า', icon: '👥' },
  { to: '/admin/inventory', label: 'วัตถุดิบ', icon: '🥕' },
  { to: '/admin/media', label: 'สื่อ', icon: '🖼️' },
  { to: '/admin/settings', label: 'ตั้งค่า', icon: '⚙️' },
  { to: '/admin/delivery', label: 'ส่งของ', icon: '🛵' },
  { to: '/admin/audit-log', label: 'Audit', icon: '📋' },
  { to: '/admin/route-optimization', label: 'เส้นทาง', icon: '🗺️' },
  { to: '/admin/errors', label: 'Errors', icon: '🩹' },
  { to: '/admin/mascot', label: 'มาสคট', icon: '🤖' },
  { to: '/admin/control', label: 'Control', icon: '🛎️' },
]

/**
 * Whether the header / bottom nav should surface the Admin dashboard link.
 * Role comes from Supabase `profiles.role` (RLS-guarded) — never from a
 * hardcoded email. Legacy fallback: the original seeded admin email keeps
 * working even if the role row is missing.
 */
export function shouldShowAdminLink(role: string | null | undefined, email?: string | null): boolean {
  if (role === 'admin') return true
  const legacy = (email ?? '').trim().toLowerCase()
  return legacy === 'admin@bmb.co.th' || legacy === 'owner@bmb.co.th'
}

/** Normalize a category heading name into a URL-safe slug (Thai-safe fallback). */
export function slugifyCategory(name: string): string {
  const slug = (name ?? '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
  return slug || `cat-${Date.now()}`
}

/** True when the image source is a data-URL (client upload preview) or http(s). */
export function isImageSourceValid(source: string | null | undefined): boolean {
  if (!source) return false
  return /^(data:image\/(png|jpe?g|webp|gif);base64,)/i.test(source) || /^https?:\/\/[^\s]+$/i.test(source)
}

/** Round trip helper — category row ↔ form draught (new heading defaults). */
export function blankCategoryForm() {
  return { name: '', icon: '🍽️', sort_order: 0, is_active: true }
}