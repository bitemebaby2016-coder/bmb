// ============================================
// Bite Me Baby — Floating Ad Banners selection tests (Owner D03)
// component เป็น pure presentation: pickVisibleBannerPromos กรองเฉพาะ dismissed
// (การจำกัดจำนวน/ลำดับทำที่ floatingAdResolver ตาม config.maxCount)
// ============================================

import { describe, it, expect, beforeEach } from 'vitest'
import { pickVisibleBannerPromos, type FloatingBannerPromo } from '@/components/home/FloatingAdBanners'

const p = (id: string): FloatingBannerPromo => ({ id, title: `Promo ${id}` })

beforeEach(() => {
  sessionStorage.clear()
})

describe('pickVisibleBannerPromos — D03', () => {
  it('keeps INPUT order (ใหม่สุดก่อน) ไม่ re-sort ตาม id', () => {
    const input = [p('c'), p('a'), p('b')]
    expect(pickVisibleBannerPromos(input, new Set()).map((x) => x.id)).toEqual(['c', 'a', 'b'])
    expect(pickVisibleBannerPromos([p('b'), p('c'), p('a')], new Set()).map((x) => x.id)).toEqual(['b', 'c', 'a'])
  })

  it('skips promos dismissed in the current session (state and sessionStorage)', () => {
    const dismissedState = new Set(['a'])
    expect(pickVisibleBannerPromos([p('a'), p('b'), p('c')], dismissedState).map((x) => x.id)).toEqual(['b', 'c'])
    sessionStorage.setItem('bmb_banner_dismiss_b', '1')
    expect(pickVisibleBannerPromos([p('a'), p('b'), p('c')], new Set()).map((x) => x.id)).toEqual(['a', 'c'])
  })

  it('a dismissed promo never reappears when query order shifts the next row', () => {
    sessionStorage.setItem('bmb_banner_dismiss_a', '1')
    const reshuffled = [p('z'), p('a'), p('y')]
    expect(pickVisibleBannerPromos(reshuffled, new Set()).map((x) => x.id)).toEqual(['z', 'y'])
  })

  it('does NOT slice — cap ทำที่ resolver; ตัวกรองคงรายการทั้งหมดที่ไม่ dismiss', () => {
    const out = pickVisibleBannerPromos([p('a'), p('b'), p('c'), p('d')], new Set())
    expect(out.map((x) => x.id)).toEqual(['a', 'b', 'c', 'd'])
    expect(pickVisibleBannerPromos([p('a'), { id: '', title: 'no id' }], new Set()).map((x) => x.id)).toEqual(['a'])
    expect(pickVisibleBannerPromos([], new Set())).toEqual([])
  })
})