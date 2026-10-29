import { useState, useEffect, useRef } from 'react'
import { Link } from 'react-router-dom'
import { showToast } from '@/components/ui/ToastContainer'
import { getProducts, createProduct, updateProduct, archiveProduct, restoreProduct, getCategories, getCategoriesAdmin, createCategory, updateCategory, archiveCategory, restoreCategory, deleteCategory, deleteProduct } from '@/lib/bmbAdminApi_products'
import { ToggleSwitch } from '@/components/admin/ToggleSwitch'
import { HomePopularManager } from '@/components/admin/HomePopularManager'
import { uploadProductImage, validateImageFile } from '@/lib/bmbAdminApi_media'
import { slugifyCategory, blankCategoryForm } from '@/lib/adminUi'
import { customerVisibilityIssue, CUSTOMER_VISIBILITY_LABEL } from '@/lib/catalogStructure'
import { AddonsEditor, toAddonDrafts, addonDraftsToJson, type AddonDraft } from '@/components/admin/AddonsEditor'
import type { Product, ProductCategory } from '@/types'
// R21 Phase 2 (Owner 2026-10-29): Gross Margin / Net Profit real-time จากต้นทุนที่แอดมินกรอก
import { computeMargin, formatBaht, formatPct, marginTierLabel } from '@/lib/marginCalc'


