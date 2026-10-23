// ============================================
// Bite Me Baby — R3 (D-05): delivery round open/close guards + audit
// ============================================
// Guards: status whitelist ('active'|'closed') · template completeness before
// save · EVERY open/close/save/reset writes an audit entry (who/when/from→to)
import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/supabase', async () => {
  const { createSupabaseMock } = await import('./helpers/supabaseMock')
  return {
    supabase: createSupabaseMock(),
    supabaseAdmin: null,
    getCurrentUser: async () => null,
    isAdmin: async () => false,
    default: null,
  }
})
const audit = vi.hoisted(() => ({ writeAuditLog: vi.fn() }))
vi.mock('@/lib/auditLog', () => ({ writeAuditLog: audit.writeAuditLog }))

import { supabase } from '@/lib/supabase'
import {
  validateRoundTemplate,
  setRoundStatus,
  resetRoundCapacity,
  type DeliveryRoundRow,
} from '@/lib/bmbAdminApi_rounds'

function round(over: Partial<DeliveryRoundRow> = {}): DeliveryRoundRow {
  return {
    id: 'round-20991231-evening',
    round_key: 'evening',
    display_name: 'evening',
    cutoff_time: '16:00:00',
    delivery_start: '17:00:00',
    delivery_end: '20:00:00',
    max_capacity: 100,
    current_count: 0,
    scheduled_date: '2099-12-31',
    status: 'active',
    ...over,
  }
}

beforeEach(async () => {
  await (supabase as any).__reset?.()
  audit.writeAuditLog.mockReset()
})

describe('R3 (D-05) — validateRoundTemplate', () => {
  it('ครบถ้วน → ผ่าน', () => {
    expect(validateRoundTemplate(round())).toBeNull()
  })
  it('ขาด cutoff / capacity<=0 → ไม่ให้บันทึก', () => {
    expect(validateRoundTemplate(round({ cutoff_time: '' }))).toBeTruthy()
    expect(validateRoundTemplate(round({ delivery_start: 'xx' }))).toBeTruthy()
    expect(validateRoundTemplate(round({ max_capacity: 0 }))).toBeTruthy()
  })
})

describe('R3 (D-05) — open/close audit + whitelist', () => {
  it('status นอก whitelist → ไม่แตะ DB และไม่เขียน audit', async () => {
    expect(await setRoundStatus('round-x', 'weird')).toBe(false)
    expect(audit.writeAuditLog).not.toHaveBeenCalled()
  })

  it('เปิด/ปิดรอบ → audit entry ระบุ from→to เสมอ', async () => {
    await supabase.from('delivery_rounds').insert([round()])
    expect(await setRoundStatus('round-20991231-evening', 'closed')).toBe(true)
    expect(audit.writeAuditLog).toHaveBeenCalledTimes(1)
    const arg = audit.writeAuditLog.mock.calls[0][0]
    expect(arg.entity_type).toBe('delivery_round')
    expect(arg.entity_id).toBe('round-20991231-evening')
    expect(arg.metadata).toMatchObject({ from: 'active', to: 'closed' })
  })

  it('reset capacity → audit เสมอ', async () => {
    await supabase.from('delivery_rounds').insert([round()])
    expect(await resetRoundCapacity('round-20991231-evening')).toBe(true)
    expect(audit.writeAuditLog).toHaveBeenCalledTimes(1)
    expect(audit.writeAuditLog.mock.calls[0][0].entity_type).toBe('delivery_round')
  })
})