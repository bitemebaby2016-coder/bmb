// ============================================
// BMB — Food Theater daily copy rotation (7 day themes, admin-configurable)
// ============================================
// Pure presentation copy — ZERO business authority: no prices, no stock, no
// delivery windows, no "best seller" claims (theaterReasons owns the chip
// rules). Source = the EXISTING `business_settings` key `theater_daily_copy`
// (JSON, edited through the existing AdminSettings key/value editor — no new
// CMS, no second store, no migration).
//   - Group by weekday in the system timezone (Asia/Bangkok = fixed UTC+7,
//     the same constant the menu-cutoff logic uses in bangkokTime.ts).
//   - The pick inside a day's group is derived deterministically from the
//     Bangkok civil date, so it stays stable for the whole day across
//     refreshes / remounts / new tabs (no flicker, no per-render resampling).
//   - Only items with published !== false and non-empty headline+subheadline
//     are eligible. Rotation off / unreadable config / no eligible item →
//     return null and the caller falls back to THEATER_EDITORIAL (admin base
//     copy → honest built-in defaults).
// ============================================

import { BANGKOK_UTC_OFFSET_MINUTES } from './bangkokTime'
import { renderTheaterTitle, type TheaterEditorial } from './theaterEditorial'

/** business_settings key that holds the rotation config (JSON object). */
export const THEATER_DAILY_COPY_KEY = 'theater_daily_copy'

export type DailyCopyDayKey = 'mon' | 'tue' | 'wed' | 'thu' | 'fri' | 'sat' | 'sun'

/** Indexed by Date#getUTCDay() after the +7h shift (0 = Sunday). */
const DAY_KEYS: readonly DailyCopyDayKey[] = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat']

export interface TheaterDailyCopyItem {
  /** Free-form stable id — helps admins diff JSON edits. */
  id?: string
  /** Main stage headline (supports the `{count}` placeholder). */
  headline: string
  /** Supporting copy — stage-floor speech bubble. */
  subheadline: string
  /** CTA button label; empty/missing falls back to editorial.menuCta. */
  cta_label?: string
  /** Short recommendation line shown under the headline. */
  recommendation_label?: string
  /** Publish flag — omitted counts as published; `false` opts the item out. */
  published?: boolean
}

export interface TheaterDailyCopyConfig {
  /** Master switch for the daily rotation. Missing = on; `false` forces fallback. */
  enabled?: boolean
  days?: Partial<Record<DailyCopyDayKey, TheaterDailyCopyItem[]>>
}

/** Bangkok civil date (YYYY-MM-DD) of `utcMs` — the rotation's daily seed. */
export function bangkokDateKey(utcMs: number): string {
  return new Date(utcMs + BANGKOK_UTC_OFFSET_MINUTES * 60_000).toISOString().slice(0, 10)
}

/** Weekday group of `utcMs` in the system timezone (Asia/Bangkok, fixed UTC+7). */
export function bangkokDayKey(utcMs: number): DailyCopyDayKey {
  return DAY_KEYS[new Date(utcMs + BANGKOK_UTC_OFFSET_MINUTES * 60_000).getUTCDay()]
}

/** FNV-1a — tiny deterministic hash so one date always maps to one item. */
function fnv1a(input: string): number {
  let hash = 0x811c9dc5
  for (let i = 0; i < input.length; i += 1) {
    hash ^= input.charCodeAt(i)
    hash = Math.imul(hash, 0x01000193) >>> 0
  }
  return hash >>> 0
}

function isEligible(item: unknown): item is TheaterDailyCopyItem {
  if (!item || typeof item !== 'object') return false
  const it = item as TheaterDailyCopyItem
  return (
    it.published !== false &&
    typeof it.headline === 'string' &&
    it.headline.trim().length > 0 &&
    typeof it.subheadline === 'string' &&
    it.subheadline.trim().length > 0
  )
}

/**
 * Select today's copy from the admin config. Deterministic per Bangkok date —
 * the same call at any time of the same day returns the same item.
 * Returns null (→ fallback chain) when rotation is off, config is unreadable,
 * or TODAY'S group has no eligible published item (never leaks other days).
 */
export function selectDailyCopy(raw: unknown, utcMs: number = Date.now()): TheaterDailyCopyItem | null {
  if (!raw || typeof raw !== 'object') return null
  const config = raw as TheaterDailyCopyConfig
  if (config.enabled === false) return null
  const dayKey = bangkokDayKey(utcMs)
  const group = config.days?.[dayKey]
  if (!Array.isArray(group)) return null
  const eligible = group.filter(isEligible)
  if (eligible.length === 0) return null
  const pick = fnv1a(`${bangkokDateKey(utcMs)}|${dayKey}`) % eligible.length
  return eligible[pick]
}

export interface TheaterStageCopy {
  headline: string
  subheadline: string
  ctaLabel: string
  recommendationLabel: string | null
}

