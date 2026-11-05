// ============================================
// Bite Me Baby — R56: แปลงออเดอร์ → ช่องแบบฟอร์มสติกเกอร์ 40×60
// R66 (Owner 2026-11-04): ORDER LIST เว้นว่างในฟอร์ม 3 บรรทัด · เนื้อหาต่อเนื่องจนล้นแถว
// ============================================
// แบบฟอร์มใหม่ตามที่ Owner วาดในแอป Nimbot (Templates-BmB · TT40*60-125transparent):
//   BITE ME BABY · " More Than Dellicious " · เส้นคั่น
//   Date : …  TIME : … · ○ Pre-Order ○ Same Day · ○ ทานที่ร้าน ○ สั่งกลับบ้าน ○ รับที่ร้าน
//   ORDER ID : … · ORDER LIST : … (ต่อ ": …" ได้ 3 บรรทัดใต้ป้าย — R66) · NOTICE : …
//   [ DELIVERY / CUSTOMER ] · Attn : ชื่อ (โทร) · Add : ที่อยู่
//   [ TOTAL NET ] : … THB · [PAID] : ○ B/T ○ QR PROMPTPAY ○ COD
//   QR + SCAN FOR MORE + Thank You for love !
//
// กติกา Owner (2026-11-02): "รายละเอียดพิมใส่ด้านหลังเครื่องหมาย : แทนในตัวอย่าง"
//   ⇒ ป้ายซ้ายคงตาย · ค่าจริงจากออเดอร์อยู่หลัง ":" เสมอ
//   ⇒ วงกลม = "เอาไว้ติ๊กประเภทของออเดอร์ 5 แบบ" (ไม่ใช่ ถูก/ผิด):
//      Pre-Order · Same Day · ทานที่ร้าน · สั่งกลับบ้าน · รับที่ร้าน → อันที่ตรง = ● ที่เหลือ = ○
//   ⇒ "POS เวลารอบส่งไม่มีนะ ใช้เป็นดีฟอลต์เวลาปัจจุบันลงเวลาพิมพ์ใบเสร็จ"
//      ⇒ Date/TIME = เวลา ณ ตอนพิมพ์ (default = now · ไม่อ่าน created_at/scheduled_date)
//   ⇒ "การจ่ายเงิน BT / QR Promptpay / COD ต้องใส่ข้อมูลให้ครบทุกอัน ... ลิงก์จากรายละเอียดจริงของลูกค้า"
//      ⇒ แสดงครบทั้ง 3 ช่องเสมอ + ติ๊ก ● จาก payment_method จริง (ทุกค่าใน DB มีช่องของตัวเอง)
//
// กติกา Owner (2026-11-04 — R66):
//   ⇒ "ORDER LIST เว้นว่างในฟอร์มเทมเพลตเพิ่มเป็น 3 บรรทัด ถ้ามีหลายรายการให้เอไอพิมต่อยาว
//      จนล้นต่อบรรทัด ไม่ต้องพิม 1 รายการ 1 บรรทัด" = block คงที่ 4 แถว (ป้าย + เว้นว่าง 3)
//      เนื้อหา pack ต่อเนื่อง (ของเดิม pack แบบ flow อยู่แล้ว — เพิ่ม maxLines 3→4 + จองแถวว่างคงที่)
//
// โมดูลนี้ = จุดเดียวที่ "แปลง" → HTML (printService) และ PNG (stickerPng)
//   ใช้ชุดค่าเดียวกัน ⇒ สองทางพิมพ์ตรงกันเสมอ (มี test บังคับ)
// pure = ไม่แตะ network · ชนิด PrintOrderData ชนิดอย่างเดียว (ไม่ import runtime)
// ============================================
import type { PrintOrderData } from './printService'

/** ป้ายชนิดบริการ 3 หมวด — ต้องตรงกับ POS_SERVICE_META (test จับ drift) */
export const STICKER_SERVICE_LABELS = {
  dine_in: 'ทานที่ร้าน',
  takeaway: 'สั่งกลับบ้าน',
  pickup: 'รับที่ร้าน',
} as const
export type StickerServiceKey = keyof typeof STICKER_SERVICE_LABELS
export const STICKER_SERVICE_KEYS: readonly StickerServiceKey[] = ['dine_in', 'takeaway', 'pickup']

/** ช่อง [PAID] 3 ตัวเลือกตามแบบ Owner: ○ B/T  ○ QR PROMPTPAY  ○ COD — แสดงครบทุกใบเสมอ */
export const STICKER_PAID_OPTIONS = [
  { key: 'bank_transfer', label: 'B/T' },
  { key: 'promptpay_qr', label: 'QR PROMPTPAY' },
  { key: 'cash_on_delivery', label: 'COD' },
] as const
export type StickerPaidKey = (typeof STICKER_PAID_OPTIONS)[number]['key']

