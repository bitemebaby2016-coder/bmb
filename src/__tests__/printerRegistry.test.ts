// ============================================
// BMB — printer registry + print payload tests (R21 · Owner 2026-10-29)
// pure helpers ของระบบพิมพ์ใบสั่งอาหารเข้าครัว (Nimbot B1Pro + เครื่องอื่น)
// ============================================
import { describe, it, expect } from 'vitest'
import {
  createPrinterDef,
  upsertPrinter,
  removePrinter,
  assignPrinter,
  resolvePrinter,
  describePrinterTarget,
  buildPrintOrderData,
  DEFAULT_PRINTER_SETTINGS,
} from '@/lib/printService'

describe('createPrinterDef — preset โมเดล', () => {
  it('Nimbot B1Pro ใช้ความกว้าง 50 มม. เป็นค่าเริ่มต้น', () => {
    const p = createPrinterDef({ label: 'Nimbot B1Pro — ครัว', model: 'nimbot_b1pro' })
    expect(p.model).toBe('nimbot_b1pro')
    expect(p.paperWidthMm).toBe(50)
    expect(p.active).toBe(true)
    expect(p.id).toMatch(/^prn-/)
  })

  it('โมเดลที่ไม่รู้จักถูกบังคับเป็น other (ไม่พังหน้า UI)', () => {
    const p = createPrinterDef({ label: 'X', model: 'nope' as never })
    expect(p.model).toBe('other')
    expect(p.paperWidthMm).toBe(80)
  })

  it('ชื่อว่าง → ใช้ชื่อโมเดลแทน (ไม่มีแถวชื่อว่าง)', () => {
    const p = createPrinterDef({ label: '   ', model: 'thermal_58' })
    expect(p.label.length).toBeGreaterThan(0)
    expect(p.paperWidthMm).toBe(58)
  })
})

describe('registry CRUD + การผูกบทบาท', () => {
  const a = createPrinterDef({ label: 'A', model: 'nimbot_b1pro' })
  const b = createPrinterDef({ label: 'B', model: 'thermal_80' })

  it('upsert เพิ่มแถวใหม่ และแทนที่แถวเดิมเมื่อ id ซ้ำ (ไม่เบิ้ล)', () => {
    let s = upsertPrinter(DEFAULT_PRINTER_SETTINGS, a)
    expect(s.printers).toHaveLength(1)
    s = upsertPrinter(s, b)
    expect(s.printers).toHaveLength(2)
    s = upsertPrinter(s, { ...a, label: 'A2' })
    expect(s.printers).toHaveLength(2)
    expect(s.printers!.find((p) => p.id === a.id)!.label).toBe('A2')
  })

  it('assignPrinter ผูกตามบทบาท (receipt/kitchen คนละกันได้)', () => {
    let s = upsertPrinter(upsertPrinter(DEFAULT_PRINTER_SETTINGS, a), b)
    s = assignPrinter(s, 'receipt', a.id)
    s = assignPrinter(s, 'kitchen', b.id)
    expect(resolvePrinter(s, 'receipt')!.id).toBe(a.id)
    expect(resolvePrinter(s, 'kitchen')!.id).toBe(b.id)
  })

  it('resolvePrinter fallback: เครื่อง active เดียวถูกใช้เมื่อยังไม่ได้ผูก', () => {
    const s = upsertPrinter(DEFAULT_PRINTER_SETTINGS, a)
    expect(resolvePrinter(s, 'kitchen')!.id).toBe(a.id)
    // หลายเครื่องแต่ยังไม่ผูก → ไม่เดา (คืน null เพื่อให้ใช้ค่าเริ่มต้นระบบ)
    const s2 = upsertPrinter(s, b)
    expect(resolvePrinter(s2, 'kitchen')).toBeNull()
    // ไม่มีเครื่องเลย → null
    expect(resolvePrinter(DEFAULT_PRINTER_SETTINGS, 'receipt')).toBeNull()
  })

  it('removePrinter ลบแถว + ปลดผูกบทบาทที่ชี้ไปที่เครื่องนั้น (ไม่ค้าง id ตาย)', () => {
    let s = upsertPrinter(upsertPrinter(DEFAULT_PRINTER_SETTINGS, a), b)
    s = assignPrinter(s, 'receipt', a.id)
    s = assignPrinter(s, 'kitchen', a.id)
    s = removePrinter(s, a.id)
    expect(s.printers).toHaveLength(1)
    expect(s.receiptPrinterId).toBeNull()
    expect(s.kitchenPrinterId).toBeNull()
    expect(resolvePrinter(s, 'kitchen')!.id).toBe(b.id)
  })

  it('describePrinterTarget มีชื่อเครื่อง/ข้อความ fallback ชัดเจน (ไม่โม้พิมพ์สำเร็จ)', () => {
    const withLoc = { ...a, location: 'ครัว' }
    const s = assignPrinter(upsertPrinter(DEFAULT_PRINTER_SETTINGS, withLoc), 'kitchen', a.id)
    expect(describePrinterTarget(s, 'kitchen')).toContain('ครัว')
    expect(describePrinterTarget(DEFAULT_PRINTER_SETTINGS, 'receipt')).toBe('เครื่องพิมพ์ค่าเริ่มต้นของระบบ')
    const legacy = { ...DEFAULT_PRINTER_SETTINGS, kitchenPrinterName: 'Nimbot B1Pro' }
    expect(describePrinterTarget(legacy, 'kitchen')).toBe('Nimbot B1Pro')
  })
})

describe('buildPrintOrderData — payload ของเทมเพลต', () => {
  const base = {
    order_number: 'BMB-1',
    items: [
      { product_name: 'ข้าวมันไก่', quantity: 2, unit_price: 50 },
      { product_name: 'น้ำเปล่า', quantity: 1, unit_price: 10, special_request: 'ไม่ใส่น้ำแข็ง' },
    ],
    total_amount: 100,
  }

  it('ใช้ค่า subtotal/ส่วนลดที่ server เก็บไว้ (ไม่เดาจากบรรทัด)', () => {
    const p = buildPrintOrderData({ ...base, subtotal: 110, discount_amount: 10, delivery_fee: 20 })
    expect(p.subtotal).toBe(110)
    expect(p.discount_amount).toBe(10)
    expect(p.delivery_fee).toBe(20)
    expect(p.total_amount).toBe(100)
  })

  it('DB ไม่ส่ง subtotal → บวกจากบรรทัดสินค้า', () => {
    const p = buildPrintOrderData(base)
    expect(p.subtotal).toBe(110)
    expect(p.items).toHaveLength(2)
    expect(p.items[1].special_request).toBe('ไม่ใส่น้ำแข็ง')
  })

  it('ค่าว่าง/undefined ถูก neutralize เป็น 0 ไม่ใช่ NaN (ใบเสร็จไม่พัง)', () => {
    const p = buildPrintOrderData({ order_number: 'BMB-2', items: [], total_amount: null as unknown as number })
    expect(p.subtotal).toBe(0)
    expect(p.total_amount).toBe(0)
    expect(p.discount_amount).toBe(0)
    expect(Number.isNaN(p.delivery_fee)).toBe(false)
  })

  it('items ว่าง →  배열ว่าง ไม่ throw', () => {
    const p = buildPrintOrderData({ order_number: 'BMB-3', items: [] })
    expect(p.items).toEqual([])
  })
})
