// Bite Me Baby — R30: วาดสติกเกอร์ 40×60 เป็น PNG (canvas · 300dpi = 472×709)
// R66 (Owner 2026-11-04): ช่องไฟระหว่างบรรทัดเท่ากัน (ROW คงที่) · ORDER LIST = block 4 แถวคงที่
//   (ป้าย + เว้นว่าง 3) · ไม่ใส่สโตรค 3 คำ: BITE ME BABY · [ DELIVERY / CUSTOMER ] · SCAN FOR MORE
//   · เว้นว่างด้านล่าง ~5% ของหน้า (QR จบเหนือขอบล่าง 5% — "เหลือที่ว่างด้านล่าง 15%→5%")
// ทาง Web Bluetooth รับ "รูป" (fetch → rasterize ในไลบรารี) → วาดเทมเพลตเป็นภาพแทน HTML
// layout = pure stickerDrawList (test ได้โดยไม่ต้องมี canvas) + executor (jsdom ไม่มี ctx → throw)
import type { PrintOrderData } from './printService'
import {
  stickerFormFields,
  STICKER_SERVICE_LABELS,
  STICKER_SERVICE_KEYS,
  STICKER_PAID_OPTIONS,
} from './stickerForm'

/** วงกลมติ๊ก/ไม่ติ๊ก — ● = อันที่ตรงกับออเดอร์นี้ (แบบ Owner วาดทุกช่องเป็น ○ ไว้ก่อน) */
const CIRCLE_ON = '●'
const CIRCLE_OFF = '○'

export const STICKER_PX_W = 472 // 40mm @300dpi
export const STICKER_PX_H = 709 // 60mm @300dpi
const M = 16 // margin ~1.35mm
/** R66: ช่องไฟระหว่างบรรทัดเท่ากัน — ระยะแนวตั้งคงที่ทุกแถวข้อความ (px @300dpi) */
const ROW = 30
/** R66: เว้นว่างด้านล่าง ~5% ของความสูงหน้า (709 → 35px ≈ 3 มม.) ตามคำสั่ง Owner "15%→5%" */
export const STICKER_BOTTOM_PCT = 0.05
/** R66: ORDER LIST = ป้าย 1 แถว + เว้นว่างต่อ 3 บรรทัด (block คงที่ 4 แถวเสมอ) */
const ORDER_LIST_ROWS = 4

/**
 * R33 (Owner: "พิมไม่ตรง/ข้ามดวง"): clamp ชดเชยฟีดแนวตั้ง (px @300dpi)
 * + = เนื้อหาเลื่อนลง (ภาพเริ่ม "ก่อน" ขอบดวงจริง — ตรงกับกรณีที่หัว BITE ME BABY หายเหนือขอบ)
 * − = เนื้อหาเลื่อนขึ้น — จำกัด −40 เพราะขอบบนมีแค่ M=16 + หัวเรื่อง baseline 46 (เกินนี้ตัวอักษรโดนตัด)
 * ค่าเริ่มต้น 0 = พิมพ์แบบเดิมเป๊ะ ไม่ตั้งเองไม่เปลี่ยนพฤติกรรม
 */
export function clampFeedOffset(v: number): number {
  const n = Math.round(Number(v) || 0)
  return Math.max(-40, Math.min(300, n))
}

/**
 * R34 (Owner: "ยังข้ามดวง") — clamp ความสูงหน้าดวงจริง (px @300dpi)
 * 709 = 40×60 มาตรฐาน (ค่าเริ่มต้น = พิมพ์แบบเดิมเป๊ะ) · 640–760 = ช่วงที่ layout ยังวาง QR ไม่ทับข้อมูล
 * วัดจากใบวัดฟีด: เส้นขอบล่าง (เส้นหนาสุดท้าย) ตรงขอบล่างดวงจริง = ค่านี้ถูก → เนื้อหาส่วนล่าง (QR) เลื่อนขึ้นตาม ไม่ล้นดวง
 */
