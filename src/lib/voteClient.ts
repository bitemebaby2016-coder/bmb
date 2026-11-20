// ============================================
// Bite Me Baby — Preorder Vote client (R53 · mirror ของ migration 208)
// --------------------------------------------
// Client-side MIRROR ของ server-authoritative ระบบโหวตจริง:
//   • `preorder_vote_status` — ผลโหวตจริงต่อเมนู + สถานะของฉัน (anon ดูผลได้)
//   • `preorder_vote_cast`   — โหวตจริง (ล็อกอินเท่านั้น · 1 เมนู/วัน ตาม policy แอดมิน)
//
// ทุกกติกาถูก validate ซ้ำฝั่งเซิร์ฟเวอร์ใน RPC — โมดูลนี้ = precheck/แสดงผลเท่านั้น ·
// เพดาน/สถานะ = แอดมินตั้งใน business_settings (vote_policy) — หน้าห้ามสัญญาแต้ม
// (ZERO-FAKE: การโหวตไม่มีแหล่งแต้มใน policy ใด ๆ — เดิมหน้าอวด "5 แต้ม" ปลอม)
// ============================================

import { supabase } from './supabase'

// ---------- types ----------

export interface VotePolicy {
  enabled: boolean
  daily_limit: number
}

export interface VoteStatus {
  policy: VotePolicy
  used_today: number
  remaining_today: number
  /** ผลโหวตจริงต่อเมนู: product_id → จำนวนโหวตรวม (จาก preorder_votes) */
  tallies: Record<string, number>
  /** เมนูที่ฉันโหวตไว้ (ว่างเมื่อไม่ได้ล็อกอิน) */
  myVotes: string[]
}

export interface VoteResult {
  ok: boolean
  productId: string
  productVotes: number
  usedToday: number
  remainingToday: number
}

export type VoteAttempt =
  | { ok: true; result: VoteResult }
  | {
      ok: false
      reason:
        | 'signed_out'
        | 'disabled'
        | 'limit'
        | 'already'
        | 'product_not_found'
        | 'product_invalid'
        | 'load_failed'
    }

function num(v: unknown, fallback: number): number {
  return typeof v === 'number' && Number.isFinite(v) ? v : fallback
}

// ---------- status ----------

/** สถานะโหวตจริงสำหรับหน้า — null = โหลดไม่ได้/รูปผิด (ห้ามเดาค่าเอง — เข้มทุก key) */
export async function fetchVoteStatus(): Promise<VoteStatus | null> {
  try {
    const { data, error } = await supabase.rpc('preorder_vote_status')
    if (error || !data) return null
    const d = data as Record<string, unknown>

    const pol = (d.policy ?? {}) as Record<string, unknown>
    if (typeof pol.enabled !== 'boolean') return null

    const tallies: Record<string, number> = {}
    if (Array.isArray(d.tallies)) {
      for (const raw of d.tallies as Record<string, unknown>[]) {
        const pid = raw?.product_id
        const votes = raw?.votes
        if (typeof pid !== 'string' || !pid.trim()) return null
        if (typeof votes !== 'number' || !Number.isFinite(votes) || votes < 0) return null
        tallies[pid] = (tallies[pid] ?? 0) + votes
      }
    } else {
      return null
    }

    const myVotes: string[] = []
    if (Array.isArray(d.my_votes)) {
      for (const raw of d.my_votes) {
        if (typeof raw !== 'string' || !raw.trim()) return null
        myVotes.push(raw)
      }
    } else {
      return null
    }

    return {
      policy: { enabled: pol.enabled, daily_limit: num(pol.daily_limit, 0) },
      used_today: num(d.used_today, 0),
      remaining_today: num(d.remaining_today, 0),
      tallies,
      myVotes,
    }
  } catch {
    return null
  }
}

// ---------- cast ----------

