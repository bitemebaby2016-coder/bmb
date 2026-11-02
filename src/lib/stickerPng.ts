// Bite Me Baby — R30: วาดสติกเกอร์ 40×60 เป็น PNG (canvas · 300dpi = 472×709)
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
  | { kind: 'text'; x: number; y: number; text: string; size: number; weight?: number | string; align?: 'left' | 'center' | 'right'; family?: string; italic?: boolean }
  | { kind: 'line'; x1: number; y1: number; x2: number; y2: number; w?: number }
  | { kind: 'rect'; x: number; y: number; w: number; h: number; fill?: string }
  | { kind: 'qr'; x: number; y: number; size: number }

/** layout ล้วน = สะท้อน buildBmbStickerHtml (ป้ายซ้ายฝังตาย · ค่าจากแบบฟอร์ม) · คุมขอบ 472×pageH
 *  R33: offsetY ≠ 0 = เลื่อนทุก op แนวตั้ง (บวก=ลง) · พื้นหลังขาว = เต็มหน้าเสมอ (รวมแถบขาวส่วนที่ offset เติบโต/ว่าง) */
export function stickerDrawList(o: PrintOrderData, offsetY = 0, faceH = STICKER_PX_H, at: Date | number = Date.now()): StickerOp[] {
  const off = clampFeedOffset(offsetY)
  const face = clampFaceHeight(faceH)
  // R41: หน้า = หน้าดวงเท่านั้น (faceH = ความสูงหน้า/ระยะฟีดต่อใบ) — offset ไม่ต่อบนหน้า/ไม่ยืดหน้าอีก
  const pageH = face
  const ops: StickerOp[] = []
  const cx = STICKER_PX_W / 2
  const W = STICKER_PX_W
  // R56: ทุกช่องมาจาก stickerFormFields (จุดเดียวกับ HTML) — ป้ายซ้ายคงตาย ค่าจริงหลัง ":"
  // at = เวลาพิมพ์ (default now — Date/TIME = เวลาตอนพิมพ์ กติกา Owner "POS ไม่มีเวลาเวลารอบส่ง")
  const f = stickerFormFields(o, at)
  const mark = (on: boolean) => (on ? CIRCLE_ON : CIRCLE_OFF)
  // คอลัมน์ค่า = 15.5mm (ตรงกับ .f.col ฝั่ง HTML) — ป้ายชิดซ้าย · ':' ชิดขวาของคอลัมน์
  const colX = M + 170
  const colonX = colX - 9

  ops.push({ kind: 'text', x: cx, y: M + 30, text: 'BITE ME BABY', size: 34, weight: 800, align: 'center' })
  ops.push({ kind: 'text', x: cx, y: M + 58, text: '" More Than Dellicious "', size: 16, align: 'center', family: 'Georgia', italic: true })
  ops.push({ kind: 'line', x1: M, y1: M + 72, x2: W - M, y2: M + 72, w: 2 })

  let y = M + 104
  // Date : …            TIME : …
  ops.push({ kind: 'text', x: M, y, text: 'Date :', size: 20, weight: 700 })
  ops.push({ kind: 'text', x: M + 84, y, text: f.date, size: 20 })
  ops.push({ kind: 'text', x: M + 244, y, text: 'TIME :', size: 20, weight: 700 })
  ops.push({ kind: 'text', x: M + 322, y, text: f.time, size: 20 })
  y += 28
  // ○ Pre-Order  ○ Same Day
  ops.push({ kind: 'text', x: cx, y, text: `${mark(f.modePreOrder)} Pre-Order   ${mark(f.modeSameDay)} Same Day`, size: 20, align: 'center' })
  y += 27
  // ○ ทานที่ร้าน  ○ สั่งกลับบ้าน  ○ รับที่ร้าน (แถวแน่น — ฟอนต์เล็กกว่าแถวอื่น เหมือนแบบ Owner)
  const svcTxt = STICKER_SERVICE_KEYS.map((k) => `${mark(f.service === k)} ${STICKER_SERVICE_LABELS[k]}`).join('   ')
  ops.push({ kind: 'text', x: cx, y, text: svcTxt, size: 16, align: 'center' })
  y += 30
  // ORDER ID : …
  ops.push({ kind: 'text', x: M, y, text: 'ORDER ID', size: 20, weight: 700 })
  ops.push({ kind: 'text', x: colonX, y, text: ':', size: 20, weight: 700 })
  ops.push({ kind: 'text', x: colX, y, text: f.orderId, size: 20 })
  y += 28
  // ORDER LIST : … (ต่อ ": …" ได้ 2 บรรทัด — บรรทัดต่อ ':' ชิดซ้ายตามแบบ)
  f.orderListLines.forEach((ln, i) => {
    if (i === 0) {
      ops.push({ kind: 'text', x: M, y, text: 'ORDER LIST', size: 20, weight: 700 })
      ops.push({ kind: 'text', x: colonX, y, text: ':', size: 20, weight: 700 })
    } else {
      ops.push({ kind: 'text', x: M, y, text: ':', size: 20, weight: 700 })
    }
    ops.push({ kind: 'text', x: colX, y, text: ln, size: 19 })
    y += 26
  })
  // NOTICE : …
  ops.push({ kind: 'text', x: M, y, text: 'NOTICE', size: 20, weight: 700 })
  ops.push({ kind: 'text', x: colonX, y, text: ':', size: 20, weight: 700 })
  ops.push({ kind: 'text', x: colX, y, text: f.notice, size: 19 })
  y += 16
  ops.push({ kind: 'line', x1: M, y1: y, x2: W - M, y2: y, w: 2 })
  y += 30
  // [ DELIVERY / CUSTOMER ]
  ops.push({ kind: 'text', x: M, y, text: '[ DELIVERY / CUSTOMER ]', size: 21, weight: 700 })
  y += 28
  // Attn : ชื่อ (โทรศัพท์)
  ops.push({ kind: 'text', x: M, y, text: 'Attn :', size: 20, weight: 700 })
  ops.push({ kind: 'text', x: M + 86, y, text: f.attn, size: 20 })
  y += 28
  // Add : ที่อยู่
  ops.push({ kind: 'text', x: M, y, text: 'Add :', size: 20, weight: 700 })
  ops.push({ kind: 'text', x: M + 74, y, text: f.add, size: 20 })
  y += 16
  ops.push({ kind: 'line', x1: M, y1: y, x2: W - M, y2: y, w: 2 })
  y += 30
  // [ TOTAL NET ] : … THB
  ops.push({ kind: 'text', x: M, y, text: '[ TOTAL NET ] :', size: 20, weight: 700 })
  ops.push({ kind: 'text', x: M + 200, y, text: `${f.totalNet} THB`, size: 20 })
  y += 28
  // [PAID] : ○ B/T  ○ QR PROMPTPAY  ○ COD
  const paidTxt = `[PAID] : ${STICKER_PAID_OPTIONS.map((p) => `${mark(f.paid === p.key)} ${p.label}`).join('   ')}`
  ops.push({ kind: 'text', x: M, y, text: paidTxt, size: 17, weight: 700 })
  y += 22

  // R41: เลื่อนเฉพาะ "เนื้อหาส่วนบน" ลงตาม offset — หน้าคงที่ (pageH = face)
  // บล็อก QR (ด้านล่างนี้) ผูกขอบล่างหน้าเอง = ไม่ถูกเลื่อน → ไม่ล้น/ไม่ข้ามดวงจาก offset
  if (off !== 0) {
    for (const op of ops) {
      if (op.kind === 'line') { op.y1 += off; op.y2 += off }
      else { op.y += off }
    }
  }

  // บล็อก QR + ข้อความ (bottom) — ผูกขอบล่างหน้าจริง + ย่อขนาดเองให้พอดีใต้เนื้อหา
  // (หน้าสั้น/offset ใหญ่ = QR เล็กลงแทนที่จะทับข้อความ · ไม่มีบรรทัดไทยใต้ QR ตามแบบใหม่)
  const contentBottom = y + off
  const avail = face - 2 * M - contentBottom - 12
  const qrSize = Math.max(110, Math.min(150, Math.round(avail)))
  const qrY = face - M - qrSize
  ops.push({ kind: 'qr', x: M, y: qrY, size: qrSize })
  const tx = M + qrSize + 12
  const mid = tx + (W - tx - M) / 2
  ops.push({ kind: 'text', x: mid, y: qrY + Math.round(qrSize * 0.42), text: 'SCAN FOR MORE', size: 24, weight: 800, align: 'center' })
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
      // R51 (Owner: "ข้อความตัวเล็กที่ไม่ได้ stroke … ทุกตัวอักษรเป็นตัวหนาหมด"):
      // stroke ทุก op (รวมตัวเล็ก + บรรทัด CUSTOMER/รายละเอียดลูกค้า) ก่อนทับด้วย fill —
      // เส้นหนาขึ้น ~size/14 px คมชัดบนหัวฉีดความร้อน ไม่จาง/เป็นฝ้า
      ctx.lineJoin = 'round'
      ctx.lineCap = 'round'
      ctx.strokeStyle = '#000'
      ctx.lineWidth = Math.max(1, Math.round(op.size / 14))
      ctx.strokeText(op.text, op.x, op.y)
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
