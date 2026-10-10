import { useEffect, useState } from 'react'
import { getRuntimeAssetUrl } from '@/lib/bmbAdminApi_media'
import { getTheme, THEME_CHANGE_EVENT, type ThemeName } from '@/lib/theme'
import { defaultBackground } from '@/lib/backgrounds'

// ============================================
// Bite Me Baby — Site Background Layer (Stage C)
// ============================================
// ภาพพื้นหลังระดับเว็บ — คนละชั้นกับ content:
//   z-0 fixed + pointer-events:none → ไม่บังปุ่ม ไม่ขัด scroll
// Default = /assets/restaurant-bg (สลับตามธีม) · Admin override = asset_key
// `site.background` (registry เดิม — ไม่มีระบบชุดที่สอง) · โหลดไม่ได้ →
// ไม่ render img (พื้น gradient ของ body แสดงแทน = fallback อัตโนมัติ)
// ============================================
export function BackgroundLayer() {
  const [theme, setTheme] = useState<ThemeName>(() => getTheme())
  const [adminUrl, setAdminUrl] = useState<string | null>(null)

  useEffect(() => {
    let active = true
    void (async () => {
      try {
        const url = await getRuntimeAssetUrl('site.background')
        if (active && url) setAdminUrl(url)
      } catch {
        // registry unavailable → default image ของธีม
      }
    })()
    const onTheme = () => setTheme(getTheme())
    window.addEventListener(THEME_CHANGE_EVENT, onTheme)
    window.addEventListener('storage', onTheme)
    return () => {
      active = false
      window.removeEventListener(THEME_CHANGE_EVENT, onTheme)
      window.removeEventListener('storage', onTheme)
    }
  }, [])

  const src = adminUrl ?? defaultBackground(theme)

  return (
    <div className="site-background" aria-hidden="true">
      <div className="site-background__img" style={{ backgroundImage: `url("${src}")` }} />
      <div className="site-background__scrim" />
    </div>
  )
}