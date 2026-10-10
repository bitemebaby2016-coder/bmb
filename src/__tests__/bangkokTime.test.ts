// ============================================
// Bite Me Baby — P0-1 SAME_DAY cutoff gate (Asia/Bangkok, timezone-independent)
// ============================================
// Regression for the 2026-10-10 defect: the old client formula
// `(ictOffset - getTimezoneOffset())` double-applied UTC+7 on Thai browsers
// (getTimezoneOffset() = -420 → +14h shift), INVERTING the cutoff gate:
// blocked before cutoff / allowed after it (proved with node on an ICT
// machine: cutoff 10:30 → 09:00 wrongly blocked, 19:06 wrongly allowed).
// These tests pin the corrected behaviour, mirror the server rule
// (`v_now > v_round_cutoff`, ERR_CUTOFF_PASSED, Bangkok time — strict `>`,
// exactly at cutoff = allowed), and prove browser-timezone independence
// (ICT / UTC / UTC-5) + date-boundary behaviour.
// ============================================

import { describe, it, expect, afterEach } from 'vitest'
import { isBangkokCutoffPassed, bangkokMsOfDay, BANGKOK_UTC_OFFSET_MINUTES } from '@/lib/bangkokTime'

/** Minimal ambient type — this browser app ships without @types/node. */
declare const process: { env: Record<string, string | undefined> }

/** UTC epoch-ms for a Bangkok wall-clock instant (2026-10-10 unless noted). */
const bkkWallUtc = (wall: string): number => Date.parse(`${wall}Z`) - BANGKOK_UTC_OFFSET_MINUTES * 60_000

describe('bangkokMsOfDay', () => {
  it('returns Bangkok wall-clock ms-of-day (UTC getters only)', () => {
    // 2026-10-10 09:00:00 Bangkok = 02:00:00Z
    expect(bangkokMsOfDay(Date.parse('2026-10-10T02:00:00Z'))).toBe(9 * 3_600_000)
    expect(bangkokMsOfDay(Date.parse('2026-10-10T16:59:59Z'))).toBe(23 * 3_600_000 + 59 * 60_000 + 59 * 1000)
  })

  it('rolls to the next Bangkok day at 17:00 UTC (00:00 ICT)', () => {
    expect(bangkokMsOfDay(Date.parse('2026-10-10T17:00:00Z'))).toBe(0)
  })

  it('rejects non-finite input', () => {
    expect(bangkokMsOfDay(NaN)).toBeNull()
    expect(bangkokMsOfDay(Infinity)).toBeNull()
  })

  it('exposes UTC+7 = 420 minutes (no DST)', () => {
    expect(BANGKOK_UTC_OFFSET_MINUTES).toBe(420)
  })
})

describe('isBangkokCutoffPassed — core gate (mirror of ERR_CUTOFF_PASSED)', () => {
  const cutoff = '10:30'

  it('BEFORE cutoff → not blocked', () => {
    expect(isBangkokCutoffPassed(cutoff, bkkWallUtc('2026-10-10T06:00:00'))).toBe(false)
    expect(isBangkokCutoffPassed(cutoff, bkkWallUtc('2026-10-10T09:00:00'))).toBe(false)
    expect(isBangkokCutoffPassed(cutoff, bkkWallUtc('2026-10-10T10:29:59'))).toBe(false)
  })

  it('EXACTLY at cutoff → allowed (strict `>`, mirrors SQL)', () => {
    expect(isBangkokCutoffPassed(cutoff, bkkWallUtc('2026-10-10T10:30:00'))).toBe(false)
  })

  it('AFTER cutoff → blocked (ms precision, like server time)', () => {
    expect(isBangkokCutoffPassed(cutoff, bkkWallUtc('2026-10-10T10:30:00') + 1)).toBe(true)
    expect(isBangkokCutoffPassed(cutoff, bkkWallUtc('2026-10-10T10:31:00'))).toBe(true)
    expect(isBangkokCutoffPassed(cutoff, bkkWallUtc('2026-10-10T19:06:00'))).toBe(true) // Owner screenshot scenario
  })

  it('regression: the 09:00-ICT scenario the old formula wrongly blocked', () => {
    // Old formula on an ICT browser computed ictNow = 09:00 + 14h = 23:00 > 10:30
    // → blocked (WRONG). New gate must allow ordering at 09:00 Bangkok.
    expect(isBangkokCutoffPassed('10:30', bkkWallUtc('2026-10-10T09:00:00'))).toBe(false)
    // And the 19:06 scenario the old formula wrongly allowed (09:06 next day).
    expect(isBangkokCutoffPassed('10:30', bkkWallUtc('2026-10-10T19:06:00'))).toBe(true)
  })

  it('accepts HH:mm:ss input (DB time) by truncating seconds', () => {
    expect(isBangkokCutoffPassed('10:30:00', bkkWallUtc('2026-10-10T10:30:00'))).toBe(false)
    expect(isBangkokCutoffPassed('10:30:00', bkkWallUtc('2026-10-10T10:30:01'))).toBe(true)
  })

  it('empty cutoff falls back to the legacy default 08:00', () => {
    expect(isBangkokCutoffPassed('', bkkWallUtc('2026-10-10T07:59:00'))).toBe(false)
    expect(isBangkokCutoffPassed('', bkkWallUtc('2026-10-10T08:00:01'))).toBe(true)
  })

  it('invalid cutoff → never blocks (previous NaN-comparison behaviour)', () => {
    expect(isBangkokCutoffPassed('abc', bkkWallUtc('2026-10-10T23:59:00'))).toBe(false)
    expect(isBangkokCutoffPassed('NaN:NaN', bkkWallUtc('2026-10-10T23:59:00'))).toBe(false)
  })
})


