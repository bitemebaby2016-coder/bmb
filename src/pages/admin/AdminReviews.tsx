// ============================================
// Bite Me Baby — Admin Review Moderation (R88 · D6f · migration 199)
// Owner 2026-11-08: "ถ้ามีรีวิวให้แอดมินอนุมัติก่อนและลบได้ตอบได้"
// คิว pending → อนุมัติ (ขึ้นเว็บทันที) / ปัดตก / ตอบกลับ / ลบ · ข้อมูลจริงจากตาราง reviews
// ============================================

import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import {
  getAllReviewsForAdmin, approveReview, rejectReview, replyToReview, deleteReview,
} from '@/lib/bmbAdminApi_reviews'
import { showToast } from '@/components/ui/ToastContainer'
import { LoadErrorBanner } from '@/components/ui/LoadErrorBanner'
import type { VerifiedCustomerReview } from '@/types'

type Tab = 'pending' | 'approved' | 'rejected' | 'all'

export function AdminReviewsPage() {
  const [items, setItems] = useState<VerifiedCustomerReview[]>([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState('')
  const [tab, setTab] = useState<Tab>('pending')
  const [replyDrafts, setReplyDrafts] = useState<Record<string, string>>({})
  const [busyId, setBusyId] = useState<string | null>(null)

  useEffect(() => { void loadData() }, [])

  async function loadData() {
    setLoadError('')
    setLoading(true)
    try { setItems(await getAllReviewsForAdmin()) }
    catch (e) {
      console.error(e)
      setLoadError('โหลดรีวิวไม่สำเร็จ — ตรวจสอบการเชื่อมต่อแล้วกด "ลองใหม่"')
    }
    finally { setLoading(false) }
  }

  async function run(id: string, action: () => Promise<boolean>, okMsg: string) {
    setBusyId(id)
    const ok = await action()
    setBusyId(null)
    if (ok) { showToast(okMsg, 'success'); void loadData() }
    else { showToast('ทำรายการไม่สำเร็จ — ลองใหม่อีกครั้ง', 'error') }
  }

  function handleDelete(id: string) {
    if (window.confirm('ลบรีวิวนี้ถาวร? (การลบยกเลิกไม่ได้)')) {
      void run(id, () => deleteReview(id), 'ลบรีวิวแล้ว')
    }
  }

  const counts = {
    pending: items.filter((r) => (r.status ?? 'pending') === 'pending').length,
    approved: items.filter((r) => r.status === 'approved').length,
    rejected: items.filter((r) => r.status === 'rejected').length,
    all: items.length,
  }
  const shown = items.filter((r) => tab === 'all' || (r.status ?? 'pending') === tab)

  const tabs: { id: Tab; label: string }[] = [
    { id: 'pending', label: `⏳ รออนุมัติ (${counts.pending})` },
    { id: 'approved', label: `✅ อนุมัติแล้ว (${counts.approved})` },
    { id: 'rejected', label: `❌ ปัดตก (${counts.rejected})` },
    { id: 'all', label: `ทั้งหมด (${counts.all})` },
  ]

  if (loading) return <div className="p-8 text-center">Loading...</div>

  return (
    <div className="max-w-5xl mx-auto p-6" data-testid="admin-reviews-page">
      <h1 className="text-2xl font-bold text-brand-accent mb-2">⭐ อนุมัติรีวิว</h1>
      <p className="text-sm text-brand-muted mb-6">
        รีวิวใหม่ = <b>ยังไม่ขึ้นเว็บ</b> จนกว่าจะกดอนุมัติ · อนุมัติแล้วขึ้นหน้ารวม/หน้าเมนูทันที · ตอบกลับแสดงใต้รีวิว · ลบได้ถาวร
      </p>

      {loadError && !loading && (
        <div className="mb-4">
          <LoadErrorBanner message={loadError} onRetry={() => { void loadData() }} testId="admin-reviews-load-error" />
        </div>
      )}

      <div className="flex flex-wrap gap-2 mb-4">
        {tabs.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id)}
            className={`btn btn-sm ${tab === t.id ? 'btn-primary' : 'border border-brand-border'}`}
            data-testid={`admin-reviews-tab-${t.id}`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {shown.length === 0 ? (
        <div className="card bg-gray-50 text-center py-8" data-testid="admin-reviews-empty">
          <p className="text-brand-muted">
            {tab === 'pending' ? 'ไม่มีรีวิวค้างอนุมัติ — ยอดเยี่ยม 🎉' : 'ยังไม่มีรีวิวในหมวดนี้'}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {shown.map((review) => {
            const status = review.status ?? 'pending'
            return (
              <div
                key={review.id}
                className={`card p-4 border-l-4 ${status === 'pending' ? 'border-amber-400' : status === 'approved' ? 'border-emerald-500' : 'border-red-400'}`}
                data-testid={`admin-review-item-${status}`}
              >
                <div className="flex justify-between items-start gap-2 flex-wrap">
                  <div>
                    <span className="font-medium">{review.customer_name}</span>
                    <span className="ml-2">{'⭐'.repeat(Math.round(review.rating))}</span>
                    {review.product_name_display && (
                      <Link to={`/reviews/${review.product_id}`} className="ml-2 text-xs text-brand-primary hover:underline">
                        {review.product_name_display}
                      </Link>
                    )}
                  </div>
                  <span className={`text-xs px-2 py-1 rounded ${status === 'pending' ? 'bg-amber-100 text-amber-700' : status === 'approved' ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'}`}>
                    {status === 'pending' ? 'รออนุมัติ' : status === 'approved' ? 'แสดงบนเว็บแล้ว' : 'ปัดตกแล้ว'}
                  </span>
                </div>
                <p className="mt-2 text-sm">{review.comment}</p>
                <p className="mt-1 text-xs text-brand-muted">
                  {review.order_number && <>ออเดอร์ {review.order_number} · </>}
                  {new Date(review.created_at).toLocaleString('th-TH')}
                </p>

                {review.reply && (
                  <div className="mt-2 rounded bg-brand-bg border border-brand-border p-2 text-sm" data-testid="admin-review-reply-view">
                    💬 ตอบของร้าน: {review.reply}
                  </div>
                )}

                <div className="mt-3 flex flex-wrap gap-2 items-center">
                  {status !== 'approved' && (
                    <button
                      type="button"
                      className="btn btn-primary btn-sm"
                      disabled={busyId === review.id}
                      onClick={() => void run(review.id, () => approveReview(review.id), 'อนุมัติแล้ว — ขึ้นเว็บทันที')}
                      data-testid={`admin-review-approve-${review.id}`}
                    >
                      ✅ อนุมัติ
                    </button>
                  )}
                  {status !== 'rejected' && (
                    <button
                      type="button"
                      className="btn btn-sm border border-brand-border"
                      disabled={busyId === review.id}
                      onClick={() => void run(review.id, () => rejectReview(review.id), 'ปัดรีวิวแล้ว')}
                      data-testid={`admin-review-reject-${review.id}`}
                    >
                      ❌ ปัดตก
                    </button>
                  )}
                  <button
                    type="button"
                    className="btn btn-danger btn-sm"
                    disabled={busyId === review.id}
                    onClick={() => handleDelete(review.id)}
                    data-testid={`admin-review-delete-${review.id}`}
                  >
                    🗑 ลบ
                  </button>
                  <div className="flex gap-2 flex-1 min-w-[260px]">
                    <input
                      className="input flex-1 text-sm"
                      placeholder="ตอบกลับรีวิวนี้…"
                      value={replyDrafts[review.id] ?? review.reply ?? ''}
                      onChange={(e) => setReplyDrafts({ ...replyDrafts, [review.id]: e.target.value })}
                      data-testid={`admin-review-reply-input-${review.id}`}
                    />
                    <button
                      type="button"
                      className="btn btn-sm border border-brand-border"
                      disabled={busyId === review.id}
                      onClick={() => {
                        const text = (replyDrafts[review.id] ?? review.reply ?? '').trim()
                        if (!text) { showToast('พิมพ์ข้อความตอบก่อน', 'warning'); return }
                        void run(review.id, () => replyToReview(review.id, text), 'บันทึกคำตอบแล้ว')
                      }}
                      data-testid={`admin-review-reply-send-${review.id}`}
                    >
                      💬 ตอบ
                    </button>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}

      <div className="mt-6">
        <Link to="/admin" className="text-sm text-brand-primary hover:underline">← Back to Admin Dashboard</Link>
      </div>
    </div>
  )
}