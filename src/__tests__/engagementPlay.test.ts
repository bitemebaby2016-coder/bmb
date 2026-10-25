// ============================================
// G&R STAGE 4 (migration 156) — Engagement & Play client mirror
//   · policy defaults = ตรงกับ seed ใน migration 156 เป๊ะ (คู่สัญญา SQL)
//   · normalize แบบ tolerant (ค่าผิด → ชุดเริ่มต้น ไม่แสร้งว่าเปิด)
//   · spin: error mapping → เหตุผลไทยครบ (ZERO-FAKE: ปิด = บอกว่าปิด)
//   · affiliate: normalize/format/?aff= deep-link + sessionStorage claim cycle
//   · catalog fetcher validate ข้อมูล (ผิดรูป = null ไม่ fallback hardcode)
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
  DEFAULT_SPIN_POLICY,
  DEFAULT_AFFILIATE_POLICY,
  normalizeSpinPolicy,
  normalizeAffiliatePolicy,
  fetchSpinStatus,
  trySpinReward,
  describeSpinIssue,
  fetchRewardsCatalog,
  AFFILIATE_CODE_RE,
  normalizeAffiliateCode,
  fetchAffiliateStatus,
  claimAffiliate,
  describeAffiliateClaim,
  describeAffiliateIssue,
  affiliateShareUrl,
  affiliateCodeFromSearch,
  AFFILIATE_CLAIM_STORAGE_KEY,
  saveAffiliateClaimCode,
  readAffiliateClaimCode,
  takeAffiliateClaimCode,
} from '@/lib/engagementClient'

const spinStatusPayload = {
  enabled: true,
  daily_limit: 2,
  points_per_spin: 10,
  used_today: 1,
  remaining_today: 1,
  balance: 10,
}

const affiliateStatusPayload = {
  code: 'AFF-ABC123',
  orders_pending: 1,
  orders_qualified: 2,
  points_total: 60,
  points_this_month: 30,
  policy: {
    enabled: true,
    points_per_qualified_order: 30,
    monthly_cap: 500,
    qualify_status: 'delivered',
  },
}

beforeEach(() => {
  rpcMock.mockReset()
  try { sessionStorage.removeItem(AFFILIATE_CLAIM_STORAGE_KEY) } catch { /* noop */ }
})

describe('DEFAULT policies — ต้องตรงกับ seed ใน migration 156 เป๊ะ (คู่สัญญา SQL)', () => {
  it('spin_policy seed: ปิด + 1/วัน + 0 แต้ม (§3.1 ห้ามเดาอัตรา)', () => {
    expect(DEFAULT_SPIN_POLICY).toEqual({ enabled: false, daily_limit: 1, points_per_spin: 0 })
  })

  it('affiliate_policy seed: ปิด + 0/0 + delivered (fail-closed ทุกค่า)', () => {
    expect(DEFAULT_AFFILIATE_POLICY).toEqual({
      enabled: false,
      points_per_qualified_order: 0,
      monthly_cap: 0,
      qualify_status: 'delivered',
    })
  })
})

describe('normalize — tolerant mirror ของ policy_state SQL', () => {
  it('spin: ค่าผิดชนิด/หาย → ชุดเริ่มต้น ไม่แสร้งว่าเปิด', () => {
    expect(normalizeSpinPolicy(undefined)).toEqual(DEFAULT_SPIN_POLICY)
    expect(normalizeSpinPolicy({ enabled: 'yes', daily_limit: 'x', points_per_spin: null })).toEqual(DEFAULT_SPIN_POLICY)
    expect(normalizeSpinPolicy({ enabled: true, daily_limit: 5, points_per_spin: 20 })).toEqual({
      enabled: true, daily_limit: 5, points_per_spin: 20,
    })
  })

  it('affiliate: qualify_status ว่าง/ผิดชนิด → delivered', () => {
    expect(normalizeAffiliatePolicy({})).toEqual(DEFAULT_AFFILIATE_POLICY)
    expect(normalizeAffiliatePolicy({ qualify_status: '  ', enabled: 1 })).toEqual(DEFAULT_AFFILIATE_POLICY)
    expect(normalizeAffiliatePolicy({ enabled: true, points_per_qualified_order: 30, monthly_cap: 500, qualify_status: 'arrived' }))
      .toEqual({ enabled: true, points_per_qualified_order: 30, monthly_cap: 500, qualify_status: 'arrived' })
  })
})