/** R40: มม. → px @300dpi (wizard รับค่าเป็นมม. — 60 มม. = 709px · สูตรเดียวกับ registry sizeFromMm) */
export function mmToStickerPx(mm: number): number {
  const n = Number(mm)
  if (!Number.isFinite(n) || n <= 0) return STICKER_PX_H
  return Math.round((n * 300) / 25.4)
}

export function clampFaceHeight(v: number): number {
  const n = Math.round(Number(v))
  if (!Number.isFinite(n)) return STICKER_PX_H
  return Math.max(640, Math.min(760, n))
}

/**
 * ความสูงหน้า (SetPageSize) — "เติบโต" เฉพาะตอน offset บวก:
 * เครื่องเริ่มพิมพ์ก่อนขอบ N px → หน้า = 709+N (ส่วนที่เกิน = ขาว ไม่ให้ความร้อน → ลงร่อง/ใบก่อนหน้า harmlessly)
 * → เนื้อหา (เลื่อนลง N) ลงพอดีในดวง · จบ Exactly ที่ขอบล่าง
 * offset ติดลบ = หน้าเท่าเดิม 709 (ย้ายเนื้อหาขึ้นในหน้าเดิม — เติบโตช่วยอะไรไม่ได้)
 * ⚠️ png height ต้องเท่ากับค่านี้เสมอ (imageToPacked ยืดรูปไป fit size — ไม่งั้นภาพบี้)
 */
export function stickerPageHeight(offsetY: number, faceH = STICKER_PX_H): number {
  // R41: หน้า = ความสูงหน้าดวง (faceH) "เท่านั้น" — offset ไม่ยืดหน้าอีก
  // หลักฐาน Owner (2026-10-31): offset 62 พิมตรงแล้ว แต่หน้า 709+62=771/ใบ ≠ ระยะฟีดจริง → ข้ามดวงสะสมทุกใบ
  // png ↔ SetPageSize ผูกกันเหมือนเดิม (ห้ามเพี้ยน) · offset อยู่ในหน้า (layout เลื่อน + QR ผูกขอบล่าง)
  void offsetY
  return clampFaceHeight(faceH)
}
export type StickerOp =
  | { kind: 'text'; x: number; y: number; text: string; size: number; weight?: number | string; align?: 'left' | 'center' | 'right'; family?: string; italic?: boolean; /** R66: true = ไม่ใส่สโตรค (Owner ระบุ 3 คำ) */ noStroke?: boolean }
  | { kind: 'line'; x1: number; y1: number; x2: number; y2: number; w?: number }
  | { kind: 'rect'; x: number; y: number; w: number; h: number; fill?: string }
  | { kind: 'qr'; x: number; y: number; size: number }

/** layout ล้วน = สะท้อน buildBmbStickerHtml (ป้ายซ้ายฝังตาย · ค่าจากแบบฟอร์ม) · คุมขอบ 472×pageH
 *  R33: offsetY ≠ 0 = เลื่อนทุก op แนวตั้ง (บวก=ลง) · พื้นหลังขาว = เต็มหน้าเสมอ
 *  R66: ช่องไฟ ROW คงที่ทุกแถว · ORDER LIST block 4 แถวคงที่ · QR จบเหนือขอบล่าง 5% */
