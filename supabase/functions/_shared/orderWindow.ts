// ============================================
// Bite Me Baby — _shared/orderWindow.ts (R82 · 2026-11-08)
// ============================================
// WHY (Owner 2026-11-08 live test): "ไก่ทอดเลยรอบส่งของพรีออเดอร์ไปแล้ว แต่เอาไปใส่ตะกร้าให้
//   · ข้อมูลการขนส่ง/ประเภทออเดอร์/เวลา ผิด · ถ้าสั่ง pre-order เลยรอบแล้วให้แนะนำเมนูอื่น
//   ที่ยังสั่งได้บนเว็บ" — evidence `e2e/_r81b_evidence.json`:
//   คอมเมนต์ 02:58Z (09:58 BKK) "ยังสั่งได้อยู่" + ลิงก์ตะกร้า ทั้งที่ cutoff รอบเที่ยง = 09:00 ผ่านแล้ว
//
// ฝั่งเว็บมี rule นี้อยู่แล้ว (R77) แต่ AI social ไม่เคยใช้:
//   - src/lib/deliveryRoundStatus.ts → roundBookability (cutoff_passed/window_passed)
//   - src/lib/productSchedule.ts → isPreOrderDayPassed / pickNextScheduleDates
//   ไฟล์นี้ = MIRROR แบบ pure (ห้าม import ฝั่ง src/ — EF bundle) + ชั้นประเมินเมนูของเอไอ
//
// กติกา ZERO-FAKE (mirror เดิม): ข้อมูลขาด/เวลาไม่ครบ = ห้ามเดาและห้ามบล็อก
//   (server ยังตัดสินซ้ำตอนสั่งจริง) · data == null = ดึงไม่ได้ · [] = ไม่มีจริง
// ============================================

// ---- time helpers (mirror bangkokTime / deliveryRoundStatus.msOfDay) ----

/** 'HH:mm' / 'HH:mm:ss' → ms-of-day หรือ null (Number('') = 0 ต้อง reject ก่อน) */
function msOfDay(value: string | null | undefined): number | null {
  const raw = String(value ?? '').trim()
  if (!raw) return null
  const parts = raw.split(':')
  const h = Number(parts[0])
  const m = Number(parts[1] ?? 0)
  if (!Number.isFinite(h) || !Number.isFinite(m) || h < 0 || h > 23 || m < 0 || m > 59) return null
  return h * 3_600_000 + m * 60_000
}

/** วันนี้ตามปฏิทินไทย (UTC+7 คงที่) */
export function bkkToday(utcMs: number = Date.now()): string {
  return new Date(utcMs + 7 * 3_600_000).toISOString().slice(0, 10)
}

/** เวลา HH:MM ตามปฏิทินไทย ณ utcMs */
export function bkkHm(utcMs: number = Date.now()): string {
  return new Date(utcMs + 7 * 3_600_000).toISOString().slice(11, 16)
}

// ---- row shapes (subset ที่ต้องใช้ — ตรงคอลัมน์ delivery_rounds / menu_schedule จริง) ----

export interface WindowRound {
  scheduled_date?: string | null
  round_key?: string | null
  display_name?: string | null
  status?: string | null
  cutoff_time?: string | null
  pre_order_cutoff?: string | null
  delivery_start?: string | null
  delivery_end?: string | null
  current_count?: number | string | null
  max_capacity?: number | string | null
}

export interface WindowScheduleRow {
  product_id: string
  scheduled_date: string
  is_published?: boolean
  delivery_round_key?: string | null
}

export interface WindowProduct {
  id: string
  name?: string | null
  is_available?: boolean | null
}

// ---- PRE_ORDER cutoff (mirror roundCutoffMs mode PRE_ORDER) ----

/**
 * ค่า cutoff แบบ absolute (ms UTC) ของรอบในโหมด PRE_ORDER:
 *   pre_order_cutoff ของรอบ ถ้ามี · ไม่มี = delivery_start − 2 ชม. (order_policy default)
 *   คำนวณไม่ได้ = null (ห้ามเดา → ไม่ถือว่าเลยรอบ)
 */
