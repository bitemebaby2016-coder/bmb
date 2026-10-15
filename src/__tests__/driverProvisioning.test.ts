// ============================================
// Driver provisioning (Owner Decision 06 / F-06) — client contract tests
//
// Proves the CLIENT contract of upsert_driver / link_driver_user / the
// drivers account read used by the Admin Provision UI (DeliveryManagement):
//   - RPC name/args are sent exactly as migrations 020/041 define them
//   - server rejections surface as typed errors, never fabricated success
//   - getDriverAccounts is a READ-ONLY scoped select (no write path)
// RLS/authority (is_admin gating, ERR_USER_ALREADY_LINKED, JWT binding) are
// enforced server-side — these tests cover the client wiring only.
// ============================================

import { describe, it, expect, vi, beforeEach } from 'vitest'

const rpcMock = vi.fn()
const fromSelectMock = vi.fn()

vi.mock('@/lib/supabase', () => ({
  supabase: {
    rpc: (...args: unknown[]) => rpcMock(...args),
    from: (table: string) => ({ select: (cols: string) => fromSelectMock(table, cols) }),
  },
  default: null,
}))

import { upsertDriver, linkDriverUser, getDriverAccounts, driverErrorText } from '@/lib/driverService'

describe('driver provisioning (upsert_driver / link_driver_user)', () => {
  beforeEach(() => { rpcMock.mockReset(); fromSelectMock.mockReset() })

  it('upsertDriver sends the exact RPC name + args from migration 020', async () => {
    rpcMock.mockResolvedValue({ data: { ok: true, driver_id: 'drv-1', phone: '0900000001' }, error: null })
    const r = await upsertDriver('QA Rider', '0900000001', 'bike')
    expect(r.ok).toBe(true)
    expect(r.driver_id).toBe('drv-1')
    expect(rpcMock).toHaveBeenCalledWith('upsert_driver', {
      p_name: 'QA Rider',
      p_phone: '0900000001',
      p_vehicle_label: 'bike',
    })
  })

  it('upsertDriver surfaces a server rejection as a typed error (never a fake success)', async () => {
    rpcMock.mockResolvedValue({ data: null, error: { code: 'ERR_MISSING_DRIVER_INFO', message: 'ERR_MISSING_DRIVER_INFO' } })
    const r = await upsertDriver('', '')
    expect(r.ok).toBe(false)
    expect(r.error).toBe('ERR_MISSING_DRIVER_INFO')
    expect(r.driver_id).toBeUndefined()
  })

  it('upsertDriver rejects a data payload without driver_id (ERR_UPSERT_REJECTED)', async () => {
    rpcMock.mockResolvedValue({ data: { ok: true }, error: null })
    const r = await upsertDriver('X', '0900000002')
    expect(r.ok).toBe(false)
    expect(r.error).toBe('ERR_UPSERT_REJECTED')
  })

  it('linkDriverUser sends the exact RPC name + args from migration 041', async () => {
    rpcMock.mockResolvedValue({ data: { ok: true, driver_id: 'drv-1', user_id: 'auth-user-1' }, error: null })
    const r = await linkDriverUser('drv-1', 'auth-user-1')
    expect(r.ok).toBe(true)
    expect(rpcMock).toHaveBeenCalledWith('link_driver_user', {
      p_driver_id: 'drv-1',
      p_user_id: 'auth-user-1',
    })
  })

  it('linkDriverUser surfaces ERR_USER_ALREADY_LINKED without hiding the reason', async () => {
    rpcMock.mockResolvedValue({ data: null, error: { code: 'ERR_USER_ALREADY_LINKED', message: 'ERR_USER_ALREADY_LINKED' } })
    const r = await linkDriverUser('drv-1', 'auth-user-1')
    expect(r.ok).toBe(false)
    expect(r.error).toBe('ERR_USER_ALREADY_LINKED')
  })
})

describe('getDriverAccounts (READ-ONLY provisioning lookup)', () => {
  beforeEach(() => { rpcMock.mockReset(); fromSelectMock.mockReset() })

  it('reads drivers with the scoped select and returns the rows', async () => {
    fromSelectMock.mockResolvedValue({
      data: [{ id: 'drv-1', name: 'Rider', user_id: null, status: 'offline' }],
      error: null,
    })
    const rows = await getDriverAccounts()
    expect(fromSelectMock).toHaveBeenCalledWith('drivers', 'id, name, user_id, status')
    expect(rows).toEqual([{ id: 'drv-1', name: 'Rider', user_id: null, status: 'offline' }])
  })

  it('returns [] on read failure (never invents rows)', async () => {
    fromSelectMock.mockResolvedValue({ data: null, error: { message: 'ERR_RLS' } })
    expect(await getDriverAccounts()).toEqual([])
  })
})

describe('driverErrorText (ข้อความ error ภาษาไทย — ไม่โชว์รหัสระบบ)', () => {
  it('แปลงรหัส ERR_* ที่รู้จักเป็นภาษาไทย', () => {
    expect(driverErrorText('ERR_MISSING_DRIVER_INFO')).toContain('กรอกข้อมูลไม่ครบ')
    expect(driverErrorText('ERR_USER_ALREADY_LINKED')).toContain('ผูกกับไรเดอร์คนอื่นแล้ว')
    expect(driverErrorText('PGRST301: ERR_FORBIDDEN')).toContain('ไม่มีสิทธิ์')
  })

  it('แปลง error ของฐานข้อมูล (23502 null value) เป็นข้อความเรื่องสาขา', () => {
    expect(driverErrorText('null value in column "home_branch_id" (23502)')).toContain('สาขา')
  })

  it('error ที่ไม่รู้จัก → ตัดให้สั้นพออ่านได้ ไม่ว่างเปล่า', () => {
    const long = 'X'.repeat(200)
    const out = driverErrorText(long)
    expect(out.length).toBeLessThanOrEqual(91)
    expect(driverErrorText('')).toContain('ลองใหม่')
  })
})