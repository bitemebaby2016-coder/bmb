// ============================================
// R53 (Owner 2026-11-18): voteClient — mirror ของ migration 208
//   ทดสอบ: validate เข้ม (รูปผิด = null ไม่เดา) + ERR_* → reason ครบทุกตัว +
//   ข้อความไทยครบทุกสถานะ (ไม่มี string ว่าง — ZERO-FAKE)
// ============================================
import { describe, it, expect, vi, beforeEach } from 'vitest'

const m = vi.hoisted(() => ({ rpc: vi.fn() }))
vi.mock('@/lib/supabase', () => ({ supabase: { rpc: m.rpc } }))

import {
  fetchVoteStatus,
  castPreorderVote,
  describeVoteIssue,
  type VoteStatus,
} from '@/lib/voteClient'

const okStatus = () => ({
  policy: { enabled: true, daily_limit: 1 },
  used_today: 0,
  remaining_today: 1,
  tallies: [{ product_id: 'p-a', votes: 3 }],
  my_votes: ['p-a'],
})

beforeEach(() => {
  vi.clearAllMocks()
})

describe('fetchVoteStatus — validate เข้ม (ห้ามเดาค่า)', () => {
  it('OK: tallies รวมต่อสินค้า + myVotes ตรง server', async () => {
    m.rpc.mockResolvedValue({ data: { ...okStatus(), tallies: [{ product_id: 'p-a', votes: 2 }, { product_id: 'p-a', votes: 1 }, { product_id: 'p-b', votes: 5 }] }, error: null })
    const s: VoteStatus | null = await fetchVoteStatus()
    expect(s).not.toBeNull()
    expect(s!.tallies).toEqual({ 'p-a': 3, 'p-b': 5 })
    expect(s!.myVotes).toEqual(['p-a'])
    expect(s!.remaining_today).toBe(1)
  })

  it('error server → null (ไม่แสร้งว่ามีสถานะ)', async () => {
    m.rpc.mockResolvedValue({ data: null, error: { message: 'boom' } })
    expect(await fetchVoteStatus()).toBeNull()
  })

  it('รูปผิดทุกแบบ → null: tallies ไม่ใช่ array / votes ไม่ใช่ number / my_votes ผิด', async () => {
    m.rpc.mockResolvedValue({ data: { ...okStatus(), tallies: {} }, error: null })
    expect(await fetchVoteStatus()).toBeNull()
    m.rpc.mockResolvedValue({ data: { ...okStatus(), tallies: [{ product_id: 'p-a', votes: 'x' }] }, error: null })
    expect(await fetchVoteStatus()).toBeNull()
    m.rpc.mockResolvedValue({ data: { ...okStatus(), tallies: [{ product_id: '', votes: 1 }] }, error: null })
    expect(await fetchVoteStatus()).toBeNull()
    m.rpc.mockResolvedValue({ data: { ...okStatus(), my_votes: 'x' }, error: null })
    expect(await fetchVoteStatus()).toBeNull()
    m.rpc.mockResolvedValue({ data: { ...okStatus(), policy: {} }, error: null })
    expect(await fetchVoteStatus()).toBeNull()
  })

  it('throw → null', async () => {
    m.rpc.mockRejectedValue(new Error('network'))
    expect(await fetchVoteStatus()).toBeNull()
  })
})

describe('castPreorderVote — ERR_* → reason ครบทุกตัว (server เป็นคนตัดสิน)', () => {
  it('ok: คืนผลจริงจาก server', async () => {
    m.rpc.mockResolvedValue({ data: { ok: true, productId: 'p-a', productVotes: 3, usedToday: 1, remainingToday: 0 }, error: null })
    const r = await castPreorderVote('p-a')
    expect(r).toEqual({ ok: true, result: { ok: true, productId: 'p-a', productVotes: 3, usedToday: 1, remainingToday: 0 } })
  })

  it('แมพทุก error code ที่ m208 กำหนด', async () => {
    const cases: Array<[string, string]> = [
      ['ERR_NOT_AUTHENTICATED', 'signed_out'],
      ['ERR_VOTE_DISABLED', 'disabled'],
      ['ERR_VOTE_LIMIT', 'limit'],
      ['ERR_VOTE_ALREADY', 'already'],
      ['ERR_VOTE_PRODUCT_NOT_FOUND', 'product_not_found'],
      ['ERR_VOTE_PRODUCT_INVALID', 'product_invalid'],
    ]
    for (const [msg, reason] of cases) {
      m.rpc.mockResolvedValue({ data: null, error: { message: msg } })
      const r = await castPreorderVote('p-a')
      expect(r).toEqual({ ok: false, reason })
    }
  })

  it('error ไม่รู้จัก / รูปผิด / throw → load_failed', async () => {
    m.rpc.mockResolvedValue({ data: null, error: { message: 'SOMETHING_ELSE' } })
    expect(await castPreorderVote('p-a')).toEqual({ ok: false, reason: 'load_failed' })
    m.rpc.mockResolvedValue({ data: { weird: true }, error: null })
    expect(await castPreorderVote('p-a')).toEqual({ ok: false, reason: 'load_failed' })
    m.rpc.mockRejectedValue(new Error('network'))
    expect(await castPreorderVote('p-a')).toEqual({ ok: false, reason: 'load_failed' })
  })
})

describe('describeVoteIssue — ข้อความไทยครบทุกสถานะ (คู่สัญญา: ไม่มี string ว่าง)', () => {
  it('ครบทุก reason + ต่างกันทุกตัว', () => {
    const reasons = ['signed_out', 'disabled', 'limit', 'already', 'product_not_found', 'product_invalid', 'load_failed'] as const
    const msgs = reasons.map((r) => describeVoteIssue(r))
    for (const msg of msgs) {
      expect(msg.length).toBeGreaterThan(0)
      expect(msg).toContain('ค')
    }
    expect(new Set(msgs).size).toBe(reasons.length)
  })
})