describe('fetchSpinStatus / trySpinReward — RPC จริง · ผิด = ไม่แสร้งว่ามี', () => {
  it('status: เรียก rpc ชื่อถูก + payload ผ่าน validation', async () => {
    rpcMock.mockResolvedValueOnce({ data: spinStatusPayload, error: null })
    await expect(fetchSpinStatus()).resolves.toEqual(spinStatusPayload)
    expect(rpcMock).toHaveBeenCalledWith('spin_status')
  })

  it('status: ขาด key สำคัญ / server error / exception = null', async () => {
    rpcMock.mockResolvedValueOnce({ data: { enabled: true }, error: null })
    await expect(fetchSpinStatus()).resolves.toBeNull()
    rpcMock.mockResolvedValueOnce({ data: null, error: { message: 'x' } })
    await expect(fetchSpinStatus()).resolves.toBeNull()
    rpcMock.mockRejectedValueOnce(new Error('network'))
    await expect(fetchSpinStatus()).resolves.toBeNull()
  })

  it('reward: สำเร็จ = ok + ค่าครบ + เรียก spin_reward', async () => {
    rpcMock.mockResolvedValueOnce({ data: { ok: true, points: 10, used_today: 1, remaining_today: 0, balance: 10 }, error: null })
    const r = await trySpinReward()
    expect(r.ok).toBe(true)
    if (r.ok) expect(r.result.points).toBe(10)
    expect(rpcMock).toHaveBeenCalledWith('spin_reward')
  })

  it('reward: ERR ของ server → เหตุผลไทยถูกต้องทุกตัว (ZERO-FAKE)', async () => {
    const cases: Array<[string, string]> = [
      ['ERR_SPIN_DISABLED', 'disabled'],
      ['ERR_SPIN_NO_RATE', 'no_rate'],
      ['ERR_SPIN_LIMIT', 'limit'],
      ['ERR_NOT_AUTHENTICATED', 'signed_out'],
      ['other boom', 'load_failed'],
    ]
    for (const [msg, reason] of cases) {
      rpcMock.mockResolvedValueOnce({ data: null, error: { message: msg } })
      const r = await trySpinReward()
      expect(r.ok).toBe(false)
      if (!r.ok) expect(r.reason).toBe(reason)
    }
  })

  it('describeSpinIssue ครบทุกเหตุผล ไม่มี string ว่าง', () => {
    for (const reason of ['disabled', 'no_rate', 'limit', 'signed_out', 'load_failed'] as const) {
      expect(describeSpinIssue(reason).length).toBeGreaterThan(5)
    }
  })
})

describe('rewards catalog — รายการจากตาราง admin · ผิดรูป = null (ไม่ fallback hardcode)', () => {
  it('list: ผ่าน validation → คืน items ครบ', async () => {
    rpcMock.mockResolvedValueOnce({
      data: [
        { id: 'rw-coupon-10', name: 'คูปองลด 10%', description: 'ใช้กับออเดอร์ถัดไป', points_cost: 100, sort_order: 1 },
        { id: 'rw-ship-free', name: 'ส่งฟรี 1 ครั้ง', description: '', points_cost: 150, sort_order: 2 },
      ],
      error: null,
    })
    const items = await fetchRewardsCatalog()
    expect(items).toHaveLength(2)
    expect(items?.[0].points_cost).toBe(100)
    expect(rpcMock).toHaveBeenCalledWith('rewards_catalog_list')
  })

  it('list: item ผิดรูป / cost ≤ 0 / ไม่ใช่ array / server error = null ทั้งชุด', async () => {
    rpcMock.mockResolvedValueOnce({ data: [{ id: 'x', name: 'ok', points_cost: 0 }], error: null })
    await expect(fetchRewardsCatalog()).resolves.toBeNull()
    rpcMock.mockResolvedValueOnce({ data: 'not-array', error: null })
    await expect(fetchRewardsCatalog()).resolves.toBeNull()
    rpcMock.mockResolvedValueOnce({ data: null, error: { message: 'boom' } })
    await expect(fetchRewardsCatalog()).resolves.toBeNull()
  })
})

