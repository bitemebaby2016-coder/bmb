// ============================================
// Bite Me Baby — Floating Ad Banners (overlay)
// R80 (Owner 2026-11-20): โคลนข้อมูลตรงจากที่แอดมินเลือก (Exact Clone)
// - รับ promos มาจาก parent (HomePage) ที่ query แล้วครบ 3 source ใหม่
// - ไม่มี prefix/fallback/auto-select อีกต่อไป
// - แค่ render ตรงตามข้อมูลที่ได้รับ: title, description, image, coupon, href, mascot
// ============================================

import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { DEFAULT_SITE_COPY } from '@/lib/homePopular'
import { loadMascotOverrides, getOverrideUrl } from '@/lib/mascotService'

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
}

export type FloatingAdSource = 'floating_promotions' | 'floating_products' | 'floating_posts'

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

/** R64 (Owner 2026-11-03): สลับชนิด Announcement ↔ Promo —
 *  เดิม `[...,announcements, ...promos]` + slice(0,2) = ประกาศ 2 ใบเต็มโควตา → โปรโมชั่น
 *  (รวมรูปที่แอดมินอัปโหลด) ถูกเบียดออกจนไม่เห็นเลย · ใหม่ = a0,p0,a1,p1… (ใหม่สุดทั้งคู่
 *  แสดงคู่กันเสมอ · cap 2 + dismissed = เดิม)
 * Kept for test compatibility — logic moved to HomePage.tsx (R80) */
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

/** R58: มาสคอตต่อโพส — สลับตามลำดับโพสไม่ให้ซ้ำกัน */
export const MASCOT_POSES = ['recommend', 'pointing', 'shopping', 'cooking'] as const

/** Backward compatibility — old name for tests */
export const MASCOT_ROTATION = MASCOT_POSES.map(p => getOverrideUrl(p) || '') as string[]

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

// D03: deterministic selection — filter dismissed promos, KEEP INPUT ORDER
export function pickVisibleBannerPromos(
  promos: FloatingBannerPromo[],
  dismissed: ReadonlySet<string>,
): FloatingBannerPromo[] {
  return [...(promos || [])]
    .filter((p) => p.id && !dismissed.has(p.id) && !isDismissed(p.id))
    .slice(0, 3)
}

