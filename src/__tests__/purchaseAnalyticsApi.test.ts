// ============================================
// Bite Me Baby — WP7/WP8 read API wiring (Vitest)
// พิสูจน์ว่า API layer เรียก rpc ด้วย p_* params ถูกต้อง
// (runtime + RLS พิสูจน์ใน e2e/contracts_wp7_wp8_227_228.sql)
// ============================================

import { describe, it, expect, vi, beforeEach } from 'vitest'

const rpcMock = vi.fn()
vi.mock('@/lib/supabase', () => ({
  supabase: { rpc: (...a: any[]) => rpcMock(...a), from: vi.fn() },
  supabaseAdmin: null, getCurrentUser: async () => null, isAdmin: async () => false, default: null,
}))

import { getPurchasePriceHistory, getPoDashboard } from '@/lib/bmbAdminApi_purchaseAnalytics'

beforeEach(() => rpcMock.mockReset())

describe('Purchase Analytics API (WP7/WP8) — rpc wiring', () => {
  it('getPurchasePriceHistory ส่ง p_* filter', async () => {
    rpcMock.mockResolvedValue({ data: [{ id: 1 }], error: null })
    const rows = await getPurchasePriceHistory({ ingredientId: 'inv-1', priceType: 'realized', limit: 50 })
    expect(rows.length).toBe(1)
    expect(rpcMock).toHaveBeenCalledWith('get_purchase_price_history', expect.objectContaining({
      p_ingredient_id: 'inv-1', p_price_type: 'realized', p_limit: 50,
    }))
  })

  it('getPoDashboard ส่ง p_* params', async () => {
    rpcMock.mockResolvedValue({ data: { total_spend: 1000 }, error: null })
    const d = await getPoDashboard({ supplierId: 'sup-1' })
    expect(d?.total_spend).toBe(1000)
    expect(rpcMock).toHaveBeenCalledWith('get_po_dashboard', expect.objectContaining({ p_supplier_id: 'sup-1' }))
  })

  it('error → returns [] / null (no throw)', async () => {
    rpcMock.mockResolvedValue({ data: null, error: { message: 'boom' } })
    expect(await getPurchasePriceHistory()).toEqual([])
    expect(await getPoDashboard()).toBeNull()
  })
})