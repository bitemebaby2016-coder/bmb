// ============================================
// Bite Me Baby — WP2/WP3 Purchase Orders API wiring (Vitest)
// พิสูจน์ว่า API layer เรียก supabase.rpc ด้วย p_* params ที่ถูกต้อง
// (runtime จริงของ RPC พิสูจน์ใน e2e/contracts_wp2_224.sql บน Postgres จริง)
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

import {
  createPurchaseOrder,
  updatePurchaseOrder,
  submitPurchaseOrder,
  approvePurchaseOrder,
} from '@/lib/bmbAdminApi_purchaseOrders'

beforeEach(() => {
  rpcMock.mockReset()
  fromMock.mockReset()
})

describe('Purchase Orders API (WP2) — rpc wiring', () => {
  it('createPurchaseOrder ส่ง p_* params ครบถูกต้อง', async () => {
    rpcMock.mockResolvedValue({ data: { ok: true, po_id: 'po-1', po_number: 'PO-20261126-0001', status: 'draft' }, error: null })
    const res = await createPurchaseOrder({
      supplier_id: 'sup-1',
      lines: [{ supplier_product_id: 'sp-1', ordered_qty: 10, unit_price: 120 }],
      expected_date: '2026-12-01',
      notes: 'rush',
    })
    expect(res.ok).toBe(true)
    expect(rpcMock).toHaveBeenCalledWith('create_purchase_order', expect.objectContaining({
      p_supplier_id: 'sup-1',
      p_expected_date: '2026-12-01',
      p_notes: 'rush',
    }))
    const params = rpcMock.mock.calls[0][1]
    expect(Array.isArray(params.p_lines)).toBe(true)
    expect(params.p_lines[0].supplier_product_id).toBe('sp-1')
  })

  it('updatePurchaseOrder ส่ง p_version (optimistic lock)', async () => {
    rpcMock.mockResolvedValue({ data: { ok: true, po_id: 'po-1', version: 2 }, error: null })
    const res = await updatePurchaseOrder('po-1', 1, { notes: 'changed' })
    expect(res.version).toBe(2)
    expect(rpcMock).toHaveBeenCalledWith('update_purchase_order', expect.objectContaining({
      p_po_id: 'po-1',
      p_version: 1,
      p_notes: 'changed',
    }))
  })

  it('submitPurchaseOrder เรียก submit_purchase_order', async () => {
    rpcMock.mockResolvedValue({ data: { ok: true, status: 'submitted' }, error: null })
    const res = await submitPurchaseOrder('po-1')
    expect(res.status).toBe('submitted')
    expect(rpcMock).toHaveBeenCalledWith('submit_purchase_order', { p_po_id: 'po-1' })
  })

  it('approvePurchaseOrder เรียก approve_purchase_order', async () => {
    rpcMock.mockResolvedValue({ data: { ok: true, status: 'approved' }, error: null })
    const res = await approvePurchaseOrder('po-1')
    expect(res.status).toBe('approved')
    expect(rpcMock).toHaveBeenCalledWith('approve_purchase_order', { p_po_id: 'po-1' })
  })

  it('error จาก rpc ถูก throw (ไม่ swallow)', async () => {
    rpcMock.mockResolvedValue({ data: null, error: { message: 'ERR_FORBIDDEN' } })
    await expect(submitPurchaseOrder('po-x')).rejects.toThrow('ERR_FORBIDDEN')
  })
})