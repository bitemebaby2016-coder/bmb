// R82 (Owner 2026-11-08 live test) — ข้อมูลรอบ/เวลา/ประเภทออเดอร์ต้องถูก + ห้ามใส่ตะกร้าเมนูเลยรอบ
// evidence: e2e/_r81b_evidence.json (คอมเมนต์ 09:58 BKK "ยังสั่งได้" + cart ทั้งที่ cutoff 09:00 ผ่าน)
//   · e2e/_r81c_evidence.json (บั๊ก eq. → unresolved_identity ปลอม)
// pure tests = fixed nowUtcMs ทุกเคส (mirror rules ต้อง deterministic)
import { describe, it, expect } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'
import {
  roundPreOrderCutoffMs,
  isRoundPreOrderOpen,
  isPreOrderDayPassed,
  pickNextScheduleDates,
  assessProductWindows,
  recommendOrderableAlternatives,
  buildOrderWindowPrompt,
  type WindowRound,
  type WindowScheduleRow,
  type WindowProduct,
} from '../../supabase/functions/_shared/orderWindow.ts'

const read = (p: string) => fs.readFileSync(path.resolve(__dirname, '../..', p), 'utf8')
const aiSrc = read('supabase/functions/social-ai-worker/index.ts')
const intakeSrc = read('supabase/functions/_shared/socialOrderIntake.ts')
const shopCtxSrc = read('supabase/functions/_shared/shopContext.ts')

// 09:58 ICT 8 พ.ย. 2026 — จุดที่ Owner เห็นคำตอบผิดจริง (evidence 02:58Z)
const NOW = Date.parse('2026-11-08T02:58:00Z')
const TODAY = '2026-11-08'

const round = (o: Partial<WindowRound> & { scheduled_date?: string }): WindowRound => ({
  scheduled_date: TODAY,
  round_key: 'midday',
  display_name: 'เที่ยง',
  status: 'active',
  cutoff_time: '09:00:00',
  pre_order_cutoff: '09:00:00',
  delivery_start: '11:00:00',
  delivery_end: '15:00:00',
  current_count: 0,
  max_capacity: 30,
  ...o,
})

// รอบจริงวันนี้จาก evidence (_r81b rounds_today): เช้า/เที่ยง active · เย็น closed
const TODAY_ROUNDS: WindowRound[] = [
  round({ round_key: 'morning', display_name: 'เช้า', pre_order_cutoff: '05:00:00', cutoff_time: '05:00:00', delivery_start: '07:00:00', delivery_end: '09:00:00', current_count: 2, max_capacity: 20 }),
  round({ round_key: 'midday', display_name: 'เที่ยง', pre_order_cutoff: '09:00:00', cutoff_time: '09:00:00' }),
  round({ round_key: 'evening', display_name: 'เย็น', status: 'closed', pre_order_cutoff: '16:00:00', cutoff_time: '16:00:00', delivery_start: '18:00:00', delivery_end: '20:00:00', max_capacity: 25 }),
]
const FUTURE_ROUNDS: WindowRound[] = [
  round({ scheduled_date: '2026-11-09', round_key: 'morning', display_name: 'เช้า', pre_order_cutoff: '05:00:00', delivery_start: '07:00:00', delivery_end: '09:00:00' }),
  round({ scheduled_date: '2026-11-09', round_key: 'midday', display_name: 'เที่ยง', pre_order_cutoff: '09:00:00' }),
]
const ALL_ROUNDS = [...TODAY_ROUNDS, ...FUTURE_ROUNDS]

const SCHEDULE: WindowScheduleRow[] = [
  { product_id: 'prod-fried', scheduled_date: TODAY, is_published: true }, // ไก่ทอด = มีเฉพาะวันนี้
  { product_id: 'prod-other', scheduled_date: '2026-11-09', is_published: true },
  { product_id: 'prod-both', scheduled_date: TODAY, is_published: true },
  { product_id: 'prod-both', scheduled_date: '2026-11-10', is_published: true },
]
const PRODUCTS: WindowProduct[] = [
  { id: 'prod-fried', name: '🍗 ไก่ทอดอินโด', is_available: true },
  { id: 'prod-other', name: 'สุกี้แห้งกุ้ง', is_available: true },
  { id: 'prod-both', name: 'ลุยสวนหมู+กุ้ง', is_available: true },
  { id: 'prod-sameday', name: 'แซลมอนย่างเกลือ', is_available: true },
]
const BY_ID = new Map(PRODUCTS.map((p) => [p.id, p]))

