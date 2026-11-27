// ============================================
// Bite Me Baby — Theater Menu Control (admin-only box on /shop)
// ============================================
// กล่องควบคุม "เมนูที่จะโชว์ในเธียเตอร์" (FoodTheater) — วางเหนือเซกชัน 🔥 เมนูยอดนิยม
// CANONICAL: admin_portfolio_items.is_theater_carousel (migration 201) — ไม่สร้าง source ใหม่
//   เปิด = สร้าง/อัปเดต portfolio item (product_id, is_theater_carousel=true, is_active=true)
//   ปิด = set is_theater_carousel=false + is_active=false
// แสดงเฉพาะแอดมิน (role admin/owner/manager) เท่านั้น
// ============================================

import { useEffect, useMemo, useState } from 'react'
import type { Product } from '@/types'
import { useAuthStore } from '@/store/authStore'
import { ToggleSwitch } from '@/components/admin/ToggleSwitch'
import { showToast } from '@/components/ui/ToastContainer'
import {
  getAllPortfolioItems,
  createPortfolioItem,
  updatePortfolioItem,
} from '@/lib/bmbAdminApi_portfolio'
import type { AdminPortfolioItem } from '@/types'

const ADMIN_ROLES = ['admin', 'owner', 'manager']

export function TheaterMenuControl({ products }: { products: Product[] }) {
  const role = useAuthStore((s) => s.role)
  const isAdmin = !!role && ADMIN_ROLES.includes(role.toLowerCase())

  const [items, setItems] = useState<AdminPortfolioItem[]>([])
  const [loading, setLoading] = useState(false)
  const [savingId, setSavingId] = useState<string | null>(null)

  useEffect(() => {
    if (!isAdmin) return
    let active = true
    setLoading(true)
    void getAllPortfolioItems()
      .then((rows) => { if (active) setItems(rows) })
      .catch(() => undefined)
      .finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [isAdmin])

  // product_id → portfolio item (ตัวที่ผูกกับเมนู)
  const byProduct = useMemo(() => {
    const map = new Map<string, AdminPortfolioItem>()
    for (const it of items) {
      if (it.product_id) map.set(String(it.product_id), it)
    }
    return map
  }, [items])

  if (!isAdmin) return null

  async function setTheater(product: Product, on: boolean) {
    setSavingId(product.id)
    try {
      const existing = byProduct.get(String(product.id))
      if (on) {
        if (existing) {
          await updatePortfolioItem(existing.id, { is_theater_carousel: true, is_active: true })
        } else {
          const order = items.filter((i) => i.is_theater_carousel).length
          await createPortfolioItem({
            title: product.name,
            description: product.description || null,
            image_url: product.image_url || '',
            media_asset_id: null,
            display_order: order,
            is_active: true,
            product_id: product.id,
            is_theater_carousel: true,
            theater_caption: null,
          })
        }
        showToast('เพิ่มเข้าธียเตอร์แล้ว', 'success')
      } else if (existing) {
        await updatePortfolioItem(existing.id, { is_theater_carousel: false, is_active: false })
        showToast('นำออกจากธียเตอร์แล้ว', 'success')
      }
      setItems(await getAllPortfolioItems())
    } catch {
      showToast('บันทึกไม่สำเร็จ — ลองใหม่อีกครั้ง', 'error')
    } finally {
      setSavingId(null)
    }
  }

  return (
    <section
      id="home-sec-theater-control"
      className="card p-4 mb-6 scroll-mt-20"
      aria-labelledby="theater-control-heading"
      data-testid="theater-menu-control"
    >
      <div className="flex items-center justify-between mb-2">
        <h2 id="theater-control-heading" className="text-lg font-display font-bold text-brand-accent">
          🎭 ควบคุมเมนูที่จะโชว์ในเธียเตอร์
        </h2>
        <span className="text-xs text-brand-muted">{loading ? 'กำลังโหลด…' : `ในเธียเตอร์ ${items.filter((i) => i.is_theater_carousel && i.is_active).length} เมนู`}</span>
      </div>
      <p className="text-xs text-brand-muted mb-3">
        เปิด = เมนูนี้จะโชว์ในธียเตอร์บนหน้าแรก (บันทึกลง admin_portfolio_items อัตโนมัติ)
      </p>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-2 max-h-72 overflow-y-auto pr-1">
        {products.map((p) => {
          const it = byProduct.get(String(p.id))
          const on = !!it && it.is_theater_carousel && it.is_active
          return (
            <div key={p.id} className="flex items-center gap-3 border border-brand-border rounded px-3 py-2">
              {p.image_url ? (
                <img src={p.image_url} alt="" loading="lazy" className="w-10 h-10 object-cover rounded" />
              ) : (
                <span className="w-10 h-10 rounded bg-brand-bg flex items-center justify-center" aria-hidden="true">🍽️</span>
              )}
              <span className="flex-1 min-w-0 text-sm font-medium text-brand-text truncate">{p.name}</span>
              <ToggleSwitch
                checked={on}
                onChange={(v) => void setTheater(p, v)}
                label=""
                testId={`theater-toggle-${p.id}`}
              />
              {savingId === p.id && <span className="text-xs text-brand-muted">…</span>}
            </div>
          )
        })}
        {products.length === 0 && <p className="text-sm text-brand-muted">ยังไม่มีเมนูในระบบ</p>}
      </div>
    </section>
  )
}