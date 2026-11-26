// ============================================
// Bite Me Baby — Supplier CSV / Excel import + manual entry (Owner §2.4/2.5)
// CSV: native parser. XLSX: minimal zip+xml reader (DecompressionStream +
// DOMParser) — no external deps. Manual entry = PurchaseLineInput[] built in UI.
// ============================================
import type { PurchaseLineInput } from './types'

/** Parse CSV text into rows of string cells (handles quotes, commas, CRLF). */
export function parseCsv(text: string): string[][] {
  const rows: string[][] = []
  let row: string[] = []
  let cell = ''
  let inQuotes = false
  const s = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n')
  for (let i = 0; i < s.length; i++) {
    const ch = s[i]
    if (inQuotes) {
      if (ch === '"') {
        if (s[i + 1] === '"') { cell += '"'; i++ } else inQuotes = false
      } else cell += ch
    } else if (ch === '"') inQuotes = true
    else if (ch === ',') { row.push(cell); cell = '' }
    else if (ch === '\n') { row.push(cell); rows.push(row); row = []; cell = '' }
    else cell += ch
  }
  if (cell.length > 0 || row.length > 0) { row.push(cell); rows.push(row) }
  return rows.filter((r) => r.some((c) => c.trim() !== ''))
}

function toNum(v: string | undefined): number | null {
  if (v == null) return null
  const n = Number(String(v).replace(/[^0-9.-]/g, ''))
  return Number.isFinite(n) ? n : null
}

const HEADER_ALIASES: Record<keyof PurchaseLineInput, string[]> = {
  description: ['description', 'item', 'name', 'product', 'รายการ', 'สินค้า'],
  quantity: ['quantity', 'qty', 'จำนวน'],
  unit: ['unit', 'หน่วย'],
  unit_price: ['unit_price', 'price', 'ราคา', 'ราคาต่อหน่วย'],
  line_total: ['line_total', 'total', 'ยอดรวม', 'รวม'],
}

function headerIndex(headers: string[], key: keyof PurchaseLineInput): number {
  const lower = headers.map((h) => h.trim().toLowerCase())
  for (const alias of HEADER_ALIASES[key]) {
    const idx = lower.indexOf(alias)
    if (idx !== -1) return idx
  }
  return -1
}

/** Map a headered matrix to purchase lines. Falls back to positional order. */
export function matrixToLines(rows: string[][]): PurchaseLineInput[] {
  if (rows.length === 0) return []
  const first = rows[0]
  const hasHeader = headerIndex(first, 'description') !== -1 || headerIndex(first, 'unit_price') !== -1
  const body = hasHeader ? rows.slice(1) : rows
  const idx = hasHeader
    ? {
        description: headerIndex(first, 'description'),
        quantity: headerIndex(first, 'quantity'),
        unit: headerIndex(first, 'unit'),
        unit_price: headerIndex(first, 'unit_price'),
        line_total: headerIndex(first, 'line_total'),
      }
    : { description: 0, quantity: 1, unit: 2, unit_price: 3, line_total: 4 }
  const cell = (r: string[], i: number) => (i >= 0 ? r[i] : undefined)
  return body.map((r) => ({
    description: (cell(r, idx.description) ?? '').trim(),
    quantity: toNum(cell(r, idx.quantity)),
    unit: (cell(r, idx.unit) ?? '').trim() || null,
    unit_price: toNum(cell(r, idx.unit_price)),
    line_total: toNum(cell(r, idx.line_total)),
  }))
}

export function parseCsvToLines(text: string): PurchaseLineInput[] {
  return matrixToLines(parseCsv(text))
}

// ---------- minimal XLSX (zip + xml) ----------
interface ZipEntry { name: string; method: number; compSize: number; localOffset: number }