export function stickerDrawList(o: PrintOrderData, offsetY = 0, faceH = STICKER_PX_H, at: Date | number = Date.now()): StickerOp[] {
  const off = clampFeedOffset(offsetY)
  const face = clampFaceHeight(faceH)
  // R41: หน้า = หน้าดวงเท่านั้น (faceH = ความสูงหน้า/ระยะฟีดต่อใบ) — offset ไม่ต่อบนหน้า/ไม่ยืดหน้าอีก
  const pageH = face
  const ops: StickerOp[] = []
  const cx = STICKER_PX_W / 2
  const W = STICKER_PX_W
  // R56: ทุกช่องมาจาก stickerFormFields (จุดเดียวกับ HTML) — ป้ายซ้ายคงตาย ค่าจริงหลัง ":"
  const f = stickerFormFields(o, at)
  const mark = (on: boolean) => (on ? CIRCLE_ON : CIRCLE_OFF)
  // คอลัมน์ค่า = 15.5mm (ตรงกับ .f.col ฝั่ง HTML) — ป้ายชิดซ้าย · ':' ชิดขวาของคอลัมน์
  const colX = M + 170
  const colonX = colX - 9

  // R66 (Owner): ไม่ใส่สโตรค 3 คำ — BITE ME BABY · [ DELIVERY / CUSTOMER ] · SCAN FOR MORE = fill อย่างเดียว
  ops.push({ kind: 'text', x: cx, y: M + 30, text: 'BITE ME BABY', size: 34, weight: 800, align: 'center', noStroke: true })
  ops.push({ kind: 'text', x: cx, y: M + 58, text: '" More Than Dellicious "', size: 16, align: 'center', family: 'Georgia', italic: true })
  ops.push({ kind: 'line', x1: M, y1: M + 72, x2: W - M, y2: M + 72, w: 2 })

  // R66: ทุกแถวข้อความห่างกันคงที่ ROW = ช่องไฟระหว่างบรรทัดเท่ากันทั้งใบ
  let y = M + 102 // 118 = ใต้เส้นคั่น (88) + ROW
  // Date : …            TIME : …
  ops.push({ kind: 'text', x: M, y, text: 'Date :', size: 20, weight: 700 })
  ops.push({ kind: 'text', x: M + 84, y, text: f.date, size: 20 })
  ops.push({ kind: 'text', x: M + 244, y, text: 'TIME :', size: 20, weight: 700 })
  ops.push({ kind: 'text', x: M + 322, y, text: f.time, size: 20 })
  y += ROW
  // ○ Pre-Order  ○ Same Day — R59: ใหญ่สุดเท่าที่จะใหญ่ได้ (26 = max ที่ svc row ยังพอดี 440px)
  ops.push({ kind: 'text', x: cx, y, text: `${mark(f.modePreOrder)} Pre-Order   ${mark(f.modeSameDay)} Same Day`, size: 26, align: 'center' })
  y += ROW
  // ○ ทานที่ร้าน  ○ สั่งกลับบ้าน  ○ รับที่ร้าน — R59 = 26 เท่าหัวข้อ
  const svcTxt = STICKER_SERVICE_KEYS.map((k) => `${mark(f.service === k)} ${STICKER_SERVICE_LABELS[k]}`).join('   ')
  ops.push({ kind: 'text', x: cx, y, text: svcTxt, size: 26, align: 'center' })
  y += ROW
  // ORDER ID : …
  ops.push({ kind: 'text', x: M, y, text: 'ORDER ID', size: 20, weight: 700 })
  ops.push({ kind: 'text', x: colonX, y, text: ':', size: 20, weight: 700 })
  ops.push({ kind: 'text', x: colX, y, text: f.orderId, size: 20 })
  y += ROW
  // R66 (Owner): ORDER LIST = block คงที่ 4 แถว (ป้าย + เว้นว่าง 3) — เนื้อหาไหลต่อเนื่องจาก
  //   packStickerLines (ไม่ใช่ 1 รายการ 1 บรรทัด) · แถวว่าง = ไม่ push อะไร (จองที่ด้วย y += ROW เสมอ)
  for (let i = 0; i < ORDER_LIST_ROWS; i++) {
    const ln = f.orderListLines[i] ?? ''
    if (i === 0) {
      ops.push({ kind: 'text', x: M, y, text: 'ORDER LIST', size: 20, weight: 700 })
      ops.push({ kind: 'text', x: colonX, y, text: ':', size: 20, weight: 700 })
    } else if (ln) {
      ops.push({ kind: 'text', x: M, y, text: ':', size: 20, weight: 700 })
    }
    if (ln) ops.push({ kind: 'text', x: colX, y, text: ln, size: 19 })
    y += ROW
  }
  // NOTICE : …
  ops.push({ kind: 'text', x: M, y, text: 'NOTICE', size: 20, weight: 700 })
  ops.push({ kind: 'text', x: colonX, y, text: ':', size: 20, weight: 700 })
  ops.push({ kind: 'text', x: colX, y, text: f.notice, size: 19 })
  y += ROW
  // เส้นคั่นกลางช่องว่างระหว่างแถว (ไม่เบียดช่องไฟ)
  ops.push({ kind: 'line', x1: M, y1: y - 15, x2: W - M, y2: y - 15, w: 2 })
  // [ DELIVERY / CUSTOMER ] — R66: ไม่ใส่สโตรค (Owner ระบุ)
  ops.push({ kind: 'text', x: M, y, text: '[ DELIVERY / CUSTOMER ]', size: 21, weight: 700, noStroke: true })
  y += ROW
  // Attn : ชื่อ (โทรศัพท์)
  ops.push({ kind: 'text', x: M, y, text: 'Attn :', size: 20, weight: 700 })
  ops.push({ kind: 'text', x: M + 86, y, text: f.attn, size: 20 })
  y += ROW
  // Add : ที่อยู่
  ops.push({ kind: 'text', x: M, y, text: 'Add :', size: 20, weight: 700 })
  ops.push({ kind: 'text', x: M + 74, y, text: f.add, size: 20 })
  y += ROW
  ops.push({ kind: 'line', x1: M, y1: y - 15, x2: W - M, y2: y - 15, w: 2 })
  // [ TOTAL NET ] : … THB
  ops.push({ kind: 'text', x: M, y, text: '[ TOTAL NET ] :', size: 20, weight: 700 })
  ops.push({ kind: 'text', x: M + 200, y, text: `${f.totalNet} THB`, size: 20 })
  y += ROW
  // [PAID] : ○ B/T  ○ QR PROMPTPAY  ○ COD — R59: ใหญ่สุดที่พอดี = 20 (วัด: 421.5/440 ✓)
  const paidTxt = `[PAID] : ${STICKER_PAID_OPTIONS.map((p) => `${mark(f.paid === p.key)} ${p.label}`).join('   ')}`
  ops.push({ kind: 'text', x: M, y, text: paidTxt, size: 20, weight: 700 })

  // R41: เลื่อนเฉพาะ "เนื้อหาส่วนบน" ลงตาม offset — หน้าคงที่ (pageH = face)
  if (off !== 0) {
    for (const op of ops) {
      if (op.kind === 'line') { op.y1 += off; op.y2 += off }
      else { op.y += off }
    }
  }

  // บล็อก QR + ข้อความ (bottom) — R66: จบที่ขอบล่าง ~5% ของหน้า (bottomReserve)
  // N-6c (Owner 2026-11-05 "ปริ้นทับซ้อนกัน ตรง PAID / QR CODE SCAN FOR MORE"):
  // เดิม min 70 บังคับขนาด QR จน top ไต่ขึ้น "ทับ" แถว [PAID]/เนื้อหาเมื่อ offset ดันเนื้อหาลง
  // → ตรรกะใหม่ (เรียงตามลำดับความสำคัญ): ① ห้ามทับเนื้อหาเด็ดขาด ② ผูกขอบล่างตาม R66
  //    เมื่อพื้นที่พอ ③ พื้นที่ไม่พอ = ย่อ QR ก่อน (ต่ำสุด 55 = ยังสแกนได้) ④ ยังไม่พออีก =
  //    ลงใต้เนื้อหา (ยอมติด/เลยขอบล่าง แทนทับตัวอักษร)
  const contentBottom = y + 16 + off // y = แถว [PAID] (baseline) + ใต้ baseline เล็กน้อย (+ offset ที่เลื่อนไปแล้ว)
  const bottomReserve = Math.round(face * STICKER_BOTTOM_PCT)
  const QR_MIN_SCANNABLE = 55
  let qrSize = Math.min(150, Math.max(70, Math.round(face - bottomReserve - contentBottom - 8)))
  let qrY = face - bottomReserve - qrSize
  if (qrY < contentBottom + 6) {
    const fit = Math.round(face - bottomReserve - (contentBottom + 6))
    if (fit >= QR_MIN_SCANNABLE) {
      qrSize = fit
      qrY = face - bottomReserve - qrSize
    } else {
      qrY = contentBottom + 6
    }
  }
  ops.push({ kind: 'qr', x: M, y: qrY, size: qrSize })
  const tx = M + qrSize + 12
  const mid = tx + (W - tx - M) / 2
  // R66: SCAN FOR MORE = ไม่ใส่สโตรค (Owner ระบุ)
  ops.push({ kind: 'text', x: mid, y: qrY + Math.round(qrSize * 0.42), text: 'SCAN FOR MORE', size: 24, weight: 800, align: 'center', noStroke: true })
  ops.push({ kind: 'text', x: mid, y: qrY + Math.round(qrSize * 0.8), text: 'Thank You for love !', size: 20, align: 'center', family: 'Georgia', italic: true })

  // พื้นหลัง = ปิดท้าย (วาดใต้ทุกอย่างตามลำดับ array → ต้องอยู่หน้าสุด) เต็มหน้า (R41: pageH = face คงที่)
  return [{ kind: 'rect', x: 0, y: 0, w: STICKER_PX_W, h: pageH, fill: '#ffffff' }, ...ops]
}
/**
 * R33 — ใบวัดฟีด (calibration ruler): เส้นขีดทุก 20px + ป้าย px/mm ทุก 100px
 * พิมพ์ด้วย offset = เสมอ 0 (วัดค่า raw ของเครื่อง) → "เส้นไหนตรงขอบบนดวงจริง = ค่าชดเชยฟีดที่ต้องใส่"
 * ระยะห่างเส้น 0→708 บนกระดาษ ≠ สูงดวงจริง = h_px เพี้ยน (คนละปัญหากับ offset)
 * pure = test ได้โดยไม่ต้องมี canvas
 */