describe('R82 · orderWindow pure — mirror R77 (isPreOrderDayPassed / roundBookability PRE_ORDER)', () => {
  it('roundPreOrderCutoffMs = pre_order_cutoff ของรอบวันนั้น (absolute UTC) · ไม่มีวัน = null ห้ามเดา', () => {
    const ms = roundPreOrderCutoffMs(TODAY_ROUNDS[1]) // เที่ยง cutoff 09:00 ICT
    expect(ms).toBe(Date.parse('2026-11-08T02:00:00Z'))
    expect(roundPreOrderCutoffMs({ scheduled_date: null, pre_order_cutoff: '09:00' })).toBeNull()
    expect(roundPreOrderCutoffMs({ scheduled_date: 'not-a-date', pre_order_cutoff: '09:00' })).toBeNull()
  })
  it('09:58 ICT: เช้า/เที่ยง = ปิดรับพรีออเดอร์แล้ว (cutoff 05:00/09:00 ผ่าน) · เย็น = status closed', () => {
    expect(isRoundPreOrderOpen(TODAY_ROUNDS[0], NOW)).toBe(false)
    expect(isRoundPreOrderOpen(TODAY_ROUNDS[1], NOW)).toBe(false)
    expect(isRoundPreOrderOpen(TODAY_ROUNDS[2], NOW)).toBe(false)
    // 08:58 ICT (ก่อน cutoff 09:00) → เที่ยงยังเปิด
    const before = Date.parse('2026-11-08T01:58:00Z')
    expect(isRoundPreOrderOpen(TODAY_ROUNDS[1], before)).toBe(true)
  })
  it('isPreOrderDayPassed: วันนี้ทุกรอบปิดแล้ว = true · วันถัด = false · ไม่มีรอบ = true', () => {
    expect(isPreOrderDayPassed(TODAY, TODAY_ROUNDS, { nowUtcMs: NOW, today: TODAY })).toBe(true)
    expect(isPreOrderDayPassed('2026-11-09', FUTURE_ROUNDS, { nowUtcMs: NOW, today: TODAY })).toBe(false)
    expect(isPreOrderDayPassed(TODAY, [], { nowUtcMs: NOW, today: TODAY })).toBe(true)
    expect(isPreOrderDayPassed('2026-11-01', FUTURE_ROUNDS, { nowUtcMs: NOW, today: TODAY })).toBe(true)
  })
  it('pickNextScheduleDates + todayPassed: ข้ามวันนี้ที่เลยรอบ → วนไปวันถัดไป (สัญญา R5/R77)', () => {
    expect(pickNextScheduleDates(SCHEDULE, TODAY)['prod-fried']).toBe(TODAY)
    expect(pickNextScheduleDates(SCHEDULE, TODAY, { todayPassed: true })['prod-fried']).toBeUndefined()
    expect(pickNextScheduleDates(SCHEDULE, TODAY, { todayPassed: true })['prod-both']).toBe('2026-11-10')
  })
})

