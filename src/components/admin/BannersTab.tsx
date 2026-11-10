// ============================================
// Bite Me Baby — Banners Tab (Promotion banners + Floating Ad + Approval)
// ============================================
import { useState, useEffect, type ChangeEvent } from 'react'
import { supabase } from '@/lib/supabase'
import { showToast } from '@/components/ui/ToastContainer'
import { getBusinessSettings, setBusinessSetting } from '@/lib/bmbAdminApi_settings'
import { listContentApprovals, reviewContent, type ContentApprovalRow } from '@/lib/contentApproval'
import { uploadMediaAsset, listAiAlbumFiles, type AiAlbumFile } from '@/lib/bmbAdminApi_media'
import type { PromotionRow } from '@/lib/bmbAdminApi_promotions'

export interface BannersTabProps {
  promotions: PromotionRow[]
  onBannerChange: (bannerImage: string, bannerMascot: string) => void
}

export function BannersTab({ promotions, onBannerChange }: BannersTabProps) {
  const [floatingAdImage, setFloatingAdImage] = useState('')
  const [approvals, setApprovals] = useState<ContentApprovalRow[]>([])
  const [loading, setLoading] = useState(true)
  const [floatingAdUploading, setFloatingAdUploading] = useState(false)
  const [floatingAdAlbumPanel, setFloatingAdAlbumPanel] = useState(false)
  const [floatingAdAlbum, setFloatingAdAlbum] = useState<AiAlbumFile[] | null>(null)

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
      onBannerChange(next, '')
      showToast(next ? 'ตั้งภาพนี้เป็นโฆษณาลอย (Floating Ad) แล้ว — จะโชว์พร้อมน้อง Bite ประกอบบนรูปที่หน้าแรก' : 'เลิกใช้ภาพนี้เป็นโฆษณาลอยแล้ว (กลับเป็นมาสคอตตามเดิม)', 'success')
    } catch (err) { showToast('บันทึกโฆษณาลอยไม่สำเร็จ: ' + String((err as Error)?.message || err).slice(0, 100), 'error') }
  }

  async function handleFloatingAdUpload(file: File) {
    setFloatingAdUploading(true)
    try {
      const asset = await uploadMediaAsset(file, 'image', 'floating_ad')
      if (asset?.url) {
        const ok = await setBusinessSetting('floating_ad_image', asset.url)
        if (ok) {
          setFloatingAdImage(asset.url)
          onBannerChange(asset.url, '')
          showToast('อัปโหลดรูปโฆษณาลอยสำเร็จ', 'success')
        } else {
          showToast('บันทึก URL ไม่สำเร็จ', 'error')
        }
      } else {
        showToast('อัปโหลดรูปไม่สำเร็จ — ลองอีกครั้ง', 'error')
      }
    } finally {
      setFloatingAdUploading(false)
    }
  }

  async function handleFloatingAdAlbum() {
    if (floatingAdAlbumPanel) { setFloatingAdAlbumPanel(false); return }
    if (!floatingAdAlbum) {
      const files = await listAiAlbumFiles()
      setFloatingAdAlbum(files)
      if (files.length === 0) showToast('ยังไม่มีภาพในคลังภาพ AI — เจนรูปที่ AI Studio ก่อน', 'warning')
    }
    setFloatingAdAlbumPanel(true)
  }

  function pickFloatingAdFromAlbum(url: string) {
    void (async () => {
      const ok = await setBusinessSetting('floating_ad_image', url)
      if (ok) {
        setFloatingAdImage(url)
        onBannerChange(url, '')
        setFloatingAdAlbumPanel(false)
        showToast('ใช้ภาพจากคลังภาพเป็นโฆษณาลอยแล้ว', 'success')
      } else {
        showToast('บันทึก URL ไม่สำเร็จ', 'error')
      }
    })()
  }

  async function handleApproveBanner(id: string) {
    const ok = await reviewContent(id, 'approved')
    if (ok) {
      showToast('อนุมัติแบนเนอร์แล้ว — จะแสดงบนหน้าแรกตามสถานะ Active', 'success')
      const a = await listContentApprovals()
      setApprovals(a.filter((x) => x.content_type === 'banner'))
    } else {
      showToast('อนุมัติไม่สำเร็จ', 'error')
    }
  }

  async function handleRejectBanner(id: string) {
    const note = window.prompt('เหตุผลที่ปฏิเสธ (บันทึกลง audit):', '') ?? ''
    const ok = await reviewContent(id, 'rejected', note)
    if (ok) {
      showToast('ปฏิเสธแบนเนอร์แล้ว', 'success')
      const a = await listContentApprovals()
      setApprovals(a.filter((x) => x.content_type === 'banner'))
    } else {
      showToast('บันทึกการตัดสินใจไม่สำเร็จ', 'error')
    }
  }

  if (loading) return <p className="text-brand-muted text-sm">กำลังโหลดข้อมูลจริง…</p>

  return (
    <div className="space-y-6">
      {/* Floating Ad */}
      <div className="card">
        <h3 className="font-bold text-brand-accent mb-4">📌 โฆษณาลอย (Floating Ad)</h3>
        <p className="text-sm text-brand-muted mb-4">อัปโหลดจากเครื่อง / เลือกจากคลังภาพ AI / วางลิงก์ภายนอก — ภาพจะแสดงพร้อมน้อง Bite ประกอบบนหน้าแรก</p>

        {/* Current preview + remove */}
        <div className="flex items-start gap-4 flex-wrap mb-4">
          {floatingAdImage ? (
            <div className="relative w-40 h-40 rounded-xl border border-brand-border overflow-hidden flex-shrink-0">
              <img src={floatingAdImage} alt="Floating Ad" className="w-full h-full object-cover" />
              <button className="absolute top-1 right-1 w-6 h-6 rounded-full bg-red-500 text-white btn p-0" onClick={() => void toggleFloatingAd(floatingAdImage)} title="เลิกใช้ภาพนี้">✕</button>
            </div>
          ) : (
            <div className="w-40 h-40 rounded-xl border-2 border-dashed border-brand-border flex items-center justify-center text-brand-muted text-sm flex-shrink-0">ยังไม่มีภาพ</div>
          )}
          <div className="flex-1 min-w-[200px]">
            <p className="font-medium">สถานะ: {floatingAdImage ? '✅ ใช้งานแล้ว' : '⚪ ยังไม่ตั้งค่า'}</p>
            <p className="text-xs text-brand-muted mb-2">รูปปัจจุบันจะแสดงพร้อมมาสคอตแบบสุ่มที่แต่ละการ์ด</p>

            {/* External URL input */}
            <div className="flex items-center gap-2 mb-2">
              <input
                type="url"
                className="input flex-1"
                placeholder="https://example.com/image.jpg (ลิงก์ภาพภายนอก)"
                value={floatingAdImage.startsWith('http') && !floatingAdImage.includes('supabase') ? floatingAdImage : ''}
                onChange={(e) => {
                  const url = e.target.value.trim()
                  if (url && url !== floatingAdImage) {
                    void (async () => {
                      const ok = await setBusinessSetting('floating_ad_image', url)
                      if (ok) {
                        setFloatingAdImage(url)
                        onBannerChange(url, '')
                        showToast('ใช้ลิงก์ภาพภายนอกเป็นโฆษณาลอยแล้ว', 'success')
                      } else {
                        showToast('บันทึก URL ไม่สำเร็จ', 'error')
                      }
                    })()
                  }
                }}
              />
            </div>

            {/* Upload from local */}
            <div className="flex items-center gap-2 mb-2">
              <input
                type="file"
                accept="image/*"
                className="input"
                onChange={(e) => {
                  const f = e.target.files?.[0]
                  if (f) void handleFloatingAdUpload(f)
                  e.target.value = ''
                }}
                disabled={floatingAdUploading}
              />
              {floatingAdUploading && <span className="text-sm text-brand-muted">กำลังอัปโหลด…</span>}
            </div>

            {/* AI Album button */}
            <div className="flex items-center gap-2">
              <button
                type="button"
                className="btn btn-outline btn-sm"
                onClick={() => void handleFloatingAdAlbum()}
              >
                📁 เลือกจากคลังภาพ AI
              </button>
            </div>
          </div>
        </div>

        {/* AI Album Panel */}
        {floatingAdAlbumPanel && floatingAdAlbum && (
          <div className="rounded-lg border border-brand-border p-2" data-testid="floating-ad-album-panel">
            <p className="text-xs text-brand-muted mb-2">คลังภาพ AI (bmb-images/ai-generated) — กดเลือกเพื่อใช้เป็นโฆษณาลอย</p>
            {floatingAdAlbum.length > 0 ? (
              <div className="grid grid-cols-4 gap-2 max-h-56 overflow-y-auto">
                {floatingAdAlbum.map((a, i) => (
                  <button
                    key={a.path}
                    type="button"
                    onClick={() => pickFloatingAdFromAlbum(a.url)}
                    data-testid={`floating-ad-album-pick-${i}`}
                    className="rounded border border-brand-border p-1 hover:border-brand-primary"
                    title={a.name}
                  >
                    <img src={a.url} alt={a.name} className="h-16 w-full rounded object-cover" loading="lazy" />
                  </button>
                ))}
              </div>
            ) : (
              <p className="text-xs text-brand-muted">ยังไม่มีภาพในคลัง — เจนที่ AI Studio แล้วกลับมาเลือกใหม่</p>
            )}
          </div>
        )}
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
                      <button className="btn btn-primary text-xs" onClick={() => void handleApproveBanner(a.id)} data-testid={`banner-approve-${a.id}`}>✅ อนุมัติ</button>
                      <button className="btn btn-outline text-xs" onClick={() => void handleRejectBanner(a.id)} data-testid={`banner-reject-${a.id}`}>✖ ปฏิเสธ</button>
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