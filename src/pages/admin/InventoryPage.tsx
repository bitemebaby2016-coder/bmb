import { useState, useEffect, useCallback, useMemo } from 'react'
import {
  getInventory,
  createInventory,
  updateInventory,
  updateInventoryStock,
  deleteInventory,
  deactivateInventory,
  getLowStockAlerts,
  type InventoryForm,
} from '@/lib/bmbAdminApi_inventory'
import { getSuppliers } from '@/lib/bmbAdminApi_suppliers'
import { showToast } from '@/components/ui/ToastContainer'
import { LoadErrorBanner } from '@/components/ui/LoadErrorBanner'
import type { Ingredient, IngredientUnit, ReorderAlert, Supplier } from '@/types'

const CATEGORIES = ['protein', 'vegetable', 'carbohydrate', 'sauce', 'seasoning', 'beverage', 'other'] as const
const UNITS: IngredientUnit[] = ['kg', 'g', 'liter', 'ml', 'piece', 'dozen', 'pack', 'bunch']

function computePricePerUseUnit(ing: Ingredient): number | null {
  if (!ing.conversion_factor || ing.conversion_factor <= 0) return null
  const basePrice = ing.wavg_cost ?? ing.last_approved_price ?? ing.unit_price
  return basePrice / ing.conversion_factor
}

function getStatusBadge(status: Ingredient['status']) {
  switch (status) {
    case 'in_stock': return { class: 'badge-success', label: '✅ มีของ' }
    case 'low_stock': return { class: 'badge-warning', label: '⚠️ ใกล้หมด' }
    case 'out_of_stock': return { class: 'badge-danger', label: '❌ หมด' }
    case 'critical': return { class: 'badge-danger', label: '🔴 วิกฤต' }
    default: return { class: 'badge', label: status }
  }
}

