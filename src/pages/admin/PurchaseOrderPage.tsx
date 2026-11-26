// ============================================
// Bite Me Baby — Admin Purchase Orders (Phase 2 WP3)
// PO list + create/edit (draft/submitted) + submit + approve (finance/admin)
// ใช้ API จริง (migration 224) — ห้าม mock
// ============================================

import { useState, useEffect, useCallback, useMemo } from 'react'
import {
  getPurchaseOrders,
  getPurchaseOrderById,
  createPurchaseOrder,
  updatePurchaseOrder,
  submitPurchaseOrder,
  approvePurchaseOrder,
  type PurchaseOrderHeader,
  type PurchaseOrderLine,
  type PurchaseOrderLineForm,
  type POStatus,
} from '@/lib/bmbAdminApi_purchaseOrders'
import { getAllSuppliers, type Supplier } from '@/lib/bmbAdminApi_suppliers'
import { getSupplierProducts, type SupplierProduct } from '@/lib/bmbAdminApi_supplierProducts'
import { showToast } from '@/components/ui/ToastContainer'
import { LoadErrorBanner } from '@/components/ui/LoadErrorBanner'

interface POLineDraft extends PurchaseOrderLineForm {
  key: string
}

const STATUS_META: Record<POStatus, { bg: string; text: string; label: string }> = {
  draft: { bg: 'bg-gray-100', text: 'text-gray-700', label: 'ฉบับร่าง' },
  submitted: { bg: 'bg-amber-100', text: 'text-amber-800', label: 'รออนุมัติ' },
  approved: { bg: 'bg-blue-100', text: 'text-blue-800', label: 'อนุมัติแล้ว' },
  ordered: { bg: 'bg-indigo-100', text: 'text-indigo-800', label: 'สั่งซื้อแล้ว' },
  partially_received: { bg: 'bg-purple-100', text: 'text-purple-800', label: 'รับบางส่วน' },
  completed: { bg: 'bg-green-100', text: 'text-green-800', label: 'เสร็จสิ้น' },
  cancelled: { bg: 'bg-gray-200', text: 'text-gray-600', label: 'ยกเลิก' },
  rejected: { bg: 'bg-red-100', text: 'text-red-700', label: 'ปฏิเสธ' },
  closed: { bg: 'bg-gray-200', text: 'text-gray-600', label: 'ปิด' },
}

const EDITABLE: POStatus[] = ['draft', 'submitted']

function newLine(): POLineDraft {
  return { key: `ln-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`, supplier_product_id: '', ordered_qty: 1, unit_price: undefined, line_discount: 0 }
}

