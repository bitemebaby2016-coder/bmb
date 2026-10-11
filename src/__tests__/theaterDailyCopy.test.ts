import { describe, it, expect } from 'vitest'
import {
  bangkokDayKey,
  bangkokDateKey,
  selectDailyCopy,
  resolveStageCopy,
  THEATER_DAILY_COPY_STARTER,
  THEATER_DAILY_COPY_KEY,
  type TheaterDailyCopyConfig,
  type DailyCopyDayKey,
} from '@/lib/theaterDailyCopy'
import { THEATER_EDITORIAL_DEFAULTS, resolveTheaterEditorial } from '@/lib/theaterEditorial'

// System timezone = Asia/Bangkok fixed UTC+7 (bangkokTime.ts).
// 2026-10-12 = Monday … 2026-10-18 = Sunday.
const BKK_NOON = [12, 13, 14, 15, 16, 17, 18].map(
  (d) => Date.parse(`2026-10-${d}T05:00:00Z`), // 12:00 Bangkok
)
const DAY_ORDER: DailyCopyDayKey[] = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun']

function makeConfig(overrides: Partial<TheaterDailyCopyConfig> = {}): TheaterDailyCopyConfig {
  const days = {} as TheaterDailyCopyConfig['days']
  for (const key of DAY_ORDER) {
    days![key] = [
      { id: `${key}-a`, headline: `หัวข้อ ${key} ก`, subheadline: `ข้อความ ${key} ก`, published: true },
      { id: `${key}-b`, headline: `หัวข้อ ${key} ข`, subheadline: `ข้อความ ${key} ข`, published: true },
    ]
  }
  return { enabled: true, days, ...overrides }
}

describe('bangkokDayKey / bangkokDateKey — system timezone (UTC+7)', () => {
  it('maps each Bangkok day to its day group', () => {
    expect(BKK_NOON.map((t) => bangkokDayKey(t))).toEqual(DAY_ORDER)
  })

  it('flips at Bangkok midnight, not UTC midnight', () => {
    // 23:59:59 Bangkok (Sunday) = 16:59:59Z … 00:00 Bangkok (Monday) = 17:00:00Z
    expect(bangkokDayKey(Date.parse('2026-10-11T16:59:59Z'))).toBe('sun')
    expect(bangkokDayKey(Date.parse('2026-10-11T17:00:00Z'))).toBe('mon')
    expect(bangkokDateKey(Date.parse('2026-10-11T17:00:00Z'))).toBe('2026-10-12')
    expect(bangkokDateKey(Date.parse('2026-10-12T04:00:00Z'))).toBe('2026-10-12')
  })
})

describe('selectDailyCopy — published-only, stable per day, honest fallback', () => {
  it('selects only from today\'s group', () => {
    const cfg = makeConfig()
    for (let i = 0; i < 7; i += 1) {
      const pick = selectDailyCopy(cfg, BKK_NOON[i])
      expect(pick).not.toBeNull()
      expect(pick!.id!.startsWith(DAY_ORDER[i])).toBe(true)
    }
  })

  it('is stable for the whole Bangkok day (refresh/remount safe)', () => {
    const cfg = makeConfig()
    // All timestamps stay inside 2026-10-14 Bangkok (00:00–23:59 = 17:00Z prior day … 16:59Z)
    const picks = [0, 3, 7, 11, 14, 16].map((h) =>
      selectDailyCopy(cfg, Date.parse(`2026-10-14T${String(h).padStart(2, '0')}:30:00Z`))?.id,
    )
    expect(new Set(picks).size).toBe(1)
  })

  it('never selects unpublished or malformed items', () => {
    const cfg = makeConfig({
      days: {
        mon: [
          { id: 'x', headline: 'ไม่เผยแพร่', subheadline: '...', published: false },
          { id: 'y', headline: '   ', subheadline: 'ok' },
          null as never,
          { id: 'z', headline: 'ใช้ได้', subheadline: 'ตัวนี้เผยแพร่', published: true },
        ],
      },
    })
    for (let t = 0; t < 5; t += 1) {
      expect(selectDailyCopy(cfg, Date.parse(`2026-10-12T0${t}:00:00Z`))?.id).toBe('z')
    }
  })

  it('falls back (null) when today has nothing published — never leaks other days', () => {
    const cfg = makeConfig({
      days: { mon: [{ headline: 'ซ่อน', subheadline: 'ซ่อน', published: false }] },
    })
    expect(selectDailyCopy(cfg, BKK_NOON[0])).toBeNull()
    expect(selectDailyCopy(makeConfig({ days: {} }), BKK_NOON[3])).toBeNull()
  })

  it('falls back (null) when rotation is off or config is unreadable', () => {
    expect(selectDailyCopy(makeConfig({ enabled: false }), BKK_NOON[0])).toBeNull()
    expect(selectDailyCopy(undefined, BKK_NOON[0])).toBeNull()
    expect(selectDailyCopy(null, BKK_NOON[0])).toBeNull()
    expect(selectDailyCopy('broken-json-string', BKK_NOON[0])).toBeNull()
    // enabled omitted = rotation on (documented default)
    const { enabled: _omitted, ...noFlag } = makeConfig()
    expect(selectDailyCopy(noFlag, BKK_NOON[0])).not.toBeNull()
  })
})