/**
 * payment_method จริง (enum DB: promptpay_qr | credit_card | cash_on_delivery · TS type มี bank_transfer)
 * → ช่องในแบบฟอร์ม · Owner: "ต้องใส่ข้อมูลให้ครบทุกอัน" ⇒ ทุกค่าต้องมีช่อง = ใบเสร็จติ๊กครบเสมอ
 *  credit_card → B/T (ช่องเดียวที่เหลือของแบบ · ถ้า Owner อยากให้ไปช่องอื่น = แก้บรรทัดนี้ที่เดียว)
 */
const PAID_METHOD_TO_OPTION: Record<string, StickerPaidKey> = {
  bank_transfer: 'bank_transfer',
  credit_card: 'bank_transfer',
  promptpay_qr: 'promptpay_qr',
  cash_on_delivery: 'cash_on_delivery',
  cod: 'cash_on_delivery',
}

/**
 * R66 (Owner): "ORDER LIST เว้นว่างในฟอร์มเทมเพลตเพิ่มเป็น 3 บรรทัด"
 * ⇒ block คงที่ 4 แถว = ป้าย 1 (มีค่าบรรทัดแรก) + เว้นว่าง/ค่า ต่ออีก 3 แถว
 * เนื้อหาไหลต่อเนื่อง (~24 อักขระ/แถว · " · " คั่น) — ไม่ใช่ 1 รายการ 1 บรรทัด
 */
const ORDER_LIST_PER_LINE = 24
const ORDER_LIST_MAX_LINES = 4

export interface StickerFormFields {
  date: string
  time: string
  modePreOrder: boolean
  modeSameDay: boolean
  /** หมวดบริการที่ต้องติ๊ก ● — null = ไม่มีข้อมูล (ไม่ติ๊กวงกลมไหน) */
  service: StickerServiceKey | null
  orderId: string
  /** ค่าช่อง ORDER LIST — 1..4 บรรทัด (ว่าง = ['-']) · แถวแรกหลัง "ORDER LIST :" ที่เหลือหลัง ":" */
  orderListLines: string[]
  notice: string
  /** "ชื่อลูกค้า (0812345678)" */
  attn: string
  add: string
  /** ยอดสุทธิ 2 ตำแหน่ง (1,234.50) */
  totalNet: string
  /** วิธีชำระที่ตรงกับ 1 ใน 3 ช่อง — null = ไม่อยู่ในช่องแบบ (เช่น credit_card) */
  paid: StickerPaidKey | null
}
/**
 * Date/TIME บนใบ = "เวลาปัจจุบัน ณ ตอนพิมพ์ใบเสร็จ" (Owner: "POS เวลารอบส่งไม่มีนะ ใช้เป็นดีฟอลต์
 * เวลาปัจจุบันลงเวลาพิมพ์ใบเสร็จ") ⇒ ไม่อ่าน created_at/scheduled_date · default = now
 * @param at เวลาพิมพ์ — test ใส่เองได้ (ค่าคงที่) · production ไม่ใส่ = เวลาจริงตอนพิมพ์
 */
function dateParts(at: Date | number): { date: string; time: string } {
  const d = new Date(at)
  if (Number.isNaN(d.getTime())) return { date: '-', time: '-' }
  return {
    date: d.toLocaleDateString('th-TH', { timeZone: 'Asia/Bangkok' }),
    time: d.toLocaleTimeString('th-TH', { timeZone: 'Asia/Bangkok', hour: '2-digit', minute: '2-digit' }),
  }
}

/** ต่อรายการเป็นบรรทัด ≤ perLine อักขระ · สูงสุด maxLines (R66 = 4) · เกิน = ตัดด้วย '…' */
export function packStickerLines(
  segs: string[],
  perLine = ORDER_LIST_PER_LINE,
  maxLines = ORDER_LIST_MAX_LINES,
): string[] {
  const lines: string[] = []
  let cur = ''
  let i = 0
  for (; i < segs.length; i++) {
    const cand = cur ? `${cur} · ${segs[i]}` : segs[i]
    if (!cur || cand.length <= perLine) { cur = cand; continue }
    lines.push(cur)
    if (lines.length >= maxLines) break
    cur = segs[i]
  }
  if (lines.length < maxLines) {
    if (cur) lines.push(cur)
    if (i < segs.length && lines.length) lines[lines.length - 1] += ' …'
  } else if (i < segs.length) {
    lines[lines.length - 1] += ' …'
  }
  if (!lines.length) lines.push('-')
  return lines
}

/**
 * หมวดบริการของออเดอร์ → ตำแหน่งที่ต้องติ๊ก ●
 *  1) หัว special_instructions ขึ้นต้นด้วยป้าย POS (POS แนบเอง เช่น "ทานที่ร้าน โต๊ะ 3")
 *  2) delivery_method = 'pickup' → รับที่ร้าน
 *  3) ช่องทางส่งอื่น (self_delivery/grab_rider/…) = อาหารออกจากหน้าร้าน → สั่งกลับบ้าน
 *  4) ไม่มีข้อมูล → null (ไม่ติ๊ก)
 */