export function PurchaseOrderPage() {
  const [orders, setOrders] = useState<PurchaseOrderHeader[]>([])
  const [suppliers, setSuppliers] = useState<Supplier[]>([])
  const [products, setProducts] = useState<SupplierProduct[]>([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState('')
  const [statusFilter, setStatusFilter] = useState<'all' | POStatus>('all')
  const [search, setSearch] = useState('')

  const [showForm, setShowForm] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editingVersion, setEditingVersion] = useState<number>(1)
  const [supplierId, setSupplierId] = useState('')
  const [expectedDate, setExpectedDate] = useState('')
  const [notes, setNotes] = useState('')
  const [lines, setLines] = useState<POLineDraft[]>([newLine()])
  const [saving, setSaving] = useState(false)
  const [formError, setFormError] = useState('')

  const [detail, setDetail] = useState<{ header: PurchaseOrderHeader; lines: PurchaseOrderLine[] } | null>(null)
  const [detailLoading, setDetailLoading] = useState(false)

  const loadAll = useCallback(async () => {
    setLoading(true)
    setLoadError('')
    try {
      const [pos, sups, prods] = await Promise.all([
        getPurchaseOrders(),
        getAllSuppliers(true),
        getSupplierProducts(),
      ])
      setOrders(pos)
      setSuppliers(sups)
      setProducts(prods)
    } catch (e) {
      console.error('[PurchaseOrderPage] load failed:', e)
      setLoadError('โหลดข้อมูลใบสั่งซื้อไม่สำเร็จ — ตรวจสอบการเชื่อมต่อแล้วกด "ลองใหม่"')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { void loadAll() }, [loadAll])

  const filtered = useMemo(() => {
    let r = [...orders]
    if (statusFilter !== 'all') r = r.filter(o => o.status === statusFilter)
    if (search.trim()) {
      const q = search.toLowerCase()
      r = r.filter(o => o.po_number.toLowerCase().includes(q) || (o.notes || '').toLowerCase().includes(q))
    }
    return r
  }, [orders, statusFilter, search])

  const supplierProducts = useMemo(
    () => products.filter(p => p.supplier_id === supplierId && p.is_active),
    [products, supplierId],
  )

  function resetForm() {
    setShowForm(false)
    setEditingId(null)
    setEditingVersion(1)
    setSupplierId('')
    setExpectedDate('')
    setNotes('')
    setLines([newLine()])
    setFormError('')
  }

  function startCreate() {
    resetForm()
    setShowForm(true)
  }

  async function startEdit(id: string) {
    setDetailLoading(true)
    try {
      const full = await getPurchaseOrderById(id)
      if (!full) { showToast('ไม่พบใบสั่งซื้อ', 'error'); return }
      setEditingId(id)
      setEditingVersion(full.version)
      setSupplierId(full.supplier_id)
      setExpectedDate(full.expected_date || '')
      setNotes(full.notes || '')
      setLines(full.lines.map(l => ({
        key: l.id,
        supplier_product_id: l.supplier_product_id,
        ordered_qty: l.ordered_qty,
        unit_price: l.unit_price,
        line_discount: l.line_discount,
      })))
      setFormError('')
      setShowForm(true)
    } catch (e) {
      console.error('[PurchaseOrderPage] startEdit failed:', e)
      showToast('โหลดรายละเอียดไม่สำเร็จ', 'error')
    } finally {
      setDetailLoading(false)
    }
  }

  function updateLine(key: string, patch: Partial<POLineDraft>) {
    setLines(prev => prev.map(l => l.key === key ? { ...l, ...patch } : l))
  }

  function addLine() { setLines(prev => [...prev, newLine()]) }
  function removeLine(key: string) {
    setLines(prev => prev.length <= 1 ? prev : prev.filter(l => l.key !== key))
  }

  async function handleSave() {
    setFormError('')
    if (!supplierId) { setFormError('กรุณาเลือกผู้ขาย'); return }
    const clean = lines.filter(l => l.supplier_product_id && l.ordered_qty > 0)
    if (clean.length === 0) { setFormError('กรุณาเพิ่มรายการอย่างน้อย 1 รายการที่ถูกต้อง'); return }
    setSaving(true)
    try {
      if (editingId) {
        const res = await updatePurchaseOrder(editingId, editingVersion, {
          lines: clean,
          expected_date: expectedDate || null,
          notes: notes || null,
        })
        if (!res.ok) { setFormError('บันทึกไม่สำเร็จ (อาจมีคนแก้ไขพร้อมกัน — ลองใหม่)'); return }
        showToast('อัปเดตใบสั่งซื้อสำเร็จ', 'success')
      } else {
        const res = await createPurchaseOrder({
          supplier_id: supplierId,
          lines: clean,
          expected_date: expectedDate || null,
          notes: notes || null,
        })
        if (!res.ok || !res.po_id) { setFormError('สร้างใบสั่งซื้อไม่สำเร็จ'); return }
        showToast(`สร้างใบสั่งซื้อ ${res.po_number || ''} สำเร็จ`, 'success')
      }
      resetForm()
      await loadAll()
    } catch (e) {
      console.error('[PurchaseOrderPage] save failed:', e)
      setFormError('เกิดข้อผิดพลาดในการบันทึก')
    } finally {
      setSaving(false)
    }
  }

  async function handleSubmit(id: string) {
    if (!confirm('ยืนยันส่งใบสั่งซื้อนี้เพื่อขออนุมัติ?')) return
    try {
      const res = await submitPurchaseOrder(id)
      if (!res.ok) { showToast('ส่งไม่สำเร็จ (สถานะอาจเปลี่ยนแล้ว)', 'error'); return }
      showToast('ส่งใบสั่งซื้อเรียบร้อย (รออนุมัติ)', 'success')
      await loadAll()
    } catch (e) {
      console.error('[PurchaseOrderPage] submit failed:', e)
      showToast('เกิดข้อผิดพลาด', 'error')
    }
  }

  async function handleApprove(id: string) {
    if (!confirm('ยืนยันอนุมัติใบสั่งซื้อนี้? (สิทธิ์ finance/admin)')) return
    try {
      const res = await approvePurchaseOrder(id)
      if (!res.ok) { showToast('อนุมัติไม่สำเร็จ (ต้องมีสิทธิ์ finance/admin + สถานะรออนุมัติ)', 'error'); return }
      showToast('อนุมัติใบสั่งซื้อสำเร็จ', 'success')
      await loadAll()
    } catch (e) {
      console.error('[PurchaseOrderPage] approve failed:', e)
      showToast('เกิดข้อผิดพลาด', 'error')
    }
  }

  async function openDetail(id: string) {
    setDetailLoading(true)
    setDetail(null)
    try {
      const full = await getPurchaseOrderById(id)
      if (full) setDetail({ header: full, lines: full.lines })
    } catch (e) {
      console.error('[PurchaseOrderPage] detail failed:', e)
      showToast('โหลดรายละเอียดไม่สำเร็จ', 'error')
    } finally {
      setDetailLoading(false)
    }
  }

  const total = lines.reduce((s, l) => s + (l.ordered_qty * (l.unit_price ?? 0)) - (l.line_discount ?? 0), 0)

  return (
    <div className="max-w-7xl mx-auto px-4 py-6">
      <div className="flex items-center justify-between mb-6 flex-wrap gap-2">
        <h1 className="text-3xl font-bold text-brand-accent">📝 ใบสั่งซื้อ (Purchase Order)</h1>
        <div className="flex gap-2">
          <button onClick={loadAll} className="btn btn-outline text-sm" disabled={loading}>รีเฟรช</button>
          <button onClick={startCreate} className="btn btn-primary">+ สร้างใบสั่งซื้อ</button>
        </div>
      </div>

      {loading && <div className="card text-center py-8"><p className="text-brand-muted">กำลังโหลดข้อมูล...</p></div>}
      {loadError && <div className="mb-4"><LoadErrorBanner message={loadError} onRetry={loadAll} testId="po-load-error" /></div>}

      <div className="card mb-4">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 p-3 bg-brand-bg rounded-lg">
          <div>
            <label className="block text-xs text-brand-muted mb-1">ค้นหา (เลขที่ / โน้ต)</label>
            <input type="text" placeholder="PO-YYYYMMDD-..." value={search} onChange={e => setSearch(e.target.value)} className="input text-sm" />
          </div>
          <div>
            <label className="block text-xs text-brand-muted mb-1">สถานะ</label>
            <select value={statusFilter} onChange={e => setStatusFilter(e.target.value as any)} className="input text-sm">
              <option value="all">ทั้งหมด</option>
              {(Object.keys(STATUS_META) as POStatus[]).map(s => <option key={s} value={s}>{STATUS_META[s].label}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs text-brand-muted mb-1">จำนวนรายการ</label>
            <div className="text-sm font-bold text-brand-accent">{filtered.length} / {orders.length}</div>
          </div>
        </div>
      </div>

      {showForm && (
        <div className="card mb-6 bg-brand-bg">
          <h3 className="font-bold text-brand-accent mb-4">{editingId ? '✏️ แก้ไขใบสั่งซื้อ' : '➕ สร้างใบสั่งซื้อใหม่'}</h3>
          {formError && <div className="mb-3 text-red-600 text-sm">{formError}</div>}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
            <div>
              <label className="block text-sm font-medium text-brand-muted mb-1">ผู้ขาย <span className="text-red-500">*</span></label>
              <select value={supplierId} onChange={e => setSupplierId(e.target.value)} className="input" disabled={!!editingId}>
                <option value="">— เลือกผู้ขาย —</option>
                {suppliers.filter(s => s.is_active).map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-brand-muted mb-1">วันที่คาดว่าจะได้รับ</label>
              <input type="date" value={expectedDate} onChange={e => setExpectedDate(e.target.value)} className="input" />
            </div>
            <div>
              <label className="block text-sm font-medium text-brand-muted mb-1">โน้ต</label>
              <input type="text" value={notes} onChange={e => setNotes(e.target.value)} className="input" placeholder="เช่น ขอส่งเช้า" />
            </div>
          </div>

          <h4 className="font-semibold text-brand-accent mb-2">รายการสินค้า</h4>
          <div className="overflow-x-auto mb-3">
            <table className="w-full text-left text-sm">
              <thead className="bg-brand-bg">
                <tr>
                  <th className="p-2">วัตถุดิบ (ผู้ขาย)</th>
                  <th className="p-2">จำนวนสั่ง</th>
                  <th className="p-2">ราคา/หน่วยซื้อ</th>
                  <th className="p-2">ส่วนลด</th>
                  <th className="p-2">รวม</th>
                  <th className="p-2"></th>
                </tr>
              </thead>
              <tbody>
                {lines.map(l => (
                  <tr key={l.key} className="border-b border-brand-border">
                    <td className="p-2">
                      <select value={l.supplier_product_id} onChange={e => {
                        const sp = products.find(p => p.id === e.target.value)
                        updateLine(l.key, { supplier_product_id: e.target.value, unit_price: sp?.last_approved_price ?? undefined })
                      }} className="input text-sm">
                        <option value="">— เลือกวัตถุดิบ —</option>
                        {supplierProducts.map(p => <option key={p.id} value={p.id}>{p.supplier_name || p.ingredient_id} ({p.purchase_unit})</option>)}
                      </select>
                    </td>
                    <td className="p-2"><input type="number" min="0" step="0.01" value={l.ordered_qty} onChange={e => updateLine(l.key, { ordered_qty: Number(e.target.value) })} className="input text-sm w-24" /></td>
                    <td className="p-2"><input type="number" min="0" step="0.01" value={l.unit_price ?? ''} onChange={e => updateLine(l.key, { unit_price: e.target.value === '' ? undefined : Number(e.target.value) })} className="input text-sm w-24" /></td>
                    <td className="p-2"><input type="number" min="0" step="0.01" value={l.line_discount ?? 0} onChange={e => updateLine(l.key, { line_discount: Number(e.target.value) })} className="input text-sm w-24" /></td>
                    <td className="p-2 font-medium">{((l.ordered_qty * (l.unit_price ?? 0)) - (l.line_discount ?? 0)).toFixed(2)}</td>
                    <td className="p-2"><button onClick={() => removeLine(l.key)} className="btn btn-outline text-xs text-red-600">ลบ</button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="flex items-center justify-between mb-4">
            <button onClick={addLine} className="btn btn-outline text-sm">+ เพิ่มรายการ</button>
            <div className="text-lg font-bold text-brand-accent">รวมทั้งสิ้น: ฿{total.toFixed(2)}</div>
          </div>
          <div className="flex gap-3">
            <button onClick={handleSave} className="btn btn-primary" disabled={saving}>{saving ? 'กำลังบันทึก...' : 'บันทึก'}</button>
            <button onClick={resetForm} className="btn btn-outline">ยกเลิก</button>
          </div>
        </div>
      )}

      {detailLoading && <div className="card text-center py-6 text-brand-muted">กำลังโหลดรายละเอียด...</div>}
      {detail && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50" onClick={() => setDetail(null)}>
          <div className="bg-white rounded-2xl shadow-xl max-w-3xl w-full max-h-[80vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between p-4 border-b">
              <h3 className="font-bold text-brand-accent text-lg">📋 {detail.header.po_number}</h3>
              <button onClick={() => setDetail(null)} className="p-2 rounded-lg hover:bg-brand-bg">✕</button>
            </div>
            <div className="p-4">
              <div className="grid grid-cols-2 md:grid-cols-3 gap-3 mb-4 text-sm">
                <div><span className="text-brand-muted">สถานะ</span><div><span className={`badge ${STATUS_META[detail.header.status].bg} ${STATUS_META[detail.header.status].text}`}>{STATUS_META[detail.header.status].label}</span></div></div>
                <div><span className="text-brand-muted">วันที่สั่ง</span><div>{detail.header.order_date}</div></div>
                <div><span className="text-brand-muted">คาดได้รับ</span><div>{detail.header.expected_date || '-'}</div></div>
                <div><span className="text-brand-muted">ยอดรวม</span><div className="font-bold">฿{detail.header.total_amount}</div></div>
                <div><span className="text-brand-muted">เวอร์ชัน</span><div>{detail.header.version}</div></div>
              </div>
              <table className="w-full text-left text-sm">
                <thead className="bg-brand-bg"><tr><th className="p-2">วัตถุดิบ</th><th className="p-2">จำนวน</th><th className="p-2">หน่วย</th><th className="p-2">ราคา</th><th className="p-2">รวม</th></tr></thead>
                <tbody>
                  {detail.lines.map(l => (
                    <tr key={l.id} className="border-b border-brand-border">
                      <td className="p-2">{l.ingredient_id}</td>
                      <td className="p-2">{l.ordered_qty}</td>
                      <td className="p-2">{l.purchase_unit}</td>
                      <td className="p-2">{l.unit_price}</td>
                      <td className="p-2">{l.line_total}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      <div className="card overflow-x-auto">
        <table className="w-full text-left">
          <thead className="bg-brand-bg">
            <tr>
              <th className="p-3">เลขที่ PO</th>
              <th className="p-3">ผู้ขาย</th>
              <th className="p-3">วันที่</th>
              <th className="p-3">ยอดรวม</th>
              <th className="p-3">สถานะ</th>
              <th className="p-3">จัดการ</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map(o => {
              const meta = STATUS_META[o.status]
              const sup = suppliers.find(s => s.id === o.supplier_id)
              return (
                <tr key={o.id} className="border-b border-brand-border hover:bg-brand-bg">
                  <td className="p-3 font-mono text-sm">{o.po_number}</td>
                  <td className="p-3">{sup?.name || o.supplier_id}</td>
                  <td className="p-3">{o.order_date}</td>
                  <td className="p-3 font-medium">฿{o.total_amount}</td>
                  <td className="p-3"><span className={`badge ${meta.bg} ${meta.text}`}>{meta.label}</span></td>
                  <td className="p-3">
                    <div className="flex gap-1 flex-wrap">
                      <button onClick={() => openDetail(o.id)} className="btn btn-outline text-xs">รายละเอียด</button>
                      {EDITABLE.includes(o.status) && <button onClick={() => startEdit(o.id)} className="btn btn-outline text-xs">แก้ไข</button>}
                      {o.status === 'draft' && <button onClick={() => handleSubmit(o.id)} className="btn btn-outline text-xs text-amber-600">ส่งอนุมัติ</button>}
                      {o.status === 'submitted' && <button onClick={() => handleApprove(o.id)} className="btn btn-primary text-xs">อนุมัติ</button>}
                    </div>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
        {filtered.length === 0 && !loadError && !loading && (
          <div className="text-center py-12">
            <div className="text-6xl mb-4">📝</div>
            <h3 className="text-xl font-bold text-brand-accent mb-2">ยังไม่มีใบสั่งซื้อ</h3>
            <p className="text-brand-muted mb-4">กด "+ สร้างใบสั่งซื้อ" เพื่อเริ่ม</p>
          </div>
        )}
      </div>
    </div>
  )
}