// ============================================
// Bite Me Baby Admin API — Delivery Rounds + Capacity (D8/D9 gap)
// Phase D: DB-backed management of `delivery_rounds` (admin RLS).
// ============================================

import { supabase } from './supabase'
import { writeAuditLog } from './auditLog'
import { getBusinessSettings, setBusinessSetting } from './bmbAdminApi_settings'
import {
  normalizeRoundPattern,
  validateRoundPatternRow,
  type RoundPatternRow,
} from './orderPolicy'

export interface DeliveryRoundRow {
  id: string
  round_key: string
  display_name: string
  /** ค่าเดิม/พื้นฐาน (legacy) — 148: เซมเดย์ไม่มีคัทออฟแล้ว คอลัมน์คัทออฟเซมเดย์ถูกถอดออกจาก schema */
  cutoff_time: string
  /** 145: คัทออฟพรีออเดอร์ของรอบ (ไม่มีค่า = ใช้กฎ cutoff_hours ก่อนส่ง) */
  pre_order_cutoff?: string | null
  delivery_start: string
  delivery_end: string
  max_capacity: number
  current_count: number
  scheduled_date: string
  status: string
  /** 149 (P0-2): true = เก็บแล้ว (archive) — ไม่แสดงในรายการหลัก ลบถาวรไม่ได้ถ้ามีออเดอร์อ้างอิง */
  archived?: boolean
  created_at?: string
  updated_at?: string
}

/** R3 (D-05): status whitelist — a round is either bookable or closed. */
const ROUND_STATUSES = new Set(['active', 'closed'])

export async function getDeliveryRoundsAdmin(): Promise<DeliveryRoundRow[]> {
  // 149 (P0-2): รายการหลัก = ยังไม่ถูกเก็บ — รอบที่ archive แล้วอยู่ใน getArchivedRoundsAdmin
  const { data, error } = await supabase.from('delivery_rounds').select('*').eq('archived', false).order('scheduled_date', { ascending: true })
  // R3 (D-05): ห้ามเงียบ — แอดมินเห็นรายการว่างตอน DB ล่มคือ "ข้อมูลหาย" ที่อันตราย
  if (error) {
    console.error('[getDeliveryRoundsAdmin] Error:', error)
    throw new Error(`ERR_ROUNDS_READ: ${error.message}`)
  }
  return (data || []) as DeliveryRoundRow[]
}

/** 149 (P0-2): รอบที่เก็บแล้ว (archive) — ดู/กู้คืน/ลบถาวรได้จากลิสต์นี้ */
export async function getArchivedRoundsAdmin(): Promise<DeliveryRoundRow[]> {
  const { data, error } = await supabase
    .from('delivery_rounds').select('*').eq('archived', true)
    .order('scheduled_date', { ascending: false })
  if (error) {
    console.error('[getArchivedRoundsAdmin] Error:', error)
    throw new Error(`ERR_ROUNDS_READ: ${error.message}`)
  }
  return (data || []) as DeliveryRoundRow[]
}

// ============================================
// 149 (P0-2 — Owner "บางอันลบไม่ได้"): archive/restore/DELETE พร้อมเหตุผลจริง
// root cause พิสูจน์แล้ว (e2e/p14ProbeRounds.json): orders/products → delivery_rounds
// = FK NO ACTION → แถวที่มีออเดอร์อ้างอิง "ลบถาวรไม่ได้" เสมอ → ใช้ archive แทน
// ============================================

/** เหตุผลจริงที่ UI ต้องโชว์เมื่อ DELETE โดน FK (ห้ามโชว์ข้อความดิบที่อ่านไม่ออก) */
export function roundDeleteErrorText(error: { code?: string; message?: string }): string {
  if (error?.code === '23503' || /violates foreign key/i.test(String(error?.message ?? ''))) {
    return 'รอบนี้มีออเดอร์/ข้อมูลอ้างอิงอยู่ — ลบถาวรไม่ได้ (กันประวัติออเดอร์) · กด "📦 เก็บ" แทนได้'
  }
  return `ลบไม่สำเร็จ: ${error?.message ?? 'ไม่ทราบสาเหตุ'}`
}

