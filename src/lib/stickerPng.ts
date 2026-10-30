// Bite Me Baby — R30: วาดสติกเกอร์ 40×60 เป็น PNG (canvas · 300dpi = 472×709)
// ทาง Web Bluetooth รับ "รูป" (fetch → rasterize ในไลบรารี) → วาดเทมเพลตเป็นภาพแทน HTML
// layout = pure stickerDrawList (test ได้โดยไม่ต้องมี canvas) + executor (jsdom ไม่มี ctx → throw)
import type { PrintOrderData } from './printService'

export const STICKER_PX_W = 472 // 40mm @300dpi
export const STICKER_PX_H = 709 // 60mm @300dpi
const M = 16 // margin ~1.35mm

export type StickerOp =
  | { kind: 'text'; x: number; y: number; text: string; size: number; weight?: number | string; align?: 'left' | 'center' | 'right'; family?: string; italic?: boolean }
  | { kind: 'line'; x1: number; y1: number; x2: number; y2: number; w?: number }
  | { kind: 'rect'; x: number; y: number; w: number; h: number; fill?: string }
  | { kind: 'qr'; x: number; y: number; size: number }

/** layout ล้วน = สะท้อน buildBmbStickerHtml (ป้ายซ้ายฝังตาย · ค่าจากแบบฟอร์ม) · คุมขอบ 472×709 */
export function stickerDrawList(o: PrintOrderData): StickerOp[] {
  const ops: StickerOp[] = []
  const cx = STICKER_PX_W / 2
  const W = STICKER_PX_W

  ops.push({ kind: 'rect', x: 0, y: 0, w: STICKER_PX_W, h: STICKER_PX_H, fill: '#ffffff' })
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
  const qrY = STICKER_PX_H - M - qrSize
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
  return ops
}


/** render เป็น dataURL PNG — เบราว์เซอร์จริงเท่านั้น (jsdom ไม่มี 2d ctx → throw ชัดเจน) */
export async function renderStickerPng(o: PrintOrderData): Promise<string> {
  const canvas = document.createElement('canvas')
  canvas.width = STICKER_PX_W
  canvas.height = STICKER_PX_H
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('canvas 2d ไม่พร้อมใช้งานใน environment นี้')

  let qrPng = ''
  try {
    const QR = await import('qrcode')
    qrPng = await QR.toDataURL('https://biteme-baby.com', { margin: 0, width: 197, errorCorrectionLevel: 'M' })
  } catch { qrPng = '' }

  let qrImg: HTMLImageElement | null = null
  if (qrPng) {
    qrImg = new Image()
    await new Promise<void>((resolve) => {
      if (!qrImg) return resolve()
      qrImg.onload = () => resolve()
      qrImg.onerror = () => resolve()
      qrImg.src = qrPng
    })
  }

  for (const op of stickerDrawList(o)) {
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
