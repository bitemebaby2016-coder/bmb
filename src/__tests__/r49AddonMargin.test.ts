// ============================================
// Bite Me Baby — R49 · Add-on Margin + Admin rules + Notification DoD (Owner 2026-11-01)
//   ① addonMarginGuard = pure (promo/cost/sort/guard) — พฤติกรรมจริง
//   ② m181 = policy seed + addon_margin_setting + compute_addons_price promo + cap admin-driven
//   ③ m180 = cart_sessions + reminder_days · dispatcher = reminder ตามแอดมิน + abandoned cart จริง
//   ④ Prompt claymation + cross-sell strip + OrderBuilder sort + Admin card + audit
// ============================================
import { describe, it, expect } from 'vitest'
import {
  normalizeAddonMarginPolicy,
  effectiveAddonPrice,
  sortAddonsByMargin,
  addonMarginScore,
  evaluateAddonDiscountGuard,
  addonFloorPrice,
  DEFAULT_ADDON_MARGIN_POLICY,
} from '../lib/addonMarginGuard'
import guardSrc from '../lib/addonMarginGuard.ts?raw'
import mig181Src from '../../supabase/migrations/181_addon_margin_rules.sql?raw'
import mig180Src from '../../supabase/migrations/180_cart_sessions_reminder.sql?raw'
import dispatcherSrc from '../../supabase/functions/notification-dispatcher/index.ts?raw'
import policyCardSrc from '../components/admin/AddonMarginPolicyCard.tsx?raw'
import addonsEditorSrc from '../components/admin/AddonsEditor.tsx?raw'
import crossSellSrc from '../components/cart/AddonCrossSellStrip.tsx?raw'
import obmSrc from '../components/order/OrderBuilderModal.tsx?raw'
import promptSrc from '../components/notification/PushPermissionPrompt.tsx?raw'
import cartSyncSrc from '../lib/cartSessionSync.ts?raw'
import layoutSrc from '../components/layout/Layout.tsx?raw'
import mainSrc from '../main.tsx?raw'
import adminProductsSrc from '../pages/admin/AdminProducts.tsx?raw'
import checkoutSrc from '../pages/CheckoutPage.tsx?raw'
import cartPageSrc from '../pages/CartPage.tsx?raw'
import mig179Src from '../../supabase/migrations/179_notification_hub.sql?raw'

describe('R49-1 · addonMarginGuard = pure Profit Weight (promo/ต้นทุน/เรียง/กันส่วนลด)', () => {
  it('normalize = default เมื่อค่าหาย/ผิดรูป · clamps ตัวเลข 0-90', () => {
    expect(normalizeAddonMarginPolicy(null)).toEqual(DEFAULT_ADDON_MARGIN_POLICY)
    expect(normalizeAddonMarginPolicy({ max_discount_pct: 999, min_addon_margin_pct: -3 })).toMatchObject({ maxDiscountPct: 90, minAddonMarginPct: 0 })
    expect(normalizeAddonMarginPolicy({ main_dish_required: true, cross_sell_enabled: false })).toMatchObject({ mainDishRequired: true, crossSellEnabled: false })
  })

  it('effectiveAddonPrice = promo_price > 0 แทนราคาปกติ (กติกา a)', () => {
    expect(effectiveAddonPrice({ price: 15, promo_price: 10 })).toBe(10)
    expect(effectiveAddonPrice({ price: 15, promo_price: 0 })).toBe(15)
    expect(effectiveAddonPrice(null)).toBe(0)
  })

  it('margin score + sortAddonsByMargin = กำไรสูงสุดก่อน (มีต้นทุนคำนวณจริง · ไม่มีใช้ margin_weight)', () => {
    expect(addonMarginScore({ price: 20, cost: 10 })).toBe(50) // (20-10)/20
    expect(addonMarginScore({ price: 20, cost: 4, margin_weight: 0 })).toBe(80)
    expect(addonMarginScore({ price: 20, margin_weight: 33 })).toBe(33)
    const sorted = sortAddonsByMargin([
      { name: 'low', price: 10, cost: 8 },
      { name: 'weight', price: 10, margin_weight: 90 },
      { name: 'high', price: 10, cost: 1 },
    ])
    expect(sorted.map((a: { name: string }) => a.name)).toEqual(['weight', 'high', 'low'])
  })

  it('evaluateAddonDiscountGuard = จัดสรร pro-rata · เพดาน % (admin) · floor จากต้นทุน+min margin', () => {
    const p = normalizeAddonMarginPolicy({ max_discount_pct: 15, min_addon_margin_pct: 20 })
    // ยอด 100 มีแอดออน 40 · ส่วนลด 20 → จัดสรร 8 เข้าแอดออน · เพดาน 15%×40 = 6 → เกิน
    const r = evaluateAddonDiscountGuard(40, 0, 100, 20, p)
    expect(r.allowed).toBe(false)
    expect(r.allocated).toBe(8)
    expect(r.allowance).toBe(6)
    expect(r.message).toContain('เกินเพดาน 15%')
    // ไม่มีส่วนลด / ไม่มีแอดออน = ผ่านเสมอ
    expect(evaluateAddonDiscountGuard(40, 0, 100, 0, p).allowed).toBe(true)
    expect(evaluateAddonDiscountGuard(0, 0, 100, 20, p).allowed).toBe(true)
    // floor: ต้นทุน 24 min 20% → floor = 30 → allowance = min(6, 40-30=10) = 6
    expect(addonFloorPrice(24, 20)).toBe(30)
    expect(evaluateAddonDiscountGuard(40, 24, 100, 15, p).allowance).toBe(6)
    // policy ปิด = ไม่บังคับ
    expect(evaluateAddonDiscountGuard(40, 24, 100, 40, normalizeAddonMarginPolicy({ enabled: false })).allowed).toBe(true)
  })

  it('guard source = pure (ไม่ยิง network) + มีคำอธิบายสัญญา', () => {
    expect(guardSrc).not.toContain('fetch(')
    expect(guardSrc).toContain('Profit Weight')
    expect(guardSrc).toContain('addon_margin_policy')
  })
})
// MARKER_R49_B