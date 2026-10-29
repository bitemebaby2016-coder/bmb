// ============================================
// Admin — Delivery Rounds: แพทเทิร์น 3 รอบ/วัน + รอบรายวัน (จัดกลุ่มตามวัน)
// ============================================
// WHY (Owner 2026-10-24): "รอบจัดส่งในหน้าแอดมินมั่วมากซ้ำหลายอย่างหลายวัน —
// ทุกวันของพรีออเดอร์มีแค่ 3 รอบเหมือนเดิม ควรเป็นแพทเทิร์นเดียวกัน" → หน้านี้จัดการ
// (1) แพทเทิร์นรอบ 3 รอบ/วัน (order_pattern · migration 144 — template ของทุกวัน)
// (2) รอบรายวันแบบจัดกลุ่มตามวัน (ไม่ใช่การ์ดซ้ำยาวเหยียด)
// 148 (Owner 2026-10-24): SAME_DAY = เปิด–ปิดไม่มีปิดรอบ → หน้านี้เหลือปิดรอบเดียวคือ
//     ของพรีออเดอร์ (pre_order_cutoff) · ช่อง "ปิดรอบเซมเดย์" ถูกถอดออกจากแบบฟอร์มแล้ว

import { useState, useEffect, useCallback } from 'react'
import { Link } from 'react-router-dom'
import { showToast } from '@/components/ui/ToastContainer'
// R21d backlog: โหลดรอบส่งไม่สำเร็จต้องฟ้อง (toast อย่างเดียวหายไปเมื่อปิด)
import { LoadErrorBanner } from '@/components/ui/LoadErrorBanner'
import {
  getDeliveryRoundsAdmin,
  getArchivedRoundsAdmin,
  archiveRound,
  restoreRound,
  deleteRound,
  setRoundStatus,
  resetRoundCapacity,
  getRoundPattern,
  saveRoundPattern,
  ensureRoundsForDays,
  applyPatternToDay,
  type DeliveryRoundRow,
} from '@/lib/bmbAdminApi_rounds'
import { nextRoundStatus } from '@/lib/bmbMenuSchedule'
import { normalizeRoundPattern, type RoundPatternRow } from '@/lib/orderPolicy'
import { ToggleSwitch } from '@/components/admin/ToggleSwitch'
import { supabase } from '@/lib/supabase'

