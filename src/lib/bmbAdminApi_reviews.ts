// ============================================
// Bite Me Baby Admin API - Review Moderation (R88 · D6f · migration 199)
// คิวรีวิวของแอดมิน: เห็นทุกสถานะ (RLS is_admin) — อนุมัติ/ปัดตก/ตอบกลับ/ลบ
// หน้าลูกค้า (/reviews) อ่านเฉพาะ status='approved' (RLS) · ห้าม seed ข้อมูลปลอม
// ============================================

import { supabase } from './supabase'
import type { VerifiedCustomerReview } from '@/types'

/** รายการรีวิวทั้งหมดให้แอดมินจัดการ (ใหม่ → เก่า · เห็น pending ด้วย) */
export async function getAllReviewsForAdmin(limit = 200): Promise<VerifiedCustomerReview[]> {
  const { data, error } = await supabase
    .from('reviews')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(limit)
  if (error) { console.error('[getAllReviewsForAdmin] Error:', error); throw new Error(error.message) }
  return (data || []) as VerifiedCustomerReview[]
}

/** อนุมัติรีวิว → ขึ้นแสดงบนหน้ารวม/หน้าเมนูทันที (public RLS = approved) */
export async function approveReview(id: string): Promise<boolean> {
  const { error } = await supabase.from('reviews').update({ status: 'approved' }).eq('id', id)
  if (error) { console.error('[approveReview] Error:', error); return false }
  return true
}

/** ปัดตรกรีวิว (ไม่แสดงที่ไหน · แถวคงอยู่ให้แอดมินดูย้อนหลัง) */
export async function rejectReview(id: string): Promise<boolean> {
  const { error } = await supabase.from('reviews').update({ status: 'rejected' }).eq('id', id)
  if (error) { console.error('[rejectReview] Error:', error); return false }
  return true
}

/** ตอบกลับรีวิว (แสดงใต้รีวิวบนหน้าลูกค้าเมื่อ status=approved) */
export async function replyToReview(id: string, reply: string): Promise<boolean> {
  const { error } = await supabase
    .from('reviews')
    .update({ reply: reply.trim(), replied_at: new Date().toISOString() })
    .eq('id', id)
  if (error) { console.error('[replyToReview] Error:', error); return false }
  return true
}

/** ลบรีวิวถาวร (Owner: "ลบได้" — ยืนยันด้วย confirm ที่หน้า UI) */
export async function deleteReview(id: string): Promise<boolean> {
  const { error } = await supabase.from('reviews').delete().eq('id', id)
  if (error) { console.error('[deleteReview] Error:', error); return false }
  return true
}