export function roundPreOrderCutoffMs(r: WindowRound): number | null {
  const day = r.scheduled_date ? String(r.scheduled_date).slice(0, 10) : ''
  if (!day) return null
  const base = Date.parse(`${day}T00:00:00+07:00`)
  if (Number.isNaN(base)) return null
  const pre = msOfDay(r.pre_order_cutoff)
  if (pre !== null) return base + pre
  const start = msOfDay(r.delivery_start)
  if (start !== null) return base + start - 2 * 3_600_000
  return null
}

/** รอบ active/open (mirror ที่ caller ฝั่งเว็บกรอง status ก่อน) */
function roundIsActive(r: WindowRound): boolean {
  const s = String(r.status || '').toLowerCase()
  return s === 'active' || s === 'open'
}

function roundHasCapacity(r: WindowRound): boolean {
  const cap = Number(r.max_capacity)
  const used = Number(r.current_count)
  if (Number.isFinite(cap) && Number.isFinite(used) && cap > 0) return used < cap
  return true
}

/** รอบนี้ยัง "รับพรีออเดอร์" ไหม (mirror roundBookability mode PRE_ORDER) */
export function isRoundPreOrderOpen(r: WindowRound, utcMs: number = Date.now()): boolean {
  if (!roundIsActive(r) || !roundHasCapacity(r)) return false
  const day = r.scheduled_date ? String(r.scheduled_date).slice(0, 10) : ''
  const today = bkkToday(utcMs)
  if (day && day < today) return false // วันก่อน = ผ่านไปแล้ว
  if (day === today) {
    const cutoff = roundPreOrderCutoffMs(r)
    if (cutoff !== null && utcMs > cutoff) return false // cutoff_passed
    const end = msOfDay(r.delivery_end)
    const nowMs = (utcMs + 7 * 3_600_000) % 86_400_000
    if (end !== null && nowMs > end) return false // window_passed (PRE_ORDER — mirror m143/Q1)
  }
  return true
}

// ---- ports จาก src/lib/productSchedule.ts (R77 · Owner) — ใช้กฎเดียวกันเป๊ะ ----

/**
 * วันเมนูพรีออเดอร์ "เลยรอบ" แล้วไหม — port ของ `isPreOrderDayPassed`:
 * วันก่อนวันนี้ = true · วันถัดไป = false · วันนี้ = ทุกรอบไม่เปิดแล้ว · ไม่มีรอบ = true
 * (rounds = รอบ active ของวันนั้น ตามที่ฝั่งเว็บส่ง)
 */
export function isPreOrderDayPassed(
  dateISO: string,
  rounds: WindowRound[],
  opts: { nowUtcMs?: number; today?: string } = {},
): boolean {
  const utcMs = opts.nowUtcMs ?? Date.now()
  const today = opts.today ?? bkkToday(utcMs)
  if (dateISO < today) return true
  if (dateISO > today) return false
  if (!rounds || rounds.length === 0) return true
  return rounds.every((r) => !isRoundPreOrderOpen(r, utcMs))
}

/** port ของ `pickNextScheduleDates` — product_id → วันถัดไปที่ยังไม่เลยรอบ */
export function pickNextScheduleDates(
  rows: WindowScheduleRow[],
  today: string,
  opts?: { todayPassed?: boolean },
): Record<string, string> {
  const map: Record<string, string> = {}
  for (const r of rows || []) {
    if (!r || typeof r.product_id !== 'string' || !r.product_id) continue
    if (r.is_published === false) continue
    const d = r.scheduled_date
    if (typeof d !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(d) || d < today) continue
    if (opts?.todayPassed && d === today) continue
    const prev = map[r.product_id]
    if (!prev || d < prev) map[r.product_id] = d
  }
  return map
}

// ---- ชั้นประเมินของเอไอ: เมนูที่ลูกค้าถาม = สั่งได้ไหมตอนนี้ ----

export type ProductWindowReason =
  | 'pre_order_bookable' // มีวันในปฏิทินที่ยังจองได้
  | 'pre_order_day_passed' // เลยรอบพรีออเดอร์แล้ว (Owner: ห้ามใส่ตะกร้า)
  | 'same_day_open' // เมนูไม่มีปฏิทิน = เซมเดย์ · วันนี้ยังมีรอบว่าง
  | 'no_open_round_today' // เซมเดย์แต่วันนี้ไม่มีรอบว่าง
  | 'data_unavailable' // ดึงข้อมูลไม่ได้ = ห้ามบล็อก (ZERO-FAKE)

