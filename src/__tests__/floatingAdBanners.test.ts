// ============================================
// Bite Me Baby — Floating Ad Banners selection tests (Owner D03)
// Deterministic ordering + per-promo SESSION dismissal.
// ============================================

import { describe, it, expect, beforeEach } from 'vitest'
import { pickVisibleBannerPromos, type FloatingBannerPromo } from '@/components/home/FloatingAdBanners'

const p = (id: string): FloatingBannerPromo => ({ id, title: `Promo ${id}` })

beforeEach(() => {
  sessionStorage.clear()
})

describe('pickVisibleBannerPromos — D03', () => {
  it('R50: keeps INPUT order (ใหม่สุดก่อน) ไม่ re-sort ตาม id + ตัด dismissed', () => {
    const input = [p('c'), p('a'), p('b')]
    const out = pickVisibleBannerPromos(input, new Set())
    expect(out.map((x) => x.id)).toEqual(['c', 'a'])
    // reversed input → คงลำดับ input (ประกาศล่าสุดของ rpc ต้องมาก่อนเสมอ)
    expect(pickVisibleBannerPromos([p('b'), p('c'), p('a')], new Set()).map((x) => x.id)).toEqual(['b', 'c'])
  })

  it('skips promos dismissed in the current session (state and sessionStorage)', () => {
    const dismissedState = new Set(['a'])
    expect(pickVisibleBannerPromos([p('a'), p('b'), p('c')], dismissedState).map((x) => x.id)).toEqual(['b', 'c'])
    // session storage entry (as written by dismiss) also excludes the promo
    sessionStorage.setItem('bmb_banner_dismiss_b', '1')
    expect(pickVisibleBannerPromos([p('a'), p('b'), p('c')], new Set()).map((x) => x.id)).toEqual(['a', 'c'])
  })

  it('a dismissed promo never reappears when query order shifts the next row into the slice', () => {
    // user dismissed 'a'; the DB now returns a different order — 'a' stays hidden
    sessionStorage.setItem('bmb_banner_dismiss_a', '1')
    const reshuffled = [p('z'), p('a'), p('y')]
    expect(pickVisibleBannerPromos(reshuffled, new Set()).map((x) => x.id)).toEqual(['z', 'y'])
  })

  it('keeps the existing max-2 slice and filters rows without an id', () => {
    const out = pickVisibleBannerPromos([p('a'), p('b'), p('c'), { id: '', title: 'no id' }], new Set())
    expect(out).toHaveLength(2)
    expect(out.map((x) => x.id)).toEqual(['a', 'b'])
    expect(pickVisibleBannerPromos([], new Set())).toEqual([])
  })
})
