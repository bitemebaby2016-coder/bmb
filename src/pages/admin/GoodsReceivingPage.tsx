// ============================================
// Bite Me Baby â€” Admin Goods Receiving (Phase 2 WP5)
// à¹€à¸¥à¸·à¸­à¸ PO à¸—à¸µà¹ˆà¸£à¸­à¸£à¸±à¸šà¸ªà¸´à¸™à¸„à¹‰à¸² â†’ à¸à¸£à¸­à¸à¸ˆà¸³à¸™à¸§à¸™à¸£à¸±à¸šà¸ˆà¸£à¸´à¸‡ â†’ à¹à¸¢à¸à¸‚à¸­à¸‡à¸”à¸µ/à¹€à¸ªà¸µà¸¢/à¸›à¸à¸´à¹€à¸ªà¸˜
// → บันทึก Draft → อนุมัติ (inventory/admin) · ใช้ API จริง (migration 225)
// ============================================

import { useState, useEffect, useCallback, useMemo } from 'react'
import {
  getGoodsReceipts,
  getGoodsReceiptById,
  createGrnDraft,
  approveGrn,
  type GoodsReceipt,
  type GRNStatus,
} from '@/lib/bmbAdminApi_goodsReceipts'
import {
  getPurchaseOrders,
  getPurchaseOrderById,
  type PurchaseOrderHeader,
  type PurchaseOrderLine,
} from '@/lib/bmbAdminApi_purchaseOrders'
import { getAllSuppliers, type Supplier } from '@/lib/bmbAdminApi_suppliers'
import { showToast } from '@/components/ui/ToastContainer'
import { LoadErrorBanner } from '@/components/ui/LoadErrorBanner'

interface GRNLineDraft {
  key: string
  po_line_id: string
  ingredient_id: string
  purchase_unit: string
  ordered_qty: number
  unit_price: number
  received_qty: number
  accepted_qty: number
  rejected_qty: number
  actual_unit_price: number
}

const RECEIVABLE = ['approved', 'ordered', 'partially_received']
const STATUS_META: Record<GRNStatus, { bg: string; text: string; label: string }> = {
  draft: { bg: 'bg-gray-100', text: 'text-gray-700', label: 'à¸‰à¸šà¸±à¸šà¸£à¹ˆà¸²à¸‡' },
  submitted: { bg: 'bg-amber-100', text: 'text-amber-800', label: 'à¸£à¸­à¸­à¸™à¸¸à¸¡à¸±à¸•à¸´' },
  approved: { bg: 'bg-blue-100', text: 'text-blue-800', label: 'à¸­à¸™à¸¸à¸¡à¸±à¸•à¸´à¹à¸¥à¹‰à¸§' },
  posted: { bg: 'bg-green-100', text: 'text-green-800', label: 'à¸›à¹‰à¸­à¸™à¹€à¸‚à¹‰à¸²à¸„à¸¥à¸±à¸‡à¹à¸¥à¹‰à¸§' },
  rejected: { bg: 'bg-red-100', text: 'text-red-700', label: 'à¸›à¸à¸´à¹€à¸ªà¸˜' },
  cancelled: { bg: 'bg-gray-200', text: 'text-gray-600', label: 'à¸¢à¸à¹€à¸¥à¸´à¸' },
  reversed: { bg: 'bg-purple-100', text: 'text-purple-700', label: 'à¸¢à¹‰à¸­à¸™à¸à¸¥à¸±à¸š' },
}

