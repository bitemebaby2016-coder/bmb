// ============================================
// Bite Me Baby — Admin job-queue tools (migration 126)
// ============================================
// คิวงานอัตโนมัติ (ตาราง automation_queue) — แอดมินดู/ลบได้ทีละรายการผ่าน
// คำสั่งเฉพาะสิทธิ์แอดมิน (admin_list_jobs / admin_delete_job) ไม่มีการลบ
// แบบเหมาเข่ง ทุกการลบถูกบันทึกลงบันทึกตรวจสอบ และไม่คืนเนื้อหาเต็มของงาน
// (payload อาจมีข้อมูลส่วนบุคคล)

import { supabase } from './supabase'

export interface AdminJobRow {
  id: string
  job_type: string
  worker: string
  status: string
  attempt_count: number
  max_attempts: number
  created_at: string
  failed_at: string | null
  failure_reason: string | null
  last_error: string | null
}

export type AdminJobStatus = 'queued' | 'claimed' | 'running' | 'succeeded' | 'failed' | 'dead'

export const ADMIN_JOB_STATUS_LABEL: Record<string, string> = {
  queued: 'รอคิว',
  claimed: 'กำลังหยิบงาน',
  running: 'กำลังทำงาน',
  succeeded: 'สำเร็จ',
  failed: 'ล้มเหลว (จะลองใหม่)',
  dead: 'ล้มเหลวซ้ำ — รอแอดมินตัดสินใจ',
}

const JOB_ERROR_TH: Record<string, string> = {
  ERR_NOT_AUTHENTICATED: 'ยังไม่ได้เข้าสู่ระบบ — เข้าสู่ระบบอีกครั้ง',
  ERR_FORBIDDEN: 'บัญชีนี้ไม่มีสิทธิ์จัดการคิวงาน',
  ERR_JOB_NOT_FOUND: 'ไม่พบงานนี้ในระบบ (อาจถูกลบไปแล้ว)',
  ERR_MISSING_ID: 'ระบุงานที่ต้องการลบก่อน',
}

function jobErrorText(raw: unknown): string {
  const s = String(raw ?? '')
  for (const code of Object.keys(JOB_ERROR_TH)) {
    if (s.includes(code)) return JOB_ERROR_TH[code]
  }
  return 'ทำรายการไม่สำเร็จ — ลองอีกครั้ง'
}

/** รายการงานในคิว (กรองตามสถานะได้ เช่น 'dead') */
export async function adminListJobs(status?: AdminJobStatus): Promise<{ ok: boolean; jobs: AdminJobRow[]; error?: string }> {
  const { data, error } = await supabase.rpc('admin_list_jobs', { p_status: status ?? null })
  if (error) return { ok: false, jobs: [], error: jobErrorText(error.message) }
  const res = data as unknown as { ok?: boolean; jobs?: AdminJobRow[] }
  if (!res?.ok) return { ok: false, jobs: [], error: 'โหลดคิวงานไม่สำเร็จ' }
  return { ok: true, jobs: res.jobs ?? [] }
}

/** ลบงานค้างทีละรายการ (ไม่มีแบบเหมาเข่ง) */
export async function adminDeleteJob(id: string): Promise<{ ok: boolean; error?: string }> {
  const { data, error } = await supabase.rpc('admin_delete_job', { p_id: id })
  if (error) return { ok: false, error: jobErrorText(error.message) }
  const res = data as unknown as { ok?: boolean }
  return res?.ok ? { ok: true } : { ok: false, error: 'ลบงานไม่สำเร็จ' }
}