/** โหวตจริง — ข้อผิดพลาดแปลเป็น reason ไทย (หน้าห้ามสัญญาแต้มล่วงหน้า) */
export async function castPreorderVote(productId: string): Promise<VoteAttempt> {
  try {
    // R54 (Owner 2026-11-20 "ระบบโหวตขัดข้อง"): ผู้ใช้ไม่ได้ล็อกอิน → PostgREST กันที่
    // สิทธิ์ EXECUTE (REVOKE anon ตาม m208) ก่อนถึงตัวฟังก์ชัน → 401 body ว่าง →
    // error.message เป็นค่าว่าง ไม่มี ERR_* ให้แมป → เคยตก load_failed ("ระบบโหวตขัดข้อง")
    // ทั้งที่สาเหตุจริงคือยังไม่ล็อกอิน → เช็ค session ก่อนยิง RPC (guard ฝั่ง server คงอยู่)
    const { data: sessionData } = await supabase.auth.getSession()
    if (!sessionData?.session) return { ok: false, reason: 'signed_out' }
    const { data, error } = await supabase.rpc('preorder_vote_cast', {
      p_product_id: productId,
    })
    if (error) {
      const msg = String(error.message ?? '')
      if (msg.includes('ERR_NOT_AUTHENTICATED')) return { ok: false, reason: 'signed_out' }
      // JWT หมดอายุ/เสีย (401 ว่าง) = server ไม่รับรองตัวตน → signed_out (ล็อกอินใหม่แก้)
      if (!msg.trim() || /jwt|permission denied|not authorized/i.test(msg)) {
        return { ok: false, reason: 'signed_out' }
      }
      if (msg.includes('ERR_VOTE_DISABLED')) return { ok: false, reason: 'disabled' }
      if (msg.includes('ERR_VOTE_LIMIT')) return { ok: false, reason: 'limit' }
      if (msg.includes('ERR_VOTE_ALREADY')) return { ok: false, reason: 'already' }
      if (msg.includes('ERR_VOTE_PRODUCT_NOT_FOUND')) return { ok: false, reason: 'product_not_found' }
      if (msg.includes('ERR_VOTE_PRODUCT_INVALID')) return { ok: false, reason: 'product_invalid' }
      return { ok: false, reason: 'load_failed' }
    }
    const d = data as Partial<VoteResult> | null
    if (!d || typeof d.ok !== 'boolean' || typeof d.productVotes !== 'number') {
      return { ok: false, reason: 'load_failed' }
    }
    return { ok: true, result: d as VoteResult }
  } catch {
    return { ok: false, reason: 'load_failed' }
  }
}

/** ข้อความไทยครบทุกสถานะ (คู่สัญญา test: ไม่มี string ว่าง) */
export function describeVoteIssue(
  reason: 'signed_out' | 'disabled' | 'limit' | 'already' | 'product_not_found' | 'product_invalid' | 'load_failed',
): string {
  switch (reason) {
    case 'signed_out':
      return 'กรุณาเข้าสู่ระบบก่อนโหวตเมนูค่ะ'
    case 'disabled':
      return 'ยังไม่เปิดการโหวต — แอดมินยังไม่ได้เปิดใช้งานค่ะ'
    case 'limit':
      return 'โหวตครบจำนวนของวันนี้แล้ว — กลับมาโหวตใหม่พรุ่งนี้นะคะ'
    case 'already':
      return 'คุณโหวตเมนูนี้ไว้แล้วค่ะ'
    case 'product_not_found':
      return 'เมนูนี้ไม่พร้อมให้โหวตแล้ว — ลองเลือกเมนูอื่นค่ะ'
    case 'product_invalid':
      return 'ไม่พบเมนูที่ต้องการโหวต — กรุณาลองใหม่ค่ะ'
    case 'load_failed':
      return 'ระบบโหวตขัดข้องชั่วคราว — โหวตยังไม่ถูกบันทึก กรุณาลองใหม่อีกครั้งค่ะ'
  }
}
