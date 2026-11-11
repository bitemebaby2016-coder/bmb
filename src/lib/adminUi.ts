// ============================================
// Bite Me Baby — Admin UI helpers (PHASE 6+ M1 CLOSURE)
// ============================================

export interface AdminNavItem {
  to: string
  label: string
  icon: string
}

export interface AdminNavGroup {
  id: string
  label: string
  items: AdminNavItem[]
}

/**
 * Grouped navigation for the desktop Sidebar / mobile drawer (single nav set).
 * Invariant (asserted in tests): flatten(groups) === ADMIN_NAV_ITEMS (same set,
 * every item exactly once) — groups are presentation only, never a second menu.
 * Consolidated to 3 groups: operations, customers, settings
 */
export const ADMIN_NAV_GROUPS: AdminNavGroup[] = [
  {
    id: 'operations',
    label: 'ดำเนินงาน',
    items: [
      { to: '/admin', label: 'ภาพรวม', icon: '\uD83D\uDCCA' },
      { to: '/admin/orders', label: 'ออเดอร์', icon: '\uD83D\uDCE6' },
      { to: '/admin/pos', label: 'POS หน้าร้าน', icon: '🧾' },
      { to: '/admin/kitchen', label: 'ครัว/ผลิต', icon: '\uD83C\uDF73' },
      { to: '/admin/recipes', label: 'สูตรอาหาร', icon: '\uD83E\uDDEA' },
      { to: '/admin/products', label: 'เมนูและตารางเมนู', icon: '\uD83C\uDF7D\uFE0F' },
      { to: '/admin/marketing', label: 'การตลาดและโปรโมชั่น', icon: '📈' },
    ],
  },
  {
    id: 'customers',
    label: 'ลูกค้าและเนื้อหา',
    items: [
      { to: '/admin/customers', label: 'ลูกค้า', icon: '\uD83D\uDC65' },
      { to: '/admin/notifications', label: 'การแจ้งเตือน', icon: '\uD83D\uDD14' },
      { to: '/admin/media-portfolio', label: 'คลังรูปภาพและผลงาน', icon: '\uD83D\uDDBC\uFE0F' },
      { to: '/admin/reviews', label: 'อนุมัติรีวิว', icon: '⭐' },
    ],
  },
  {
    id: 'settings',
    label: 'ตั้งค่าระบบ',
    items: [
      { to: '/admin/inventory', label: 'สต็อกวัตถุดิบ', icon: '\uD83E\uDD55' },
      { to: '/admin/reports', label: 'รายงานการเงิน', icon: '📊' },
      { to: '/admin/delivery', label: 'การขนส่ง (ศูนย์ขนส่ง)', icon: '\uD83D\uDED5' },
      { to: '/admin/audit-log', label: 'บันทึกการทำงาน', icon: '\uD83D\uDCCB' },
      { to: '/admin/errors', label: 'ปัญหาระบบ', icon: '\uD83E\uDE79' },
      { to: '/admin/settings', label: 'ตั้งค่าร้าน', icon: '\u2699\uFE0F' },
      { to: '/admin/tenants', label: 'องค์กรและแบรนด์', icon: '\uD83C\uDFE2' },
      { to: '/admin/onboarding', label: 'เปิดร้านใหม่ (วิซาร์ด)', icon: '✨' },
      { to: '/admin/billing', label: 'งวดบริการ (การเรียกเก็บเงิน)', icon: '💳' },
    ],
  },
]

/** Master admin navigation — DERIVED FROM groups (audit D10: single source · flatten invariant) */
export const ADMIN_NAV_ITEMS: AdminNavItem[] = ADMIN_NAV_GROUPS.flatMap((g) => g.items)

/** Whether the header / bottom nav should show the Admin link. */
export function shouldShowAdminLink(role: string | null | undefined, email?: string | null): boolean {
  // F-01 FIX (Wave 1): legacy email fallback (admin@bmb.co.th / owner@bmb.co.th)
  // ถูกถอดออกตาม Owner Decision 12 (ROTATE & REVOKE public credential) —
  // สิทธิ์ admin ต้องอิง profiles.role จาก DB ผ่าน RLS เท่านั้น ห้ามอิง email ฝั่ง client
  // 129: staff (POS/kitchen counter) เห็นลิงก์แอดมินได้เช่นกัน — RLS จำกัดข้อมูลตาม role
  // 146 (Owner signed P1-P3): ใช้ชุดค่า role 11 ค่า (owner/admin/staff/pos/specialists/
  // auditor/support/developer) — rider/customer ไม่เข้า /admin
  void email
  return isAdminCapableRole(role)
}

/** 146 — ชุด role ที่เข้า /admin ได้ (parity กับ server AdminRoute + RLS) */
export const ADMIN_CAPABLE_ROLES: readonly string[] = [
  'owner', 'admin', 'staff', 'pos', 'kitchen', 'inventory', 'finance',
  'marketing', 'support', 'auditor', 'developer',
]

export function isAdminCapableRole(role: string | null | undefined): boolean {
  return !!role && ADMIN_CAPABLE_ROLES.includes(role)
}

/**
 * 146 — per-role nav (presentation only — RLS ยังเป็นประตูจริง):
 *   ไม่มี allowlist (owner/admin/staff/auditor/developer/unknown) = ทุกกลุ่ม
 *   specialist/pos/support = เฉพาะกลุ่มที่เกี่ยวข้อง
 * Updated for 3-group structure with merged pages
 */
const ROLE_NAV_ALLOW: Record<string, string[]> = {
  pos: ['/admin', '/admin/orders', '/admin/pos', '/admin/customers', '/admin/reports'],
  kitchen: ['/admin', '/admin/orders', '/admin/kitchen', '/admin/recipes', '/admin/delivery', '/admin/products'],
  inventory: ['/admin', '/admin/inventory', '/admin/products'],
  finance: ['/admin', '/admin/reports', '/admin/orders', '/admin/pos'],
  marketing: ['/admin', '/admin/marketing', '/admin/media-portfolio'],
  support: ['/admin', '/admin/orders', '/admin/customers', '/admin/notifications'],
}

export function navGroupsForRole(role: string | null | undefined): AdminNavGroup[] {
  const allow = role ? ROLE_NAV_ALLOW[role] : undefined
  if (!allow) return ADMIN_NAV_GROUPS
  return ADMIN_NAV_GROUPS.map((g) => ({
    ...g,
    items: g.items.filter((i) => allow.some((p) => i.to === p || (p !== '/admin' && i.to.startsWith(p + '/')))),
  })).filter((g) => g.items.length > 0)
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
  return { name: '', icon: '\uD83C\uDF7D\uFE0F', sort_order: 0, is_active: true, allow_same_day: true, allow_pre_order: true }
}