/** เก็บรอบ (archive) — แทนการลบถาวร · คืน error message หรือ null เมื่อสำเร็จ */
export async function archiveRound(id: string): Promise<string | null> {
  const now = new Date().toISOString()
  const { data: before, error: readErr } = await supabase
    .from('delivery_rounds').select('display_name, scheduled_date, status').eq('id', id).maybeSingle()
  if (readErr) return `อ่านข้อมูลรอบไม่สำเร็จ: ${readErr.message}`
  const { error } = await supabase.from('delivery_rounds')
    .update({ archived: true, status: 'closed', updated_at: now }).eq('id', id)
  if (error) return `เก็บรอบไม่สำเร็จ: ${error.message}`
  writeAuditLog({
    action: 'settings_change',
    entity_type: 'delivery_round',
    entity_id: id,
    description: `เก็บรอบ (archive) "${before?.display_name ?? id}" (${before?.scheduled_date ?? '?'}) : ${before?.status ?? '?'} → archived`,
    metadata: { archived: true, reason: 'admin-archive' },
  })
  return null
}

/** กู้คืนรอบที่เก็บไว้ (archived → false · status คง closed ให้แอดมินเปิดเอง) */
export async function restoreRound(id: string): Promise<string | null> {
  const { error } = await supabase.from('delivery_rounds')
    .update({ archived: false, updated_at: new Date().toISOString() }).eq('id', id)
  if (error) return `กู้คืนรอบไม่สำเร็จ: ${error.message}`
  writeAuditLog({
    action: 'settings_change',
    entity_type: 'delivery_round',
    entity_id: id,
    description: `กู้คืนรอบ (restore) ${id} : archived → กลับเข้ารายการปกติ`,
    metadata: { archived: false },
  })
  return null
}

/** ลบถาวร — คืนข้อความเหตุผลจริงเมื่อโดน FK (ไม่มีอ้างอิง = ลบได้จริง) */
export async function deleteRound(id: string): Promise<string | null> {
  const { error } = await supabase.from('delivery_rounds').delete().eq('id', id)
  if (error) return roundDeleteErrorText(error)
  writeAuditLog({
    action: 'settings_change',
    entity_type: 'delivery_round',
    entity_id: id,
    description: `ลบรอบถาวร ${id} (ไม่มีออเดอร์/ข้อมูลอ้างอิง)`,
    metadata: { hard_delete: true },
  })
  return null
}

/**
 * R3 (D-05): template guard — a round without cutoff/window/capacity cannot be
 * saved (a half-configured round silently blocks checkout with ERR_ROUND_*).
 * Returns an error message, or null when the row is complete.
 */
export function validateRoundTemplate(row: Partial<DeliveryRoundRow>): string | null {
  if (!String(row.display_name ?? '').trim()) return 'ต้องมีชื่อรอบ (display_name)'
  if (!/^\d{2}:\d{2}(:\d{2})?$/.test(String(row.cutoff_time ?? ''))) return 'เวลาปิดรับเดิม (cutoff_time) ไม่ถูกต้อง'
  if (String(row.pre_order_cutoff ?? '') && !/^\d{2}:\d{2}(:\d{2})?$/.test(String(row.pre_order_cutoff))) return 'คัทออฟพรีออเดอร์ไม่ถูกต้อง'
  if (!/^\d{2}:\d{2}(:\d{2})?$/.test(String(row.delivery_start ?? ''))) return 'เวลาเริ่มส่ง (delivery_start) ไม่ถูกต้อง'
  if (!/^\d{2}:\d{2}(:\d{2})?$/.test(String(row.delivery_end ?? ''))) return 'เวลาสิ้นสุดส่ง (delivery_end) ไม่ถูกต้อง'
  const cap = Number(row.max_capacity)
  if (!Number.isFinite(cap) || cap <= 0) return 'max_capacity ต้องมากกว่า 0'
  return null
}

export async function upsertDeliveryRound(row: DeliveryRoundRow): Promise<DeliveryRoundRow | null> {
  // R3 (D-05): guard กันบันทึกรอบครึ่ง ๆ กลาง ๆ + audit ทุกการแก้ไข
  const invalid = validateRoundTemplate(row)
  if (invalid) {
    console.error('[upsertDeliveryRound] template guard:', invalid)
    return null
  }
  const now = new Date().toISOString()
  const payload = { ...row, updated_at: now }

  if (row.id) {
    const { data, error } = await supabase.from('delivery_rounds').update(payload).eq('id', row.id).select().single()
    if (error) { console.error('[upsertDeliveryRound] update error:', error); return null }
    writeAuditLog({
      action: 'settings_change',
      entity_type: 'delivery_round',
      entity_id: row.id,
      description: `แก้ไขรอบส่ง ${row.display_name} (${row.scheduled_date})`,
      metadata: { cutoff_time: row.cutoff_time, delivery_start: row.delivery_start, delivery_end: row.delivery_end, max_capacity: row.max_capacity, status: row.status },
    })
    return data as DeliveryRoundRow
  }

  // max_capacity is guarded by the RPC create_order_with_items (capacity check);
  // creation uses the seeded round_key pattern.
  const id = row.id || `round-${Date.now()}`
  const { data, error } = await supabase
    .from('delivery_rounds')
    .insert({ ...payload, id, current_count: 0, created_at: now })
    .select()
    .single()
  if (error) { console.error('[upsertDeliveryRound] insert error:', error); return null }
  writeAuditLog({
    action: 'settings_change',
    entity_type: 'delivery_round',
    entity_id: id,
    description: `สร้างรอบส่ง ${row.display_name} (${row.scheduled_date})`,
    metadata: { status: row.status, max_capacity: row.max_capacity },
  })
  return data as DeliveryRoundRow
}

