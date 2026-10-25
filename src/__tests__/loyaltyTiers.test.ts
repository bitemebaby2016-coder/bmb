// ============================================
// G&R STAGE 3 (migration 155) — Loyalty client mirror + RPC flows
//   · tier math (mirror SQL loyalty_tier_of — ขอบ 1,500/4,000/8,000 ทุกจุด)
//   · net sales (mirror SQL loyalty_order_net — ไม่รวมค่าส่ง · ยกเลิก/คืนเงิน = 0)
//   · progress (mirror สูตร loyalty_my_status)
//   · DEFAULT policy = ตรงกับ seed ใน migration 155 เป๊ะ (คู่สัญญา SQL)
//   · fetchers: ชื่อ RPC/พารามิเตอร์ถูก · payload ผิด = null ไม่แสร้งว่าสำเร็จ
//   · ข้อความไทยครบทุกค่า (ไม่มี string ว่าง)
// ============================================
import { describe, it, expect, vi, beforeEach } from 'vitest'

const rpcMock = vi.hoisted(() => vi.fn())
vi.mock('@/lib/supabase', () => ({
  supabase: {
    rpc: rpcMock,
    auth: { getUser: vi.fn(async () => ({ data: { user: null } })) },
    from: vi.fn(() => ({})),
  },
}))

import {
  tierForNetSales,
  tierLabel,
  nextTierOf,
  progressTowardTier,
  orderNetSales,
  loyaltyTierCatalog,
  describeLoyaltyTier,
  describeLoyaltyIssue,
  describeLoyaltyEntryType,
  fetchLoyaltyStatus,
  fetchLoyaltyHistory,
  DEFAULT_THRESHOLDS,
  DEFAULT_LOYALTY_POLICY,
  LOYALTY_TIER_KEYS,
  type LoyaltyStatus,
} from '@/lib/loyaltyClient'

const statusPayload: LoyaltyStatus = {
  tier: 'gold',
  tier_label: 'Gold',
  tiers_enabled: true,
  window_months: 12,
  net_sales: 4500,
  thresholds: { silver: 1500, gold: 4000, platinum: 8000 },
  next_tier: 'platinum',
  next_threshold: 8000,
  remaining: 3500,
  progress: 0.5625,
  points_balance: 0,
  points_enabled: false,
  points_per_baht: 0,
  earn_qualify_status: 'delivered',
}

beforeEach(() => {
  rpcMock.mockReset()
})

describe('tierForNetSales — mirror SQL loyalty_tier_of (เกณฑ์ §5.2)', () => {
  it('ขอบล่างของทุกระดับ: 1,500 / 4,000 / 8,000 (≥ ผ่าน · ต่ำกว่า 1 สตางค์ = ไม่ผ่าน)', () => {
    expect(tierForNetSales(0)).toBe('member')
    expect(tierForNetSales(1499.99)).toBe('member')
    expect(tierForNetSales(1500)).toBe('silver')
    expect(tierForNetSales(3999.99)).toBe('silver')
    expect(tierForNetSales(4000)).toBe('gold')
    expect(tierForNetSales(7999.99)).toBe('gold')
    expect(tierForNetSales(8000)).toBe('platinum')
    expect(tierForNetSales(100000)).toBe('platinum')
  })

  it('ค่า null/undefined/NaN/ติดลบ = member (ไม่เดา ไม่พัง)', () => {
    expect(tierForNetSales(null)).toBe('member')
    expect(tierForNetSales(undefined)).toBe('member')
    expect(tierForNetSales(NaN)).toBe('member')
    expect(tierForNetSales(-100)).toBe('member')
  })

  it('thresholds ที่แอดมินเปลี่ยนมีผล (mirror policy_state)', () => {
    const custom = { silver: 100, gold: 200, platinum: 300 }
    expect(tierForNetSales(99, custom)).toBe('member')
    expect(tierForNetSales(150, custom)).toBe('silver')
    expect(tierForNetSales(250, custom)).toBe('gold')
    expect(tierForNetSales(300, custom)).toBe('platinum')
  })

  it('mirror กับ nextTierOf/tierLabel ครบ 4 ระดับ', () => {
    expect(LOYALTY_TIER_KEYS).toEqual(['member', 'silver', 'gold', 'platinum'])
    expect(nextTierOf('member')).toBe('silver')
    expect(nextTierOf('silver')).toBe('gold')
    expect(nextTierOf('gold')).toBe('platinum')
    expect(nextTierOf('platinum')).toBeNull()
    expect(tierLabel('member')).toBe('Member')
    expect(tierLabel('platinum')).toBe('Platinum')
  })
})

