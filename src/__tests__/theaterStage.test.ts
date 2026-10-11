import { describe, it, expect } from 'vitest'
import { theaterPosFor, clampIndex } from '@/lib/theaterGeometry'
import {
  resolveTheaterEditorial,
  renderTheaterTitle,
  THEATER_EDITORIAL_DEFAULTS,
} from '@/lib/theaterEditorial'

describe('theaterGeometry — ring position math (pure)', () => {
  it('center = offset 0', () => {
    expect(theaterPosFor(2, 2, 5)).toBe('center')
    expect(theaterPosFor(0, 0, 1)).toBe('center')
  })

  it('near-left / near-right = offset ±1', () => {
    expect(theaterPosFor(1, 2, 5)).toBe('near-left')
    expect(theaterPosFor(3, 2, 5)).toBe('near-right')
  })

  it('far-left / far-right = offset beyond ±1', () => {
    expect(theaterPosFor(0, 2, 5)).toBe('far-left')
    expect(theaterPosFor(4, 2, 5)).toBe('far-right')
  })

  it('clamps an out-of-range active index before positioning', () => {
    // active=99 clamps to 4 → slide 4 becomes the center
    expect(theaterPosFor(4, 99, 5)).toBe('center')
    expect(theaterPosFor(3, 99, 5)).toBe('near-left')
    // active=-3 clamps to 0 → slide 0 becomes the center
    expect(theaterPosFor(0, -3, 5)).toBe('center')
    expect(theaterPosFor(1, -3, 5)).toBe('near-right')
  })

  it('empty list resolves every slot to center (no phantom geometry)', () => {
    expect(theaterPosFor(0, 0, 0)).toBe('center')
    expect(theaterPosFor(3, 1, 0)).toBe('center')
  })
})

describe('clampIndex — active index safety', () => {
  it('clamps into [0, count-1]', () => {
    expect(clampIndex(-2, 5)).toBe(0)
    expect(clampIndex(99, 5)).toBe(4)
    expect(clampIndex(3, 5)).toBe(3)
  })

  it('empty list always = 0', () => {
    expect(clampIndex(7, 0)).toBe(0)
    expect(clampIndex(0, 0)).toBe(0)
  })

  it('single item = 0', () => {
    expect(clampIndex(0, 1)).toBe(0)
    expect(clampIndex(4, 1)).toBe(0)
  })
})

describe('theaterEditorial — admin copy with honest fallback', () => {
  it('missing/invalid raw = full defaults', () => {
    expect(resolveTheaterEditorial(undefined)).toEqual(THEATER_EDITORIAL_DEFAULTS)
    expect(resolveTheaterEditorial(null)).toEqual(THEATER_EDITORIAL_DEFAULTS)
    expect(resolveTheaterEditorial('nope')).toEqual(THEATER_EDITORIAL_DEFAULTS)
    expect(resolveTheaterEditorial({})).toEqual(THEATER_EDITORIAL_DEFAULTS)
  })

  it('valid fields override, empty strings fall back per-field', () => {
    const r = resolveTheaterEditorial({
      kicker: 'PICK OF THE DAY',
      title_template: '',
      empty_body: 'ว่างงง',
    })
    expect(r.kicker).toBe('PICK OF THE DAY')
    expect(r.titleTemplate).toBe(THEATER_EDITORIAL_DEFAULTS.titleTemplate)
    expect(r.emptyBody).toBe('ว่างงง')
    expect(r.menuCta).toBe(THEATER_EDITORIAL_DEFAULTS.menuCta)
  })

  it('renders {count} in title; 0 picks uses titleEmpty', () => {
    const d = THEATER_EDITORIAL_DEFAULTS
    expect(renderTheaterTitle(d, 5)).toBe('วันนี้ผมเลือกมาให้ 5 อย่างครับ')
    expect(renderTheaterTitle(d, 0)).toBe(d.titleEmpty)
    expect(renderTheaterTitle(d, -1)).toBe(d.titleEmpty)
  })

  it('template without {count} still renders (no crash, no fabrication)', () => {
    const r = resolveTheaterEditorial({ title_template: 'เมนูแนะนำวันนี้' })
    expect(renderTheaterTitle(r, 3)).toBe('เมนูแนะนำวันนี้')
  })
})
