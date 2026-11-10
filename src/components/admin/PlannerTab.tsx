// ============================================
// Bite Me Baby — Planner Tab
// ============================================
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { showToast } from '@/components/ui/ToastContainer'
import { bestSellerProducts } from '@/lib/adminMarketing'

interface PlannerTabProps {
  onTabChange: (tab: string) => void
}

export function PlannerTab({ onTabChange }: PlannerTabProps) {
  const [sellers, setSellers] = useState<Array<{ product_id: string; product_name: string; units: number }>>([])
  const [catalog, setCatalog] = useState<Array<{ id: string; name: string; price: number | null; is_preorder?: boolean; available_preorder?: boolean; available_same_day?: boolean; image_url?: string | null }>>([])
  const [loading, setLoading] = useState(true)

  const load = async () => {
    setLoading(true)
    const [s, cat] = await Promise.all([
      bestSellerProducts(),
      supabase.from('products').select('id,name,price,is_preorder,available_preorder,available_same_day,is_available,image_url').eq('is_available', true).order('sort_order'),
    ])
    setSellers(s)
    setCatalog((cat.data ?? []) as Array<{ id: string; name: string; price: number | null; is_preorder?: boolean; available_preorder?: boolean; available_same_day?: boolean; image_url?: string | null }>)
    setLoading(false)
  }

  useEffect(() => { void load() }, [])

  if (loading) return <p className="text-brand-muted text-sm">กำลังโหลดข้อมูลจริง…</p>

  return (
    <div className="space-y-4">
      <h2 className="font-bold text-brand-accent mb-2">🗓️ Planner — สินค้าขายดี / แคตตาลอก</h2>
      <p className="text-xs text-brand-muted mb-4">จิ้มสินค้าจากแคตตาลอกเพื่อนำไปใช้เป็น "ต้นแบบไดคัท" ตอนเจนภาพเมนู (AI Studio) ได้</p>

      <div className="card">
        <h3 className="font-bold text-brand-accent mb-3">🏆 สินค้าขายดีจริง (จาก order_items)</h3>
        {sellers.length === 0 ? <p className="text-sm text-brand-muted">ยังไม่มีข้อมูลการขาย — รายการจะโผล่เมื่อมีออเดอร์จริง</p> : (
          <ul className="space-y-1">
            {sellers.map((s) => (
              <li key={s.product_id} className="flex items-center justify-between text-sm">
                <span>{s.product_name}</span>
                <span className="flex items-center gap-2">
                  <span className="badge badge-info">{s.units} ชิ้น</span>
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="card">
        <h3 className="font-bold text-brand-accent mb-3">📦 แคตตาลอกสินค้าพร้อมขาย</h3>
        <p className="text-xs text-brand-muted mb-3">คลิกเพื่อนำไปเป็นต้นแบบไดคัท (AI Studio) หรือสร้างโปรโมชั่น/แบนเนอร์</p>
        {catalog.length === 0 ? <p className="text-sm text-brand-muted">ยังไม่มีสินค้า</p> : (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
            {catalog.map((p) => (
              <div key={p.id} className="card p-3 text-center group cursor-pointer border-brand-border hover:border-brand-primary transition" onClick={() => { showToast(`เลือก "${p.name}" แล้ว — ไปที่ AI Studio เพื่อเจนภาพเมนู`, 'info'); }} data-testid={`planner-product-${p.id}`}>
                {p.image_url ? <img src={p.image_url} alt={p.name} className="w-full h-24 object-cover rounded-lg mb-2" /> : <div className="w-full h-24 flex items-center justify-center text-3xl mb-2">🍽️</div>}
                <p className="font-medium text-sm truncate">{p.name}</p>
                <p className="text-xs text-brand-muted">฿{p.price ?? 0}</p>
                <div className="flex flex-wrap justify-center gap-1 mt-2">
                  {p.is_preorder && <span className="badge badge-info text-[9px]">พรีออเดอร์</span>}
                  {p.available_same_day && <span className="badge badge-success text-[9px]">ส่งวันนี้</span>}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}