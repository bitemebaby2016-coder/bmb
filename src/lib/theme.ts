// ============================================
// Bite Me Baby — Theme Manager (orange / gray / dark)
// ============================================
// ธีมถูกเก็บใน localStorage (`bmb-theme`) และ apply เป็น
// `html[data-theme]` — CSS variants ทั้งหมดอยู่ใน src/index.css
// - 'orange' (ค่าเริ่มต้น) ไม่เขียน data-theme (ธีมส้ม-ขาวเดิม)
// - 'gray' / 'dark' เขียน attribute ที่ <html>
// index.html มี inline script อ่านค่าก่อน paint กันกระพริบ
// ============================================

export type ThemeName = 'orange' | 'gray' | 'dark'

export const THEME_STORAGE_KEY = 'bmb-theme'

export const THEME_LABELS: Record<ThemeName, string> = {
  orange: 'ส้ม',
  gray: 'เทา',
  dark: 'ดำ',
}

export function getTheme(): ThemeName {
  try {
    const v = localStorage.getItem(THEME_STORAGE_KEY)
    return v === 'gray' || v === 'dark' ? v : 'orange'
  } catch {
    return 'orange'
  }
}

export function applyTheme(theme: ThemeName): void {
  const root = document.documentElement
  if (theme === 'orange') root.removeAttribute('data-theme')
  else root.setAttribute('data-theme', theme)
  try {
    localStorage.setItem(THEME_STORAGE_KEY, theme)
  } catch {
    // private mode — ธีมยัง apply อยู่เฉพาะ session
  }
  // theme-color ของ browser chrome ให้ตรงธีม
  const meta = document.querySelector<HTMLMetaElement>('meta[name="theme-color"]')
  if (meta) meta.content = theme === 'dark' ? '#0C0C0E' : theme === 'gray' ? '#737373' : '#F97316'
}

/** วน theme ถัดไป: orange → gray → dark → orange */
export function cycleTheme(current: ThemeName): ThemeName {
  return current === 'orange' ? 'gray' : current === 'gray' ? 'dark' : 'orange'
}
