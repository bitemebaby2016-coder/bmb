// ============================================
// Bite Me Baby — Admin Supplier Product Mapping (Phase 1)
// Map supplier products to ingredients with 3 price states and unit conversion
// ============================================

import React, { useState, useEffect, useCallback, useMemo } from 'react'
import {
  getSupplierProducts,
  createSupplierProduct,
  updateSupplierProduct,
  deleteSupplierProduct,
  getIngredientsForSupplier,
  getSuppliersForIngredient,
  type SupplierProduct,
  type SupplierProductForm,
} from '@/lib/bmbAdminApi_supplierProducts'
import { getSuppliers } from '@/lib/bmbAdminApi_suppliers'
import { getInventory } from '@/lib/bmbAdminApi_inventory'
import { showToast } from '@/components/ui/ToastContainer'
import { LoadErrorBanner } from '@/components/ui/LoadErrorBanner'
import type { Supplier, Ingredient } from '@/types'

export function SupplierProductMappingPage() {
  const [mappings, setMappings] = useState<SupplierProduct[]>([])
  const [suppliers, setSuppliers] = useState<Supplier[]>([])
  const [ingredients, setIngredients] = useState<Ingredient[]>([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState('')
  const [showForm, setShowForm] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [formData, setFormData] = useState<Partial<SupplierProductForm>>({})
  const [formErrors, setFormErrors] = useState<Record<string, string>>({})
  const [searchText, setSearchText] = useState('')
  const [supplierFilter, setSupplierFilter] = useState<string>('')
  const [ingredientFilter, setIngredientFilter] = useState<string>('')
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'inactive'>('all')
  const [viewMode, setViewMode] = useState<'list' | 'comparison'>('list')

  const loadData = useCallback(async () => {
    setLoading(true)
    setLoadError('')
    try {
      const [suppliersData, ingredientsData, mappingsData] = await Promise.all([
        getSuppliers(),
        getInventory(),
        getSupplierProducts(),
      ])
      setSuppliers(suppliersData || [])
      setIngredients((ingredientsData || []) as Ingredient[])
      setMappings(mappingsData || [])
    } catch (e) {
      console.error('[SupplierProductMappingPage] Failed to load data:', e)
      setLoadError('โหลดข้อมูลการจับคู่ไม่สำเร็จ — ตรวจสอบการเชื่อมต่อแล้วกด "ลองใหม่"')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { void loadData() }, [loadData])

  const filteredMappings = useMemo(() => {
    let result = [...mappings]
    if (searchText) {
      const q = searchText.toLowerCase()
      result = result.filter(m =>
        m.supplier?.name?.toLowerCase().includes(q) ||
        m.ingredient?.name?.toLowerCase().includes(q) ||
        m.supplier_sku?.toLowerCase().includes(q) ||
        m.supplier_name?.toLowerCase().includes(q)
      )
    }
    if (supplierFilter) result = result.filter(m => m.supplier_id === supplierFilter)
    if (ingredientFilter) result = result.filter(m => m.ingredient_id === ingredientFilter)
    if (statusFilter === 'active') result = result.filter(m => m.is_active)
    if (statusFilter === 'inactive') result = result.filter(m => !m.is_active)
    return result
  }, [mappings, searchText, supplierFilter, ingredientFilter, statusFilter])

  // Comparison view: group by ingredient, show all suppliers side by side
  const comparisonData = useMemo(() => {
    const groups = new Map<string, SupplierProduct[]>()
    filteredMappings.forEach(m => {
      const key = m.ingredient_id
      if (!groups.has(key)) groups.set(key, [])
      groups.get(key)!.push(m)
    })
    return Array.from(groups.entries()).map(([ingredientId, items]) => ({
      ingredientId,
      ingredientName: items[0]?.ingredient?.name || ingredientId,
      ingredientUnit: items[0]?.ingredient?.unit || '-',
      mappings: items.map(m => ({
        ...m,
        pricePerUseUnit: {
          committed: m.last_committed_price && m.conversion_factor > 0 ? m.last_committed_price / m.conversion_factor : null,
          realized: m.last_realized_price && m.conversion_factor > 0 ? m.last_realized_price / m.conversion_factor : null,
          approved: m.last_approved_price && m.conversion_factor > 0 ? m.last_approved_price / m.conversion_factor : null,
        }
      }))
    }))
  }, [filteredMappings])

  function computePricePerUseUnit(m: SupplierProduct, priceType: 'committed' | 'realized' | 'approved'): number | null {
    const price = priceType === 'committed' ? m.last_committed_price
      : priceType === 'realized' ? m.last_realized_price
      : m.last_approved_price
    if (price === undefined || price === null || !m.conversion_factor || m.conversion_factor <= 0) return null
    return price / m.conversion_factor
  }

  function validateForm(data: Partial<SupplierProductForm>): Record<string, string> {
    const errors: Record<string, string> = {}
    if (!data.supplier_id) errors.supplier_id = 'กรุณาเลือกผู้ขาย'
    if (!data.ingredient_id) errors.ingredient_id = 'กรุณาเลือกวัตถุดิบ'
    if (!data.purchase_unit?.trim()) errors.purchase_unit = 'กรุณาใส่หน่วยซื้อ'
    if (!data.use_unit?.trim()) errors.use_unit = 'กรุณาใส่หน่วยใช้'
    if (data.conversion_factor !== undefined && data.conversion_factor <= 0) errors.conversion_factor = 'อัตราแปลงหน่วยต้องมากกว่า 0'
    if (data.min_order_qty !== undefined && data.min_order_qty < 0) errors.min_order_qty = 'MOQ ต้องไม่ติดลบ'
    if (data.lead_time_days !== undefined && data.lead_time_days < 0) errors.lead_time_days = 'Lead time ต้องไม่ติดลบ'
    return errors
  }

  function resetForm() {
    setFormData({
      supplier_id: '',
      ingredient_id: '',
      supplier_sku: '',
      supplier_name: '',
      purchase_unit: '',
      use_unit: '',
      conversion_factor: 1.0,
      last_committed_price: 0,
      last_realized_price: 0,
      last_approved_price: 0,
      min_order_qty: 1,
      lead_time_days: 7,
      is_preferred: false,
      is_active: true,
    })
    setFormErrors({})
    setEditingId(null)
    setShowForm(false)
  }

  function startAdd() {
    resetForm()
    setShowForm(true)
  }

  function startEdit(mapping: SupplierProduct) {
    setEditingId(mapping.id)
    setFormData({
      supplier_id: mapping.supplier_id,
      ingredient_id: mapping.ingredient_id,
      supplier_sku: mapping.supplier_sku || '',
      supplier_name: mapping.supplier_name || '',
      purchase_unit: mapping.purchase_unit,
      use_unit: mapping.use_unit,
      conversion_factor: mapping.conversion_factor,
      last_committed_price: mapping.last_committed_price || 0,
      last_realized_price: mapping.last_realized_price || 0,
      last_approved_price: mapping.last_approved_price || 0,
      min_order_qty: mapping.min_order_qty,
      lead_time_days: mapping.lead_time_days,
      is_preferred: mapping.is_preferred,
      is_active: mapping.is_active,
    })
    setFormErrors({})
    setShowForm(true)
  }

  async function handleSubmit() {
    const errors = validateForm(formData)
    if (Object.keys(errors).length > 0) {
      setFormErrors(errors)
      showToast('กรุณาตรวจสอบข้อมูลที่ผิดพลาด', 'error')
      return
    }

    try {
      let result: SupplierProduct | null = null
      const payload: SupplierProductForm = {
        supplier_id: formData.supplier_id!,
        ingredient_id: formData.ingredient_id!,
        supplier_sku: formData.supplier_sku || undefined,
        supplier_name: formData.supplier_name || undefined,
        purchase_unit: formData.purchase_unit!,
        use_unit: formData.use_unit!,
        conversion_factor: formData.conversion_factor ?? 1.0,
        last_committed_price: formData.last_committed_price || undefined,
        last_realized_price: formData.last_realized_price || undefined,
        last_approved_price: formData.last_approved_price || undefined,
        min_order_qty: formData.min_order_qty ?? 1,
        lead_time_days: formData.lead_time_days ?? 7,
        is_preferred: formData.is_preferred ?? false,
        is_active: formData.is_active ?? true,
      }

      if (editingId) {
        result = await updateSupplierProduct(editingId, payload)
      } else {
        result = await createSupplierProduct(payload)
      }

      if (result) {
        if (editingId) {
          setMappings(prev => prev.map(m => m.id === editingId ? result! : m))
          showToast('อัปเดตการจับคู่สำเร็จ!', 'success')
        } else {
          setMappings(prev => [...prev, result!])
          showToast('เพิ่มการจับคู่สำเร็จ!', 'success')
        }
        resetForm()
      } else {
        showToast(editingId ? 'ไม่สามารถอัปเดตได้' : 'เกิดข้อผิดพลาดในการเพิ่มการจับคู่', 'error')
      }
    } catch (e) {
      console.error('[SupplierProductMappingPage] Submit failed:', e)
      showToast('เกิดข้อผิดพลาด', 'error')
    }
  }

  async function handleDeactivate(id: string) {
    if (!confirm('ต้องการปิดใช้งานการจับคู่นี้?')) return
    try {
      const ok = await deleteSupplierProduct(id)
      if (ok) {
        setMappings(prev => prev.map(m => m.id === id ? { ...m, is_active: false } : m))
        showToast('ปิดใช้งานสำเร็จ!', 'success')
      } else {
        showToast('ไม่สามารถปิดใช้งานได้', 'error')
      }
    } catch (e) {
      console.error('[SupplierProductMappingPage] Deactivate failed:', e)
      showToast('เกิดข้อผิดพลาด', 'error')
    }
  }

  const supplierName = (id?: string) => {
    if (!id) return '-'
    const s = suppliers.find(s => s.id === id)
    return s?.name || id
  }

  const ingredientName = (id?: string) => {
    if (!id) return '-'
    const i = ingredients.find(i => i.id === id)
    return i?.name || id
  }

  const ingredientUnit = (id?: string) => {
    if (!id) return ''
    const i = ingredients.find(i => i.id === id)
    return i?.unit || ''
  }

  return (
    <div className="max-w-7xl mx-auto px-4 py-6">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-3xl font-bold text-brand-accent">🔗 จับคู่สินค้าผู้ขายกับวัตถุดิบ (Supplier Product Mapping)</h1>
        <div className="flex gap-2">
          <button onClick={loadData} className="btn btn-outline text-sm" disabled={loading}>รีเฟรช</button>
          <button onClick={startAdd} className="btn btn-primary">+ เพิ่มการจับคู่</button>
        </div>
      </div>

      {loading && (
        <div className="card text-center py-8">
          <p className="text-brand-muted">กำลังโหลดข้อมูล...</p>
        </div>
      )}

      {loadError && (
        <div className="mb-4">
          <LoadErrorBanner message={loadError} onRetry={loadData} testId="mapping-load-error" />
        </div>
      )}

      {/* View Mode Toggle */}
      <div className="card mb-4">
        <div className="flex items-center gap-4 p-3 bg-brand-bg rounded-lg">
          <span className="text-sm font-medium text-brand-muted">มุมมอง:</span>
          <button
            onClick={() => setViewMode('list')}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
              viewMode === 'list' ? 'bg-brand-primary text-white' : 'text-brand-muted hover:text-brand-primary hover:bg-brand-bg'
            }`}
          >
            📋 รายการ
          </button>
          <button
            onClick={() => setViewMode('comparison')}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
              viewMode === 'comparison' ? 'bg-brand-primary text-white' : 'text-brand-muted hover:text-brand-primary hover:bg-brand-bg'
            }`}
          >
            📊 เปรียบเทียบราคา
          </button>
        </div>
      </div>

      {/* Search/Filter */}
      <div className="card mb-4">
        <div className="grid grid-cols-1 md:grid-cols-5 gap-3 p-3 bg-brand-bg rounded-lg">
          <div>
            <label className="block text-xs text-brand-muted mb-1">ค้นหา</label>
            <input type="text" placeholder="ผู้ขาย, วัตถุดิบ, SKU..." value={searchText} onChange={(e) => setSearchText(e.target.value)} className="input text-sm" />
          </div>
          <div>
            <label className="block text-xs text-brand-muted mb-1">ผู้ขาย</label>
            <select value={supplierFilter} onChange={(e) => setSupplierFilter(e.target.value)} className="input text-sm">
              <option value="">ทั้งหมด</option>
              {suppliers.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs text-brand-muted mb-1">วัตถุดิบ</label>
            <select value={ingredientFilter} onChange={(e) => setIngredientFilter(e.target.value)} className="input text-sm">
              <option value="">ทั้งหมด</option>
              {ingredients.map(i => <option key={i.id} value={i.id}>{i.name}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs text-brand-muted mb-1">สถานะ</label>
            <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value as any)} className="input text-sm">
              <option value="all">ทั้งหมด</option>
              <option value="active">ใช้งานอยู่</option>
              <option value="inactive">ปิดใช้งาน</option>
            </select>
          </div>
          <div>
            <label className="block text-xs text-brand-muted mb-1">จำนวน</label>
            <div className="text-sm font-bold text-brand-accent">{filteredMappings.length} รายการ</div>
          </div>
        </div>
      </div>

      {/* Add/Edit Form */}
      {showForm && (
        <div className="card mb-6 bg-brand-bg">
          <h3 className="font-bold text-brand-accent mb-4">{editingId ? '✏️ แก้ไขการจับคู่' : '➕ เพิ่มการจับคู่ใหม่'}</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-brand-muted mb-1">ผู้ขาย <span className="text-red-500">*</span></label>
              <select value={formData.supplier_id || ''} onChange={(e) => setFormData({ ...formData, supplier_id: e.target.value })} className={`input ${formErrors.supplier_id ? 'border-red-500' : ''}`}>
                <option value="">— เลือกผู้ขาย —</option>
                {suppliers.map(s => <option key={s.id} value={s.id}>{s.name} ({s.code})</option>)}
              </select>
              {formErrors.supplier_id && <p className="text-red-500 text-xs mt-1">{formErrors.supplier_id}</p>}
            </div>
            <div>
              <label className="block text-sm font-medium text-brand-muted mb-1">วัตถุดิบ <span className="text-red-500">*</span></label>
              <select value={formData.ingredient_id || ''} onChange={(e) => setFormData({ ...formData, ingredient_id: e.target.value })} className={`input ${formErrors.ingredient_id ? 'border-red-500' : ''}`}>
                <option value="">— เลือกวัตถุดิบ —</option>
                {ingredients.map(i => <option key={i.id} value={i.id}>{i.name} ({i.unit})</option>)}
              </select>
              {formErrors.ingredient_id && <p className="text-red-500 text-xs mt-1">{formErrors.ingredient_id}</p>}
            </div>

            <div className="md:col-span-2 lg:col-span-3">
              <label className="block text-sm font-medium text-brand-muted mb-1">SKU / Barcode ผู้ขาย</label>
              <input type="text" placeholder="เช่น CHK-001, 8851234567890" value={formData.supplier_sku || ''} onChange={(e) => setFormData({ ...formData, supplier_sku: e.target.value })} className="input" />
            </div>

            <div className="md:col-span-2 lg:col-span-3">
              <label className="block text-sm font-medium text-brand-muted mb-1">ชื่อสินค้าตามผู้ขาย</label>
              <input type="text" placeholder="เช่น เนื้อไก่สับแช่แข็ง 1 กก." value={formData.supplier_name || ''} onChange={(e) => setFormData({ ...formData, supplier_name: e.target.value })} className="input" />
            </div>

            <hr className="col-span-full border-brand-border my-2" />

            <div className="col-span-full">
              <h4 className="font-semibold text-brand-accent mb-3">📦 หน่วยและการแปลงหน่วย</h4>
            </div>
            <div>
              <label className="block text-sm font-medium text-brand-muted mb-1">หน่วยซื้อ (Purchase Unit) <span className="text-red-500">*</span></label>
              <input type="text" placeholder="เช่น กล่อง, ถุง, แพ็ค" value={formData.purchase_unit || ''} onChange={(e) => setFormData({ ...formData, purchase_unit: e.target.value })} className={`input ${formErrors.purchase_unit ? 'border-red-500' : ''}`} />
              {formErrors.purchase_unit && <p className="text-red-500 text-xs mt-1">{formErrors.purchase_unit}</p>}
            </div>
            <div>
              <label className="block text-sm font-medium text-brand-muted mb-1">หน่วยใช้ (Use Unit) <span className="text-red-500">*</span></label>
              <input type="text" placeholder="เช่น กก., กรัม, ชิ้น" value={formData.use_unit || ''} onChange={(e) => setFormData({ ...formData, use_unit: e.target.value })} className={`input ${formErrors.use_unit ? 'border-red-500' : ''}`} />
              {formErrors.use_unit && <p className="text-red-500 text-xs mt-1">{formErrors.use_unit}</p>}
            </div>
            <div>
              <label className="block text-sm font-medium text-brand-muted mb-1">อัตราแปลง (Conversion Factor) <span className="text-red-500">*</span></label>
              <input type="number" step="0.01" min="0.01" value={formData.conversion_factor ?? 1} onChange={(e) => setFormData({ ...formData, conversion_factor: parseFloat(e.target.value) || 1 })} className={`input ${formErrors.conversion_factor ? 'border-red-500' : ''}`} />
              {formErrors.conversion_factor && <p className="text-red-500 text-xs mt-1">{formErrors.conversion_factor}</p>}
              <p className="text-xs text-brand-muted mt-1">1 {formData.purchase_unit || 'หน่วยซื้อ'} = {formData.conversion_factor ?? 1} {formData.use_unit || 'หน่วยใช้'}</p>
            </div>

            <hr className="col-span-full border-brand-border my-2" />

            <div className="col-span-full">
              <h4 className="font-semibold text-brand-accent mb-3">💰 ราคา 3 สถานะ (Price States)</h4>
            </div>
            <div>
              <label className="block text-sm font-medium text-brand-muted mb-1">Committed Price (PO Approved) ต่อ {formData.purchase_unit || 'หน่วยซื้อ'}</label>
              <input type="number" step="0.01" min="0" value={formData.last_committed_price ?? 0} onChange={(e) => setFormData({ ...formData, last_committed_price: parseFloat(e.target.value) || 0 })} className="input" />
              <p className="text-xs text-brand-muted mt-1">ต่อหน่วยใช้: {formData.last_committed_price && formData.conversion_factor ? `฿${(formData.last_committed_price / formData.conversion_factor).toFixed(2)}` : '-'}</p>
            </div>
            <div>
              <label className="block text-sm font-medium text-brand-muted mb-1">Realized Price (GRN Posted) ต่อ {formData.purchase_unit || 'หน่วยซื้อ'}</label>
              <input type="number" step="0.01" min="0" value={formData.last_realized_price ?? 0} onChange={(e) => setFormData({ ...formData, last_realized_price: parseFloat(e.target.value) || 0 })} className="input" />
              <p className="text-xs text-brand-muted mt-1">ต่อหน่วยใช้: {formData.last_realized_price && formData.conversion_factor ? `฿${(formData.last_realized_price / formData.conversion_factor).toFixed(2)}` : '-'}</p>
            </div>
            <div>
              <label className="block text-sm font-medium text-brand-muted mb-1">Approved Price (For Costing) ต่อ {formData.purchase_unit || 'หน่วยซื้อ'}</label>
              <input type="number" step="0.01" min="0" value={formData.last_approved_price ?? 0} onChange={(e) => setFormData({ ...formData, last_approved_price: parseFloat(e.target.value) || 0 })} className="input" />
              <p className="text-xs text-brand-muted mt-1">ต่อหน่วยใช้: {formData.last_approved_price && formData.conversion_factor ? `฿${(formData.last_approved_price / formData.conversion_factor).toFixed(2)}` : '-'}</p>
            </div>

            <hr className="col-span-full border-brand-border my-2" />

            <div>
              <label className="block text-sm font-medium text-brand-muted mb-1">MOQ (Min Order Qty) <span className="text-red-500">*</span></label>
              <input type="number" min="0" step="1" value={formData.min_order_qty ?? 1} onChange={(e) => setFormData({ ...formData, min_order_qty: parseInt(e.target.value) || 0 })} className={`input ${formErrors.min_order_qty ? 'border-red-500' : ''}`} />
              {formErrors.min_order_qty && <p className="text-red-500 text-xs mt-1">{formErrors.min_order_qty}</p>}
            </div>
            <div>
              <label className="block text-sm font-medium text-brand-muted mb-1">Lead Time (วัน) <span className="text-red-500">*</span></label>
              <input type="number" min="0" step="1" value={formData.lead_time_days ?? 7} onChange={(e) => setFormData({ ...formData, lead_time_days: parseInt(e.target.value) || 0 })} className={`input ${formErrors.lead_time_days ? 'border-red-500' : ''}`} />
              {formErrors.lead_time_days && <p className="text-red-500 text-xs mt-1">{formErrors.lead_time_days}</p>}
            </div>
            <div className="flex items-center gap-2 pt-4">
              <input type="checkbox" id="is_preferred" checked={formData.is_preferred ?? false} onChange={(e) => setFormData({ ...formData, is_preferred: e.target.checked })} className="w-4 h-4" />
              <label htmlFor="is_preferred" className="text-sm font-medium text-brand-muted">Preferred Supplier (แนะนำ)</label>
            </div>
            <div className="flex items-center gap-2 pt-4">
              <input type="checkbox" id="is_active" checked={formData.is_active ?? true} onChange={(e) => setFormData({ ...formData, is_active: e.target.checked })} className="w-4 h-4" />
              <label htmlFor="is_active" className="text-sm font-medium text-brand-muted">ใช้งานอยู่</label>
            </div>

            <div className="col-span-full flex gap-3 mt-4">
              <button onClick={handleSubmit} className="btn btn-primary">บันทึก</button>
              <button onClick={resetForm} className="btn btn-outline">ยกเลิก</button>
            </div>
          </div>
        </div>
      )}

      {/* List View */}
      {viewMode === 'list' && (
        <div className="card overflow-x-auto">
          <table className="w-full text-left">
            <thead className="bg-brand-bg">
              <tr>
                <th className="p-3 rounded-l-lg">ผู้ขาย</th>
                <th className="p-3">วัตถุดิบ</th>
                <th className="p-3">SKU ผู้ขาย</th>
                <th className="p-3">ชื่อสินค้าผู้ขาย</th>
                <th className="p-3">หน่วยซื้อ</th>
                <th className="p-3">หน่วยใช้</th>
                <th className="p-3">แปลงหน่วย</th>
                <th className="p-3">Committed</th>
                <th className="p-3">Realized</th>
                <th className="p-3">Approved</th>
                <th className="p-3">Per Use Unit (Approved)</th>
                <th className="p-3">Preferred</th>
                <th className="p-3">สถานะ</th>
                <th className="p-3 rounded-r-lg">จัดการ</th>
              </tr>
            </thead>
            <tbody>
              {filteredMappings.map((m) => (
                <tr key={m.id} className="border-b border-brand-border hover:bg-brand-bg">
                  <td className="p-3 font-medium">{supplierName(m.supplier_id)}</td>
                  <td className="p-3">{ingredientName(m.ingredient_id)}</td>
                  <td className="p-3 font-mono text-sm">{m.supplier_sku || '-'}</td>
                  <td className="p-3">{m.supplier_name || '-'}</td>
                  <td className="p-3">{m.purchase_unit || '-'}</td>
                  <td className="p-3">{m.use_unit || '-'}</td>
                  <td className="p-3">{m.conversion_factor || 1}</td>
                  <td className="p-3">{m.last_committed_price ? `฿${m.last_committed_price}` : '-'}</td>
                  <td className="p-3">{m.last_realized_price ? `฿${m.last_realized_price}` : '-'}</td>
                  <td className="p-3">{m.last_approved_price ? `฿${m.last_approved_price}` : '-'}</td>
                  <td className="p-3">
                    {computePricePerUseUnit(m, 'approved') !== null ? (
                      <span className="font-medium text-brand-primary">฿{computePricePerUseUnit(m, 'approved')!.toFixed(2)}</span>
                    ) : (
                      <span className="text-brand-muted">-</span>
                    )}
                  </td>
                  <td className="p-3">{m.is_preferred ? '⭐' : '-'}</td>
                  <td className="p-3">
                    <span className={`badge ${m.is_active ? 'badge-success' : 'badge-danger'}`}>
                      {m.is_active ? 'ใช้งานอยู่' : 'ปิดใช้งาน'}
                    </span>
                  </td>
                  <td className="p-3">
                    <div className="flex gap-1">
                      <button onClick={() => startEdit(m)} className="btn btn-outline text-xs">แก้ไข</button>
                      {m.is_active ? (
                        <button onClick={() => handleDeactivate(m.id)} className="btn btn-outline text-xs text-amber-600">ปิดใช้งาน</button>
                      ) : (
                        <button onClick={() => startEdit({ ...m, is_active: true })} className="btn btn-outline text-xs text-green-600">เปิดใช้งาน</button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Comparison View */}
      {viewMode === 'comparison' && (
        <div className="card overflow-x-auto">
          <p className="text-sm text-brand-muted mb-3">เปรียบเทียบราคาต่อหน่วยใช้ (Use Unit) เดียวกัน — แปลงจากราคา Approved / Conversion Factor</p>
          {comparisonData.length === 0 ? (
            <div className="text-center py-8 text-brand-muted">ไม่มีข้อมูลสำหรับเปรียบเทียบ</div>
          ) : (
            <table className="w-full text-left">
              <thead className="bg-brand-bg">
                <tr>
                  <th className="p-3 rounded-l-lg">วัตถุดิบ</th>
                  <th className="p-3">หน่วยใช้</th>
                  <th className="p-3">จำนวนผู้ขาย</th>
                  {(() => {
                    // Dynamic columns for each supplier in the first group
                    const maxSuppliers = Math.max(...comparisonData.map(g => g.mappings.length))
                    return Array.from({ length: maxSuppliers }, (_, i) => (
                      <React.Fragment key={i}>
                        <th className="p-3">ผู้ขาย {i + 1}</th>
                        <th className="p-3">SKU</th>
                        <th className="p-3">ราคา/หน่วยซื้อ</th>
                        <th className="p-3">แปลงหน่วย</th>
                        <th className="p-3">ราคา/หน่วยใช้</th>
                        <th className="p-3">Preferred</th>
                      </React.Fragment>
                    ))
                  })()}
                </tr>
              </thead>
              <tbody>
                {comparisonData.map((group, gi) => (
                  <tr key={group.ingredientId} className="border-b border-brand-border hover:bg-brand-bg">
                    <td className="p-3 font-medium">{group.ingredientName}</td>
                    <td className="p-3">{group.ingredientUnit}</td>
                    <td className="p-3">{group.mappings.length}</td>
                    {group.mappings.map((m, mi) => (
                      <React.Fragment key={mi}>
                        <td className="p-3">{supplierName(m.supplier_id)}</td>
                        <td className="p-3">{m.supplier_sku || '-'}</td>
                        <td className="p-3">{m.last_approved_price ? `฿${m.last_approved_price}` : '-'}</td>
                        <td className="p-3">{m.conversion_factor || 1}</td>
                        <td className="p-3">
                          {m.pricePerUseUnit.approved !== null ? (
                            <span className={`font-medium ${mi === 0 ? 'text-brand-primary' : 'text-brand-accent'}`}>
                              ฿{m.pricePerUseUnit.approved!.toFixed(2)}
                            </span>
                          ) : (
                            <span className="text-brand-muted">-</span>
                          )}
                        </td>
                        <td className="p-3">{m.is_preferred ? '⭐' : '-'}</td>
                      </React.Fragment>
                    ))}
                    {(() => {
                      const maxSuppliers = Math.max(...comparisonData.map(g => g.mappings.length))
                      const missing = maxSuppliers - group.mappings.length
                      return Array.from({ length: missing }, (_, i) => (
                        <React.Fragment key={`empty-${i}`}>
                          <td className="p-3" colSpan={6}></td>
                        </React.Fragment>
                      ))
                    })()}
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {filteredMappings.length === 0 && !loadError && !loading && (
        <div className="text-center py-12">
          <div className="text-6xl mb-4">🔗</div>
          <h3 className="text-xl font-bold text-brand-accent mb-2">ยังไม่มีการจับคู่</h3>
          <p className="text-brand-muted mb-4">กด "+ เพิ่มการจับคู่" เพื่อเริ่มจับคู่สินค้าผู้ขายกับวัตถุดิบ</p>
        </div>
      )}
    </div>
  )
}