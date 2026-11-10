// ============================================
// Bite Me Baby — Approval History Tab (CNT-01)
// แยกคิวอนุมัติเป็น 4 แท็บย่อย: pending / approved / rejected / all
// ============================================
import { useCallback, useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { showToast } from '@/components/ui/ToastContainer'
import { listContentApprovals, reviewContent, type ContentApprovalRow, type ContentApprovalStatus } from '@/lib/contentApproval'
import { flashTo } from '@/lib/uiFlash'

const STATUS_LABELS: Record<ContentApprovalStatus, string> = {
  pending: 'รออนุมัติ',
  approved: 'อนุมัติแล้ว',
  rejected: 'ปัดตกแล้ว',
}

const STATUS_CLS: Record<ContentApprovalStatus, string> = {
  pending: 'badge badge-warning',
  approved: 'badge badge-success',
  rejected: 'badge badge-danger',
}

type Tab = 'pending' | 'approved' | 'rejected' | 'all'

export interface ApprovalHistoryTabProps {
  load: () => Promise<void>
}

export function ApprovalHistoryTab({ load }: ApprovalHistoryTabProps) {
  const [tab, setTab] = useState<Tab>('pending')
  const [items, setItems] = useState<ContentApprovalRow[]>([])
  const [loading, setLoading] = useState(true)
  const [busyId, setBusyId] = useState<string | null>(null)
  const [retryContent, setRetryContent] = useState<ContentApprovalRow | null>(null)

  const fetchItems = useCallback(async () => {
    setLoading(true)
    try {
      let status: ContentApprovalStatus | undefined
      if (tab !== 'all') status = tab
      const data = await listContentApprovals({ status, limit: 100 })
      setItems(data)
    } catch {
      showToast('โหลดข้อมูลไม่สำเร็จ', 'error')
    } finally {
      setLoading(false)
    }
  }, [tab])

  useEffect(() => { void fetchItems() }, [fetchItems])

  async function handleApprove(id: string) {
    setBusyId(id)
    const ok = await reviewContent(id, 'approved')
    setBusyId(null)
    if (ok) {
      showToast('อนุมัติแล้ว — สถานะอัปเดตแล้ว', 'success')
      await fetchItems()
    } else {
      showToast('อนุมัติไม่สำเร็จ', 'error')
    }
  }

  async function handleReject(id: string) {
    const note = window.prompt('เหตุผลที่ปฏิเสธ (บันทึกลง audit):', '') ?? ''
    setBusyId(id)
    const ok = await reviewContent(id, 'rejected', note)
    setBusyId(null)
    if (ok) {
      showToast('ปฏิเสธแล้ว', 'success')
      await fetchItems()
    } else {
      showToast('บันทึกการตัดสินใจไม่สำเร็จ', 'error')
    }
  }

  async function handleRetry(item: ContentApprovalRow) {
    // Re-submit the same content for approval
    const newId = await supabase.functions.invoke('submit_content_for_approval', {
      body: {
        p_content_type: item.content_type,
        p_title: item.title,
        p_body: item.body,
        p_image_url: item.image_url ?? null,
        p_mascot: item.mascot ?? null,
      }
    })
    if (newId.error) {
      showToast('ส่งตรวจใหม่ไม่สำเร็จ: ' + newId.error.message, 'error')
    } else {
      showToast('ส่งตรวจใหม่แล้ว — อยู่ในคิวรออนุมัติ', 'success')
      await fetchItems()
    }
  }

  const counts = {
    pending: items.filter((x) => x.status === 'pending').length,
    approved: items.filter((x) => x.status === 'approved').length,
    rejected: items.filter((x) => x.status === 'rejected').length,
    all: items.length,
  }

  const tabs: { id: Tab; label: string }[] = [
    { id: 'pending', label: `⏳ รออนุมัติ (${counts.pending})` },
    { id: 'approved', label: `✅ อนุมัติแล้ว (${counts.approved})` },
    { id: 'rejected', label: `❌ ปัดตก (${counts.rejected})` },
    { id: 'all', label: `ทั้งหมด (${counts.all})` },
  ]

  const shown = items.filter((x) => tab === 'all' || x.status === tab)

  if (loading) return <p className="text-brand-muted text-sm p-4">กำลังโหลดข้อมูลจริง…</p>

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="font-bold text-brand-accent text-xl">🛡️ คิวอนุมัติ & ประวัติ</h2>
        <p className="text-xs text-brand-muted">รายการใหม่สุดอยู่บนสุด · กดแท็บเพื่อดูสถานะต่าง ๆ</p>
      </div>

      {/* Tabs */}
      <div className="flex flex-wrap gap-2 mb-4" role="tablist">
        {tabs.map((t) => (
          <button
            key={t.id}
            role="tab"
            aria-selected={tab === t.id}
            onClick={() => setTab(t.id)}
            className={`btn btn-sm ${tab === t.id ? 'btn-primary' : 'border border-brand-border'}`}
            data-testid={`approval-tab-${t.id}`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Content */}
      {shown.length === 0 ? (
        <div className="card bg-gray-50 text-center py-12" data-testid="approval-empty">
          <p className="text-brand-muted">
            {tab === 'pending' ? 'ไม่มีรายการรออนุมัติ — ยอดเยี่ยม 🎉' : 'ยังไม่มีรายการในหมวดนี้'}
          </p>
        </div>
      ) : (
        <div className="space-y-3" data-testid="approval-list">
          {shown.map((item) => (
            <div
              key={item.id}
              className={`card p-4 border-l-4 ${item.status === 'pending' ? 'border-amber-400' : item.status === 'approved' ? 'border-emerald-500' : 'border-red-400'}`}
              data-testid={`approval-item-${item.status}`}
            >
              <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center flex-wrap gap-2 mb-1">
                    <span className="font-semibold">{item.title}</span>
                    <span className={STATUS_CLS[item.status]}>{STATUS_LABELS[item.status]}</span>
                    <span className="badge badge-info text-xs">{item.content_type}</span>
                    {item.reviewed_at && (
                      <span className="text-xs text-brand-muted">ตรวจเมื่อ: {new Date(item.reviewed_at).toLocaleString('th-TH')}</span>
                    )}
                  </div>
                  <p className="text-sm text-brand-muted mb-1">{item.body}</p>
                  <p className="text-xs text-brand-muted">
                    สร้างโดย: {item.created_by} · {new Date(item.created_at).toLocaleString('th-TH')}
                    {item.reviewer_id && <span> · ตรวจโดย: {item.reviewer_id}</span>}
                    {item.review_note && <span className="block mt-1">หมายเหตุ: {item.review_note}</span>}
                  </p>
                  {item.image_url && (
                    <div className="mt-2">
                      <img src={item.image_url} alt="preview" className="w-24 h-24 object-cover rounded-lg border border-brand-border" />
                    </div>
                  )}
                  {item.mascot && (
                    <div className="mt-2">
                      <span className="text-xs text-brand-muted">มาสคอต: </span>
                      <img src={item.mascot} alt="mascot" className="inline w-10 h-10 object-contain" />
                    </div>
                  )}
                </div>

                <div className="flex flex-wrap items-center gap-2 md:ml-4">
                  {item.status === 'pending' && (
                    <>
                      <button
                        type="button"
                        className="btn btn-primary btn-sm"
                        disabled={busyId === item.id}
                        onClick={() => void handleApprove(item.id)}
                        data-testid={`approval-approve-${item.id}`}
                      >
                        {busyId === item.id ? '⏳' : '✅ อนุมัติ'}
                      </button>
                      <button
                        type="button"
                        className="btn btn-outline btn-sm"
                        disabled={busyId === item.id}
                        onClick={() => void handleReject(item.id)}
                        data-testid={`approval-reject-${item.id}`}
                      >
                        {busyId === item.id ? '⏳' : '✖ ปฏิเสธ'}
                      </button>
                    </>
                  )}
                  {item.status === 'rejected' && (
                    <button
                      type="button"
                      className="btn btn-primary btn-sm"
                      onClick={() => void handleRetry(item)}
                      data-testid={`approval-retry-${item.id}`}
                    >
                      🔁 ส่งตรวจใหม่
                    </button>
                  )}
                  {item.status === 'approved' && (
                    <button
                      type="button"
                      className="btn btn-outline btn-sm"
                      onClick={() => void handleRetry(item)}
                      data-testid={`approval-retry-${item.id}`}
                    >
                      🔁 ส่งตรวจใหม่ (แก้ไข)
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Load trigger for parent */}
      {false && <button onClick={load} className="hidden" data-testid="approval-load-trigger" />}
    </div>
  )
}