export function calibrationDrawList(faceH = STICKER_PX_H): StickerOp[] {
  const ops: StickerOp[] = []
  const W = STICKER_PX_W
  const H = clampFaceHeight(faceH) // R34: ใบวัดวาดที่ความสูงหน้าปัจจุบัน → เส้นขอบล่าง = ขอบดวงที่ตั้งไว้ เทียบของจริงได้เลย
  for (let y = 0; y <= H - 1; y += 20) {
    const major = y % 100 === 0
    const edge = y === 0 || y >= H - 20
    ops.push({ kind: 'line', x1: 16, y1: y, x2: W - 16, y2: y, w: edge ? 5 : major ? 3 : 1 })
    if (major && y <= H - 80) {
      ops.push({ kind: 'text', x: 20, y: y + 18, text: `${y}px ≈ ${(y * 25.4 / 300).toFixed(1)}mm`, size: 16, weight: 700 })
    }
  }
  ops.push({ kind: 'line', x1: 0, y1: H - 1, x2: W, y2: H - 1, w: 6 })
  ops.push({ kind: 'text', x: W / 2, y: 354, text: '— ใบวัดฟีด (offset 0) —', size: 18, weight: 700, align: 'center' })
  ops.push({ kind: 'text', x: W / 2, y: H - 54, text: 'เส้นไหนตรงขอบบนดวง = ใส่เลขนั้นเป็นชดเชยฟีด', size: 16, align: 'center' })
  ops.push({ kind: 'text', x: W / 2, y: H - 30, text: '(บวก = เนื้อหาเลื่อนลง)', size: 15, align: 'center' })
  return ops
}