describe('resolveStageCopy — daily → admin editorial → defaults chain', () => {
  it('renders admin-edited editorial when no daily copy is selected', () => {
    const admin = resolveTheaterEditorial({ title_template: 'แอดมินแก้หัวข้อ {count}', greeting: 'แอดมินแก้คำทัก', menu_cta: 'แอดมินแก้ปุ่ม' })
    const stage = resolveStageCopy(admin, null, 7)
    expect(stage.headline).toBe('แอดมินแก้หัวข้อ 7')
    expect(stage.subheadline).toBe('แอดมินแก้คำทัก')
    expect(stage.ctaLabel).toBe('แอดมินแก้ปุ่ม')
    expect(stage.recommendationLabel).toBeNull()
  })

  it('uses built-in defaults when nothing is configured', () => {
    const stage = resolveStageCopy(THEATER_EDITORIAL_DEFAULTS, null, 3)
    expect(stage.headline).toBe('วันนี้ผมเลือกมาให้ 3 อย่างครับ')
    expect(stage.subheadline).toBe(THEATER_EDITORIAL_DEFAULTS.greeting)
    expect(stage.ctaLabel).toBe(THEATER_EDITORIAL_DEFAULTS.menuCta)
  })

  it('daily copy overrides all fields and supports {count}', () => {
    const daily = { headline: 'หัวข้อวันนี้ {count} จาน', subheadline: 'คำสนับสนุน', cta_label: 'ปุ่ม daily', recommendation_label: 'ป้ายแนะนำ' }
    const stage = resolveStageCopy(THEATER_EDITORIAL_DEFAULTS, daily, 7)
    expect(stage.headline).toBe('หัวข้อวันนี้ 7 จาน')
    expect(stage.subheadline).toBe('คำสนับสนุน')
    expect(stage.ctaLabel).toBe('ปุ่ม daily')
    expect(stage.recommendationLabel).toBe('ป้ายแนะนำ')
  })

  it('missing optional daily fields fall back per-field', () => {
    const stage = resolveStageCopy(THEATER_EDITORIAL_DEFAULTS, { headline: 'H', subheadline: 'S' }, 5)
    expect(stage.ctaLabel).toBe(THEATER_EDITORIAL_DEFAULTS.menuCta)
    expect(stage.recommendationLabel).toBeNull()
  })

  it('empty catalog keeps honest editorial copy even when daily is selected', () => {
    const daily = { headline: 'สำรวจเมนู {count}', subheadline: 'ลองดูเลย' }
    const stage = resolveStageCopy(THEATER_EDITORIAL_DEFAULTS, daily, 0)
    expect(stage.headline).toBe(THEATER_EDITORIAL_DEFAULTS.titleEmpty)
    expect(stage.recommendationLabel).toBeNull()
  })
})

describe('THEATER_DAILY_COPY_STARTER — safe starter template', () => {
  it('covers all 7 days with published, non-empty items', () => {
    expect(THEATER_DAILY_COPY_STARTER.enabled).toBe(true)
    for (const key of DAY_ORDER) {
      const items = THEATER_DAILY_COPY_STARTER.days[key]
      expect(items.length).toBeGreaterThan(0)
      for (const item of items) {
        expect(item.published).toBe(true)
        expect(item.headline.trim().length).toBeGreaterThan(0)
        expect(item.subheadline.trim().length).toBeGreaterThan(0)
      }
    }
  })

  it('contains no fabricated price/discount numbers', () => {
    const strings = DAY_ORDER.flatMap((k) =>
      THEATER_DAILY_COPY_STARTER.days[k].flatMap((i) => [i.headline, i.subheadline, i.cta_label ?? '', i.recommendation_label ?? '']),
    )
    for (const s of strings) expect(s).not.toMatch(/฿\s?\d/)
  })

  it('uses the documented business_settings key', () => {
    expect(THEATER_DAILY_COPY_KEY).toBe('theater_daily_copy')
  })
})