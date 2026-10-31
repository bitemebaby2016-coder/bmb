// ============================================
// Bite Me Baby — R43 contract + unit tests (Owner 2026-10-31)
// ============================================
// B1: ปุ่มตั้งเวลาต้อง gate approval (RPC คืน ERR_APPROVAL_REQUIRED กับ pending/draft)
// B6: /shop?cart= decode-fail ห้าม return เงียบ — ต้อง toast สาเหตุ
// B4: buildStoreStatusLines = สถานะสด mirror ฝั่งเว็บ (pure — เทสต์ logic จริงได้)
// ============================================

import { describe, it, expect } from 'vitest'
import adminMarketingSrc from '../pages/admin/AdminMarketing.tsx?raw'
import layoutSrc from '../components/layout/Layout.tsx?raw'
import shopCtxSrc from '../../supabase/functions/_shared/shopContext.ts?raw'
import { buildStoreStatusLines, type RoundStatusRow } from '../../supabase/functions/_shared/shopContext.ts'

const round = (over: Partial<RoundStatusRow> = {}): RoundStatusRow => ({
  status: 'active',
  display_name: 'เช้า',
  cutoff_time: '05:00',
  pre_order_cutoff: '05:00',
  delivery_start: '06:00',
  delivery_end: '09:00',
  max_capacity: 60,
  current_count: 0,
  scheduled_date: '2026-10-31',
  round_key: 'morning',
  ...over,
})
const hours = (open: string, close: string) => [{ key: 'hours', value: { open, close } }]

describe('R43 B1 — ปุ่มตั้งเวลา gate approval (ห้ามกดจากรอตรวจแล้วเจอ ERR_APPROVAL_REQUIRED)', () => {
  it('AdminMarketing: disabled + คำใบ้ เมื่อสถานะไม่ใช่ approved/scheduled/failed', () => {
    expect(adminMarketingSrc).toMatch(/status === 'approved' \|\| status === 'scheduled' \|\| status === 'failed'/)
    expect(adminMarketingSrc).toMatch(/disabled=\{!schedulable\(p\.status\)\}/)
    expect(adminMarketingSrc).toMatch(/mk-schedule-hint-\$\{p\.id\}/)
    expect(adminMarketingSrc).toContain('รออนุมัติ')
  })
  it('handleSchedule: guard ก่อนยิง RPC + ข้อความไทยเมื่อ server คืน ERR_APPROVAL_REQUIRED', () => {
    expect(adminMarketingSrc).toMatch(/if \(!post \|\| !schedulable\(post\.status\)\)/)
    expect(adminMarketingSrc).toMatch(/err\.includes\('ERR_APPROVAL_REQUIRED'\)/)
    expect(adminMarketingSrc).toContain('โพสต์นี้ยังไม่ผ่านการอนุมัติ')
  })
})

describe('R43 B6 — /shop?cart= decode-fail ห้ามเงียบ', () => {
  it('Layout: items null/ว่าง → showToast บอกสาเหตุก่อน return (ไม่ใช่ return เปล่า)', () => {
    expect(layoutSrc).toMatch(/const items = readCartParam\(raw\)/)
    expect(layoutSrc).toMatch(/if \(!items \|\| items\.length === 0\) \{/)
    expect(layoutSrc).toMatch(/ลิงก์รายการในแชทไม่สมบูรณ์/)
  })
})

describe('R43 B4 — buildStoreStatusLines (mirror สถานะร้านจาก rounds + settings จริง)', () => {
  it('นอกเวลาเปิดร้าน (21:00 ICT · ปิด 20:00) → sameDayOpen false + ชวนพรีออเดอร์ (เคส Owner: บอกเปิดถึง 20:00 ทั้งที่ปิด)', () => {
    const lines = buildStoreStatusLines(
      [
        round({ scheduled_date: '2026-10-31' }),
        round({ scheduled_date: '2026-11-01', display_name: 'พรุ่งนี้' }),
      ],
      hours('07:00', '20:00'),
      new Date('2026-10-31T14:00:00Z'), // 21:00 ICT
    ).join('\n')
    expect(lines).toContain('sameDayOpen: false')
    expect(lines).toContain('เปิดรับพรีออเดอร์เท่านั้น')
    expect(lines).toContain('ห้ามบอกว่า "สั่งวันนี้ได้')
    expect(lines).toContain('2026-11-01')
  })
  it('ในเวลาเปิดร้าน + รอบวันนี้ว่าง → sameDayOpen true (Same-Day สั่งได้)', () => {
    const lines = buildStoreStatusLines(
      [round()],
      hours('07:00', '20:00'),
      new Date('2026-10-31T05:00:00Z'), // 12:00 ICT
    ).join('\n')
    expect(lines).toContain('sameDayOpen: true')
    expect(lines).toContain('เปิดรับออเดอร์ Same-Day')
  })
  it('รอบวันนี้ถูกปิดทั้งหมด (status=closed) + มีรอบพรุ่งนี้ → พรีออเดอร์เท่านั้น + ชี้รอบถัดไป', () => {
    const lines = buildStoreStatusLines(
      [
        round({ status: 'closed' }),
        round({ scheduled_date: '2026-11-01', display_name: 'วันใหม่', pre_order_cutoff: '23:00' }),
      ],
      null,
      new Date('2026-10-31T05:00:00Z'),
    ).join('\n')
    expect(lines).toContain('sameDayOpen: false')
    expect(lines).toContain('เปิดรับพรีออเดอร์เท่านั้น')
    expect(lines).toContain('2026-11-01')
  })
  it('ZERO-FAKE: ดึง rounds ไม่ได้ = บอกดึงไม่ได้ห้ามเดา · [] = ไม่มีรอบจริง = ปิด', () => {
    expect(buildStoreStatusLines(null, null, new Date('2026-10-31T05:00:00Z')).join('\n')).toContain('ดึงข้อมูลรอบจัดส่งไม่ได้')
    const empty = buildStoreStatusLines([], null, new Date('2026-10-31T05:00:00Z')).join('\n')
    expect(empty).toContain('sameDayOpen: false')
    expect(empty).toContain('ไม่มีรอบจัดส่งที่เปิดรับอยู่')
  })
  it('source contract: getShopContext ดึง delivery_rounds + ฉีด STORE STATUS (สด) + เพดาน MAX_CHARS ยก', () => {
    expect(shopCtxSrc).toMatch(/\/rest\/v1\/delivery_rounds/)
    expect(shopCtxSrc).toMatch(/STORE STATUS \(สด/)
    expect(shopCtxSrc).toMatch(/buildStoreStatusLines\(rounds/)
    expect(shopCtxSrc).toMatch(/MAX_CHARS = 4000/)
  })
})