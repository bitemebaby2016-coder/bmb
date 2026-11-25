// ============================================
// Bite Me Baby — Admin Recipes / BOM Management (P1 — DB-backed)
// Shows product-to-ingredient mapping, allows CRUD of recipes
// Data source: recipes table + inventory via RPC
// Phase 1: Edit, Batch yield, Cost breakdown, Prep yield display
// ============================================

import { useState, useEffect, useCallback, useMemo } from 'react'
import { listRecipes, upsertRecipe, updateRecipe, deleteRecipe, type RecipeForm, type RecipeRow } from '@/lib/bmbAdminApi_recipes'
import { getProducts } from '@/lib/bmbAdminApi_products'
import { getInventory } from '@/lib/bmbAdminApi_inventory'
import type { Ingredient } from '@/types'
import { writeAuditLog } from '@/lib/auditLog'
import { showToast } from '@/components/ui/ToastContainer'
import { LoadErrorBanner } from '@/components/ui/LoadErrorBanner'

export function AdminRecipes() {
  const [recipes, setRecipes] = useState<RecipeRow[]>([])
  const [products, setProducts] = useState<any[]>([])
  const [inventory, setInventory] = useState<Ingredient[]>([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState('')
  const [searchProduct, setSearchProduct] = useState('')
  const [categoryFilter, setCategoryFilter] = useState('')
  const [showForm, setShowForm] = useState(false)
  const [editingKey, setEditingKey] = useState<string | null>(null)
  const [formData, setFormData] = useState<Partial<RecipeForm>>({})
  const [formErrors, setFormErrors] = useState<Record<string, string>>({})

  const load = useCallback(async () => {
    setLoading(true)
    setLoadError('')
    try {
      const data = await listRecipes()
      setRecipes(data || [])
      const productsData = await getProducts()
      setProducts(productsData || [])
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

  function getIngredient(ingredientId: string): Ingredient | undefined {
    return inventory.find(i => i.id === ingredientId)
  }

  function computeIngredientCost(ing: Ingredient): number {
    return ing.wavg_cost ?? ing.last_approved_price ?? ing.unit_price
  }

  function computeRecipeCost(recipe: RecipeRow): { total: number; breakdown: Array<{ ingredient: string; qty: number; unitCost: number; cost: number }> } {
    const breakdown: Array<{ ingredient: string; qty: number; unitCost: number; cost: number }> = []
    let total = 0
    recipes.filter(r => r.product_id === recipe.product_id).forEach(r => {
      const ing = getIngredient(r.ingredient_id)
      if (ing) {
        const unitCost = computeIngredientCost(ing)
        const cost = r.quantity_per_unit * unitCost
        breakdown.push({ ingredient: ing.name, qty: r.quantity_per_unit, unitCost, cost })
        total += cost
      }
    })
    // Apply batch yield factor
    const yieldFactor = recipe.batch_yield_factor ?? 1.0
    const finalCost = yieldFactor > 0 ? total / yieldFactor : total
    return { total: finalCost, breakdown }
  }

  function validateForm(data: Partial<RecipeForm>): Record<string, string> {
    const errors: Record<string, string> = {}
    if (!data.product_id) errors.product_id = 'กรุณาเลือกสินค้า'
    if (!data.ingredient_id) errors.ingredient_id = 'กรุณาเลือกวัตถุดิบ'
    if (data.quantity_per_unit === undefined || data.quantity_per_unit <= 0) errors.quantity_per_unit = 'ปริมาณต้องมากกว่า 0'
    if (data.batch_yield_factor !== undefined && (data.batch_yield_factor <= 0 || data.batch_yield_factor > 1)) errors.batch_yield_factor = 'Batch Yield ต้องอยู่ระหว่าง 0-1'
    if (data.batch_waste_pct !== undefined && (data.batch_waste_pct < 0 || data.batch_waste_pct > 100)) errors.batch_waste_pct = 'Batch Waste % ต้องอยู่ระหว่าง 0-100'
    return errors
  }

  function resetForm() {
    setFormData({})
    setFormErrors({})
    setEditingKey(null)
    setShowForm(false)
  }

  function startAdd() {
    resetForm()
    setFormData({
      quantity_per_unit: 0,
      batch_yield_factor: 1.0,
      batch_waste_pct: 0,
    })
    setShowForm(true)
  }

  function startEdit(recipe: RecipeRow) {
    const key = `${recipe.product_id}-${recipe.ingredient_id}`
    setEditingKey(key)
    setFormData({
      product_id: recipe.product_id,
      ingredient_id: recipe.ingredient_id,
      quantity_per_unit: recipe.quantity_per_unit,
      batch_yield_factor: recipe.batch_yield_factor ?? 1.0,
      batch_waste_pct: recipe.batch_waste_pct ?? 0,
      cost_per_unit: recipe.cost_per_unit,
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
      let ok = false
      const payload: RecipeForm = {
        product_id: formData.product_id!,
        ingredient_id: formData.ingredient_id!,
        quantity_per_unit: formData.quantity_per_unit!,
        batch_yield_factor: formData.batch_yield_factor ?? 1.0,
        batch_waste_pct: formData.batch_waste_pct ?? 0,
        cost_per_unit: formData.cost_per_unit,
      }

      if (editingKey) {
        ok = await updateRecipe(formData.product_id!, formData.ingredient_id!, payload)
      } else {
        ok = await upsertRecipe(payload)
      }

      if (ok) {
        showToast(editingKey ? 'อัปเดตสูตรสำเร็จ!' : 'เพิ่มสูตรสำเร็จ!', 'success')
        writeAuditLog({
          action: editingKey ? 'product_update' : 'product_create',
          entity_type: 'recipe',
          description: `${editingKey ? 'Updated' : 'Added'} recipe: product=${formData.product_id}, ingredient=${formData.ingredient_id}, qty=${formData.quantity_per_unit}`
        })
        await load()
        resetForm()
      } else {
        showToast(editingKey ? 'ไม่สามารถอัปเดตได้' : 'ไม่สามารถเพิ่มสูตรได้', 'error')
      }
    } catch (e) {
      console.error('[AdminRecipes] Submit failed:', e)
      showToast('เกิดข้อผิดพลาด', 'error')
    }
  }

  async function handleDelete(product_id: string, ingredient_id: string) {
    if (!confirm('ต้องการลบสูตรนี้?')) return
    try {
      const ok = await deleteRecipe(product_id, ingredient_id)
      if (ok) {
        showToast('ลบสูตรสำเร็จ!', 'success')
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

  const productCategories = useMemo(() => {
    const cats = new Set(products.map(p => p.category_id).filter(Boolean))
    return Array.from(cats).sort()
  }, [products])

  const filteredRecipes = useMemo(() => {
    let result = [...recipes]
    if (searchProduct) {
      const q = searchProduct.toLowerCase()
      result = result.filter(r =>
        (r.product_name || '').toLowerCase().includes(q) ||
        (r.ingredient_name || '').toLowerCase().includes(q)
      )
    }
    if (categoryFilter) {
      const catProductIds = new Set(products.filter(p => p.category_id === categoryFilter).map(p => p.id))
      result = result.filter(r => catProductIds.has(r.product_id))
    }
    return result
  }, [recipes, searchProduct, categoryFilter, products])

  const recipesByProduct = useMemo(() => {
    const map = new Map<string, RecipeRow[]>()
    filteredRecipes.forEach(r => {
      const arr = map.get(r.product_id) || []
      arr.push(r)
      map.set(r.product_id, arr)
    })
    return map
  }, [filteredRecipes])

  const productsWithRecipes = useMemo(() => {
    const set = new Set(recipes.map(r => r.product_id))
    return products.filter(p => set.has(p.id))
  }, [products, recipes])

  const productsWithoutRecipes = useMemo(() => {
    const set = new Set(recipes.map(r => r.product_id))
    const q = searchProduct.toLowerCase()
    return products.filter(p => !set.has(p.id) && (!q || (p.name || '').toLowerCase().includes(q)))
  }, [products, recipes, searchProduct])

  const allIngredients = useMemo(() => {
    const ingMap = new Map()
    recipes.forEach(r => {
      if (r.ingredient_name && !ingMap.has(r.ingredient_id)) {
        ingMap.set(r.ingredient_id, { id: r.ingredient_id, name: r.ingredient_name, status: r.inventory_status })
      }
    })
    return inventory.length > 0
      ? inventory.map(i => ({ id: i.id, name: i.name, status: i.current_stock <= i.min_stock ? 'low' : 'ok' }))
      : Array.from(ingMap.values())
  }, [recipes, inventory])

  return (
    <div className="max-w-7xl mx-auto px-4 py-6">
      <h1 className="text-3xl font-bold text-brand-accent mb-6">🧪 สูตรอาหาร / BOM (Recipe Management)</h1>

      {/* Search & Filter */}
      <div className="card mb-4">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 p-3 bg-brand-bg rounded-lg">
          <div>
            <label className="block text-xs text-brand-muted mb-1">ค้นหาสินค้า/วัตถุดิบ</label>
            <input type="text" placeholder="พิมพ์เพื่อค้นหา..." value={searchProduct} onChange={(e) => setSearchProduct(e.target.value)} className="input text-sm" />
          </div>
          <div>
            <label className="block text-xs text-brand-muted mb-1">หมวดหมู่สินค้า</label>
            <select value={categoryFilter} onChange={(e) => setCategoryFilter(e.target.value)} className="input text-sm">
              <option value="">ทั้งหมด</option>
              {productCategories.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
          <div className="flex items-end">
            <button onClick={startAdd} className="btn btn-primary w-full">+ เพิ่มสูตรใหม่</button>
          </div>
        </div>
      </div>

      {/* Add/Edit Recipe Form */}
      {showForm && (
        <div className="card mb-6 bg-brand-bg">
          <h3 className="font-bold text-brand-accent mb-4">{editingKey ? '✏️ แก้ไขสูตร' : '➕ เพิ่มสูตรใหม่'}</h3>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
            <div>
              <label className="block text-sm font-medium text-brand-muted mb-1">สินค้า (Product) <span className="text-red-500">*</span></label>
              <select value={formData.product_id || ''} onChange={(e) => setFormData({ ...formData, product_id: e.target.value })} className={`input ${formErrors.product_id ? 'border-red-500' : ''}`}>
                <option value="">— เลือกสินค้า —</option>
                {products.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
              {formErrors.product_id && <p className="text-red-500 text-xs mt-1">{formErrors.product_id}</p>}
            </div>
            <div>
              <label className="block text-sm font-medium text-brand-muted mb-1">วัตถุดิบ (Ingredient) <span className="text-red-500">*</span></label>
              <select value={formData.ingredient_id || ''} onChange={(e) => setFormData({ ...formData, ingredient_id: e.target.value })} className={`input ${formErrors.ingredient_id ? 'border-red-500' : ''}`}>
                <option value="">— เลือกวัตถุดิบ —</option>
                {allIngredients.map(i => <option key={i.id} value={i.id}>{i.name}</option>)}
              </select>
              {formErrors.ingredient_id && <p className="text-red-500 text-xs mt-1">{formErrors.ingredient_id}</p>}
            </div>
            <div>
              <label className="block text-sm font-medium text-brand-muted mb-1">ปริมาณต่อหน่วย <span className="text-red-500">*</span></label>
              <input type="number" step="0.01" min="0.01" value={formData.quantity_per_unit ?? 0} onChange={(e) => setFormData({ ...formData, quantity_per_unit: parseFloat(e.target.value) || 0 })} className={`input ${formErrors.quantity_per_unit ? 'border-red-500' : ''}`} />
              {formErrors.quantity_per_unit && <p className="text-red-500 text-xs mt-1">{formErrors.quantity_per_unit}</p>}
            </div>
            <div className="md:col-span-2 lg:col-span-4">
              <label className="block text-sm font-medium text-brand-muted mb-1">Batch Yield Factor (0-1) <span className="text-red-500">*</span></label>
              <input type="number" step="0.01" min="0.01" max="1" value={formData.batch_yield_factor ?? 1} onChange={(e) => setFormData({ ...formData, batch_yield_factor: parseFloat(e.target.value) || 1 })} className={`input ${formErrors.batch_yield_factor ? 'border-red-500' : ''}`} style={{maxWidth: '200px'}} />
              {formErrors.batch_yield_factor && <p className="text-red-500 text-xs mt-1">{formErrors.batch_yield_factor}</p>}
              <p className="text-xs text-brand-muted mt-1">เช่น 0.9 = ได้ 90% หลังปรุง (สูญเสีย 10%)</p>
            </div>
            <div className="md:col-span-2 lg:col-span-4">
              <label className="block text-sm font-medium text-brand-muted mb-1">Batch Waste % (0-100) <span className="text-red-500">*</span></label>
              <input type="number" step="0.1" min="0" max="100" value={formData.batch_waste_pct ?? 0} onChange={(e) => setFormData({ ...formData, batch_waste_pct: parseFloat(e.target.value) || 0 })} className={`input ${formErrors.batch_waste_pct ? 'border-red-500' : ''}`} style={{maxWidth: '200px'}} />
              {formErrors.batch_waste_pct && <p className="text-red-500 text-xs mt-1">{formErrors.batch_waste_pct}</p>}
              <p className="text-xs text-brand-muted mt-1">ของเสียระหว่างกระบวนการปรุง (แยกจาก Prep Waste ของวัตถุดิบ)</p>
            </div>
            <div className="flex gap-3 mt-4">
              <button onClick={handleSubmit} className="btn btn-primary">บันทึก</button>
              <button onClick={resetForm} className="btn btn-outline">ยกเลิก</button>
            </div>
          </div>
        </div>
      )}

      {/* Products Without Recipes */}
      {productsWithoutRecipes.length > 0 && (
        <div className="card mb-4" data-testid="recipes-missing">
          <h3 className="font-bold text-brand-accent mb-1">📋 เมนูที่ยังไม่มีสูตร ({productsWithoutRecipes.length} เมนู)</h3>
          <p className="text-sm text-brand-muted mb-3">
            กดเลือกเมนูเพื่อเติมชื่อในฟอร์มด้านบน แล้วเลือกวัตถุดิบ + ปริมาณ → บันทึก
            (สินค้าใหม่ที่เพิ่มในระบบจะขึ้นในรายการนี้เอง)
          </p>
          <ul className="flex flex-wrap gap-2">
            {productsWithoutRecipes.map(p => (
              <li key={p.id}>
                <button className="btn btn-outline text-xs" onClick={() => { setFormData({ ...formData, product_id: p.id, ingredient_id: '', quantity_per_unit: 0 }); setShowForm(true) }} data-testid={'recipe-pick-' + p.id}>
                  + {p.name}
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Recipes Table */}
      {loading ? (
        <div className="card text-center py-8"><p className="text-brand-muted">กำลังโหลด...</p></div>
      ) : loadError ? (
        <div className="card text-center py-8">
          <LoadErrorBanner message={loadError} onRetry={() => { void load() }} testId="recipes-load-error" />
        </div>
      ) : filteredRecipes.length === 0 ? (
        <div className="card text-center py-12">
          <div className="text-5xl mb-3">📖</div>
          <p className="text-brand-muted">ยังไม่มี Recipe ในระบบ</p>
        </div>
      ) : (
        <div className="card overflow-x-auto">
          {Array.from(recipesByProduct.entries()).map(([productId, productRecipes]) => {
            const product = products.find(p => p.id === productId)
            const { total: recipeCost, breakdown } = computeRecipeCost(productRecipes[0])
            return (
              <div key={productId} className="border-b border-brand-border last:border-0">
                <div className="bg-brand-bg p-3 font-bold text-brand-accent flex items-center justify-between">
                  <span>🍽️ {product?.name || productId}</span>
                  <div className="flex items-center gap-4 text-sm">
                    <span className="text-brand-primary font-bold">ต้นทุน/หน่วย: ฿{recipeCost.toFixed(2)}</span>
                    <span className="text-brand-muted">Batch Yield: {(productRecipes[0].batch_yield_factor ?? 1) * 100}%</span>
                    <span className="text-brand-muted">Batch Waste: {productRecipes[0].batch_waste_pct ?? 0}%</span>
                  </div>
                </div>
                <table className="w-full text-left">
                  <thead className="bg-brand-bg/50">
                    <tr>
                      <th className="p-3">วัตถุดิบ</th>
                      <th className="p-3">ปริมาณ/หน่วย</th>
                      <th className="p-3">หน่วยนับ</th>
                      <th className="p-3">Prep Yield</th>
                      <th className="p-3">Prep Waste</th>
                      <th className="p-3">ต้นทุน/หน่วยใช้</th>
                      <th className="p-3">ต้นทุนรวม</th>
                      <th className="p-3">สต็อก</th>
                      <th className="p-3">จัดการ</th>
                    </tr>
                  </thead>
                  <tbody>
                    {productRecipes.map((r) => {
                      const ing = getIngredient(r.ingredient_id)
                      const unitCost = ing ? computeIngredientCost(ing) : 0
                      const ingCost = r.quantity_per_unit * unitCost
                      const prepYield = ing ? (ing.prep_yield_factor ?? 1) * 100 : 100
                      const prepWaste = ing ? (ing.prep_waste_pct ?? 0) : 0
                      const stockStatus = ing ? (ing.current_stock <= ing.min_stock ? 'low' : 'ok') : 'unknown'
                      return (
                        <tr key={`${r.product_id}-${r.ingredient_id}`} className="border-b border-brand-border hover:bg-brand-bg">
                          <td className="p-3 font-medium">{r.ingredient_name || r.ingredient_id.slice(0, 8)}</td>
                          <td className="p-3">{r.quantity_per_unit}</td>
                          <td className="p-3">{ing?.unit || '-'}</td>
                          <td className="p-3">{prepYield.toFixed(0)}%</td>
                          <td className="p-3">{prepWaste.toFixed(1)}%</td>
                          <td className="p-3">฿{unitCost.toFixed(2)}</td>
                          <td className="p-3 font-medium text-brand-primary">฿{ingCost.toFixed(2)}</td>
                          <td className="p-3">
                            <span className={`badge ${stockStatus === 'low' ? 'badge-warning' : 'badge-success'}`}>
                              {ing ? `${ing.current_stock} ${ing.unit}` : '-'}
                            </span>
                          </td>
                          <td className="p-3">
                            <div className="flex gap-1">
                              <button onClick={() => startEdit(r)} className="btn btn-outline text-xs">แก้ไข</button>
                              <button onClick={() => handleDelete(r.product_id, r.ingredient_id)} className="btn btn-outline text-xs text-red-500">ลบ</button>
                            </div>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}