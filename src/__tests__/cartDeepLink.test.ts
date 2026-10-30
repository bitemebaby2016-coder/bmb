// ============================================
// Bite Me Baby — R27 unit tests: cart deep-link (?cart=) — เว็บ ↔ EF ต้องถอดกันได้เป๊ะ
// ============================================
import { describe, it, expect } from 'vitest'
import {
  encodeCartParam,
  decodeCartParam,
  cartShareUrl,
  readCartParam,
  CART_PARAM_MAX_ITEMS,
} from '@/lib/cartDeepLink'
import {
  buildCartLink,
  buildCartSummaryFooter,
  encodeCartParam as efEncodeCartParam,
} from '../../supabase/functions/_shared/socialOrderIntake.ts'
import layoutSrc from '../components/layout/Layout.tsx?raw'

describe('cartDeepLink (เว็บ)', () => {
  it('encode → decode round-trip', () => {
    const items = [
      { id: 'prod-1', q: 2 },
      { id: 'prod-2', q: 1 },
    ]
    const enc = encodeCartParam(items)
    expect(enc).not.toContain('+')
    expect(enc).not.toContain('/')
    expect(decodeCartParam(enc)).toEqual(items)
  })

  it('ของบูม/ผิดรูป = null (ห้ามเดาเอง) · qty ถูก clamp · cap 30 รายการ', () => {
    expect(decodeCartParam('%%%not-base64%%%')).toBeNull()
    expect(decodeCartParam('')).toBeNull()
    expect(decodeCartParam(null)).toBeNull()
    expect(decodeCartParam(JSON.stringify({ v: 2, items: [] }))).toBeNull() // b64 ของ JSON v=2
    const big = encodeCartParam(Array.from({ length: 40 }, (_, i) => ({ id: 'p' + i, q: 999 })))
    expect(decodeCartParam(big)).toHaveLength(CART_PARAM_MAX_ITEMS)
    expect(decodeCartParam(big)![0].q).toBe(50)
    const zeroQty = encodeCartParam([{ id: 'p', q: 0 }])
    expect(decodeCartParam(zeroQty)![0].q).toBe(1)
  })

  it('cartShareUrl = https://biteme-baby.com/shop?cart=... · readCartParam อ่านจาก query', () => {
    const url = cartShareUrl([{ id: 'p1', q: 3 }])
    expect(url.startsWith('https://biteme-baby.com/shop?cart=')).toBe(true)
    const raw = new URL(url).searchParams.get('cart') ?? ''
    expect(readCartParam('?cart=' + raw)).toEqual([{ id: 'p1', q: 3 }])
    expect(readCartParam('?x=1')).toBeNull()
  })
})

describe('EF buildCartLink / footer (mirror ต้องตรงกับเว็บ)', () => {
  it('ลิงก์ EF เปิดอ่านด้วย decodeCartParam ของเว็บได้ (round-trip ข้ามฝั่ง)', () => {
    const link = buildCartLink([{ product_id: 'p-9', quantity: 4, name: 'ข้าวมันไก่' }])
    expect(link.startsWith('https://biteme-baby.com/shop?cart=')).toBe(true)
    const raw = new URL(link).searchParams.get('cart') ?? ''
    expect(decodeCartParam(raw)).toEqual([{ id: 'p-9', q: 4 }])
    // encoder สองฝั่งค่าเดียวกัน
    expect(efEncodeCartParam([{ id: 'p-9', q: 4 }])).toBe(encodeCartParam([{ id: 'p-9', q: 4 }]))
  })

  it('footer ระบบเขียน = มีชื่อเมนู + คำชวนเช็คเอาท์/เพิ่มเมนู + ลิงก์', () => {
    const f = buildCartSummaryFooter([{ product_id: 'x', quantity: 2, name: 'ข้าวมันไก่' }])
    expect(f).toContain('ข้าวมันไก่ x2')
    expect(f).toContain('เช็คเอาท์')
    expect(f).toContain('เพิ่มเมนูต่อ')
    expect(f).toContain('/shop?cart=')
  })
})

describe('Layout — ?cart= deep-link wiring', () => {
  it('อ่านค่า แล้ว strip ออกจาก URL เติมลงตะกร้า + เปิดแผง (source contract)', () => {
    expect(layoutSrc).toContain("readCartParam(raw)")
    expect(layoutSrc).toMatch(/searchParams\.delete\('cart'\)/)
    expect(layoutSrc).toMatch(/addItem\(p, it\.q, \{\}, 'SAME_DAY'\)/)
    expect(layoutSrc).toMatch(/setCheckoutOpen\(true\)/)
    // รอ isHydrated ก่อนเติม (กัน persistence restore ทับรายการจากลิงก์)
    expect(layoutSrc).toMatch(/isHydrated/)
  })
})
