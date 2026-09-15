import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { showToast } from '@/components/ui/ToastContainer'
import { getProducts, createProduct, updateProduct, deleteProduct, getCategories } from '@/lib/bmbAdminApi_products'
import { fileToBase64 } from '@/lib/bmbStorage'
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

  useEffect(() => {
    loadProducts()
    loadCategories()
  }, [])

  async function loadProducts() {
    setProducts(getProducts())
  }

  function loadCategories() {
    setCategories(getCategories())
  }

  async function handleImageUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    
    const base64 = await fileToBase64(file)
    setFormData({ ...formData, image_url: base64 })
  }

  function handleAddProduct() {
    if (!formData.name || !formData.price || !formData.category_id) {
      showToast('กรุณากรอกข้อมูลให้ครบ', 'warning')
      return
    }
    
    createProduct(formData)
    loadProducts()
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
    setShowAddForm(true)
  }

  function handleUpdateProduct() {
    if (!editingProduct) return
    
    updateProduct(editingProduct.id, formData)
    loadProducts()
    resetForm()
    setShowAddForm(false)
    showToast('อัปเดตเมนูสำเร็จ!', 'success')
  }

  function handleDeleteProduct(id: string) {
    if (confirm('ต้องการลบเมนูนี้ใช่หรือไม่?')) {
      deleteProduct(id)
      loadProducts()
      showToast('ลบเมนูสำเร็จ!', 'success')
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
  }

  return (
    <div className="max-w-7xl mx-auto px-4 py-6">
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
              <input type="file" accept="image/*" onChange={handleImageUpload} className="input" />
              {formData.image_url && (
                <img src={formData.image_url} alt="Preview" className="mt-2 w-32 h-32 object-cover rounded-lg" />
              )}
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