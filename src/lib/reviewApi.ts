// ============================================
// Bite Me Baby — Review System (R87 · verified reviews จริงจาก DB เท่านั้น)
// ============================================
// Owner 2026-11-08: "ระบบรีวิวทั้งเส้นต้องทำงานจริง ห้ามมีม็อกอัพเพลสโฮลเดอร์ฮาร์ดโค้ด"
// → ลบชั้น localStorage เดิมทั้งหมด (getReviews/getAverageRating/createReview/... = ข้อมูลปลอม
//   ในเครื่อง) — เส้นจริง = ตาราง `reviews` (m012/m093 · RLS) + RPC `submit_verified_review` /
// `get_verified_reviews_batch` (m099) — อ่าน/เขียนผ่านเส้นนี้เท่านั้น
// ============================================

export interface Review {
  id: string
  product_id: string
  customer_id: string
  customer_name: string
  rating: number // 1-5
  comment: string
  created_at: string
  is_verified: boolean // true if from actual order
}

// R87: ฟังก์ชัน localStorage เดิมถูกลบออกทั้งหมด (ม็อก = ข้อมูลปลอมรายเครื่อง) —
// ใช้เส้น DB ด้านล่างเท่านั้น · ฟอร์มเขียนรีวิว = submitVerifiedReview (RPC m099)

// CAT-04: Verified Customer Reviews from Supabase reviews table (migration 093)
import { supabase } from './supabase'
import type { VerifiedCustomerReview } from '@/types'

export async function getVerifiedReviewsByProduct(productId: string): Promise<VerifiedCustomerReview[]> {
  const { data, error } = await supabase.from('reviews').select('*').eq('product_id', productId).order('created_at', { ascending: false })
  if (error) { console.error('[getVerifiedReviewsByProduct] Error:', error); return [] }
  return (data || []) as VerifiedCustomerReview[]
}

export async function getVerifiedReviewsForProducts(productIds: string[], limit = 100): Promise<VerifiedCustomerReview[]> {
  if (!productIds.length) return []
  try {
    const { data, error } = await supabase.rpc('get_verified_reviews_batch', { p_product_ids: productIds, p_limit: limit })
    if (!error && data) return data.slice(0, limit) as VerifiedCustomerReview[]
  } catch(e) {}
  const results: VerifiedCustomerReview[] = []
  for (const pid of productIds.slice(0, 20)) {
    // R89c (Owner 2026-11-09: "รีวิวที่อนุมัติใหม่ เปลี่ยนแทนของเก่า + อัพเดทแทนไปเรื่อย"):
    //   เดิม .order('rating') = รีวิวใหม่ rating ต่ำกว่าจะหลุดจาก top-10 ของสินค้า → เปลี่ยนเป็นใหม่สุดก่อน
    const res = await supabase.from('reviews').select('*').eq('product_id', pid).order('created_at', { ascending: false }).limit(10)
    if (res.error) {
      // AI-FIX: 401/403 = ยังไม่มีสิทธิ์อ่าน (grant/policy ยังไม่ apply) — หยุดทันที
      // ไม่สแปมยิงทีละสินค้าจน Console เต็ม error
      if (res.error.code === '401' || res.error.code === '403' || res.error.code === 'PGRST301' || res.error.code === '42501') {
        console.warn('[getVerifiedReviewsForProducts] reviews read forbidden — skipping remaining lookups')
        break
      }
      continue
    }
    if (res.data) results.push(...(res.data as VerifiedCustomerReview[]))
  }
  return results.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()).slice(0, limit)
}

export async function submitVerifiedReview(params: { order_number: string; product_id: string; rating: number; comment: string; branch_id?: string }): Promise<{ success: boolean; reviewId?: string; error?: string }> {
  // D7 fix (R88 · 2026-11-08 ~21:30 — PGRST202 "Could not find the function ... (comment, order_number, ...)"):
  // PostgREST จับคู่ RPC ตาม "ชื่อ parameter จริงใน DB" = p_ prefix (probe6: signature จริง =
  // p_order_number, p_product_id, p_rating, p_comment, p_branch_id DEFAULT NULL) — เดิมส่งชื่อเปล่า
  // → resolve ไม่เจอ → ต้องแมปชื่อก่อนยิง
  const { data, error } = await supabase.rpc('submit_verified_review', {
    p_order_number: params.order_number,
    p_product_id: params.product_id,
    p_rating: params.rating,
    p_comment: params.comment,
    ...(params.branch_id ? { p_branch_id: params.branch_id } : {}), // DEFAULT NULL = ไม่ส่งก็ได้
  })
  if (error) return { success: false, error: error.message }
  return { success: true, reviewId: data?.review_id }
}

// R88 (D6a/D6b): โหลดฟีดรีวิวให้ "หน้ารวม /reviews" (ไม่มี productId) และหน้าเมนู (มี productId)
// — ต่างจาก getVerifiedReviewsByProduct ตรงที่ "โยน error ให้ caller" (R21d: โหลดล้มเหลว
// ต้องฟ้อง ≠ โชว์ empty state ปลอม) · RLS ฝั่ง DB คัดให้เอง: approved ทั้งหมด + ของตัวเอง
export async function loadReviewsFeed(productId?: string, limit = 100): Promise<VerifiedCustomerReview[]> {
  let query = supabase.from('reviews').select('*')
  if (productId) query = query.eq('product_id', productId)
  const { data, error } = await query.order('created_at', { ascending: false }).limit(limit)
  if (error) {
    console.error('[loadReviewsFeed] Error:', error)
    throw new Error(error.message)
  }
  return (data || []) as VerifiedCustomerReview[]
}