export function InventoryPage() {
  const [ingredients, setIngredients] = useState<Ingredient[]>([])
  const [suppliers, setSuppliers] = useState<Supplier[]>([])
  const [alerts, setAlerts] = useState<ReorderAlert[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [loadError, setLoadError] = useState('')
  const [showForm, setShowForm] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [formData, setFormData] = useState<Partial<InventoryForm>>({})
  const [formErrors, setFormErrors] = useState<Record<string, string>>({})
  const [searchText, setSearchText] = useState('')
  const [categoryFilter, setCategoryFilter] = useState<string>('')
  const [statusFilter, setStatusFilter] = useState<string>('')
  const [sortBy, setSortBy] = useState<'name' | 'category' | 'current_stock' | 'unit_price' | 'pricePerUseUnit'>('name')
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc')

  const loadSuppliers = useCallback(async () => {
    const data = await getSuppliers()
    setSuppliers(data || [])
  }, [])

  const loadInventory = useCallback(async () => {
    setIsLoading(true)
    setLoadError('')
    try {
      const data = await getInventory()
      setIngredients(data || [])
    } catch (e) {
      console.error('[InventoryPage] Failed to load inventory:', e)
      setLoadError('โหลดคลังวัตถุดิบไม่สำเร็จ — ตรวจสอบการเชื่อมต่อแล้วกด "ลองใหม่"')
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    void loadSuppliers()
    void loadInventory()
  }, [loadSuppliers, loadInventory])

  useEffect(() => {
    const computedAlerts: ReorderAlert[] = []
    ingredients.forEach(ing => {
      if (ing.current_stock <= ing.min_stock) {
        const urgency = ing.current_stock <= ing.min_stock * 0.5
          ? 'critical' as const
          : ing.current_stock <= ing.min_stock * 0.75
            ? 'high' as const
            : 'medium' as const
        computedAlerts.push({
          id: `alert-${ing.id}`,
          ingredient_id: ing.id,
          ingredient_name: ing.name,
          current_stock: ing.current_stock,
          min_stock: ing.min_stock,
          recommended_quantity: Math.max(ing.max_stock - ing.current_stock, ing.min_stock),
          estimated_cost: (ing.max_stock - ing.current_stock) * ing.unit_price,
          urgency,
          generated_at: new Date().toISOString(),
          is_resolved: false,
        })
      }
    })
    setAlerts(computedAlerts)
  }, [ingredients])

  const filteredIngredients = useMemo(() => {
    let result = [...ingredients]
    if (searchText) {
      const q = searchText.toLowerCase()
      result = result.filter(ing =>
        ing.name.toLowerCase().includes(q) ||
        ing.category.toLowerCase().includes(q) ||
        ing.supplier_name?.toLowerCase().includes(q)
      )
    }
    if (categoryFilter) result = result.filter(ing => ing.category === categoryFilter)
    if (statusFilter) result = result.filter(ing => ing.status === statusFilter)

    result.sort((a, b) => {
      let aVal: any
      let bVal: any
      if (sortBy === 'pricePerUseUnit') {
        aVal = computePricePerUseUnit(a) ?? 0
        bVal = computePricePerUseUnit(b) ?? 0
      } else {
        aVal = a[sortBy]
        bVal = b[sortBy]
      }
      if (typeof aVal === 'string') aVal = aVal.toLowerCase()
      if (typeof bVal === 'string') bVal = bVal.toLowerCase()
      if (aVal < bVal) return sortDir === 'asc' ? -1 : 1
      if (aVal > bVal) return sortDir === 'asc' ? 1 : -1
      return 0
    })
    return result
  }, [ingredients, searchText, categoryFilter, statusFilter, sortBy, sortDir])

  function handleSort(field: 'name' | 'category' | 'current_stock' | 'unit_price' | 'pricePerUseUnit') {
    setSortBy(prev => {
      if (prev === field) setSortDir(d => d === 'asc' ? 'desc' : 'asc')
      else setSortDir('asc')
      return field
    })
  }

  function validateForm(data: Partial<InventoryForm>): Record<string, string> {
    const errors: Record<string, string> = {}
    if (!data.name?.trim()) errors.name = 'กรุณาใส่ชื่อวัตถุดิบ'
    if (data.current_stock !== undefined && data.current_stock < 0) errors.current_stock = 'สต็อกต้องไม่ติดลบ'
    if (data.min_stock !== undefined && data.min_stock < 0) errors.min_stock = 'จุดสั่งซื้อต้องไม่ติดลบ'
    if (data.max_stock !== undefined && data.max_stock < 0) errors.max_stock = 'สต็อกสูงสุดต้องไม่ติดลบ'
    if (data.unit_price !== undefined && data.unit_price < 0) errors.unit_price = 'ราคาต้องไม่ติดลบ'
    if (data.conversion_factor !== undefined && data.conversion_factor <= 0) errors.conversion_factor = 'อัตราแปลงหน่วยต้องมากกว่า 0'
    if (data.prep_yield_factor !== undefined && (data.prep_yield_factor <= 0 || data.prep_yield_factor > 1)) errors.prep_yield_factor = 'Yield ต้องอยู่ระหว่าง 0-1'
    if (data.prep_waste_pct !== undefined && (data.prep_waste_pct < 0 || data.prep_waste_pct > 100)) errors.prep_waste_pct = 'Waste % ต้องอยู่ระหว่าง 0-100'
    if (data.package_size !== undefined && data.package_size < 0) errors.package_size = 'ขนาดบรรจุต้องไม่ติดลบ'
    if (data.gross_weight !== undefined && data.gross_weight < 0) errors.gross_weight = 'น้ำหนักรวมต้องไม่ติดลบ'
    if (data.net_weight !== undefined && data.net_weight < 0) errors.net_weight = 'น้ำหนักสุทธิต้องไม่ติดลบ'
    return errors
  }

  function resetForm() {
    setFormData({
      name: '',
      category: 'protein',
      unit: 'kg' as IngredientUnit,
      current_stock: 0,
      min_stock: 1,
      max_stock: 10,
      unit_price: 0,
      supplier_name: '',
      supplier_phone: '',
      supplier_id: '',
      prep_yield_factor: 1.0,
      prep_waste_pct: 0,
      purchase_unit: '',
      use_unit: '',
      conversion_factor: 1.0,
      package_size: 0,
      gross_weight: 0,
      net_weight: 0,
      wavg_cost: 0,
      last_purchase_price: 0,
      last_approved_price: 0,
    })
    setFormErrors({})
    setEditingId(null)
    setShowForm(false)
  }

  function startAdd() {
    resetForm()
    setShowForm(true)
  }

  function startEdit(ing: Ingredient) {
    setEditingId(ing.id)
    setFormData({
      id: ing.id,
      name: ing.name,
      category: ing.category,
      unit: ing.unit,
      current_stock: ing.current_stock,
      min_stock: ing.min_stock,
      max_stock: ing.max_stock,
      unit_price: ing.unit_price,
      supplier_name: ing.supplier_name,
      supplier_phone: ing.supplier_phone,
      supplier_id: ing.supplier_id || '',
      prep_yield_factor: ing.prep_yield_factor ?? 1.0,
      prep_waste_pct: ing.prep_waste_pct ?? 0,
      purchase_unit: ing.purchase_unit || '',
      use_unit: ing.use_unit || '',
      conversion_factor: ing.conversion_factor ?? 1.0,
      package_size: ing.package_size || 0,
      gross_weight: ing.gross_weight || 0,
      net_weight: ing.net_weight || 0,
      wavg_cost: ing.wavg_cost || 0,
      last_purchase_price: ing.last_purchase_price || 0,
      last_approved_price: ing.last_approved_price || 0,
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
      let result: Ingredient | null = null
      const payload = {
        name: formData.name || '',
        category: formData.category || 'protein',
        unit: formData.unit || 'kg',
        current_stock: formData.current_stock ?? 0,
        min_stock: formData.min_stock ?? 1,
        max_stock: formData.max_stock ?? 10,
        unit_price: formData.unit_price ?? 0,
        supplier_name: formData.supplier_name || '',
        supplier_phone: formData.supplier_phone || '',
        supplier_id: formData.supplier_id || undefined,
        prep_yield_factor: formData.prep_yield_factor ?? 1.0,
        prep_waste_pct: formData.prep_waste_pct ?? 0,
        purchase_unit: formData.purchase_unit || undefined,
        use_unit: formData.use_unit || undefined,
        conversion_factor: formData.conversion_factor ?? 1.0,
        package_size: formData.package_size || undefined,
        gross_weight: formData.gross_weight || undefined,
        net_weight: formData.net_weight || undefined,
        wavg_cost: formData.wavg_cost || undefined,
        last_purchase_price: formData.last_purchase_price || undefined,
        last_approved_price: formData.last_approved_price || undefined,
      }

      if (editingId) {
        result = await updateInventory(editingId, payload)
      } else {
        result = await createInventory(payload as InventoryForm)
      }

      if (result) {
        if (editingId) {
          setIngredients(prev => prev.map(ing => ing.id === editingId ? result! : ing))
          showToast('อัปเดตวัตถุดิบสำเร็จ!', 'success')
        } else {
          setIngredients(prev => [...prev, result!])
          showToast('เพิ่มวัตถุดิบสำเร็จ!', 'success')
        }
        resetForm()
      } else {
        showToast(editingId ? 'ไม่สามารถอัปเดตได้' : 'เกิดข้อผิดพลาดในการเพิ่มวัตถุดิบ', 'error')
      }
    } catch (e) {
      console.error('[InventoryPage] Submit failed:', e)
      showToast('เกิดข้อผิดพลาด', 'error')
    }
  }

  async function handleDeactivate(id: string) {
    if (!confirm('ต้องการปิดใช้งานวัตถุดิบนี้? (จะไม่แสดงในรายการแต่อยู่ในฐานข้อมูล)')) return
    try {
      const ok = await deactivateInventory(id)
      if (ok) {
        setIngredients(prev => prev.map(ing => ing.id === id ? { ...ing, status: 'out_of_stock' as const } : ing))
        showToast('ปิดใช้งานสำเร็จ!', 'success')
      } else {
        showToast('ไม่สามารถปิดใช้งานได้', 'error')
      }
    } catch (e) {
      console.error('[InventoryPage] Deactivate failed:', e)
      showToast('เกิดข้อผิดพลาด', 'error')
    }
  }

  async function handleDelete(id: string) {
    if (!confirm('ต้องการลบวัตถุดิบนี้ถาวร? (ไม่สามารถกู้คืนได้)')) return
    try {
      const ok = await deleteInventory(id)
      if (ok) {
        setIngredients(prev => prev.filter(ing => ing.id !== id))
        showToast('ลบวัตถุดิบสำเร็จ!', 'success')
      } else {
        showToast('ไม่สามารถลบวัตถุดิบได้', 'error')
      }
    } catch (e) {
      console.error('[InventoryPage] Delete failed:', e)
      showToast('เกิดข้อผิดพลาด', 'error')
    }
  }

  async function handleStockUpdate(id: string, quantity: number, reason: string) {
    try {
      const updated = await updateInventoryStock(id, quantity, reason)
      if (updated) {
        setIngredients(prev => prev.map(ing => ing.id === id ? { ...ing, ...updated, updated_at: new Date().toISOString() } : ing))
        showToast('อัปเดตสต็อกสำเร็จ!', 'success')
      } else {
        showToast('ไม่สามารถอัปเดตสต็อกได้', 'error')
      }
    } catch (e) {
      console.error('[InventoryPage] Stock update failed:', e)
      showToast('เกิดข้อผิดพลาด', 'error')
    }
  }

  const supplierName = (supplierId?: string) => {
    if (!supplierId) return '-'
    const s = suppliers.find(s => s.id === supplierId)
    return s?.name || supplierId
  }

  return (
    <div className="max-w-7xl mx-auto px-4 py-6">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-3xl font-bold text-brand-accent">📦 จัดการวัตถุดิบ (Ingredient Master)</h1>
        <div className="flex gap-2">
          <button onClick={() => { void loadInventory(); void loadSuppliers() }} className="btn btn-outline text-sm" disabled={isLoading}>รีเฟรช</button>
          <button onClick={startAdd} className="btn btn-primary">+ เพิ่มวัตถุดิบ</button>
        </div>
      </div>

      {isLoading && (
        <div className="card text-center py-8">
          <p className="text-brand-muted">กำลังโหลดข้อมูล...</p>
        </div>
      )}

      {!isLoading && alerts.length > 0 && (
        <div className="card mb-6 bg-yellow-50 border-2 border-yellow-400">
          <h3 className="font-bold text-yellow-800 mb-4">⚠️ แจ้งเตือนสต็อกต่ำ ({alerts.length} รายการ)</h3>
          <div className="space-y-3">
            {alerts.map((alert) => (
              <div key={alert.id} className="flex items-center gap-4 p-3 bg-white rounded-lg">
                <div className={`w-3 h-3 rounded-full ${alert.urgency === 'critical' ? 'bg-red-500' : alert.urgency === 'high' ? 'bg-orange-500' : 'bg-yellow-500'}`}></div>
                <div className="flex-1">
                  <div className="font-bold text-brand-accent">{alert.ingredient_name}</div>
                  <div className="text-sm text-brand-muted">เหลือ {alert.current_stock} / ต้องมีอย่างน้อย {alert.min_stock} | แนะนำซื้อ {alert.recommended_quantity} {ingredients.find(i => i.id === alert.ingredient_id)?.unit || 'หน่วย'}</div>
                </div>
                <div className="text-right">
                  <div className="text-brand-primary font-bold">฿{alert.estimated_cost.toFixed(0)}</div>
                  <button className="btn btn-outline text-xs mt-1">สร้างใบสั่งซื้อ</button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {showForm && (
        <div className="card mb-6 bg-brand-bg">
          <h3 className="font-bold text-brand-accent mb-4">{editingId ? '✏️ แก้ไขวัตถุดิบ' : '➕ เพิ่มวัตถุดิบใหม่'}</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-brand-muted mb-1">ชื่อวัตถุดิบ <span className="text-red-500">*</span></label>
              <input type="text" placeholder="เช่น เนื้อไก่สับ" value={formData.name || ''} onChange={(e) => setFormData({ ...formData, name: e.target.value })} className={`input ${formErrors.name ? 'border-red-500' : ''}`} />
              {formErrors.name && <p className="text-red-500 text-xs mt-1">{formErrors.name}</p>}
            </div>
            <div>
              <label className="block text-sm font-medium text-brand-muted mb-1">หมวดหมู่ <span className="text-red-500">*</span></label>
              <select value={formData.category || 'protein'} onChange={(e) => setFormData({ ...formData, category: e.target.value })} className="input">
                {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-brand-muted mb-1">หน่วยนับพื้นฐาน (Use Unit) <span className="text-red-500">*</span></label>
              <select value={formData.unit || 'kg'} onChange={(e) => setFormData({ ...formData, unit: e.target.value as IngredientUnit })} className="input">
                {UNITS.map(u => <option key={u} value={u}>{u}</option>)}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-brand-muted mb-1">สต็อกปัจจุบัน</label>
              <input type="number" step="0.01" min="0" value={formData.current_stock ?? 0} onChange={(e) => setFormData({ ...formData, current_stock: parseFloat(e.target.value) || 0 })} className={`input ${formErrors.current_stock ? 'border-red-500' : ''}`} />
              {formErrors.current_stock && <p className="text-red-500 text-xs mt-1">{formErrors.current_stock}</p>}
            </div>
            <div>
              <label className="block text-sm font-medium text-brand-muted mb-1">จุดสั่งซื้อ (Min Stock)</label>
              <input type="number" step="0.01" min="0" value={formData.min_stock ?? 1} onChange={(e) => setFormData({ ...formData, min_stock: parseFloat(e.target.value) || 0 })} className={`input ${formErrors.min_stock ? 'border-red-500' : ''}`} />
              {formErrors.min_stock && <p className="text-red-500 text-xs mt-1">{formErrors.min_stock}</p>}
            </div>
            <div>
              <label className="block text-sm font-medium text-brand-muted mb-1">สต็อกสูงสุด (Max Stock)</label>
              <input type="number" step="0.01" min="0" value={formData.max_stock ?? 10} onChange={(e) => setFormData({ ...formData, max_stock: parseFloat(e.target.value) || 0 })} className={`input ${formErrors.max_stock ? 'border-red-500' : ''}`} />
              {formErrors.max_stock && <p className="text-red-500 text-xs mt-1">{formErrors.max_stock}</p>}
            </div>

            <div>
              <label className="block text-sm font-medium text-brand-muted mb-1">ราคาต่อหน่วยใช้ (฿)</label>
              <input type="number" step="0.01" min="0" value={formData.unit_price ?? 0} onChange={(e) => setFormData({ ...formData, unit_price: parseFloat(e.target.value) || 0 })} className={`input ${formErrors.unit_price ? 'border-red-500' : ''}`} />
              {formErrors.unit_price && <p className="text-red-500 text-xs mt-1">{formErrors.unit_price}</p>}
            </div>
            <div>
              <label className="block text-sm font-medium text-brand-muted mb-1">ผู้ขาย (ข้อความ)</label>
              <input type="text" placeholder="ชื่อผู้ขาย" value={formData.supplier_name || ''} onChange={(e) => setFormData({ ...formData, supplier_name: e.target.value })} className="input" />
            </div>
            <div>
              <label className="block text-sm font-medium text-brand-muted mb-1">เบอร์โทรผู้ขาย</label>
              <input type="text" placeholder="เบอร์โทร" value={formData.supplier_phone || ''} onChange={(e) => setFormData({ ...formData, supplier_phone: e.target.value })} className="input" />
            </div>

            <div className="md:col-span-2 lg:col-span-3">
              <label className="block text-sm font-medium text-brand-muted mb-1">ผู้ขาย (เชื่อม Supplier Master)</label>
              <select value={formData.supplier_id || ''} onChange={(e) => setFormData({ ...formData, supplier_id: e.target.value })} className="input">
                <option value="">— ไม่ระบุ —</option>
                {suppliers.map(s => <option key={s.id} value={s.id}>{s.name} ({s.code})</option>)}
              </select>
            </div>

            <hr className="col-span-full border-brand-border my-2" />

            <div className="col-span-full">
              <h4 className="font-semibold text-brand-accent mb-3">📦 หน่วยซื้อ / หน่วยใช้ และการแปลงหน่วย</h4>
            </div>
            <div>
              <label className="block text-sm font-medium text-brand-muted mb-1">หน่วยซื้อ (Purchase Unit)</label>
              <input type="text" placeholder="เช่น กล่อง, ถุง, แพ็ค" value={formData.purchase_unit || ''} onChange={(e) => setFormData({ ...formData, purchase_unit: e.target.value })} className="input" />
            </div>
            <div>
              <label className="block text-sm font-medium text-brand-muted mb-1">หน่วยใช้ (Use Unit)</label>
              <input type="text" placeholder="เช่น กก., กรัม, ชิ้น" value={formData.use_unit || ''} onChange={(e) => setFormData({ ...formData, use_unit: e.target.value })} className="input" />
            </div>
            <div>
              <label className="block text-sm font-medium text-brand-muted mb-1">อัตราแปลง (Conversion Factor) <span className="text-red-500">*</span></label>
              <input type="number" step="0.01" min="0.01" value={formData.conversion_factor ?? 1} onChange={(e) => setFormData({ ...formData, conversion_factor: parseFloat(e.target.value) || 1 })} className={`input ${formErrors.conversion_factor ? 'border-red-500' : ''}`} />
              {formErrors.conversion_factor && <p className="text-red-500 text-xs mt-1">{formErrors.conversion_factor}</p>}
              <p className="text-xs text-brand-muted mt-1">1 {formData.purchase_unit || 'หน่วยซื้อ'} = {formData.conversion_factor ?? 1} {formData.use_unit || 'หน่วยใช้'}</p>
            </div>
            <div>
              <label className="block text-sm font-medium text-brand-muted mb-1">ขนาดบรรจุ (Package Size)</label>
              <input type="number" step="1" min="0" value={formData.package_size ?? 0} onChange={(e) => setFormData({ ...formData, package_size: parseInt(e.target.value) || 0 })} className={`input ${formErrors.package_size ? 'border-red-500' : ''}`} />
              {formErrors.package_size && <p className="text-red-500 text-xs mt-1">{formErrors.package_size}</p>}
            </div>
            <div>
              <label className="block text-sm font-medium text-brand-muted mb-1">น้ำหนักรวม (Gross Weight, กก.)</label>
              <input type="number" step="0.01" min="0" value={formData.gross_weight ?? 0} onChange={(e) => setFormData({ ...formData, gross_weight: parseFloat(e.target.value) || 0 })} className={`input ${formErrors.gross_weight ? 'border-red-500' : ''}`} />
              {formErrors.gross_weight && <p className="text-red-500 text-xs mt-1">{formErrors.gross_weight}</p>}
            </div>
            <div>
              <label className="block text-sm font-medium text-brand-muted mb-1">น้ำหนักสุทธิ (Net Weight, กก.)</label>
              <input type="number" step="0.01" min="0" value={formData.net_weight ?? 0} onChange={(e) => setFormData({ ...formData, net_weight: parseFloat(e.target.value) || 0 })} className={`input ${formErrors.net_weight ? 'border-red-500' : ''}`} />
              {formErrors.net_weight && <p className="text-red-500 text-xs mt-1">{formErrors.net_weight}</p>}
            </div>

            <hr className="col-span-full border-brand-border my-2" />

            <div className="col-span-full">
              <h4 className="font-semibold text-brand-accent mb-3">🔪 ผลผลิต / ของเสีย ระหว่างเตรียม (Prep Yield / Waste)</h4>
            </div>
            <div>
              <label className="block text-sm font-medium text-brand-muted mb-1">Yield Factor (0-1) <span className="text-red-500">*</span></label>
              <input type="number" step="0.01" min="0" max="1" value={formData.prep_yield_factor ?? 1} onChange={(e) => setFormData({ ...formData, prep_yield_factor: parseFloat(e.target.value) || 1 })} className={`input ${formErrors.prep_yield_factor ? 'border-red-500' : ''}`} />
              {formErrors.prep_yield_factor && <p className="text-red-500 text-xs mt-1">{formErrors.prep_yield_factor}</p>}
              <p className="text-xs text-brand-muted mt-1">เช่น 0.85 = ได้ 85% หลังตัดแต่ง</p>
            </div>
            <div>
              <label className="block text-sm font-medium text-brand-muted mb-1">Waste % (0-100) <span className="text-red-500">*</span></label>
              <input type="number" step="0.1" min="0" max="100" value={formData.prep_waste_pct ?? 0} onChange={(e) => setFormData({ ...formData, prep_waste_pct: parseFloat(e.target.value) || 0 })} className={`input ${formErrors.prep_waste_pct ? 'border-red-500' : ''}`} />
              {formErrors.prep_waste_pct && <p className="text-red-500 text-xs mt-1">{formErrors.prep_waste_pct}</p>}
            </div>

            <hr className="col-span-full border-brand-border my-2" />

            <div className="col-span-full">
              <h4 className="font-semibold text-brand-accent mb-3">💰 ข้อมูลต้นทุน (Cost Information)</h4>
            </div>
            <div>
              <label className="block text-sm font-medium text-brand-muted mb-1">WAVG Cost ต่อหน่วยใช้ (฿)</label>
              <input type="number" step="0.01" min="0" value={formData.wavg_cost ?? 0} onChange={(e) => setFormData({ ...formData, wavg_cost: parseFloat(e.target.value) || 0 })} className="input" />
            </div>
            <div>
              <label className="block text-sm font-medium text-brand-muted mb-1">ราคาซื้อครั้งล่าสุด ต่อหน่วยใช้ (฿)</label>
              <input type="number" step="0.01" min="0" value={formData.last_purchase_price ?? 0} onChange={(e) => setFormData({ ...formData, last_purchase_price: parseFloat(e.target.value) || 0 })} className="input" />
            </div>
            <div>
              <label className="block text-sm font-medium text-brand-muted mb-1">ราคาที่อนุมัติ ต่อหน่วยใช้ (฿)</label>
              <input type="number" step="0.01" min="0" value={formData.last_approved_price ?? 0} onChange={(e) => setFormData({ ...formData, last_approved_price: parseFloat(e.target.value) || 0 })} className="input" />
            </div>

            <div className="col-span-full flex gap-3 mt-4">
              <button onClick={handleSubmit} className="btn btn-primary">บันทึก</button>
              <button onClick={resetForm} className="btn btn-outline">ยกเลิก</button>
            </div>
          </div>
        </div>
      )}

      <div className="card mb-4">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-3 p-3 bg-brand-bg rounded-lg mb-3">
          <div>
            <label className="block text-xs text-brand-muted mb-1">ค้นหา</label>
            <input type="text" placeholder="ชื่อ, หมวด, ผู้ขาย..." value={searchText} onChange={(e) => setSearchText(e.target.value)} className="input text-sm" />
          </div>
          <div>
            <label className="block text-xs text-brand-muted mb-1">หมวดหมู่</label>
            <select value={categoryFilter} onChange={(e) => setCategoryFilter(e.target.value)} className="input text-sm">
              <option value="">ทั้งหมด</option>
              {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs text-brand-muted mb-1">สถานะ</label>
            <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="input text-sm">
              <option value="">ทั้งหมด</option>
              <option value="in_stock">มีของ</option>
              <option value="low_stock">ใกล้หมด</option>
              <option value="out_of_stock">หมด/ปิดใช้งาน</option>
            </select>
          </div>
          <div>
            <label className="block text-xs text-brand-muted mb-1">จำนวนรายการ</label>
            <div className="text-sm font-bold text-brand-accent">{filteredIngredients.length} / {ingredients.length}</div>
          </div>
        </div>
      </div>

      {loadError && (
        <div className="mb-4">
          <LoadErrorBanner message={loadError} onRetry={() => { void loadInventory() }} testId="inventory-load-error" />
        </div>
      )}

      <div className="card overflow-x-auto">
        <table className="w-full text-left">
          <thead className="bg-brand-bg">
            <tr>
              <th className="p-3 rounded-l-lg cursor-pointer hover:bg-brand-border" onClick={() => handleSort('name')}>
                ชื่อ {sortBy === 'name' ? (sortDir === 'asc' ? '▲' : '▼') : ''}
              </th>
              <th className="p-3 cursor-pointer hover:bg-brand-border" onClick={() => handleSort('category')}>
                หมวด {sortBy === 'category' ? (sortDir === 'asc' ? '▲' : '▼') : ''}
              </th>
              <th className="p-3">หน่วย</th>
              <th className="p-3 cursor-pointer hover:bg-brand-border" onClick={() => handleSort('current_stock')}>
                สต็อก {sortBy === 'current_stock' ? (sortDir === 'asc' ? '▲' : '▼') : ''}
              </th>
              <th className="p-3">สถานะ</th>
              <th className="p-3 cursor-pointer hover:bg-brand-border" onClick={() => handleSort('unit_price')}>
                ราคา/หน่วยใช้ {sortBy === 'unit_price' ? (sortDir === 'asc' ? '▲' : '▼') : ''}
              </th>
              <th className="p-3 cursor-pointer hover:bg-brand-border" onClick={() => handleSort('pricePerUseUnit')}>
                ราคา/หน่วยใช้ (คำนวณ) {sortBy === 'pricePerUseUnit' ? (sortDir === 'asc' ? '▲' : '▼') : ''}
              </th>
              <th className="p-3">ผู้ขาย</th>
              <th className="p-3">Yield / Waste</th>
              <th className="p-3 rounded-r-lg">จัดการ</th>
            </tr>
          </thead>
          <tbody>
            {filteredIngredients.map((ing) => (
              <tr key={ing.id} className="border-b border-brand-border hover:bg-brand-bg">
                <td className="p-3 font-medium">{ing.name}</td>
                <td className="p-3">{ing.category}</td>
                <td className="p-3">{ing.unit}</td>
                <td className="p-3">
                  <div className="flex items-center gap-2">
                    <input type="number" step="0.01" min="0" value={ing.current_stock} onChange={(e) => handleStockUpdate(ing.id, parseFloat(e.target.value) - ing.current_stock, 'manual')} className="w-20 input text-sm" />
                    <span className="text-sm text-brand-muted">{ing.unit}</span>
                  </div>
                </td>
                <td className="p-3">
                  <span className={`badge ${getStatusBadge(ing.status).class}`}>
                    {getStatusBadge(ing.status).label}
                  </span>
                </td>
                <td className="p-3">฿{ing.unit_price.toFixed(2)}</td>
                <td className="p-3">
                  {computePricePerUseUnit(ing) !== null ? (
                    <span className="font-medium text-brand-primary">฿{computePricePerUseUnit(ing)!.toFixed(2)}</span>
                  ) : (
                    <span className="text-brand-muted">-</span>
                  )}
                </td>
                <td className="p-3">{supplierName(ing.supplier_id) || ing.supplier_name || '-'}</td>
                <td className="p-3 text-sm">
                  Yield: {(ing.prep_yield_factor ?? 1) * 100}% | Waste: {ing.prep_waste_pct ?? 0}%
                </td>
                <td className="p-3">
                  <div className="flex gap-1">
                    <button onClick={() => startEdit(ing)} className="btn btn-outline text-xs">แก้ไข</button>
                    <button onClick={() => handleDeactivate(ing.id)} className="btn btn-outline text-xs text-amber-600">ปิดใช้งาน</button>
                    <button onClick={() => handleDelete(ing.id)} className="btn btn-outline text-xs text-red-500">ลบ</button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {filteredIngredients.length === 0 && !loadError && !isLoading && (
        <div className="text-center py-12">
          <div className="text-6xl mb-4">📦</div>
          <h3 className="text-xl font-bold text-brand-accent mb-2">ยังไม่มีวัตถุดิบ</h3>
          <p className="text-brand-muted mb-4">กด "+ เพิ่มวัตถุดิบ" เพื่อเริ่มจัดการสต็อก</p>
        </div>
      )}
    </div>
  )
}