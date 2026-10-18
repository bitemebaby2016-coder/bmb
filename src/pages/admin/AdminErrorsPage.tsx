// ============================================
// Bite Me Baby — Admin: ปัญหาระบบ + งานค้างในคิว
// ============================================
// ส่วนบน: ข้อผิดพลาดของระบบ (อัปเดตอัตโนมัติทุก 30 วินาที)
// ส่วนล่าง: งานอัตโนมัติที่ค้างในคิว — แอดมินดูสาเหตุและลบได้ทีละรายการ
// (ไม่มีการลบแบบเหมาเข่ง ทุกการลบถูกบันทึกลงประวัติการทำงาน)

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { GlassCard } from '@/components/ui/GlassCard'
import { showToast } from '@/components/ui/ToastContainer'
import { adminListJobs, adminDeleteJob, ADMIN_JOB_STATUS_LABEL, type AdminJobRow } from '@/lib/adminJobsApi'

interface SystemErrorRow {
  id: string
  source: string
  level: string
  message: string
  created_at: string
}

const LEVEL_COLOR: Record<string, string> = {
  info: 'bg-sky-100 text-sky-700',
  warning: 'bg-amber-100 text-amber-700',
  error: 'bg-rose-100 text-rose-700',
  critical: 'bg-red-600 text-white',
}

const LEVEL_LABEL: Record<string, string> = {
  info: 'ข้อมูล',
  warning: 'คำเตือน',
  error: 'ข้อผิดพลาด',
  critical: 'วิกฤต',
}

const JOB_STATUS_COLOR: Record<string, string> = {
  queued: 'bg-sky-100 text-sky-700',
  claimed: 'bg-indigo-100 text-indigo-700',
  running: 'bg-indigo-100 text-indigo-700',
  succeeded: 'bg-green-100 text-green-700',
  failed: 'bg-amber-100 text-amber-700',
  dead: 'bg-rose-100 text-rose-700',
}

export function AdminErrorsPage() {
  const [errors, setErrors] = useState<SystemErrorRow[]>([])
  const [loading, setLoading] = useState(true)
  const [jobs, setJobs] = useState<AdminJobRow[]>([])
  const [jobsLoading, setJobsLoading] = useState(true)
  const [deleting, setDeleting] = useState<string | null>(null)

  async function refresh() {
    setLoading(true)
    const { data, error } = await supabase.rpc('list_system_errors', { p_limit: 60 })
    if (!error && data) setErrors((data as unknown as { errors: SystemErrorRow[] }).errors ?? [])
    setLoading(false)
  }

  async function refreshJobs() {
    setJobsLoading(true)
    const res = await adminListJobs()
    if (res.ok) setJobs(res.jobs)
    else showToast(res.error ?? 'โหลดคิวงานไม่สำเร็จ', 'error')
    setJobsLoading(false)
  }

  useEffect(() => {
    void refresh()
    void refreshJobs()
    const t = setInterval(() => void refresh(), 30000)
    return () => clearInterval(t)
  }, [])

  async function handleDeleteJob(job: AdminJobRow) {
    if (!window.confirm(`ลบงาน "${job.job_type}" (สถานะ: ${ADMIN_JOB_STATUS_LABEL[job.status] || job.status}) ออกจากคิว?`)) return
    setDeleting(job.id)
    const res = await adminDeleteJob(job.id)
    setDeleting(null)
    if (res.ok) {
      showToast('ลบงานออกจากคิวแล้ว — บันทึกลงประวัติการทำงานเรียบร้อย', 'success')
      void refreshJobs()
    } else {
      showToast(res.error ?? 'ลบงานไม่สำเร็จ', 'error')
    }
  }

  return (
    <div className="max-w-4xl mx-auto px-4 py-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-brand-accent">🛠️ ปัญหาระบบและงานค้าง</h1>
        <button className="btn btn-outline text-sm" onClick={() => void refresh()} disabled={loading}>
          {loading ? 'โหลด…' : '🔄 รีเฟรช'}
        </button>
      </div>

      <section>
        <h2 className="font-bold text-brand-accent mb-2">ข้อผิดพลาดของระบบ</h2>
        {errors.length === 0 && <GlassCard className="p-5 text-center text-slate-400">ไม่มีข้อผิดพลาดล่าสุด ✅</GlassCard>}
        <div className="space-y-2">
          {errors.map((e) => (
            <GlassCard key={e.id} className="p-3">
              <div className="flex items-center gap-2 mb-1">
                <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${LEVEL_COLOR[e.level] || 'bg-slate-100 text-slate-600'}`}>{LEVEL_LABEL[e.level] || e.level}</span>
                <span className="text-[10px] text-slate-400">{e.source}</span>
                <span className="text-[10px] text-slate-400 ml-auto">{new Date(e.created_at).toLocaleString('th-TH')}</span>
              </div>
              <p className="text-sm text-slate-700">{e.message}</p>
            </GlassCard>
          ))}
        </div>
      </section>

      <section>
        <div className="flex items-center justify-between mb-2">
          <h2 className="font-bold text-brand-accent">งานอัตโนมัติที่ค้างในคิว</h2>
          <button className="btn btn-outline text-sm" onClick={() => void refreshJobs()} disabled={jobsLoading}>
            {jobsLoading ? 'โหลด…' : '🔄 รีเฟรช'}
          </button>
        </div>
        <p className="text-xs text-brand-muted mb-2">
          งานที่ล้มเหลวซ้ำจะถูกพักไว้ที่นี่ — ตรวจสอบสาเหตุจากรายการด้านล่าง แล้วลบได้<strong>ทีละรายการ</strong> (ทุกการลบถูกบันทึกลงประวัติการทำงาน ไม่มีการลบแบบเหมาเข่ง)
        </p>
        {jobsLoading && <GlassCard className="p-5 text-center text-slate-400">กำลังโหลดคิวงาน…</GlassCard>}
        {!jobsLoading && jobs.length === 0 && (
          <GlassCard className="p-5 text-center text-slate-400">ไม่มีงานค้างในคิว ✅</GlassCard>
        )}
        <div className="space-y-2">
          {jobs.map((j) => (
            <GlassCard key={j.id} className="p-3">
              <div className="flex items-center gap-2 mb-1">
                <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${JOB_STATUS_COLOR[j.status] || 'bg-slate-100 text-slate-600'}`}>
                  {ADMIN_JOB_STATUS_LABEL[j.status] || j.status}
                </span>
                <span className="text-sm font-medium text-slate-800">{j.job_type}</span>
                <span className="text-[10px] text-slate-400">ลองแล้ว {j.attempt_count}/{j.max_attempts} ครั้ง</span>
                <span className="text-[10px] text-slate-400 ml-auto">{new Date(j.created_at).toLocaleString('th-TH')}</span>
              </div>
              {(j.failure_reason || j.last_error) && (
                <p className="text-xs text-slate-500 mb-1">สาเหตุ: {j.failure_reason || j.last_error}</p>
              )}
              <div className="flex justify-end">
                <button
                  onClick={() => void handleDeleteJob(j)}
                  disabled={deleting === j.id}
                  className="btn btn-danger text-xs disabled:opacity-50"
                >
                  {deleting === j.id ? 'กำลังลบ…' : '🗑 ลบงานนี้'}
                </button>
              </div>
            </GlassCard>
          ))}
        </div>
      </section>
    </div>
  )
}