export function AdminRounds() {
  const [rounds, setRounds] = useState<DeliveryRoundRow[]>([])
  const [archived, setArchived] = useState<DeliveryRoundRow[]>([])
  const [pattern, setPattern] = useState<RoundPatternRow[]>([])
  const [savingPattern, setSavingPattern] = useState(false)
  const [busy, setBusy] = useState<string | null>(null)
  // R21d: โหลดล้มเหลว ≠ ไม่มีรอบ + รายการค้าง (banner ลองใหม่)
  const [loadError, setLoadError] = useState('')
  // Q3 (Owner อนุมัติ): "แพทเทิร์น + รอบรายวัน" รวมเป็นแท็บเดียว · archive = แท็บแยก
  const [tab, setTab] = useState<'manage' | 'archived'>('manage')

  const loadRounds = useCallback(async () => {
    setLoadError('')
    try {
      // R4: auto-close รอบของวันที่ผ่านไปแล้วก่อน list (148 — ไม่ปิดด้วย cutoff อีกแล้ว)
      await supabase.rpc('auto_close_expired_rounds').then(() => {}, () => {})
      const [active, arch] = await Promise.all([
        getDeliveryRoundsAdmin(),
        // 149 (P0-2): รายการ "ค้าง ลบไม่ได้" ต้องเห็น + จัดการได้ (เก็บ/กู้คืน/ลบ)
        getArchivedRoundsAdmin().catch(() => [] as DeliveryRoundRow[]),
      ])
      setRounds(active)
      setArchived(arch)
    } catch (e) {
      console.error('[AdminRounds] load failed:', e)
      setLoadError('โหลดรายการรอบส่งไม่สำเร็จ — ตรวจสอบการเชื่อมต่อแล้วกด "ลองใหม่"')
      showToast(`โหลดรายการรอบส่งไม่สำเร็จ: ${String((e as Error)?.message || e)}`, 'error')
    }
  }, [])

  useEffect(() => {
    void (async () => setPattern(await getRoundPattern()))()
    void loadRounds()
    // R3 (D-07): refresh on focus/visibility (โปรเจกต์ไม่ใช้ realtime — polling เท่านั้น)
    const onFocus = () => { void loadRounds() }
    window.addEventListener('focus', onFocus)
    document.addEventListener('visibilitychange', onFocus)
    return () => {
      window.removeEventListener('focus', onFocus)
      document.removeEventListener('visibilitychange', onFocus)
    }
  }, [loadRounds])

  async function handleSavePattern() {
    setSavingPattern(true)
    try {
      const err = await saveRoundPattern(normalizeRoundPattern(pattern))
      showToast(err ?? 'บันทึกแพทเทิร์นรอบแล้ว — รอบใหม่ของทุกวันจะใช้ค่านี้', err ? 'error' : 'success')
    } finally {
      setSavingPattern(false)
    }
  }

  async function handleEnsureAll() {
    setBusy('all')
    try {
      const ok = await ensureRoundsForDays(new Date().toISOString().slice(0, 10), 30)
      showToast(`สร้าง/ซ่อมรอบ 30 วันข้างหน้าตามแพทเทิร์นแล้ว (${ok} วัน)`, 'success')
      await loadRounds()
    } finally {
      setBusy(null)
    }
  }

  async function handleApplyDay(date: string) {
    setBusy(date)
    try {
      const ok = await applyPatternToDay(date, normalizeRoundPattern(pattern))
      showToast(ok ? `ซ่อมรอบวันที่ ${date} ตามแพทเทิร์นแล้ว` : `ซ่อมรอบวันที่ ${date} ไม่สำเร็จ`, ok ? 'success' : 'error')
      await loadRounds()
    } finally {
      setBusy(null)
    }
  }

  async function handleStatus(round: DeliveryRoundRow, status: string) {
    if (await setRoundStatus(round.id, status)) {
      showToast(status === 'active' ? `เปิดรับ "${round.display_name}" แล้ว` : `ปิดรับ "${round.display_name}" แล้ว`, 'success')
      void loadRounds()
    } else {
      showToast(`เปลี่ยนสถานะรอบ "${round.display_name}" ไม่สำเร็จ — ลองใหม่ หรือตรวจสิทธิ์`, 'error')
    }
  }

  async function handleResetCapacity(round: DeliveryRoundRow) {
    if (await resetRoundCapacity(round.id)) {
      showToast('รีเซ็ตจำนวนที่รับไว้เป็น 0 แล้ว', 'success')
      void loadRounds()
    } else {
      showToast('รีเซ็ตจำนวนที่รับไม่สำเร็จ — ลองใหม่', 'error')
    }
  }

  async function handleArchive(round: DeliveryRoundRow) {
    const err = await archiveRound(round.id)
    if (err) { showToast(err, 'error'); return }
    showToast(`เก็บรอบ "${round.display_name}" แล้ว — อยู่ในลิสต์ "ที่เก็บไว้" ด้านล่าง (กู้คืนได้)`, 'success')
    void loadRounds()
  }

  async function handleRestore(round: DeliveryRoundRow) {
    const err = await restoreRound(round.id)
    if (err) { showToast(err, 'error'); return }
    showToast(`กู้คืนรอบ "${round.display_name}" กลับเข้ารายการแล้ว (สถานะยังปิดรับ — กดเปิดเองได้)`, 'success')
    void loadRounds()
  }

  async function handleDelete(round: DeliveryRoundRow) {
    // 149 (P0-2): เหตุผลต้องตรงความจริง — FK (มีออเดอร์อ้างอิง) = ลบถาวรไม่ได้จริง
    const err = await deleteRound(round.id)
    if (err) { showToast(err, 'error'); return }
    showToast('ลบรอบถาวรแล้ว', 'success')
    void loadRounds()
  }

  // จัดกลุ่มรอบตามวัน — แทนการ์ดซ้ำยาวเหยียด (ต้นตอ "มั่วซ้ำหลายวัน")
  const byDate = new Map<string, DeliveryRoundRow[]>()
  for (const r of rounds) {
    const key = String(r.scheduled_date || 'ไม่มีวันที่')
    if (!byDate.has(key)) byDate.set(key, [])
    byDate.get(key)!.push(r)
  }
  const dates = [...byDate.keys()].sort()

  return (
    <div className="max-w-7xl mx-auto px-4 py-6">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-3xl font-bold text-brand-accent">🕐 รอบจัดส่ง — แพทเทิร์น 3 รอบ/วัน + รอบรายวัน</h1>
        <Link to="/admin" className="btn btn-outline">← กลับหน้าภาพรวม</Link>
      </div>

      {/* Q3 (Owner อนุมัติ 2026-10-24): แพทเทิร์น + รอบรายวัน = แท็บเดียว · archive แยกแท็บ */}
      <div className="flex flex-wrap gap-2 mb-4" role="tablist" aria-label="หมวดจัดการรอบ">
        {([
          ['manage', '📋 แพทเทิร์น + รอบรายวัน'],
          ['archived', `🗂 รอบที่เก็บไว้ (${archived.length})`],
        ] as const).map(([k, label]) => (
          <button
            key={k}
            role="tab"
            aria-selected={tab === k}
            onClick={() => setTab(k)}
            data-testid={`rounds-tab-${k}`}
            className={`btn text-sm ${tab === k ? 'btn-primary' : 'btn-outline'}`}
          >
            {label}
          </button>
        ))}
      </div>

      {/* ---- (1) แพทเทิร์นรอบของทุกวัน + (2) รอบรายวัน = แท็บเดียว (Q3) ---- */}
      {tab === 'manage' && (
        <>
      <div className="card mb-6" data-testid="round-pattern-panel">
        <h2 className="text-xl font-bold text-brand-accent mb-1">📋 แพทเทิร์นรอบประจำวัน (ทุกวันใช้ชุดเดียวกัน)</h2>
      <p className="text-sm text-brand-muted mb-4">
        ค่านี้คือต้นแบบของรอบทุกวัน (ทั้งพรีออเดอร์และเซมเดย์) — แก้ที่นี่ที่เดียว แล้วกด "สร้าง/ซ่อมรอบ 30 วัน"
        · <b>เซมเดย์ไม่มีปิดรอบ</b> — วิ่งปกติตั้งแต่ร้านเปิดถึงปิด (148) · ไม่มีช่องปิดรอบเดิม/ช่องปิดรอบเซมเดย์ในฟอร์มนี้อีก (D5 2026-10-25)
        · ปิดรอบมีทางเดียวคือ <b>ปรับของพรีออเดอร์</b> (ช่องว่าง = ใช้กฎรวม ก่อนส่ง X ชม.)
        · <b>ลำดับกันชน (audit D2):</b> ปิดรอบต่อรอบ (ช่อง "ปรับของพรีออเดอร์") ทับ{' '}
        <Link to="/admin/settings?tab=store">กฎรวม cutoff_hours (นโยบายสั่งซื้อ)</Link> — ว่าง = ใช้กฎรวมนั้น
      </p>
        <div className="space-y-3">
          {pattern.map((p, idx) => (
            <div key={p.round_key} className="grid grid-cols-2 lg:grid-cols-6 gap-3 items-end">
              <label className="text-sm">ชื่อรอบ
                <input className="input mt-1" value={p.display_name}
                  data-testid={`pattern-name-${p.round_key}`}
                  onChange={(e) => {
                    const next = [...pattern]
                    next[idx] = { ...p, display_name: e.target.value }
                    setPattern(next)
                  }} />
              </label>
              {/* D5 (Owner 2026-10-25 ไม่ผ่านเกณฑ์เดิม): ช่องปิดรอบเดิม (legacy cutoff field)
                  ถูกถอดออกจากฟอร์มนี้จริง — ปิดรอบมีเฉพาะพรีออเดอร์ (ช่องด้านล่าง) ·
                  ค่า cutoff_time ใน data ยังคงเดิมไว้ (ไม่แตะ production values) */}
              <label className="text-sm">ปรับของพรีออเดอร์
                <input type="time" className="input mt-1" value={p.pre_order_cutoff}
                  data-testid={`pattern-preorder-cutoff-${p.round_key}`}
                  title="ว่าง = ใช้กฎเดิม (ปิดรอบ X ชม. ก่อนเวลาส่ง)"
                  placeholder="ตามกฎ"
                  onChange={(e) => {
                    const next = [...pattern]
                    next[idx] = { ...p, pre_order_cutoff: e.target.value }
                    setPattern(next)
                  }} />
              </label>
              <label className="text-sm">เริ่มส่ง
                <input type="time" className="input mt-1" value={p.delivery_start}
                  onChange={(e) => {
                    const next = [...pattern]
                    next[idx] = { ...p, delivery_start: e.target.value }
                    setPattern(next)
                  }} />
              </label>
              <label className="text-sm">สิ้นสุด
                <input type="time" className="input mt-1" value={p.delivery_end}
                  onChange={(e) => {
                    const next = [...pattern]
                    next[idx] = { ...p, delivery_end: e.target.value }
                    setPattern(next)
                  }} />
              </label>
              <label className="text-sm">ความจุ
                <input type="number" className="input mt-1" value={p.max_capacity} min={1}
                  onChange={(e) => {
                    const next = [...pattern]
                    next[idx] = { ...p, max_capacity: Number(e.target.value) }
                    setPattern(next)
                  }} />
              </label>
              <div className="text-xs text-brand-muted pb-2">{p.round_key}</div>
            </div>
          ))}
        </div>
        <div className="flex flex-wrap gap-3 mt-4">
          <button onClick={() => void handleSavePattern()} disabled={savingPattern} className="btn btn-success" data-testid="save-round-pattern">
            {savingPattern ? 'กำลังบันทึก…' : 'บันทึกแพทเทิร์น'}
          </button>
          <button onClick={() => void handleEnsureAll()} disabled={busy !== null} className="btn btn-outline" data-testid="ensure-rounds-30d">
            {busy === 'all' ? 'กำลังสร้าง…' : 'สร้าง/ซ่อมรอบ 30 วันข้างหน้าตามแพทเทิร์น'}
          </button>
        </div>
      </div>

      {/* ---- (2) รอบรายวัน (จัดกลุ่มตามวัน — ไม่ใช่การ์ดซ้ำยาวเหยียด) ---- */}
      <h2 className="text-xl font-bold text-brand-accent mb-3">📅 รอบรายวัน</h2>
      <div className="space-y-4">
        {dates.map((date) => {
          const dayRounds = (byDate.get(date) || []).slice()
            .sort((a, b) => String(a.delivery_start).localeCompare(String(b.delivery_start)))
          return (
            <div key={date} className="card" data-testid={`round-day-${date}`}>
              <div className="flex items-center justify-between mb-3">
                <div className="font-bold text-brand-accent">{date}</div>
                <button onClick={() => void handleApplyDay(date)} disabled={busy !== null} className="btn btn-outline text-sm">
                  {busy === date ? 'กำลังซ่อม…' : 'ซ่อมตามแพทเทิร์น'}
                </button>
              </div>
              <div className="space-y-2">
                {dayRounds.map((r) => (
                  <div key={r.id} className="flex flex-wrap items-center gap-3 rounded-lg border border-brand-border p-2">
                    <div className="min-w-0 flex-1">
                      <div className="font-medium text-slate-800">{r.display_name || r.round_key || r.id}</div>
                      <div className="text-xs text-brand-muted">
                        ส่ง {String(r.delivery_start).slice(0, 5)}–{String(r.delivery_end).slice(0, 5)}
                        {' '}· เซมเดย์ไม่มีปิดรอบ (เปิด–ปิดร้าน)
                        {' '}· พรีออเดอร์ {r.pre_order_cutoff ? String(r.pre_order_cutoff).slice(0, 5) : 'ตามกฎ'}
                        {' '}· {r.current_count}/{r.max_capacity}
                      </div>
                    </div>
                    <ToggleSwitch
                      checked={r.status === 'active'}
                      onChange={() => void handleStatus(r, nextRoundStatus(r.status))}
                      label={r.status === 'active' ? 'เปิดรับ' : 'ปิดรับ'}
                      testId={`round-active-${r.id}`}
                    />
                    <button onClick={() => void handleResetCapacity(r)} className="btn btn-outline text-xs">⟳ รีเซ็ตจำนวน</button>
                    <button onClick={() => void handleArchive(r)} className="btn btn-outline text-xs" data-testid={`round-archive-${r.id}`}>📦 เก็บ</button>
                    <button onClick={() => void handleDelete(r)} className="btn btn-danger text-xs" data-testid={`round-delete-${r.id}`}>🗑 ลบ</button>
                  </div>
                ))}
              </div>
            </div>
          )
        })}
      </div>

        </>
      )}

      {/* R21d: โหลดล้มเหลวต้องฟ้อง + ลองใหม่ได้ (toast อย่างเดียวพอ/หายไปเร็ว) */}
      {loadError && (
        <div className="mb-4">
          <LoadErrorBanner message={loadError} onRetry={() => { void loadRounds() }} testId="rounds-load-error" />
        </div>
      )}

      {/* ---- (3) รอบที่เก็บไว้ (149 / P0-2 — "ลบไม่ได้") ---- */}
      {tab === 'archived' && (
      <div className="mt-8" data-testid="round-archived-panel">
        <h2 className="text-xl font-bold text-brand-accent mb-1">🗂 รอบที่เก็บไว้ {archived.length > 0 && `(${archived.length})`}</h2>
        <p className="text-sm text-brand-muted mb-3">
          รอบที่มีออเดอร์/ข้อมูลอ้างอิงอยู่จะ <b>ลบถาวรไม่ได้</b> (ฐานข้อมูลกันประวัติออเดอร์ไว้) — จัดการด้วยการ
          "เก็บ" แทนการลบ · กู้คืนได้ตลอดเวลา
        </p>
        {!loadError && archived.length === 0 ? (
          <div className="card text-sm text-brand-muted" data-testid="archived-empty">ยังไม่มีรอบที่เก็บไว้</div>
        ) : archived.length === 0 ? null : (
          <div className="card space-y-2">
            {archived.map((r) => (
              <div key={r.id} className="flex flex-wrap items-center gap-3 rounded-lg border border-brand-border p-2">
                <div className="min-w-0 flex-1">
                  <div className="font-medium text-slate-800">{r.display_name || r.round_key || r.id}</div>
                  <div className="text-xs text-brand-muted">
                    {r.scheduled_date} · ส่ง {String(r.delivery_start).slice(0, 5)}–{String(r.delivery_end).slice(0, 5)}
                    {' '}· {r.current_count}/{r.max_capacity} ที่ · เก็บแล้ว (archived)
                  </div>
                </div>
                <button onClick={() => void handleRestore(r)} className="btn btn-outline text-xs" data-testid={`round-restore-${r.id}`}>↩ กู้คืน</button>
                <button onClick={() => void handleDelete(r)} className="btn btn-danger text-xs" data-testid={`round-delete-archived-${r.id}`}>🗑 ลบถาวร</button>
              </div>
            ))}
          </div>
        )}
      </div>
      )}

      <div className="card mt-6 bg-brand-surface text-brand-muted text-sm">
        ⚠️ Capacity is enforced atomically in <code>create_order_with_items</code> (row lock) — raising
        <code>max_capacity</code> here takes effect immediately for new orders; existing pre-orders are unaffected.
        รอบที่มีออเดอร์แล้วจะไม่ถูก "ซ่อมตามแพทเทิร์น" แตะเวลา (คงข้อมูลเดิมให้ออเดอร์ลูกค้า)
        · <b>ลบทิ้งได้เฉพาะรอบที่ไม่มีใครอ้างอิง</b> — ถ้ามีออเดอร์ให้กด "📦 เก็บ" (149)
      </div>
    </div>
  )
}