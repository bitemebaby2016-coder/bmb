// ============================================
// Bite Me Baby — Theme Manager (light / dark) — TWO THEMES ONLY
// ============================================
// ธีมถูกเก็บใน localStorage (`bmb-theme`) และ apply เป็น
// `html[data-theme]` — CSS variants ทั้งหมดอยู่ใน src/index.css
// - 'light' = Light Minimal (ค่าเริ่มต้น)
// - 'dark'  = Dark Glass (charcoal + frosted glass)
// index.html มี inline script อ่านค่าก่อน paint กันกระพริบ
// MIGRATION (Owner 2026-10-10: เหลือ 2 ธีม — ยกเลิก 'gray'):
// - ค่าเก่า 'orange' -> 'light' · 'gray' -> 'dark' · 'dark' -> 'dark'
// - ค่าอื่น/หาย/อ่านไม่ได้ -> 'light' (deterministic)
// ============================================

export type ThemeName = 'light' | 'dark'

export const THEME_STORAGE_KEY = 'bmb-theme'

export const THEME_LABELS: Record<ThemeName, string> = {
  light: 'สว่าง (Light Minimal)',
  dark: 'มืด (Dark Glass)',
}

/** custom event ให้ component ที่ไม่ได้ถือ state (เช่น BackgroundLayer) รู้ว่าธีมเปลี่ยน */
export const THEME_CHANGE_EVENT = 'bmb:themechange'

/** deterministic migration จากค่าธีมเก่า (orange/gray/dark) */
export function migrateTheme(raw: string | null | undefined): ThemeName {
  if (raw === 'dark' || raw === 'gray') return 'dark'
  if (raw === 'light' || raw === 'orange') return 'light'
  return 'light'
}

export function getTheme(): ThemeName {
  try {
    return migrateTheme(localStorage.getItem(THEME_STORAGE_KEY))
  } catch {
    return 'light'
  }
}

export function applyTheme(theme: ThemeName): void {
  const root = document.documentElement
  root.setAttribute('data-theme', theme)
  try {
    localStorage.setItem(THEME_STORAGE_KEY, theme)
  } catch {
    // private mode — ธีมยัง apply อยู่เฉพาะ session
  }
  // theme-color ของ browser chrome ให้ตรงธีม (brand orange ค่าเดียว = #FF5E1E)
  const meta = document.querySelector<HTMLMetaElement>('meta[name="theme-color"]')
  if (meta) meta.content = theme === 'dark' ? '#121214' : '#FF5E1E'
  window.dispatchEvent(new CustomEvent(THEME_CHANGE_EVENT, { detail: theme }))
}

/** สลับ light <-> dark (2 ทางเท่านั้น) */
export function cycleTheme(current: ThemeName): ThemeName {
  return current === 'light' ? 'dark' : 'light'
}