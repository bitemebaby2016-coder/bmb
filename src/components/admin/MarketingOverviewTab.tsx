// ============================================
// Bite Me Baby — Marketing Overview Tab
// ============================================
import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { showToast } from '@/components/ui/ToastContainer'
import { listMarketingPosts, getMarketingRules, bestSellerProducts, type MarketingPostRow, type MarketingRules } from '@/lib/adminMarketing'
import { listContentApprovals, type ContentApprovalRow } from '@/lib/contentApproval'

interface MarketingOverviewTabProps {
  onTabChange: (tab: string) => void
}

export function MarketingOverviewTab({ onTabChange }: MarketingOverviewTabProps) {
  const [posts, setPosts] = useState<MarketingPostRow[]>([])
  const [approvals, setApprovals] = useState<ContentApprovalRow[]>([])
  const [rules, setRules] = useState<MarketingRules | null>(null)
  const [sellers, setSellers] = useState<Array<{ product_id: string; product_name: string; units: number }>>([])
  const [loading, setLoading] = useState(true)

  const load = async () => {
    setLoading(true)
    const [p, a, r, s] = await Promise.all([
      listMarketingPosts(),
      listContentApprovals(),
      getMarketingRules(),
      bestSellerProducts(),
    ])
    setPosts(p); setApprovals(a); setSellers(s)
    if (r) setRules(r)
    setLoading(false)
  }

  useEffect(() => { void load() }, [])

  const stats = {
    pending: posts.filter((p) => p.status === 'pending_approval').length,
    scheduled: posts.filter((p) => p.status === 'scheduled').length,
    published: posts.filter((p) => p.status === 'published').length,
    failed: posts.filter((p) => p.status === 'failed').length,
  }

  if (loading) return <p className="text-brand-muted text-sm">กำลังโหลดข้อมูลจริง…</p>

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="card text-center">
          <p className="text-2xl font-bold">{stats.pending}</p>
          <p className="text-sm text-brand-muted">รอคนอนุมัติ</p>
        </div>
        <div className="card text-center">
          <p className="text-2xl font-bold">{stats.scheduled}</p>
          <p className="text-sm text-brand-muted">ตั้งเวลาแล้ว</p>
        </div>
        <div className="card text-center">
          <p className="text-2xl font-bold">{stats.published}</p>
          <p className="text-sm text-brand-muted">เผยแพร่แล้ว</p>
        </div>
        <div className="card text-center">
          <p className="text-2xl font-bold text-red-500">{stats.failed}</p>
          <p className="text-sm text-brand-muted">ล้มเหลว (รอ retry)</p>
        </div>
        <div className="card md:col-span-4 text-sm text-brand-muted">
          กติกาปัจจุบัน: {rules ? `${rules.frequency_per_week} โพสต์/สัปดาห์ · หน้าต่างเวลา ${rules.publishing_window?.start}-${rules.publishing_window?.end} · เว้น ${rules.cooldown_hours} ชม.` : 'ยังไม่มีการตั้งค่า'}
          {' · '}โพสต์ทั้งหมด {posts.length} รายการ (ข้อมูลจริงจาก marketing_posts)
        </div>
      </div>

      <div className="card">
        <h3 className="font-bold text-brand-accent mb-3">🏆 สินค้าขายดีจริง (จาก order_items)</h3>
        {sellers.length === 0 ? (
          <p className="text-sm text-brand-muted">ยังไม่มีข้อมูลการขาย — รายการจะโผล่เมื่อมีออเดอร์จริง</p>
        ) : (
          <ul className="space-y-1">
            {sellers.slice(0, 10).map((s) => (
              <li key={s.product_id} className="flex items-center justify-between text-sm">
                <span>{s.product_name}</span>
                <span className="flex items-center gap-2">
                  <span className="badge badge-info">{s.units} ชิ้น</span>
                  <button
                    className="btn btn-outline text-xs"
                    onClick={() => {
                      onTabChange('studio')
                    }}
                  >
                    ใช้ทำโพสต์
                  </button>
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}