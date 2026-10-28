// ============================================
// Bite Me Baby — R14 tests: kitchen batch loop (Owner 2026-10-28)
// 1) ตาราง Batch: id เต็ม + "สร้างเมื่อ" ไม่มี Invalid Date
// 2) createBatch ต้องคืนเหตุผลจริงเมื่อล้มเหลว (ห้าม null เงียบ ๆ)
// ============================================

import { describe, it, expect, vi, beforeEach } from 'vitest'

const { rpcMock } = vi.hoisted(() => ({ rpcMock: vi.fn() }))
vi.mock('@/lib/supabase', () => ({ supabase: { rpc: rpcMock } }))

import { createBatch } from '@/lib/bmbAdminApi_kitchen'
import { batchIdLabel, formatBatchCreatedAt } from '@/lib/kitchenQueueView'

describe('batchIdLabel (ตาราง Batch หน้าครัว)', () => {
  it('shows the full id (new format batch-<epoch_ms>-<md5>)', () => {
    expect(batchIdLabel('batch-1793171326893-a71448')).toBe('batch-1793171326893-a71448')
  })

  it('keeps legacy hash ids visible as-is (rows created before 167)', () => {
    expect(batchIdLabel('batch- ###########-a71448')).toBe('batch- ###########-a71448')
  })

  it('returns — for null/undefined/blank (never renders "undefined")', () => {
    expect(batchIdLabel(null)).toBe('—')
    expect(batchIdLabel(undefined)).toBe('—')
    expect(batchIdLabel('   ')).toBe('—')
  })
})

describe('formatBatchCreatedAt (กัน Invalid Date)', () => {
  it('formats a real ISO timestamp in th-TH (Buddhist year)', () => {
    const s = formatBatchCreatedAt('2026-10-28T07:09:46.893504+00:00')
    expect(s).not.toBe('—')
    expect(s).toMatch(/2569/)
  })

  it('returns — when the RPC does not send created_at (the 167 bug) or the value is broken', () => {
    expect(formatBatchCreatedAt(undefined)).toBe('—')
    expect(formatBatchCreatedAt(null)).toBe('—')
    expect(formatBatchCreatedAt('')).toBe('—')
    expect(formatBatchCreatedAt('Invalid Value')).toBe('—')
  })
})

describe('createBatch (ต้องไม่ fail เงียบ)', () => {
  beforeEach(() => rpcMock.mockReset())

  it('returns ok + full batch_id on success (3 named params to the RPC)', async () => {
    rpcMock.mockResolvedValue({ data: { batch_id: 'batch-1793171326893-a71448', items_count: 3 }, error: null })
    const r = await createBatch('round-20261028-evening', '2026-10-28')
    expect(r.ok).toBe(true)
    expect(r.batch_id).toBe('batch-1793171326893-a71448')
    expect(r.items_count).toBe(3)
    expect(rpcMock).toHaveBeenCalledWith('create_production_batch', {
      p_delivery_round_id: 'round-20261028-evening',
      p_scheduled_date: '2026-10-28',
      p_order_mode: null,
    })
  })

  it('surfaces the SERVER error message (เดิม return null = toast ไม่บอกเหตุ)', async () => {
    rpcMock.mockResolvedValue({ data: null, error: { message: 'ERR_FORBIDDEN' } })
    const r = await createBatch('round-x', '2026-10-28')
    expect(r.ok).toBe(false)
    expect(r.error).toBe('ERR_FORBIDDEN')
  })

  it('fails loudly when the RPC returns no batch_id', async () => {
    rpcMock.mockResolvedValue({ data: { ok: true }, error: null })
    const r = await createBatch('round-x', '2026-10-28')
    expect(r.ok).toBe(false)
    expect(r.error).toContain('batch_id')
  })
})