export function FloatingAdBanners({ 
  promos, 
  notice, 
  sources = ['floating_promotions', 'floating_products', 'floating_posts']
}: { 
  promos: FloatingBannerPromo[]; 
  notice?: string;
  sources?: FloatingAdSource[];
}) {
  const [dismissedIds, setDismissedIds] = useState<Set<string>>(new Set())
  const [floatAdEnabled, setFloatAdEnabled] = useState(true)
  const [floatAdSources, setFloatAdSources] = useState<FloatingAdSource[]>(sources)
  const [mascotsLoaded, setMascotsLoaded] = useState(false)

  // โหลด mascot overrides จาก Admin (bucket Bite_Mascot)
  useEffect(() => {
    let alive = true
    void loadMascotOverrides().then(() => {
      if (alive) setMascotsLoaded(true)
    })
    return () => { alive = false }
  }, [])

  // Kill switch สำหรับ floating ad (โหลดจาก business_settings)
  useEffect(() => {
    let alive = true
    void (async () => {
      try {
        const { supabase } = await import('@/lib/supabase')
        const [{ data: enabledData }, { data: sourcesData }] = await Promise.all([
          supabase.from('business_settings').select('value').eq('key', 'floating_ad_enabled').maybeSingle(),
          supabase.from('business_settings').select('value').eq('key', 'floating_ad_sources').maybeSingle(),
        ])
        if (alive) {
          const enabledV = (enabledData as { value?: unknown } | null)?.value
          if (typeof enabledV === 'boolean') setFloatAdEnabled(enabledV)
          const sourcesV = (sourcesData as { value?: unknown } | null)?.value
          if (Array.isArray(sourcesV)) {
            const validSources = sourcesV.filter((v: unknown): v is FloatingAdSource =>
              v === 'floating_promotions' || v === 'floating_products' || v === 'floating_posts'
            )
            if (validSources.length > 0) setFloatAdSources(validSources)
            else setFloatAdSources(sources)
          } else {
            setFloatAdSources(sources)
          }
        }
      } catch { /* zero-fake */ }
    })()
    return () => { alive = false }
  }, [sources])

  // R58: fallback images จาก ai-generated album (promo/festival) — โหลดครั้งเดียว
  // ใช้เมื่อ promo.image ไม่มี (Exact Clone จาก parent อาจไม่มีรูป)
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
          found.sort((a, b) => b.at.localeCompare(a.at)) // ใหม่สุดก่อน
          setAlbumImgs(found.map((f) => f.url))
        }
      } catch { /* zero-fake — ดึงไม่ได้ = การ์ดใช้ภาพตัวเอง/มาสคอตเดิม */ }
    })()
    return () => { alive = false }
  }, [])
  
  // Early return if floating ad is disabled
  if (!floatAdEnabled) return null

  // Filter promos by enabled sources (exact match on id prefix)
  const sourcePrefixMap: Record<FloatingAdSource, string> = {
    floating_promotions: 'promo-',
    floating_products: 'prod-',
    floating_posts: 'post-',
  }
  const allowedPrefixes = floatAdSources.map(s => sourcePrefixMap[s]).filter(Boolean)
  const filteredPromos = (promos || []).filter(p => 
    allowedPrefixes.some(prefix => p.id.startsWith(prefix))
  )

  // D03: deterministic selection — filter dismissed promos, KEEP INPUT ORDER
  const visible = pickVisibleBannerPromos(filteredPromos, dismissedIds)
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

  if (visible.length === 0) return null

  return (
    <div className="flad-overlay" role="dialog" aria-modal="true" aria-label="โปรโมชั่น" data-testid="floating-ad-banners">
      <div className="flad-backdrop" onClick={() => visible.forEach((p) => dismiss(p.id))} />

      <div className="flad-stack">
        {visible.map((promo) => {
          // R58 (Owner): ภาพการตลาด/โปรโมชั่นที่เจน (ไม่ใช่รูปเมนู) โชว์แทนตัวมาสคอต —
          // ลำดับ: ภาพของโปรโมชั่น (promo.image) → อัลบั้ม ai-generated/{promo,festival} (สลับตามลำดับ)
          const pos = visible.findIndex(p => p.id === promo.id)
          // ใช้ promo.image (banner_image จาก promotions / image_url จาก products / image_urls[0] จาก posts) โดยตรง ทุกตัวที่มี
          // fallback ไป albumImgs ถ้าไม่มี
          const mediaSrc = promo.image || (albumImgs.length > 0 ? albumImgs[pos % albumImgs.length] : '')
          
          // Badge แสดงประเภทแหล่งข้อมูล (เงียบ ไม่เข้าข้อความ title)
          const isPromotion = promo.id.startsWith('promo-')
          const isProduct = promo.id.startsWith('prod-')
          const isPost = promo.id.startsWith('post-')
          const badgeInfo = isPromotion
            ? { label: '🎁 โปรโมชั่น', className: 'bg-brand-primary text-white' }
            : isProduct
            ? { label: '🍽️ เมนูแนะนำ', className: 'bg-red-500 text-white' }
            : { label: '📝 โพสต์', className: 'bg-amber-500 text-white' }
          
          // R61: มาสคอตของโปรโมชั่น (admin ตั้งเอง) หรือ default สลับตามลำดับ
          // R61: มาสคอตของโปรโมชั่น (admin ตั้งเอง) หรือ default สลับตามลำดับ
          const mascotSrc = mascotForPosition(pos)
          const promoMascot = promo.mascot || mascotSrc
          const mascotCorner = mascotCornerForPosition(pos)
          
          return (
            <div key={promo.id} className="flad-card" data-testid="floating-ad-banner">
              {/* Badge มุมขอบ — แสดงประเภทแหล่งข้อมูล */}
              <div className={`absolute top-2 left-2 z-10 text-[9px] px-1.5 py-0.5 rounded font-medium ${badgeInfo.className}`} data-testid="floating-ad-badge">
                {badgeInfo.label}
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
                    {/* R55+R58: น้อง Bite ตัวเล็กทับมุมรูป */}
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
                {/* R80: ใช้ title ตรงๆ — ไม่มี prefix 📣 🔥 🎁, ไม่มี fallback */}
                <div className="flad-title">{promo.title?.trim() || 'โปรโมชั่นพิเศษจาก Bite Me Baby'}</div>
                {/* R80: ใช้ description ตรงๆ — ไม่ตัด 140 ตัวอักษร, ไม่มี fallback ราคา */}
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
                aria-label={`ปิด ${promo.title}`}
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