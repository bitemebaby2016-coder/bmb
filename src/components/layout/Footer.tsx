import { useEffect, useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import type { ProductCategory } from '@/types'
import { categoryDisplayRank } from '@/lib/catalogStructure'
import { DEFAULT_SOCIAL_LINKS, getSocialLinks, socialLinkItems, type SocialLinkItem } from '@/lib/socialLinks'
import { usePlatformConfig } from '@/config/platformConfig'
import { scrollMainToTop } from '@/lib/scrollTo'

// ── ข้อมูลร้านจริง (Owner ยืนยัน 2026-10-17) — ใช้ตรงกันทั้ง footer/หน้าติดต่อ ──
export const SHOP_CONTACT = {
  address: 'เมืองจันทบุรี',
  phone: '082 6096995',
  phoneHref: 'tel:0826096995',
  email: 'admin@biteme-baby.com',
  emailHref: 'mailto:admin@biteme-baby.com',
  hours: 'Open Daily 7.00 am. - 20.00 pm.',
  facebook: 'https://web.facebook.com/profile.php?id=61586146030943',
  messenger: 'https://m.me/61586146030943',
}

type FooterLink = { label: string; path?: string; href?: string }

const contactLinks: FooterLink[] = [
  { label: `📍 ${SHOP_CONTACT.address}`, path: '/contact' },
  { label: `📞 ${SHOP_CONTACT.phone}`, href: SHOP_CONTACT.phoneHref },
  { label: `✉️ ${SHOP_CONTACT.email}`, href: SHOP_CONTACT.emailHref },
  { label: `🕐 ${SHOP_CONTACT.hours}`, path: '/contact' },
]

const staticSections: Array<{ title: string; links: FooterLink[] }> = [
  {
    title: 'เกี่ยวกับเรา',
    links: [
      { label: 'เกี่ยวกับ Bite Me Baby', path: '/about' },
      { label: 'FAQ', path: '/faq' },
      { label: 'บทความ & ข่าวสาร', path: '/blog' },
      { label: 'นโยบายความเป็นส่วนตัว', path: '/privacy' },
      { label: 'เงื่อนไขการใช้งาน', path: '/terms' },
    ],
  },
  {
    title: 'บริการ',
    links: [
      { label: 'สั่งอาหาร', path: '/menu' },
      { label: 'ติดตามออเดอร์', path: '/track' },
      { label: 'โปรโมชั่น', path: '/promotions' },
      { label: 'โปรแกรมความภักดี', path: '/rewards' },
      { label: 'ชวนเพื่อน รับคูปอง', path: '/share' },
    ],
  },
]

// ปุ่มโซเชียล: ลิงก์จาก business_settings `social_links` (แอดมินแก้เองได้ที่
// AdminSettings → โซเชียล & LINE) — ช่องว่าง = ไม่แสดงปุ่มนั้น

export function Footer() {
  // ZERO-FAKE: ข้อความ "ส่งฟรี" แสดงเมื่อ server บังคับใช้กฎจริงเท่านั้น
  const { delivery } = usePlatformConfig()
  const freeShippingActive = delivery.freeShippingEnforced
  const location = useLocation()
  // L-3 (N-4 #3): จิ้มลิงก์ฟุตเตอร์ที่เป็นหน้าปัจจุบันอยู่แล้ว (URL เดิมเป๊ะ) → ไม่มี
  // การ navigate → Layout ไม่ scroll → ต้องเลื่อนขึ้นบนเองไม่งั้น "จิ้มแล้วนิ่ง"
  const scrollIfSameUrl = (to: string) => {
    const [path, search] = to.split('?')
    const target = path + (search ? `?${search}` : '')
    if (target === location.pathname + location.search) scrollMainToTop()
  }
  // ลิงก์ "เมนูอาหาร" ดึงจากหัวข้อเมนูจริงในฐานข้อมูล (active + ไม่ archived เรียงตามลำดับ)
  // — แอดมินเพิ่ม/แก้/เรียงหัวข้อเมื่อไร ฟุตเตอร์ตามทันที ไม่ต้องแก้โค้ด
  const [menuLinks, setMenuLinks] = useState<FooterLink[]>([{ label: 'ดูเมนูทั้งหมด', path: '/menu' }])
  // (Owner 2026-10-18: ปุ่ม "จองล่วงหน้า" ถูกนำออกจากฟุตเตอร์ทุกหน้าตามคำสั่ง —
  //  การจองล่วงหน้ายังเข้าได้จากเมนู/หน้าแรกตามปกติ)
  // ปุ่มกรองหมวด (chips) — กติกาการมองเห็นเดียวกับ buildHeadingGroups
  // L-7 (N-4 #7 · Owner 2026-10-26): ฟุตเตอร์เรียงลำดับเดียวกับหัวข้อเมนูทุกหน้า
  // (displayRank ก่อน sort_order — เดิมเรียง sort_order อย่างเดียวทำให้ลำดับเพี้ยน)
  useEffect(() => {
    let alive = true
    import('@/lib/bmbAdminApi_products')
      .then(({ getCategories }) => getCategories())
      .then((cats: ProductCategory[]) => {
        if (!alive) return
        const links: FooterLink[] = cats
          .filter((c) => c.is_active && !c.archived)
          .sort((a, b) => categoryDisplayRank(a.name) - categoryDisplayRank(b.name) || (a.sort_order || 0) - (b.sort_order || 0))
          .map((c) => ({
            label: `${c.icon ? c.icon + ' ' : ''}${c.name}`,
            path: `/menu?category=${encodeURIComponent(c.slug || c.id)}`,
          }))
        if (links.length > 0) setMenuLinks([{ label: 'ดูเมนูทั้งหมด', path: '/menu' }, ...links])
      })
      .catch(() => { /* โหลดไม่ได้ = โชว์ลิงก์เมนูทั้งหมดอย่างเดียว */ })
    return () => { alive = false }
  }, [])

  // ปุ่มโซเชียล — โหลดจาก business_settings (fallback = ค่าจริงของร้าน)
  const [socials, setSocials] = useState<SocialLinkItem[]>(() => socialLinkItems(DEFAULT_SOCIAL_LINKS))
  useEffect(() => {
    let alive = true
    getSocialLinks()
      .then((links) => { if (alive) setSocials(socialLinkItems(links)) })
      .catch(() => { /* โหลดไม่ได้ = ใช้ค่าเริ่มต้นต่อ */ })
    return () => { alive = false }
  }, [])

  const footerSections = [
    { title: 'เมนูอาหาร', links: menuLinks },
    ...staticSections,
    { title: 'ติดต่อเรา', links: contactLinks },
  ]
  return (
    <footer className="bg-brand-surface border-t border-brand-border py-8 px-4 mt-8">
      <div className="max-w-7xl mx-auto">
        {/* SEO Content Block - GEO/AEO optimized */}
        <div className="mb-8 text-sm text-brand-muted">
          <p className="font-semibold text-brand-accent mb-2">🍽️ Bite Me Baby — Cloud Kitchen Operating Platform เมืองจันทบุรี</p>
          <p>
            บริการสั่งอาหารจัดส่งเมืองจันทบุรี
            {freeShippingActive && (
              <> ส่งฟรีเมื่อครบ ฿{delivery.freeShippingThreshold.toLocaleString('th-TH')}</>
            )} • 
            เมนูจานเดียว ข้าว แกง เครื่องดื่ม ของหวาน • 
            ส่งเช้า กลางวัน เย็น • 
            รองรับ Same-day Order และ Pre-order • 
            AI Assistant "Bite" ตอบคำถาม 24/7
          </p>
        </div>

      {/* Footer Links Grid */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-6 mb-8">
          {footerSections.map((section) => (
            <div key={section.title}>
              <h4 className="font-bold text-brand-accent mb-3 text-sm">{section.title}</h4>
              <ul className="space-y-2">
                {section.links.map((link) => (
                  <li key={link.label}>
                    {link.href ? (
                      <a href={link.href} className="block break-all text-sm text-brand-muted hover:text-brand-primary transition-colors">
                        {link.label}
                      </a>
                    ) : (
                      <Link to={link.path || '/'} onClick={() => scrollIfSameUrl(link.path || '/')} className="block break-all text-sm text-brand-muted hover:text-brand-primary transition-colors">
                        {link.label}
                      </Link>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        {/* Social Links — ลิงก์จาก business_settings (แอดมินแก้ได้ที่ AdminSettings) */}
        <div className="flex justify-center gap-4 mb-6">
          {socials.map((social) => (
            <a
              key={social.label}
              href={social.href}
              target="_blank"
              rel="noopener noreferrer"
              className="w-10 h-10 rounded-full bg-brand-bg flex items-center justify-center text-xl hover:bg-brand-primary hover:text-white transition-all"
              aria-label={social.label}
            >
              {/* R34 (Owner): โลโก้จริงจาก public/ (Facebook/LINE) — ไม่มีรูป = ใช้ emoji เดิม */}
              {social.img ? (
                <img src={social.img} alt="" loading="lazy" decoding="async" className="w-6 h-6 object-contain" />
              ) : (
                social.icon
              )}
            </a>
          ))}
        </div>

        {/* Copyright & Legal */}
        <div className="border-t border-brand-border pt-6 text-center">
          <p className="text-sm text-brand-muted">
            © 2026 Bite Me Baby Cloud Kitchen • เมืองจันทบุรี • สงวนลิขสิทธิ์
          </p>
          <p className="text-xs text-brand-muted mt-2">
            จัดส่งอาหาร • ส่งฟรีเมื่อครบ ฿200 • Same-day & Pre-order • AI Assistant 24/7 • {SHOP_CONTACT.hours}
          </p>
        </div>
      </div>
    </footer>
  )
}