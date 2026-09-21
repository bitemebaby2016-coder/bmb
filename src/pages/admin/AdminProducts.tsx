import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { showToast } from '@/components/ui/ToastContainer'
import { getProducts, createProduct, updateProduct, deleteProduct, getCategories, getCategoriesAdmin, createCategory, updateCategory, deleteCategory } from '@/lib/bmbAdminApi_products'
import { fileToBase64 } from '@/lib/bmbStorage'
import { slugifyCategory, blankCategoryForm } from '@/lib/adminUi'
import { AddonsEditor, toAddonDrafts, addonDraftsToJson, type AddonDraft } from '@/components/admin/AddonsEditor'
import type { Product, ProductCategory } from '@/types'

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

  async function handleImageUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    const base64 = await fileToBase64(file)
    setFormData({ ...formData, image_url: base64 })
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

  function handleDeleteProduct(id: string) {
    if (confirm('ต้องการลบเมนูนี้ใช่หรือไม่?')) {
      deleteProduct(id)
      loadAll()
      showToast('ลบเมนูสำเร็จ!', 'success')
    }
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
    if (!name) { showToast('กรุกหัวข้อหมวดอาหาร', 'warning'); return }
    const maxSort = adminCats.reduce((m, c) => Math.max(m, c.sort_order || 0), 0)
    const sortOrder = editingCat ? (catForm.sort_order || maxSort) : (catForm.sort_order > 0 ? catForm.sort_order : maxSort + 1)
    if (editingCat) {
      const ok = await updateCategory(editingCat.id, { name, icon: catForm.icon, sort_order: sortOrder, is_active: catForm.is_active })
      if (!ok) { showToast('ไม่สามารถอ্যাপডেটประเภท', 'error'); return }
      showToast('หัวข้อหมডอ্যাপডেটแล้ว!', 'success')
    } else {
      const ok = await createCategory({ name, slug: slugifyCategory(name), icon: catForm.icon, sort_order: sortOrder, is_active: catForm.is_active })
      if (!ok) { showToast('ไม่สามารถเพิ่มประเภท', 'error'); return }
      showToast('เพิ่มหัวข้อหมডสำเร็จ!', 'success')
    }
    setShowCatForm(false)
    setEditingCat(null)
    setCatForm(blankCategoryForm())
    loadAll()
  }

  async function handleDeleteCategory(cat: ProductCategory) {
    const used = products.some((p) => p.category_id === cat.id)
    if (used) {
      showToast('ไม่สามารถลб: มีเมনুในหมวดนี้', 'error')
      return
    }
    if (confirm(`ต้องการลبหมวด "${cat.name}" ใช่หรือไม่?`)) {
      const ok = await deleteCategory(cat.id)
      showToast(ok ? 'لبหมڈสำเร็จ' : 'ลбไม่สำเร็จ', ok ? 'success' : 'error')
      loadAll()
    }
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
              <button onClick={() => { setShowCatForm(false); setEditingCat(null); setCatForm(blankCategoryForm()) }} className="btn btn-outline text-sm">Cancel</button>
            </div>
          </div>
        )}

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
                </div>
                <div className="flex gap-2">
                  <button onClick={() => openCategoryForm(cat)} className="btn btn-outline text-xs">✏️ Edit</button>
                  <button onClick={() => handleDeleteCategory(cat)} className="btn btn-outline text-xs text-red-500">🗑️ Delete</button>
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
              <button onClick={() => handleDeleteProduct(product.id)} className="btn btn-outline text-sm text-red-500 flex-1">🗑️ ลบ</button>
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