function readZipEntries(buf: Uint8Array): ZipEntry[] {
  const dv = new DataView(buf.buffer, buf.byteOffset, buf.byteLength)
  // find End Of Central Directory (0x06054b50) scanning backwards
  let eocd = -1
  for (let i = buf.length - 22; i >= 0; i--) {
    if (dv.getUint32(i, true) === 0x06054b50) { eocd = i; break }
  }
  if (eocd < 0) throw new Error('not_a_zip')
  const count = dv.getUint16(eocd + 10, true)
  let ptr = dv.getUint32(eocd + 16, true)
  const entries: ZipEntry[] = []
  for (let i = 0; i < count; i++) {
    if (dv.getUint32(ptr, true) !== 0x02014b50) break
    const method = dv.getUint16(ptr + 10, true)
    const compSize = dv.getUint32(ptr + 20, true)
    const nameLen = dv.getUint16(ptr + 28, true)
    const extraLen = dv.getUint16(ptr + 30, true)
    const commentLen = dv.getUint16(ptr + 32, true)
    const localOffset = dv.getUint32(ptr + 42, true)
    const name = new TextDecoder().decode(buf.subarray(ptr + 46, ptr + 46 + nameLen))
    entries.push({ name, method, compSize, localOffset })
    ptr += 46 + nameLen + extraLen + commentLen
  }
  return entries
}

async function readZipFile(buf: Uint8Array, e: ZipEntry): Promise<Uint8Array> {
  const dv = new DataView(buf.buffer, buf.byteOffset, buf.byteLength)
  const lo = e.localOffset
  const nameLen = dv.getUint16(lo + 26, true)
  const extraLen = dv.getUint16(lo + 28, true)
  const start = lo + 30 + nameLen + extraLen
  const data = buf.subarray(start, start + e.compSize)
  if (e.method === 0) return data
  const ds = new DecompressionStream('deflate-raw')
  const stream = new Blob([data as unknown as BlobPart]).stream().pipeThrough(ds)
  return new Uint8Array(await new Response(stream).arrayBuffer())
}

/** Parse the first worksheet of an .xlsx ArrayBuffer into a string matrix. */
export async function parseXlsx(buf: ArrayBuffer): Promise<string[][]> {
  const bytes = new Uint8Array(buf)
  const entries = readZipEntries(bytes)
  const shared = entries.find((e) => e.name === 'xl/sharedStrings.xml')
  const sheet = entries.find((e) => e.name.startsWith('xl/worksheets/sheet') && e.name.endsWith('.xml'))
  if (!sheet) throw new Error('no_worksheet')
  const parser = new DOMParser()
  let sharedStrings: string[] = []
  if (shared) {
    const xml = new TextDecoder().decode(await readZipFile(bytes, shared))
    const doc = parser.parseFromString(xml, 'application/xml')
    sharedStrings = Array.from(doc.getElementsByTagName('si')).map((si) =>
      Array.from(si.getElementsByTagName('t')).map((t) => t.textContent ?? '').join(''))
  }
  const sheetXml = new TextDecoder().decode(await readZipFile(bytes, sheet))
  const doc = parser.parseFromString(sheetXml, 'application/xml')
  const rows: string[][] = []
  for (const rowEl of Array.from(doc.getElementsByTagName('row'))) {
    const cells: string[] = []
    for (const c of Array.from(rowEl.getElementsByTagName('c'))) {
      const t = c.getAttribute('t')
      const v = c.getElementsByTagName('v')[0]?.textContent ?? ''
      if (t === 's') cells.push(sharedStrings[Number(v)] ?? '')
      else cells.push(v)
    }
    rows.push(cells)
  }
  return rows
}

/** Dispatch by file extension → purchase lines. */
export async function parseSupplierFile(file: File): Promise<PurchaseLineInput[]> {
  const name = file.name.toLowerCase()
  if (name.endsWith('.xlsx')) return matrixToLines(await parseXlsx(await file.arrayBuffer()))
  if (name.endsWith('.csv')) return parseCsvToLines(await file.text())
  throw new Error('unsupported_format_use_csv_or_xlsx')
}