describe('progressTowardTier — mirror สูตรใน loyalty_my_status', () => {
  it('net/threshold + clamp 0..1 + กันหารศูนย์', () => {
    expect(progressTowardTier(4500, 8000)).toBe(0.5625)
    expect(progressTowardTier(0, 1500)).toBe(0)
    expect(progressTowardTier(-5, 1500)).toBe(0)
    expect(progressTowardTier(9000, 8000)).toBe(1)
    expect(progressTowardTier(5000, null)).toBe(0)
    expect(progressTowardTier(5000, 0)).toBe(0)
    expect(progressTowardTier(NaN, 1500)).toBe(0)
  })
})

describe('DEFAULT policy — ต้องตรงกับ seed loyalty_policy ใน migration 155', () => {
  it('ค่าเริ่มต้น 8 คีย์ตรงตามสัญญา SQL', () => {
    expect(DEFAULT_LOYALTY_POLICY).toEqual({
      tiers_enabled: true,
      window_months: 12,
      tier_silver_min: 1500,
      tier_gold_min: 4000,
      tier_platinum_min: 8000,
      points_enabled: false,
      points_per_baht: 0,
      earn_qualify_status: 'delivered',
    })
  })

  it('DEFAULT_THRESHOLDS มาจาก policy + catalog 4 ระดับเรียงขึ้นจริง', () => {
    expect(DEFAULT_THRESHOLDS).toEqual({ silver: 1500, gold: 4000, platinum: 8000 })
    const cat = loyaltyTierCatalog()
    expect(cat).toHaveLength(4)
    expect(cat.map((t) => t.key)).toEqual(['member', 'silver', 'gold', 'platinum'])
    expect(cat[0].min).toBe(0)
    expect(cat[1].min).toBeLessThan(cat[2].min)
    expect(cat[2].min).toBeLessThan(cat[3].min)
    expect(cat.every((t) => t.label.length > 0 && t.emoji.length > 0)).toBe(true)
  })

  it('catalog ใช้ thresholds ที่ส่งมา (แอดมินเปลี่ยน = UI ตาม)', () => {
    const cat = loyaltyTierCatalog({ silver: 500, gold: 1000, platinum: 2000 })
    expect(cat.map((t) => t.min)).toEqual([0, 500, 1000, 2000])
  })
})

describe('orderNetSales — mirror SQL loyalty_order_net', () => {
  it('ไม่รวมค่าส่ง/ค่าบริการ (ฟังก์ชันไม่รับค่าพวกนั้น — หักแค่ส่วนลด)', () => {
    expect(orderNetSales({
      status: 'delivered', payment_status: 'paid',
      subtotal: 4600, discount_amount: 100,
    })).toBe(4500)
  })

  it('ยกเลิก/failed = 0 · คืนเงินเต็ม = 0', () => {
    expect(orderNetSales({ status: 'cancelled', payment_status: 'paid', subtotal: 3000, discount_amount: 0 })).toBe(0)
    expect(orderNetSales({ status: 'failed', payment_status: 'paid', subtotal: 3000, discount_amount: 0 })).toBe(0)
    expect(orderNetSales({ status: 'delivered', payment_status: 'refund', subtotal: 1000, discount_amount: 0 })).toBe(0)
  })

  it('partial refund หักตามยอดคืนจริง + clamp ไม่ให้ติดลบ', () => {
    expect(orderNetSales({
      status: 'delivered', payment_status: 'partially_refunded',
      subtotal: 300, discount_amount: 0, refunded_baht: 150,
    })).toBe(150)
    expect(orderNetSales({
      status: 'delivered', payment_status: 'partially_refunded',
      subtotal: 300, discount_amount: 0, refunded_baht: 999,
    })).toBe(0)
  })

  it('ส่วนลดเกิน subtotal = 0 (GREATEST) · ยังไม่จ่าย = นับตามเกณฑ์ (mirror SQL)', () => {
    expect(orderNetSales({ status: 'pending', payment_status: 'pending', subtotal: 100, discount_amount: 150 })).toBe(0)
    expect(orderNetSales({ status: 'pending', payment_status: 'pending', subtotal: 500, discount_amount: 0 })).toBe(500)
  })
})

