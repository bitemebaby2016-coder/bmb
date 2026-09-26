// ============================================
// Admin — Delivery Rounds + Capacity (D8/D9 gap, Phase D)
// ============================================

import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { showToast } from '@/components/ui/ToastContainer'
import { getDeliveryRoundsAdmin, upsertDeliveryRound, setRoundStatus, resetRoundCapacity, type DeliveryRoundRow } from '@/lib/bmbAdminApi_rounds'

export function AdminRounds() {
  const [rounds, setRounds] = useState<DeliveryRoundRow[]>([])
  const [editing, setEditing] = useState<DeliveryRoundRow | null>(null)
  const [form, setForm] = useState({
    display_name: '',
    cutoff_time: '08:00',
    delivery_start: '06:00',
    delivery_end: '09:00',
    max_capacity: 100,
    status: 'active',
  })

  useEffect(() => { loadRounds() }, [])

  async function loadRounds() {
    setRounds(await getDeliveryRoundsAdmin())
  }

  function openEdit(round: DeliveryRoundRow) {
    setEditing(round)
    setForm({
      display_name: round.display_name,
      cutoff_time: (round.cutoff_time || '').slice(0, 5),
      delivery_start: (round.delivery_start || '').slice(0, 5),
      delivery_end: (round.delivery_end || '').slice(0, 5),
      max_capacity: Number(round.max_capacity),
      status: round.status,
    })
  }

  async function handleSave() {
    if (!editing) return
    const saved = await upsertDeliveryRound({
      ...editing,
      ...form,
      max_capacity: Number(form.max_capacity),
      cutoff_time: `${form.cutoff_time}:00`,
      delivery_start: `${form.delivery_start}:00`,
      delivery_end: `${form.delivery_end}:00`,
    })
    if (!saved) {
      showToast('Failed to save round', 'error')
      return
    }
    showToast('Round saved!', 'success')
    setEditing(null)
    loadRounds()
  }

  async function handleStatus(round: DeliveryRoundRow, status: string) {
    if (await setRoundStatus(round.id, status)) {
      showToast(`Round ${status}`, 'success')
      loadRounds()
    }
  }

  async function handleResetCapacity(round: DeliveryRoundRow) {
    if (await resetRoundCapacity(round.id)) {
      showToast('Capacity reset to 0', 'success')
      loadRounds()
    }
  }

  return (
    <div className="max-w-7xl mx-auto px-4 py-6">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-3xl font-bold text-brand-accent">🕐 Delivery Rounds & Capacity</h1>
        <Link to="/admin" className="btn btn-outline">← Dashboard</Link>
      </div>

      <div className="grid gap-4">
        {rounds.map((r) => (
          <div key={r.id} className="card">
            <div className="flex items-center justify-between mb-3">
              <div>
                <div className="font-bold text-brand-accent">{r.display_name} <span className="badge badge-primary">{r.id}</span></div>
                <div className="text-sm text-brand-muted">
                  Cutoff {r.cutoff_time} • {r.delivery_start}–{r.delivery_end} • {r.scheduled_date}
                </div>
              </div>
              <span className="badge badge-success">⚡ {r.current_count}/{r.max_capacity}</span>
            </div>

            {editing?.id === r.id ? (
              <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
                <input className="input" value={form.display_name} onChange={(e) => setForm({ ...form, display_name: e.target.value })} placeholder="Round name" />
                <label className="text-sm">Cutoff <input type="time" className="input" value={form.cutoff_time} onChange={(e) => setForm({ ...form, cutoff_time: e.target.value })} /></label>
                <label className="text-sm">Start <input type="time" className="input" value={form.delivery_start} onChange={(e) => setForm({ ...form, delivery_start: e.target.value })} /></label>
                <label className="text-sm">End <input type="time" className="input" value={form.delivery_end} onChange={(e) => setForm({ ...form, delivery_end: e.target.value })} /></label>
                <label className="text-sm">Max capacity <input type="number" className="input" value={form.max_capacity} onChange={(e) => setForm({ ...form, max_capacity: Number(e.target.value) })} /></label>
                <div className="flex gap-2 mt-4">
                  <button onClick={handleSave} className="btn btn-success text-sm">Save</button>
                  <button onClick={() => setEditing(null)} className="btn btn-outline text-sm">Cancel</button>
                </div>
              </div>
            ) : (
              <div className="flex flex-wrap gap-2">
                <button onClick={() => openEdit(r)} className="btn btn-outline text-sm">✏️ Edit</button>
                {r.status === 'active' ? (
                  <button onClick={() => handleStatus(r, 'closed')} className="btn btn-outline text-sm">⏸ Close round</button>
                ) : (
                  <button onClick={() => handleStatus(r, 'active')} className="btn btn-success text-sm">▶ Open round</button>
                )}
                <button onClick={() => handleResetCapacity(r)} className="btn btn-outline text-sm">⟳ Reset capacity</button>
                <span className={`badge ${r.status === 'active' ? 'badge-success' : 'badge-warning'}`}>{r.status}</span>
              </div>
            )}
          </div>
        ))}
      </div>

      <div className="card mt-6 bg-brand-surface text-brand-muted text-sm">
        ⚠️ Capacity is enforced atomically in <code>create_order_with_items</code> (row lock) — raising
        <code>max_capacity</code> here takes effect immediately for new orders; existing pre-orders are unaffected.
      </div>
    </div>
  )
}