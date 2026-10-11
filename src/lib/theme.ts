// ============================================
// Bite Me Baby — Theme Manager (light / dark / graphite) — THREE THEMES
// ============================================
// ธีมถูกเก็บใน localStorage (`bmb-theme`) และ apply เป็น
// `html[data-theme]` — CSS variants ทั้งหมดอยู่ใน src/index.css
// - 'light'    = Light Minimal (ค่าเริ่มต้น)
// - 'dark'     = Dark Glass (charcoal + frosted glass)
// - 'graphite' = Graphite Theatre (เทาถ่าน + แผ่นกระจกเงา + accent ส้ม Bite)
// index.html มี inline script อ่านค่าก่อน paint กันกระพริบ
// MIGRATION (Owner 2026-10-10 เคยยกเลิก 'gray' — คงไว้เช่นเดิม):
// - ค่าเก่า 'orange' -> 'light' · 'gray' -> 'dark' · 'dark' -> 'dark'
// - ค่าอื่น/หาย/อ่านไม่ได้ -> 'light' (deterministic)
// - 'graphite' (ค่าใหม่) -> 'graphite'
// ============================================

export type ThemeName = 'light' | 'dark' | 'graphite'

export const THEME_STORAGE_KEY = 'bmb-theme'

export const THEME_LABELS: Record<ThemeName, string> = {
  light: 'สว่าง (Light Minimal)',
  dark: 'มืด (Dark Glass)',
  graphite: 'เทาถ่าน (Graphite Theatre)',
}

/** custom event ให้ component ที่ไม่ได้ถือ state (เช่น BackgroundLayer) รู้ว่าธีมเปลี่ยน */
export const THEME_CHANGE_EVENT = 'bmb:themechange'

/** deterministic migration จากค่าธีมเก่า (orange/gray/dark) + graphite ใหม่ */
export function migrateTheme(raw: string | null | undefined): ThemeName {
  if (raw === 'dark' || raw === 'gray') return 'dark'
  if (raw === 'light' || raw === 'orange') return 'light'
  if (raw === 'graphite') return 'graphite'
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
  // theme-color ของ browser chrome ให้ตรงธีม (light = brand orange #FF5E1E)
  const meta = document.querySelector<HTMLMetaElement>('meta[name="theme-color"]')
  if (meta) meta.content = theme === 'light' ? '#FF5E1E' : theme === 'graphite' ? '#1B1B20' : '#121214'
  window.dispatchEvent(new CustomEvent(THEME_CHANGE_EVENT, { detail: theme }))
}

/** สลับ light -> dark -> graphite -> light (3 ธีม) */
export function cycleTheme(current: ThemeName): ThemeName {
  return current === 'light' ? 'dark' : current === 'dark' ? 'graphite' : 'light'
}