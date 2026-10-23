// ============================================
// Bite Me Baby — Admin Menu Schedule (CAT-02, CAT-D02=A)
// Canonical backend: migration 039 menu_schedule + RPCs (no new schedule system).
// ============================================

import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { showToast } from '@/components/ui/ToastContainer'
import { getProducts } from '@/lib/bmbAdminApi_products'
import { getRoundsForDateAdmin, setRoundStatus, ensureRoundsForDate, type DeliveryRoundRow } from '@/lib/bmbAdminApi_rounds'
import { getBusinessSettings } from '@/lib/bmbAdminApi_settings'
import { setMenuSchedule, publishMenuSchedule, getScheduleForDateAdmin, getScheduleForWeek, isoWeekRange, summarizeWeek, checkPublishReady, roundKeyOptions, toggleDraftEntry, type ScheduleSetItem, type MenuScheduleRow } from '@/lib/bmbMenuSchedule'
import { ToggleSwitch } from '@/components/admin/ToggleSwitch'
import type { Product } from '@/types'

export function AdminMenuSchedule() {
  const [date, setDate] = useState(new Date(Date.now() + 86400000).toISOString().slice(0, 10))
  const [maxDays, setMaxDays] = useState(50)
  const [products, setProducts] = useState<Product[]>([])
  const [dateRounds, setDateRounds] = useState<DeliveryRoundRow[]>([]) // delivery_rounds ของวันที่เลือก (round key จริง)
  const [rows, setRows] = useState<MenuScheduleRow[]>([])
  const [weekRows, setWeekRows] = useState<MenuScheduleRow[]>([])
  const [draft, setDraft] = useState<Record<string, string>>({}) // productId → round key ('' = all rounds, '__off__' = not on menu)
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [serverError, setServerError] = useState('')

  useEffect(() => {
    void (async () => {
      const [prods, settings] = await Promise.all([getProducts(), getBusinessSettings()])
      setProducts(prods) // raw list — selectable/valid filters derived per render (canonical)
      const policy = (settings?.order_policy ?? {}) as Record<string, any>
      if (policy.preorder_max_days != null) setMaxDays(Number(policy.preorder_max_days) || 50)
    })()
  }, [])

  useEffect(() => {
    void loadDate(date)
  }, [date])

  async function loadDate(d: string) {
    setLoading(true)
    setServerError('')
    try {
      const [ws, we] = isoWeekRange(d)
      const [r, week, rnds] = await Promise.all([getScheduleForDateAdmin(d), getScheduleForWeek(ws, we), getRoundsForDateAdmin(d)])
      setRows(r)
      setWeekRows(week)
      setDateRounds(rnds)
      const next: Record<string, string> = {}
      for (const row of r) next[row.product_id] = row.delivery_round_key ?? ''
      setDraft(next)
    } finally {
      setLoading(false)
    }
  }

  // ✅ Phase 1: canonical validity = not archived, available, PRE_ORDER-eligible.
  // Client mirror only — publish_menu_schedule (migration 123) re-validates server-side.
  const isProductValid = (id: string) =>
    products.some((p) => p.id === id && !p.archived && p.is_available && (p.available_preorder ?? p.is_preorder ?? false))
  const selectable = products.filter((p) => !p.archived && p.is_available && (p.available_preorder ?? p.is_preorder ?? false))
  const weekSummary = summarizeWeek(isoWeekRange(date)[0], weekRows)
  const publishReady = checkPublishReady(rows, isProductValid)

  const isPublished = rows.length > 0 && rows.every((r) => r.is_published)

  async function handleSave() {
    setSaving(true)
    setServerError('')
    const items: ScheduleSetItem[] = Object.entries(draft)
      .filter(([, rk]) => rk !== '__off__')
      .map(([productId, rk]) => ({ product_id: productId, delivery_round_key: rk || null }))
    if (items.length === 0) {
      showToast('เลือกสินค้าอย่างน้อย 1 รายการ', 'warning')
      setSaving(false)
      return
    }
    const res = await setMenuSchedule(date, items)
    setSaving(false)
    if (!res.ok) {
      setServerError(res.error || 'ERR_MENU_SCHEDULE')
      showToast('บันทึกไม่สำเร็จ: ' + (res.error || ''), 'error')
      return
    }
    showToast('บันทึก schedule แล้ว (ยังไม่ publish)', 'success')
    loadDate(date)
  }

  async function handlePublish(publish: boolean) {
    setSaving(true)
    setServerError('')
    const res = await publishMenuSchedule(date, publish)
    setSaving(false)
    if (!res.ok) {
      setServerError(res.error || 'ERR_MENU_SCHEDULE')
      showToast((publish ? 'เผยแพร่' : 'ยกเลิกเผยแพร่') + 'ไม่สำเร็จ: ' + (res.error || ''), 'error')
      return
    }
    showToast(publish ? 'เผยแพร่เมนูวันนี้แล้ว — server บังคับใช้จริง (ERR_PRODUCT_NOT_ON_MENU)' : 'ยกเลิกเผยแพร่แล้ว', 'success')
    loadDate(date)
  }

  const today = new Date().toISOString().slice(0, 10)
  const maxDate = new Date(Date.now() + maxDays * 86400000).toISOString().slice(0, 10)

  return (
    <div className="max-w-5xl mx-auto px-4 py-6">
      <Link to="/admin" className="text-sm text-brand-muted hover:underline">← กลับแดชบอร์ด</Link>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-3xl font-bold text-brand-accent">🗓️ Menu Schedule (canonical — migration 039)</h1>
      </div>

      <div className="card mb-6 bg-brand-bg">
        <div className="flex flex-wrap items-center gap-3 mb-4">
          <div>
            <label className="block text-sm font-medium text-brand-accent mb-1">วันที่</label>
            <input type="date" data-testid="schedule-date" min={today} max={maxDate} value={date}
              onChange={(e) => setDate(e.target.value)} className="input" />
          </div>
          <div className="text-sm text-brand-muted">
            จัดเมนูล่วงหน้าได้ ≤ {maxDays} วัน (order_policy.preorder_max_days — server ตัดสินจริง)
          </div>
          {rows.length > 0 && (
            <span className={`badge ${isPublished ? 'badge-success' : 'badge-warning'}`}>
              {isPublished ? '✅ PUBLISHED — server บังคับใช้' : '🟡 DRAFT — ยังไม่บังคับ'}
            </span>
          )}
        </div>

        {/* ✅ Phase 1 week strip — Owner #1: 14 entries/week = exactly 2/day × 7 days.
            Color: green = published & exactly 2 · red = published แต่ count ≠ 2 (ผิดกฎ) ·
            yellow = draft · white = ยังไม่มี schedule */}
        <div className="flex flex-wrap gap-1 mb-4" data-testid="week-strip">
          {weekSummary.map((d) => {
            const sel = d.scheduled_date === date
            // R5 (Owner 2026-10-23): วันที่ผ่านรอบจัดส่ง = archive (เก็บทันที) — วนใช้
            // รอบถัดไปได้ แต่ไม่โชว์วันที่ผ่านแล้วแก่ลูกค้า
            const past = d.scheduled_date < new Date().toISOString().slice(0, 10)
            const cls = d.published
              ? (d.rows === 2 ? 'bg-green-100 text-green-800 border-green-300' : 'bg-red-100 text-red-800 border-red-300')
              : (d.rows > 0 ? 'bg-yellow-50 text-yellow-800 border-yellow-300' : 'bg-white text-brand-muted border')
            return (
              <button
                key={d.scheduled_date}
                type="button"
                onClick={() => setDate(d.scheduled_date)}
                data-testid={`week-day-${d.scheduled_date}`}
                className={`px-2 py-1 rounded-lg border text-xs font-medium ${cls} ${sel ? 'ring-2 ring-blue-400' : ''}`}
                title={`${d.scheduled_date} — ${d.rows} entries · ${d.published ? 'PUBLISHED' : d.rows > 0 ? 'draft' : 'ว่าง'}${past ? ' · จัดเก็บแล้ว (ผ่านรอบจัดส่ง — วนใช้รอบถัดไปได้)' : ''}`}
              >
                {d.scheduled_date.slice(5)} · {d.rows}/2 {d.published ? '✓' : ''}{past ? ' 📦' : ''}
              </button>
            )
          })}
        </div>

        {/* ✅ Round-key link (Owner 2026-10-17): ปุ่มเปิด/ปิดทุกรอบส่ง — ผูกกับ
            delivery_rounds ของวันนี้จริง (round key ชุดเดียวกับที่ pre-order/checkout ใช้) */}
        <div className="mb-4 p-3 rounded-xl bg-brand-surface border" data-testid="round-toggles">
          <h3 className="font-bold text-brand-accent mb-2">🚦 รอบส่งของวันนี้ (round key — ผูกกับ pre-order)</h3>
          {dateRounds.length === 0 ? (
            <div className="flex items-center gap-3">
              <p className="text-sm text-brand-muted">ยังไม่มีรอบส่งของวันนี้ — สร้างจากรอบหลัก (morning/midday/evening)</p>
              <button type="button" data-testid="rounds-ensure" className="btn btn-outline text-sm"
                onClick={async () => {
                  const ok = await ensureRoundsForDate(date)
                  showToast(ok ? 'สร้างรอบส่งของวันนี้แล้ว' : 'สร้างรอบไม่สำเร็จ — ใช้รอบที่มีอยู่', ok ? 'success' : 'error')
                  setDateRounds(await getRoundsForDateAdmin(date))
                }}>➕ สร้างรอบส่งของวันนี้</button>
            </div>
          ) : (
            <div className="space-y-2">
              {dateRounds.map((r) => (
                <div key={r.id} className="flex items-center justify-between gap-3 px-3 py-2 rounded-lg bg-white">
                  <div>
                    <div className="font-medium text-brand-accent">
                      {r.display_name} <span className="text-xs text-brand-muted">({r.round_key})</span>
                    </div>
                    <div className="text-xs text-brand-muted">
                      cutoff {String(r.cutoff_time || '').slice(0, 5)} • {String(r.delivery_start || '').slice(0, 5)}–{String(r.delivery_end || '').slice(0, 5)} • ⚡ {r.current_count}/{r.max_capacity}
                    </div>
                  </div>
                  <ToggleSwitch
                    checked={r.status === 'active'}
                    onChange={async (v) => {
                      const ok = await setRoundStatus(r.id, v ? 'active' : 'closed')
                      showToast(ok ? `รอบ ${r.display_name} ${v ? 'เปิดรับแล้ว' : 'ปิดรับแล้ว'}` : 'เปลี่ยนสถานะรอบไม่สำเร็จ', ok ? 'success' : 'error')
                      setDateRounds(await getRoundsForDateAdmin(date))
                    }}
                    label={r.status === 'active' ? 'เปิดรับ' : 'ปิดรับ'}
                    testId={`round-toggle-${r.round_key}`}
                  />
                </div>
              ))}
            </div>
          )}
          <p className="text-xs text-brand-muted mt-2">
            สวิตช์นี้คือ <code>delivery_rounds.status</code> — รอบปิดรับ = ลูกค้าเลือกไม่ได้ใน checkout และ create RPC ปฏิเสธ (ERR_ROUND_CLOSED) · dropdown รอบของเมนูด้านล่างผูกด้วย round key ชุดเดียวกัน
          </p>
        </div>

        {serverError && (
          <div data-testid="schedule-server-error" className="mb-4 p-3 rounded-lg bg-red-50 text-red-700 text-sm border border-red-200">
            Server validation: <b>{serverError}</b>
          </div>
        )}

        <h3 className="font-bold text-brand-accent mb-2">เลือก 2 เมนู PRE_ORDER ของวันนี้ (round key; ว่าง = ทุกรอบ) — draft ได้ไม่จำกัด, Publish ต้อง exactly 2 ที่ valid</h3>
        <div className="space-y-2 mb-4 max-h-96 overflow-y-auto">
          {selectable.map((p) => {
            const on = draft[p.id] !== undefined && draft[p.id] !== '__off__'
            return (
              <div key={p.id} className="flex items-center justify-between gap-3 px-3 py-2 rounded-lg bg-white">
                <ToggleSwitch
                  checked={on}
                  onChange={(v) => setDraft((d) => toggleDraftEntry(d, p.id, v))}
                  label={`${p.name} ฿${p.price}`}
                  testId={`schedule-product-${p.id}`}
                />
                {on && (
                  <select value={draft[p.id] || ''} data-testid={`schedule-round-${p.id}`}
                    onChange={(e) => setDraft((d) => ({ ...d, [p.id]: e.target.value }))}
                    className="input max-w-56 text-xs">
                    {roundKeyOptions(dateRounds).map((o) => <option key={o.key || 'all'} value={o.key}>{o.label}</option>)}
                  </select>
                )}
              </div>
            )
          })}
        </div>

        <div className="flex gap-2">
          <button onClick={handleSave} disabled={saving} data-testid="schedule-save" className="btn btn-primary">💾 Save (replace-all)</button>
          {!isPublished ? (
            <button onClick={() => handlePublish(true)} disabled={saving || !publishReady.ready} data-testid="schedule-publish" className="btn btn-outline">📢 Publish</button>
          ) : (
            <button onClick={() => handlePublish(false)} disabled={saving} className="btn btn-outline">🔕 Unpublish</button>
          )}
        </div>
        {!publishReady.ready && publishReady.reason && (
          <p className="text-xs text-amber-600 mt-2" data-testid="publish-reason">
            {publishReady.reason} — server บังคับเช่นกัน (ERR_MENU_COUNT_INVALID / ERR_PRODUCT_INVALID, migration 123)
          </p>
        )}
        {rows.length === 0 && !loading && <p className="text-xs text-brand-muted mt-2">ยังไม่มี schedule ของวันนี้ — Publish ต้อง Save ก่อน</p>}
      </div>

      <div className="card">
        <h3 className="font-bold text-brand-accent mb-2">Effective state (จาก DB — canonical)</h3>
        {rows.length === 0 ? (
          <p className="text-sm text-brand-muted">ไม่มี schedule — วันนี้ใช้ gate ปกติ (products.available_preorder)</p>
        ) : (
          <ul className="text-sm space-y-1">
            {rows.map((r) => {
              const prod = products.find((p) => p.id === r.product_id)
              return (
                <li key={r.id} data-testid={`effective-${r.product_id}`}>
                  {r.is_published ? '✅' : '🟡'} <b>{prod?.name ?? r.product_id}</b> — round: {r.delivery_round_key || 'ทุกรอบ'}{' '}
                  {!isProductValid(r.product_id) && (
                    <span className="text-red-600 font-bold">⚠️ ถูกปิด/ไม่ผ่านเกณฑ์ PRE_ORDER — Publish จะถูก server ปฏิเสธ</span>
                  )}{' '}
                  {r.note ? `· ${r.note}` : ''}
                </li>
              )
            })}
          </ul>
        )}
        <p className="text-xs text-brand-muted mt-3">
          Order-time authority: trg_menu_gate (039) — PRE_ORDER วันที่มี published menu สินค้านอกเมนูถูกปฏิเสธ (ERR_PRODUCT_NOT_ON_MENU) · trg_operating_hours — mode/round open-close · 038 — lead time + 2h cutoff
        </p>
      </div>
    </div>
  )
}
