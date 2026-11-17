// ============================================
// Bite Me Baby — leafletLoader (R47 · 2026-11-17)
// ============================================
// Leaflet (OpenStreetMap) fallback loader — ใช้ร่วมกันทุกแผนที่ (RiderMiniMap / AdminLiveMap)
// เดิมอยู่ใน RiderMiniMap จุดเดียว — แอดมินเป็นฝั่งเดียวที่ไม่มี fallback map
// (Google ล้มในเบราว์เซอร์ → แอดมินเห็นแต่ข้อความพิกัด) → ยกเป็น lib เดียวทั้งระบบ
// CDN + SRI คงเดิมจากรอบ 44 (unpkg 1.9.4, sha256 ยืนยันตัวเนื้อไฟล์)
// ============================================

export const LEAFLET_CSS = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css'
export const LEAFLET_JS = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js'
export const OSM_TILE = 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png'
export const OSM_ATTRIBUTION = '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'

/** โหลด Leaflet ครั้งเดียวต่อหน้า (singleton ผ่าน window.L) — resolve = L พร้อมใช้ */
export function loadLeaflet(): Promise<void> {
  if ((window as any).L) return Promise.resolve()
  return new Promise((resolve, reject) => {
    if (document.querySelector(`link[href="${LEAFLET_CSS}"]`)) {
      // CSS already loaded
    } else {
      const cssLink = document.createElement('link')
      cssLink.rel = 'stylesheet'
      cssLink.href = LEAFLET_CSS
      cssLink.integrity = 'sha256-p4NxAoJBhIIN+hmNHrzRCf9tD/miZyoHS5obTRR9BMY='
      cssLink.crossOrigin = ''
      document.head.appendChild(cssLink)
    }
    if ((window as any).L) { resolve(); return }
    const script = document.createElement('script')
    script.src = LEAFLET_JS
    script.integrity = 'sha256-20nQCchB9co0qIjJZRGuk2/Z9VM+kNiyxNV1lvTlZBo='
    script.crossOrigin = ''
    script.onload = () => resolve()
    script.onerror = () => reject(new Error('Failed to load Leaflet'))
    document.head.appendChild(script)
  })
}
