// ============================================
// Bite Me Baby — Admin Recipes / BOM Management (P1 — DB-backed)
// Shows product-to-ingredient mapping, allows CRUD of recipes
// Data source: recipes table + inventory via RPC
// ============================================

import { useState, useEffect, useCallback } from 'react'
import { listRecipes, upsertRecipe, deleteRecipe } from '@/lib/bmbAdminApi_recipes'
import { getProducts } from '@/lib/bmbAdminApi_products'
// R21f (Owner): dropdown วัตถุดิบต้องมาจากคลังจริงทั้งหมด (เดิม derive จาก recipes ที่มีอยู่ →
// ถ้าสินค้ายังไม่มีสูตร จะเลือกวัตถุดิบไม่ได้เลย = เพิ่มสูตรใหม่ไม่ได้จริง)
import { getInventory } from '@/lib/bmbAdminApi_inventory'
import type { Ingredient } from '@/types'
import { writeAuditLog } from '@/lib/auditLog'
import { showToast } from '@/components/ui/ToastContainer'
// R21d backlog: โหลด recipes/BOM ไม่สำเร็จต้องฟ้อง (ห้ามโชว์ "ยังไม่มี Recipe ในระบบ" ปลอม)
import { LoadErrorBanner } from '@/components/ui/LoadErrorBanner'

export function AdminRecipes() {
  const [recipes, setRecipes] = useState<any[]>([])
  const [products, setProducts] = useState<any[]>([])
  // R21f: คลังวัตถุดิบทั้งหมด (master data สำหรับ dropdown — ไม่ใช่ derived จาก recipes)
  const [inventory, setInventory] = useState<Ingredient[]>([])
  const [loading, setLoading] = useState(true)
  // R21d: โหลดล้มเหลว ≠ ไม่มีสูตร
  const [loadError, setLoadError] = useState('')
  const [searchProduct, setSearchProduct] = useState('')
  const [selectedProduct, setSelectedProduct] = useState('')
  const [selectedIngredient, setSelectedIngredient] = useState('')
  const [qty, setQty] = useState(0)

  const load = useCallback(async () => {
    setLoading(true)
    setLoadError('')
    try {
      const data = await listRecipes()
      setRecipes(data || [])
      const productsData = await getProducts()
      setProducts(productsData || [])
      // R21f: คลังทั้งหมดสำหรับ dropdown — ล้มเหลวไม่ block หน้า (fallback = derived จาก recipes)
      try {
        const ing = await getInventory()
        setInventory((ing || []) as Ingredient[])
      } catch (e) {
        console.warn('[AdminRecipes] inventory load failed (fallback to recipe-derived):', String(e).slice(0, 100))
      }
    } catch (e) {
      console.error('[AdminRecipes] Load failed:', e)
      setLoadError('โหลดสูตรอาหารไม่สำเร็จ — ตรวจสอบการเชื่อมต่อแล้วกด "ลองใหม่"')
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
  const allIngredients = inventory.length > 0
    ? inventory.map(function(i) { return { id: i.id, name: i.name, status: i.current_stock <= i.min_stock ? 'low' : 'ok' } })
    : Array.from(ingMap.values())

  const filtered = searchProduct
    ? recipes.filter(function(r) { return (r.product_name || '').toLowerCase().includes(searchProduct.toLowerCase()) })
    : recipes

  return (
    <div className="max-w-7xl mx-auto px-4 py-6">
      <h1 className="text-3xl font-bold text-brand-accent mb-6">🧪 สูตรอาหาร / BOM</h1>

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
          <input type="number" placeholder="ปริมาณต่อหน่วย" value={qty} onChange={(e) => setQty(parseFloat(e.target.value) || 0)} className="input" step="0.01" min="0" />
          <button onClick={handleAddRecipe} className="btn btn-primary">บันทึก</button>
        </div>
      </div>

      {/* Search */}
      <div className="flex gap-2 mb-4">
        <input type="text" placeholder="ค้นหาตามชื่อสินค้า..." value={searchProduct} onChange={(e) => setSearchProduct(e.target.value)} className="input flex-1" />
      </div>

      {/* R21f (Owner): "สูตรอาหารยังลิ้งไม่หมดทุกเมนู" — รายการเมนูที่ยังไม่มีสูตร
          (products โหลดสดทุกครั้ง → สินค้าใหม่ที่แอดมินเพิ่มโผล่ที่นี่อัตโนมัติ) */}
      {(() => {
        const withRecipe = new Set(recipes.map(function(r) { return r.product_id }))
        const q = searchProduct.toLowerCase()
        const missing = products.filter(function(p) {
          return !withRecipe.has(p.id) && (!q || String(p.name || '').toLowerCase().includes(q))
        })
        if (missing.length === 0) return null
        return (
          <div className="card mb-4" data-testid="recipes-missing">
            <h3 className="font-bold text-brand-accent mb-1">📋 เมนูที่ยังไม่มีสูตร ({missing.length} เมนู)</h3>
            <p className="text-sm text-brand-muted mb-3">
              กดเลือกเมนูเพื่อเติมชื่อในฟอร์มด้านบน แล้วเลือกวัตถุดิบ + ปริมาณ → บันทึก
              (สินค้าใหม่ที่เพิ่มในระบบจะขึ้นในรายการนี้เอง)
            </p>
            <ul className="flex flex-wrap gap-2">
              {missing.map(function(p) {
                return (
                  <li key={p.id}>
                    <button className="btn btn-outline text-xs" onClick={() => { setSelectedProduct(p.id); setSelectedIngredient(''); setQty(0) }} data-testid={'recipe-pick-' + p.id}>
                      + {p.name}
                    </button>
                  </li>
                )
              })}
            </ul>
          </div>
        )
      })()}

      {/* Recipes Table */}
      {loading ? (
        <div className="card text-center py-8"><p className="text-brand-muted">กำลังหลด...</p></div>
      ) : loadError ? (
        <div className="card text-center py-8">
          <LoadErrorBanner message={loadError} onRetry={() => { void load() }} testId="recipes-load-error" />
        </div>
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

