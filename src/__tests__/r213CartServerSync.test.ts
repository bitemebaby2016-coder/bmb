// ============================================
// BMB — R103 Server-side Cart Sync (Owner 2026-11-24)
// ============================================
// ต่อยอด m180 (telemetry) → เก็บ "เนื้อตะกร้าจริง" ลง cart_sessions.payload
// เพื่อ restore ข้ามเครื่องสำหรับลูกค้าที่ล็อกอิน:
//   ① migration 213 = ADD COLUMN payload JSONB + RLS SELECT เจ้าของตัวเอง (m180 ขาด)
//   ② cartSessionSync = upsert payload (deterministic id csa-<customerId> = 1 แถว/1 คน)
//      + fetchLatestServerCart สำหรับ restore · guest ยังไม่ยิง (R63)
//   ③ cartPersistence = restore server เฉพาะเมื่อ local ไม่มีรายการ (local ชนะ)
//      และต้องเสร็จก่อน setHydrated (Layout ?cart= รอ isHydrated — ลำดับ deterministic)
// payload = รูปเดียวกับ localStorage bmb-cart-v1 — ไม่มีราคา/ยอดรวม/PII
// ============================================

import { describe, it, expect } from 'vitest'
import { parseStoredCart, serializeCartObject } from '../lib/cartPersistence'
import type { Product } from '../types'

import mig213Src from '../../supabase/migrations/213_cart_sessions_payload.sql?raw'
import cartSyncSrc from '../lib/cartSessionSync.ts?raw'
import cartPersistenceSrc from '../lib/cartPersistence.ts?raw'
import mainSrc from '../main.tsx?raw'

// ============================================
// A — Migration 213: payload column + SELECT-own RLS (additive, re-run safe)
// ============================================
describe('R103-A — migration 213: payload + select_own', () => {
  it('เพิ่ม payload JSONB แบบ IF NOT EXISTS (additive — ไม่แตะ column เดิม)', () => {
    expect(mig213Src).toMatch(/ADD COLUMN IF NOT EXISTS payload JSONB/)
  })

  it('มี RLS SELECT ให้เจ้าของตัวเอง — เงื่อนไข mirror insert_own/update_own ของ m180', () => {
    expect(mig213Src).toMatch(/CREATE POLICY cart_sessions_select_own ON public\.cart_sessions/)
    expect(mig213Src).toMatch(/FOR SELECT TO authenticated/)
    expect(mig213Src).toMatch(
      /USING \(customer_id IS NULL OR customer_id IN \(SELECT id FROM public\.customers WHERE user_id = auth\.uid\(\)\)\)/,
    )
  })

  it('ไม่ลบ/แตะ policy เดิมของ m180 (deny_anon/insert_own/update_own/admin_all คงอยู่)', () => {
    expect(mig213Src).not.toMatch(/DROP POLICY IF EXISTS (cart_sessions_deny_anon|cart_sessions_insert_own|cart_sessions_update_own|cart_sessions_admin_all)/)
    expect(mig213Src).not.toMatch(/DROP TABLE|DROP COLUMN/)
  })
})

// ============================================
// B — cartSessionSync: payload upsert + deterministic id + fetch
// ============================================
describe('R103-B — cartSessionSync: เก็บเนื้อตะกร้าจริง (ล็อกอินเท่านั้น)', () => {
  it('guest guard คงเดิม (R63/r49 pin): !uid ต้องอยู่ก่อน upsert', () => {
    expect(cartSyncSrc).toContain('if (!uid) return')
    expect(cartSyncSrc.indexOf('if (!uid) return')).toBeLessThan(cartSyncSrc.indexOf('.upsert('))
  })

  it('deterministic id = csa-<customerId> — 1 แถว/1 ลูกค้า ข้ามเครื่อง upsert แถวเดิม', () => {
    expect(cartSyncSrc).toContain("id: 'csa-' + customerId")
    // onConflict id คงเดิม (r49 pin)
    expect(cartSyncSrc).toContain("{ onConflict: 'id' }")
    // customer lookup ยังอยู่ (r49 pin) + มี cache (ห้าม query ทุกครั้ง)
    expect(cartSyncSrc).toContain("from('customers').select('id')")
    expect(cartSyncSrc).toMatch(/cachedIdentity/)
  })

  it('upsert พาเนื้อตะกร้าจริง (serializeCartObject) · ตะกร้าว่าง = payload null', () => {
    expect(cartSyncSrc).toContain('payload: count === 0 ? null : serializeCartObject(state)')
  })

  it('fetchLatestServerCart: guard !uid → null · select payload ตาม customer_id · ผ่าน parseStoredCart (strict validate)', () => {
    expect(cartSyncSrc).toMatch(/export async function fetchLatestServerCart/)
    // ค้นภายในขอบเขต fetchLatestServerCart เท่านั้น (syncCartSessionNow มี .from('cart_sessions') ของตัวเองก่อนหน้า)
    const atFn = cartSyncSrc.indexOf('export async function fetchLatestServerCart')
    const atGuard = cartSyncSrc.indexOf('if (!uid) return null', atFn)
    const atSelect = cartSyncSrc.indexOf(".from('cart_sessions')", atFn)
    expect(atGuard).toBeGreaterThan(atFn)
    expect(atSelect).toBeGreaterThan(atGuard)
    expect(cartSyncSrc).toMatch(/\.eq\('customer_id', customerId\)/)
    expect(cartSyncSrc).toMatch(/\.order\('updated_at', \{ ascending: false \}\)/)
    expect(cartSyncSrc).toContain("parseStoredCart(JSON.stringify(row.payload))")
  })

  it('ไม่มีราคา/ยอดรวมหลุดเข้า payload (total_amount = telemetry เดิมแยก field · payload = ids เท่านั้น)', () => {
    // payload ต้องมาจาก serializeCartObject เท่านั้น — ห้ามประกอบเองในไฟล์นี้
    expect(cartSyncSrc).toContain('serializeCartObject(state)')
    // total_amount ยังเป็น telemetry field เดิม (นอก payload)
    expect(cartSyncSrc).toMatch(/total_amount: Math\.round\(\(Number\(state\.subtotal\) \|\| 0\) \* 100\) \/ 100/)
  })
})

