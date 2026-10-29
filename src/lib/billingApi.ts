// ============================================
// Bite Me Baby — Billing API (Master Prompt Task 2 · Billing & Tier Subscription)
// ============================================
// อ่านงวดบริการของร้านพาร์ทเนอร์จาก `billing_subscriptions` (migration 175 ·
// **ยังไม่ apply — รอ Owner สั่ง `__apply 175__`** → หน้าอ่านจะโชว์ banner โหลดไม่ได้
// จนกว่าจะ apply · ไม่มีการเดาข้อมูล)
// การคำนวณวันคงเหลือ = pure function (test ตรง ๆ ได้) · เตือนตัดงวดผ่าน LINE Notify
// = automation job ถัดไปเมื่อมี secret (ยังไม่ตั้ง — บันทึกใน changelog)
// ============================================

import { supabase } from './supabase'

export interface BillingRow {
  id: string
  tenant_id: string
  plan: string
  billing_cycle: 'monthly' | 'yearly'
  amount_baht: number
  status: 'active' | 'past_due' | 'canceled'
  current_period_start: string
  current_period_end: string
  remind_days_before: number
  channel: string
  tenants?: { name: string } | null
}

/**
 * จำนวนวันถึงวันตัดงวด (ปัดลง · ติดลบ = เกินงวดแล้ว)
 * @returns null เมื่อวันที่ไม่ใช่ตัวเลข/ว่าง (ห้ามเดา)
 */
export function daysUntilDue(iso: string | null | undefined, nowMs: number = Date.now()): number | null {
  if (!iso) return null
  const t = Date.parse(iso)
  if (!Number.isFinite(t)) return null
  const msPerDay = 24 * 60 * 60 * 1000
  return Math.floor((t - nowMs) / msPerDay)
}

/** ป้ายสถานะ+สี สำหรับ badge (pure) */
export function billingStatusBadge(status: BillingRow['status']): { label: string; cls: string } {
  switch (status) {
    case 'active':
      return { label: 'ใช้งานอยู่', cls: 'badge-success' }
    case 'past_due':
      return { label: 'เลยงวด', cls: 'badge-danger' }
    case 'canceled':
      return { label: 'ยกเลิกแล้ว', cls: 'badge-muted' }
    default:
      return { label: status, cls: 'badge-info' }
  }
}

/** โหลดงวดบริการทั้งหมด (RLS กรองฝั่ง DB: admin เห็นทุกร้าน · tenant_admin เห็นของตัวเอง) */
export async function listBillingSubscriptions(): Promise<{ rows: BillingRow[]; error: string }> {
  try {
    const { data, error } = await supabase
      .from('billing_subscriptions')
      .select('*, tenants(name)')
      .order('current_period_end', { ascending: false })
      .limit(200)
    if (error) return { rows: [], error: error.message }
    return { rows: (data || []) as BillingRow[], error: '' }
  } catch (e) {
    return { rows: [], error: String((e as Error)?.message || e) }
  }
}