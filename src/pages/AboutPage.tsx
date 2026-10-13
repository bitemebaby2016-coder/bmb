import { Link } from 'react-router-dom'

export function AboutPage() {
  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      <h1 className="text-3xl font-bold text-brand-accent mb-6">เกี่ยวกับ Bite Me Baby</h1>
      
      <div className="prose prose-lg max-w-none">
        <div className="bg-brand-surface rounded-xl p-6 shadow-md mb-6">
          <h2 className="text-2xl font-bold text-brand-accent mb-4">🍽️ Cloud Kitchen Operating Platform</h2>
          <p className="text-brand-text-secondary leading-relaxed">
            <strong>Bite Me Baby</strong> คือแพลตฟอร์ม Cloud Kitchen ที่รวมระบบจัดการออเดอร์ 
            การควบคุมสต็อก ลูกค้า และระบบ AI มาไว้ในระบบเดียว สำหรับร้านค้าผู้ปรุงอาหารเมืองจันทบุรี
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
          <div className="bg-brand-surface rounded-xl p-6 shadow-md">
            <h3 className="text-xl font-bold text-brand-accent mb-3">🚀 วิสัยทัศน์</h3>
            <p className="text-brand-text-secondary">
              เป็นแพลตฟอร์มสั่งอาหารจัดส่งที่เน้นความรวดเร็ว ความสดใหม่ และประสบการณ์ลูกค้าที่ดี 
              ด้วยเทคโนโลยี AI และระบบจัดการที่ทันสมัย
            </p>
          </div>
          <div className="bg-brand-surface rounded-xl p-6 shadow-md">
            <h3 className="text-xl font-bold text-brand-accent mb-3">🎯 พันธกิจ</h3>
            <ul className="text-brand-text-secondary space-y-2 list-disc list-inside">
              <li>ให้บริการอาหารสดใหม่ทุกมื้อ</li>
              <li>จัดส่งรวดเร็วภายใน 5 กม.</li>
              <li>ใช้ AI ช่วยลูกค้า 24/7</li>
              <li>สนับสนุนเกษตรกรและวัตถุดิบท้องถิ่น</li>
            </ul>
          </div>
        </div>

        <div className="bg-brand-surface rounded-xl p-6 shadow-md mb-6">
          <h3 className="text-xl font-bold text-brand-accent mb-3">📍 สถานที่</h3>
          <p className="text-brand-text-secondary mb-2">
            <strong>เมืองจันทบุรี</strong> • รัศมี 5 กม. จากครัว
          </p>
          <p className="text-brand-text-secondary">
            รับสั่งอาหารจัดส่งทุกวัน • ส่งเช้า (06:00-09:00) • กลางวัน (11:00-14:00) • เย็น (17:00-20:00)
          </p>
        </div>

        <div className="bg-brand-surface rounded-xl p-6 shadow-md">
          <h3 className="text-xl font-bold text-brand-accent mb-3">📞 ติดต่อเรา</h3>
          <div className="space-y-2 text-brand-text-secondary">
            <p>📍 เมืองจันทบุรี รัศมี 5 กม.</p>
            <p>📞 08X-XXX-XXXX</p>
            <p>✉️ hello@bitemebaby.co.th</p>
            <p>🕐 08:00 - 22:00</p>
          </div>
        </div>
      </div>
    </div>
  )
}