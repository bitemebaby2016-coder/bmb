'use strict'
// _r67_t4_faq_a — R67-T4 FAQ/Promo auto-sync: overwrite src/lib/faqContent.ts (chunk A)
// Defects vs backend (probe 2026-11-04): "ส่งฟรีครบ 200" แต่ freeShippingThreshold=300
// และ freeShippingEnforced=false (ZERO-FAKE ห้ามสัญญาส่งฟรี) · "ค่าส่ง 30" แต่
// biteDriveFlatFee=25 · "2 วิธีชำระเงิน" แต่ PaymentMethod มี 3 · เวลา 7:00 แต่
// business_settings.hours = 8:00-20:00 · รอบเวลา hardcode ผิดของจริง.
// Fix = buildFaqs(src) pure: ทุกตัวเลข/ข้อความระบบมาจาก PlatformConfig + shopHours +
// PAYMENT_METHOD_LABELS — backend เปลี่ยน → คำตอบเปลี่ยนเองทั้งหน้า /faq และ JSON-LD
const fs = require('fs')
const TARGET = 'src/lib/faqContent.ts'

const A = `// ============================================
// BMB — FAQ content (single source of truth)
// ============================================
// AEO rule: FaqPage และ FAQPage JSON-LD (seo.ts) ต้องสร้างจาก builder เดียวกัน —
// structured data ไม่มีทางเพี้ยนจากเนื้อหาที่เห็น
// R67-T4 (Owner 2026-11-04 "ข้อความ FAQ และตัวเลขโปรโมชั่น … ต้องปรับตามอัตโนมัติ"):
//   ตัวเลข/ข้อความที่อ้างระบบ (ค่าส่ง รัศมี ส่งฟรี รอบ วิธีชำระเงิน เวลาเปิดร้าน)
//   มาจาก PlatformConfig (hydrate จาก business_settings) + shopHours +
//   PAYMENT_METHOD_LABELS — ไม่ hardcode ใด ๆ · ห้ามสัญญา "ส่งฟรี" ถ้า server
//   ยังไม่ enforce (ZERO-FAKE closure 2026-10-18) · ข้อความโปรโมชันชี้หน้า
//   "โปรโมชั่น" ที่อ่านจาก DB สดเสมอ (ไม่พิมพ์ตัวเลขโปรใน FAQ)
// ============================================

import type { PaymentMethod } from '@/types'
import type { DeliveryConfig } from '@/config/platformConfig'
import { DEFAULT_PLATFORM_CONFIG, usePlatformConfigStore } from '@/config/platformConfig'
import { getShopHours, type ShopHours } from '@/lib/shopHours'

export interface FAQItem {
  q: string
  a: string
}

/** ป้ายวิธีชำระเงิน — type-checked กับ PaymentMethod (enum เปลี่ยน = compile บังคับแก้ที่นี่) */
export const PAYMENT_METHOD_LABELS: Record<PaymentMethod, string> = {
  promptpay_qr: 'QR PromptPay',
  credit_card: 'บัตรเครดิต/เดบิต',
  cash_on_delivery: 'เงินสดปลายทาง (COD)',
}

export interface FaqSource {
  delivery: DeliveryConfig
  shopHours: ShopHours | null
}

/** คำตอบ FAQ จากค่าจริงของระบบ — pure builder (ทดสอบได้ด้วย config ปลอม) */
export function buildFaqs(src: FaqSource): FAQItem[] {
  const d = src.delivery
  const methods = Object.values(PAYMENT_METHOD_LABELS)
  const hours = src.shopHours
    ? \`เปิด \${src.shopHours.open} - \${src.shopHours.close}\`
    : 'เวลาเปิดร้านดูได้ที่แถบสถานะด้านบนของหน้าแรก'
  const freeShip = d.freeShippingEnforced
    ? \`สั่งซื้อครบ \${d.freeShippingThreshold} บาท ได้สิทธิ์ส่งฟรีตามเงื่อนไขที่ระบบบังคับใช้จริง\`
    : 'ตอนนี้ยังไม่มีโปรโมชันส่งฟรีในระบบ — ดูโปรโมชันที่ใช้ได้จริงที่หน้า "โปรโมชั่น"'

  return [
    {
      q: 'Bite Me Baby คืออะไร?',
      a: 'Bite Me Baby เป็น Cloud Kitchen Operating Platform ที่ให้บริการสั่งอาหารจัดส่งถึงบ้านในเมืองจันทบุรี โดยรัศมี \${d.biteDriveMaxDistanceKm} กม. จากครัว เราใช้เทคโนโลยี AI ช่วยในการบริการลูกค้า 24/7 พร้อมระบบจัดการออเดอร์ที่ทันสมัย'
    },
    {
      q: 'บริการจัดส่งครอบคลุมพื้นที่ไหน?',
      a: 'ปัจจุบันเราให้บริการในรัศมี \${d.biteDriveMaxDistanceKm} กม. จากตัวเมืองจันทบุรี แบ่งเป็นรอบเช้า กลางวัน และเย็น (ดูรอบที่เปิดรับของแต่ละวันได้ที่หน้าเลือกเวลาจัดส่ง)'
    },
    {
      q: 'ค่าจัดส่งเท่าไหร่?',
      a: 'ค่าจัดส่งคิดตามระยะทางจริง เริ่มต้นที่ \${d.biteDriveFlatFee} บาท สำหรับพื้นที่ใกล้ครัว และปรับตามโซนระยะทาง (ยอดจริงแสดงทุกครั้งตอนเช็คเอาท์) — \${freeShip}'
    },
    {
      q: 'มีรอบการจัดส่งกี่รอบ?',
      a: 'ระบบแบ่งรอบจัดส่งเป็น 3 ช่วง: เช้า กลางวัน และเย็น — เวลาเปิดรับและเวลาจัดส่งของแต่ละรอบแสดงที่หน้าเช็คเอาท์ตามรอบจริงของวันนั้น (แอดมินปรับเวลา/ปิดรอบได้ตลอดเวลา)'
    },
`

fs.writeFileSync(TARGET, A, 'utf8')
console.log('OK wrote chunk A -> ' + TARGET + ' chars=' + A.length)
