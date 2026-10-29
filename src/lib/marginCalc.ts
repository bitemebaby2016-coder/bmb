// ============================================
// BMB — margin / profit helper (Owner 2026-10-29 · R21 Phase 2)
// ============================================
// คำนวณ Gross Margin + Net Profit แบบ real-time จากต้นทุนที่แอดมินกรอกใน
// หน้า Products (migration 170: cogs / packaging_cost / other_unit_cost)
//
// กติกา:
//   * pure function ทุกตัว — ไม่ยิง network ไม่แตะ store (test ตรง ๆ ได้)
//   * DISPLAY ONLY — ไม่กระทบราคาที่ลูกค้าจ่าย (server RPC เป็น authority)
//   * ค่าทุกตัวถูก sanitize (NaN/ติดลบ → 0) ก่อนคำนวณ กันฟอร์มพังตอนพิมพ์ค้าง
// ============================================

export interface CostInput {
  cogs?: number | null
  packagingCost?: number | null
  otherCost?: number | null
}

export type MarginTier = 'loss' | 'thin' | 'healthy' | 'strong'

export interface MarginSnapshot {
  price: number
  unitCost: number
  /** กำไรขั้นต้นต่อหน่วย = price - unitCost (ติดลบได้ = ขายขาดทุน) */
  grossProfit: number
  /** % ของราคาสุทธิ (grossProfit / price * 100) — 0 เมื่อ price = 0 */
  grossMarginPct: number
  markupPct: number
  tier: MarginTier
}

/** เกณฑ์แบ่งโซน (เปลี่ยนได้ในที่เดียว — UI ใช้ค่าเดียวกัน) = ขั้นต่ำ (%) ที่จะเข้าโซนนั้น */
export const MARGIN_THRESHOLDS = { thin: 15, strong: 50 } as const

/** ค่า sanitize: ไม่ใช่ตัวเลข / ติดลบ / Infinity → 0 */
export function toCostNumber(v: unknown): number {
  const n = Number(v)
  if (!Number.isFinite(n) || n < 0) return 0
  return n
}

/** ต้นทุนรวมต่อหน่วย = วัตถุดิบ + แพ็กเกจจิ้ง + อื่น (ตรงกับ column generated `unit_cost`) */
export function computeUnitCost(cost: CostInput): number {
  return (
    toCostNumber(cost.cogs) +
    toCostNumber(cost.packagingCost) +
    toCostNumber(cost.otherCost)
  )
}

export function classifyMargin(marginPct: number): MarginTier {
  if (marginPct <= 0) return 'loss'
  if (marginPct < MARGIN_THRESHOLDS.thin) return 'thin'
  if (marginPct < MARGIN_THRESHOLDS.strong) return 'healthy'
  return 'strong'
}

/** Gross margin ของสินค้า 1 หน่วย (real-time ระหว่างแอดมินพิมพ์ต้นทุน) */
export function computeMargin(price: number, cost: CostInput): MarginSnapshot {
  const p = toCostNumber(price)
  const unitCost = computeUnitCost(cost)
  const grossProfit = p - unitCost
  const grossMarginPct = p > 0 ? (grossProfit / p) * 100 : 0
  const markupPct = unitCost > 0 ? (grossProfit / unitCost) * 100 : 0
  return {
    price: p,
    unitCost,
    grossProfit,
    grossMarginPct,
    markupPct,
    tier: classifyMargin(grossMarginPct),
  }
}

export interface ProfitLine {
  price: number
  quantity: number
  cost?: CostInput
}

export interface OrderProfitOptions {
  /** ส่วนลดรวม (คูปอง + แต้ม + referral) — หักออกจากยอดขายได้กำไรสุทธิ */
  discountTotal?: number
  /** ต้นทุนเพิ่มระดับออเดอร์ (เช่น ค่าส่งที่ร้านจ่ายเอง) — เพิ่มลงต้นทุน */
  extraCost?: number
}

export interface OrderProfitResult {
  grossRevenue: number
  discountTotal: number
  netRevenue: number
  totalCost: number
  /** grossProfit = grossRevenue - totalCost (ยังไม่หักส่วนลด) */
  grossProfit: number
  /** netProfit = netRevenue - totalCost - extraCost */
  netProfit: number
  grossMarginPct: number
  netMarginPct: number
  tier: MarginTier
}

/** กำไรทั้งออเดอร์ (สรุปให้แอดมินเห็น real-time ตอนดูรายการ/รายงาน) */
export function computeOrderProfit(
  lines: ProfitLine[],
  opts: OrderProfitOptions = {},
): OrderProfitResult {
  const list = Array.isArray(lines) ? lines : []
  const grossRevenue = list.reduce(
    (sum, l) => sum + toCostNumber(l.price) * Math.max(0, Math.floor(toCostNumber(l.quantity))),
    0,
  )
  const totalCost = list.reduce(
    (sum, l) =>
      sum + computeUnitCost(l.cost ?? {}) * Math.max(0, Math.floor(toCostNumber(l.quantity))),
    0,
  )
  const discountTotal = Math.min(toCostNumber(opts.discountTotal), grossRevenue)
  const extraCost = toCostNumber(opts.extraCost)
  const netRevenue = grossRevenue - discountTotal
  const grossProfit = grossRevenue - totalCost
  const netProfit = netRevenue - totalCost - extraCost
  const grossMarginPct = grossRevenue > 0 ? (grossProfit / grossRevenue) * 100 : 0
  const netMarginPct = netRevenue > 0 ? (netProfit / netRevenue) * 100 : 0
  return {
    grossRevenue,
    discountTotal,
    netRevenue,
    totalCost,
    grossProfit,
    netProfit,
    grossMarginPct,
    netMarginPct,
    tier: classifyMargin(netMarginPct),
  }
}

// ---------- formatters (ใช้ร่วมกับหน้า Admin) ----------

export function formatBaht(n: number | null | undefined): string {
  const v = Number(n ?? 0)
  return '฿' + v.toLocaleString('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

export function formatPct(n: number | null | undefined, digits = 1): string {
  const v = Number(n ?? 0)
  if (!Number.isFinite(v) || v === 0) return '0%'
  return `${v.toFixed(digits)}%`
}

/** ป้ายภาษาไทยของแต่ละโซนกำไร (ใช้ใน badge หน้า Products) */
export function marginTierLabel(tier: MarginTier): string {
  switch (tier) {
    case 'loss':
      return 'ขาดทุน'
    case 'thin':
      return 'กำไรบาง'
    case 'healthy':
      return 'กำไรดี'
    case 'strong':
      return 'กำไรสูง'
  }
}