/** rasterize ops ลง canvas สูง pageH — เบราว์เซอร์จริงเท่านั้น (jsdom ไม่มี 2d ctx → throw ชัดเจน) */
async function rasterizeOps(ops: StickerOp[], pageH: number): Promise<string> {
  const canvas = document.createElement('canvas')
  canvas.width = STICKER_PX_W
  canvas.height = pageH
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('canvas 2d ไม่พร้อมใช้งานใน environment นี้')

  let qrImg: HTMLImageElement | null = null
  if (ops.some((op) => op.kind === 'qr')) {
    let qrPng = ''
    try {
      const QR = await import('qrcode')
      qrPng = await QR.toDataURL('https://biteme-baby.com', { margin: 0, width: 197, errorCorrectionLevel: 'M' })
    } catch { qrPng = '' }
    if (qrPng) {
      qrImg = new Image()
      await new Promise<void>((resolve) => {
        if (!qrImg) return resolve()
        qrImg.onload = () => resolve()
        qrImg.onerror = () => resolve()
        qrImg.src = qrPng
      })
    }
  }

  for (const op of ops) {
    if (op.kind === 'rect') {
      ctx.fillStyle = op.fill || '#fff'
      ctx.fillRect(op.x, op.y, op.w, op.h)
    } else if (op.kind === 'line') {
      ctx.strokeStyle = '#000'
      ctx.lineWidth = op.w || 2
      ctx.beginPath()
      ctx.moveTo(op.x1, op.y1)
      ctx.lineTo(op.x2, op.y2)
      ctx.stroke()
    } else if (op.kind === 'text') {
      ctx.fillStyle = '#000'
      ctx.textAlign = op.align || 'left'
      ctx.textBaseline = 'alphabetic'
      const style = op.italic ? 'italic ' : ''
      const weight = op.weight != null ? String(op.weight) : 'normal'
      ctx.font = `${style}${weight} ${op.size}px ${op.family || 'Tahoma'}, sans-serif`
      // R51 (Owner: "ข้อความตัวเล็ก ... ทุกตัวอักษรเป็นตัวหนาหมด"): stroke ทุก op ก่อนทับ fill — หนาขึ้น ~size/14
      // R66 (Owner 2026-11-04): ยกเว้น 3 คำที่สั่ง "ไม่ต้องใส่สโตรค" = noStroke (BITE ME BABY · [ DELIVERY / CUSTOMER ] · SCAN FOR MORE)
      ctx.lineJoin = 'round'
      ctx.lineCap = 'round'
      ctx.strokeStyle = '#000'
      ctx.lineWidth = Math.max(1, Math.round(op.size / 14))
      if (op.noStroke !== true) ctx.strokeText(op.text, op.x, op.y)
      ctx.fillText(op.text, op.x, op.y)
    } else if (op.kind === 'qr') {
      if (qrImg && qrImg.naturalWidth > 0) {
        ctx.drawImage(qrImg, op.x, op.y, op.size, op.size)
      } else {
        ctx.strokeStyle = '#000'
        ctx.lineWidth = 2
        ctx.strokeRect(op.x, op.y, op.size, op.size)
        ctx.fillStyle = '#000'
        ctx.textAlign = 'center'
        ctx.font = '14px Tahoma, sans-serif'
        ctx.fillText('biteme-baby.com', op.x + op.size / 2, op.y + op.size / 2)
      }
    }
  }
  return canvas.toDataURL('image/png')
}

/** render สติกเกอร์เป็น dataURL PNG — R33: offsetY สะท้อน preview = รูปจริงที่จะยิงเข้าเครื่อง (รวมความสูงหน้า) */
export async function renderStickerPng(o: PrintOrderData, offsetY = 0, faceH = STICKER_PX_H): Promise<string> {
  const off = clampFeedOffset(offsetY)
  return await rasterizeOps(stickerDrawList(o, off, faceH), stickerPageHeight(off, faceH))
}

/** R33: render ใบวัดฟีด (offset คงที่ 0 = raw) — dataURL PNG 472×709 */
export async function renderCalibrationPng(faceH = STICKER_PX_H): Promise<string> {
  const face = clampFaceHeight(faceH)
  return await rasterizeOps(calibrationDrawList(face), face)
}