describe('R82 · assessProductWindows — เคสจริง 09:58 ICT (ไก่ทอดเลยรอบ แต่ระบบใส่ตะกร้าให้)', () => {
  it('ไก่ทอด (มีเฉพาะวันนี้ + วันนี้เลยรอบแล้ว) = orderable:false / pre_order_day_passed', () => {
    const [s] = assessProductWindows(['prod-fried'], SCHEDULE, ALL_ROUNDS, BY_ID, { nowUtcMs: NOW })
    expect(s.orderable).toBe(false)
    expect(s.reason).toBe('pre_order_day_passed')
    expect(s.nextDate).toBeNull()
    expect(s.detail).toContain('ห้ามแนบลิงก์ตะกร้า')
  })
  it('08:58 ICT (ก่อน cutoff 09:00) = ไก่ทอดยังจองวันนี้ได้ (ไม่บล็อกมั่ว)', () => {
    const before = Date.parse('2026-11-08T01:58:00Z')
    const [s] = assessProductWindows(['prod-fried'], SCHEDULE, ALL_ROUNDS, BY_ID, { nowUtcMs: before })
    expect(s.orderable).toBe(true)
    expect(s.reason).toBe('pre_order_bookable')
    expect(s.nextDate).toBe(TODAY)
  })
  it('มีวันถัดไปในปฎิทิน = ยังจองได้ (วนจากวันนี้ที่เลยรอบไป 10 พ.ย.)', () => {
    const [s] = assessProductWindows(['prod-both'], SCHEDULE, ALL_ROUNDS, BY_ID, { nowUtcMs: NOW })
    expect(s.orderable).toBe(true)
    expect(s.nextDate).toBe('2026-11-10')
  })
  it('เมนูไม่มีปฎิทิน (เซมเดย์) + วันนี้ยังมีรอบ active ว่าง = เปิด (m148: SAME_DAY ไม่มีปิดรอบ)', () => {
    const [s] = assessProductWindows(['prod-sameday'], [], ALL_ROUNDS, BY_ID, { nowUtcMs: NOW })
    expect(s.orderable).toBe(true)
    expect(s.reason).toBe('same_day_open')
    const [closed] = assessProductWindows(['prod-sameday'], [], [TODAY_ROUNDS[2]], BY_ID, { nowUtcMs: NOW })
    expect(closed.orderable).toBe(false)
    expect(closed.reason).toBe('no_open_round_today')
  })
  it('ZERO-FAKE: data = null → data_unavailable + orderable=true (ห้ามเดา/ห้ามบล็อก)', () => {
    const [s] = assessProductWindows(['prod-fried'], null, null, BY_ID, { nowUtcMs: NOW })
    expect(s.reason).toBe('data_unavailable')
    expect(s.orderable).toBe(true)
  })
  it('recommendOrderableAlternatives = เฉพาะเมนูที่ยังสั่งได้ (ทางเลือกตามคำสั่ง Owner)', () => {
    const st = assessProductWindows(['prod-fried', 'prod-other', 'prod-both'], SCHEDULE, ALL_ROUNDS, BY_ID, { nowUtcMs: NOW })
    const alts = recommendOrderableAlternatives(st, BY_ID, 8)
    expect(alts).not.toContain('🍗 ไก่ทอดอินโด')
    expect(alts).toContain('สุกี้แห้งกุ้ง')
    expect(alts).toContain('ลุยสวนหมู+กุ้ง')
  })
})

