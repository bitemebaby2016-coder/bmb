import { useState, useEffect, useRef } from 'react'
import { Link } from 'react-router-dom'
import { showToast } from '@/components/ui/ToastContainer'
import { loadGoogleMapsJS, isGoogleMapsConfigured } from '@/lib/googleMaps'
import { KITCHEN_LAT, KITCHEN_LNG } from '@/config/kitchenLocation'
import { SHOP_CONTACT } from '@/components/layout/Footer'
import { DEFAULT_SOCIAL_LINKS, getSocialLinks, socialLinkItems, type SocialLinkItem } from '@/lib/socialLinks'

// ปุ่มโซเชียล — สีตามเครือข่าย (ลิงก์จริงจาก business_settings เท่านั้น)
const SOCIAL_BTN_STYLES: Record<string, string> = {
  facebook: 'bg-blue-600 hover:bg-blue-700',
  messenger: 'bg-blue-500 hover:bg-blue-600',
  line: 'bg-green-500 hover:bg-green-600',
  instagram: 'bg-pink-500 hover:bg-pink-600',
  tiktok: 'bg-black hover:bg-gray-800',
  youtube: 'bg-red-600 hover:bg-red-700',
}

export function ContactPage() {
  const [formData, setFormData] = useState({ name: '', email: '', message: '' })
  const [sending, setSending] = useState(false)
  const [mapReady, setMapReady] = useState(false)
  const mapRef = useRef<HTMLDivElement>(null)
  // ปุ่มโซเชียล — ลิงก์จริงจาก business_settings (fallback = ค่าร้านที่ Owner ยืนยัน)
  const [socials, setSocials] = useState<SocialLinkItem[]>(() => socialLinkItems(DEFAULT_SOCIAL_LINKS))

  useEffect(() => {
    let alive = true
    getSocialLinks()
      .then((links) => { if (alive) setSocials(socialLinkItems(links)) })
      .catch(() => { /* โหลดไม่ได้ = ใช้ค่าเริ่มต้นต่อ */ })
    return () => { alive = false }
  }, [])

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSending(true)
    // ZERO-FAKE (closure 2026-10-18): เดิมฟอร์มนี้ "simulate sending" แล้วโชว์
    // "ส่งข้อความสำเร็จ!" ทั้งที่ข้อความไม่เคยถูกส่งไปไหน — ตอนนี้ส่งต่อผ่าน
    // แอปอีเมลของลูกค้า (mailto → กล่องจดหมายร้าน) ซึ่งเป็นช่องทางจริง
    // และไม่มีการแสร้งว่าส่งสำเร็จจนกว่าผู้ใช้กดส่งในแอปอีเมลของตน
    const subject = encodeURIComponent(`ข้อความจากเว็บไซต์ — ${formData.name}`)
    const body = encodeURIComponent(
      `${formData.message}\n\n---\nจาก: ${formData.name}\nอีเมลตอบกลับ: ${formData.email}`,
    )
    window.location.href = `mailto:${SHOP_CONTACT.email}?subject=${subject}&body=${body}`
    showToast('เปิดแอปอีเมลของคุณแล้ว — กด "ส่ง" ในแอปอีเมลเพื่อส่งข้อความถึงเราค่ะ', 'info')
    setSending(false)
  }

  // Load Google Maps & render interactive map
  useEffect(() => {
    if (!isGoogleMapsConfigured()) return
    loadGoogleMapsJS().then(() => {
      if (mapRef.current && !mapReady && (window as any).google?.maps) {
        const kitchenLat = KITCHEN_LAT
        const kitchenLng = KITCHEN_LNG
        try {
          new ((window as any).google.maps.Map)(mapRef.current, {
            center: { lat: kitchenLat, lng: kitchenLng },
            zoom: 15,
            disableDefaultUI: false,
          })
          setMapReady(true)
        } catch { /* map failed */ }
      }
    })
  }, [])

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      <h1 className="text-3xl font-bold text-brand-accent mb-2">📍 ติดต่อเรา</h1>
      <p className="text-brand-muted mb-8">มีคำถามหรือข้อเสนอแนะ? บอกเราได้เลย!</p>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        {/* Contact Form */}
        <div className="card">
          <h2 className="text-xl font-bold text-brand-accent mb-4">✉️ ส่งข้อความถึงเรา</h2>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-brand-accent mb-1">ชื่อ</label>
              <input type="text" value={formData.name} onChange={(e) => setFormData({...formData, name: e.target.value})} className="input w-full" placeholder="ชื่อของคุณ" required />
            </div>
            <div>
              <label className="block text-sm font-medium text-brand-accent mb-1">อีเมล</label>
              <input type="email" value={formData.email} onChange={(e) => setFormData({...formData, email: e.target.value})} className="input w-full" placeholder="your@email.com" required />
            </div>
            <div>
              <label className="block text-sm font-medium text-brand-accent mb-1">ข้อความ</label>
              <textarea value={formData.message} onChange={(e) => setFormData({...formData, message: e.target.value})} className="input w-full" rows={5} placeholder="พิมพ์ข้อความที่นี่..." required />
            </div>
            <button type="submit" disabled={sending} className="btn btn-primary w-full">
              {sending ? '⏳ กำลังส่ง...' : '📨 ส่งข้อความ'}
            </button>
          </form>
        </div>

        {/* Contact Info */}
        <div className="space-y-6">
          <div className="card bg-gradient-to-br from-orange-50 to-yellow-50">
            <h3 className="font-bold text-brand-accent mb-3">ข้อมูลติดต่อ</h3>
            <div className="space-y-3 text-sm">
              <p>📍 {SHOP_CONTACT.address}</p>
              <p>📞 <a href={SHOP_CONTACT.phoneHref} className="text-brand-primary hover:underline">{SHOP_CONTACT.phone}</a></p>
              <p>✉️ <a href={SHOP_CONTACT.emailHref} className="text-brand-primary hover:underline">{SHOP_CONTACT.email}</a></p>
              <p>💬 <a href={SHOP_CONTACT.messenger} target="_blank" rel="noopener noreferrer" className="text-brand-primary hover:underline">Messenger</a> · <a href={SHOP_CONTACT.facebook} target="_blank" rel="noopener noreferrer" className="text-brand-primary hover:underline">Facebook</a></p>
              <p className="pt-2 border-t border-brand-border-light"><strong>เวลาทำการ:</strong></p>
              <p>{SHOP_CONTACT.hours}</p>
            </div>
          </div>

          {/* Interactive Google Map */}
          <div className="card overflow-hidden">
            <h3 className="font-bold text-brand-accent mb-3">🗺️ ตำแหน่งของเรา</h3>
            <div className="bg-blue-50 rounded-lg aspect-video flex items-center justify-center overflow-hidden">
              {isGoogleMapsConfigured() ? (
                <div ref={mapRef} className="w-full h-full" style={{ minHeight: '200px' }} />
              ) : (
                <div className="text-center text-brand-muted p-4">
                  <p className="text-4xl mb-2">🗺️</p>
                  <p className="text-sm">กำลังโหลดแผนที่...</p>
                </div>
              )}
            </div>
          </div>

          {/* Social Media */}
          <div className="card">
            <h3 className="font-bold text-brand-accent mb-3">🌐 Social Media</h3>
            <div className="flex gap-3">
              {socials.length === 0 ? (
                <p className="text-sm text-brand-muted">ยังไม่ได้ตั้งค่าลิงก์โซเชียล — ติดต่อผ่านโทรศัพท์/อีเมลด้านบนได้เลยค่ะ</p>
              ) : (
                socials.map((social) => (
                  <a
                    key={social.network}
                    href={social.href}
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-label={social.label}
                    title={social.label}
                    className={`w-10 h-10 text-white rounded-lg flex items-center justify-center transition-colors ${SOCIAL_BTN_STYLES[social.network] ?? 'bg-gray-700 hover:bg-gray-800'}`}
                  >
                    <span aria-hidden="true">{social.icon}</span>
                  </a>
                ))
              )}
            </div>
          </div>
        </div>
      </div>

      {/* AI Chat CTA */}
      <div className="mt-8 card bg-gradient-to-r from-purple-50 to-pink-50 text-center">
        <h3 className="text-lg font-bold text-brand-accent mb-2">💬 ต้องการคำตอบทันที?</h3>
        <p className="text-brand-muted mb-4">ลองแชทกับ AI Assistant ของเรา — ตอบคำถาม 24/7!</p>
        <Link to="/ai-chat" className="btn btn-primary">เริ่มแชท →</Link>
      </div>
    </div>
  )
}