export interface ProductWindowStatus {
  product_id: string
  orderable: boolean
  reason: ProductWindowReason
  /** วันปฏิทินถัดไปที่ยังจองได้ (ถ้ามี) */
  nextDate: string | null
  /** ข้อความสั้นพร้อมใช้ใน note/prompt */
  detail: string
}

/**
 * ประเมินว่าเมนูยังสั่งได้ไหม ณ ตอนนี้:
 *   - มีแถว menu_schedule → พรีออเดอร์: วันถัดไปที่ยังไม่เลยรอบ (mirror R77) · ไม่มี = เลยรอบแล้ว
 *   - ไม่มีแถว → เซมเดย์: มีรอบวันนี้ active ว่าง = เปิด (m148: SAME_DAY ไม่มีปิดรอบ)
 *   - data = null → data_unavailable + orderable=true (ห้ามเดา/ห้ามบล็อก)
 */
export function assessProductWindows(
  productIds: string[],
  scheduleRows: WindowScheduleRow[] | null,
  rounds: WindowRound[] | null,
  productsById?: Map<string, WindowProduct>,
  opts: { nowUtcMs?: number } = {},
): ProductWindowStatus[] {
  const utcMs = opts.nowUtcMs ?? Date.now()
  const today = bkkToday(utcMs)
  if (scheduleRows === null || rounds === null) {
    return productIds.map((id) => ({
      product_id: id,
      orderable: true,
      reason: 'data_unavailable',
      nextDate: null,
      detail: 'ดึงข้อมูลรอบ/ปฎิทินไม่ได้ — ห้ามเดาเรื่องเวลา ให้ชวนดูที่ https://biteme-baby.com/shop',
    }))
  }
  const todayRounds = rounds.filter((r) => String(r.scheduled_date || '').slice(0, 10) === today)
  const out: ProductWindowStatus[] = []
  for (const id of productIds) {
    const rows = scheduleRows.filter((r) => r.product_id === id)
    if (rows.length > 0) {
      // R82g (Owner 2026-11-08 retest B8/B9): "อย่าใช้รอบส่งบอกลูกค้า — พรีออเดอร์สั่งได้จนคัทออฟ
      //   (lead 2 ชม.) ของรอบที่ยังเปิดเท่านั้น · แอดมินปิดรอบ (เย็น=ปิด) = เมนูวันนั้นสั่งไม่ได้"
      //   → scan วันจากแถวปฎิทินเอง (ascending ≥ วันนี้) · ต่อวัน:
      //   - ไม่มีแถวรอบวันนั้น: วันอนาคต = bookable (ZERO-FAKE mirror R77) · วันนี้ = ข้าม (mirror isPreOrderDayPassed)
      //   - ทุกรอบของวันไม่ผ่าน isRoundPreOrderOpen (ปิด/เต็ม/เลย cutoff/หมดหน้าต่าง) = ข้ามวันนี้ ไปวันถัดไป
      //   - ป้าย "ปิดรับ" = max cutoff ใน "รอบที่ยังเปิด" เท่านั้น — ห้ามเอา 16:00 ของรอบเย็นปิดมาโชว์
      const candDates = [...new Set(
        rows
          .map((r) => String(r.scheduled_date || '').slice(0, 10))
          .filter((d) => /^\d{4}-\d{2}-\d{2}$/.test(d) && d >= today),
      )].sort()
      let chosen: { date: string; label: string | null } | null = null
      for (const d of candDates) {
        const dayRounds = rounds.filter((r) => String(r.scheduled_date || '').slice(0, 10) === d)
        if (dayRounds.length === 0) {
          if (d > today) { chosen = { date: d, label: null }; break } // ไม่มีข้อมูลรอบอนาคต = ห้ามบล็อก (ZERO-FAKE)
          continue // วันนี้ไม่มีรอบ = ผ่าน (mirror isPreOrderDayPassed: [] = true)
        }
        const openRounds = dayRounds.filter((r) => isRoundPreOrderOpen(r, utcMs))
        if (openRounds.length === 0) continue // รอบถูกแอดมินปิด/เลย cutoff ทั้งวัน = ยังไม่ใช่วันนี้
        const cutoffs = openRounds
          .map(roundPreOrderCutoffMs)
          .filter((t): t is number => t !== null)
          .sort((a, b) => b - a)
        const label = cutoffs.length > 0
          ? new Date(cutoffs[0] + 7 * 3_600_000).toISOString().slice(11, 16)
          : null
        chosen = { date: d, label }
        break
      }
      if (chosen) {
        out.push({
          product_id: id,
          orderable: true,
          reason: 'pre_order_bookable',
          nextDate: chosen.date,
          detail: `พรีออเดอร์ได้สำหรับวัน ${chosen.date}` +
            (chosen.label
              ? ` (ปิดรับ ${chosen.label} น. ของวันนั้น — คิดจากรอบที่ยังเปิดเท่านั้น · แอดมินปิดรอบ = รอบนั้นสั่งไม่ได้)`
              : ' (ยังจองได้ — ดูเวลาปิดรับของรอบที่เลือกที่หน้าร้าน)'),
        })
        continue
      }
      out.push({
        product_id: id,
        orderable: false,
        reason: 'pre_order_day_passed',
        nextDate: null,
        detail: 'เลยรอบพรีออเดอร์ของวันนี้แล้ว (วันนี้ปิดรับทุกรอบ) — ห้ามบอกว่ายังสั่งได้ ห้ามแนบลิงก์ตะกร้า',
      })
      continue
    }
    // ไม่มีแถวปฏิทิน = เมนูเซมเดย์ (mirror m148: ไม่มีปิดรอบ — เหลือแค่รอบว่าง)
    const open = todayRounds.some((r) => roundIsActive(r) && roundHasCapacity(r))
    out.push({
      product_id: id,
      orderable: open,
      reason: open ? 'same_day_open' : 'no_open_round_today',
      nextDate: null,
      detail: open
        ? 'ส่งวันนี้ (Same Day) ได้ตามรอบที่เปิด'
        : 'วันนี้ไม่มีรอบจัดส่งว่าง — ให้บอกตามจริงและแนะนำรอบถัดไป',
    })
  }
  return out
}