describe('affiliate — normalize/format/deep-link/sessionStorage/claim', () => {
  it('normalize + format ตรง mirror affiliate_normalize_code', () => {
    expect(normalizeAffiliateCode(' aff-abc123 ')).toBe('AFF-ABC123')
    expect(AFFILIATE_CODE_RE.test('AFF-ABC123')).toBe(true)
    expect(AFFILIATE_CODE_RE.test('BMB-ABC123')).toBe(false)
    expect(AFFILIATE_CODE_RE.test('AFF-')).toBe(false)
  })

  it('my_code: rpc ชื่อถูก + validate ผ่าน / โค้ดผิด = null', async () => {
    rpcMock.mockResolvedValueOnce({ data: affiliateStatusPayload, error: null })
    await expect(fetchAffiliateStatus()).resolves.toEqual(affiliateStatusPayload)
    expect(rpcMock).toHaveBeenCalledWith('affiliate_my_code')
    rpcMock.mockResolvedValueOnce({ data: { ...affiliateStatusPayload, code: 'BOGUS' }, error: null })
    await expect(fetchAffiliateStatus()).resolves.toBeNull()
  })

  it('claim: normalize ก่อนส่ง + validate ผิด = null ไม่ยิง rpc', async () => {
    rpcMock.mockResolvedValueOnce({ data: { ok: true, state: 'pending' }, error: null })
    await expect(claimAffiliate('BMB-1', ' aff-abc123 ')).resolves.toEqual({ ok: true, state: 'pending' })
    expect(rpcMock).toHaveBeenCalledWith('affiliate_claim', { p_order_number: 'BMB-1', p_code: 'AFF-ABC123' })
    rpcMock.mockClear()
    await expect(claimAffiliate('BMB-1', 'bad')).resolves.toBeNull()
    expect(rpcMock).not.toHaveBeenCalled()
  })

  it('?aff= deep-link: ดึงโค้ดถูก/ผิด format = null · share url ถูกรูป', () => {
    expect(affiliateCodeFromSearch('?aff=aff-abc123&x=1')).toBe('AFF-ABC123')
    expect(affiliateCodeFromSearch('aff=BOGUS')).toBeNull()
    expect(affiliateCodeFromSearch('?other=1')).toBeNull()
    const url = affiliateShareUrl('AFF-ABC123')
    expect(url).toContain('/?aff=AFF-ABC123')
  })

  it('sessionStorage cycle: save → read → take ครั้งเดียวแล้วหาย', () => {
    saveAffiliateClaimCode(' aff-abc123 ')
    expect(readAffiliateClaimCode()).toBe('AFF-ABC123')
    expect(takeAffiliateClaimCode()).toBe('AFF-ABC123')
    expect(readAffiliateClaimCode()).toBeNull()
    expect(takeAffiliateClaimCode()).toBeNull()
  })

  it('describeAffiliateIssue / describeAffiliateClaim ทุกสถานะ ไม่ว่าง', () => {
    expect(describeAffiliateIssue('signed_out').length).toBeGreaterThan(5)
    expect(describeAffiliateIssue('load_failed').length).toBeGreaterThan(5)
    for (const state of ['pending', 'qualified', 'reversed'] as const) {
      const d = describeAffiliateClaim({ ok: true, state })
      expect(d.message.length).toBeGreaterThan(5)
      expect(['success', 'info', 'error']).toContain(d.tone)
    }
  })
})