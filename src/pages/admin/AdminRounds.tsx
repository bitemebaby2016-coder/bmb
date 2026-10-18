// ============================================
// Admin — Delivery Rounds + Capacity (D8/D9 gap, Phase D)
// ============================================

import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { showToast } from '@/components/ui/ToastContainer'
import { getDeliveryRoundsAdmin, upsertDeliveryRound, setRoundStatus, resetRoundCapacity, type DeliveryRoundRow } from '@/lib/bmbAdminApi_rounds'
import { nextRoundStatus } from '@/lib/bmbMenuSchedule'
import { ToggleSwitch } from '@/components/admin/ToggleSwitch'
import { supabase } from '@/lib/supabase'

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
      showToast('บันทึกรอบไม่สำเร็จ - ลองอีกครั้ง', 'error')
      return
    }
    showToast('บันทึกรอบเรียบร้อยแล้ว', 'success')
    setEditing(null)
    loadRounds()
  }

  async function handleStatus(round: DeliveryRoundRow, status: string) {
    if (await setRoundStatus(round.id, status)) {
      showToast(status === 'active' ? `เปิดรับ "${round.display_name}" แล้ว` : `ปิดรับ "${round.display_name}" แล้ว`, 'success')
      loadRounds()
    }
  }

  async function handleResetCapacity(round: DeliveryRoundRow) {
    if (await resetRoundCapacity(round.id)) {
      showToast('รีเซ็ตจำนวนที่รับไว้เป็น 0 แล้ว', 'success')
      loadRounds()
    }
  }

  async function handleDelete(round: DeliveryRoundRow) {
    if (!window.confirm(`ลบรอบ "${round.display_name}" วันที่ ${round.scheduled_date}?\n• รอบที่มีออเดอร์อ้างอิงอยู่จะลบไม่ได้ (เก็บไว้เพื่อความถูกต้องของบัญชี)`)) return
    const { error } = await supabase.from('delivery_rounds').delete().eq('id', round.id)
    if (error) {
      if (String(error.code || '') === '23503' || String(error.message).includes('violates foreign key')) {
        showToast('ลบไม่ได้ — รอบนี้มีออเดอร์อ้างอิงอยู่', 'error')
      } else {
        showToast(`ลบรอบไม่สำเร็จ: ${error.message}`, 'error')
      }
      return
    }
    showToast('ลบรอบแล้ว', 'success')
    loadRounds()
  }

  return (
    <div className="max-w-7xl mx-auto px-4 py-6">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-3xl font-bold text-brand-accent">🕐 รอบจัดส่งและความจุ</h1>
        <Link to="/admin" className="btn btn-outline">← กลับหน้าภาพรวม</Link>
      </div>

      <div className="grid gap-4">
        {rounds.map((r) => (
          <div key={r.id} className="card">
            <div className="flex items-center justify-between mb-3">
              <div>
                <div className="font-bold text-brand-accent">{r.display_name}</div>
                <div className="text-sm text-brand-muted">
                  ปิดรับ {r.cutoff_time} • ส่ง {r.delivery_start}–{r.delivery_end} • {r.scheduled_date}
                </div>
              </div>
              <span className="badge badge-success">⚡ {r.current_count}/{r.max_capacity}</span>
            </div>

            {editing?.id === r.id ? (
              <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
                <input className="input" value={form.display_name} onChange={(e) => setForm({ ...form, display_name: e.target.value })} placeholder="ชื่อรอบ" />
                <label className="text-sm">ปิดรับ <input type="time" className="input" value={form.cutoff_time} onChange={(e) => setForm({ ...form, cutoff_time: e.target.value })} /></label>
                <label className="text-sm">เริ่มส่ง <input type="time" className="input" value={form.delivery_start} onChange={(e) => setForm({ ...form, delivery_start: e.target.value })} /></label>
                <label className="text-sm">สิ้นสุด <input type="time" className="input" value={form.delivery_end} onChange={(e) => setForm({ ...form, delivery_end: e.target.value })} /></label>
                <label className="text-sm">ความจุสูงสุด <input type="number" className="input" value={form.max_capacity} onChange={(e) => setForm({ ...form, max_capacity: Number(e.target.value) })} /></label>
                <div className="flex gap-2 mt-4">
                  <button onClick={handleSave} className="btn btn-success text-sm">บันทึก</button>
                  <button onClick={() => setEditing(null)} className="btn btn-outline text-sm">ยกเลิก</button>
                </div>
              </div>
            ) : (
              <div className="flex flex-wrap items-center gap-3">
                <button onClick={() => openEdit(r)} className="btn btn-outline text-sm">✏️ แก้ไข</button>
                <ToggleSwitch
                  checked={r.status === 'active'}
                  onChange={() => handleStatus(r, nextRoundStatus(r.status))}
                  label={r.status === 'active' ? 'เปิดรับ' : 'ปิดรับ'}
                  testId={`round-active-${r.id}`}
                />
                <button onClick={() => handleResetCapacity(r)} className="btn btn-outline text-sm">⟳ รีเซ็ตจำนวนที่รับ</button>
                <button onClick={() => void handleDelete(r)} className="btn btn-danger text-sm">🗑 ลบรอบนี้</button>
                <span className={`badge ${r.status === 'active' ? 'badge-success' : 'badge-warning'}`}>{r.status === 'active' ? 'เปิดรับ' : 'ปิดรับ'}</span>
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