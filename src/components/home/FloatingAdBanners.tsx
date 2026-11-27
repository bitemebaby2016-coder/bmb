// ============================================
// Bite Me Baby — Floating Ad Banners (overlay + presentational card)
// R80 (Owner 2026-11-20): โคลนข้อมูลตรงจากที่แอดมินเลือก (Exact Clone)
// - รับ promos มาจาก parent (HomePage) ที่ resolve ด้วย floatingAdResolver แล้ว
// - component นี้เป็น pure presentation + session dismissal เท่านั้น
//   (การเลือก/กรอง/จำกัดจำนวนทำที่ resolver ที่เดียว — ใช้ต้นทางเดียวกันกับ preview ด้วย)
// ============================================

import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { DEFAULT_SITE_COPY } from '@/lib/homePopular'
import { loadMascotOverrides, getOverrideUrl } from '@/lib/mascotService'
import type { FloatingAdSourceType } from '@/types'

const DEFAULT_AD_NOTICE = DEFAULT_SITE_COPY.adNotice

export interface FloatingBannerPromo {
  id: string
  title: string
  description?: string
  coupon?: string
  image?: string
  to?: string
  href?: string
  mascot?: string
  /** ประเภทแหล่งข้อมูล: promotion | post | product */
  sourceType?: FloatingAdSourceType
}

/** R58 (Owner 2026-11-02): เลือกภาพเจน "ด้านการตลาด/โปรโมชั่น (ไม่ใช่รูปเมนู)" จาก image_urls/URL เดียว
 *  - ต้องอยู่ใน ai-generated/ · ห้ามหมวด menu · ห้าม _disabled · เอาใบสุดท้ายที่ใช้ได้ (ใหม่สุดตอน insert) */
export function pickMarketingAiImage(images: unknown): string {
  const list = Array.isArray(images)
    ? images
    : typeof images === 'string' && images.trim()
      ? [images]
      : []
  const ok = list.filter((u): u is string =>
    typeof u === 'string' &&
    u.includes('/ai-generated/') &&
    !u.includes('/ai-generated/menu/') &&
    !u.includes('/_disabled/'),
  )
  return ok[ok.length - 1] || ''
}

/** R58: มาสคอตต่อโพส — สลับตามลำดับโพสไม่ให้ซ้ำกัน */
export const MASCOT_POSES = ['recommend', 'pointing', 'shopping', 'cooking'] as const

/** pure — รูปมาสคอตสำหรับลำดับโพสที่ pos */
export function mascotForPosition(pos: number): string {
  const i = Math.abs(Number.isFinite(pos) ? Math.trunc(pos) : 0) % MASCOT_POSES.length
  return getOverrideUrl(MASCOT_POSES[i]) || ''
}

/** pure — มุมของรูปที่วางมาสคอตต่อโพส */
export function mascotCornerForPosition(pos: number): number {
  return Math.abs(Number.isFinite(pos) ? Math.trunc(pos) : 0) % 4
}

function dismissKey(id: string): string {
  return 'bmb_banner_dismiss_' + id
}

function isDismissed(id: string): boolean {
  try {
    return sessionStorage.getItem(dismissKey(id)) === '1'
  } catch { return false }
}

/** pure — กรองเฉพาะการ์ดที่ถูก dismiss (state + sessionStorage) คงลำดับ input
 *  (การจำกัดจำนวน/ลำดับทำที่ resolver ตาม config.maxCount เท่านั้น) */
export function pickVisibleBannerPromos(
  promos: FloatingBannerPromo[],
  dismissed: ReadonlySet<string>,
): FloatingBannerPromo[] {
  return [...(promos || [])]
    .filter((p) => p.id && !dismissed.has(p.id) && !isDismissed(p.id))
}

const BADGE_LABELS: Record<FloatingAdSourceType, string> = {
  promotion: 'โปรโมชั่น',
  post: 'กิจกรรม',
  product: 'เมนูแนะนำ',
  menu: 'เมนูแนะนำ',
}
const BADGE_COLORS: Record<FloatingAdSourceType, string> = {
  promotion: 'bg-brand-primary text-white',
  product: 'bg-red-500 text-white',
  post: 'bg-amber-500 text-white',
  menu: 'bg-emerald-500 text-white',
}

function sourceTypeOf(promo: FloatingBannerPromo): FloatingAdSourceType {
  if (promo.sourceType) return promo.sourceType
  return promo.id.startsWith('promo-') ? 'promotion' : promo.id.startsWith('prod-') ? 'product' : promo.id.startsWith('menu-') ? 'menu' : 'post'
}

export interface FloatingAdCardProps {
  promo: FloatingBannerPromo
  pos: number
  notice?: string
  /** รูปสำรองจากอัลบั้ม (ใช้เมื่อ promo.image ไม่มี) */
  albumImgs?: string[]
  /** ถ้าไม่ระบุ = โหมด preview (ไม่มีปุ่มปิด) */
  onClose?: () => void
}

