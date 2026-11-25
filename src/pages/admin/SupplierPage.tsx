// ============================================
// Bite Me Baby — Admin Supplier Master (Phase 1)
// Supplier CRUD with contact info, status, ingredients supplied
// ============================================

import { useState, useEffect, useCallback, useMemo } from 'react'
import {
  getSuppliers,
  getAllSuppliers,
  createSupplier,
  updateSupplier,
  deleteSupplier,
  getSupplierById,
  type Supplier,
  type SupplierForm,
} from '@/lib/bmbAdminApi_suppliers'
import { getIngredientsForSupplier } from '@/lib/bmbAdminApi_supplierProducts'
import { showToast } from '@/components/ui/ToastContainer'
import { LoadErrorBanner } from '@/components/ui/LoadErrorBanner'

interface SupplierFormData {
  name: string
  code: string
  contact_name: string
  phone: string
  email: string
  address: string
  payment_terms_days: number
  lead_time_days: number
  is_active: boolean
}

export function SupplierPage() {
  const [suppliers, setSuppliers] = useState<Supplier[]>([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState('')
  const [showForm, setShowForm] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [viewDetailId, setViewDetailId] = useState<string | null>(null)
  const [formData, setFormData] = useState<SupplierFormData>(() => ({
    name: '',
    code: '',
    contact_name: '',
    phone: '',
    email: '',
    address: '',
    payment_terms_days: 30,
    lead_time_days: 7,
    is_active: true,
  }))
  const [formErrors, setFormErrors] = useState<Record<string, string>>({})
  const [detailIngredients, setDetailIngredients] = useState<any[]>([])
  const [detailLoading, setDetailLoading] = useState(false)
  const [searchText, setSearchText] = useState('')
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'inactive'>('all')

  const loadSuppliers = useCallback(async () => {
    setLoading(true)
    setLoadError('')
    try {
      const data = await getAllSuppliers(true)
      setSuppliers(data || [])
    } catch (e) {
      console.error('[SupplierPage] Failed to load suppliers:', e)
      setLoadError('โหลดรายชื่อผู้ขายไม่สำเร็จ — ตรวจสอบการเชื่อมต่อแล้วกด "ลองใหม่"')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { void loadSuppliers() }, [loadSuppliers])

  const filteredSuppliers = useMemo(() => {
    let result = [...suppliers]
    if (searchText) {
      const q = searchText.toLowerCase()
      result = result.filter(s =>
        s.name.toLowerCase().includes(q) ||
        s.code.toLowerCase().includes(q) ||
        s.contact_name?.toLowerCase().includes(q) ||
        s.phone?.includes(q) ||
        s.email?.toLowerCase().includes(q)
      )
    }
    if (statusFilter === 'active') result = result.filter(s => s.is_active)
    if (statusFilter === 'inactive') result = result.filter(s => !s.is_active)
    return result
  }, [suppliers, searchText, statusFilter])

  function validateForm(data: Partial<SupplierForm>): Record<string, string> {
    const errors: Record<string, string> = {}
    if (!data.name?.trim()) errors.name = 'กรุณาใส่ชื่อผู้ขาย'
    if (!data.code?.trim()) errors.code = 'กรุณาใส่รหัสผู้ขาย'
    if (data.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.email)) errors.email = 'รูปแบบอีเมลไม่ถูกต้อง'
    if (data.payment_terms_days !== undefined && data.payment_terms_days < 0) errors.payment_terms_days = 'เงื่อนไขชำระเงินต้องไม่ติดลบ'
    if (data.lead_time_days !== undefined && data.lead_time_days < 0) errors.lead_time_days = 'Lead time ต้องไม่ติดลบ'
    return errors
  }

  function resetForm() {
    setFormData({
      name: '',
      code: '',
      contact_name: '',
      phone: '',
      email: '',
      address: '',
      payment_terms_days: 30,
      lead_time_days: 7,
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

  function startEdit(supplier: Supplier) {
    setEditingId(supplier.id)
    setFormData({
      name: supplier.name,
      code: supplier.code,
      contact_name: supplier.contact_name || '',
      phone: supplier.phone || '',
      email: supplier.email || '',
      address: supplier.address || '',
      payment_terms_days: supplier.payment_terms_days,
      lead_time_days: supplier.lead_time_days,
      is_active: supplier.is_active,
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
      let result: Supplier | null = null
      const payload: SupplierForm = {
        name: formData.name!,
        code: formData.code!,
        contact_name: formData.contact_name || undefined,
        phone: formData.phone || undefined,
        email: formData.email || undefined,
        address: formData.address || undefined,
        payment_terms_days: formData.payment_terms_days ?? 30,
        lead_time_days: formData.lead_time_days ?? 7,
        is_active: formData.is_active ?? true,
      }

      if (editingId) {
        result = await updateSupplier(editingId, payload)
      } else {
        result = await createSupplier(payload)
      }

      if (result) {
        if (editingId) {
          setSuppliers(prev => prev.map(s => s.id === editingId ? result! : s))
          showToast('อัปเดตผู้ขายสำเร็จ!', 'success')
        } else {
          setSuppliers(prev => [...prev, result!])
          showToast('เพิ่มผู้ขายสำเร็จ!', 'success')
        }
        resetForm()
      } else {
        showToast(editingId ? 'ไม่สามารถอัปเดตได้' : 'เกิดข้อผิดพลาดในการเพิ่มผู้ขาย', 'error')
      }
    } catch (e) {
      console.error('[SupplierPage] Submit failed:', e)
      showToast('เกิดข้อผิดพลาด', 'error')
    }
  }

  async function handleDeactivate(id: string) {
    if (!confirm('ต้องการปิดใช้งานผู้ขายนี้?')) return
    try {
      const ok = await deleteSupplier(id)
      if (ok) {
        setSuppliers(prev => prev.map(s => s.id === id ? { ...s, is_active: false } : s))
        showToast('ปิดใช้งานสำเร็จ!', 'success')
      } else {
        showToast('ไม่สามารถปิดใช้งานได้', 'error')
      }
    } catch (e) {
      console.error('[SupplierPage] Deactivate failed:', e)
      showToast('เกิดข้อผิดพลาด', 'error')
    }
  }

  async function handleViewDetail(id: string) {
    setViewDetailId(id)
    setDetailLoading(true)
    try {
      const [supplier, ingredients] = await Promise.all([
        getSupplierById(id),
        getIngredientsForSupplier(id),
      ])
      if (supplier) {
        setDetailIngredients(ingredients || [])
      }
    } catch (e) {
      console.error('[SupplierPage] View detail failed:', e)
      showToast('โหลดรายละเอียดไม่สำเร็จ', 'error')
    } finally {
      setDetailLoading(false)
    }
  }

  function closeDetail() {
    setViewDetailId(null)
    setDetailIngredients([])
  }

  const statusColors = {
    'true': { bg: 'bg-green-100', text: 'text-green-800', label: 'ใช้งานอยู่' },
    'false': { bg: 'bg-gray-100', text: 'text-gray-600', label: 'ปิดใช้งาน' },
  }

  return (
    <div className="max-w-7xl mx-auto px-4 py-6">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-3xl font-bold text-brand-accent">🏢 จัดการผู้ขาย (Supplier Master)</h1>
        <div className="flex gap-2">
          <button onClick={loadSuppliers} className="btn btn-outline text-sm" disabled={loading}>รีเฟรช</button>
          <button onClick={startAdd} className="btn btn-primary">+ เพิ่มผู้ขาย</button>
        </div>
      </div>

      {loading && (
        <div className="card text-center py-8">
          <p className="text-brand-muted">กำลังโหลดข้อมูล...</p>
        </div>
      )}

      {loadError && (
        <div className="mb-4">
          <LoadErrorBanner message={loadError} onRetry={loadSuppliers} testId="supplier-load-error" />
        </div>
      )}

      <div className="card mb-4">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-3 p-3 bg-brand-bg rounded-lg">
          <div>
            <label className="block text-xs text-brand-muted mb-1">ค้นหา</label>
            <input type="text" placeholder="ชื่อ, รหัส, ติดต่อ, โทร, อีเมล..." value={searchText} onChange={(e) => setSearchText(e.target.value)} className="input text-sm" />
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
            <label className="block text-xs text-brand-muted mb-1">จำนวนรายการ</label>
            <div className="text-sm font-bold text-brand-accent">{filteredSuppliers.length} / {suppliers.length}</div>
          </div>
        </div>
      </div>

      {/* Add/Edit Form */}
      {showForm && (
        <div className="card mb-6 bg-brand-bg">
          <h3 className="font-bold text-brand-accent mb-4">{editingId ? '✏️ แก้ไขผู้ขาย' : '➕ เพิ่มผู้ขายใหม่'}</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-brand-muted mb-1">ชื่อผู้ขาย <span className="text-red-500">*</span></label>
              <input type="text" placeholder="เช่น บจก. ไก่สด จำกัด" value={formData.name || ''} onChange={(e) => setFormData({ ...formData, name: e.target.value })} className={`input ${formErrors.name ? 'border-red-500' : ''}`} />
              {formErrors.name && <p className="text-red-500 text-xs mt-1">{formErrors.name}</p>}
            </div>
            <div>
              <label className="block text-sm font-medium text-brand-muted mb-1">รหัสผู้ขาย <span className="text-red-500">*</span></label>
              <input type="text" placeholder="เช่น SUP-001" value={formData.code || ''} onChange={(e) => setFormData({ ...formData, code: e.target.value })} className={`input ${formErrors.code ? 'border-red-500' : ''}`} />
              {formErrors.code && <p className="text-red-500 text-xs mt-1">{formErrors.code}</p>}
            </div>
            <div>
              <label className="block text-sm font-medium text-brand-muted mb-1">ชื่อผู้ติดต่อ</label>
              <input type="text" placeholder="ชื่อผู้ติดต่อหลัก" value={formData.contact_name || ''} onChange={(e) => setFormData({ ...formData, contact_name: e.target.value })} className="input" />
            </div>

            <div>
              <label className="block text-sm font-medium text-brand-muted mb-1">เบอร์โทร</label>
              <input type="text" placeholder="02-123-4567" value={formData.phone || ''} onChange={(e) => setFormData({ ...formData, phone: e.target.value })} className="input" />
            </div>
            <div>
              <label className="block text-sm font-medium text-brand-muted mb-1">อีเมล</label>
              <input type="email" placeholder="supplier@example.com" value={formData.email || ''} onChange={(e) => setFormData({ ...formData, email: e.target.value })} className={`input ${formErrors.email ? 'border-red-500' : ''}`} />
              {formErrors.email && <p className="text-red-500 text-xs mt-1">{formErrors.email}</p>}
            </div>

            <div className="md:col-span-2 lg:col-span-3">
              <label className="block text-sm font-medium text-brand-muted mb-1">ที่อยู่</label>
              <input type="text" placeholder="ที่อยู่จัดส่ง/สำนักงาน" value={formData.address || ''} onChange={(e) => setFormData({ ...formData, address: e.target.value })} className="input" />
            </div>

            <div>
              <label className="block text-sm font-medium text-brand-muted mb-1">เงื่อนไขชำระเงิน (วัน) <span className="text-red-500">*</span></label>
              <input type="number" min="0" value={formData.payment_terms_days ?? 30} onChange={(e) => setFormData({ ...formData, payment_terms_days: parseInt(e.target.value) || 0 })} className={`input ${formErrors.payment_terms_days ? 'border-red-500' : ''}`} />
              {formErrors.payment_terms_days && <p className="text-red-500 text-xs mt-1">{formErrors.payment_terms_days}</p>}
            </div>
            <div>
              <label className="block text-sm font-medium text-brand-muted mb-1">Lead Time (วัน) <span className="text-red-500">*</span></label>
              <input type="number" min="0" value={formData.lead_time_days ?? 7} onChange={(e) => setFormData({ ...formData, lead_time_days: parseInt(e.target.value) || 0 })} className={`input ${formErrors.lead_time_days ? 'border-red-500' : ''}`} />
              {formErrors.lead_time_days && <p className="text-red-500 text-xs mt-1">{formErrors.lead_time_days}</p>}
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

      {/* Detail Modal */}
      {viewDetailId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50" onClick={closeDetail}>
          <div className="bg-white rounded-2xl shadow-xl max-w-3xl w-full max-h-[80vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between p-4 border-b">
              <h3 className="font-bold text-brand-accent text-lg">📋 รายละเอียดผู้ขาย</h3>
              <button onClick={closeDetail} className="p-2 rounded-lg hover:bg-brand-bg">✕</button>
            </div>
            <div className="p-4">
              {detailLoading ? (
                <div className="text-center py-8 text-brand-muted">กำลังโหลด...</div>
              ) : (
                <>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                    <div><span className="text-brand-muted text-sm">ชื่อผู้ขาย</span><div className="font-medium">{suppliers.find(s => s.id === viewDetailId)?.name}</div></div>
                    <div><span className="text-brand-muted text-sm">รหัส</span><div className="font-medium">{suppliers.find(s => s.id === viewDetailId)?.code}</div></div>
                    <div><span className="text-brand-muted text-sm">ผู้ติดต่อ</span><div>{suppliers.find(s => s.id === viewDetailId)?.contact_name || '-'}</div></div>
                    <div><span className="text-brand-muted text-sm">โทร</span><div>{suppliers.find(s => s.id === viewDetailId)?.phone || '-'}</div></div>
                    <div><span className="text-brand-muted text-sm">อีเมล</span><div>{suppliers.find(s => s.id === viewDetailId)?.email || '-'}</div></div>
                    <div><span className="text-brand-muted text-sm">ที่อยู่</span><div>{suppliers.find(s => s.id === viewDetailId)?.address || '-'}</div></div>
                    <div><span className="text-brand-muted text-sm">เงื่อนไขชำระ</span><div>{suppliers.find(s => s.id === viewDetailId)?.payment_terms_days} วัน</div></div>
                    <div><span className="text-brand-muted text-sm">Lead Time</span><div>{suppliers.find(s => s.id === viewDetailId)?.lead_time_days} วัน</div></div>
                    <div><span className="text-brand-muted text-sm">สถานะ</span><div>
                      <span className={`badge ${suppliers.find(s => s.id === viewDetailId)?.is_active ? 'badge-success' : 'badge-danger'}`}>
                        {suppliers.find(s => s.id === viewDetailId)?.is_active ? 'ใช้งานอยู่' : 'ปิดใช้งาน'}
                      </span>
                    </div></div>
                  </div>
                  <hr className="my-4" />
                  <h4 className="font-semibold text-brand-accent mb-3">📦 วัตถุดิบที่ผู้ขายจัดหา ({detailIngredients.length} รายการ)</h4>
                  {detailIngredients.length === 0 ? (
                    <p className="text-brand-muted text-center py-4">ยังไม่มีการจับคู่วัตถุดิบกับผู้ขายนี้</p>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="w-full text-left text-sm">
                        <thead className="bg-brand-bg">
                          <tr>
                            <th className="p-3">วัตถุดิบ</th>
                            <th className="p-3">SKU ผู้ขาย</th>
                            <th className="p-3">ชื่อสินค้าผู้ขาย</th>
                            <th className="p-3">หน่วยซื้อ</th>
                            <th className="p-3">หน่วยใช้</th>
                            <th className="p-3">แปลงหน่วย</th>
                            <th className="p-3">ราคา Committed</th>
                            <th className="p-3">ราคา Realized</th>
                            <th className="p-3">ราคา Approved</th>
                            <th className="p-3">Preferred</th>
                          </tr>
                        </thead>
                        <tbody>
                          {detailIngredients.map((m: any) => (
                            <tr key={m.id} className="border-b border-brand-border">
                              <td className="p-3 font-medium">{m.ingredient?.name || m.ingredient_id}</td>
                              <td className="p-3">{m.supplier_sku || '-'}</td>
                              <td className="p-3">{m.supplier_name || '-'}</td>
                              <td className="p-3">{m.purchase_unit || '-'}</td>
                              <td className="p-3">{m.use_unit || '-'}</td>
                              <td className="p-3">{m.conversion_factor || 1}</td>
                              <td className="p-3">{m.last_committed_price ? `฿${m.last_committed_price}` : '-'}</td>
                              <td className="p-3">{m.last_realized_price ? `฿${m.last_realized_price}` : '-'}</td>
                              <td className="p-3">{m.last_approved_price ? `฿${m.last_approved_price}` : '-'}</td>
                              <td className="p-3">{m.is_preferred ? '⭐' : '-'}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Suppliers Table */}
      <div className="card overflow-x-auto">
        <table className="w-full text-left">
          <thead className="bg-brand-bg">
            <tr>
              <th className="p-3 rounded-l-lg">ชื่อผู้ขาย</th>
              <th className="p-3">รหัส</th>
              <th className="p-3">ผู้ติดต่อ</th>
              <th className="p-3">โทร / อีเมล</th>
              <th className="p-3">เงื่อนไขชำระ</th>
              <th className="p-3">Lead Time</th>
              <th className="p-3">สถานะ</th>
              <th className="p-3 rounded-r-lg">จัดการ</th>
            </tr>
          </thead>
          <tbody>
            {filteredSuppliers.map((s) => {
              const sc = statusColors[String(s.is_active) as keyof typeof statusColors]
              return (
                <tr key={s.id} className="border-b border-brand-border hover:bg-brand-bg">
                  <td className="p-3 font-medium">{s.name}</td>
                  <td className="p-3 font-mono text-sm">{s.code}</td>
                  <td className="p-3">{s.contact_name || '-'}</td>
                  <td className="p-3">
                    <div>{s.phone || '-'}</div>
                    <div className="text-xs text-brand-muted">{s.email || '-'}</div>
                  </td>
                  <td className="p-3">{s.payment_terms_days} วัน</td>
                  <td className="p-3">{s.lead_time_days} วัน</td>
                  <td className="p-3">
                    <span className={`badge ${sc.bg} ${sc.text}`}>{sc.label}</span>
                  </td>
                  <td className="p-3">
                    <div className="flex gap-1">
                      <button onClick={() => handleViewDetail(s.id)} className="btn btn-outline text-xs">ดูรายละเอียด</button>
                      <button onClick={() => startEdit(s)} className="btn btn-outline text-xs">แก้ไข</button>
                      {s.is_active ? (
                        <button onClick={() => handleDeactivate(s.id)} className="btn btn-outline text-xs text-amber-600">ปิดใช้งาน</button>
                      ) : (
                        <button onClick={() => startEdit({ ...s, is_active: true })} className="btn btn-outline text-xs text-green-600">เปิดใช้งาน</button>
                      )}
                    </div>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {filteredSuppliers.length === 0 && !loadError && !loading && (
        <div className="text-center py-12">
          <div className="text-6xl mb-4">🏢</div>
          <h3 className="text-xl font-bold text-brand-accent mb-2">ยังไม่มีผู้ขาย</h3>
          <p className="text-brand-muted mb-4">กด "+ เพิ่มผู้ขาย" เพื่อเริ่มจัดการข้อมูลผู้ขาย</p>
        </div>
      )}
    </div>
  )
}