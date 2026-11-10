// ============================================
// Bite Me Baby — Floating Ad Banners (overlay)
// Replaces the old inline home strip: promos flagged `is_banner` float in as an
// overlay card stack (max 2 at once, promo data pulled from the real DB rows
// below the creative). Each banner has a prominent ✕ — dismissing stores the
// promo id in sessionStorage (per-promo, D03: current session only) so it never
// pops up again this session even when the promo query returns a different
// order or the next row enters the limited slice.
// ============================================

import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { DEFAULT_SITE_COPY } from '@/lib/homePopular'

const DEFAULT_AD_NOTICE = DEFAULT_SITE_COPY.adNotice

export interface FloatingBannerPromo {
  id: string
  title: string
  description?: string
  coupon?: string
  image?: string
  /** R50: ลิงก์จริงต่อรายการ (ค่าเริ่มต้น = /promotions) */
  to?: string
  /** Real link for coupon-aware navigation (e.g., /menu?coupon=CODE) */
  href?: string
  /** R61 (2026-11-03): มาสคอตที่แอดมินเลือกเองใน /admin/promotions — ว่าง = สลับตามลำดับโพส (เดิม) */
  mascot?: string
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

/** R58: มาสคอตต่อโพส — สลับตามลำดับโพสไม่ให้ซ้ำกัน (Owner: "โพสของมาสคอตต้องสลับไม่ซ้ำกัน") */
export const MASCOT_ROTATION = [
  '/assets/mascot/bite_recommend.webp',
  '/assets/mascot/bite_pointing.webp',
  '/assets/mascot/bite_shopping.webp',
  '/assets/mascot/bite_cooking.webp',
] as const

/** pure — รูปมาสคอตสำหรับลำดับโพสที่ pos (mod ยาวรายการ · การ์ดติดกันไม่ซ้ำกัน) */
export function mascotForPosition(pos: number): string {
  const i = Math.abs(Number.isFinite(pos) ? Math.trunc(pos) : 0) % MASCOT_ROTATION.length
  return MASCOT_ROTATION[i]
}

/** pure — มุมของรูปที่วางมาสคอตต่อโพส (0=ขวาล่าง 1=ซ้ายล่าง 2=ขวาบน 3=ซ้ายบน) */
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

// D03: deterministic selection — filter dismissed promos, KEEP INPUT ORDER
// (R50: รายการ = ประกาศล่าสุด (ใหม่ก่อน) ตามด้วยโปรโมชั่น — ต้องนับเป็น "ล่าสุดไม่เกิน 3")
export function pickVisibleBannerPromos(
  promos: FloatingBannerPromo[],
  dismissed: ReadonlySet<string>,
): FloatingBannerPromo[] {
  return [...(promos || [])]
    .filter((p) => p.id && !dismissed.has(p.id) && !isDismissed(p.id))
    .slice(0, 3)
}

// AI-CLEANUP: mock banner asset removed — banners without a creative render a
// branded CSS gradient placeholder instead (dynamic promo data from DB only).

/** R64 (Owner 2026-11-03: "รูปไม่เข้ามาที่โฟลตติ้ง"): สลับชนิด Announcement ↔ Promo —
 *  เดิม `[...,announcements, ...promos]` + slice(0,2) = ประกาศ 2 ใบเต็มโควตา → โปรโมชั่น
 *  (รวมรูปที่แอดมินอัปโหลด) ถูกเบียดออกจนไม่เห็นเลย · ใหม่ = a0,p0,a1,p1… (ใหม่สุดทั้งคู่
 *  แสดงคู่กันเสมอ · cap 2 + dismissed = เดิม) */
export function mergeBannerFeed(
  announcements: FloatingBannerPromo[],
  promos: FloatingBannerPromo[],
): FloatingBannerPromo[] {
  const out: FloatingBannerPromo[] = []
  const n = Math.max(announcements.length, promos.length)
  for (let i = 0; i < n; i++) {
    if (announcements[i]) out.push(announcements[i])
    if (promos[i]) out.push(promos[i])
  }
  return out
}

export function FloatingAdBanners({ 
  promos, 
  notice, 
  sources = ['promotions', 'announcements', 'approved_banners']
}: { 
  promos: FloatingBannerPromo[]; 
  notice?: string;
  sources?: ('promotions' | 'announcements' | 'approved_banners')[];
}) {
  const [dismissedIds, setDismissedIds] = useState<Set<string>>(new Set())
  // Kill switch สำหรับ floating ad (โหลดจาก business_settings)
  const [floatAdEnabled, setFloatAdEnabled] = useState(true)
  // Floating ad sources filter (โหลดจาก business_settings หรือใช้ props)
  const [floatAdSources, setFloatAdSources] = useState<('promotions' | 'announcements' | 'approved_banners')[]>(sources)
  // Fallback images จาก ai-generated album (promo/festival)
  const [albumImgs, setAlbumImgs] = useState<string[]>([])
  
  useEffect(() => {
    let alive = true
    void (async () => {
      try {
        const { supabase } = await import('@/lib/supabase')
        // โหลด kill switch floating_ad_enabled และ sources filter
        const [{ data: enabledData }, { data: sourcesData }] = await Promise.all([
          supabase.from('business_settings').select('value').eq('key', 'floating_ad_enabled').maybeSingle(),
          supabase.from('business_settings').select('value').eq('key', 'floating_ad_sources').maybeSingle(),
        ])
        if (alive) {
          const enabledV = (enabledData as { value?: unknown } | null)?.value
          if (typeof enabledV === 'boolean') setFloatAdEnabled(enabledV)
          const sourcesV = (sourcesData as { value?: unknown } | null)?.value
          if (Array.isArray(sourcesV)) {
            const validSources = sourcesV.filter((v: unknown): v is 'promotions' | 'announcements' | 'approved_banners' =>
              v === 'promotions' || v === 'announcements' || v === 'approved_banners'
            )
            if (validSources.length > 0) setFloatAdSources(validSources)
            else setFloatAdSources(sources) // fallback to props
          } else {
            setFloatAdSources(sources) // fallback to props
          }
        }
      } catch { /* zero-fake */ }
    })()
    return () => { alive = false }
  }, [sources])
  
  // R58 (Owner): ไม่มีภาพเฉพาะการ์ด/ไม่ได้ตั้งโฆษณาลอย = ดึงภาพเจนโปรโมต/กิจกรรม
  // (bmb-images/ai-generated/{promo,festival} — ไม่ใช่รูปเมนู) มาสลับโชว์แทนมาสคอต (anon list ได้ — policy bmb_images_public_read)
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
          found.sort((a, b) => b.at.localeCompare(a.at)) // ใหม่สุดก่อน
          setAlbumImgs(found.map((f) => f.url))
        }
      } catch { /* zero-fake — ดึงไม่ได้ = การ์ดใช้ภาพตัวเอง/มาสคอตเดิม */ }
    })()
    return () => { alive = false }
  }, [])
  
  // Early return if floating ad is disabled
  if (!floatAdEnabled) return null

  // R50: "ประกาศล่าสุด" ย้ายจากหน้าจอส่วนล่างขึ้นมาอยู่รวมกับโปรโมชั่นที่นี่
  // (rpc เดิมกับ MarketingFeedSection · newest-first · ล้มเหลว/ว่าง = เงียบ zero-fake)
  const [announcements, setAnnouncements] = useState<FloatingBannerPromo[]>([])

  useEffect(() => {
    // Only load announcements if 'announcements' is in sources
    if (!floatAdSources.includes('announcements')) {
      setAnnouncements([])
      return
    }
    let alive = true
    void (async () => {
      try {
        const { supabase } = await import('@/lib/supabase')
        const { data, error } = await supabase.rpc('marketing_feed_posts', { p_limit: 3 })
        if (alive && !error && Array.isArray(data)) {
          setAnnouncements(
            (data as Array<{ id: string; title: string; body: string | null; image_urls?: unknown }>).slice(0, 3).map((p) => ({
              id: 'ann-' + p.id,
              title: '📣 ' + (p.title || 'ประกาศจากร้าน'),
              description: (p.body || '').slice(0, 140) || undefined,
              to: '/promotions',
              href: '/promotions',
              // R58: ภาพเจนการตลาด/โปรโมชั่นของโพสนี้เอง (ไม่ใช่รูปเมนู) = โชว์แทนตัวมาสคอต
              image: pickMarketingAiImage(p.image_urls),
            })),
          )
        }
      } catch { /* เงียบ — ไม่มี rpc/ไม่มีโพสต์ = โชว์เฉพาะโปรโมชั่น */ }
    })()
    return () => { alive = false }
  }, [floatAdSources])

  // ประกาศ (ใหม่ก่อน) + โปรโมชั่น → สลับชนิด a0,p0,a1,p1… (R64: ประกาศห้ามเต็มโควตา 2 ใบ
  // จนโปรโมชั่น/รูปที่แอดมินอัปโหลดไม่เห็นเลย) → ตัด dismissed → สูงสุด 2 (นับรวม)
  const merged = mergeBannerFeed(announcements, promos || [])
  // R58: ลำดับโพสใน merged (ก่อนตัด dismissed) = ตำแหน่งไว้เลือกรูปมาสคอต/มุม/ภาพอัลบั้ม
  // → การ์ดติดกันได้มาสคนคนละตัวและมุมคนละมุม (Owner: "สลับไม่ซ้ำกัน")
  const positionOf = new Map(merged.map((p, i) => [p.id, i]))
  // max 2 banners; skip already-dismissed ones (state + sessionStorage)
  const visible = pickVisibleBannerPromos(merged, dismissedIds)
  const visibleKey = visible.map((p) => p.id).join(',')

  function dismiss(id: string) {
    try { sessionStorage.setItem(dismissKey(id), '1') } catch { /* ignore */ }
    setDismissedIds((prev) => new Set(prev).add(id))
  }

  // D03/keyboard: Esc dismisses the currently visible banners (parity with ✕).
  // Only active while at least one banner is on screen; removed on dismiss.
  useEffect(() => {
    if (!visibleKey) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return
      visibleKey.split(',').filter(Boolean).forEach((id) => dismiss(id))
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [visibleKey])

  if (visible.length === 0) return null

  return (
    <div className="flad-overlay" role="dialog" aria-modal="true" aria-label="โปรโมชั่น" data-testid="floating-ad-banners">
      {/* Backdrop: dims the page so the promo never hides menu items */}
      <div className="flad-backdrop" onClick={() => visible.forEach((p) => dismiss(p.id))} />

      <div className="flad-stack">
        {visible.map((promo) => {
          // R58 (Owner): ภาพการตลาด/โปรโมชั่นที่เจน (ไม่ใช่รูปเมนู) โชว์แทนตัวมาสคอต —
          // ลำดับ: ภาพของโปรโมชั่น (promo.image) → อัลบั้ม ai-generated/{promo,festival} (สลับตามลำดับ)
          const pos = positionOf.get(promo.id) ?? 0
          // ใช้ promo.image (banner_image จาก promotions) โดยตรง ทุกตัวที่มี
          // fallback ไป albumImgs ถ้าไม่มี
          const mediaSrc = promo.image || (albumImgs.length > 0 ? albumImgs[pos % albumImgs.length] : '')
          // "ยุบตัวมาสคอตเป็นตัวเล็กไปอยู่ด้านมุมต่าง ๆ ของรูป" + สลับไม่ซ้ำตามลำดับโพส
          const mascotSrc = mascotForPosition(pos)
          // R61: แอดมินประกอบมาสคอตของโปรโมชั่นนั้นเอง (เครื่อง/คลังภาพ/มาตรฐาน) → ใช้ของโปรโมชั่นก่อน
          const promoMascot = promo.mascot || mascotSrc
          const mascotCorner = mascotCornerForPosition(pos)
          return (
          <div key={promo.id} className="flad-card" data-testid="floating-ad-banner">
          <div className="flad-media">
            {mediaSrc ? (
              <>
                <img
                  src={mediaSrc}
                  alt=""
                  loading="lazy"
                  onError={(e) => {
                    // media ชี้ไฟล์ที่ไม่มีแล้ว → branded fallback (และตัด mascot ประกอบออกด้วย)
                    const el = e.currentTarget as HTMLImageElement
                    if (!el.dataset.fbk) {
                      el.dataset.fbk = '1'
                      el.style.display = 'none'
                      el.parentElement?.classList.add('flad-media-fallback')
                      el.parentElement?.querySelector('.flad-mascot-composed')?.remove()
                    }
                  }}
                />
                {/* R55+R58: น้อง Bite ตัวเล็กทับมุมรูป — รูป wm-* มีมาสคอตในไฟล์อยู่แล้ว = ไม่ซ้ำ
                    R61: เว้นแต่แอดมิน "ประกอบเอง" (promo.mascot) = คนเลือกเอง ต้องโชว์ตามที่เลือก */}
                {(promo.mascot || !mediaSrc.includes('/wm-')) && (
                  <img src={promoMascot} alt="" loading="lazy" className={`flad-mascot-composed flad-mascot-pos-${mascotCorner}`} data-testid="floating-ad-mascot" />
                )}
              </>
            ) : (
              <div className="flad-media flad-media-fallback" aria-hidden="true">
                {/* ช่องสื่อว่าง (ยังไม่มีภาพโปรโมตเลย) → มาสคอตคนละตัวตามลำดับโพส ไม่ทิ้งบล็อกเปล่า
                    R61: ถ้าแอดมินตั้งมาสคอตของโปรโมชั่นไว้ = ใช้ของโปรโมชั่น */}
                <img src={promoMascot} alt="" loading="lazy" className="flad-fallback-mascot" />
              </div>
            )}
          </div>
          <div className="flad-body">
            <div className="flad-title">{promo.title?.trim() || '🎉 โปรโมชั่นพิเศษจาก Bite Me Baby'}</div>
            {promo.description?.trim() && <p className="flad-desc">{promo.description}</p>}
            <div className="flad-actions">
              {promo.coupon && (
                <span className="flad-coupon" data-testid="floating-ad-coupon">รหัสส่วนลด: {promo.coupon}</span>
              )}
              <Link to={promo.href || promo.to || '/promotions'} className="flad-cta">ดูดีลเลย →</Link>
            </div>
            {/* อักษรเตือนใต้แคมเปญ */}
            {(notice ?? DEFAULT_AD_NOTICE).trim() && (
              <p className="flad-notice" data-testid="floating-ad-notice">⚠️ {notice ?? DEFAULT_AD_NOTICE}</p>
            )}
          </div>
          <button
            type="button"
            className="flad-close"
            data-testid="floating-ad-close"
            aria-label={`ปิดโปรโมชั่น ${promo.title}`}
            onClick={() => dismiss(promo.id)}
          >
            ✕
          </button>
        </div>
          )
        })}
      </div>
    </div>
  )
}