/** การ์ดโฆษณาลอยแบบ presentational — ใช้ทั้ง overlay และ preview ให้หน้าตาเหมือนกัน */
export function FloatingAdCard({ promo, pos, notice, albumImgs, onClose }: FloatingAdCardProps) {
  const mediaSrc = promo.image || (albumImgs && albumImgs.length > 0 ? albumImgs[pos % albumImgs.length] : '')
  const sourceType = sourceTypeOf(promo)
  const badgeLabel = BADGE_LABELS[sourceType]
  const badgeColor = BADGE_COLORS[sourceType]
  const mascotSrc = mascotForPosition(pos)
  const promoMascot = promo.mascot || mascotSrc
  const mascotCorner = mascotCornerForPosition(pos)
  const noticeText = (notice ?? DEFAULT_AD_NOTICE).trim()

  return (
    <div className="flad-card" data-testid="floating-ad-banner">
      <div className={`absolute top-2 left-2 z-10 text-xs px-2 py-0.5 rounded font-medium ${badgeColor}`} data-testid="floating-ad-badge">
        {badgeLabel}
      </div>

      <div className="flad-media">
        {mediaSrc ? (
          <>
            <img
              src={mediaSrc}
              alt=""
              loading="lazy"
              onError={(e) => {
                const el = e.currentTarget as HTMLImageElement
                if (!el.dataset.fbk) {
                  el.dataset.fbk = '1'
                  el.style.display = 'none'
                  el.parentElement?.classList.add('flad-media-fallback')
                  el.parentElement?.querySelector('.flad-mascot-composed')?.remove()
                }
              }}
            />
            {promoMascot && (promo.mascot || !mediaSrc.includes('/wm-')) && (
              <img src={promoMascot} alt="" loading="lazy" className={`flad-mascot-composed flad-mascot-pos-${mascotCorner}`} data-testid="floating-ad-mascot" />
            )}
          </>
        ) : (
          <div className="flad-media flad-media-fallback" aria-hidden="true">
            {promoMascot && (
              <img src={promoMascot} alt="" loading="lazy" className="flad-fallback-mascot" />
            )}
          </div>
        )}
      </div>

      <div className="flad-body">
        <div className="flad-title">{promo.title?.trim() || 'โปรโมชั่นพิเศษจาก Bite Me Baby'}</div>
        {promo.description?.trim() && <p className="flad-desc">{promo.description}</p>}

        <div className="flad-actions">
          {promo.coupon && (
            <span className="flad-coupon" data-testid="floating-ad-coupon">รหัสส่วนลด: {promo.coupon}</span>
          )}
          <Link to={promo.href || promo.to || '/promotions'} className="flad-cta">ดูดีลเลย →</Link>
        </div>

        {noticeText && (
          <p className="flad-notice" data-testid="floating-ad-notice">⚠️ {notice ?? DEFAULT_AD_NOTICE}</p>
        )}
      </div>

      {onClose && (
        <button
          type="button"
          className="flad-close"
          data-testid="floating-ad-close"
          aria-label={`ปิด ${promo.title}`}
          onClick={onClose}
        >
          ✕
        </button>
      )}
    </div>
  )
}

export function FloatingAdBanners({
  promos,
  notice,
}: {
  promos: FloatingBannerPromo[];
  notice?: string;
}) {
  const [dismissedIds, setDismissedIds] = useState<Set<string>>(new Set())
  const [mascotsLoaded, setMascotsLoaded] = useState(false)

  // โหลด mascot overrides จาก Admin (bucket Bite_Mascot)
  useEffect(() => {
    let alive = true
    void loadMascotOverrides().then(() => {
      if (alive) setMascotsLoaded(true)
    })
    return () => { alive = false }
  }, [])

  // R58: fallback images จาก ai-generated album (promo/festival) — โหลดครั้งเดียว
  const [albumImgs, setAlbumImgs] = useState<string[]>([])
  useEffect(() => {
    let alive = true
    void (async () => {
      try {
        const { supabase } = await import('@/lib/supabase')
        const found: Array<{ url: string; at: string }> = []
        for (const prefix of ['ai-generated/promo', 'ai-generated/festival']) {
          const { data, error } = await supabase.storage.from('bmb-images').list(prefix, { limit: 60 })
          if (error || !Array.isArray(data)) continue
          for (const f of data) {
            if (!f?.name || typeof f.name !== 'string') continue
            if (/\.(jpe?g|png|webp|avif)$/i.test(f.name)) {
              found.push({
                url: supabase.storage.from('bmb-images').getPublicUrl(`${prefix}/${f.name}`).data.publicUrl,
                at: String((f as { created_at?: string }).created_at || ''),
              })
            }
          }
        }
        if (alive && found.length > 0) {
          found.sort((a, b) => b.at.localeCompare(a.at))
          setAlbumImgs(found.map((f) => f.url))
        }
      } catch { /* zero-fake — ดึงไม่ได้ = การ์ดใช้ภาพตัวเอง/มาสคอตเดิม */ }
    })()
    return () => { alive = false }
  }, [])

  const visible = pickVisibleBannerPromos(promos, dismissedIds)
  const visibleKey = visible.map((p) => p.id).join(',')

  function dismiss(id: string) {
    try { sessionStorage.setItem(dismissKey(id), '1') } catch { /* ignore */ }
    setDismissedIds((prev) => new Set(prev).add(id))
  }

  // D03/keyboard: Esc dismisses the currently visible banners
  useEffect(() => {
    if (!visibleKey) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return
      visibleKey.split(',').filter(Boolean).forEach((id) => dismiss(id))
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [visibleKey])

  // mascotsLoaded ใช้แค่บังคับ re-render หลังโหลด overrides (คงพฤติกรรมเดิม)
  void mascotsLoaded

  if (visible.length === 0) return null

  return (
    <div className="flad-overlay" role="dialog" aria-modal="true" aria-label="โปรโมชั่น" data-testid="floating-ad-banners">
      <div className="flad-backdrop" onClick={() => visible.forEach((p) => dismiss(p.id))} />

      <div className="flad-stack">
        {visible.map((promo, pos) => (
          <FloatingAdCard
            key={promo.id}
            promo={promo}
            pos={pos}
            notice={notice}
            albumImgs={albumImgs}
            onClose={() => dismiss(promo.id)}
          />
        ))}
      </div>
    </div>
  )
}