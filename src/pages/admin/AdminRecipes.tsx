// ============================================
// Bite Me Baby — Admin Recipes / BOM Management (P1 — DB-backed)
// Shows product-to-ingredient mapping, allows CRUD of recipes
// Data source: recipes table + inventory via RPC
// ============================================

import { useState, useEffect, useCallback } from 'react'
import { listRecipes, upsertRecipe, deleteRecipe } from '@/lib/bmbAdminApi_recipes'
import { getProducts } from '@/lib/bmbAdminApi_products'
import { writeAuditLog } from '@/lib/auditLog'
import { showToast } from '@/components/ui/ToastContainer'

export function AdminRecipes() {
  const [recipes, setRecipes] = useState<any[]>([])
  const [products, setProducts] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [searchProduct, setSearchProduct] = useState('')
  const [selectedProduct, setSelectedProduct] = useState('')
  const [selectedIngredient, setSelectedIngredient] = useState('')
  const [qty, setQty] = useState(0)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const data = await listRecipes()
      setRecipes(data || [])
      const productsData = await getProducts()
      setProducts(productsData || [])
    } catch (e) {
      console.error('[AdminRecipes] Load failed:', e)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { void load() }, [load])

  async function handleAddRecipe() {
    if (!selectedProduct || !selectedIngredient) {
      showToast('กรุาเลือกสินค้าและวัตถุดิบ', 'warning')
      return
    }
    try {
      const ok = await upsertRecipe(selectedProduct, selectedIngredient, qty)
      if (ok) {
        showToast('เพิ่ม Recipe สำเรจ!', 'success')
        writeAuditLog({ action: 'product_update', entity_type: 'recipe', description: 'Added recipe: product=' + selectedProduct + ', ingredient=' + selectedIngredient + ', qty=' + qty })
        await load()
        setSelectedProduct('')
        setSelectedIngredient('')
        setQty(0)
      } else {
        showToast('ไม่สามารถเพิ่ม Recipe ได้', 'error')
      }
    } catch (e) {
      console.error('[AdminRecipes] Add failed:', e)
      showToast('เกิดข้อผิดพลาด', 'error')
    }
  }

  async function handleDelete(product_id: string, ingredient_id: string) {
    if (!confirm('ต้องการลบ Recipe นี้?')) return
    try {
      const ok = await deleteRecipe(product_id, ingredient_id)
      if (ok) {
        showToast('ลบ Recipe สำเรจ!', 'success')
        writeAuditLog({ action: 'product_delete', entity_type: 'recipe', description: 'Deleted recipe for product ' + product_id })
        await load()
      } else {
        showToast('ไม่สามารถลบได้', 'error')
      }
    } catch (e) {
      console.error('[AdminRecipes] Delete failed:', e)
      showToast('เกิดข้อผิดพลาด', 'error')
    }
  }

  // Get unique ingredients
  const ingMap = new Map()
  recipes.forEach(function(r) {
    if (r.ingredient_name && !ingMap.has(r.ingredient_id)) {
      ingMap.set(r.ingredient_id, { id: r.ingredient_id, name: r.ingredient_name, status: r.inventory_status })
    }
  })
  const allIngredients = Array.from(ingMap.values())

  const filtered = searchProduct
    ? recipes.filter(function(r) { return (r.product_name || '').toLowerCase().includes(searchProduct.toLowerCase()) })
    : recipes

  return (
    <div className="max-w-7xl mx-auto px-4 py-6">
      <h1 className="text-3xl font-bold text-brand-accent mb-6">🧪 สตรอาหาร / BOM</h1>

      {/* Add Recipe Form */}
      <div className="card mb-6">
        <h3 className="font-bold text-brand-accent mb-4">➕ เพิ่มสตรใหม่</h3>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
          <select value={selectedProduct} onChange={(e) => setSelectedProduct(e.target.value)} className="input">
            <option value="">— เลือก สินค้า —</option>
            {products.map(function(p) { return <option key={p.id} value={p.id}>{p.name}</option> })}
          </select>
          <select value={selectedIngredient} onChange={(e) => setSelectedIngredient(e.target.value)} className="input">
            <option value="">— เลือก วัตถุดิบ —</option>
            {allIngredients.map(function(i) { return <option key={i.id} value={i.id}>{i.name}</option> })}
          </select>
          <input type="number" placeholder="ปริมาต่อหน่วย" value={qty} onChange={(e) => setQty(parseFloat(e.target.value) || 0)} className="input" step="0.01" min="0" />
          <button onClick={handleAddRecipe} className="btn btn-primary">บันทึก</button>
        </div>
      </div>

      {/* Search */}
      <div className="flex gap-2 mb-4">
        <input type="text" placeholder="ค้นหาตามชื่อสินค้า..." value={searchProduct} onChange={(e) => setSearchProduct(e.target.value)} className="input flex-1" />
      </div>

      {/* Recipes Table */}
      {loading ? (
        <div className="card text-center py-8"><p className="text-brand-muted">กำลังหลด...</p></div>
      ) : filtered.length === 0 ? (
        <div className="card text-center py-12">
          <div className="text-5xl mb-3">📖</div>
          <p className="text-brand-muted">ยังไม่มี Recipe ในระบบ</p>
        </div>
      ) : (
        <div className="card overflow-x-auto">
          <table className="w-full text-left">
            <thead className="bg-brand-bg">
              <tr>
                <th className="p-3">สินค้า</th>
                <th className="p-3">วัตถุดิบ</th>
                <th className="p-3">ปริมา/หน่วย</th>
                <th className="p-3">สตอกปัจจุบัน</th>
                <th className="p-3">จัดการ</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(function(r) {
                return (
                  <tr key={r.id} className="border-b border-brand-border hover:bg-brand-bg">
                    <td className="p-3 font-medium">{r.product_name || r.product_id.slice(0, 8)}</td>
                    <td className="p-3">{r.ingredient_name || r.ingredient_id.slice(0, 8)}</td>
                    <td className="p-3">{r.quantity_per_unit}</td>
                    <td className="p-3">{r.inventory_status || '-'}</td>
                    <td className="p-3">
                      <button onClick={() => void handleDelete(r.product_id, r.ingredient_id)} className="btn btn-outline text-xs text-red-500">ลบ</button>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