/** ชื่อเมนูที่ยังสั่งได้ (จาก assessed) — ใช้เป็น "ทางเลือก" ตามคำสั่ง Owner */
export function recommendOrderableAlternatives(
  statuses: ProductWindowStatus[],
  productsById: Map<string, WindowProduct>,
  limit = 8,
): string[] {
  return statuses
    .filter((s) => s.orderable && s.reason !== 'data_unavailable')
    .slice(0, limit)
    .map((s) => productsById.get(s.product_id)?.name || s.product_id)
}

// ---- บล็อก prompt สำหรับคำตอบ (Owner: แยกประเภท/เวลา ให้ถูก + กฎแนะนำเมนู) ----

export function buildOrderWindowPrompt(
  scheduleRows: WindowScheduleRow[] | null,
  rounds: WindowRound[] | null,
  products: WindowProduct[] | null,
  opts: { nowUtcMs?: number } = {},
): string {
  const utcMs = opts.nowUtcMs ?? Date.now()
  const today = bkkToday(utcMs)
  const nowHm = bkkHm(utcMs)
  const rule =
    '- RULE (Owner 2026-11-08): เมื่อลูกค้าถามเมนูพรีออเดอร์ที่เลยรอบไปแล้ว → ตอบตามจริงว่า "ปิดรับแล้ว" ' +
    '(บอกปิดรับกี่โมงของวันนั้น) แล้วแนะนำเมนูอื่นที่ยังสั่งได้บนเว็บเท่านั้น = เมนูเซมเดย์ที่ยังเปิด + ' +
    'เมนูพรีออเดอร์วันถัดไปในปฎิทิน · ห้ามแนบ/อ้างลิงก์ตะกร้าของเมนูที่เลยรอบ · ' +
    'ทุกคำตอบที่พูดถึง เวลา/รอบ/การจัดส่ง ต้องระบุ ประเภทออเดอร์ ให้ถูก: "ส่งวันนี้ (Same Day)" หรือ "พรีออเดอร์ (Pre-Order)" · ' +
    'RULE เพิ่ม (Owner retest 2026-11-08 B8/B9): ห้ามยกเวลาคัทออฟ/รอบส่งของ "รอบอื่น" หรือ "รอบที่แอดมินปิดแล้ว" มาบอกลูกค้า — ' +
    'เวลาปิดรับพรีออเดอร์ที่ถูก = ของรอบที่ยังเปิด (ทุกวันนี้ = ก่อนเวลาส่ง 2 ชม. · เช่น เที่ยงส่ง 11:00 = ปิดรับ 09:00) · ' +
    'รอบที่ status=closed (เช่น รอบเย็นปิด) = เมนูรอบนั้นสั่งไม่ได้ ห้ามบอกว่ายังสั่งได้ถึงเวลาของรอบนั้น · ' +
    'SAME_DAY = ไม่มีปิดรอบตามรอบส่ง (บอกแค่ยังสั่งส่งวันนี้ได้/ไม่ได้ตามเวลาเปิด-ปิดร้าน) · ' +
    // D2 Attempt 1 (Owner 2026-11-09: SAME_DAY ยังตอบผิด "รอบเดียว 11:00-15:00 น."):
    '❌ ห้ามเด็ดขาด: ตอบ SAME_DAY เป็น "รอบเดียว HH:MM-HH:MM น." หรือยกเวลา delivery_start-end ของรอบวันนี้มาเป็น "รอบส่งเซมเดย์" — ' +
    'เวลาในบรรทัด "รอบวันนี้" ใช้กับ PRE_ORDER เท่านั้น · ' +
    'คำตอบ SAME_DAY ที่ถูกต้อง = "ส่งได้ตลอดเวลาที่ร้านเปิด ไม่มีรอบส่ง (ไม่ต้องเลือกรอบ)" เท่านั้น'
  if (!rounds || !scheduleRows) {
    return (
      '\n\n--- ORDER WINDOW (ดึงข้อมูลรอบ/ปฎิทินไม่ได้ — ZERO-FAKE) ---\n' +
      '- ดึงข้อมูลรอบส่ง/ปฎิทินเมนูไม่ได้ — ห้ามเดาเรื่องเวลา/รอบ/ประเภทออเดอร์ ' +
      'ให้บอกตามจริงว่าเช็คไม่ได้ในตอนนี้ และชวนดูเมนูล่าสุดที่ https://biteme-baby.com/shop\n' + rule
    )
  }
  const nameById = new Map<string, WindowProduct>((products || []).map((p) => [p.id, p]))
  const todayRounds = rounds.filter((r) => String(r.scheduled_date || '').slice(0, 10) === today)
  const roundLines = todayRounds.length > 0
    ? todayRounds.map((r) => {
        const label = r.display_name || r.round_key || 'รอบ'
        const win = `${r.delivery_start || '—'}-${r.delivery_end || '—'}`
        const st = roundIsActive(r) ? (roundHasCapacity(r) ? 'เปิด' : 'เต็ม') : 'ปิด'
        // R82g: รอบที่แอดมินปิด = ห้ามโชว์เวลาคัทออฟของรอบนั้น (ขัดกฎ Owner "ห้ามใช้รอบส่งบอกลูกค้า")
        const cutoff = roundIsActive(r) ? roundPreOrderCutoffMs(r) : null
        const cutoffTxt = !roundIsActive(r)
          ? 'ปิดรับพรีออเดอร์แล้ว (แอดมินปิดรอบนี้ — ห้ามอ้างเวลาของรอบนี้)'
          : cutoff === null
            ? 'ไม่มีข้อมูลปิดรับพรีออเดอร์ (ห้ามเดา)'
            : (utcMs > cutoff
                ? `ปิดรับพรีออเดอร์แล้ว (${new Date(cutoff + 7 * 3_600_000).toISOString().slice(11, 16)} น.)`
                : `ปิดรับพรีออเดอร์ ${new Date(cutoff + 7 * 3_600_000).toISOString().slice(11, 16)} น.`)
        // D2 Attempt 1: รอบ = PRE_ORDER เท่านั้น — ห้าม LLM ตีความว่าเป็น "รอบส่งเซมเดย์"
        return `  · ${label} ${win} น. (ใช้กับ PRE_ORDER เท่านั้น) = สถานะ ${st} · ${cutoffTxt} · SAME_DAY ไม่อิงรอบนี้ (ส่งได้ตลอดเวลาที่ร้านเปิด)`
      }).join('\n')
    : '  · ไม่มีรอบจัดส่งวันนี้'

  const statuses = assessProductWindows(
    [...new Set(scheduleRows.map((r) => r.product_id))],
    scheduleRows,
    rounds,
    nameById,
    { nowUtcMs: utcMs },
  )
  const blocked = statuses.filter((s) => s.reason === 'pre_order_day_passed')
  const bookable = statuses.filter((s) => s.reason === 'pre_order_bookable')
  const listLine = (arr: ProductWindowStatus[]) =>
    arr.slice(0, 12).map((s) => `${nameById.get(s.product_id)?.name || s.product_id} → ${s.detail}`).join(' · ')

  return (
    '\n\n--- ORDER WINDOW (สด — คำนวณจาก delivery_rounds + menu_schedule ณ เวลา ' + nowHm + ' น. ตามเวลาไทย) ---\n' +
    '- ประเภทออเดอร์ 2 แบบ (แยกให้ถูกทุกครั้งที่พูดถึง): ' +
    '① SAME_DAY "ส่งวันนี้" = เลือกได้จนร้านปิด/รอบเต็ม (ไม่มีปิดรอบ · ตอบว่า "ส่งได้ตลอดเวลาที่ร้านเปิด ไม่มีรอบส่ง" เท่านั้น — ห้ามบอก "รอบเดียว HH:MM-HH:MM") · ' +
    '② PRE_ORDER "พรีออเดอร์" = จองล่วงหน้าตามวันในปฎิทินเมนู ปิดรับตาม pre_order_cutoff ของรอบวันนั้น\n' +
    '- รอบวันนี้:\n' + roundLines + '\n' +
    '- เมนูพรีออเดอร์ "เลยรอบ" แล้ว (ห้ามบอกว่ายังสั่งได้ ห้ามแนบลิงก์ตะกร้า):\n  ' +
    (blocked.length > 0 ? listLine(blocked) : '  (ไม่มี)') + '\n' +
    '- เมนูพรีออเดอร์ที่ยังจองได้ (ใช้เป็นทางเลือกแนะนำ):\n  ' +
    (bookable.length > 0 ? listLine(bookable) : '  (ไม่มี)') + '\n' +
    rule
  )
}

