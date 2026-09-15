import { useState } from 'react'
import { Link } from 'react-router-dom'

interface FAQItem {
  q: string
  a: string
}

const faqs: FAQItem[] = [
  {
    q: 'Bite Me Baby คืออะไร?',
    a: 'Bite Me Baby เปน Cloud Kitchen Operating Platform ที่ให้บริการสั่งอาหารจัดส่งถึงบ้านในเมืองจันทบุรี ดยรัศมี 5 กม. จากครัว เราใช้เทคนลยี AI ช่วยในการบริการลกค้า 24/7 พร้อมระบบจัดการออเดอรที่ทันสมัย'
  },
  {
    q: 'บริการจัดส่งครอบคลุมพื้นที่ไหน?',
    a: 'ปัจจุบันเราให้บริการในรัศมี 5 กม. จากตัวเมืองจันทบุรี ดยรองรับทั้งรอบเช้า (06:00-09:00), รอบกลางวัน (11:00-14:00) และรอบเยน (17:00-20:00)'
  },
  {
    q: 'ค่าจัดส่งเท่าไหร่?',
    a: 'ค่าจัดส่งเริ่มต้นที่ 30 บาท สำหรับระยะทางภายใน 5 กม. และสามารถได้รับสิทิส่งฟรีเมื่อสั่งื้อครบ 200 บาทขึ้นไป (ไม่รวมค่าส่วนลดและเครื่องดื่มแอลกอฮอล)'
  },
  {
    q: 'มีรอบการจัดส่งกี่รอบ?',
    a: 'เรามี 3 รอบการจัดส่ง:\n• รอบเช้า (Morning): รับถึง 08:00 / จัดส่ง 06:00-09:00\n• รอบกลางวัน (Midday): รับถึง 10:30 / จัดส่ง 11:00-14:00\n• รอบเยน (Evening): รับถึง 16:00 / จัดส่ง 17:00-20:00'
  },
  {
    q: 'ชำระเงินได้อย่างไรบ้าง?',
    a: 'เรารองรับ 2 วิีการชำระเงิน:\n• QR PromptPay: สแกนจ่ายได้เลย สะดวก รวดเรว\n• Cash on Delivery: จ่ายเงินสดตอนรับของ'
  },
  {
    q: 'สามารถจองล่วงหน้าได้ไหม?',
    a: 'ได้! คุสามารถเลือกเมนที่ต้องการและกด "จองล่วงหน้า" เพื่อเลือกรอบจัดส่งที่ต้องการ ระบบจะบันทึกการจองไว้และแจ้งเตือนเมื่อถึงเวลาจัดส่ง'
  },
  {
    q: 'มีปรมชั่นอะไรบ้าง?',
    a: 'เรา常有ปรมชั่นหลากหลาย เช่น:\n• WELCOME10 — ลกค้าใหม่ลด 10%\n• FREESHIP — ส่งฟรีเมื่อื้อครบ ฿200\n• LUNCH50 — Flash Sale ลด ฿50 เมื่อื้อครบ ฿300\n• MORNING15 — ลด 15% สำหรับออเดอรรอบเช้า\nดปรมชั่นล่าสุดได้ที่หน้า ปรมชั่น'
  },
  {
    q: 'คะแนน Loyalty ได้ยังไง?',
    a: 'คุสามารถสะสมแต้มได้หลายวิี:\n• สั่งอาหาร +5 แต้ม/ออรเดอร\n• รีวิว +10 แต้ม/รีวิว\n• หวตเมน +5 แต้ม/ครั้ง\n• สุ่มเมน +3 แต้ม/ครั้ง\n• เชิเพื่อน +50 แต้ม/คน\n• Daily login +2 แต้ม/วัน'
  },
  {
    q: 'แลกแต้มเปนอะไรได้บ้าง?',
    a: 'คุสามารถแลกแต้มกับรางวัลต่างๆ เช่น:\n• คปองลด 10% (100 แต้ม)\n• ส่งฟรี 1 ครั้ง (150 แต้ม)\n• เมนฟรี 1 จาน (200 แต้ม)\n• คปองลด 20% (300 แต้ม)'
  },
  {
    q: 'ติดต่อ Bite Me Baby ได้อย่างไร?',
    a: 'คุสามารถติดต่อเราได้ผ่าน:\n• อีเมล: hello@bitemebaby.co.th\n• หน้า ติดต่อเรา — กรอกแบบฟอรมหรือแผนที่\n• แอพพลิเคชั่น — มีปุ่มแชท AI Avatar อย่มุมขวาล่างของทุกหน้า\n•social media — Facebook, LINE Official Account'
  },
  {
    q: 'AI Assistant ตอบคำถามอะไรได้บ้าง?',
    a: 'AI Assistant ของเรารองรับการตอบคำถามเกี่ยวกับ:\n• เมนอาหารทั้งหมด + ราคา\n• สถานะออเดอร\n• เวลาทำการและรอบจัดส่ง\n• ปรมชั่นที่กำลังดำเนินการอย่\n• ข้อมลร้านและที่อย่'
  },
  {
    q: 'ต้องการเสนอไอเดียเมนใหม่ ทำยังงัย?',
    a: 'คุหวตเมนที่ต้องการได้ที่หน้า "หวตเมน" เราเปิดให้ลกค้าหวตเมนใหม่ทุกเดือน และเมนที่ได้คะแนนสงสุดจะถกเพิ่มเข้าเมนหลัก!'
  }
]

export function FaqPage() {
  const [openIndex, setOpenIndex] = useState<number | null>(null)

  return (
    <div className="max-w-3xl mx-auto px-4 py-8">
      <h1 className="text-3xl font-bold text-brand-accent mb-2">❓ คำถามที่พบบ่อย (FAQ)</h1>
      <p className="text-brand-muted mb-8">คำตอบสำหรับคำถามที่คุมักถามมา</p>

      <div className="space-y-4">
        {faqs.map((faq, idx) => (
          <div key={idx} className="card overflow-hidden">
            <button
              onClick={() => setOpenIndex(openIndex === idx ? null : idx)}
              className="w-full flex items-center justify-between p-4 text-left"
            >
              <span className="font-semibold text-brand-accent pr-4">{faq.q}</span>
              <span className={`text-xl transition-transform duration-200 ${openIndex === idx ? 'rotate-180' : ''}`}>▼</span>
            </button>
            {openIndex === idx && (
              <div className="px-4 pb-4 text-brand-text-secondary whitespace-pre-line">
                {faq.a}
              </div>
            )}
          </div>
        ))}
      </div>

      <div className="mt-8 card bg-gradient-to-r from-orange-50 to-yellow-50 text-center">
        <h3 className="text-lg font-bold text-brand-accent mb-2">🤔 ยังไงไม่ได้?</h3>
        <p className="text-brand-muted mb-4">ติดต่อเราดยตรงหรือถาม AI Assistant ของเรา</p>
        <div className="flex gap-3 justify-center">
          <Link to="/contact" className="btn btn-primary">📧 ติดต่อเรา</Link>
          <Link to="/ai-chat" className="btn btn-outline">💬 ถาม AI</Link>
        </div>
      </div>
    </div>
  )
}