export async function setRoundStatus(id: string, status: string): Promise<boolean> {
  // R3 (D-05): whitelist + audit — ใครเปิด/ปิดรอบ ต้องสอบย้อนหลังได้เสมอ
  if (!ROUND_STATUSES.has(status)) {
    console.error('[setRoundStatus] invalid status:', status)
    return false
  }
  const { data: before, error: readErr } = await supabase
    .from('delivery_rounds')
    .select('status, display_name, scheduled_date')
    .eq('id', id)
    .maybeSingle()
  if (readErr) { console.error('[setRoundStatus] read error:', readErr); return false }
  const { error } = await supabase.from('delivery_rounds').update({ status, updated_at: new Date().toISOString() }).eq('id', id)
  if (error) { console.error('[setRoundStatus] Error:', error); return false }
  writeAuditLog({
    action: 'settings_change',
    entity_type: 'delivery_round',
    entity_id: id,
    description: `รอบส่ง "${before?.display_name ?? id}" (${before?.scheduled_date ?? '?'}) : ${before?.status ?? '?'} → ${status}`,
    metadata: { from: before?.status ?? null, to: status },
  })
  return true
}

/** Reset capacity counters for the next day (admin-only maintenance tool). */
export async function resetRoundCapacity(id: string): Promise<boolean> {
  const { error } = await supabase.from('delivery_rounds').update({ current_count: 0, updated_at: new Date().toISOString() }).eq('id', id)
  if (error) { console.error('[resetRoundCapacity] Error:', error); return false }
  writeAuditLog({
    action: 'settings_change',
    entity_type: 'delivery_round',
    entity_id: id,
    description: `รีเซ็ตจำนวนที่รับไว้ของรอบ ${id} เป็น 0`,
    metadata: { current_count: 0 },
  })
  return true
}

// ============================================
// ✅ Phase 3B (migration 024/025/029): canonical round reading for the customer
// checkout — deterministic ids `round-YYYYMMDD-<key>`, template-validated,
// instantiated server-side by ensure_rounds_for_date (EXECUTE granted to
// authenticated by migration 029). The SERVER remains the round authority;
// these helpers only display what the server will accept.
// ============================================

/** Instantiate (idempotently) the canonical rounds of a date. Graceful when the
 * RPC is unavailable: falls back to listing whatever active rounds already exist. */
export async function ensureRoundsForDate(date: string): Promise<boolean> {
  // R4 (Owner policy 2026-10-23 + 148/2026-10-24): auto-close รอบวันที่ผ่านไปแล้วก่อนเสมอ
  // (bookkeeping + audit — server order gate 025/118 ยังเป็น enforcement จริง)
  // best-effort: RPC พังไม่ให้พังงาน list หลัก
  try {
    await supabase.rpc('auto_close_expired_rounds')
  } catch {
    /* bookkeeping only — order gate ฝั่ง server ยังกันของจริง */
  }
  try {
    const { error } = await supabase.rpc('ensure_rounds_for_date', { p_date: date })
    if (error) {
      console.warn('[ensureRoundsForDate] RPC unavailable/failed (continuing with existing rounds):', error.message)
      return false
    }
    return true
  } catch (e) {
    console.warn('[ensureRoundsForDate] unexpected error:', String(e).slice(0, 120))
    return false
  }
}

/** Active (bookable) rounds for a date — only `status='active'` rows can be used
 * by the canonical create RPC (025: anything else → ERR_ROUND_CLOSED). */
export async function getActiveRoundsForDate(date: string): Promise<DeliveryRoundRow[]> {
  const { data, error } = await supabase
    .from('delivery_rounds')
    .select('*')
    .eq('scheduled_date', date)
    .eq('archived', false)
    .order('delivery_start', { ascending: true })
  if (error) { console.error('[getActiveRoundsForDate] Error:', error); return [] }
  return ((data || []) as DeliveryRoundRow[]).filter((r) => r.status === 'active')
}