describe('isBangkokCutoffPassed — date boundaries (Bangkok day rollover)', () => {
  it('23:59 cutoff: blocked at 23:59:59, allowed again at 00:00 next Bangkok day', () => {
    expect(isBangkokCutoffPassed('23:59', bkkWallUtc('2026-10-10T23:59:59'))).toBe(true)
    expect(isBangkokCutoffPassed('23:59', bkkWallUtc('2026-10-11T00:00:00'))).toBe(false)
  })

  it('early-morning cutoff: 00:00–cutoff is a fresh ordering window each day', () => {
    // cutoff 08:00 — at 23:59 the gate is closed; after midnight it reopens.
    expect(isBangkokCutoffPassed('08:00', bkkWallUtc('2026-10-10T23:59:00'))).toBe(true)
    expect(isBangkokCutoffPassed('08:00', bkkWallUtc('2026-10-11T00:00:30'))).toBe(false)
    expect(isBangkokCutoffPassed('08:00', bkkWallUtc('2026-10-11T08:00:01'))).toBe(true)
  })

  it('day rollover happens at 17:00 UTC (Bangkok midnight), not at UTC midnight', () => {
    // 2026-10-10 16:59 UTC = Bangkok 23:59 (same day) → cutoff 10:30 already passed
    expect(isBangkokCutoffPassed('10:30', Date.parse('2026-10-10T16:59:00Z'))).toBe(true)
    // 2026-10-10 17:00 UTC = Bangkok 00:00 on 10-11 (new day) → window reopened
    expect(isBangkokCutoffPassed('10:30', Date.parse('2026-10-10T17:00:00Z'))).toBe(false)
  })
})

describe('isBangkokCutoffPassed — browser timezone independence', () => {
  const savedTz = process.env.TZ
  afterEach(() => {
    if (savedTz === undefined) delete process.env.TZ
    else process.env.TZ = savedTz
  })

  const matrix: Array<{ wall: string; cutoff: string; blocked: boolean }> = [
    { wall: '2026-10-10T09:00:00', cutoff: '10:30', blocked: false },
    { wall: '2026-10-10T10:30:00', cutoff: '10:30', blocked: false },
    { wall: '2026-10-10T10:30:01', cutoff: '10:30', blocked: true },
    { wall: '2026-10-10T19:06:00', cutoff: '10:30', blocked: true },
    { wall: '2026-10-10T16:59:59', cutoff: '08:00', blocked: true },
    { wall: '2026-10-11T00:00:00', cutoff: '08:00', blocked: false },
  ]

  it('produces identical results under Asia/Bangkok, UTC and America/New_York (UTC-5)', () => {
    for (const tz of ['Asia/Bangkok', 'UTC', 'America/New_York']) {
      process.env.TZ = tz
      for (const c of matrix) {
        expect(
          isBangkokCutoffPassed(c.cutoff, bkkWallUtc(c.wall)),
          `TZ=${tz} wall=${c.wall} cutoff=${c.cutoff}`,
        ).toBe(c.blocked)
      }
    }
  })
})
