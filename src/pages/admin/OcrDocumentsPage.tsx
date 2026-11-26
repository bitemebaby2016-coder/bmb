// ============================================
// Bite Me Baby — Admin OCR Documents (Phase 2 Cost Intelligence)
// Workflow: Upload → OCR → Review → Match → Validate → Approve → Price History
// Original image shown beside OCR result. OCR NEVER writes until approved.
// ============================================
import { useCallback, useEffect, useMemo, useRef, useState, type ChangeEvent } from 'react'
import { showToast } from '@/components/ui/ToastContainer'
import { LoadErrorBanner } from '@/components/ui/LoadErrorBanner'
import { getSuppliers } from '@/lib/bmbAdminApi_suppliers'
import { getInventory } from '@/lib/bmbAdminApi_inventory'
import { getSupplierProducts } from '@/lib/bmbAdminApi_supplierProducts'
import {
  approveOcrDocument,
  createOcrDocument,
  listOcrDocuments,
  rejectOcrDocument,
  type OcrDocument,
} from '@/lib/bmbAdminApi_ocr'
import { extractOcr } from '@/lib/ocrService'
import { preprocessImage, hashImage } from '@/lib/ocr/preprocess'
import { validateOcrFields } from '@/lib/ocr/validate'
import { matchIngredient, matchSupplier } from '@/lib/ocr/match'
import { parseSupplierFile } from '@/lib/ocr/import'
import type { ApprovalLine, OcrDocStatus, OcrFields, PurchaseLineInput } from '@/lib/ocr/types'
import type { Ingredient, Supplier } from '@/types'

interface SupplierProductLite { id: string; supplier_id: string; ingredient_id: string; purchase_unit: string; use_unit: string; conversion_factor: number }