/** Convenience: instantiate then list (SAME_DAY today + PRE_ORDER date picker). */
export async function listRoundsForDate(date: string): Promise<DeliveryRoundRow[]> {
  await ensureRoundsForDate(date)
  return getActiveRoundsForDate(date)
}

/** ALL rounds of a date (admin — includes closed ones so the schedule admin can
 *  show a per-round open/close switch; customer checkout keeps listRoundsForDate
 *  = active only, create RPC is still the only authority). */
export async function getRoundsForDateAdmin(date: string): Promise<DeliveryRoundRow[]> {
  const { data, error } = await supabase
    .from('delivery_rounds')
    .select('*')
    .eq('scheduled_date', date)
    .eq('archived', false)
    .order('delivery_start', { ascending: true })
  if (error) { console.error('[getRoundsForDateAdmin] Error:', error); return [] }
  return (data || []) as DeliveryRoundRow[]
}

// ============================================
// ✅ Round PATTERN (Owner 2026-10-24 — migration 144): "ทุกวันมีแค่ 3 รอบ
// เหมือนกัน ควรเป็นแพทเทิร์นเดียวกัน" — template = business_settings.order_pattern
// (ensure_rounds_for_date ใช้เป็นแหล่งสร้างรอบของทุกวัน)
// ============================================

/** แพทเทิร์นปัจจุบัน (ครบ 3 คีย์เสมอ — normalize จาก order_pattern) */
export async function getRoundPattern(): Promise<RoundPatternRow[]> {
  const s = await getBusinessSettings()
  return normalizeRoundPattern((s.order_pattern as any)?.rounds)
}

/** บันทึกแพทเทิร์น (validate ทุกแถวก่อน — คืน false เมื่อไม่ผ่าน) */
export async function saveRoundPattern(rows: RoundPatternRow[]): Promise<string | null> {
  for (const r of rows) {
    const invalid = validateRoundPatternRow(r)
    if (invalid) return invalid
  }
  const ok = await setBusinessSetting('order_pattern', { rounds: rows })
  return ok ? null : 'บันทึกแพทเทิร์นไม่สำเร็จ — ลองใหม่'
}

/** สร้างรอบของวันตามแพทเทิร์น (idempotent — ensure_rounds_for_date) */
export async function ensureRoundsForDays(startIso: string, days: number): Promise<number> {
  let okCount = 0
  const start = new Date(startIso + 'T00:00:00')
  for (let i = 0; i < days; i++) {
    const d = new Date(start)
    d.setDate(d.getDate() + i)
    const iso = d.toISOString().slice(0, 10)
    if (await ensureRoundsForDate(iso)) okCount++
  }
  return okCount
}

/** ซ่อมรอบของวันให้ตรงแพทเทิร์น: สร้างที่ขาด + ปรับแถวที่ยังไม่มีออเดอร์ (current_count = 0)
 *  แถวที่มีออเดอร์แล้วไม่แตะ (คงเวลาเดิม — ออเดอร์ลูกค้าอ้างอิงอยู่) */
export async function applyPatternToDay(date: string, rows: RoundPatternRow[]): Promise<boolean> {
  await ensureRoundsForDate(date)
  const existing = await getRoundsForDateAdmin(date)
  const now = new Date().toISOString()
  for (const p of rows) {
    const row = existing.find((r) => (r.round_key || r.id) === p.round_key || r.id === `round-${date.replace(/-/g, '')}-${p.round_key}`)
    if (!row) continue
    if (Number(row.current_count) > 0) continue
    const needs =
      row.display_name !== p.display_name ||
      String(row.cutoff_time).slice(0, 5) !== p.cutoff_time ||
      String(row.pre_order_cutoff ?? '').slice(0, 5) !== p.pre_order_cutoff ||
      String(row.delivery_start).slice(0, 5) !== p.delivery_start ||
      String(row.delivery_end).slice(0, 5) !== p.delivery_end ||
      Number(row.max_capacity) !== Number(p.max_capacity)
    if (!needs) continue
    const { error } = await supabase
      .from('delivery_rounds')
      .update({
        display_name: p.display_name,
        cutoff_time: `${p.cutoff_time}:00`,
        // 148: คัทออฟเซมเดย์ถูกถอด — คงเฉพาะคัทออฟพรีออเดอร์ ('' = NULL = ใช้กฎ)
        pre_order_cutoff: p.pre_order_cutoff ? `${p.pre_order_cutoff}:00` : null,
        delivery_start: `${p.delivery_start}:00`,
        delivery_end: `${p.delivery_end}:00`,
        max_capacity: Number(p.max_capacity),
        updated_at: now,
      })
      .eq('id', row.id)
    if (error) { console.error('[applyPatternToDay] update error:', error); return false }
  }
  return true
}