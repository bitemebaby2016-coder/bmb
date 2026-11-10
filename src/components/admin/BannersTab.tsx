// ============================================
// Bite Me Baby — Banners Tab (Promotion banner list only)
// Floating Ad moved to ContentTab, Approval queue moved to ApprovalHistoryTab
// ============================================
import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { showToast } from '@/components/ui/ToastContainer'
import type { PromotionRow } from '@/lib/bmbAdminApi_promotions'

export interface BannersTabProps {
  promotions: PromotionRow[]
}

export function BannersTab({ promotions }: BannersTabProps) {
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    setLoading(false)
  }, [])

  if (loading) return <p className="text-brand-muted text-sm">กำลังโหลดข้อมูลจริง…</p>

  const bannerPromos = promotions.filter((p) => p.is_banner)

  return (
    <div className="space-y-6">
      {/* Promotion Banners List */}
      <div className="card">
        <h3 className="font-bold text-brand-accent mb-4">🏠 แบนเนอร์โปรโมชั่น (จากแท็บโปรโมชั่น)</h3>
        <p className="text-sm text-brand-muted mb-4">โปรโมชั่นที่ตั้ง is_banner=true จะแสดงที่นี่ — ต้องผ่านคิวอนุมัติ (CNT-01) ก่อนจะขึ้นหน้าแรก · จัดการรูป/มาสคอต/ตั้ง Floating Ad ที่แท็บ "📝 สร้างเนื้อหา"</p>
        <div className="space-y-3">
          {bannerPromos.map((p) => (
            <div key={p.id} className="card flex items-center gap-4">
              <div className="w-24 h-24 rounded-lg border border-brand-border overflow-hidden flex-shrink-0">
                {p.banner_image ? <img src={p.banner_image} alt={p.name} className="w-full h-full object-cover" /> : <span className="text-3xl">🎁</span>}
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-bold truncate">{p.name}{p.code && <span className="ml-2 badge badge-primary">{p.code}</span>}</p>
                <p className="text-sm text-brand-muted">{p.discount_type === 'percentage' ? `ลด ${p.discount_value}%` : `ลด ฿${p.discount_value}`} • ขั้นต่ำ ฿{p.min_order_amount}</p>
                <p className="text-xs text-brand-muted">เริ่ม: {p.start_date || 'ทันที'} → ถึง: {p.end_date || 'ไม่กำหนด'}</p>
              </div>
              <div className="flex flex-col items-end gap-1">
                <span className={`badge ${p.is_active ? 'badge-success' : 'badge-warning'}`}>{p.is_active ? 'เปิดใช้งาน' : 'พักชั่วคราว'}</span>
                <span className="badge badge-info text-xs">🛡️ รอตรวจเนื้อหา</span>
              </div>
            </div>
          ))}
          {bannerPromos.length === 0 && <p className="text-center py-8 text-brand-muted">ยังไม่มีโปรโมชั่นแบนเนอร์ — สร้างในแท็บ "โปรโมชั่น/ส่วนลด" และติ๊ก "แสดงเป็นแบนเนอร์หน้าแรก" (รูป/มาสคอตจัดการที่แท็บ "📝 สร้างเนื้อหา")</p>}
        </div>
      </div>
    </div>
  )
}