// ============================================
// Bite Me Baby — Floating Ad resolver (single decision point)
// ============================================
// CANONICAL = config.items (FloatingAdTab). แหล่งอื่นเป็นเพียง "คลังวัตถุดิบ":
//   - promotions.is_banner / products.is_floating_ad / marketing_posts.is_floating_ad
//   → ใช้กดเพิ่มเข้า items ในแอดมินเท่านั้น ไม่แสดงผลโดยตรง
// resolver นี้เป็น pure function เดียวที่แปลง config + catalog → การ์ดที่จะแสดง
// ใช้ร่วมกันทั้ง HomePage (overlay) และ FloatingAdTab (preview) เพื่อไม่ให้เพี้ยนกัน
// ============================================

import type { FloatingAdConfig, FloatingAdSourceType, Product } from '@/types'
import type { PromotionRow } from './bmbAdminApi_promotions'
import type { MarketingPostRow } from './adminMarketing'

export interface FloatingAdCatalog {
  promotions: PromotionRow[]
  products: Product[]
  posts: MarketingPostRow[]
  /** ภาพเมนู AI (ai-generated/menu/) สำหรับการ์ด floating ประเภท menu */
  menu?: Array<{ id: string; name: string; url: string }>
}

export interface ResolvedFloatingAd {
  /** id ที่ tokenize แล้ว (promo-/prod-/post-) — ใช้คงที่ dismissal key เดิม */
  id: string
  sourceType: FloatingAdSourceType
  title: string
  description?: string
  image?: string
  coupon?: string
  href: string
  mascot?: string
}

export interface ResolveFloatingAdArgs {
  config: FloatingAdConfig
  catalog: FloatingAdCatalog
  /** สกุลเงินไทย pvm ของวันนี้ (YYYY-MM-DD) สำหรับเช็คช่วงโปรโมชั่น */
  todayKey: string
  /** ชุดรูปที่อนุมัติแล้ว (content_approvals status=approved, content_type=banner) */
  approvedImages?: ReadonlySet<string>
  /** id ที่ผู้ใช้ dismiss แล้ว (จะถูกกรองออก) */
  dismissed?: ReadonlySet<string>
}

function prefixOf(type: FloatingAdSourceType): string {
  return type === 'promotion' ? 'promo' : type === 'product' ? 'prod' : type === 'menu' ? 'menu' : 'post'
}

function inDateRange(start?: string | null, end?: string | null, todayKey?: string): boolean {
  if (!todayKey) return true
  const s = String(start || '').slice(0, 10)
  const e = String(end || '').slice(0, 10)
  if (s && todayKey < s) return false
  if (e && todayKey > e) return false
  return true
}

/** pure — แปลง config.items + catalog เป็นการ์ดที่พร้อมแสดง (ตัด eligibility/override/dismiss/maxCount) */
export function resolveFloatingAdCards(args: ResolveFloatingAdArgs): ResolvedFloatingAd[] {
  const { config, catalog, todayKey, approvedImages, dismissed } = args

  if (!config.enabled) return []
  const items = config.items ?? []
  if (items.length === 0) return []

  const ordered = [...items]
    .filter((i) => i.enabled)
    .sort((a, b) => a.order - b.order)

  const out: ResolvedFloatingAd[] = []

  for (const item of ordered) {
    const id = `${prefixOf(item.type)}-${item.id}`

    if (item.type === 'promotion') {
      const p = catalog.promotions.find((r) => String(r.id) === String(item.id))
      if (!p) continue
      if (p.is_banner !== true || p.is_active === false) continue
      if (!inDateRange(p.start_date, p.end_date, todayKey)) continue
      if (p.approval_id && p.banner_image && approvedImages && !approvedImages.has(p.banner_image)) continue
      out.push({
        id,
        sourceType: 'promotion',
        title: item.title ?? String(p.name || 'Promotion'),
        description: item.description ?? String(p.description || ''),
        image: item.image ?? p.banner_image ?? undefined,
        coupon: p.code ?? undefined,
        href: p.code ? `/menu?coupon=${encodeURIComponent(p.code)}` : '/menu',
        mascot: p.banner_mascot ?? undefined,
      })
      continue
    }

    if (item.type === 'product') {
      const p = catalog.products.find((r) => String(r.id) === String(item.id))
      if (!p) continue
      if (!p.is_floating_ad || !p.is_available || p.archived) continue
      out.push({
        id,
        sourceType: 'product',
        title: item.title ?? String(p.name || 'Menu'),
        description: item.description ?? String(p.description || ''),
        image: item.image ?? p.image_url ?? undefined,
        href: `/menu?product=${encodeURIComponent(String(p.id))}`,
      })
      continue
    }

    // menu — การ์ดภาพเมนู AI (ai-generated/menu/) ไม่มี eligibility นอกจากมีไฟล์จริง
    if (item.type === 'menu') {
      const m = (catalog.menu ?? []).find((r) => String(r.id) === String(item.id))
      if (!m) continue
      out.push({
        id,
        sourceType: 'menu',
        title: item.title ?? String(m.name || 'เมนูแนะนำ'),
        description: item.description ?? '',
        image: item.image ?? m.url,
        href: '/menu',
      })
      continue
    }

    // post
    const p = catalog.posts.find((r) => String(r.id) === String(item.id))
    if (!p) continue
    if (!p.is_floating_ad || p.status !== 'published') continue
    out.push({
      id,
      sourceType: 'post',
      title: item.title ?? String(p.title || 'Post'),
      description: item.description ?? String(p.body || ''),
      image: item.image ?? (Array.isArray(p.image_urls) && p.image_urls.length > 0 ? p.image_urls[0] : undefined),
      href: '/promotions',
    })
  }

  const visible = dismissed && dismissed.size > 0 ? out.filter((c) => !dismissed.has(c.id)) : out
  return visible.slice(0, Math.max(1, config.maxCount))
}