export function AdminProducts() {
  const [products, setProducts] = useState<Product[]>([])
  const [categories, setCategories] = useState<ProductCategory[]>([])
  const [showAddForm, setShowAddForm] = useState(false)
  const [editingProduct, setEditingProduct] = useState<Product | null>(null)
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    price: 0,
    // migration 170: ต้นทุนต่อหน่วย (แอดมินกรอก → margin คำนวณ real-time)
    cogs: 0,
    packaging_cost: 0,
    other_unit_cost: 0,
    category_id: '',
    image_url: '',
    is_available: true,
    is_featured: false,
    is_preorder: false,
    prep_minutes: 10
  })
  const [addons, setAddons] = useState<AddonDraft[]>([])

  // ── ระบบ "หัวข้อเมนู" เดียว (2026-10-17): หัวข้อ = หมวดหมู่ (category) —
  //    เพิ่ม/แก้/เรียง/ซ่อน/ลบ + ย้ายเมนูระหว่างหัวข้อ · ไม่มีชั้น Section ซ้ำซ้อน ──
  const [adminCats, setAdminCats] = useState<ProductCategory[]>([])
  const [catForm, setCatForm] = useState(blankCategoryForm())
  const [showCatForm, setShowCatForm] = useState(false)
  const [editingCat, setEditingCat] = useState<ProductCategory | null>(null)
  // P0 WS2: category lifecycle — move all products from one category to another
  // (merge/move support using the existing canonical updateProduct API only).
  const [moveFrom, setMoveFrom] = useState<string | null>(null)
  const [moveTarget, setMoveTarget] = useState('')
  // ── Feature C (Owner 2026-10-25): แท็บหมวดหมู่สินค้า + rule 12.3 auto-scroll ──
  const [catTab, setCatTab] = useState<string>('all')
  const formRef = useRef<HTMLDivElement>(null)
  const catFormRef = useRef<HTMLDivElement>(null)
  const movePanelRef = useRef<HTMLDivElement>(null)
  // จิ้มปุ่ม "แก้ไข/เพิ่ม" → ฟอร์มเปิด = เด้งขึ้นไปรับงานทันที (ไม่ปล่อยให้เลื่อนเอง)
  useEffect(() => {
    if (showAddForm) formRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }, [showAddForm])
  useEffect(() => {
    if (showCatForm) catFormRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }, [showCatForm])
  useEffect(() => {
    if (moveFrom) movePanelRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }, [moveFrom])

  useEffect(() => { loadAll() }, [])

  async function loadAll() {
    try {
      const [products, cats, allCats] = await Promise.all([getProducts(), getCategories(), getCategoriesAdmin()])
      setProducts(products)
      setCategories(cats)
      setAdminCats(allCats)
    } catch (err) {
      console.error('[AdminProducts] Load error:', err)
    }
  }


  // ✅ CAT-03: canonical image flow — Storage bmb-images → media_assets →
  // products.image_url = public URL. No new Base64 (migration contract §6/§7).
  async function handleImageUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    const v = validateImageFile(file)
    if (!v.ok) {
      showToast('รูปไม่ผ่านเงื่อนไข: ' + v.error, 'error')
      e.target.value = ''
      return
    }
    const res = await uploadProductImage(file)
    if (!res.ok || !res.url) {
      showToast('อัปโหลดไม่สำเร็จ: ' + (res.error || ''), 'error')
      e.target.value = ''
      return
    }
    setFormData({ ...formData, image_url: res.url })
    e.target.value = ''
  }

  async function handleAddProduct() {
    if (!formData.name || !formData.price || !formData.category_id) {
      showToast('กรุณากรอกข้อมูลให้ครบ', 'warning')
      return
    }
    
    // Sanitize add-on draft rows into the products.addons JSON shape.
    // P0 2026-10-14: ต้องเช็คผลลัพธ์ก่อน — createProduct คืน null เมื่อบันทึกล้ม
    // (RLS is_tenant_admin / validation / เครือข่าย) — ห้ามปิดฟอร์ม + toast สำเร็จ
    // ทั้งที่ไม่มีอะไรเข้าฐานข้อมูล (สาเหตุหลักที่แอดมินเข้าใจว่าบันทึกแล้วแต่เมนูไม่เปลี่ยน)
    const created = await createProduct({ ...formData, addons: addonDraftsToJson(addons) })
    if (!created) {
      showToast('บันทึกเมนูไม่สำเร็จ — ยังไม่มีข้อมูลเข้าฐานข้อมูล (ตรวจสิทธิ์แอดมิน/การเชื่อมต่อ แล้วลองใหม่)', 'error')
      return
    }
    loadAll()
    resetForm()
    setShowAddForm(false)
    showToast('เพิ่มเมนูสำเร็จ!', 'success')
  }

  function handleEditProduct(product: Product) {
    setEditingProduct(product)
    setFormData({
      name: product.name,
      description: product.description,
      price: product.price,
      cogs: product.cogs ?? 0,
      packaging_cost: product.packaging_cost ?? 0,
      other_unit_cost: product.other_unit_cost ?? 0,
      category_id: product.category_id,
      image_url: product.image_url,
      is_available: product.is_available,
      is_featured: product.is_featured,
      is_preorder: product.is_preorder ?? false,
      prep_minutes: product.prep_minutes
    })
    setAddons(toAddonDrafts(product.addons))
    setShowAddForm(true)
  }

  async function handleUpdateProduct() {
    if (!editingProduct) return
    
    // P0 2026-10-14: เช็คผลลัพธ์เหมือน handleAddProduct — updateProduct คืน null
    // เมื่อ write ล้ม → ห้าม toast สำเร็จ/ปิดฟอร์มทั้งที่ไม่บันทึก
    const updated = await updateProduct(editingProduct.id, { ...formData, addons: addonDraftsToJson(addons) })
    if (!updated) {
      showToast('อัปเดตเมนูไม่สำเร็จ — ยังไม่มีการเปลี่ยนแปลงในฐานข้อมูล (ตรวจสิทธิ์แอดมิน/การเชื่อมต่อ แล้วลองใหม่)', 'error')
      return
    }
    loadAll()
    resetForm()
    setShowAddForm(false)
    showToast('อัปเดตเมนูสำเร็จ!', 'success')
  }

  // ── Archive / Restore (CAT-01, migration 055 — CAT-D04=B: hard delete is NOT the normal mechanism) ──
  // P0 WS2: move/merge — reassign every product of `moveFrom` to `moveTarget`
  // through the canonical updateProduct API (no parallel catalog writes).
  // The source category is NOT deleted here: the admin archives it explicitly
  // afterwards ("hard delete is NOT the normal mechanism" — CAT-D04=B).
  async function handleMoveProducts() {
    if (!moveFrom || !moveTarget || moveFrom === moveTarget) return
    const moving = products.filter((p) => p.category_id === moveFrom)
    if (moving.length === 0) {
      showToast('หมวดนี้ไม่มีสินค้าให้ย้าย — กดจัดเก็บหมวดได้เลย', 'info')
      setMoveFrom(null)
      return
    }
    if (!confirm(`ย้ายสินค้า ${moving.length} รายการไปยังหมวดเป้าหมาย? (ไม่ลบข้อมูลใด ๆ)`)) return
    let ok = 0
    const failed: string[] = []
    for (const p of moving) {
      const res = await updateProduct(p.id, { category_id: moveTarget })
      if (res) ok += 1
      else failed.push(p.name)
    }
    if (failed.length > 0) {
      showToast(`ย้ายได้ ${ok}/${moving.length} รายการ — ที่ไม่สำเร็จ: ${failed.join(', ')}`, 'error')
    } else {
      showToast(`ย้ายสินค้า ${ok} รายการเรียบร้อย — หน้าลูกค้าจะเห็นหมวดใหม่ในการโหลดข้อมูลรอบถัดไป`, 'success')
    }
    setMoveFrom(null)
    setMoveTarget('')
    loadAll()
  }

  async function handleArchiveProduct(id: string) {
    if (confirm('จัดเก็บเมนูนี้ (ซ่อนจากลูกค้า + หยุดรับออเดอร์ — กู้คืนได้) ?')) {
      const ok = await archiveProduct(id)
      showToast(ok ? 'จัดเก็บเมนูแล้ว (กู้คืนได้)' : 'จัดเก็บไม่สำเร็จ', ok ? 'success' : 'error')
      loadAll()
    }
  }

  async function handleRestoreProduct(id: string) {
    const ok = await restoreProduct(id)
    showToast(ok ? 'กู้คืนเมนูแล้ว — เปิดขายได้จากปุ่มเปิด/ปิดขาย' : 'กู้คืนไม่สำเร็จ', ok ? 'success' : 'error')
    loadAll()
  }

  // ── Category manager actions (PHASE 6 UI/admin) ──
  function openCategoryForm(cat?: ProductCategory) {
    if (cat) {
      setEditingCat(cat)
      setCatForm({ name: cat.name, icon: cat.icon, sort_order: cat.sort_order, is_active: cat.is_active })
    } else {
      setEditingCat(null)
      setCatForm(blankCategoryForm())
    }
    setShowCatForm(true)
  }

  async function handleSaveCategory() {
    const name = catForm.name.trim()
    if (!name) { showToast('กรุณาใส่ชื่อหัวข้อเมนู', 'warning'); return }
    const maxSort = adminCats.reduce((m, c) => Math.max(m, c.sort_order || 0), 0)
    const sortOrder = editingCat ? (catForm.sort_order || maxSort) : (catForm.sort_order > 0 ? catForm.sort_order : maxSort + 1)
    if (editingCat) {
      const ok = await updateCategory(editingCat.id, { name, icon: catForm.icon, sort_order: sortOrder, is_active: catForm.is_active })
      if (!ok) { showToast('บันทึกหัวข้อเมนูไม่สำเร็จ', 'error'); return }
      showToast('อัปเดตหัวข้อเมนูแล้ว!', 'success')
    } else {
      const ok = await createCategory({ name, slug: slugifyCategory(name), icon: catForm.icon, sort_order: sortOrder, is_active: catForm.is_active })
      if (!ok) { showToast('เพิ่มหัวข้อเมนูไม่สำเร็จ', 'error'); return }
      showToast('เพิ่มหัวข้อเมนูสำเร็จ!', 'success')
    }
    setShowCatForm(false)
    setEditingCat(null)
    setCatForm(blankCategoryForm())
    loadAll()
  }

  async function handleArchiveCategory(cat: ProductCategory) {
    if (confirm(`จัดเก็บหัวข้อ "${cat.name}" (ซ่อนจากลูกค้า — กู้คืนได้)?`)) {
      const ok = await archiveCategory(cat.id)
      showToast(ok ? 'จัดเก็บหัวข้อแล้ว (กู้คืนได้)' : 'จัดเก็บไม่สำเร็จ', ok ? 'success' : 'error')
      loadAll()
    }
  }

  async function handleRestoreCategory(cat: ProductCategory) {
    const ok = await restoreCategory(cat.id)
    showToast(ok ? 'กู้คืนหัวข้อเมนูแล้ว' : 'กู้คืนไม่สำเร็จ', ok ? 'success' : 'error')
    loadAll()
  }

  // ── ลบถาวร (Owner 17 ต.ค.: "ลบได้เลย ยังไม่มีออเดอร์จริง") — คนละปุ่มกับจัดเก็บ ──
  async function handleDeleteCategory(cat: ProductCategory) {
    const count = products.filter((p) => p.category_id === cat.id).length
    if (count > 0) {
      showToast(`หัวข้อ "${cat.name}" ยังมีเมนู ${count} รายการ — ย้ายเมนูออกก่อน (ปุ่ม "ย้ายสินค้า")`, 'warning')
      setMoveFrom(cat.id)
      setMoveTarget('')
      return
    }
    if (!confirm(`ลบถาวรหัวข้อ "${cat.name}"? (ไม่มีเมนูค้างอยู่ — ลบแล้วเอาคืนไม่ได้)`)) return
    const ok = await deleteCategory(cat.id)
    showToast(ok ? 'ลบหัวข้อเมนูถาวรแล้ว' : 'ลบไม่สำเร็จ (อาจมีข้อมูลผูกอยู่ — ใช้ "จัดเก็บ" แทน)', ok ? 'success' : 'error')
    loadAll()
  }

  async function handleDeleteProduct(id: string) {
    const p = products.find((x) => x.id === id)
    if (!confirm(`ลบถาวรเมนู "${p?.name ?? ''}"? (ลบแล้วเอาคืนไม่ได้ — ถ้ามีประวัติผูกอยู่ ใช้ "จัดเก็บ" แทน)`)) return
    const ok = await deleteProduct(id)
    showToast(ok ? 'ลบเมนูถาวรแล้ว' : 'ลบไม่ได้ (มีประวัติผูกอยู่) — ใช้ "จัดเก็บ" แทน', ok ? 'success' : 'error')
    loadAll()
  }

  function resetForm() {
    setFormData({
      name: '',
      description: '',
      price: 0,
      cogs: 0,
      packaging_cost: 0,
      other_unit_cost: 0,
      category_id: '',
      image_url: '',
      is_available: true,
      is_featured: false,
      is_preorder: false,
      prep_minutes: 10
    })
    setEditingProduct(null)
    setAddons([])
  }

  // R21 Phase 2 — คำนวณกำไรสดทุกครั้งที่พิมพ์ราคา/ต้นทุน (pure helper — ไม่ยิง network)
  const liveMargin = computeMargin(formData.price, {
    cogs: formData.cogs,
    packagingCost: formData.packaging_cost,
    otherCost: formData.other_unit_cost,
  })

  return (
    <div className="max-w-7xl mx-auto px-4 py-6">
<div className="inline-block mb-3">
        <Link to="/admin" className="text-sm text-brand-muted hover:underline">← กลับแดชบอร์ด</Link>
      </div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-3xl font-bold text-brand-accent">🍽️ จัดการเมนู</h1>
        <button onClick={() => { resetForm(); setShowAddForm(true) }} className="btn btn-primary">+ เพิ่มเมนู</button>
      </div>

      {showAddForm && (
        <div ref={formRef} data-testid="product-form-frame" className="card mb-6 bg-brand-bg scroll-mt-20">
          <h3 className="font-bold text-brand-accent mb-4">
            {editingProduct ? '✏️ แก้ไขเมนู' : '➕ เพิ่มเมนูใหม่'}
          </h3>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-brand-accent mb-2">ชื่อเมนู</label>
              <input type="text" value={formData.name} onChange={(e) => setFormData({ ...formData, name: e.target.value })} className="input" placeholder="เช่น ผัดไทยกุ้งสด" />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-brand-accent mb-2">ราคา (บาท)</label>
              <input type="number" value={formData.price || ''} onChange={(e) => setFormData({ ...formData, price: parseFloat(e.target.value) })} className="input" placeholder="65" />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-brand-accent mb-2">หมวดรอง (หมวดหมู่)</label>
              <select value={formData.category_id} onChange={(e) => setFormData({ ...formData, category_id: e.target.value })} className="input">
                <option value="">เลือกหมวดรอง (หมวดหมู่)</option>
                {categories.map(cat => (
                  <option key={cat.id} value={cat.id}>{cat.icon} {cat.name}</option>
                ))}
              </select>
            </div>
            
            <div>
              <label className="block text-sm font-medium text-brand-accent mb-2">เวลาเตรียม (นาที)</label>
              <input type="number" value={formData.prep_minutes || ''} onChange={(e) => setFormData({ ...formData, prep_minutes: parseInt(e.target.value) })} className="input" placeholder="15" />
            </div>

            {/* R21 Phase 2 (Owner 2026-10-29): ต้นทุนต่อหน่วย (migration 170) — แอดมินกรอกเอง */}
            <div>
              <label className="block text-sm font-medium text-brand-accent mb-2">ต้นทุนวัตถุดิบ (บาท/หน่วย)</label>
              <input type="number" min="0" step="0.01" value={formData.cogs || ''} onChange={(e) => setFormData({ ...formData, cogs: Math.max(0, parseFloat(e.target.value) || 0) })} className="input" placeholder="35" data-testid="product-cogs" />
            </div>
            <div>
              <label className="block text-sm font-medium text-brand-accent mb-2">ค่าแพ็กเกจจิ้ง (บาท/หน่วย)</label>
              <input type="number" min="0" step="0.01" value={formData.packaging_cost || ''} onChange={(e) => setFormData({ ...formData, packaging_cost: Math.max(0, parseFloat(e.target.value) || 0) })} className="input" placeholder="4.5" data-testid="product-packaging-cost" />
            </div>
            <div>
              <label className="block text-sm font-medium text-brand-accent mb-2">ต้นทุนอื่น (บาท/หน่วย) — ค่าแรง/ค่าไฟ</label>
              <input type="number" min="0" step="0.01" value={formData.other_unit_cost || ''} onChange={(e) => setFormData({ ...formData, other_unit_cost: Math.max(0, parseFloat(e.target.value) || 0) })} className="input" placeholder="2" data-testid="product-other-cost" />
            </div>

            {/* Gross Margin สด — เห็นทันทีขณะพิมพ์ (DISPLAY ONLY ไม่แตะราคาขาย) */}
            <div className="md:col-span-2 flex flex-wrap items-center gap-x-5 gap-y-2 rounded-xl border border-brand-border bg-brand-surface p-3" data-testid="product-margin-panel">
              <span className="text-sm font-semibold text-brand-accent">📊 กำไร (คำนวณสด)</span>
              <span className="text-sm">ต้นทุน/หน่วย <b>{formatBaht(liveMargin.unitCost)}</b></span>
              <span className="text-sm">
                กำไรขั้นต้น/หน่วย{' '}
                <b className={liveMargin.grossProfit >= 0 ? 'text-green-600' : 'text-red-600'}>{formatBaht(liveMargin.grossProfit)}</b>
              </span>
              <span className="text-sm">Gross Margin <b>{formatPct(liveMargin.grossMarginPct)}</b></span>
              <span className={`text-xs px-2 py-0.5 rounded-full ${liveMargin.tier === 'loss' ? 'bg-red-100 text-red-700' : liveMargin.tier === 'thin' ? 'bg-amber-100 text-amber-700' : 'bg-green-100 text-green-700'}`}>
                {marginTierLabel(liveMargin.tier)}
              </span>
              <span className="w-full text-xs text-brand-muted">ต้นทุนรวม/หน่วย = วัตถุดิบ + แพ็กเกจจิ้ง + อื่น (บันทึกเป็นคอลัมน์ unit_cost ในตาราง products)</span>
            </div>

            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-brand-accent mb-2">รายละเอียด</label>
              <textarea value={formData.description} onChange={(e) => setFormData({ ...formData, description: e.target.value })} className="input" rows={3} placeholder="รายละเอียดเมนู..." />
            </div>
            
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-brand-accent mb-2">รูปเมนู</label>
              <div className="flex flex-wrap items-center gap-3">
                <input type="file" accept="image/*" onChange={handleImageUpload} className="input" data-testid="product-image-file" />
                {/* Owner request: เพิ่มรูปต้องถ่ายจากกล้องได้ด้วย (มีแต่เลือกจากอัลบั้ม) */}
                <label className="btn btn-outline btn-sm cursor-pointer" title="ถ่ายรูปด้วยกล้อง">
                  📷 ถ่ายรูป
                  <input
                    type="file"
                    accept="image/*"
                    capture="environment"
                    onChange={handleImageUpload}
                    className="hidden"
                    data-testid="product-image-camera"
                  />
                </label>
                {formData.image_url && (
                  <button onClick={() => setFormData({ ...formData, image_url: '' })} className="btn btn-outline text-sm text-red-500">✖ Remove image</button>
                )}
              </div>
              {formData.image_url && (
                <div className="flex items-center gap-2 mt-2">
                  <input
                    type="text"
                    className="input"
                    placeholder="Image URL (https://...) or paste here"
                    value={formData.image_url.startsWith('data:') ? '' : formData.image_url}
                    onChange={(e) => setFormData({ ...formData, image_url: e.target.value })}
                    disabled={formData.image_url.startsWith('data:')}
                  />
                  <img src={formData.image_url} alt="Preview" className="w-16 h-16 object-cover rounded-lg" />
                </div>
              )}
              {!formData.image_url && (
                <p className="text-xs text-brand-muted mt-1">No image yet — pick a file above or paste an image URL</p>
              )}
            </div>
{/* ── Add-ons / Toppings editor (products.addons) ── */}
            <div className="md:col-span-2">
              <AddonsEditor value={addons} onChange={setAddons} />
            </div>
            
            <div className="flex flex-wrap items-center gap-4">
              <ToggleSwitch
                checked={formData.is_available}
                onChange={(v) => setFormData({ ...formData, is_available: v })}
                label="เปิดขาย"
                testId="product-available-toggle"
              />

              <ToggleSwitch
                checked={formData.is_featured}
                onChange={(v) => setFormData({ ...formData, is_featured: v })}
                label="แนะนำ"
                testId="product-featured-toggle"
              />

              {/* Owner report 2026-10-01: แอดมินไม่รู้เมนูไปอยู่หมวดไหน — เพิ่มช่องเลือกโหมดขายชัดเจน */}
              <label className="flex items-center gap-2">
                <span className="text-sm font-medium text-brand-accent">🛒 วิธีขาย:</span>
                <select
                  className="input max-w-60"
                  value={formData.is_preorder ? 'preorder' : 'sameday'}
                  onChange={(e) => {
                    const preorder = e.target.value === 'preorder'
                    setFormData({
                      ...formData,
                      is_preorder: preorder,
                      available_same_day: !preorder,
                      available_preorder: preorder,
                    } as typeof formData)
                  }}
                >
                  <option value="sameday">สั่งได้วันนี้ — ส่งวันนี้</option>
                  <option value="preorder">จองล่วงหน้า — เลือกวันจัดส่ง</option>
                </select>
              </label>
            </div>
          </div>
          
          <div className="flex gap-3 mt-4">
            <button onClick={editingProduct ? handleUpdateProduct : handleAddProduct} className="btn btn-primary">
              {editingProduct ? 'บันทึก' : 'เพิ่มเมนู'}
            </button>
            <button onClick={() => { resetForm(); setShowAddForm(false) }} className="btn btn-outline">ยกเลิก</button>
          </div>
        </div>
      )}

      {/* ── ระบบ "หัวข้อเมนู" เดียว (2026-10-17) — เพิ่ม/แก้/เรียง/ซ่อน/ลบ + ย้ายเมนู ── */}
      <div className="card mb-6 bg-brand-bg">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-lg font-bold text-brand-accent">🍜 หัวข้อเมนู (แสดงทั้งหน้าแรกและเมนูรวม)</h3>
          <button onClick={() => openCategoryForm()} className="btn btn-primary text-sm">+ เพิ่มหัวข้อเมนู</button>
        </div>

        {showCatForm && (
          <div ref={catFormRef} data-testid="category-form-frame" className="card p-4 mb-3 bg-white scroll-mt-20">
            <h4 className="font-bold text-brand-accent mb-3">{editingCat ? 'แก้ไขหัวข้อเมนู' : 'เพิ่มหัวข้อเมนูใหม่'}</h4>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <input type="text" className="input" placeholder="ชื่อหัวข้อเมนู (เช่น เครื่องดื่ม)" value={catForm.name} onChange={(e) => setCatForm({ ...catForm, name: e.target.value })} />
              <input type="text" className="input" placeholder="Icon (e.g. 🍔)" value={catForm.icon} onChange={(e) => setCatForm({ ...catForm, icon: e.target.value })} />
              <input type="number" className="input" placeholder="ลำดับการแสดง" value={catForm.sort_order || ''} onChange={(e) => setCatForm({ ...catForm, sort_order: parseInt(e.target.value || '0') })} />
              <div className="flex items-center">
                <ToggleSwitch
                  checked={catForm.is_active}
                  onChange={(v) => setCatForm({ ...catForm, is_active: v })}
                  label="แสดงหัวข้อนี้"
                  testId="category-active-toggle"
                />
              </div>
            </div>
            <div className="flex gap-2 mt-3">
              <button onClick={handleSaveCategory} className="btn btn-success text-sm">💾 Save</button>
              <button onClick={() => { setShowCatForm(false); setEditingCat(null); setCatForm(blankCategoryForm()) }} className="btn btn-outline text-sm">Cancel</button>
            </div>
          </div>
        )}

        <div className="space-y-2">
          {moveFrom && (
            <div ref={movePanelRef} className="p-3 rounded-lg border-2 border-brand-primary/40 bg-brand-bg scroll-mt-20" data-testid="admin-move-products-panel">
              <div className="text-sm font-medium text-brand-accent mb-2">
                ย้ายสินค้าทั้งหมดจากหมวด: {adminCats.find((c) => c.id === moveFrom)?.name} ({products.filter((p) => p.category_id === moveFrom).length} รายการ)
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <select className="input max-w-64" value={moveTarget} onChange={(e) => setMoveTarget(e.target.value)}>
                  <option value="">เลือกหมวดปลายทาง…</option>
                  {adminCats.filter((c) => c.id !== moveFrom && !c.archived).map((c) => (
                    <option key={c.id} value={c.id}>{c.name}{c.is_active ? '' : ' (ปิดอยู่ — ลูกค้าจะไม่เห็น)'}</option>
                  ))}
                </select>
                <button className="btn btn-primary text-sm" disabled={!moveTarget} onClick={() => void handleMoveProducts()}>ย้ายทั้งหมด</button>
                <button className="btn btn-outline text-sm" onClick={() => { setMoveFrom(null); setMoveTarget('') }}>ยกเลิก</button>
              </div>
            </div>
          )}
          {adminCats.map((cat) => {
            const count = products.filter((p) => p.category_id === cat.id).length
            return (
              <div key={cat.id} className="flex items-center justify-between gap-3 px-3 py-2 rounded-lg bg-white">
                <div className="flex items-center gap-2">
                  <span className="text-xl">{cat.icon || '🍽️'}</span>
                  <span className="font-medium text-brand-accent">{cat.name}</span>
                  <span className="text-xs text-brand-muted">({count} dishes)</span>
                  {!cat.is_active && <span className="badge badge-warning text-xs">Hidden</span>}
                  {cat.archived && <span className="badge badge-danger text-xs">Archived</span>}
                  <span
                    className={`text-xs font-medium ${cat.is_active && !cat.archived ? 'text-green-600' : 'text-red-500'}`}
                    data-testid={`cat-customer-visibility-${cat.id}`}
                  >
                    {cat.is_active && !cat.archived ? 'ลูกค้าเห็น' : 'ซ่อนจากลูกค้า'}
                  </span>
                </div>
                <div className="flex gap-2">
                  <button onClick={() => openCategoryForm(cat)} className="btn btn-outline text-xs">✏️ Edit</button>
                  <button onClick={() => { setMoveFrom(cat.id); setMoveTarget('') }} className="btn btn-outline text-xs" data-testid={`admin-move-products-${cat.id}`}>ย้ายสินค้า</button>
                  <button onClick={() => (cat.archived ? handleRestoreCategory(cat) : handleArchiveCategory(cat))} className="btn btn-outline text-xs text-red-500">📦 Archive</button>
                  <button onClick={() => handleDeleteCategory(cat)} className="btn btn-outline text-xs text-red-500" data-testid={`admin-delete-category-${cat.id}`}>🗑️ ลบถาวร</button>
                </div>
              </div>
            )
          })}
          {adminCats.length === 0 && (
            <p className="text-brand-muted text-sm">No categories yet — add a heading above.</p>
          )}
        </div>
      </div>

      {/* แผงจัดการ "เมนูยอดนิยม" (แถวพิเศษหน้าแรก) + ข้อความหน้าเว็บ */}
      <HomePopularManager products={products} categories={adminCats} />

      {/* Feature C (Owner 2026-10-25): แท็บหมวดหมู่สินค้า — เลือกแท็บ = กรอง + แสดงเป็นหัวข้อ */}
      <div className="flex flex-wrap gap-2 mb-3" role="tablist" aria-label="แท็บหมวดหมู่สินค้า">
        <button
          type="button" role="tab" aria-selected={catTab === 'all'} data-testid="admin-prod-tab-all"
          onClick={() => setCatTab('all')}
          className={`btn text-sm ${catTab === 'all' ? 'btn-primary' : 'btn-outline'}`}
        >
          ทั้งหมด ({products.length})
        </button>
        {adminCats.map((c) => (
          <button
            key={c.id} type="button" role="tab" aria-selected={catTab === c.id} data-testid={`admin-prod-tab-${c.id}`}
            onClick={() => setCatTab(c.id)}
            className={`btn text-sm ${catTab === c.id ? 'btn-primary' : 'btn-outline'}`}
          >
            {c.icon || '🍽️'} {c.name} ({products.filter((p) => p.category_id === c.id).length})
          </button>
        ))}
      </div>
      <h2 className="text-lg font-bold text-brand-accent mb-3" data-testid="admin-prod-list-heading">
        {catTab === 'all'
          ? '📋 สินค้าทั้งหมด'
          : `📋 ${adminCats.find((c) => c.id === catTab)?.icon ?? ''} ${adminCats.find((c) => c.id === catTab)?.name ?? ''}`}
      </h2>
      {/* การ์ดขนาดเท่ากันทุกใบ (min-h + flex + auto-rows-fr) — ไม่มีใบที่ใหญ่/เล็กกว่าเพื่อน */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 auto-rows-fr">
        {(catTab === 'all' ? products : products.filter((p) => p.category_id === catTab)).map((product) => (
          <div key={product.id} className="card flex flex-col min-h-[430px]">
            <div className="aspect-video bg-brand-bg rounded-xl mb-3 overflow-hidden">
              {product.image_url ? (
                <img src={product.image_url} alt={product.name} className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-4xl">🍽️</div>
              )}
            </div>
            <div className="flex items-center justify-between mb-2">
              <h3 className="font-bold text-brand-accent">{product.name}</h3>
              {product.archived && <span className="badge badge-danger text-xs">📦 Archived</span>}
              {customerVisibilityIssue(product, adminCats) && (
                <span className="badge badge-warning text-xs" data-testid="admin-product-customer-hidden">
                  ⚠️ ซ่อนจากหน้าลูกค้า: {CUSTOMER_VISIBILITY_LABEL[customerVisibilityIssue(product, adminCats) ?? 'category_missing']}
                </span>
              )}
              <span className={`badge ${product.is_available ? 'badge-success' : 'badge-danger'}`}>
                {product.is_available ? '✅ เปิดขาย' : '❌ ปิดขาย'}
              </span>
              <span className="badge badge-info text-xs">
                {product.is_preorder ? '📅 จองล่วงหน้า' : '🛒 ส่งวันนี้'}
              </span>
            </div>
            <div className="text-brand-primary font-bold text-xl mb-2">฿{product.price}</div>
            {Array.isArray(product.addons) && product.addons.length > 0 && (
              <span className="badge badge-info text-xs mb-1 inline-block">🧁 +{product.addons.length} toppings</span>
            )}
              {/* FIX (Owner report 2026-10-25 "ผูกสินค้ายังมั่ว"): label หมวดต้องอ่านจาก
                  แหล่งเดียวกับแท็บ (adminCats) — เดิมดึงจาก getCategories (customer: active-only)
                  → หมวดปิด/ไม่ตรง scope ทำให้ชื่อหมวดใต้การ์ดว่าง/ผิด */}
              <div className="text-sm text-brand-muted mb-3">
                {adminCats.find(c => c.id === product.category_id)?.name ?? categories.find(c => c.id === product.category_id)?.name ?? '—'} • ⏱️ {product.prep_minutes} นาที
              </div>
            <div className="flex gap-2 mt-auto pt-2">
              <button onClick={() => handleEditProduct(product)} className="btn btn-outline text-sm flex-1">✏️ แก้ไข</button>
              <button onClick={() => (product.archived ? handleRestoreProduct(product.id) : handleArchiveProduct(product.id))} className="btn btn-outline text-sm text-red-500 flex-1">{product.archived ? '↩ กู้คืน' : '📦 จัดเก็บ'}</button>
              <button onClick={() => handleDeleteProduct(product.id)} className="btn btn-outline text-sm text-red-500" data-testid={`admin-delete-product-${product.id}`}>🗑️ ลบ</button>
            </div>
          </div>
        ))}
      </div>

      {products.length === 0 && (
        <div className="text-center py-12">
          <div className="text-6xl mb-4">🍽️</div>
          <h3 className="text-xl font-bold text-brand-accent">ยังไม่มีเมนู</h3>
          <p className="text-brand-muted mb-4">กด "+ เพิ่มเมนู" เพื่อเริ่ม</p>
        </div>
      )}
    </div>
  )
}