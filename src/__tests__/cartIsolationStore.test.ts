// ============================================
// Bite Me Baby — Cart Isolation Engine tests
// ============================================

import { describe, it, expect, beforeEach } from 'vitest'
import { useCartStore, type IsolationCartItem } from '@/stores/useCartStore'

const sameDayItem: IsolationCartItem = { id: 'p-1', name: 'ข้าวผัด', price: 50, quantity: 1, mode: 'SAME_DAY' }
const preItem: IsolationCartItem = { id: 'p-2', name: 'ทุเรียนชีสเค้ก', price: 120, quantity: 1, mode: 'PRE_ORDER' }

beforeEach(() => {
  useCartStore.getState().clearCart()
})

describe('useCartStore — Cart Isolation Engine', () => {
  it('sets the order mode on the first addToCart', () => {
    const res = useCartStore.getState().addToCart(sameDayItem, 'SAME_DAY')
    expect(res).toBe('added')
    expect(useCartStore.getState().order_mode).toBe('SAME_DAY')
    expect(useCartStore.getState().cartTotal).toBe(50)
  })

  it('appends matching-mode items without prompting', () => {
    useCartStore.getState().addToCart(sameDayItem, 'SAME_DAY')
    const res = useCartStore.getState().addToCart(
      { ...sameDayItem, id: 'p-2', name: 'ต้มยำ', price: 80 },
      'SAME_DAY',
    )
    expect(res).toBe('added')
    expect(useCartStore.getState().items).toHaveLength(2)
  })

  it('returns needs_confirmation and sets pendingMode on a mode mismatch', () => {
    useCartStore.getState().addToCart(sameDayItem, 'SAME_DAY')
    const res = useCartStore.getState().addToCart(preItem, 'PRE_ORDER')
    expect(res).toBe('needs_confirmation')
    const s = useCartStore.getState()
    expect(s.pendingMode).toBe('PRE_ORDER')
    // Cart not yet cleared — user hasn't approved.
    expect(s.items).toHaveLength(1)
    expect(s.order_mode).toBe('SAME_DAY')
  })

  it('keeps the current cart when the user cancels the switch', () => {
    useCartStore.getState().addToCart(sameDayItem, 'SAME_DAY')
    useCartStore.getState().addToCart(preItem, 'PRE_ORDER') // → needs_confirmation
    useCartStore.getState().cancelModeSwitch()
    const s = useCartStore.getState()
    expect(s.pendingMode).toBeNull()
    expect(s.order_mode).toBe('SAME_DAY')
    expect(s.items).toHaveLength(1)
  })

  it('clears the previous cart then switches mode when the user confirms', () => {
    useCartStore.getState().addToCart(sameDayItem, 'SAME_DAY')
    useCartStore.getState().addToCart(preItem, 'PRE_ORDER') // → needs_confirmation
    const before = useCartStore.getState().items.length
    expect(before).toBe(1)
    useCartStore.getState().confirmModeSwitch()
    const s = useCartStore.getState()
    expect(s.pendingMode).toBeNull()
    expect(s.order_mode).toBe('PRE_ORDER')
    expect(s.items).toHaveLength(0)
    expect(s.cartTotal).toBe(0)
  })

  it('addToCart is blocked while a switch is already pending', () => {
    useCartStore.getState().addToCart(sameDayItem, 'SAME_DAY')
    useCartStore.getState().addToCart(preItem, 'PRE_ORDER') // pending PRE_ORDER
    expect(useCartStore.getState().addToCart(sameDayItem, 'SAME_DAY')).toBe('needs_confirmation')
  })
})
