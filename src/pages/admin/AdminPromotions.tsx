// ============================================
// Admin — Promotions Management (D5 gap, Phase D)
// ============================================

import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { showToast } from '@/components/ui/ToastContainer'
import { getPromotionsAdmin, upsertPromotion, deletePromotion, togglePromotion, type PromotionRow } from '@/lib/bmbAdminApi_promotions'

const EMPTY_FORM = {
  name: '',
  description: '',
  code: '',
  discount_type: 'percentage' as 'percentage' | 'fixed_amount',
  discount_value: 10,
  min_order_amount: 0,
  start_date: '',
  end_date: '',
  is_active: true,
  is_banner: false,
  banner_image: '',
}

export function AdminPromotions() {
  const [promotions, setPromotions] = useState<PromotionRow[]>([])
  const [showAddForm, setShowAddForm] = useState(false)
  const [editing, setEditing] = useState<PromotionRow | null>(null)
  const [form, setForm] = useState({ ...EMPTY_FORM })

  useEffect(() => { loadPromotions() }, [])

  async function loadPromotions() {
    setPromotions(await getPromotionsAdmin())
  }

  function openCreate() {
    setEditing(null)
    setForm({ ...EMPTY_FORM })
    setShowAddForm(true)
  }

  function openEdit(promo: PromotionRow) {
    setEditing(promo)
    setForm({
      name: promo.name,
      description: promo.description || '',
      code: promo.code || '',
      discount_type: promo.discount_type,
      discount_value: Number(promo.discount_value),
      min_order_amount: Number(promo.min_order_amount),
      start_date: (promo.start_date || '').slice(0, 10),
      end_date: (promo.end_date || '').slice(0, 10),
      is_active: promo.is_active,
      is_banner: promo.is_banner || false,
      banner_image: promo.banner_image || '',
    })
    setShowAddForm(true)
  }

  async function handleSave() {
    if (!form.name.trim()) {
      showToast('Please enter a name', 'warning')
      return
    }
    const row: PromotionRow = {
      id: editing?.id || '',
      ...form,
      discount_value: Number(form.discount_value),
      min_order_amount: Number(form.min_order_amount),
    }
    const saved = await upsertPromotion(row)
    if (!saved) {
      showToast('Failed to save promotion', 'error')
      return
    }
    showToast('Promotion saved!', 'success')
    setShowAddForm(false)
    loadPromotions()
  }

  async function handleToggle(promo: PromotionRow) {
    if (await togglePromotion(promo.id, !promo.is_active)) loadPromotions()
  }

  async function handleDelete(promo: PromotionRow) {
    if (await deletePromotion(promo.id)) {
      showToast('Promotion deleted', 'success')
      loadPromotions()
    }
  }

  return (
    <div className="max-w-7xl mx-auto px-4 py-6">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-3xl font-bold text-brand-accent">🎁 Promotions</h1>
        <Link to="/admin" className="btn btn-outline">← Dashboard</Link>
      </div>

      <div className="mb-4">
        <button onClick={openCreate} className="btn btn-primary">+ New Promotion</button>
      </div>

      {showAddForm && (
        <div className="card mb-6 p-4">
          <h3 className="font-bold text-brand-accent mb-3">{editing ? 'Edit' : 'New'} Promotion</h3>
          <div className="grid grid-cols-2 gap-3">
            <input className="input" placeholder="Name *" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            <input className="input" placeholder="Code (e.g. BMB10)" value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })} />
            <input className="input" placeholder="Description" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
            <select className="input" value={form.discount_type} onChange={(e) => setForm({ ...form, discount_type: e.target.value as any })}>
              <option value="percentage">Percentage (%)</option>
              <option value="fixed_amount">Fixed amount (฿)</option>
            </select>
            <input type="number" className="input" placeholder="Discount value" value={form.discount_value} onChange={(e) => setForm({ ...form, discount_value: Number(e.target.value) })} />
            <input type="number" className="input" placeholder="Min order amount" value={form.min_order_amount} onChange={(e) => setForm({ ...form, min_order_amount: Number(e.target.value) })} />
            <label className="text-sm flex items-center gap-2">
              Start:
              <input type="date" className="input" value={form.start_date} onChange={(e) => setForm({ ...form, start_date: e.target.value })} />
            </label>
            <label className="text-sm flex items-center gap-2">
              End:
              <input type="date" className="input" value={form.end_date} onChange={(e) => setForm({ ...form, end_date: e.target.value })} />
            </label>
            <label className="flex items-center gap-2">
              <input type="checkbox" checked={form.is_active} onChange={(e) => setForm({ ...form, is_active: e.target.checked })} />
              Active
            </label>
            <label className="flex items-center gap-2">
              <input type="checkbox" checked={form.is_banner} onChange={(e) => setForm({ ...form, is_banner: e.target.checked })} />
              🏠 Show as Home banner (dismissible by customers)
            </label>
            <input
              className="input"
              placeholder="Banner image URL (optional)"
              value={form.banner_image}
              onChange={(e) => setForm({ ...form, banner_image: e.target.value })}
            />
          </div>
          <div className="flex gap-3 mt-4">
            <button onClick={handleSave} className="btn btn-success">💾 Save</button>
            <button onClick={() => setShowAddForm(false)} className="btn btn-outline">Cancel</button>
          </div>
        </div>
      )}
<div className="space-y-3">
        {promotions.map((p) => (
          <div key={p.id} className="card">
            <div className="flex items-center justify-between mb-2">
              <div>
                <div className="font-bold text-brand-accent">
                  {p.name}
                  {p.code && <span className="ml-2 badge badge-primary">{p.code}</span>}
                </div>
                <div className="text-sm text-brand-muted">
                  {p.discount_type === 'percentage' ? `${p.discount_value}%` : `฿${p.discount_value}`} • min ฿{p.min_order_amount} • {p.start_date || '—'} → {p.end_date || '—'}
                </div>
              </div>
              <div className="text-right">
                <span className={`badge ${p.is_active ? 'badge-success' : 'badge-warning'}`}>{p.is_active ? 'Active' : 'Paused'}</span>
                <div className="flex gap-2 mt-1">
                  <button onClick={() => openEdit(p)} className="btn btn-outline text-sm">✏️ Edit</button>
                  <button onClick={() => handleToggle(p)} className="btn btn-outline text-sm">{p.is_active ? '⏸ Pause' : '▶ Activate'}</button>
                  <button onClick={() => handleDelete(p)} className="btn btn-danger text-sm">🗑 Delete</button>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>

      {promotions.length === 0 && (
        <div className="text-center py-12 text-brand-muted">No promotions yet — create one above.</div>
      )}
    </div>
  )
}