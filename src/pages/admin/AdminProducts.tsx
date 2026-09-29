import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { showToast } from '@/components/ui/ToastContainer'
import { getProducts, createProduct, updateProduct, archiveProduct, restoreProduct, getCategories, getCategoriesAdmin, createCategory, updateCategory, archiveCategory, restoreCategory, getSectionsAdmin, createSection, updateSection, archiveSection, restoreSection } from '@/lib/bmbAdminApi_products'
import { uploadProductImage, validateImageFile } from '@/lib/bmbAdminApi_media'
import { slugifyCategory, blankCategoryForm } from '@/lib/adminUi'
import { AddonsEditor, toAddonDrafts, addonDraftsToJson, type AddonDraft } from '@/components/admin/AddonsEditor'
import type { Product, ProductCategory, MenuSection } from '@/types'


export function AdminProducts() {
  const [products, setProducts] = useState<Product[]>([])
  const [categories, setCategories] = useState<ProductCategory[]>([])
  const [showAddForm, setShowAddForm] = useState(false)
  const [editingProduct, setEditingProduct] = useState<Product | null>(null)
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    price: 0,
    category_id: '',
    image_url: '',
    is_available: true,
    is_featured: false,
    prep_minutes: 10
  })
  const [addons, setAddons] = useState<AddonDraft[]>([])

  // ── Category headings (PHASE 6 UI/admin) — add / rename / reorder / hide ──
  const [adminCats, setAdminCats] = useState<ProductCategory[]>([])
  const [catForm, setCatForm] = useState(blankCategoryForm())
  const [showCatForm, setShowCatForm] = useState(false)
  const [editingCat, setEditingCat] = useState<ProductCategory | null>(null)

  // ── Sections (CAT-01, migration 055): Menu → Section → Category → Product ──
  const [sections, setSections] = useState<MenuSection[]>([])
  const [sectionForm, setSectionForm] = useState({ name: '', sort_order: 0 })
  const [editingSection, setEditingSection] = useState<MenuSection | null>(null)
  const [showSectionForm, setShowSectionForm] = useState(false)

  useEffect(() => { loadAll() }, [])

  async function loadAll() {
    try {
      const [products, cats, allCats, secs] = await Promise.all([getProducts(), getCategories(), getCategoriesAdmin(), getSectionsAdmin()])
      setProducts(products)
      setCategories(cats)
      setAdminCats(allCats)
      setSections(secs)
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
    await createProduct({ ...formData, addons: addonDraftsToJson(addons) })
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
      category_id: product.category_id,
      image_url: product.image_url,
      is_available: product.is_available,
      is_featured: product.is_featured,
      prep_minutes: product.prep_minutes
    })
    setAddons(toAddonDrafts(product.addons))
    setShowAddForm(true)
  }

  async function handleUpdateProduct() {
    if (!editingProduct) return
    
    await updateProduct(editingProduct.id, { ...formData, addons: addonDraftsToJson(addons) })
    loadAll()
    resetForm()
    setShowAddForm(false)
    showToast('อัปเดตเมนูสำเร็จ!', 'success')
  }

  // ── Archive / Restore (CAT-01, migration 055 — CAT-D04=B: hard delete is NOT the normal mechanism) ──
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
      setCatForm({ name: cat.name, icon: cat.icon, sort_order: cat.sort_order, is_active: cat.is_active, menu_section_id: cat.menu_section_id ?? '' })
    } else {
      setEditingCat(null)
      setCatForm(blankCategoryForm())
    }
    setShowCatForm(true)
  }

  async function handleSaveCategory() {
    const name = catForm.name.trim()
    if (!name) { showToast('กรุกหัวข้อหมวดอาหาร', 'warning'); return }
    const maxSort = adminCats.reduce((m, c) => Math.max(m, c.sort_order || 0), 0)
    const sortOrder = editingCat ? (catForm.sort_order || maxSort) : (catForm.sort_order > 0 ? catForm.sort_order : maxSort + 1)
    if (editingCat) {
      const ok = await updateCategory(editingCat.id, { name, icon: catForm.icon, sort_order: sortOrder, is_active: catForm.is_active, menu_section_id: (catForm.menu_section_id || null) as string | null })
      if (!ok) { showToast('ไม่สามารถอ্যাপডেটประเภท', 'error'); return }
      showToast('หัวข้อหมডอ্যাপডেটแล้ว!', 'success')
    } else {
      const ok = await createCategory({ name, slug: slugifyCategory(name), icon: catForm.icon, sort_order: sortOrder, is_active: catForm.is_active, menu_section_id: (catForm.menu_section_id || null) as string | null })
      if (!ok) { showToast('ไม่สามารถเพิ่มประเภท', 'error'); return }
      showToast('เพิ่มหัวข้อหมডสำเร็จ!', 'success')
    }
    setShowCatForm(false)
    setEditingCat(null)
    setCatForm(blankCategoryForm())
    loadAll()
  }

  async function handleArchiveCategory(cat: ProductCategory) {
    const used = false // CAT-D04=B: archive allowed regardless of order references
    if (used) {
      showToast('ไม่สามารถลб: มีเมনুในหมวดนี้', 'error')
      return
    }
    if (confirm(`ต้องการลبหมวด "${cat.name}" ใช่หรือไม่?`)) {
      const ok = await archiveCategory(cat.id)
      showToast(ok ? 'لبหมڈสำเร็จ' : 'ลбไม่สำเร็จ', ok ? 'success' : 'error')
      loadAll()
    }
  }

  async function handleRestoreCategory(cat: ProductCategory) {
    const ok = await restoreCategory(cat.id)
    showToast(ok ? 'กู้คืนหมวดแล้ว' : 'กู้คืนไม่สำเร็จ', ok ? 'success' : 'error')
    loadAll()
  }

  // ── Sections (CAT-01, migration 055) ──
  async function handleSaveSection() {
    const name = sectionForm.name.trim()
    if (!name) { showToast('กรุณาใส่ชื่อ Section', 'warning'); return }
    if (editingSection) {
      const ok = await updateSection(editingSection.id, { name, sort_order: sectionForm.sort_order })
      showToast(ok ? 'อัปเดต Section แล้ว!' : 'บันทึกไม่สำเร็จ', ok ? 'success' : 'error')
    } else {
      const ok = await createSection({ name, slug: slugifyCategory(name), sort_order: sectionForm.sort_order, is_active: true })
      showToast(ok ? 'เพิ่ม Section แล้ว!' : 'บันทึกไม่สำเร็จ', ok ? 'success' : 'error')
    }
    setShowSectionForm(false)
    setEditingSection(null)
    loadAll()
  }

  async function handleArchiveSection(id: string) {
    if (confirm('ซ่อน Section นี้ (ลูกค้าไม่เห็น + server จะไม่รับสินค้าใน Section นี้ — กู้คืนได้)?')) {
      const ok = await archiveSection(id)
      showToast(ok ? 'จัดเก็บ Section แล้ว (กู้คืนได้)' : 'ไม่สำเร็จ', ok ? 'success' : 'error')
      loadAll()
    }
  }

  async function handleRestoreSection(id: string) {
    const ok = await restoreSection(id)
    showToast(ok ? 'กู้คืน Section แล้ว' : 'ไม่สำเร็จ', ok ? 'success' : 'error')
    loadAll()
  }

  function resetForm() {
    setFormData({
      name: '',
      description: '',
      price: 0,
      category_id: '',
      image_url: '',
      is_available: true,
      is_featured: false,
      prep_minutes: 10
    })
    setEditingProduct(null)
    setAddons([])
  }

  return (
    <div className="max-w-7xl mx-auto px-4 py-6">
<Link to="/admin" className="text-sm text-brand-muted hover:underline">← กลับแดшборд</Link>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-3xl font-bold text-brand-accent">🍽️ จัดการเมนู</h1>
        <button onClick={() => { resetForm(); setShowAddForm(true) }} className="btn btn-primary">+ เพิ่มเมนู</button>
      </div>

      {showAddForm && (
        <div className="card mb-6 bg-brand-bg">
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
              <label className="block text-sm font-medium text-brand-accent mb-2">หมวดหมู่</label>
              <select value={formData.category_id} onChange={(e) => setFormData({ ...formData, category_id: e.target.value })} className="input">
                <option value="">เลือกหมวดหมู่</option>
                {categories.map(cat => (
                  <option key={cat.id} value={cat.id}>{cat.icon} {cat.name}</option>
                ))}
              </select>
            </div>
            
            <div>
              <label className="block text-sm font-medium text-brand-accent mb-2">เวลาเตรียม (นาที)</label>
              <input type="number" value={formData.prep_minutes || ''} onChange={(e) => setFormData({ ...formData, prep_minutes: parseInt(e.target.value) })} className="input" placeholder="15" />
            </div>
            
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-brand-accent mb-2">รายละเอียด</label>
              <textarea value={formData.description} onChange={(e) => setFormData({ ...formData, description: e.target.value })} className="input" rows={3} placeholder="รายละเอียดเมนู..." />
            </div>
            
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-brand-accent mb-2">รูปเมนู</label>
              <div className="flex flex-wrap items-center gap-3">
                <input type="file" accept="image/*" onChange={handleImageUpload} className="input" />
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
            
            <div className="flex items-center gap-4">
              <label className="flex items-center gap-2">
                <input type="checkbox" checked={formData.is_available} onChange={(e) => setFormData({ ...formData, is_available: e.target.checked })} />
                <span className="text-sm">เปิดขาย</span>
              </label>
              
              <label className="flex items-center gap-2">
                <input type="checkbox" checked={formData.is_featured} onChange={(e) => setFormData({ ...formData, is_featured: e.target.checked })} />
                <span className="text-sm">แนะนำ</span>
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

      {/* ── PHASE 6 UI/admin: Category headings manager (add / rename / reorder / hide) ── */}
      <div className="card mb-6 bg-brand-bg">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-lg font-bold text-brand-accent">🏷️ Category headings</h3>
          <button onClick={() => openCategoryForm()} className="btn btn-primary text-sm">+ New heading</button>
        </div>

        {showCatForm && (
          <div className="card p-4 mb-3 bg-white">
            <h4 className="font-bold text-brand-accent mb-3">{editingCat ? 'Edit heading' : 'New category heading'}</h4>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <input type="text" className="input" placeholder="Heading (e.g. Burgers)" value={catForm.name} onChange={(e) => setCatForm({ ...catForm, name: e.target.value })} />
              <input type="text" className="input" placeholder="Icon (e.g. 🍔)" value={catForm.icon} onChange={(e) => setCatForm({ ...catForm, icon: e.target.value })} />
              <input type="number" className="input" placeholder="Order" value={catForm.sort_order || ''} onChange={(e) => setCatForm({ ...catForm, sort_order: parseInt(e.target.value || '0') })} />
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={catForm.is_active} onChange={(e) => setCatForm({ ...catForm, is_active: e.target.checked })} />
                Active
              </label>
            </div>
            <div className="flex gap-2 mt-3">
              <button onClick={handleSaveCategory} className="btn btn-success text-sm">💾 Save</button>
              <div>
              <label className="block text-sm font-medium text-brand-accent mb-2">Section</label>
              <select value={(catForm.menu_section_id as string) || ''} onChange={(e) => setCatForm({ ...catForm, menu_section_id: e.target.value })} className="input">
                <option value="">— ไม่มี Section —</option>
                {sections.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </div>
            <button onClick={() => { setShowCatForm(false); setEditingCat(null); setCatForm(blankCategoryForm()) }} className="btn btn-outline text-sm">Cancel</button>
            </div>
          </div>
        )}

      {/* Sections manager (CAT-01, migration 055): Menu → Section → Category → Product */}
      <div className="card mb-6">
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-bold text-brand-accent">📚 Sections (หัวข้อเมนู)</h2>
          <button onClick={() => { setEditingSection(null); setSectionForm({ name: '', sort_order: sections.reduce((m, s) => Math.max(m, s.sort_order || 0), 0) + 1 }); setShowSectionForm(true) }} className="btn btn-outline text-xs">+ Section</button>
        </div>
        {showSectionForm && (
          <div className="flex flex-wrap gap-2 items-center mb-3">
            <input className="input max-w-xs" placeholder="ชื่อ Section" value={sectionForm.name} onChange={(e) => setSectionForm({ ...sectionForm, name: e.target.value })} />
            <input type="number" className="input max-w-24" aria-label="ลำดับ" value={sectionForm.sort_order} onChange={(e) => setSectionForm({ ...sectionForm, sort_order: parseInt(e.target.value || '0', 10) })} />
            <button onClick={handleSaveSection} className="btn btn-primary text-xs">Save</button>
            <button onClick={() => { setShowSectionForm(false); setEditingSection(null) }} className="btn btn-outline text-sm">Cancel</button>
          </div>
        )}
        <div className="space-y-1">
          {sections.map((s) => (
            <div key={s.id} className="flex items-center justify-between gap-2 px-3 py-2 rounded-lg bg-white">
              <div className="flex items-center gap-2">
                <span className="font-medium text-brand-accent">{s.name}</span>
                <span className="text-xs text-brand-muted">(#{s.sort_order})</span>
                {!s.is_active && <span className="badge badge-warning text-xs">Hidden</span>}
              </div>
              <div className="flex gap-2">
                <button onClick={() => { setEditingSection(s); setSectionForm({ name: s.name, sort_order: s.sort_order }); setShowSectionForm(true) }} className="btn btn-outline text-xs">✏️ Edit</button>
                {s.is_active ? (
                  <button onClick={() => handleArchiveSection(s.id)} className="btn btn-outline text-xs text-red-500">📦 Archive</button>
                ) : (
                  <button onClick={() => handleRestoreSection(s.id)} className="btn btn-outline text-xs">↩ Restore</button>
                )}
              </div>
            </div>
          ))}
          {sections.length === 0 && <p className="text-brand-muted text-sm">ยังไม่มี Section — หมวดทั้งหมดแสดงแบบเดิมจนกว่าจะสร้าง Section</p>}
        </div>
      </div>

        <div className="space-y-2">
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
                </div>
                <div className="flex gap-2">
                  <button onClick={() => openCategoryForm(cat)} className="btn btn-outline text-xs">✏️ Edit</button>
                  <button onClick={() => (cat.archived ? handleRestoreCategory(cat) : handleArchiveCategory(cat))} className="btn btn-outline text-xs text-red-500">📦 Archive</button>
                </div>
              </div>
            )
          })}
          {adminCats.length === 0 && (
            <p className="text-brand-muted text-sm">No categories yet — add a heading above.</p>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {products.map((product) => (
          <div key={product.id} className="card">
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
              <span className={`badge ${product.is_available ? 'badge-success' : 'badge-danger'}`}>
                {product.is_available ? '✅ เปิดขาย' : '❌ ปิดขาย'}
              </span>
            </div>
            <div className="text-brand-primary font-bold text-xl mb-2">฿{product.price}</div>
            {Array.isArray(product.addons) && product.addons.length > 0 && (
              <span className="badge badge-info text-xs mb-1 inline-block">🧁 +{product.addons.length} toppings</span>
            )}
            <div className="text-sm text-brand-muted mb-3">
              {categories.find(c => c.id === product.category_id)?.name} • ⏱️ {product.prep_minutes} นาที
            </div>
            <div className="flex gap-2">
              <button onClick={() => handleEditProduct(product)} className="btn btn-outline text-sm flex-1">✏️ แก้ไข</button>
              <button onClick={() => (product.archived ? handleRestoreProduct(product.id) : handleArchiveProduct(product.id))} className="btn btn-outline text-sm text-red-500 flex-1">{product.archived ? '↩ กู้คืน' : '📦 จัดเก็บ'}</button>
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