/**
 * Merge chain for what the stage actually renders:
 *   daily copy (when selected) → admin editorial → built-in defaults.
 * Pure — FoodTheater renders exactly these strings, so an admin edit in
 * `theater_editorial` / `theater_daily_copy` shows up on the page directly.
 * An empty catalog always keeps the honest editorial copy (a rotating
 * "explore the menu" line must not promise picks that don't exist).
 */
export function resolveStageCopy(
  editorial: TheaterEditorial,
  daily: TheaterDailyCopyItem | null,
  pickCount: number,
): TheaterStageCopy {
  if (pickCount <= 0) {
    return {
      headline: editorial.titleEmpty,
      subheadline: editorial.greeting,
      ctaLabel: editorial.menuCta,
      recommendationLabel: null,
    }
  }
  const ctaFromDaily = daily?.cta_label?.trim()
  const rec = daily?.recommendation_label?.trim()
  return {
    headline: daily
      ? daily.headline.replace(/\{count\}/g, String(pickCount))
      : renderTheaterTitle(editorial, pickCount),
    subheadline: daily ? daily.subheadline : editorial.greeting,
    ctaLabel: ctaFromDaily && ctaFromDaily.length > 0 ? ctaFromDaily : editorial.menuCta,
    recommendationLabel: rec && rec.length > 0 ? rec : null,
  }
}

// ============================================
// Starter template — pre-filled when an admin CREATES the key in AdminSettings.
// Documentation/starting point only: nothing renders from here until an admin
// reviews and saves it to business_settings. Adapted from the 7-day copy
// guidance (no prices, no delivery windows, no unverifiable claims — the
// Saturday line deliberately avoids "new/fresh" wording; the ✨ chip on cards
// comes from real created_at data via theaterReasons, not from this copy).
// ============================================
export const THEATER_DAILY_COPY_STARTER: TheaterDailyCopyConfig & {
  days: Record<DailyCopyDayKey, TheaterDailyCopyItem[]>
} = {
  enabled: true,
  days: {
    // จันทร์ — Menu Discovery
    mon: [
      {
        id: 'mon-1',
        headline: 'วันนี้อยากกินอะไรดี? ให้ไบ๊ช่วยสำรวจเมนู',
        subheadline: 'เลื่อนดูเมนูที่ไบ๊เลือกมาให้ แล้วแตะการ์ดที่ใช่ได้เลย',
        recommendation_label: 'เริ่มจากเมนูพร้อมขายวันนี้',
        published: true,
      },
    ],
    // อังคาร — Signature / Recommendation
    tue: [
      {
        id: 'tue-1',
        headline: 'ยังเลือกไม่ถูก ให้ไบ๊ช่วยแนะนำ',
        subheadline: 'ป้ายบนการ์ดมาจากรสนิยมและเมนูในตะกร้าของคุณจริงๆ ลองดูได้เลย',
        recommendation_label: 'ดูป้ายแนะนำบนการ์ด',
        published: true,
      },
    ],
    // พุธ — Craving / Occasion
    wed: [
      {
        id: 'wed-1',
        headline: 'มื้อถัดไปอยากได้รสชาติแบบไหน?',
        subheadline: 'เลือกแนวที่ใช่ แล้วให้ไบ๊จัดเมนูมาให้',
        published: true,
      },
    ],
    // พฤหัสบดี — Convenience
    thu: [
      {
        id: 'thu-1',
        headline: 'เลือกเมนูที่ใช่ แล้วไปต่อได้ง่ายขึ้น',
        subheadline: 'แตะเพิ่มลงตะกร้า หรือกดปรับแต่ง แล้วสั่งต่อได้เลย',
        published: true,
      },
    ],
    // ศุกร์ — Value & Choice (cards show real prices — no fabricated discounts)
    fri: [
      {
        id: 'fri-1',
        headline: 'เปรียบเทียบเมนูและราคาก่อนตัดสินใจ',
        subheadline: 'ดูภาพ ราคา และป้ายแนะนำของแต่ละจาน ในหน้าเดียว',
        published: true,
      },
    ],
    // เสาร์ — New / Fresh Highlights (no "new/fresh" claim in copy — cards
    // carry the real ✨ เมนูใหม่ chip only when created_at confirms it)
    sat: [
      {
        id: 'sat-1',
        headline: 'ลองดูเมนูที่มีให้เลือกวันนี้',
        subheadline: 'เลื่อนดูเมนูพร้อมขายวันนี้ แล้วแตะที่อยากกินได้เลย',
        published: true,
      },
    ],
    // อาทิตย์ — Ask Bite / Helpful Answers
    sun: [
      {
        id: 'sun-1',
        headline: 'สงสัยเรื่องเมนูหรือการสั่ง? ถามไบ๊ได้เลย',
        subheadline: 'ถามได้ตั้งแต่เรื่องเมนู ไปจนถึงวิธีสั่งและติดตามออเดอร์',
        published: true,
      },
    ],
  },
}