// ============================================
// Bite Me Baby — Admin Menu Schedule (CAT-02, CAT-D02=A)
// Canonical backend: migration 039 menu_schedule + RPCs (no new schedule system).
// ============================================

import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { showToast } from '@/components/ui/ToastContainer'
import { getProducts, getDeliveryRounds } from '@/lib/bmbAdminApi_products'
import { getBusinessSettings } from '@/lib/bmbAdminApi_settings'
import { setMenuSchedule, publishMenuSchedule, getScheduleForDateAdmin, type ScheduleSetItem } from '@/lib/bmbMenuSchedule'
import type { Product, DeliveryRound } from '@/types'

const ROUND_KEY_OPTIONS = ['', 'morning', 'midday', 'evening']

export function AdminMenuSchedule() {
  const [date, setDate] = useState(new Date(Date.now() + 86400000).toISOString().slice(0, 10))
  const [maxDays, setMaxDays] = useState(50)
  const [products, setProducts] = useState<Product[]>([])
  const [rounds, setRounds] = useState<DeliveryRound[]>([])
  const [rows, setRows] = useState<{ id: string; product_id: string; delivery_round_key: string | null; is_published: boolean; note: string }[]>([])
  const [draft, setDraft] = useState<Record<string, string>>({}) // productId → round key ('' = all rounds, '__off__' = not on menu)
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [serverError, setServerError] = useState('')

  useEffect(() => {
    void (async () => {
      const [prods, rnds, settings] = await Promise.all([getProducts(), getDeliveryRounds(), getBusinessSettings()])
      setProducts(prods.filter((p) => !p.archived && p.is_available))
      setRounds(rnds)
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
      const r = await getScheduleForDateAdmin(d)
      setRows(r)
      const next: Record<string, string> = {}
      for (const row of r) next[row.product_id] = row.delivery_round_key ?? ''
      setDraft(next)
    } finally {
      setLoading(false)
    }
  }

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

        {serverError && (
          <div data-testid="schedule-server-error" className="mb-4 p-3 rounded-lg bg-red-50 text-red-700 text-sm border border-red-200">
            Server validation: <b>{serverError}</b>
          </div>
        )}

        <h3 className="font-bold text-brand-accent mb-2">เลือกสินค้าที่ขายได้ในวันนี้ (round key; ว่าง = ทุกรอบ)</h3>
        <div className="space-y-2 mb-4 max-h-96 overflow-y-auto">
          {products.map((p) => {
            const on = draft[p.id] !== undefined && draft[p.id] !== '__off__'
            return (
              <div key={p.id} className="flex items-center justify-between gap-3 px-3 py-2 rounded-lg bg-white">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input type="checkbox" checked={on}
                    onChange={(e) => setDraft((d) => {
                      const n = { ...d }
                      if (e.target.checked) n[p.id] = n[p.id] === '__off__' ? '' : (n[p.id] ?? '')
                      else n[p.id] = '__off__'
                      return n
                    })} />
                  <span className="font-medium text-brand-accent">{p.name}</span>
                  <span className="text-xs text-brand-muted">฿{p.price}</span>
                </label>
                {on && (
                  <select value={draft[p.id] || ''} onChange={(e) => setDraft((d) => ({ ...d, [p.id]: e.target.value }))} className="input max-w-40 text-xs">
                    {ROUND_KEY_OPTIONS.map((rk) => <option key={rk || 'all'} value={rk}>{rk === '' ? 'ทุกรอบ' : rk}</option>)}
                  </select>
                )}
              </div>
            )
          })}
        </div>

        <div className="flex gap-2">
          <button onClick={handleSave} disabled={saving} data-testid="schedule-save" className="btn btn-primary">💾 Save (replace-all)</button>
          {!isPublished ? (
            <button onClick={() => handlePublish(true)} disabled={saving || rows.length === 0} data-testid="schedule-publish" className="btn btn-outline">📢 Publish</button>
          ) : (
            <button onClick={() => handlePublish(false)} disabled={saving} className="btn btn-outline">🔕 Unpublish</button>
          )}
        </div>
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
                <li key={r.id}>
                  {r.is_published ? '✅' : '🟡'} <b>{prod?.name ?? r.product_id}</b> — round: {r.delivery_round_key || 'ทุกรอบ'} {r.note ? `· ${r.note}` : ''}
                </li>
              )
            })}
          </ul>
        )}
        <p className="text-xs text-brand-muted mt-3">
          Order-time authority: trg_menu_gate (039) — PRE_ORDER วันที่มี published menu สินค้านอกเมนูถูกปฏิเสธ (ERR_PRODUCT_NOT_ON_MENU) · trg_operating_hours — mode/round open-close · 038 — lead time + 2h cutoff
        </p>
      </div>
      {void rounds}
    </div>
  )
}
