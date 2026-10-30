// ============================================
// Bite Me Baby — R30: พิมพ์สติกเกอร์ NIIMBOT B1 Pro ตรงผ่าน Web Bluetooth
// ============================================
// ทำไม: Nimbot ไม่มีไดรเวอร์ Win10 · QZ+คิว Windows = พัง (USB001 ว่าง/spooler error) ·
// คุณ Owner ยืนยันภาษาสั่งงาน = ภาษาจีน (โปรโตคอล NIIMBOT เอง) → ทางเดียวที่ "จบ" คือ
// driver ภาษาจีนที่ reverse แล้ว: `niimbot-web-bluetooth` (MIT zero-dep · validated บน B1 Pro
// โดยตรง · task=v4 · 300dpi) — เบราว์เซอร์คุยกับเครื่องผ่าน BLE โดยตรง ไม่ผ่าน
// spooler/คิว/ไดรเวอร์/COM/QZ เลย · ข้อกำหนด: Chrome/Edge + HTTPS (biteme-baby.com ✓)
// เรียกจาก user gesture เท่านั้น (Bluetooth chooser ของ Windows จะเด้งตอนกดปุ่ม)
// R33: +ชดเชยฟีด/ใบวัดฟีด — registry T40x60 ของ lib เองยังไม่เคยวัด offset บนกระดาษจริง
// ("nobody has yet measured … with a rule") → เราวัดเองจากใบวัดแล้วใส่ stickerOffsetYPx
// ============================================
import { stickerPageHeight } from './stickerPng'

export interface NiimbotModel {
  name_prefixes?: string[]
  task?: string
  density?: number
  label_type?: number
  speed?: number
}

export interface NiimbotSize {
  w_px: number
  h_px: number
  offset_y_px?: number
}

export interface NiimbotPrinterInfo {
  modelId?: number
  protocolVersion?: number | string
  label?: string
  task?: string
  dpi?: number
}

interface NiimbotLib {
  isSupported(): boolean
  identify(model?: NiimbotModel): Promise<NiimbotPrinterInfo>
  printImage(
    url: string,
    opts: {
      model?: NiimbotModel
      size?: NiimbotSize
      copies?: number
      density?: number
      offsetY?: number
      onProgress?: (s: string) => void
    },
  ): Promise<void>
  /** หลาย URL = หลายหน้าใน job เดียว (pipelined — กระดาษวิ่งต่อเนื่อง ไม่หดกลับระหว่างใบ) */
  printBatch(urls: string[], opts: { model?: NiimbotModel; size?: NiimbotSize; density?: number; onProgress?: (s: string) => void }): Promise<void>
  disconnect(): Promise<void>
  printer?: NiimbotPrinterInfo
  DEBUG?: boolean
}

/** preset รุ่น B1 Pro (protocol v4 · 300dpi · model id 4097 — task ถูกยืนยันตอน connect เอง) */
export const B1_PRO_MODEL: NiimbotModel = { name_prefixes: ['B1'], task: 'v4', density: 3, label_type: 1, speed: 1 }

/** 40×60 มม. ที่ 300dpi — round(40*300/25.4)=472 · round(60*300/25.4)=709 (สูตร sizeFromMm ของไลบรารี) */
export const STICKER_40x60_300DPI: NiimbotSize = { w_px: 472, h_px: 709, offset_y_px: 0 }

/**
 * R33: size สำหรับงานที่มีชดเชยฟีด — h_px ต้องเท่ากับความสูง PNG ที่ render ไป (stickerPageHeight)
 * ไม่งั้น imageToPacked ยืดรูปไป fit size = ภาพบี้/เพี้ยน · offset ในรูปทำไปแล้วที่ render → lib offsetY = 0
 */
export function stickerSize(offsetY = 0, faceH?: number): NiimbotSize {
  return { w_px: STICKER_40x60_300DPI.w_px, h_px: stickerPageHeight(offsetY, faceH), offset_y_px: 0 }
}

let lib: NiimbotLib | null = null

