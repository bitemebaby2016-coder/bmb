// ============================================
// Bite Me Baby — Cart unification tests (R5c, Owner 2026-10-23)
// ============================================
// สัญญา: ตะกร้าเดียว = ออเดอร์เดียว
// - มีบรรทัด "จองล่วงหน้า" (เมนูจากปฏิทินแอดมิน) ≥ 1 → ทั้งตะกร้า = PRE_ORDER
//   (สินค้าทั่วไปติดไปกับรอบพรีออเดอร์ในออเดอร์เดียว รับพร้อมกันที่รอบนั้น)
// - ไม่มีเมนูปฏิทินในตะกร้า = SAME_DAY เท่านั้น (ไม่มีพรีออเดอร์วันอิสระ)
// - ไม่มีการสลับโหมด/ป๊อปอัปล้างตะกร้า (CartIsolationModal ถูกถอดออก)
// - ไม่มีการแยกเป็น 2 ออเดอร์ (m1 split engine ถูกถอดออก)

import { describe, it, expect, beforeEach } from 'vitest'
import { useCartStore, type IsolationCartItem } from '@/stores/useCartStore'
import { useCartStore as baseCart, deriveCartMode } from '@/store/cartStore'
import type { Product } from '@/types'

const sameDayItem: IsolationCartItem = { id: 'p-1', name: 'P-1', price: 50, quantity: 1, mode: 'SAME_DAY' }
const preItem: IsolationCartItem = { id: 'p-2', name: 'P-2', price: 120, quantity: 1, mode: 'PRE_ORDER' }

function product(id: string, over: Partial<Product> = {}): Product {
  return {
    id, name: id, price: 50, description: '', category_id: 'c', image_url: '',
    is_available: true, is_featured: false, is_preorder: false, prep_minutes: 5, sort_order: 1,
    created_at: '',
    ...over,
  } as Product
}

beforeEach(() => {
  useCartStore.getState().clearCart()
  baseCart.getState().clearCart()
})

describe('deriveCartMode (R5c) — โหมดออเดอร์ = ผลจากเนื้อตะกร้า', () => {
  it('ตะกร้าว่าง → null', () => {
    expect(deriveCartMode([])).toBeNull()
    expect(deriveCartMode(undefined as never)).toBeNull()
  })

  it('ไม่มีเมนูปฏิทิน (line ทั่วไปล้วน) → SAME_DAY — ไม่มีพรีออเดอร์วันอิสระ', () => {
    expect(deriveCartMode([{ line_mode: 'SAME_DAY' }, {}])).toBe('SAME_DAY')
  })

  it('มีบรรทัดจองล่วงหน้า ≥ 1 → PRE_ORDER ทั้งตะกร้า (สินค้าทั่วไปติดรอบพรีออเดอร์)', () => {
    expect(deriveCartMode([{ line_mode: 'SAME_DAY' }, { line_mode: 'PRE_ORDER' }])).toBe('PRE_ORDER')
  })
})

describe('useCartStore — ตะกร้าเดียว ไม่สลับโหมด ไม่ล้างตะกร้า', () => {
  it('addToCart ต่างโหมด → ทั้งสองบรรทัดอยู่ครบ ไม่มี pendingMode/ไม่ต้องยืนยัน', () => {
    expect(useCartStore.getState().addToCart(sameDayItem, 'SAME_DAY')).toBe('added')
    const res = useCartStore.getState().addToCart(preItem, 'PRE_ORDER')
    expect(res).toBe('added')
    const s = useCartStore.getState()
    expect(s.items).toHaveLength(2)
    expect((s.items[0] as { line_mode?: string }).line_mode).toBe('SAME_DAY')
    expect((s.items[1] as { line_mode?: string }).line_mode).toBe('PRE_ORDER')
  })

  it('มีบรรทัด PRE_ORDER → order_mode รวมเป็น PRE_ORDER ทั้งตะกร้า', () => {
    useCartStore.getState().addToCart(sameDayItem, 'SAME_DAY')
    useCartStore.getState().addToCart(preItem, 'PRE_ORDER')
    expect(useCartStore.getState().order_mode).toBe('PRE_ORDER')
  })

  it('ลบบรรทัด PRE_ORDER ออก → ตะกร้ากลับเป็น SAME_DAY อัตโนมัติ', () => {
    useCartStore.getState().addToCart(preItem, 'PRE_ORDER')
    expect(useCartStore.getState().order_mode).toBe('PRE_ORDER')
    useCartStore.getState().clearCart()
    useCartStore.getState().addToCart(sameDayItem, 'SAME_DAY')
    expect(useCartStore.getState().order_mode).toBe('SAME_DAY')
  })

  it("API ใหม่ไม่มี pendingMode/confirmModeSwitch (ป๊อปอัปล้างตะกร้าถูกถอดออก)", () => {
    const s = useCartStore.getState() as unknown as Record<string, unknown>
    expect(s.pendingMode).toBeUndefined()
    expect(s.confirmModeSwitch).toBeUndefined()
    expect(s.cancelModeSwitch).toBeUndefined()
    expect(baseCart.getState() as unknown as Record<string, unknown>).not.toHaveProperty('pendingMode')
  })
})

describe('cartStore.addItem — gate ฝั่ง client ยังอยู่ (server 025/142 = authority)', () => {
  it('context ต่างกัน → context_blocked (TEN-05)', () => {
    baseCart.getState().clearCart()
    baseCart.setState({ active_context_tenant_id: 't1', active_context_brand_id: 'b1' })
    expect(baseCart.getState().addItem(product('a'), 1, {}, 'SAME_DAY')).toBe('added')
    baseCart.setState({ active_context_tenant_id: 't2', active_context_brand_id: 'b2' })
    expect(baseCart.getState().addItem(product('b'), 1, {}, 'SAME_DAY')).toBe('context_blocked')
    baseCart.setState({ active_context_tenant_id: null, active_context_brand_id: null })
    baseCart.getState().clearCart()
  })
})