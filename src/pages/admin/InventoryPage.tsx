import { useState, useEffect, useCallback } from 'react'
import { getInventory, createInventory, updateInventoryStock, deleteInventory, getLowStockAlerts, type InventoryForm } from '@/lib/bmbAdminApi_inventory'
import { showToast } from '@/components/ui/ToastContainer'
import type { Ingredient, IngredientUnit, ReorderAlert } from '@/types'

export function InventoryPage() {
  const [ingredients, setIngredients] = useState<Ingredient[]>([])
  const [alerts, setAlerts] = useState<ReorderAlert[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [showAddForm, setShowAddForm] = useState(false)
  const [newIngredient, setNewIngredient] = useState<Partial<InventoryForm>>({ name: '', category: 'protein', unit: 'kg' as IngredientUnit, current_stock: 0, min_stock: 1, max_stock: 10, unit_price: 0, supplier_name: '', supplier_phone: '' })

  // Load ingredients from DB on mount
  const loadInventory = useCallback(async () => {
    setIsLoading(true)
    try {
      const data = await getInventory()
      setIngredients(data || [])
    } catch (e) {
      console.error('[InventoryPage] Failed to load inventory:', e)
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => { void loadInventory() }, [loadInventory])

  // Compute low-stock alerts from DB data
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
          is_resolved: false
        })
      }
    })
    setAlerts(computedAlerts)
  }, [ingredients])


  async function handleAddIngredient() {
    if (!newIngredient.name) { showToast('กรุณาใส่ชื่อวัตถุดิบ', 'warning'); return }
    try {
      const created = await createInventory({
        name: newIngredient.name || '',
        category: newIngredient.category || 'protein',
        unit: newIngredient.unit || 'kg',
        current_stock: newIngredient.current_stock || 0,
        min_stock: newIngredient.min_stock || 1,
        max_stock: newIngredient.max_stock || 10,
        unit_price: newIngredient.unit_price || 0,
        supplier_name: newIngredient.supplier_name || '',
        supplier_phone: newIngredient.supplier_phone || '',
      })
      if (created) {
        setIngredients(prev => [...prev, created])
        setNewIngredient({ name: '', category: 'protein', unit: 'kg' as IngredientUnit, current_stock: 0, min_stock: 1, max_stock: 10, unit_price: 0, supplier_name: '', supplier_phone: '' })
        setShowAddForm(false)
        showToast('เพิ่มวัตถุดิบสำเร็จ!', 'success')
        void loadInventory() // refresh to get server-generated timestamps
      } else {
        showToast('เกิดข้อผิดพลาดในการเพิ่มวัตถุดิบ', 'error')
      }
    } catch (e) {
      console.error('[InventoryPage] Add ingredient failed:', e)
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
  async function handleDelete(id: string) {
    if (!confirm('ต้องการลบวัตถุดิบนี้?')) return
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

  return (
    <div className="max-w-7xl mx-auto px-4 py-6">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-3xl font-bold text-brand-accent">📦 จัดการวัตถุดิบ</h1>
        <div className="flex gap-2">
          <button onClick={() => { void loadInventory() }} className="btn btn-outline text-sm" disabled={isLoading}>รีเฟรช</button>
          <button onClick={() => setShowAddForm(!showAddForm)} className="btn btn-primary">+ เพิ่มวัตถุดิบ</button>
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
                  <div className="text-sm text-brand-muted">เหลือ {alert.current_stock} / ต้องมีอย่างน้อย {alert.min_stock} | แนะนำซื้อ {alert.recommended_quantity} กก.</div>
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

      {showAddForm && (
        <div className="card mb-6 bg-brand-bg">
          <h3 className="font-bold text-brand-accent mb-4">➕ เพิ่มวัตถุดิบใหม่</h3>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            <input type="text" placeholder="ชื่อวัตถุดิบ" value={newIngredient.name} onChange={(e) => setNewIngredient({ ...newIngredient, name: e.target.value })} className="input" />
            <select value={newIngredient.category} onChange={(e) => setNewIngredient({ ...newIngredient, category: e.target.value })} className="input">
              <option value="protein">โปรตีน</option>
              <option value="vegetable">ผัก</option>
              <option value="carbohydrate">คาร์บ</option>
              <option value="sauce">ซอส</option>
              <option value="seasoning">เครื่องปรุง</option>
              <option value="beverage">เครื่องดื่ม</option>
            </select>
            <select value={newIngredient.unit} onChange={(e) => setNewIngredient({ ...newIngredient, unit: e.target.value as IngredientUnit })} className="input">
              <option value="kg">กก.</option>
              <option value="g">กรัม</option>
              <option value="liter">ลิตร</option>
              <option value="ml">ml</option>
              <option value="piece">ชิ้น</option>
            </select>
            <input type="number" placeholder="สต็อกปัจจุบัน" value={newIngredient.current_stock} onChange={(e) => setNewIngredient({ ...newIngredient, current_stock: parseFloat(e.target.value) })} className="input" />
            <input type="number" placeholder="ขั้นต่ำ (reorder point)" value={newIngredient.min_stock} onChange={(e) => setNewIngredient({ ...newIngredient, min_stock: parseFloat(e.target.value) })} className="input" />
            <input type="number" placeholder="สูงสุด" value={newIngredient.max_stock} onChange={(e) => setNewIngredient({ ...newIngredient, max_stock: parseFloat(e.target.value) })} className="input" />
            <input type="number" placeholder="ราคา/หน่วย" value={newIngredient.unit_price} onChange={(e) => setNewIngredient({ ...newIngredient, unit_price: parseFloat(e.target.value) })} className="input" />
            <input type="text" placeholder="ชื่อผู้ขาย" value={newIngredient.supplier_name} onChange={(e) => setNewIngredient({ ...newIngredient, supplier_name: e.target.value })} className="input" />
            <input type="text" placeholder="เบอร์โทรผู้ขาย" value={newIngredient.supplier_phone} onChange={(e) => setNewIngredient({ ...newIngredient, supplier_phone: e.target.value })} className="input" />
          </div>
          <div className="flex gap-3 mt-4">
            <button onClick={handleAddIngredient} className="btn btn-primary">บันทึก</button>
            <button onClick={() => setShowAddForm(false)} className="btn btn-outline">ยกเลิก</button>
          </div>
        </div>
      )}

      <div className="card overflow-x-auto">
        <h3 className="font-bold text-brand-accent mb-4">รายการวัตถุดิบทั้งหมด</h3>
        <table className="w-full text-left">
          <thead className="bg-brand-bg">
            <tr>
              <th className="p-3 rounded-l-lg">ชื่อ</th>
              <th className="p-3">หมวด</th>
              <th className="p-3">หน่วย</th>
              <th className="p-3">สต็อก</th>
              <th className="p-3">สถานะ</th>
              <th className="p-3">ราคา</th>
              <th className="p-3 rounded-r-lg">จัดการ</th>
            </tr>
          </thead>
          <tbody>
            {ingredients.map((ing) => (
              <tr key={ing.id} className="border-b border-brand-border hover:bg-brand-bg">
                <td className="p-3 font-medium">{ing.name}</td>
                <td className="p-3">{ing.category}</td>
                <td className="p-3">{ing.unit}</td>
                <td className="p-3">
                  <div className="flex items-center gap-2">
                    <input type="number" value={ing.current_stock} onChange={(e) => handleStockUpdate(ing.id, parseFloat(e.target.value) - ing.current_stock, 'manual')} className="w-20 input text-sm" />
                    <span className="text-sm text-brand-muted">{ing.unit}</span>
                  </div>
                </td>
                <td className="p-3">
                  <span className={`badge ${ing.status === 'in_stock' ? 'badge-success' : ing.status === 'low_stock' ? 'badge-warning' : 'badge-danger'}`}>
                    {ing.status === 'in_stock' ? '✅ มีของ' : ing.status === 'low_stock' ? '⚠️ ใกล้หมด' : '❌ หมด'}
                  </span>
                </td>
                <td className="p-3">฿{ing.unit_price}</td>
                <td className="p-3">
                  <div className="flex gap-2">
                    <button onClick={() => handleStockUpdate(ing.id, ing.max_stock - ing.current_stock, 'restock')} className="btn btn-outline text-xs">เติม</button>
                    <button onClick={() => handleDelete(ing.id)} className="btn btn-outline text-xs text-red-500">ลบ</button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {ingredients.length === 0 && (
        <div className="text-center py-12">
          <div className="text-6xl mb-4">📦</div>
          <h3 className="text-xl font-bold text-brand-accent mb-2">ยังไม่มีวัตถุดิบ</h3>
          <p className="text-brand-muted mb-4">กด "+ เพิ่มวัตถุดิบ" เพื่อเริ่มจัดการสต็อก</p>
        </div>
      )}
    </div>
  )
}