export function GoodsReceivingPage() {
  const [receipts, setReceipts] = useState<GoodsReceipt[]>([])
  const [suppliers, setSuppliers] = useState<Supplier[]>([])
  const [receivablePOs, setReceivablePOs] = useState<PurchaseOrderHeader[]>([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState('')
  const [statusFilter, setStatusFilter] = useState<'all' | GRNStatus>('all')

  const [showForm, setShowForm] = useState(false)
  const [poId, setPoId] = useState('')
  const [poLines, setPoLines] = useState<PurchaseOrderLine[]>([])
  const [lines, setLines] = useState<GRNLineDraft[]>([])
  const [notes, setNotes] = useState('')
  const [saving, setSaving] = useState(false)
  const [formError, setFormError] = useState('')
  const [poLoadError, setPoLoadError] = useState('')

  const [detail, setDetail] = useState<{ header: GoodsReceipt; lines: any[] } | null>(null)

  const loadAll = useCallback(async () => {
    setLoading(true)
    setLoadError('')
    try {
      const [grns, sups] = await Promise.all([getGoodsReceipts(), getAllSuppliers(true)])
      setReceipts(grns)
      setSuppliers(sups)
      const allPOs = await getPurchaseOrders()
      setReceivablePOs(allPOs.filter(p => RECEIVABLE.includes(p.status)))
    } catch (e) {
      console.error('[GoodsReceivingPage] load failed:', e)
      setLoadError('à¹‚à¸«à¸¥à¸”à¸‚à¹‰à¸­à¸¡à¸¹à¸¥à¹ƒà¸šà¸£à¸±à¸šà¸ªà¸´à¸™à¸„à¹‰à¸²à¹„à¸¡à¹ˆà¸ªà¸³à¹€à¸£à¹‡à¸ˆ â€” à¸•à¸£à¸§à¸ˆà¸ªà¸­à¸šà¸à¸²à¸£à¹€à¸Šà¸·à¹ˆà¸­à¸¡à¸•à¹ˆà¸­à¹à¸¥à¹‰à¸§à¸à¸” "à¸¥à¸­à¸‡à¹ƒà¸«à¸¡à¹ˆ"')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { void loadAll() }, [loadAll])

  const filtered = useMemo(() => {
    let r = [...receipts]
    if (statusFilter !== 'all') r = r.filter(g => g.status === statusFilter)
    return r
  }, [receipts, statusFilter])

  function resetForm() {
    setShowForm(false)
    setPoId('')
    setPoLines([])
    setLines([])
    setNotes('')
    setFormError('')
    setPoLoadError('')
  }

  async function onSelectPO(id: string) {
    setPoId(id)
    setPoLines([])
    setLines([])
    setFormError('')
    if (!id) return
    setPoLoadError('')
    try {
      const full = await getPurchaseOrderById(id)
      if (!full) { setPoLoadError('à¹„à¸¡à¹ˆà¸žà¸šà¹ƒà¸šà¸ªà¸±à¹ˆà¸‡à¸‹à¸·à¹‰à¸­'); return }
      setPoLines(full.lines)
      setLines(full.lines.map(l => ({
        key: l.id,
        po_line_id: l.id,
        ingredient_id: l.ingredient_id,
        purchase_unit: l.purchase_unit,
        ordered_qty: l.ordered_qty,
        unit_price: l.unit_price,
        received_qty: 0,
        accepted_qty: 0,
        rejected_qty: 0,
        actual_unit_price: l.unit_price,
      })))
    } catch (e) {
      console.error('[GoodsReceivingPage] load PO lines failed:', e)
      setPoLoadError('à¹‚à¸«à¸¥à¸”à¸£à¸²à¸¢à¸à¸²à¸£à¸ªà¸´à¸™à¸„à¹‰à¸²à¸‚à¸­à¸‡ PO à¹„à¸¡à¹ˆà¸ªà¸³à¹€à¸£à¹‡à¸ˆ')
    }
  }

  function updateLine(key: string, patch: Partial<GRNLineDraft>) {
    setLines(prev => prev.map(l => {
      if (l.key !== key) return l
      const next = { ...l, ...patch }
      // auto-balance: accepted = received - rejected
      if (patch.received_qty !== undefined || patch.rejected_qty !== undefined) {
        next.accepted_qty = Math.max(0, (next.received_qty || 0) - (next.rejected_qty || 0))
      }
      return next
    }))
  }

  async function handleSave() {
    setFormError('')
    if (!poId) { setFormError('à¸à¸£à¸¸à¸“à¸²à¹€à¸¥à¸·à¸­à¸à¹ƒà¸šà¸ªà¸±à¹ˆà¸‡à¸‹à¸·à¹‰à¸­'); return }
    const clean = lines.filter(l => l.received_qty && l.received_qty > 0)
    if (clean.length === 0) { setFormError('à¸à¸£à¸¸à¸“à¸²à¸à¸£à¸­à¸à¸ˆà¸³à¸™à¸§à¸™à¸£à¸±à¸šà¸­à¸¢à¹ˆà¸²à¸‡à¸™à¹‰à¸­à¸¢ 1 à¸£à¸²à¸¢à¸à¸²à¸£'); return }
    setSaving(true)
    try {
      const res = await createGrnDraft({
        po_id: poId,
        lines: clean.map(l => ({
          po_line_id: l.po_line_id,
          received_qty: l.received_qty!,
          accepted_qty: l.accepted_qty,
          rejected_qty: l.rejected_qty,
          actual_unit_price: l.actual_unit_price,
        })),
        notes: notes || null,
      })
      if (!res.ok || !res.grn_id) { setFormError('à¸šà¸±à¸™à¸—à¸¶à¸à¹ƒà¸šà¸£à¸±à¸šà¸ªà¸´à¸™à¸„à¹‰à¸²à¹„à¸¡à¹ˆà¸ªà¸³à¹€à¸£à¹‡à¸ˆ'); return }
      showToast(`à¸ªà¸£à¹‰à¸²à¸‡à¹ƒà¸šà¸£à¸±à¸šà¸ªà¸´à¸™à¸„à¹‰à¸² ${res.grn_number || ''} à¸ªà¸³à¹€à¸£à¹‡à¸ˆ`, 'success')
      resetForm()
      await loadAll()
    } catch (e) {
      console.error('[GoodsReceivingPage] save failed:', e)
      setFormError('à¹€à¸à¸´à¸”à¸‚à¹‰à¸­à¸œà¸´à¸”à¸žà¸¥à¸²à¸”à¹ƒà¸™à¸à¸²à¸£à¸šà¸±à¸™à¸—à¸¶à¸ (à¸­à¸²à¸ˆà¹€à¸à¸´à¸™à¸ˆà¸³à¸™à¸§à¸™à¸—à¸µà¹ˆà¸ªà¸±à¹ˆà¸‡)')
    } finally {
      setSaving(false)
    }
  }

  async function handleApprove(id: string) {
    if (!confirm('à¸¢à¸·à¸™à¸¢à¸±à¸™à¸­à¸™à¸¸à¸¡à¸±à¸•à¸´à¹ƒà¸šà¸£à¸±à¸šà¸ªà¸´à¸™à¸„à¹‰à¸²à¸™à¸µà¹‰? (à¸ªà¸´à¸—à¸˜à¸´à¹Œ inventory/admin)')) return
    try {
      const res = await approveGrn(id)
      if (!res.ok) { showToast('à¸­à¸™à¸¸à¸¡à¸±à¸•à¸´à¹„à¸¡à¹ˆà¸ªà¸³à¹€à¸£à¹‡à¸ˆ (à¸•à¹‰à¸­à¸‡à¸¡à¸µà¸ªà¸´à¸—à¸˜à¸´à¹Œ inventory/admin + à¸ªà¸–à¸²à¸™à¸°à¸‰à¸šà¸±à¸šà¸£à¹ˆà¸²à¸‡)', 'error'); return }
      showToast('à¸­à¸™à¸¸à¸¡à¸±à¸•à¸´à¹ƒà¸šà¸£à¸±à¸šà¸ªà¸´à¸™à¸„à¹‰à¸²à¸ªà¸³à¹€à¸£à¹‡à¸ˆ', 'success')
      await loadAll()
    } catch (e) {
      console.error('[GoodsReceivingPage] approve failed:', e)
      showToast('à¹€à¸à¸´à¸”à¸‚à¹‰à¸­à¸œà¸´à¸”à¸žà¸¥à¸²à¸”', 'error')
    }
  }

  async function openDetail(id: string) {
    try {
      const full = await getGoodsReceiptById(id)
      if (full) setDetail({ header: full, lines: full.lines })
    } catch (e) {
      console.error('[GoodsReceivingPage] detail failed:', e)
      showToast('à¹‚à¸«à¸¥à¸”à¸£à¸²à¸¢à¸¥à¸°à¹€à¸­à¸µà¸¢à¸”à¹„à¸¡à¹ˆà¸ªà¸³à¹€à¸£à¹‡à¸ˆ', 'error')
    }
  }

  return (
    <div className="max-w-7xl mx-auto px-4 py-6">
      <div className="flex items-center justify-between mb-6 flex-wrap gap-2">
        <h1 className="text-3xl font-bold text-brand-accent">ðŸ“¦ à¸£à¸±à¸šà¸ªà¸´à¸™à¸„à¹‰à¸² (Goods Receiving)</h1>
        <div className="flex gap-2">
          <button onClick={loadAll} className="btn btn-outline text-sm" disabled={loading}>à¸£à¸µà¹€à¸Ÿà¸£à¸Š</button>
          <button onClick={() => { resetForm(); setShowForm(true) }} className="btn btn-primary">+ à¸ªà¸£à¹‰à¸²à¸‡à¹ƒà¸šà¸£à¸±à¸šà¸ªà¸´à¸™à¸„à¹‰à¸²</button>
        </div>
      </div>

      {loading && <div className="card text-center py-8"><p className="text-brand-muted">à¸à¸³à¸¥à¸±à¸‡à¹‚à¸«à¸¥à¸”à¸‚à¹‰à¸­à¸¡à¸¹à¸¥...</p></div>}
      {loadError && <div className="mb-4"><LoadErrorBanner message={loadError} onRetry={loadAll} testId="grn-load-error" /></div>}

      {showForm && (
        <div className="card mb-6 bg-brand-bg">
          <h3 className="font-bold text-brand-accent mb-4">âž• à¸ªà¸£à¹‰à¸²à¸‡à¹ƒà¸šà¸£à¸±à¸šà¸ªà¸´à¸™à¸„à¹‰à¸²à¹ƒà¸«à¸¡à¹ˆ</h3>
          {formError && <div className="mb-3 text-red-600 text-sm">{formError}</div>}
          {poLoadError && <div className="mb-3 text-red-600 text-sm">{poLoadError}</div>}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
            <div>
              <label className="block text-sm font-medium text-brand-muted mb-1">à¹ƒà¸šà¸ªà¸±à¹ˆà¸‡à¸‹à¸·à¹‰à¸­à¸—à¸µà¹ˆà¸£à¸­à¸£à¸±à¸š <span className="text-red-500">*</span></label>
              <select value={poId} onChange={e => onSelectPO(e.target.value)} className="input">
                <option value="">â€” à¹€à¸¥à¸·à¸­à¸ PO à¸—à¸µà¹ˆà¸£à¸­à¸£à¸±à¸šà¸ªà¸´à¸™à¸„à¹‰à¸² â€”</option>
                {receivablePOs.map(p => <option key={p.id} value={p.id}>{p.po_number}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-brand-muted mb-1">à¹‚à¸™à¹‰à¸•</label>
              <input type="text" value={notes} onChange={e => setNotes(e.target.value)} className="input" placeholder="à¹€à¸Šà¹ˆà¸™ à¹à¸™à¸šà¹ƒà¸šà¸ªà¹ˆà¸‡à¸‚à¸­à¸‡" />
            </div>
          </div>

          {poId && (
            <>
              <h4 className="font-semibold text-brand-accent mb-2">à¸£à¸²à¸¢à¸à¸²à¸£à¸—à¸µà¹ˆà¸£à¸±à¸š</h4>
              <div className="overflow-x-auto mb-3">
                <table className="w-full text-left text-sm">
                  <thead className="bg-brand-bg">
                    <tr>
                      <th className="p-2">à¸§à¸±à¸•à¸–à¸¸à¸”à¸´à¸š</th>
                      <th className="p-2">à¸ªà¸±à¹ˆà¸‡à¹„à¸§à¹‰</th>
                      <th className="p-2">à¸£à¸±à¸šà¸ˆà¸£à¸´à¸‡</th>
                      <th className="p-2">à¸›à¸à¸´à¹€à¸ªà¸˜/à¹€à¸ªà¸µà¸¢</th>
                      <th className="p-2">à¸‚à¸­à¸‡à¸”à¸µ (auto)</th>
                      <th className="p-2">à¸£à¸²à¸„à¸²à¸ˆà¸£à¸´à¸‡/à¸«à¸™à¹ˆà¸§à¸¢</th>
                    </tr>
                  </thead>
                  <tbody>
                    {lines.map(l => (
                      <tr key={l.key} className="border-b border-brand-border">
                        <td className="p-2">{l.ingredient_id} <span className="text-xs text-brand-muted">({l.purchase_unit})</span></td>
                        <td className="p-2">{l.ordered_qty}</td>
                        <td className="p-2"><input type="number" min="0" step="0.01" value={l.received_qty ?? 0} onChange={e => updateLine(l.key, { received_qty: Number(e.target.value) })} className="input text-sm w-24" /></td>
                        <td className="p-2"><input type="number" min="0" step="0.01" value={l.rejected_qty ?? 0} onChange={e => updateLine(l.key, { rejected_qty: Number(e.target.value) })} className="input text-sm w-24" /></td>
                        <td className="p-2 font-medium">{l.accepted_qty ?? 0}</td>
                        <td className="p-2"><input type="number" min="0" step="0.01" value={l.actual_unit_price ?? ''} onChange={e => updateLine(l.key, { actual_unit_price: Number(e.target.value) })} className="input text-sm w-24" /></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="flex gap-3">
                <button onClick={handleSave} className="btn btn-primary" disabled={saving}>{saving ? 'à¸à¸³à¸¥à¸±à¸‡à¸šà¸±à¸™à¸—à¸¶à¸...' : 'à¸šà¸±à¸™à¸—à¸¶à¸ (à¸‰à¸šà¸±à¸šà¸£à¹ˆà¸²à¸‡)'}</button>
                <button onClick={resetForm} className="btn btn-outline">à¸¢à¸à¹€à¸¥à¸´à¸</button>
              </div>
            </>
          )}
        </div>
      )}

      {detail && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50" onClick={() => setDetail(null)}>
          <div className="bg-white rounded-2xl shadow-xl max-w-3xl w-full max-h-[80vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between p-4 border-b">
              <h3 className="font-bold text-brand-accent text-lg">ðŸ“‹ {detail.header.grn_number}</h3>
              <button onClick={() => setDetail(null)} className="p-2 rounded-lg hover:bg-brand-bg">âœ•</button>
            </div>
            <div className="p-4">
              <div className="grid grid-cols-2 md:grid-cols-3 gap-3 mb-4 text-sm">
                <div><span className="text-brand-muted">à¸ªà¸–à¸²à¸™à¸°</span><div><span className={`badge ${STATUS_META[detail.header.status].bg} ${STATUS_META[detail.header.status].text}`}>{STATUS_META[detail.header.status].label}</span></div></div>
                <div><span className="text-brand-muted">à¸§à¸±à¸™à¸—à¸µà¹ˆà¸£à¸±à¸š</span><div>{detail.header.receipt_date}</div></div>
                <div><span className="text-brand-muted">PO</span><div>{detail.header.po_id}</div></div>
              </div>
              <table className="w-full text-left text-sm">
                <thead className="bg-brand-bg"><tr><th className="p-2">à¸§à¸±à¸•à¸–à¸¸à¸”à¸´à¸š</th><th className="p-2">à¸£à¸±à¸š</th><th className="p-2">à¸”à¸µ</th><th className="p-2">à¸›à¸à¸´à¹€à¸ªà¸˜</th><th className="p-2">à¸£à¸²à¸„à¸²à¸ˆà¸£à¸´à¸‡</th></tr></thead>
                <tbody>
                  {detail.lines.map((l: any) => (
                    <tr key={l.id} className="border-b border-brand-border">
                      <td className="p-2">{l.ingredient_id}</td>
                      <td className="p-2">{l.received_qty}</td>
                      <td className="p-2">{l.accepted_qty}</td>
                      <td className="p-2">{l.rejected_qty}</td>
                      <td className="p-2">{l.actual_unit_price}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      <div className="card mb-4">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 p-3 bg-brand-bg rounded-lg">
          <div>
            <label className="block text-xs text-brand-muted mb-1">à¸ªà¸–à¸²à¸™à¸°</label>
            <select value={statusFilter} onChange={e => setStatusFilter(e.target.value as any)} className="input text-sm">
              <option value="all">à¸—à¸±à¹‰à¸‡à¸«à¸¡à¸”</option>
              {(Object.keys(STATUS_META) as GRNStatus[]).map(s => <option key={s} value={s}>{STATUS_META[s].label}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs text-brand-muted mb-1">à¸ˆà¸³à¸™à¸§à¸™à¸£à¸²à¸¢à¸à¸²à¸£</label>
            <div className="text-sm font-bold text-brand-accent">{filtered.length} / {receipts.length}</div>
          </div>
        </div>
      </div>

      <div className="card overflow-x-auto">
        <table className="w-full text-left">
          <thead className="bg-brand-bg">
            <tr>
              <th className="p-3">à¹€à¸¥à¸‚à¸—à¸µà¹ˆ GRN</th>
              <th className="p-3">PO</th>
              <th className="p-3">à¸œà¸¹à¹‰à¸‚à¸²à¸¢</th>
              <th className="p-3">à¸§à¸±à¸™à¸—à¸µà¹ˆà¸£à¸±à¸š</th>
              <th className="p-3">à¸ªà¸–à¸²à¸™à¸°</th>
              <th className="p-3">à¸ˆà¸±à¸”à¸à¸²à¸£</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map(g => {
              const meta = STATUS_META[g.status]
              const sup = suppliers.find(s => s.id === g.supplier_id)
              return (
                <tr key={g.id} className="border-b border-brand-border hover:bg-brand-bg">
                  <td className="p-3 font-mono text-sm">{g.grn_number}</td>
                  <td className="p-3 font-mono text-xs">{g.po_id}</td>
                  <td className="p-3">{sup?.name || g.supplier_id}</td>
                  <td className="p-3">{g.receipt_date}</td>
                  <td className="p-3"><span className={`badge ${meta.bg} ${meta.text}`}>{meta.label}</span></td>
                  <td className="p-3">
                    <div className="flex gap-1">
                      <button onClick={() => openDetail(g.id)} className="btn btn-outline text-xs">à¸£à¸²à¸¢à¸¥à¸°à¹€à¸­à¸µà¸¢à¸”</button>
                      {g.status === 'draft' && <button onClick={() => handleApprove(g.id)} className="btn btn-primary text-xs">à¸­à¸™à¸¸à¸¡à¸±à¸•à¸´</button>}
                    </div>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
        {filtered.length === 0 && !loadError && !loading && (
          <div className="text-center py-12">
            <div className="text-6xl mb-4">ðŸ“¦</div>
            <h3 className="text-xl font-bold text-brand-accent mb-2">à¸¢à¸±à¸‡à¹„à¸¡à¹ˆà¸¡à¸µà¹ƒà¸šà¸£à¸±à¸šà¸ªà¸´à¸™à¸„à¹‰à¸²</h3>
            <p className="text-brand-muted mb-4">à¸à¸” "+ à¸ªà¸£à¹‰à¸²à¸‡à¹ƒà¸šà¸£à¸±à¸šà¸ªà¸´à¸™à¸„à¹‰à¸²" à¹€à¸žà¸·à¹ˆà¸­à¹€à¸£à¸´à¹ˆà¸¡</p>
          </div>
        )}
      </div>
    </div>
  )
}
