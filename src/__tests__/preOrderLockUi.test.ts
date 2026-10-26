// ============================================
// L-8 (N-4 #8 · Owner 2026-10-26): พรีออเดอร์ยังไม่ถึง/เลยรอบสั่ง = สีเทากดไม่ได้ (btn-locked)
//   ครบทุกจุดที่โชว์ปุ่มจอง + gate handlePreOrder/addItem ทุกจุดเข้า = toast เดียวกัน
// ============================================
import { describe, it, expect } from 'vitest'

import cssSrc from '../index.css?raw'
import homeCardSrc from '../components/home/HomeProductCard.tsx?raw'
import categorySectionsSrc from '../components/home/CategorySections.tsx?raw'
import foodMenuCardSrc from '../components/FoodMenuCard.tsx?raw'
import homePageSrc from '../pages/HomePage.tsx?raw'
import menuPageSrc from '../pages/MenuPage.tsx?raw'
import foodTheaterSrc from '../components/theater/FoodTheater.tsx?raw'
import talkToBiteSrc from '../components/ai/TalkToBite.tsx?raw'
import cartPageSrc from '../pages/CartPage.tsx?raw'

describe('L-8 — ปุ่มจองสีเทากดไม่ได้ + gate ทุกจุดเข้า (source invariants)', () => {
  it('CSS: .btn-locked มีอยู่จริง (สีเทา + not-allowed + pointer-events none)', () => {
    expect(cssSrc).toContain('.btn-locked {')
    expect(cssSrc).toContain('cursor: not-allowed;')
    expect(cssSrc).toContain('pointer-events: none;')
  })

  it('HomeProductCard: disabled → เพิ่ม class btn-locked (สีเทา) + disabled attr', () => {
    expect(homeCardSrc).toContain('const disabledCta = soldOut || (isPreOrderCta && !preOrderReady)')
    expect(homeCardSrc).toContain("disabledCta ? ' btn-locked' : ' btn-primary'")
    expect(homeCardSrc).toContain('disabled={disabledCta}')
  })

  it('ShowcaseCard (CategorySections):  branch ยังไม่ลงปฏิทิน = btn-locked', () => {
    expect(categorySectionsSrc).toContain('data-testid="home-showcase-preorder-unavailable"')
    expect(categorySectionsSrc).toContain('btn btn-outline btn-sm w-full btn-locked')
  })

  it('FoodMenuCard: ทุก branch ที่กดไม่ได้ = disabled + btn-locked', () => {
    expect(foodMenuCardSrc).toContain('btn-locked')
    expect(foodMenuCardSrc).toContain('type="button" disabled data-testid="pre-order-btn-unavailable"')
    expect(foodMenuCardSrc).toContain('preorderExpired ? \'btn-locked\'')
  })

  it('gate ทุกจุดเข้า PRE_ORDER: HomePage + MenuPage handlePreOrder + FoodTheater add/customize + TalkToBite addToCart + review CTA = toast เดียวกัน', () => {
    const gateToast = 'เมนูนี้ยังไม่ลงปฏิทินรอบถัดไป — ยังจองไม่ได้'
    expect(homePageSrc).toContain(gateToast)
    expect(menuPageSrc).toContain(gateToast)
    expect(foodTheaterSrc).toContain(gateToast)
    expect(talkToBiteSrc).toContain(gateToast)
    // review CTA (handleReviewCta) ก็เช็ค scheduleMap ก่อน addItem PRE_ORDER
    expect(homePageSrc).toContain("if (isPre && !scheduleMap[product.id])")
    // handlePreOrder ทั้งสองหน้าเช็ค deriveOrderMode + scheduleMap ก่อนเข้า builder
    expect(homePageSrc).toContain("deriveOrderMode(preProduct) === 'PRE_ORDER' && !scheduleMap[preProduct.id]")
    expect(menuPageSrc).toContain("deriveOrderMode(preProduct) === 'PRE_ORDER' && !scheduleMap[preProduct.id]")
    expect(foodTheaterSrc).toContain("if (mode === 'PRE_ORDER' && !schedule[p.id])")
    expect(talkToBiteSrc).toContain('getProductScheduleMap()')
  })

  it('CartPage: บรรทัดค้าง = สีเทา + ปุ่ม +/- ปิด + ปุ่ม checkout กดไม่ได้ + คำเตือน', () => {
    expect(cartPageSrc).toContain('const isStalePreOrderLine')
    expect(cartPageSrc).toContain('const hasStalePreOrder')
    expect(cartPageSrc).toContain("stale ? 'cart-line-stale' : undefined")
    expect(cartPageSrc).toContain('disabled={stale}')
    expect(cartPageSrc).toContain('data-testid="cart-stale-warning"')
    expect(cartPageSrc).toContain('aria-disabled={hasStalePreOrder}')
    expect(cartPageSrc).toContain('if (hasStalePreOrder) e.preventDefault()')
    expect(cartPageSrc).toContain("hasStalePreOrder ? ' btn-locked'")
    expect(cartPageSrc).toContain('getProductScheduleMap')
  })

  it('gate กันไว้ 2 ชั้น: FoodTheater.customize PRE_ORDER branch เช็ค schedule ก่อนเรียก onPreOrder', () => {
    expect(foodTheaterSrc).toContain('// L-8: pre-order-only ที่ยังไม่ลงปฏิทิน → ห้ามเปิด builder จอง')
    expect(foodTheaterSrc).toContain('if (!schedule[p.id])')
  })
})