describe('R82 · buildOrderWindowPrompt — บล็อก prompt แยกประเภท/เวลา + กฎแนะนำเมนูของ Owner', () => {
  const block = buildOrderWindowPrompt(SCHEDULE, ALL_ROUNDS, PRODUCTS, { nowUtcMs: NOW })
  it('มีเวลาสด + แยก SAME_DAY vs PRE_ORDER + ป้ายปิดรับพรีออเดอร์ต่อรอบ', () => {
    expect(block).toContain('ORDER WINDOW')
    expect(block).toContain('09:58 น.')
    expect(block).toContain('SAME_DAY')
    expect(block).toContain('ส่งวันนี้')
    expect(block).toContain('พรีออเดอร์ (Pre-Order)')
    expect(block).toContain('ปิดรับพรีออเดอร์แล้ว (05:00 น.)')
    expect(block).toContain('ปิดรับพรีออเดอร์แล้ว (09:00 น.)')
  })
  it('รายการเมนู "เลยรอบ" = ไก่ทอด (คนเดียวที่มีเฉพาะวันนี้) + เมนูที่ยังจองได้คนละชุด', () => {
    expect(block).toContain('ห้ามบอกว่ายังสั่งได้ ห้ามแนบลิงก์ตะกร้า')
    expect(block).toContain('🍗 ไก่ทอดอินโด')
    // แยกคำ: ไก่ทอดต้องอยู่ในบล็อกเลยรอบ ไม่ใช่ในบล็อกยังจองได้
    const blockedPart = block.slice(block.indexOf('เลยรอบ'), block.indexOf('ยังจองได้'))
    expect(blockedPart).toContain('🍗 ไก่ทอดอินโด')
    expect(blockedPart).not.toContain('สุกี้แห้งกุ้ง')
    expect(block.slice(block.indexOf('ยังจองได้'))).toContain('สุกี้แห้งกุ้ง')
  })
  it('RULE ของ Owner 2026-11-08 มาครบ: บอกปิดรับตามจริง + แนะนำเมนูที่ยังสั่งได้ + ระบุประเภทออเดอร์', () => {
    expect(block).toContain('RULE (Owner 2026-11-08)')
    expect(block).toContain('แนะนำเมนูอื่นที่ยังสั่งได้บนเว็บ')
    expect(block).toContain('ประเภทออเดอร์')
  })
  it('ZERO-FAKE: ดึงข้อมูลไม่ได้ = บอกดึงไม่ได้ห้ามเดา + RULE ยังอยู่', () => {
    const none = buildOrderWindowPrompt(null, null, null, { nowUtcMs: NOW })
    expect(none).toContain('ดึงข้อมูลรอบส่ง/ปฎิทินเมนูไม่ได้')
    expect(none).toContain('RULE (Owner 2026-11-08)')
  })
})

