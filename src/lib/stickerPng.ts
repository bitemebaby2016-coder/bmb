// Bite Me Baby — R30: วาดสติกเกอร์ 40×60 เป็น PNG (canvas · 300dpi = 472×709)
// ทาง Web Bluetooth รับ "รูป" (fetch → rasterize ในไลบรารี) → วาดเทมเพลตเป็นภาพแทน HTML
// layout = pure stickerDrawList (test ได้โดยไม่ต้องมี canvas) + executor (jsdom ไม่มี ctx → throw)
import type { PrintOrderData } from './printService'

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
  // R34: หน้า = ความสูงหน้าดวงจริง (faceH) — png ↔ SetPageSize ผูกกันเหมือน offset (ห้ามเพี้ยน)
  return clampFaceHeight(faceH) + Math.max(0, clampFeedOffset(offsetY))
}

export type StickerOp =
  | { kind: 'text'; x: number; y: number; text: string; size: number; weight?: number | string; align?: 'left' | 'center' | 'right'; family?: string; italic?: boolean }
  | { kind: 'line'; x1: number; y1: number; x2: number; y2: number; w?: number }
  | { kind: 'rect'; x: number; y: number; w: number; h: number; fill?: string }
  | { kind: 'qr'; x: number; y: number; size: number }

/** layout ล้วน = สะท้อน buildBmbStickerHtml (ป้ายซ้ายฝังตาย · ค่าจากแบบฟอร์ม) · คุมขอบ 472×pageH
 *  R33: offsetY ≠ 0 = เลื่อนทุก op แนวตั้ง (บวก=ลง) · พื้นหลังขาว = เต็มหน้าเสมอ (รวมแถบขาวส่วนที่ offset เติบโต/ว่าง) */
export function stickerDrawList(o: PrintOrderData, offsetY = 0, faceH = STICKER_PX_H): StickerOp[] {
  const off = clampFeedOffset(offsetY)
  const face = clampFaceHeight(faceH)
  const pageH = face + Math.max(0, off)
  const ops: StickerOp[] = []
  const cx = STICKER_PX_W / 2
  const W = STICKER_PX_W

  ops.push({ kind: 'text', x: cx, y: M + 30, text: 'BITE ME BABY', size: 34, weight: 800, align: 'center' })
  ops.push({ kind: 'text', x: cx, y: M + 58, text: '" MORE THAN DELLICIOUS "', size: 16, align: 'center', family: 'Georgia', italic: true })
  ops.push({ kind: 'line', x1: M, y1: M + 72, x2: W - M, y2: M + 72, w: 2 })

  let y = M + 104
  const rows: Array<[string, string]> = [
    ['Order id :', o.order_number],
    ['Date :', o.created_at ? new Date(o.created_at).toLocaleString('th-TH', { timeZone: 'Asia/Bangkok', dateStyle: 'short', timeStyle: 'short' }) : '-'],
  ]
  for (const [label, value] of rows) {
    ops.push({ kind: 'text', x: M, y, text: label, size: 22, weight: 700 })
    ops.push({ kind: 'text', x: M + 148, y, text: value, size: 22 })
    y += 30
  }
  ops.push({ kind: 'text', x: M, y, text: 'Menu :', size: 22, weight: 700 })
  y += 28
  const menu = o.items.slice(0, 3).map((it) => `${it.product_name} x${it.quantity}${it.special_request ? ' (' + it.special_request + ')' : ''}`)
  if (o.items.length > 3) menu.push('…')
  for (const line of menu.length ? menu : ['-']) {
    ops.push({ kind: 'text', x: M, y, text: line, size: 20 })
    y += 26
  }
  y += 4
  ops.push({ kind: 'text', x: M, y, text: 'Notice :', size: 22, weight: 700 })
  ops.push({ kind: 'text', x: M + 148, y, text: (o.special_instructions || '').trim() || '-', size: 20 })
  y += 22

  ops.push({ kind: 'line', x1: M, y1: y, x2: W - M, y2: y, w: 2 })
  y += 30
  ops.push({ kind: 'text', x: M, y, text: `CUSTOMER : ${o.customer_name || '-'}`, size: 23, weight: 700 })
  y += 30
  ops.push({ kind: 'text', x: M + 60, y, text: `Tel. : ${o.customer_phone || '-'}`, size: 23, weight: 700 })
  y += 14
  ops.push({ kind: 'line', x1: M, y1: y, x2: W - M, y2: y, w: 2 })

  // บล็อก QR + ข้อความ (bottom)
  const qrSize = 197
  const qrY = face - M - qrSize // R34: ผูกขอบล่างของหน้าจริง — face < 709 → QR เลื่อนขึ้นตาม ไม่ล้นดวง
  ops.push({ kind: 'qr', x: M, y: qrY, size: qrSize })
  const tx = M + qrSize + 12
  const mid = tx + (W - tx - M) / 2
  ops.push({ kind: 'text', x: mid, y: qrY + 34, text: 'SCAN FOR MORE', size: 24, weight: 800, align: 'center' })
  let ty = qrY + 66
  for (const t of ['รายละเอียดการซื้อ', 'สแกนสมาชิกเพื่อสะสมแต้ม', 'รับรางวัลจำนวนมาก']) {
    ops.push({ kind: 'text', x: mid, y: ty, text: t, size: 17, align: 'center' })
    ty += 26
  }
  ops.push({ kind: 'text', x: mid, y: ty + 26, text: 'Thank You for love !', size: 22, align: 'center', family: 'Georgia', italic: true })

  if (off !== 0) {
    for (const op of ops) {
      if (op.kind === 'line') { op.y1 += off; op.y2 += off }
      else { op.y += off }
    }
  }
  // พื้นหลัง = ปิดท้าย (วาดใต้ทุกอย่างตามลำดับ array → ต้องอยู่หน้าสุด) เต็มหน้ารวมแถบ offset
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
