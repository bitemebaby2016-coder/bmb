'use strict'
// _r67_t4_faq_b — R67-T4 FAQ/Promo auto-sync: append rest of src/lib/faqContent.ts
const fs = require('fs')
const TARGET = 'src/lib/faqContent.ts'

const B = `    {
      q: 'ชำระเงินได้อย่างไรบ้าง?',
      a: 'เรารองรับ \${methods.length} วิธีการชำระเงิน:\\n\${methods.map((m) => '• ' + m).join('\\n')}'
    },
    {
      q: 'สามารถจองล่วงหน้าได้ไหม?',
      a: 'ได้! คุณสามารถเลือกเมนูที่ต้องการและกด "จองล่วงหน้า" เพื่อเลือกรอบจัดส่งที่ต้องการ ระบบจะบันทึกการจองไว้และแจ้งเตือนเมื่อถึงเวลาจัดส่ง'
    },
    {
      q: 'มีโปรโมชั่นอะไรบ้าง?',
      a: 'โปรโมชั่นปัจจุบันของร้านแสดงที่หน้า "โปรโมชั่น" (อัปเดตจากฐานข้อมูลร้านโดยอัตโนมัติ) — โค้ดส่วนลดที่ใช้ได้จริงจะแสดงในหน้านั้นพร้อมเงื่อนไข กรอกโค้ดได้ที่หน้าชำระเงิน ระบบจะตรวจสอบส่วนลดบนเซิร์ฟเวอร์ตอนสั่งซื้อ'
    },
    {
      q: 'คะแนน Loyalty ได้ยังไง?',
      a: 'คุณสามารถสะสมแต้มได้หลายวิธี:\\n• สั่งอาหาร +5 แต้ม/ออเดอร์\\n• รีวิว +10 แต้ม/รีวิว\\n• โหวตเมนู +5 แต้ม/ครั้ง\\n• สุ่มเมนู +3 แต้ม/ครั้ง\\n• เชิญเพื่อน +50 แต้ม/คน\\n• Daily login +2 แต้ม/วัน\\n(โปรแกรมสะสมแต้มอยู่ในช่วงพรีวิว — แต้มยังไม่มีมูลค่าจริงจนกว่าระบบจะเปิดใช้เต็มรูปแบบ)'
    },
    {
      q: 'แลกแต้มเป็นอะไรได้บ้าง?',
      a: 'คุณสามารถแลกแต้มกับรางวัลต่าง ๆ เช่น:\\n• คูปองลด 10% (100 แต้ม)\\n• ส่งฟรี 1 ครั้ง (150 แต้ม)\\n• เมนูฟรี 1 จาน (200 แต้ม)\\n• คูปองลด 20% (300 แต้ม)\\n(รายการแลกเป็นพรีวิว — ยังไม่มีการออกคูปองจริงจนกว่าระบบจะเปิดใช้เต็มรูปแบบ)'
    },
    {
      q: 'ติดต่อ Bite Me Baby ได้อย่างไร?',
      a: 'คุณสามารถติดต่อเราได้ผ่าน:\\n• โทรศัพท์: 094 2649269 (\${hours})\\n• อีเมล: admin@biteme-baby.com\\n• Messenger / Facebook: ปุ่มโซเชียลในฟุตเตอร์\\n• หน้า ติดต่อเรา — กรอกแบบฟอร์มหรือดูแผนที่\\n• แอปพลิเคชัน — มีปุ่มแชท AI Avatar อยู่มุมขวาล่างของทุกหน้า\\n• Social Media — Facebook, Messenger'
    },
    {
      q: 'AI Assistant ตอบคำถามอะไรได้บ้าง?',
      a: 'AI Assistant ของเรารองรับการตอบคำถามเกี่ยวกับ:\\n• เมนูอาหารทั้งหมด + ราคา\\n• สถานะออเดอร์\\n• เวลาทำการและรอบจัดส่ง\\n• โปรโมชั่นที่กำลังดำเนินการอยู่\\n• ข้อมูลร้านและที่อยู่'
    },
    {
      q: 'ต้องการเสนอไอเดียเมนูใหม่ ทำอย่างไร?',
      a: 'คุณโหวตเมนูที่ต้องการได้ที่หน้า "โหวตเมนู" เราเปิดให้ลูกค้าโหวตเมนูใหม่ทุกเดือน และเมนูที่ได้คะแนนสูงสุดจะถูกเพิ่มเข้าเมนูหลัก!'
    }
  ]
}

/** คำตอบจากค่าจริงของระบบ ณ ตอนนี้ (store ปัจจุบัน) — ใช้ทั้งหน้า /faq และ JSON-LD */
export function getFaqs(): FAQItem[] {
  return buildFaqs({
    delivery: usePlatformConfigStore.getState().config.delivery,
    shopHours: getShopHours(),
  })
}

/** Snapshot จากค่า default — คงไว้ให้ test/ผู้บริโภคเดิม (ตัวเลขเดียวกับระบบตอนยังไม่ hydrate) */
export const faqs: FAQItem[] = buildFaqs({
  delivery: DEFAULT_PLATFORM_CONFIG.delivery,
  shopHours: null,
})
`

fs.appendFileSync(TARGET, B, 'utf8')
const full = fs.readFileSync(TARGET, 'utf8')
console.log('OK appended chunk B chars=' + B.length + ' total=' + full.length)
const must = ['export function buildFaqs', 'export function getFaqs', 'PAYMENT_METHOD_LABELS', 'freeShippingEnforced', 'export const faqs', 'FaqSource']
for (const m of must) {
  if (!full.includes(m)) { console.error('FAIL missing: ' + m); process.exit(1) }
}
if (full.includes('ส่งฟรีเมื่อสั่งซื้อครบ 200')) { console.error('FAIL stale hardcode 200 remains'); process.exit(1) }
console.log('ALL_ASSERTS_OK')
