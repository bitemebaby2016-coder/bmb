// ============================================
// Bite Me Baby — Floating Ad Banners selection tests (Owner D03)
// Deterministic ordering + per-promo SESSION dismissal.
// ============================================

import { describe, it, expect, beforeEach } from 'vitest'
import { pickVisibleBannerPromos, mergeBannerFeed, type FloatingBannerPromo } from '@/components/home/FloatingAdBanners'

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

// R64 (Owner: "รูปไม่เข้ามาที่โฟลตติ้ง"): ประกาศ 2 ใบห้ามเต็มโควตาจนโปรโมชั่นไม่เห็น
describe('R64 · mergeBannerFeed — สลับชนิด ประกาศ ↔ โปรโมชั่น (promo ได้เห็นเสมอ)', () => {
  it('a0,p0,a1,p1 — slice(2) หลัง merge = ประกาศใหม่สุด + โปรโมชั่นใหม่สุด คู่กัน', () => {
    const ann = [p('ann1'), p('ann2')]
    const promo = [p('hal'), p('welcome')]
    const merged = mergeBannerFeed(ann, promo)
    expect(merged.map((x) => x.id)).toEqual(['ann1', 'hal', 'ann2', 'welcome'])
    // เดิม (announcements รวมก้อน) = ['ann1','ann2'] → promo หายทั้งคู่ — ตอนนี้ promo เข้าคิว
    expect(pickVisibleBannerPromos(merged, new Set()).map((x) => x.id)).toEqual(['ann1', 'hal'])
  })
  it('ฝั่งเดียวหมด = คงลำดับเดิม · ฝั่งว่าง = ใช้ของอีกฝั่งล้วน', () => {
    expect(mergeBannerFeed([p('a1'), p('a2')], []).map((x) => x.id)).toEqual(['a1', 'a2'])
    expect(mergeBannerFeed([], [p('p1'), p('p2')]).map((x) => x.id)).toEqual(['p1', 'p2'])
    expect(mergeBannerFeed([], [])).toEqual([])
  })
  it('promo โดน dismiss = ประกาศถัดไปแทรกแทน (ไม่ทิ้งช่อง)', () => {
    const merged = mergeBannerFeed([p('ann1')], [p('hal')])
    const visible = pickVisibleBannerPromos(merged, new Set(['hal']))
    expect(visible.map((x) => x.id)).toEqual(['ann1'])
  })
})
