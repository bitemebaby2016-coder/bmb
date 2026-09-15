import { Link } from 'react-router-dom'

const footerSections = [
  {
    title: 'เมนูอาหาร',
    links: [
      { label: 'จานเดียว', path: '/menu?category=dish' },
      { label: 'ข้าว', path: '/menu?category=rice' },
      { label: 'แกง', path: '/menu?category=curry' },
      { label: 'เครื่องดื่ม', path: '/menu?category=drink' },
      { label: 'ของหวาน', path: '/menu?category=dessert' },
    ],
  },
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
  {
    title: 'ติดต่อเรา',
    links: [
      { label: '📍 เมืองจันทบุรี รัศมี 5 กม.', path: '/contact' },
      { label: ' 08X-XXX-XXXX', path: '/contact' },
      { label: '✉️ hello@bitemebaby.co.th', path: '/contact' },
      { label: ' 08:00 - 22:00', path: '/contact' },
    ],
  },
]

const socialLinks = [
  { icon: '📘', label: 'Facebook', path: 'https://facebook.com/bitemebaby' },
  { icon: '', label: 'Instagram', path: 'https://instagram.com/bitemebaby' },
  { icon: '🐦', label: 'Twitter', path: 'https://twitter.com/bitemebaby' },
  { icon: '💬', label: 'LINE', path: 'https://line.me/R/ti/p/@bitemebaby' },
]

export function Footer() {
  return (
    <footer className="bg-brand-surface border-t border-brand-border py-8 px-4 mt-8">
      <div className="max-w-7xl mx-auto">
        {/* SEO Content Block - GEO/AEO optimized */}
        <div className="mb-8 text-sm text-brand-muted">
          <p className="font-semibold text-brand-accent mb-2">🍽️ Bite Me Baby — Cloud Kitchen Operating Platform เมืองจันทบุรี</p>
          <p>
            บริการสั่งอาหารจัดส่งเมืองจันทบุรี รัศมี 5 กม. ส่งฟรีเมื่อครบ ฿200 • 
            เมนูจานเดียว ข้าว แกง เครื่องดื่ม ของหวาน • 
            ส่งเช้า กลางวัน เย็น • 
            รองรับ Same-day Order และ Pre-order • 
            AI Assistant "ไบต์" ตอบคำถาม 24/7
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
                    <Link to={link.path} className="text-sm text-brand-muted hover:text-brand-primary transition-colors">
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        {/* Social Links */}
        <div className="flex justify-center gap-4 mb-6">
          {socialLinks.map((social) => (
            <a
              key={social.label}
              href={social.path}
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
            จัดส่งอาหาร • รัศมี 5 กม. • ส่งฟรีเมื่อครบ ฿200 • Same-day & Pre-order • AI Assistant 24/7
          </p>
        </div>
      </div>
    </footer>
  )
}