// ============================================
// Bite Me Baby — Social Tab (Approval + Calendar + Auto-schedule)
// ============================================
import { useCallback, useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { showToast } from '@/components/ui/ToastContainer'
import { listMarketingPosts, scheduleMarketingPost, type MarketingPostRow } from '@/lib/adminMarketing'
import { listContentApprovals, reviewContent, type ContentApprovalRow } from '@/lib/contentApproval'
import { autoScheduleApprovedPosts } from '@/lib/marketingAutoSchedule'
import { flashTo } from '@/lib/uiFlash'

const STATUS_CLS: Record<string, string> = {
  draft: 'badge', pending_approval: 'badge badge-warning', approved: 'badge badge-info',
  scheduled: 'badge badge-primary', published: 'badge badge-success', failed: 'badge badge-danger',
}

export interface SocialTabProps {
  posts: MarketingPostRow[]
  approvals: ContentApprovalRow[]
  setPosts: (posts: MarketingPostRow[]) => void
  setApprovals: (approvals: ContentApprovalRow[]) => void
  load: () => Promise<void>
}

export function SocialTab({ posts, approvals, setPosts, setApprovals, load }: SocialTabProps) {
  const [whenByPost, setWhenByPost] = useState<Record<string, string>>({})
  const [autoBusy, setAutoBusy] = useState(false)

  const schedulable = (status: string) => status === 'approved' || status === 'scheduled' || status === 'failed'

  async function handleApprove(id: string) {
    const ok = await reviewContent(id, 'approved')
    if (ok) {
      await supabase.from('marketing_posts').update({ status: 'approved' }).eq('approval_id', id)
      showToast('อนุมัติแล้ว — พร้อมตั้งเวลาเผยแพร่', 'success')
      await load()
      flashTo(`mk-aprow-${id}`)
    } else showToast('อนุมัติไม่สำเร็จ', 'error')
  }

  async function handleReject(id: string) {
    const note = window.prompt('เหตุผลที่ปฏิเสธ (บันทึกลง audit):', '') ?? ''
    const ok = await reviewContent(id, 'rejected', note)
    if (ok) {
      await supabase.from('marketing_posts').update({ status: 'draft' }).eq('approval_id', id)
      showToast('ปฏิเสธแล้ว — โพสต์กลับเป็นฉบับร่าง', 'success')
      await load()
      flashTo(`mk-aprow-${id}`)
    } else showToast('บันทึกการตัดสินใจไม่สำเร็จ', 'error')
  }

  async function handleSchedule(id: string) {
    const post = posts.find((p) => p.id === id)
    if (!post || !schedulable(post.status)) { showToast('โพสต์นี้ยังไม่ผ่านการอนุมัติ — อนุมัติก่อนตั้งเวลา', 'error'); return }
    const when = whenByPost[id]
    if (!when) { showToast('เลือกเวลาเผยแพร่ก่อน', 'error'); return }
    const r = await scheduleMarketingPost(id, new Date(when).toISOString())
    if (r.ok) {
      showToast('ตั้งเวลาเผยแพร่แล้ว (ระบบจะโพสต์อัตโนมัติเมื่อถึงเวลา)', 'success')
      await load()
      flashTo(`mk-row-${id}`)
    } else {
      const err = r.error || 'ERR_SCHEDULE_FAILED'
      showToast(err.includes('ERR_APPROVAL_REQUIRED') ? 'ตั้งเวลาไม่สำเร็จ: โพสต์นี้ยังไม่ผ่านการอนุมัติ — อนุมัติก่อนตั้งเวลา' : 'ตั้งเวลาไม่สำเร็จ: ' + err, 'error')
    }
  }

  async function handleAutoSchedule() {
    setAutoBusy(true)
    try {
      const res = await autoScheduleApprovedPosts()
      if (res.scheduled > 0) {
        const preview = res.plan.slice(0, 3).map((p) => `${p.title}: ${new Date(p.iso).toLocaleString('th-TH')}`).join(' · ')
        showToast(`AI เลือกเวลาให้ ${res.scheduled} โพสต์ (ข้าม ${res.skipped})${res.failed ? ` · ล้มเหลว ${res.failed}` : ''} — ${preview}`, 'success')
        await load()
        if (res.plan.length > 0) flashTo(`mk-row-${res.plan[0].id}`)
      } else {
        showToast(`ยังไม่มีโพสต์ที่ตั้งเวลาให้ได้ (ข้าม ${res.skipped}) — ต้องมีโพสต์ที่อนุมัติแล้วและยังไม่มีเวลา`, 'info')
      }
      if (res.failed > 0) showToast('ตั้งเวลาไม่สำเร็จบางรายการ: ' + res.errors.map((e: { error: string }) => e.error).join(', '), 'error')
    } finally { setAutoBusy(false) }
  }

  return (
    <div className="space-y-3">
      {/* Approval Queue */}
      <div className="card" data-testid="mk-approval-list">
        <h3 className="font-bold text-brand-accent mb-3">✅ กล่องอนุมัติ</h3>
        {approvals.length === 0 ? <p className="text-sm text-brand-muted">ยังไม่มีเนื้อหาในคิว — สร้างโพสต์จาก Planner/Studio</p> : (
          approvals.map((a) => {
            const linked = posts.find((p) => p.approval_id === a.id)
            return (
              <div key={a.id} className="card" data-testid={`mk-aprow-${a.id}`}>
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <div>
                    <p className="font-bold">{a.title}</p>
                    <p className="text-sm text-brand-muted">{a.body}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={STATUS_CLS[a.status] || 'badge'}>{a.status}</span>
                    {a.status === 'pending' && (
                      <>
                        <button className="btn btn-primary text-xs" onClick={() => void handleApprove(a.id)} data-testid={`mk-approve-${a.id}`}>✅ อนุมัติ</button>
                        <button className="btn btn-outline text-xs" onClick={() => void handleReject(a.id)}>✖ ปฏิเสธ</button>
                      </>
                    )}
                    {linked && <span className="badge">{linked.status}</span>}
                  </div>
                </div>
              </div>
            )
          })
        )}
      </div>

      {/* Calendar / Scheduling */}
      <div className="card" data-testid="mk-calendar">
        <h3 className="font-bold text-brand-accent mb-3">📅 ปฏิทิน / ตั้งเวลาเผยแพร่</h3>
        <div className="card flex items-center justify-between flex-wrap gap-2" data-testid="mk-auto-schedule-bar">
          <div className="text-sm text-brand-muted">
            🤖 AI เลือกเวลาจาก <b>กติกาจริงในแท็บ "⚙️ กติกา"</b> (หน้าต่างเผยแพร่ · cooldown · เพดาน/สัปดาห์)
            — เฉพาะโพสต์ที่อนุมัติแล้ว · การโพสต์จริงเป็นระบบอัตโนมัติรายชั่วโมงตัวเดิม
          </div>
          <button type="button" className="btn btn-primary text-sm" onClick={() => void handleAutoSchedule()} disabled={autoBusy} data-testid="mk-auto-schedule">
            {autoBusy ? '⏳ กำลังเลือกเวลา…' : '🤖 ให้ AI เลือกเวลาทั้งหมด'}
          </button>
        </div>
        {posts.filter((p: MarketingPostRow) => p.status !== 'published').length === 0 && <p className="text-sm text-brand-muted">ยังไม่มีโพสต์รอตั้งเวลา</p>}
        {posts.filter((p: MarketingPostRow) => p.status !== 'published').map((p: MarketingPostRow) => (
          <div key={p.id} className="card flex items-center justify-between flex-wrap gap-2" data-testid={`mk-row-${p.id}`}>
            <div>
              <p className="font-bold">{p.title}</p>
              <p className="text-xs text-brand-muted">สถานะ: <span className={STATUS_CLS[p.status] || 'badge'}>{p.status}</span>{p.scheduled_for ? ` · ตั้งไว้ ${new Date(p.scheduled_for).toLocaleString('th-TH')}` : ''}</p>
            </div>
            <div className="flex items-center gap-2">
              <input type="datetime-local" className="input text-sm" value={whenByPost[p.id] || ''} onChange={(e) => setWhenByPost((m) => ({ ...m, [p.id]: e.target.value }))} data-testid={`mk-when-${p.id}`} />
              <button className="btn btn-primary text-xs" onClick={() => void handleSchedule(p.id)} disabled={!schedulable(p.status)} title={schedulable(p.status) ? undefined : 'ยังไม่ผ่านการอนุมัติ — อนุมัติก่อนตั้งเวลา'} data-testid={`mk-schedule-${p.id}`}>⏰ ตั้งเวลา</button>
              {!schedulable(p.status) && <span className="text-xs text-brand-muted" data-testid={`mk-schedule-hint-${p.id}`}>รออนุมัติ</span>}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}