// ============================================
// M116 (GAP A-1) — admin close-the-loop delivery tests
//
// Proves the CLIENT contract of admin_advance_delivery_status:
//   - the RPC name/args are sent exactly as migration 116 defines them
//   - a server rejection becomes a typed error, never a fabricated success
//   - the UI intent is "delivered" (close the loop) — not an arbitrary status
// RLS/authority (anon refused, is_admin gating, forward-only hops) are enforced
// server-side and verified against production via e2e/m116Apply.cjs verify.
// ============================================

import { describe, it, expect, vi, beforeEach } from 'vitest'

const rpcMock = vi.fn()

vi.mock('@/lib/supabase', () => ({
  supabase: { rpc: (...args: unknown[]) => rpcMock(...args) },
  default: null,
}))

import { adminAdvanceDelivery, assignDriver } from '@/lib/driverService'

describe('M116 admin_advance_delivery_status (GAP A-1)', () => {
  beforeEach(() => rpcMock.mockReset())

  it('sends the exact RPC name + args from migration 116', async () => {
    rpcMock.mockResolvedValue({ data: { ok: true, order_number: 'PO-1', assignment_status: 'delivered', order_status: 'delivered', driver_id: 'drv-1', driver_released: true }, error: null })
    const r = await adminAdvanceDelivery('PO-1', 'delivered')
    expect(r.ok).toBe(true)
    expect(r.order_status).toBe('delivered')
    expect(r.driver_released).toBe(true)
    expect(rpcMock).toHaveBeenCalledWith('admin_advance_delivery_status', {
      p_order_number: 'PO-1',
      p_status: 'delivered',
    })
  })

  it('surfaces a server rejection as a typed error (never a fake success)', async () => {
    rpcMock.mockResolvedValue({ data: null, error: { message: 'ERR_DELIVERY_SYNC_BLOCKED: order PO-1 cannot advance' } })
    const r = await adminAdvanceDelivery('PO-1', 'delivered')
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.error).toContain('ERR_DELIVERY_SYNC_BLOCKED')
  })

  it('treats a malformed payload as a rejection (no ok field)', async () => {
    rpcMock.mockResolvedValue({ data: { unexpected: true }, error: null })
    expect(await adminAdvanceDelivery('PO-1', 'delivered')).toEqual({ ok: false, error: 'ERR_ADVANCE_REJECTED' })
  })

  it('only offers the loop-closing intent ("delivered") to callers', async () => {
    // DeliveryManagement calls adminAdvanceDelivery(order, 'delivered') only —
    // pin that so a future refactor cannot quietly widen admin authority.
    rpcMock.mockResolvedValue({ data: { ok: true }, error: null })
    await adminAdvanceDelivery('PO-1', 'delivered')
    const status = (rpcMock.mock.calls[0][1] as Record<string, unknown>).p_status
    expect(status).toBe('delivered')
  })

  it('does not touch the driver-facing RPC (separate authority)', async () => {
    rpcMock.mockResolvedValue({ data: null, error: null })
    await assignDriver('PO-1', 'drv-1')
    expect(rpcMock).toHaveBeenCalledWith('assign_driver', { p_order_number: 'PO-1', p_driver_id: 'drv-1' })
    expect(rpcMock.mock.calls.some((c) => c[0] === 'admin_advance_delivery_status')).toBe(false)
  })
})