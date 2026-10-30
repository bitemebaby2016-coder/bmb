// R27 — QZ Tray transport: ตัวกลาง เว็บ ↔ เครื่องพิมพ์สติกเกอร์ (Nimbot B1Pro ไม่มีไดรเวอร์
// Win10 → Owner ลง QZ Tray บนเครื่องแทน) — สคริปต์ qz-tray.js จาก npm (ไม่ต้องโหลดจาก
// localhost) + qz.websocket.connect() เข้าพอร์ต secure ของ QZ ในเครื่อง (8181/8282/8383/8484)
// ครั้งแรก: QZ Tray จะถาม Allow/Trust บนถาด — กดครั้งเดียวแล้วใช้ต่อได้เลย
// ข้อมูล print: { type:'pixel', format:'html', flavor:'plain', data:<html>, options:{pageWidth,pageHeight}
//   (ยืนยันจาก JSDoc ของ qz.print ใน qz-tray.js บรรทัด 1709-1739)

type QzApi = {
  websocket: { connect: (o?: unknown) => Promise<void>; isActive: () => boolean }
  printers: { find: (q?: string) => Promise<unknown> }
  configs: { create: (printer: string, options?: Record<string, unknown>) => unknown }
  print: (config: unknown, data: unknown) => Promise<unknown>
  security?: {
    setCertificatePromise: (h: (resolve: (v: unknown) => void) => void) => void
    setSignaturePromise: (f: (data: string) => (resolve: (v: unknown) => void) => void) => void
  }
}

let secured = false

async function loadQz(): Promise<QzApi> {
  const fromGlobal = typeof window !== 'undefined' ? (window as { qz?: QzApi }).qz : undefined
  if (fromGlobal) return fromGlobal
  const mod = (await import('qz-tray')) as unknown as { default?: QzApi } & QzApi
  const qz: QzApi | undefined = (mod && typeof (mod as QzApi).websocket?.connect === 'function' ? mod : undefined) || mod?.default
  if (!qz || typeof qz.websocket?.connect !== 'function') throw new Error('โหลดไลบรารี qz-tray ไม่สำเร็จ')
  if (!secured && qz.security) {
    // unsigned mode (รูปแบบ demo ของ QZ): ใบรับรองว่าง + ลายเซ็นว่าง — กลไก Allow/Trust
    // อยู่ที่โปรแกรม QZ Tray ฝั่งเครื่อง (Owner กดครั้งแรกตอนเชื่อม)
    qz.security.setCertificatePromise((resolve) => resolve(null))
    qz.security.setSignaturePromise(() => (resolve) => resolve(''))
    secured = true
  }
  if (typeof window !== 'undefined') (window as { qz?: QzApi }).qz = qz
  return qz
}

/** Normalize ผลลัพธ์ของ qz.printers.find() → รายชื่อที่ใช้ได้ (คืน [] เมื่อไม่พบ) */
export function normalizeQzPrinters(found: unknown): string[] {
  const arr: unknown[] = Array.isArray(found) ? found : found ? [found] : []
  return arr
    .map((x) => (x == null ? '' : String(x).trim()))
    .filter((s) => s.length > 0 && s !== 'null' && s !== 'undefined')
}

/** เชื่อมต่อ QZ (ถ้ายังไม่ connect) + คืนรายชื่อเครื่องพิมพ์ที่ QZ/OS เห็น */
export async function qzConnect(): Promise<string[]> {
  const qz = await loadQz()
  if (!qz.websocket.isActive()) await qz.websocket.connect({ retries: 2, delay: 1 })
  return normalizeQzPrinters(await qz.printers.find())
}

/** สถานะเชื่อมต่อ (lib ยังไม่โหลด = false — ไม่โหลดเอง side effect ตอนอ่าน) */
export function qzIsConnected(): boolean {
  try {
    const qz = typeof window !== 'undefined' ? (window as { qz?: QzApi }).qz : undefined
    return !!qz?.websocket?.isActive?.()
  } catch {
    return false
  }
}

export interface QzPrintOpts {
  widthMm: number
  heightMm: number
  jobName?: string
}

/** พิมพ์ HTML (สติกเกอร์) เงียบ ๆ ผ่าน QZ — resolve = ส่งงานเข้าสปูเลอร์แล้ว (ยังไม่ใช่ "ปริ้นสำเร็จ") */
export async function qzPrintHtml(printerName: string, html: string, opts: QzPrintOpts): Promise<void> {
  if (!printerName) throw new Error('ยังไม่ได้เลือกเครื่องพิมพ์ QZ')
  const qz = await loadQz()
  if (!qz.websocket.isActive()) await qz.websocket.connect({ retries: 2, delay: 1 })
  const config = qz.configs.create(printerName, {
    units: 'mm',
    size: { width: opts.widthMm, height: opts.heightMm },
    margins: 0,
    orientation: 'portrait',
    jobName: opts.jobName || 'BMB sticker',
  })
  await qz.print(config, [
    {
      type: 'pixel',
      format: 'html',
      flavor: 'plain',
      data: html,
      options: { pageWidth: opts.widthMm, pageHeight: opts.heightMm },
    },
  ])
}

/** แปล error ของ QZ เป็นคำไทยสั้น ๆ ให้แอดมินทำต่อได้ถูก (pure — test ได้) */
export function describeQzError(e: unknown): string {
  const s = String((e as { message?: string })?.message || e)
  if (/certificate|cert\b|trust/i.test(s)) return 'QZ ยังไม่ไว้ใบรับรอง — เปิด QZ Tray แล้วกด Allow/Trust ที่แจ้งขึ้นตอนเชื่อมครั้งแรก แล้วลองใหม่'
  if (/connect|socket|refused|ECONN|timeout/i.test(s)) return 'เชื่อมต่อ QZ Tray ไม่ได้ — เปิดโปรแกรม QZ Tray บนเครื่องพิมพ์ให้ทำงานอยู่ (พอร์ต 8181) แล้วกดเชื่อมต่อใหม่'
  if (/printer|not found/i.test(s)) return 'ไม่พบเครื่องพิมพ์ที่เลือก — ตรวจชื่อเครื่องใน QZ/Windows อีกครั้ง แล้วกดเชื่อมต่อใหม่'
  return s.slice(0, 160)
}