// ---- thin fetch wrapper (mirror productSchedule: pure + cache สั้น ๆ กันยิงซ้ำ) ----

export interface OrderWindowData {
  schedule: WindowScheduleRow[]
  rounds: WindowRound[]
  products: WindowProduct[]
}

let cache: { atMs: number; data: OrderWindowData } | null = null
const TTL_MS = 60_000

/** ดึง menu_schedule (published ≥ วันนี้) + delivery_rounds (≥ วันนี้) + products ครั้งเดียว/60 วิ
 *  ตารางใดดึงไม่ได้ = null ทั้งชุด (ZERO-FAKE: caller ต้องไม่เดา/ไม่บล็อกมั่ว) */
export async function loadOrderWindow(
  sbUrl: string,
  serviceKey: string,
  nowMs: number = Date.now(),
): Promise<OrderWindowData | null> {
  if (cache && nowMs - cache.atMs < TTL_MS) return cache.data
  const today = bkkToday(nowMs)
  const get = async (p: string): Promise<unknown[] | null> => {
    try {
      const r = await fetch(sbUrl + p, {
        headers: { apikey: serviceKey, Authorization: 'Bearer ' + serviceKey, 'Content-Type': 'application/json' },
      })
      if (!r.ok) return null
      const j = await r.json()
      return Array.isArray(j) ? j : null
    } catch {
      return null
    }
  }
  const [schedule, rounds, products] = await Promise.all([
    get(`/rest/v1/menu_schedule?is_published=eq.true&scheduled_date=gte.${today}` +
      '&select=product_id,scheduled_date,is_published,delivery_round_key&order=scheduled_date.asc&limit=300'),
    get(`/rest/v1/delivery_rounds?scheduled_date=gte.${today}` +
      '&select=scheduled_date,round_key,display_name,status,cutoff_time,pre_order_cutoff,delivery_start,delivery_end,current_count,max_capacity' +
      '&order=scheduled_date.asc,delivery_start.asc&limit=120'),
    get('/rest/v1/products?select=id,name,is_available&archived=eq.false&limit=300'),
  ])
  if (!schedule || !rounds || !products) return null
  const data: OrderWindowData = {
    schedule: schedule as WindowScheduleRow[],
    rounds: rounds as WindowRound[],
    products: products as WindowProduct[],
  }
  cache = { atMs: nowMs, data }
  return data
}

/** ล้าง cache (ใช้ตอนทดสอบ) */
export function resetOrderWindowCache(): void {
  cache = null
}