async function loadNiimbot(): Promise<NiimbotLib> {
  if (lib) return lib
  if (typeof navigator === 'undefined' || !('bluetooth' in navigator)) {
    throw new Error('เบราว์เซอร์นี้ไม่รองรับ Web Bluetooth — เปิดหน้านี้ด้วย Chrome/Edge (https)')
  }
  await import('niimbot-web-bluetooth')
  const g = (window as unknown as { Niimbot?: NiimbotLib }).Niimbot
  if (!g) throw new Error('โหลดไลบรารี Niimbot ไม่สำเร็จ')
  lib = g
  return lib
}

/** เบราว์เซอร์นี้รองรับไหม (เรียกตอน render ได้ ไม่มี side effect) */
export function niimbotSupported(): boolean {
  return typeof navigator !== 'undefined' && 'bluetooth' in navigator
}

/** เชื่อม + จำแนกรุ่น (B1 vs B1 Pro — ชื่อ BLE เหมือนกัน ไลบรารี detect เอง) ไม่พิมพ์ */
export async function niimbotIdentify(): Promise<NiimbotPrinterInfo> {
  const N = await loadNiimbot()
  return await N.identify(B1_PRO_MODEL)
}

export interface NiimbotPrintOpts {
  onProgress?: (s: string) => void
  /** R33: ชดเชยฟีด (px) — ต้องเป็นค่าเดียวกับที่ใช้ตอน renderStickerPng (size.h_px ผูกกับค่านี้) */
  offsetY?: number
  /** R34: ความสูงหน้าดวงจริง (px) — ผูก png ↔ SetPageSize เหมือน offset (default 709) */
  faceH?: number
}

/**
 * พิมพ์สติกเกอร์ 1 ใบจาก PNG (dataURL) — resolve เมื่อเครื่อง "ยืนยัน" งานแล้ว
 * (ทุกหน้ายืนยัน + เคาน์เตอร์ครบ) · reject = ตรวจกระดาษ (งานอาจออกบางส่วนแล้ว)
 */
export async function niimbotPrintSticker(pngDataUrl: string, opts?: NiimbotPrintOpts): Promise<void> {
  const N = await loadNiimbot()
  await N.printImage(pngDataUrl, {
    model: B1_PRO_MODEL,
    size: stickerSize(opts?.offsetY ?? 0, opts?.faceH),
    density: 3,
    onProgress: opts?.onProgress,
  })
}

/** R31: หลายใบต่อคิวใน job เดียว (printBatch = pipelined pages — วิ่งยาวจนครบ แล้ว PrintEnd ทีเดียว) */
export async function niimbotPrintStickers(pngDataUrls: string[], opts?: NiimbotPrintOpts): Promise<void> {
  if (pngDataUrls.length === 0) return
  const N = await loadNiimbot()
  const size = stickerSize(opts?.offsetY ?? 0, opts?.faceH)
  if (pngDataUrls.length === 1) {
    await N.printImage(pngDataUrls[0], { model: B1_PRO_MODEL, size, density: 3, onProgress: opts?.onProgress })
    return
  }
  await N.printBatch(pngDataUrls, { model: B1_PRO_MODEL, size, density: 3, onProgress: opts?.onProgress })
}

/** แปล error เป็นคำไทยสั้น ๆ (pure — test ได้) */
export function describeNiimbotError(e: unknown): string {
  const s = String((e as { message?: string })?.message || e)
  if (/cancel|choosER|user cancelled|Permission/i.test(s)) return 'ยังไม่ได้เลือกเครื่องพิมพ์ — กดปุ่มอีกครั้งแล้วเลือก B1 Pro ในกล่อง Windows'
  if (/not confirmed|PageEnd|counter stopped/i.test(s)) return 'เครื่องยืนยันงานไม่ครบ — ' + s.slice(0, 140) + ' → เช็คกระดาษ (อาจออกบางส่วนแล้ว)'
  if (/bluetooth|gatt|read|write|Permission|not allowed/i.test(s)) return 'Bluetooth เชื่อมไม่ได้ — เปิด Bluetooth ของ Windows · อยู่ใกล้เครื่อง · ห้ามค้างจากแอปอื่น แล้วลองใหม่'
  if (/not supported|https/i.test(s)) return 'เบราว์เซอร์/โปรโตคอลไม่รองรับ — ใช้ Chrome/Edge บน https เท่านั้น'
  return s.slice(0, 160)
}
