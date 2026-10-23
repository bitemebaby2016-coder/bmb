// ============================================
// Bite Me Baby — CAT-02: order-time schedule gate (canonical create_order path)
// (mirrors migration 039 trg_menu_gate + trg_operating_hours in supabaseMock)
// ============================================

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

import { supabase } from '@/lib/supabase'
import { setMenuSchedule, publishMenuSchedule } from '@/lib/bmbMenuSchedule'

const TOMORROW = new Date(Date.now() + 86400000).toISOString().slice(0, 10)

beforeEach(async () => {
  await (supabase as any).__reset?.()
  ;(supabase as any).__setNoAdmin?.(false)
})

describe('CAT-02 · order-time gate via canonical create_order path (mock mirror)', () => {

  function futureRound() {
    const r = (supabase as any).__tables.delivery_rounds.find((x: any) => x.id === 'round-1')
    r.scheduled_date = TOMORROW
    r.date = TOMORROW
    return r
  }
  const preOrder = (productId: string) => (supabase as any).rpc('create_order_with_items', {
    p_order_mode: 'PRE_ORDER',
    p_delivery_round_id: 'round-1',
    p_scheduled_date: TOMORROW,
    p_customer_name: 'QA',
    p_customer_phone: '0900000000',
    p_items: [{ product_id: productId, quantity: 1, options: {} }],
  })

  it('control: published schedule day, on-menu product → order created', async () => {
    futureRound()
    await setMenuSchedule(TOMORROW, [{ product_id: 'prod-1' }, { product_id: 'prod-5' }])
    await publishMenuSchedule(TOMORROW, true)
    const res = await preOrder('prod-1')
    expect(res.error).toBeNull()
    expect(res.data.order_number).toBeTruthy()
  })

  it('R5/141: off-menu product on a published-schedule day → created (ส่งร่วมรอบเดียวกับเมนูพรีออเดอร์ได้)', async () => {
    futureRound()
    await setMenuSchedule(TOMORROW, [{ product_id: 'prod-1' }, { product_id: 'prod-5' }])
    await publishMenuSchedule(TOMORROW, true)
    const res = await preOrder('prod-2')
    expect(res.error).toBeNull()
    expect(res.data?.order_number).toBeTruthy()
  })

  it('R5/141: menu product ผูกวันอื่น → ERR_PRODUCT_NOT_ON_MENU (วันถูกกำหนดโดยปฏิทินแอดมิน)', async () => {
    const dayAfter = new Date(Date.now() + 2 * 86400000).toISOString().slice(0, 10)
    const r = (supabase as any).__tables.delivery_rounds.find((x: any) => x.id === 'round-1')
    r.scheduled_date = dayAfter
    r.date = dayAfter
    await setMenuSchedule(dayAfter, [{ product_id: 'prod-1' }, { product_id: 'prod-5' }])
    await publishMenuSchedule(dayAfter, true)
    const ok = await (supabase as any).rpc('create_order_with_items', {
      p_order_mode: 'PRE_ORDER', p_delivery_round_id: 'round-1', p_scheduled_date: dayAfter,
      p_customer_name: 'QA', p_customer_phone: '0900000000',
      p_items: [{ product_id: 'prod-1', quantity: 1, options: {} }],
    })
    expect(ok.error).toBeNull()
    futureRound()
    const res = await preOrder('prod-1')
    expect(res.error?.code).toBe('ERR_PRODUCT_NOT_ON_MENU')
  })

  it('mode closed via operating_hours → ERR_ORDER_MODE_CLOSED', async () => {
    futureRound()
    ;((supabase as any).__tables.business_settings ||= []).push({ key: 'operating_hours', value: { pre_order_open: false } })
    const res = await preOrder('prod-1')
    expect(res.error?.code).toBe('ERR_ORDER_MODE_CLOSED')
  })

  it('round closed via operating_hours → ERR_ROUND_CLOSED', async () => {
    futureRound()
    ;((supabase as any).__tables.business_settings ||= []).push({ key: 'operating_hours', value: { morning_open: false } })
    const res = await preOrder('prod-1')
    expect(res.error?.code).toBe('ERR_ROUND_CLOSED')
  })
})