describe('R82 · source contracts — intake gate + prompt + resolveActiveRound mode', () => {
  it('runOrderIntake ประเมินเมนูก่อนแนบตะกร้า: เลยรอบ = footer ว่าง + แนะนำทางเลือก', () => {
    expect(aiSrc).toContain('assessProductWindows(m.matched.map((i) => i.product_id)')
    expect(aiSrc).toContain('const blocked = statuses.filter((s) => !s.orderable && s.reason !== \'data_unavailable\')')
    expect(aiSrc).toContain('ห้ามแนบลิงก์ตะกร้าของเมนูนี้ ห้ามสั่งแทนลูกค้า')
    expect(aiSrc).toContain('recommendOrderableAlternatives(altStatuses, productsById, 8)')
    expect(aiSrc).toContain("altLine = alts.length > 0")
  })
  it('draft prompt แนบ ORDER WINDOW block (โหลดซ้ำ cache 60วิ)', () => {
    expect(aiSrc).toContain('buildOrderWindowPrompt(')
    expect(aiSrc).toContain('orderWindowBlock')
    expect((aiSrc.match(/loadOrderWindow\(SB_URL, SERVICE\)/g) || []).length).toBeGreaterThanOrEqual(2)
  })
  it('resolveActiveRound: PRE_ORDER ส่ง mode เพื่อเช็ค cutoff (เหมือนเว็บ) + note ไม่มีรอบมีกฎแนะนำเมนู', () => {
    expect(aiSrc).toContain("x.order_mode === 'PRE_ORDER' ? 'PRE_ORDER' : 'SAME_DAY'")
    expect(intakeSrc).toContain("mode: 'SAME_DAY' | 'PRE_ORDER' = 'SAME_DAY'")
    expect(intakeSrc).toContain('isRoundPreOrderOpen({ ...x, scheduled_date: date }')
    expect(aiSrc).toContain('ไม่มีรอบส่งเปิดรับสำหรับ')
    expect(aiSrc).toContain('แล้วแนะนำเมนูอื่นที่ยังสั่งได้บนเว็บ')
  })
  it('store status (prompt ทุกช่องทาง): ป้ายปิดรับพรีออเดอร์ต่อรอบ + RULE Owner ใหม่', () => {
    expect(shopCtxSrc).toContain('ปิดรับพรีออเดอร์แล้ว')
    expect(shopCtxSrc).toContain('RULE (Owner 2026-11-08)')
    expect(shopCtxSrc).toContain('ต้องระบุ ประเภทออเดอร์')
  })
})
describe('R82g (Owner retest 2026-11-08 B8/B9) — ป้าย "ปิดรับ" นับเฉพาะรอบที่ยังเปิด · รอบเย็นปิด = ห้ามอ้าง', () => {
  // production reality (e2e/_r82g_evidence.json): รอบเย็น status=closed ทุกวันที่ · pre_order_cutoff 16:00
  // บั๊กเดิม = detail เอา max cutoff ของ "ทุกรอบ" → AI บอกลูกค้า "ปิดรับ 16:00" ทั้งที่รอบนั้นปิดแล้ว
  const DAY9: WindowRound[] = [
    round({ scheduled_date: '2026-11-09', round_key: 'morning', display_name: 'เช้า', pre_order_cutoff: '05:00:00', cutoff_time: '05:00:00', delivery_start: '07:00:00', delivery_end: '09:00:00' }),
    round({ scheduled_date: '2026-11-09', round_key: 'midday', display_name: 'เที่ยง', pre_order_cutoff: '09:00:00', cutoff_time: '09:00:00' }),
    round({ scheduled_date: '2026-11-09', round_key: 'evening', display_name: 'เย็น', status: 'closed', pre_order_cutoff: '16:00:00', cutoff_time: '16:00:00', delivery_start: '18:00:00', delivery_end: '20:00:00' }),
  ]
  const KIMCHI: WindowProduct = { id: 'prod-kimchi', name: 'ข้าวหน้าหมูผัดกิมจิ', is_available: true }
  const BY_K = new Map([[KIMCHI.id, KIMCHI]])

  it('ป้ายปิดรับ = ของรอบที่ยังเปิดเท่านั้น (09:00) — ห้ามโชว์ 16:00 ของรอบเย็นปิด + บอกว่าแอดมินปิดรอบ', () => {
    const rows: WindowScheduleRow[] = [{ product_id: KIMCHI.id, scheduled_date: '2026-11-09', is_published: true }]
    const [s] = assessProductWindows([KIMCHI.id], rows, DAY9, BY_K, { nowUtcMs: NOW })
    expect(s.orderable).toBe(true)
    expect(s.nextDate).toBe('2026-11-09')
    expect(s.detail).toContain('ปิดรับ 09:00 น.')
    expect(s.detail).not.toContain('16:00')
    expect(s.detail).toContain('แอดมินปิดรอบ')
  })

  it('วันอนาคตที่ทุรอบถูกแอดมินปิด = ไม่ใช่วันสั่งได้ → pre_order_day_passed + ห้ามแนบลิงก์ตะกร้า', () => {
    const allClosed = DAY9.map((r) => ({ ...r, status: 'closed' }))
    const rows: WindowScheduleRow[] = [{ product_id: 'prod-closed-day', scheduled_date: '2026-11-09', is_published: true }]
    const byId = new Map([['prod-closed-day', { id: 'prod-closed-day', name: 'เมนูวันปิด', is_available: true } as WindowProduct]])
    const [s] = assessProductWindows(['prod-closed-day'], rows, allClosed, byId, { nowUtcMs: NOW })
    expect(s.orderable).toBe(false)
    expect(s.reason).toBe('pre_order_day_passed')
    expect(s.detail).toContain('ห้ามแนบลิงก์ตะกร้า')
  })

  it('prompt: เส้นรอบเย็น (ปิดวันนี้) = "แอดมินปิดรอบนี้" ไม่มี 16:00 · RULE ใหม่ของ Owner มาครบ', () => {
    const block = buildOrderWindowPrompt(SCHEDULE, ALL_ROUNDS, PRODUCTS, { nowUtcMs: NOW })
    const eveningLine = block.split('\n').find((l) => l.startsWith('  · เย็น')) || ''
    expect(eveningLine).toContain('สถานะ ปิด')
    expect(eveningLine).toContain('แอดมินปิดรอบนี้')
    expect(eveningLine).not.toContain('16:00')
    expect(block).toContain('ห้ามยกเวลาคัทออฟ')
    expect(block).toContain('เที่ยงส่ง 11:00 = ปิดรับ 09:00')
    expect(block).toContain('SAME_DAY = ไม่มีปิดรอบตามรอบส่ง')
  })
})