describe('fetchLoyaltyStatus / fetchLoyaltyHistory — RPC จริง · ผิด = null', () => {
  it('status: เรียก rpc ชื่อถูก + payload ผ่าน validation', async () => {
    rpcMock.mockResolvedValueOnce({ data: statusPayload, error: null })
    await expect(fetchLoyaltyStatus()).resolves.toEqual(statusPayload)
    expect(rpcMock).toHaveBeenCalledWith('loyalty_my_status')
  })

  it('status: tier ไม่รู้จัก / ขาด thresholds = null (ไม่แสร้งว่าใช้ได้)', async () => {
    rpcMock.mockResolvedValueOnce({ data: { ...statusPayload, tier: 'vibranium' }, error: null })
    await expect(fetchLoyaltyStatus()).resolves.toBeNull()
    rpcMock.mockResolvedValueOnce({ data: { ...statusPayload, thresholds: undefined }, error: null })
    await expect(fetchLoyaltyStatus()).resolves.toBeNull()
    rpcMock.mockResolvedValueOnce({ data: { ...statusPayload, net_sales: '4500' }, error: null })
    await expect(fetchLoyaltyStatus()).resolves.toBeNull()
  })

  it('status: server error / โยน exception = null', async () => {
    rpcMock.mockResolvedValueOnce({ data: null, error: { message: 'x' } })
    await expect(fetchLoyaltyStatus()).resolves.toBeNull()
    rpcMock.mockRejectedValueOnce(new Error('network'))
    await expect(fetchLoyaltyStatus()).resolves.toBeNull()
  })

  it('history: เรียก rpc ชื่อถูก + p_limit ตามที่ส่ง + default 50', async () => {
    rpcMock.mockResolvedValueOnce({
      data: { entries: [], balance: 0, points_enabled: false, window_months: 12 }, error: null,
    })
    await expect(fetchLoyaltyHistory(20)).resolves.toMatchObject({ entries: [], balance: 0 })
    expect(rpcMock).toHaveBeenLastCalledWith('loyalty_my_history', { p_limit: 20 })

    rpcMock.mockResolvedValueOnce({
      data: { entries: [], balance: 0, points_enabled: false, window_months: 12 }, error: null,
    })
    await fetchLoyaltyHistory()
    expect(rpcMock).toHaveBeenLastCalledWith('loyalty_my_history', { p_limit: 50 })
  })

  it('history: entries ไม่ใช่ array / balance หาย = null', async () => {
    rpcMock.mockResolvedValueOnce({ data: { entries: 'nope', balance: 0 }, error: null })
    await expect(fetchLoyaltyHistory()).resolves.toBeNull()
    rpcMock.mockResolvedValueOnce({ data: { entries: [] }, error: null })
    await expect(fetchLoyaltyHistory()).resolves.toBeNull()
    rpcMock.mockResolvedValueOnce({ data: null, error: { message: 'boom' } })
    await expect(fetchLoyaltyHistory()).resolves.toBeNull()
  })
})

describe('ข้อความไทย — ครบทุกค่า ไม่มี string ว่าง', () => {
  it('describeLoyaltyTier ครบทุกระดับ', () => {
    for (const tier of LOYALTY_TIER_KEYS) {
      expect(describeLoyaltyTier(tier).length).toBeGreaterThan(5)
    }
  })

  it('describeLoyaltyIssue ทุกเหตุผล', () => {
    for (const reason of ['load_failed', 'signed_out', 'disabled_tiers'] as const) {
      expect(describeLoyaltyIssue(reason).length).toBeGreaterThan(5)
    }
  })

  it('describeLoyaltyEntryType ทุกประเภท (ค่าใน ledger CHECK)', () => {
    for (const t of ['purchase', 'reversal', 'adjustment'] as const) {
      expect(describeLoyaltyEntryType(t).length).toBeGreaterThan(3)
    }
  })
})