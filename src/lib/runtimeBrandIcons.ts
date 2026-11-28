// ============================================
// Bite Me Baby — Runtime brand icons (favicon / apple-touch / PWA manifest)
// ============================================
// ทำให้ไอคอนทั้งหมด (แท็บเบราว์เซอร์, apple-touch-icon, PWA manifest/splash)
// ตาม brandLogoUrl ที่แอดมินตั้ง (brands.logo_url_icon → platform config)
// แทนไฟล์นิ่ง pwa-*.png / favicon.svg ที่เป็น "B" สีส้ม — เปลี่ยนโลโก้ที่ใดเดียว
// (องค์กรและแบรนด์) ไอคอนทั้งหมดอัปเดตตาม ไม่ต้อง rebuild
// ============================================

/** Manifest สำหรับ runtime — โครงเดิมเหมือน vite.config (ชื่อ/สี) แต่ไอคอนใช้โลโก้แอดมิน */
export function buildRuntimeManifest(logoUrl: string) {
  const icon = logoUrl && logoUrl.trim() !== '' ? logoUrl.trim() : '/Head Logo.webp'
  return {
    name: 'Bite Me Baby - สั่งอาหารจัดส่งจันทบุรี',
    short_name: 'BMB',
    description: 'ร้านอาหารไทยจัดส่งถึงบ้านในรัศมี 5 กม. จากตัวเมืองจันทบุรี',
    theme_color: '#FF5E1E',
    background_color: '#FFF7ED',
    display: 'standalone',
    orientation: 'portrait',
    icons: [
      { src: icon, sizes: '192x192', type: 'image/png', purpose: 'any' },
      { src: icon, sizes: '512x512', type: 'image/png', purpose: 'any' },
      { src: icon, sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
  }
}

let manifestBlobUrl: string | null = null

/** ตั้ง/อัปเดตไอคอนทั้งหมดจากโลโก้แอดมิน (ปลอดภัยเมื่อไม่มี document เช่น test/SSR) */
export function applyRuntimeBrandIcons(logoUrl: string): void {
  if (typeof document === 'undefined') return
  const icon = logoUrl && logoUrl.trim() !== '' ? logoUrl.trim() : '/Head Logo.webp'

  // 1) favicon (แท็บเบราว์เซอร์)
  let iconEl = document.querySelector<HTMLLinkElement>('link[rel="icon"]')
  if (!iconEl) {
    iconEl = document.createElement('link')
    iconEl.rel = 'icon'
    document.head.appendChild(iconEl)
  }
  iconEl.href = icon

  // 2) apple-touch-icon (หน้าโฮม iOS)
  let appleEl = document.querySelector<HTMLLinkElement>('link[rel="apple-touch-icon"]')
  if (!appleEl) {
    appleEl = document.createElement('link')
    appleEl.rel = 'apple-touch-icon'
    document.head.appendChild(appleEl)
  }
  appleEl.href = icon

  // 3) PWA manifest (ไอคอนติดตั้ง + splash) — ใช้ blob URL ทับ manifest นิ่งตอน build
  try {
    const manifest = buildRuntimeManifest(icon)
    const blob = new Blob([JSON.stringify(manifest)], { type: 'application/manifest+json' })
    if (manifestBlobUrl) URL.revokeObjectURL(manifestBlobUrl)
    manifestBlobUrl = URL.createObjectURL(blob)
    let manifestEl = document.querySelector<HTMLLinkElement>('link[rel="manifest"]')
    if (!manifestEl) {
      manifestEl = document.createElement('link')
      manifestEl.rel = 'manifest'
      document.head.appendChild(manifestEl)
    }
    manifestEl.href = manifestBlobUrl
  } catch {
    // blob ไม่พร้อม (เช่น สภาพแวดล้อมแปลก) → คง manifest นิ่งเดิมไว้
  }
}