export function detectStickerService(o: PrintOrderData): StickerServiceKey | null {
  const head = (o.special_instructions || '').trim()
  if (head) {
    for (const k of STICKER_SERVICE_KEYS) {
      if (head.startsWith(STICKER_SERVICE_LABELS[k])) return k
    }
  }
  const dm = (o.delivery_method || '').trim()
  if (!dm) return null
  if (dm === 'pickup') return 'pickup'
  return 'takeaway'
}

/** วิธีชำระจริงของออเดอร์ → ช่อง [PAID] (ทุกค่า DB มีช่อง = ใบเสร็จติ๊กครบเสมอ) */
export function detectStickerPaid(o: PrintOrderData): StickerPaidKey | null {
  const m = (o.payment_method || '').trim().toLowerCase()
  return PAID_METHOD_TO_OPTION[m] ?? null
}

/**
 * R73 (Owner 2026-11-05: "Notice ต้องพิมพ์จากลิงก์จริงของลูกค้ามาปริ้นด้วย — ตอนนี้ไม่ปริ้น notice"):
 * ช่อง NOTICE ต้องรวม "ข้อความลูกค้า" ทุกแหล่งจากข้อมูลจริงของออเดอร์ —
 *   ① orders.special_instructions (ช้อนส้อม/ป้าย POS/ยืนยันพิเศษ — ช่องเดิมของระบบ)
 *   ② ข้อความแชตที่ลูกค้าพิมพ์จากลิงก์จริง (order_messages.sender_role='customer' → customerMessages
 *      ที่เส้นทางพิมพ์เติมให้ก่อน render · ดู withCustomerChatNotes ใน printService)
 *   ③ หมายเหตุรายเมนูจากกล่องโต้ตอบใส่ตะกร้า (special_request / customizations.notice —
 *      เดิมโชว์เฉพาะในช่อง ORDER LIST "()" = NOTICE ว่างเสมอสำหรับออเดอร์ลูกค้า)
 * ข้อความซ้ำ = แสดงครั้งเดียว · ว่างทุกแหล่ง = '-'
 * จุดเดียวกับ HTML (printService) และ PNG (stickerPng) — สองทางพิมพ์ตรงกันเสมอ
 */
export function collectOrderNotices(o: PrintOrderData): string {
  const parts: string[] = []
  const push = (v: unknown) => {
    const t = typeof v === 'string' ? v.trim() : ''
    if (t && !parts.includes(t)) parts.push(t)
  }
  push(o.special_instructions)
  for (const seg of String(o.customerMessages || '').split(' · ')) push(seg)
  for (const it of o.items || []) {
    push(it.special_request)
    push((it.customizations ?? {})['notice'])
  }
  return parts.join(' · ') || '-'
}

/**
 * @param at เวลาพิมพ์ (default = เวลาปัจจุบัน) — Date/TIME บนใบ = เวลาตอนพิมพ์ตามกติกา Owner
 *          (POS ไม่มีเวลาเวลารอบส่ง → ไม่อ่าน created_at/scheduled_date)
 */
export function stickerFormFields(o: PrintOrderData, at: Date | number = Date.now()): StickerFormFields {
  const { date, time } = dateParts(at)
  const mode = (o.order_mode || '').trim().toUpperCase()
  const segs = o.items.slice(0, 8).map(
    (it) => `${it.product_name} x${Number(it.quantity)}${it.special_request ? ' (' + it.special_request + ')' : ''}`,
  )
  if (o.items.length > 8) segs.push('…')
  const name = (o.customer_name || '').trim()
  const phone = (o.customer_phone || '').trim()
  const total = Number(o.total_amount ?? 0)
  return {
    date,
    time,
    modePreOrder: mode === 'PRE_ORDER',
    modeSameDay: mode === 'SAME_DAY',
    service: detectStickerService(o),
    orderId: o.order_number || '-',
    orderListLines: packStickerLines(segs),
    // R73: ช่อง NOTICE = ข้อความลูกค้าทุกแหล่งจากลิงก์จริง (ไม่ใช่แค่ special_instructions —
    // เดิมออเดอร์ลูกค้า NOTICE ว่างเสมอเพราะโน้ตรายเมนู/แชตไม่เคยไหลเข้าช่องนี้)
    notice: collectOrderNotices(o),
    attn: name || phone ? `${name || '-'}${phone ? ` (${phone})` : ''}` : '-',
    add: (o.delivery_address || '').trim() || '-',
    totalNet: Number.isFinite(total)
      ? total.toLocaleString('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
      : '0.00',
    paid: detectStickerPaid(o),
  }
}