// ============================================
// C — cartPersistence: restore server เฉพาะ local ว่าง + ก่อน setHydrated
// ============================================
describe('R103-C — cartPersistence: กฎ restore เดียว (local ชนะ) + ลำดับ hydration', () => {
  it('server restore ถูกกันด้วย !stored || stored.items.length === 0 (local มีของ = ไม่แตะ server)', () => {
    expect(cartPersistenceSrc).toMatch(/if \(!stored \|\| stored\.items\.length === 0\) \{/)
    expect(cartPersistenceSrc).toContain('fetchLatestServerCart')
  })

  it('ลำดับ: fetchLatestServerCart เกิดก่อน setHydrated (Layout ?cart= รอ isHydrated — restore ต้องจบก่อน)', () => {
    const atFetch = cartPersistenceSrc.indexOf('fetchLatestServerCart')
    const atHydrated = cartPersistenceSrc.indexOf('useCartStore.getState().setHydrated()')
    expect(atFetch).toBeGreaterThan(-1)
    expect(atHydrated).toBeGreaterThan(atFetch)
  })

  it('dynamic import cartSessionSync (ไม่สร้าง static cycle — cartSessionSync import serializeCartObject จากไฟล์นี้)', () => {
    expect(cartPersistenceSrc).toContain("await import('./cartSessionSync')")
    // และไม่มี static import ด้านบนไฟล์
    expect(cartPersistenceSrc).not.toMatch(/^import .*cartSessionSync/m)
  })
})

// ============================================
// D — Pure round-trip: payload = รูปเดียวกับ localStorage (ไม่มีราคา)
// ============================================
describe('R103-D — payload round-trip: serializeCartObject → parseStoredCart', () => {
  const product = { id: 'p-miang-kai', price: 120, name: 'เมี่ยงอกไก่' } as unknown as Product

  it('ids/qty/customizations/mode/coupon รอด · ราคา/ยอดรวม/สต็อก ไม่มีใน payload', () => {
    const obj = serializeCartObject({
      items: [
        { product, quantity: 2, customizations: { spicy: 'เผ็ดน้อย', toppings: ['ไข่', 'หมูสับ'] }, line_mode: 'PRE_ORDER' },
        { product: { ...product, id: 'p-kai-torn' }, quantity: 1, customizations: {}, line_mode: 'SAME_DAY' },
      ],
      order_mode: 'PRE_ORDER',
      couponCode: 'SAVE20',
      referralCode: 'REF9',
    })
    // ไม่มี field ราคา/ยอดรวมในระดับ payload
    expect(obj).not.toHaveProperty('subtotal')
    expect(obj).not.toHaveProperty('total')
    for (const it of obj.items) {
      expect(Object.keys(it).sort()).toEqual(['customizations', 'mode', 'productId', 'quantity'])
      expect(it).not.toHaveProperty('price')
      expect(it).not.toHaveProperty('subtotal')
    }
    // jsonb round-trip เดียวกับ server: JSON.stringify → parseStoredCart (strict)
    const back = parseStoredCart(JSON.stringify(obj))
    expect(back).not.toBeNull()
    expect(back!.items).toHaveLength(2)
    expect(back!.items[0].productId).toBe('p-miang-kai')
    expect(back!.items[0].mode).toBe('PRE_ORDER')
    expect(back!.couponCode).toBe('SAVE20')
    expect(back!.referralCode).toBe('REF9')
    expect(back!.order_mode).toBe('PRE_ORDER')
  })

  it('ตะกร้าว่าง = items [] · jsonb null ฝั่ง sync จะไม่เข้า path restore (parse ของ null = null)', () => {
    const obj = serializeCartObject({ items: [], order_mode: null, couponCode: '', referralCode: '' })
    expect(obj.items).toHaveLength(0)
    expect(parseStoredCart(null)).toBeNull()
    // payload null จาก server = fetchLatestServerCart คืน null (guard row.payload ที่ B คุม)
  })

  it('ค่าผิดรูป/อนาคต = null (ไม่ restore ของมั่ว — เคส payload โดนแก้ข้าง server)', () => {
    expect(parseStoredCart(JSON.stringify({ v: 99, items: [] }))).toBeNull()
    expect(parseStoredCart(JSON.stringify({ v: 1, items: [{ productId: '', quantity: 1 }] }))).toBeNull()
  })
})

// ============================================
// E — Boot wiring: initCartSessionSync ยังเรียกจาก main.tsx (r49 pin คงเดิม)
// ============================================
describe('R103-E — boot wiring คงเดิม', () => {
  it('main.tsx เรียก initCartPersistence + initCartSessionSync ครบ (ไม่มี wiring ใหม่ที่ขาด)', () => {
    expect(mainSrc).toContain('initCartPersistence(')
    expect(mainSrc).toContain('initCartSessionSync()')
  })
})
