// ============================================
// BMB — Food Theater editorial copy (admin-configurable, honest fallback)
// ============================================
// The theater's kicker/title/empty copy can be overridden via the EXISTING
// `business_settings` key `theater_editorial` (JSON object, edited through the
// existing AdminSettings JSON editor — no new CMS, no migration). Missing or
// invalid values fall back per-field to the defaults below, so an empty/locked
// table renders exactly today's copy. Pure logic — unit-tested.
// ============================================

export interface TheaterEditorialRaw {
  kicker?: unknown
  title_template?: unknown
  title_empty?: unknown
  empty_body?: unknown
  menu_cta?: unknown
}

export interface TheaterEditorial {
  kicker: string
  /** `{count}` placeholder = number of picks. */
  titleTemplate: string
  titleEmpty: string
  emptyBody: string
  menuCta: string
}

export const THEATER_EDITORIAL_DEFAULTS: TheaterEditorial = {
  kicker: 'BITE · AI WAITER STAGE',
  titleTemplate: 'วันนี้ผมเลือกมาให้ {count} อย่างครับ',
  titleEmpty: 'เดี๋ยวผมไปดูเมนูให้ก่อนครับ',
  emptyBody: 'ยังไม่มีเมนูที่พร้อมขายตอนนี้ครับ ดูเมนูทั้งหมดรอสักครู่ได้เลย',
  menuCta: '🍽️ ดูเมนูทั้งหมด',
}

function pickString(value: unknown, fallback: string): string {
  return typeof value === 'string' && value.trim().length > 0 ? value : fallback
}

/** Merge admin-provided copy over defaults, one field at a time (never empty). */
export function resolveTheaterEditorial(raw: unknown): TheaterEditorial {
  const d = THEATER_EDITORIAL_DEFAULTS
  const obj = (raw && typeof raw === 'object' ? raw : {}) as TheaterEditorialRaw
  return {
    kicker: pickString(obj.kicker, d.kicker),
    titleTemplate: pickString(obj.title_template, d.titleTemplate),
    titleEmpty: pickString(obj.title_empty, d.titleEmpty),
    emptyBody: pickString(obj.empty_body, d.emptyBody),
    menuCta: pickString(obj.menu_cta, d.menuCta),
  }
}

/** Render the title for the current pick count. */
export function renderTheaterTitle(editorial: TheaterEditorial, pickCount: number): string {
  if (pickCount <= 0) return editorial.titleEmpty
  return editorial.titleTemplate.replace(/\{count\}/g, String(pickCount))
}
