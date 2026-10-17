import { useEffect, useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import type { ProductCategory } from '@/types'
import { DEFAULT_SOCIAL_LINKS, getSocialLinks, socialLinkItems, type SocialLinkItem } from '@/lib/socialLinks'
import { preOrderEntryPath, withPreOrderTab } from '@/lib/catalogStructure'
import { showToast } from '@/components/ui/ToastContainer'

// ── ข้อมูลร้านจริง (Owner ยืนยัน 2026-10-17) — ใช้ตรงกันทั้ง footer/หน้าติดต่อ ──
export const SHOP_CONTACT = {
  address: 'เมืองจันทบุรี',
  phone: '094 2649269',
  phoneHref: 'tel:0942649269',
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
      { label: 'แชร์เพื่อน รับแต้ม', path: '/viral' },
    ],
  },
]

// ปุ่มโซเชียล: ลิงก์จาก business_settings `social_links` (แอดมินแก้เองได้ที่
// AdminSettings → โซเชียล & LINE) — ช่องว่าง = ไม่แสดงปุ่มนั้น

export function Footer() {
  // ลิงก์ "เมนูอาหาร" ดึงจากหัวข้อเมนูจริงในฐานข้อมูล (active + ไม่ archived เรียงตามลำดับ)
  // — แอดมินเพิ่ม/แก้/เรียงหัวข้อเมื่อไร ฟุตเตอร์ตามทันที ไม่ต้องแก้โค้ด
  const [menuLinks, setMenuLinks] = useState<FooterLink[]>([{ label: 'ดูเมนูทั้งหมด', path: '/menu' }])
  // ปุ่ม Pre-order (Directive §8) — เข้า Pre-order workflow เดียวกับบน HomePage ผ่าน preOrderEntryPath
  // + แนบ tab=pre-order (Owner 2026-10-18: ปุ่มเดิมลิงก์กลับหน้าเดิมเฉย ๆ กดแล้วดูเหมือนพัง)
  const location = useLocation()
  const [preOrderPath, setPreOrderPath] = useState(withPreOrderTab('/menu'))
  useEffect(() => {
    let alive = true
    import('@/lib/bmbAdminApi_products')
      .then(({ getCategories }) => getCategories())
      .then((cats: ProductCategory[]) => {
        if (!alive) return
        setPreOrderPath(withPreOrderTab(preOrderEntryPath(cats.filter((c) => c.is_active && !c.archived))))
        const links: FooterLink[] = cats
          .filter((c) => c.is_active && !c.archived)
          .sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0))
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
            บริการสั่งอาหารจัดส่งเมืองจันทบุรี ส่งฟรีเมื่อครบ ฿200 • 
            เมนูจานเดียว ข้าว แกง เครื่องดื่ม ของหวาน • 
            ส่งเช้า กลางวัน เย็น • 
            รองรับ Same-day Order และ Pre-order • 
            AI Assistant "Bite" ตอบคำถาม 24/7
          </p>
        </div>

        {/* Pre-order entry (Directive §8) — ปุ่ม Footer เข้าสู่ Pre-order workflow เดียวกับบน HomePage */}
      <div className="mb-6 text-center">
        <Link
          to={preOrderPath}
          data-testid="footer-preorder-entry"
          onClick={() => {
            // อยู่หน้าเป้าหมายอยู่แล้ว → แจ้ง + เลื่อนขึ้นบน (กดแล้วต้องเห็นผลเสมอ)
            if (location.pathname + location.search === preOrderPath) {
              showToast('อยู่ที่เมนู "จองล่วงหน้า" แล้ว — เลือกเมนูที่ต้องการจองได้เลยค่ะ', 'info')
              window.scrollTo({ top: 0, behavior: 'smooth' })
            }
          }}
          className="inline-block px-6 py-3 rounded-xl bg-brand-primary text-white font-medium hover:opacity-90 transition-opacity"
        >
          📅 จองล่วงหน้า (Pre-order) — เลือกวันและรอบจัดส่ง
        </Link>
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
                      <Link to={link.path || '/'} className="block break-all text-sm text-brand-muted hover:text-brand-primary transition-colors">
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
              {social.icon}
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