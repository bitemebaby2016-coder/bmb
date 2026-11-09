// ============================================
// Bite Me Baby — Banners Tab (Promotion banners + Floating Ad + Approval)
// ============================================
import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { showToast } from '@/components/ui/ToastContainer'
import { getBusinessSettings, setBusinessSetting } from '@/lib/bmbAdminApi_settings'
import { listContentApprovals, type ContentApprovalRow } from '@/lib/contentApproval'
import type { PromotionRow } from '@/lib/bmbAdminApi_promotions'

export interface BannersTabProps {
  promotions: PromotionRow[]
  onBannerChange: (bannerImage: string, bannerMascot: string) => void
}

export function BannersTab({ promotions, onBannerChange }: BannersTabProps) {
  const [floatingAdImage, setFloatingAdImage] = useState('')
  const [approvals, setApprovals] = useState<ContentApprovalRow[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    void (async () => {
      try {
        const { data } = await supabase.from('business_settings').select('value').eq('key', 'floating_ad_image').maybeSingle()
        const v = (data as { value?: unknown } | null)?.value
        if (typeof v === 'string') setFloatingAdImage(v)
      } catch { /* เงียบ */ }
      const a = await listContentApprovals()
      setApprovals(a.filter((x) => x.content_type === 'banner'))
      setLoading(false)
    })()
  }, [])

  async function toggleFloatingAd(url: string) {
    try {
      const next = floatingAdImage === url ? '' : url
      const ok = await setBusinessSetting('floating_ad_image', next)
      if (!ok) throw new Error('save failed')
      setFloatingAdImage(next)
      showToast(next ? 'ตั้งภาพนี้เป็นโฆษณาลอย (Floating Ad) แล้ว — จะโชว์พร้อมน้อง Bite ประกอบบนรูปที่หน้าแรก' : 'เลิกใช้ภาพนี้เป็นโฆษณาลอยแล้ว (กลับเป็นมาสคอตตามเดิม)', 'success')
    } catch (err) { showToast('บันทึกโฆษณาลอยไม่สำเร็จ: ' + String((err as Error)?.message || err).slice(0, 100), 'error') }
  }

  if (loading) return <p className="text-brand-muted text-sm">กำลังโหลดข้อมูลจริง…</p>

  return (
    <div className="space-y-6">
      {/* Floating Ad */}
      <div className="card">
        <h3 className="font-bold text-brand-accent mb-4">📌 โฆษณาลอย (Floating Ad)</h3>
        <p className="text-sm text-brand-muted mb-4">เลือกภาพจากอัลบั้ม AI (แท็บ AI Studio) หรืออัปโหลดใหม่ — ภาพจะแสดงพร้อมน้อง Bite ประกอบบนหน้าแรก</p>
        <div className="flex items-center gap-4 flex-wrap">
          {floatingAdImage ? (
            <div className="relative w-40 h-40 rounded-xl border border-brand-border overflow-hidden">
              <img src={floatingAdImage} alt="Floating Ad" className="w-full h-full object-cover" />
              <button className="absolute top-1 right-1 w-6 h-6 rounded-full bg-red-500 text-white btn p-0" onClick={() => void toggleFloatingAd(floatingAdImage)} title="เลิกใช้ภาพนี้">✕</button>
            </div>
          ) : (
            <div className="w-40 h-40 rounded-xl border-2 border-dashed border-brand-border flex items-center justify-center text-brand-muted text-sm">ยังไม่มีภาพ</div>
          )}
          <div>
            <p className="font-medium">สถานะ: {floatingAdImage ? '✅ ใช้งานแล้ว' : '⚪ ยังไม่ตั้งค่า'}</p>
            <p className="text-xs text-brand-muted">กด "ตั้งเป็นโฆษณาลอย" ในอัลบั้มภาพ AI (แท็บ AI Studio) หรืออัปโหลดใหม่ที่นี่</p>
          </div>
        </div>
      </div>

      {/* Promotion Banners List */}
      <div className="card">
        <h3 className="font-bold text-brand-accent mb-4">🏠 แบนเนอร์โปรโมชั่น (จากแท็บโปรโมชั่น)</h3>
        <p className="text-sm text-brand-muted mb-4">โปรโมชั่นที่ตั้ง is_banner=true จะแสดงที่นี่ — ต้องผ่านคิวอนุมัติ (CNT-01) ก่อนจะขึ้นหน้าแรก</p>
        <div className="space-y-3">
          {promotions.filter((p) => p.is_banner).map((p) => (
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
          {promotions.filter((p) => p.is_banner).length === 0 && <p className="text-center py-8 text-brand-muted">ยังไม่มีโปรโมชั่นแบนเนอร์ — สร้างในแท็บ "โปรโมชั่น/ส่วนลด" และติ๊ก "แสดงเป็นแบนเนอร์หน้าแรก"</p>}
        </div>
      </div>

      {/* Banner Approval Queue */}
      <div className="card" data-testid="banner-approval-list">
        <h3 className="font-bold text-brand-accent mb-3">🛡️ คิวอนุมัติแบนเนอร์ (CNT-01)</h3>
        {approvals.length === 0 ? <p className="text-sm text-brand-muted">ยังไม่มีแบนเนอร์ในคิว — สร้างโปรโมชั่นแบบแบนเนอร์จะส่งเข้ามาอัตโนมัติ</p> : (
          approvals.map((a) => (
            <div key={a.id} className="card" data-testid={`banner-aprow-${a.id}`}>
              <div className="flex items-center justify-between flex-wrap gap-2">
                <div>
                  <p className="font-bold">{a.title}</p>
                  <p className="text-sm text-brand-muted">{a.body}</p>
                </div>
                <div className="flex items-center gap-2">
                  <span className="badge badge-warning">{a.status}</span>
                  {a.status === 'pending' && (
                    <>
                      <button className="btn btn-primary text-xs" onClick={() => { /* approve banner */ }}>✅ อนุมัติ</button>
                      <button className="btn btn-outline text-xs" onClick={() => { /* reject banner */ }}>✖ ปฏิเสธ</button>
                    </>
                  )}
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  )
}