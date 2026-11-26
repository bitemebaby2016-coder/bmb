// ============================================
// Bite Me Baby — WP4/WP5 Goods Receipts API wiring (Vitest)
// พิสูจน์ว่า API layer เรียก supabase.rpc ด้วย p_* params ที่ถูกต้อง
// (runtime จริง พิสูจน์ใน e2e/contracts_wp4_225.sql บน Postgres จริง)
// ============================================

import { describe, it, expect, vi, beforeEach } from 'vitest'

const rpcMock = vi.fn()
const fromMock = vi.fn()

vi.mock('@/lib/supabase', () => ({
  supabase: {
    rpc: (...args: any[]) => rpcMock(...args),
    from: (...args: any[]) => fromMock(...args),
  },
  supabaseAdmin: null,
  getCurrentUser: async () => null,
  isAdmin: async () => false,
  default: null,
}))

import { createGrnDraft, approveGrn } from '@/lib/bmbAdminApi_goodsReceipts'

beforeEach(() => {
  rpcMock.mockReset()
  fromMock.mockReset()
})

describe('Goods Receipts API (WP4) — rpc wiring', () => {
  it('createGrnDraft ส่ง p_po_id + p_lines', async () => {
    rpcMock.mockResolvedValue({ data: { ok: true, grn_id: 'grn-1', grn_number: 'GRN-20261126-0001', status: 'draft' }, error: null })
    const res = await createGrnDraft({
      po_id: 'po-1',
      lines: [{ po_line_id: 'pol-1', received_qty: 5, accepted_qty: 4, rejected_qty: 1 }],
      notes: 'partial',
    })
    expect(res.ok).toBe(true)
    expect(rpcMock).toHaveBeenCalledWith('create_grn_draft', expect.objectContaining({
      p_po_id: 'po-1',
      p_notes: 'partial',
    }))
    const params = rpcMock.mock.calls[0][1]
    expect(Array.isArray(params.p_lines)).toBe(true)
    expect(params.p_lines[0].po_line_id).toBe('pol-1')
  })

  it('approveGrn เรียก approve_grn', async () => {
    rpcMock.mockResolvedValue({ data: { ok: true, status: 'approved' }, error: null })
    const res = await approveGrn('grn-1')
    expect(res.status).toBe('approved')
    expect(rpcMock).toHaveBeenCalledWith('approve_grn', { p_grn_id: 'grn-1' })
  })

  it('error จาก rpc ถูก throw', async () => {
    rpcMock.mockResolvedValue({ data: null, error: { message: 'ERR_OVER_RECEIVE' } })
    await expect(approveGrn('grn-x')).rejects.toThrow('ERR_OVER_RECEIVE')
  })
})