export function OcrDocumentsPage() {
  const [docs, setDocs] = useState<OcrDocument[]>([])
  const [filter, setFilter] = useState<OcrDocStatus | 'all'>('pending_review')
  const [selected, setSelected] = useState<OcrDocument | null>(null)
  const [previewUrl, setPreviewUrl] = useState<string>('')
  const [suppliers, setSuppliers] = useState<Supplier[]>([])
  const [ingredients, setIngredients] = useState<Ingredient[]>([])
  const [supplierProducts, setSupplierProducts] = useState<SupplierProductLite[]>([])
  const [busy, setBusy] = useState(false)
  const [loadError, setLoadError] = useState('')
  const [reviewNote, setReviewNote] = useState('')
  const [matchedSupplier, setMatchedSupplier] = useState<string>('')
  const [lineIngredient, setLineIngredient] = useState<Record<number, string>>({})
  const fileRef = useRef<HTMLInputElement>(null)
  const importRef = useRef<HTMLInputElement>(null)

  const load = useCallback(async () => {
    setLoadError('')
    try {
      const [d, s, i, sp] = await Promise.all([
        listOcrDocuments(filter === 'all' ? undefined : filter, 50),
        getSuppliers(),
        getInventory(),
        getSupplierProducts(),
      ])
      setDocs(d)
      setSuppliers(s || [])
      setIngredients((i || []) as Ingredient[])
      setSupplierProducts((sp || []) as unknown as SupplierProductLite[])
    } catch (e) {
      console.error('[OcrDocumentsPage] load failed', e)
      setLoadError('โหลดข้อมูล OCR ไม่สำเร็จ — ตรวจสอบการเชื่อมต่อแล้วกด "ลองใหม่"')
    }
  }, [filter])

  useEffect(() => { void load() }, [load])

  const validation = useMemo(() => (selected ? validateOcrFields(selected.ocr_fields || {}) : null), [selected])

  function select(doc: OcrDocument) {
    setSelected(doc)
    setPreviewUrl(doc.storage_path || '')
    setReviewNote('')
    setMatchedSupplier(doc.matched_supplier_id || doc.suggested_supplier_id || '')
    setLineIngredient({})
  }

  async function onUpload(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    setBusy(true)
    try {
      const img = await preprocessImage(file)
      const hash = await hashImage(img.base64)
      const result = await extractOcr(img.base64, img.mime)
      const fields: OcrFields = { ...result.fields }
      const created = await createOcrDocument({
        docType: 'receipt',
        storagePath: null,
        imageMime: img.mime,
        ocrRaw: result.raw,
        ocrFields: fields,
        modelUsed: result.model,
        promptVersion: result.promptVersion,
        contentHash: hash,
        tenantId: null,
        branchId: null,
      })
      if (!created) { showToast('บันทึกเอกสาร OCR ไม่สำเร็จ', 'error'); return }
      setPreviewUrl(URL.createObjectURL(file))
      showToast('OCR เสร็จสิ้น — รอตรวจทาน', 'success')
      await load()
      select(created)
    } catch (err) {
      console.error('[OcrDocumentsPage] OCR failed', err)
      showToast('OCR ล้มเหลว — กรอกด้วยมือได้ (ไม่บันทึกอัตโนมัติ)', 'error')
    } finally {
      setBusy(false)
    }
  }

  async function onImport(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    setBusy(true)
    try {
      const { lines, contentHash } = await parseSupplierFile(file)
      if (lines.length === 0) { showToast('ไม่พบรายการในไฟล์นำเข้า', 'error'); return }
      const created = await createOcrDocument({
        docType: 'supplier_quote',
        storagePath: null,
        imageMime: null,
        ocrRaw: { source: 'csv_excel', filename: file.name },
        ocrFields: { lines } as OcrFields,
        modelUsed: null,
        promptVersion: 'import-v1',
        contentHash,
        tenantId: null,
        branchId: null,
      })
      if (!created) { showToast('นำเข้าไม่สำเร็จ', 'error'); return }
      showToast(`นำเข้า ${lines.length} รายการ — รอตรวจทาน`, 'success')
      await load()
      select(created)
    } catch (err) {
      console.error('[OcrDocumentsPage] import failed', err)
      showToast('นำเข้าไม่สำเร็จ (รองรับ .csv / .xlsx)', 'error')
    } finally {
      setBusy(false)
    }
  }

  async function onCreateManual() {
    setBusy(true)
    try {
      const created = await createOcrDocument({
        docType: 'other',
        storagePath: null,
        imageMime: null,
        ocrRaw: { source: 'manual' },
        ocrFields: { lines: [] } as OcrFields,
        modelUsed: null,
        promptVersion: 'manual-v1',
        contentHash: null,
        tenantId: null,
        branchId: null,
      })
      if (!created) { showToast('สร้างเอกสารด้วยมือไม่สำเร็จ', 'error'); return }
      showToast('สร้างเอกสารด้วยมือ — เพิ่มรายการแล้วตรวจทาน', 'success')
      await load()
      select(created)
    } finally {
      setBusy(false)
    }
  }

  function addManualLine() {
    if (!selected) return
    const lines = [...(selected.ocr_fields.lines || []), { description: '', quantity: null, unit: null, unit_price: null, line_total: null, confidence: 1 } as PurchaseLineInput & { confidence: number }]
    const updated = { ...selected, ocr_fields: { ...selected.ocr_fields, lines } }
    setSelected(updated)
  }

  function updateManualLine(idx: number, patch: Partial<PurchaseLineInput>) {
    if (!selected) return
    const lines = [...(selected.ocr_fields.lines || [])]
    lines[idx] = { ...lines[idx], ...patch }
    setSelected({ ...selected, ocr_fields: { ...selected.ocr_fields, lines } })
  }

  async function doApprove() {
    if (!selected) return
    const approvalLines: ApprovalLine[] = []
    const lines = selected.ocr_fields.lines || []
    for (let i = 0; i < lines.length; i++) {
      const ingId = lineIngredient[i]
      const sp = supplierProducts.find((x) => x.ingredient_id === ingId && x.supplier_id === (matchedSupplier || selected.suggested_supplier_id || ''))
      const unitPrice = lines[i].unit_price
      if (ingId && sp && unitPrice != null) {
        approvalLines.push({
          supplier_id: sp.supplier_id,
          supplier_product_id: sp.id,
          ingredient_id: ingId,
          purchase_unit: sp.purchase_unit,
          use_unit: sp.use_unit,
          conversion_factor: sp.conversion_factor,
          unit_price: unitPrice,
          received_qty: lines[i].quantity ?? undefined,
        })
      }
    }
    setBusy(true)
    try {
      const res = await approveOcrDocument(selected.id, approvalLines, matchedSupplier || null, reviewNote)
      if (!res) { showToast('อนุมัติไม่สำเร็จ', 'error'); return }
      showToast(`อนุมัติแล้ว — บันทึก ${approvalLines.length} รายการใน Price History`, 'success')
      setSelected(null)
      setPreviewUrl('')
      await load()
    } finally {
      setBusy(false)
    }
  }

  async function doReject() {
    if (!selected) return
    setBusy(true)
    try {
      const res = await rejectOcrDocument(selected.id, reviewNote || 'rejected')
      if (!res) { showToast('ปฏิเสธไม่สำเร็จ', 'error'); return }
      showToast('ปฏิเสธเอกสารแล้ว', 'success')
      setSelected(null)
      setPreviewUrl('')
      await load()
    } finally {
      setBusy(false)
    }
  }

  const supplierName = (id: string | null) => suppliers.find((s) => s.id === id)?.name || id || '-'

  return (
    <div className="p-4 lg:p-6 space-y-6" data-testid="ocr-documents-page">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-bold text-brand-accent">OCR เอกสารจัดซื้อ</h1>
          <p className="text-sm text-brand-muted">ใบเสร็จ / ใบกำกับภาษี / เอกสารซัพพลายเออร์ — AI อ่านแล้วต้องมีคนอนุมัติก่อน</p>
        </div>
        <div className="flex gap-2">
          <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={onUpload} data-testid="ocr-upload-input" />
          <button className="btn btn-primary" disabled={busy} onClick={() => fileRef.current?.click()} data-testid="ocr-upload-btn">
            {busy ? 'กำลังประมวลผล…' : '📷 อัปโหลดเอกสาร'}
          </button>
          <input ref={importRef} type="file" accept=".csv,.xlsx" className="hidden" onChange={onImport} data-testid="ocr-import-input" />
          <button className="btn btn-outline" disabled={busy} onClick={() => importRef.current?.click()} data-testid="ocr-import-btn">📊 นำเข้า CSV/Excel</button>
          <button className="btn btn-outline" disabled={busy} onClick={() => void onCreateManual()} data-testid="ocr-manual-btn">✍️ กรอกด้วยมือ</button>
        </div>
      </div>

      {loadError && <LoadErrorBanner message={loadError} onRetry={() => void load()} />}

      <div className="grid lg:grid-cols-2 gap-6">
        {/* list */}
        <div className="card">
          <div className="flex items-center gap-2 mb-3">
            <label className="text-sm text-brand-muted">สถานะ</label>
            <select className="input" value={filter} onChange={(e) => setFilter(e.target.value as OcrDocStatus | 'all')} data-testid="ocr-status-filter">
              <option value="pending_review">รอตรวจทาน</option>
              <option value="approved">อนุมัติแล้ว</option>
              <option value="rejected">ปฏิเสธ</option>
              <option value="all">ทั้งหมด</option>
            </select>
          </div>
          {docs.length === 0 ? (
            <p className="text-sm text-brand-muted">ไม่มีเอกสารในสถานะนี้</p>
          ) : (
            <ul className="space-y-2" data-testid="ocr-doc-list">
              {docs.map((d) => (
                <li key={d.id}>
                  <button
                    onClick={() => select(d)}
                    className={`w-full text-left p-3 rounded-xl border ${selected?.id === d.id ? 'border-brand-primary bg-brand-bg' : 'border-brand-border hover:bg-brand-bg'}`}
                    data-testid={`ocr-doc-${d.id}`}
                  >
                    <div className="flex justify-between text-sm">
                      <span className="font-medium">{d.doc_type} · {supplierName(d.suggested_supplier_id)}</span>
                      <span className="text-brand-muted">{d.status}</span>
                    </div>
                    <div className="text-xs text-brand-muted">
                      {d.total != null ? `ยอด ${d.total} ${d.currency || ''}` : 'ยอดไม่ชัด (ต้องตรวจ)'}
                      {d.duplicate_of ? ' · ซ้ำเอกสาร' : ''}
                    </div>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* review */}
        <div className="card space-y-3">
          {!selected ? (
            <p className="text-sm text-brand-muted">เลือกเอกสารเพื่อตรวจทาน</p>
          ) : (
            <>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <div className="text-xs font-bold text-brand-muted mb-1">ต้นฉบับ</div>
                  {previewUrl ? (
                    <img src={previewUrl} alt="ต้นฉบับ" className="w-full rounded-lg border border-brand-border" data-testid="ocr-original-image" />
                  ) : <p className="text-xs text-brand-muted">(ไม่มีรูปต้นฉบับ)</p>}
                </div>
                <div className="space-y-2 text-sm">
                  <div className="text-xs font-bold text-brand-muted mb-1">ผลลัพธ์ OCR</div>
                  <div>ผู้ขาย: <b>{selected.ocr_fields.supplier_name || '-'}</b></div>
                  <div>วันที่: {selected.ocr_fields.document_date || '-'}</div>
                  <div>Subtotal: {selected.subtotal ?? '-'}</div>
                  <div>Tax: {selected.tax ?? '-'}</div>
                  <div>Total: {selected.total ?? '-'} {selected.currency || ''}</div>
                  <div className="text-xs text-brand-muted">โมเดล: {selected.model_used || '-'}</div>
                </div>
              </div>

              {validation && (validation.errors.length > 0 || validation.warnings.length > 0) && (
                <div className="text-xs space-y-1" data-testid="ocr-validation">
                  {validation.errors.map((e, i) => <div key={'e' + i} className="text-red-600">✗ {e}</div>)}
                  {validation.warnings.map((w, i) => <div key={'w' + i} className="text-amber-600">⚠ {w}</div>)}
                </div>
              )}

              {/* supplier match */}
              <div>
                <div className="text-xs font-bold text-brand-muted mb-1">จับคู่ซัพพลายเออร์</div>
                <select className="input" value={matchedSupplier} onChange={(e) => setMatchedSupplier(e.target.value)} data-testid="ocr-supplier-match">
                  <option value="">(ไม่เลือก)</option>
                  {suppliers.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
                {selected.ocr_fields.supplier_name && (
                  <div className="text-xs text-brand-muted mt-1">
                    แนะนำ: {matchSupplier(selected.ocr_fields.supplier_name, suppliers.map((s) => ({ id: s.id, name: s.name }))).slice(0, 3).map((c) => `${c.label} (${(c.score * 100).toFixed(0)}%)`).join(', ') || '-'}
                  </div>
                )}
              </div>

              {/* lines */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <div className="text-xs font-bold text-brand-muted">รายการ</div>
                  <button className="btn btn-outline btn-sm" onClick={addManualLine} data-testid="ocr-add-line">+ เพิ่มรายการ</button>
                </div>
                <div className="space-y-2">
                  {(selected.ocr_fields.lines || []).map((ln, i) => (
                    <div key={i} className="grid grid-cols-2 gap-2 text-xs items-center" data-testid={`ocr-line-${i}`}>
                      <input className="input" placeholder="รายการ" value={ln.description} onChange={(e) => updateManualLine(i, { description: e.target.value })} />
                      <input className="input" type="number" placeholder="ราคา/หน่วย" value={ln.unit_price ?? ''} onChange={(e) => updateManualLine(i, { unit_price: e.target.value === '' ? null : Number(e.target.value) })} />
                      <select className="input" value={lineIngredient[i] || ''} onChange={(e) => setLineIngredient((m) => ({ ...m, [i]: e.target.value }))} data-testid={`ocr-line-ingredient-${i}`}>
                        <option value="">(เลือกวัตถุดิบ)</option>
                        {ingredients.map((ing) => <option key={ing.id} value={ing.id}>{ing.name}</option>)}
                      </select>
                      <div className="text-brand-muted">conf {(ln.confidence ?? 1).toFixed(2)}{ln.confidence < 0.6 ? ' ⚠' : ''}</div>
                    </div>
                  ))}
                </div>
                {selected.ocr_fields.supplier_name && (
                  <div className="text-xs text-brand-muted mt-1">
                    แนะนำวัตถุดิบ: {matchIngredient(selected.ocr_fields.supplier_name, ingredients.map((x) => ({ id: x.id, name: x.name }))).slice(0, 3).map((c) => c.label).join(', ') || '-'}
                  </div>
                )}
              </div>

              <input className="input" placeholder="หมายเหตุการตรวจทาน" value={reviewNote} onChange={(e) => setReviewNote(e.target.value)} />
              <div className="flex gap-2">
                <button className="btn btn-primary" disabled={busy} onClick={() => void doApprove()} data-testid="ocr-approve-btn">✓ อนุมัติ</button>
                <button className="btn btn-outline" disabled={busy} onClick={() => void doReject()} data-testid="ocr-reject-btn">✕ ปฏิเสธ</button>
              </div>
              <p className="text-[11px] text-brand-muted">การอนุมัติจะบันทึกเฉพาะ Price History (approved) และ last_approved_price — ไม่สร้าง PO/GRN/เปลี่ยน WAVG อัตโนมัติ</p>
            </>
          )}
        </div>
      </div>
    </div>
  )
}