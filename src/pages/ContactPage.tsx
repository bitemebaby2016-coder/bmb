import { useState, useEffect, useRef } from 'react'
import { Link } from 'react-router-dom'
import { showToast } from '@/components/ui/ToastContainer'
import { loadGoogleMapsJS, isGoogleMapsConfigured } from '@/lib/googleMaps'

export function ContactPage() {
  const [formData, setFormData] = useState({ name: '', email: '', message: '' })
  const [sending, setSending] = useState(false)
  const [mapReady, setMapReady] = useState(false)
  const mapRef = useRef<HTMLDivElement>(null)

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSending(true)
    // Simulate sending
    setTimeout(() => {
      showToast('ส่งข้อความสำเร็จ! เราจะตอบกลับโดยเร็ว', 'success')
      setFormData({ name: '', email: '', message: '' })
      setSending(false)
    }, 1000)
  }

  // Load Google Maps & render interactive map
  useEffect(() => {
    if (!isGoogleMapsConfigured()) return
    loadGoogleMapsJS().then(() => {
      if (mapRef.current && !mapReady && (window as any).google?.maps) {
        const kitchenLat = parseFloat(import.meta.env.VITE_DELIVERY_KITCHEN_LAT ?? '10.7016')
        const kitchenLng = parseFloat(import.meta.env.VITE_DELIVERY_KITCHEN_LNG ?? '102.1429')
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
      <p className="text-brand-muted mb-8">เรามีปัหาหรือข้อเสนอแนะ? บอกเราได้เลย!</p>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        {/* Contact Form */}
        <div className="card">
          <h2 className="text-xl font-bold text-brand-accent mb-4">✉️ ส่งข้อความถึงเรา</h2>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-brand-accent mb-1">ชื่อ</label>
              <input type="text" value={formData.name} onChange={(e) => setFormData({...formData, name: e.target.value})} className="input w-full" placeholder="ชื่อของคุ" required />
            </div>
            <div>
              <label className="block text-sm font-medium text-brand-accent mb-1">อีเมล</label>
              <input type="email" value={formData.email} onChange={(e) => setFormData({...formData, email: e.target.value})} className="input w-full" placeholder="your@email.com" required />
            </div>
            <div>
              <label className="block text-sm font-medium text-brand-accent mb-1">ข้อความ</label>
              <textarea value={formData.message} onChange={(e) => setFormData({...formData, message: e.target.value})} className="input w-full" rows={5} placeholder="พิมพข้อความที่นี่..." required />
            </div>
            <button type="submit" disabled={sending} className="btn btn-primary w-full">
              {sending ? '⏳ กำลังส่ง...' : '📨 ส่งข้อความ'}
            </button>
          </form>
        </div>

        {/* Contact Info */}
        <div className="space-y-6">
          <div className="card bg-gradient-to-br from-orange-50 to-yellow-50">
            <h3 className="font-bold text-brand-accent mb-3">ข้อมลติดต่อ</h3>
            <div className="space-y-3 text-sm">
              <p>📍 เมืองจันทบุรี รัศมีจัดส่ง 5 กม.</p>
              <p>📞 <a href="tel:+66xxxxxxxxx" className="text-brand-primary hover:underline">08X-XXX-XXXX</a></p>
              <p>✉️ <a href="mailto:hello@bitemebaby.co.th" className="text-brand-primary hover:underline">hello@bitemebaby.co.th</a></p>
              <p>💬 LINE: @BiteMeBaby</p>
              <p className="pt-2 border-t border-brand-border-light"><strong>เวลาทำการ:</strong></p>
              <p>ทุกวัน • 06:00 - 20:00</p>
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
              <a href="#" className="w-10 h-10 bg-blue-600 text-white rounded-lg flex items-center justify-center hover:bg-blue-700 transition-colors">f</a>
              <a href="#" className="w-10 h-10 bg-green-500 text-white rounded-lg flex items-center justify-center hover:bg-green-600 transition-colors">L</a>
              <a href="#" className="w-10 h-10 bg-pink-500 text-white rounded-lg flex items-center justify-center hover:bg-pink-600 transition-colors">I</a>
              <a href="#" className="w-10 h-10 bg-black text-white rounded-lg flex items-center justify-center hover:bg-gray-800 transition-colors">T</a>
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