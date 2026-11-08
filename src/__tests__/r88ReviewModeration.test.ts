// ============================================
// Bite Me Baby — R88 (D6 ทั้งเส้น · 2026-11-08):
//  ① /reviews หน้ารวมต้อง "จบโหลด + โหลดฟีดจริง" (เดิมค้าง Loading reviews... ถาวร)
//  ② moderation m199: รีวิวใหม่ = pending → แอดมินอนุมัติก่อนขึ้นเว็บ · ตอบได้ · ลบได้
//  ③ อัลบั้มรูป = รูปจริงในโปรเจกต์ (คอลัมน์ photo_url ไม่มีจริงใน schema)
//  ④ CTA หน้า track → /reviews/<product_id> ของเมนูในออเดอร์จริง
//  ⑤ หน้าแอดมิน /admin/reviews = คิวอนุมัติ (route + nav + การกระทำ 4 อย่าง)
// NOTE: ไฟล์ต้องเป็น `.ts` (vitest include ไม่รับ .tsx)
// ============================================
import { describe, it, expect } from 'vitest'
import reviewPageSrc from '../pages/ReviewPage.tsx?raw'
import reviewApiSrc from '../lib/reviewApi.ts?raw'
import trackSrc from '../pages/OrderTrackPage.tsx?raw'
import adminApiSrc from '../lib/bmbAdminApi_reviews.ts?raw'
import adminPageSrc from '../pages/admin/AdminReviews.tsx?raw'
import adminUiSrc from '../lib/adminUi.ts?raw'
import appSrc from '../App.tsx?raw'
import migSrc from '../../supabase/migrations/199_review_moderation.sql?raw'

describe('R88-① D6a: /reviews หน้ารวม (ไม่มี productId) ต้องจบโหลด + โหลดฟีดทั้งหน้า', () => {
  it('ไม่มี early-return กลางคัน — path ไม่มี productId ต้องผ่าน finally setLoading(false)', () => {
    expect(reviewPageSrc).not.toContain('if (!productId) return')
    expect(reviewPageSrc).toContain('setVerifiedReviews(await loadReviewsFeed(productId))')
    expect(reviewPageSrc).toContain('finally {')
    expect(reviewPageSrc).toContain('setLoading(false)')
  })
  it('reviewApi มี loadReviewsFeed — feed รวม/ต่อเมนู + "โยน error" ให้ LoadErrorBanner (R21d ≠ empty ปลอม)', () => {
    expect(reviewApiSrc).toContain('export async function loadReviewsFeed(')
    expect(reviewApiSrc).toContain("supabase.from('reviews').select('*')")
    expect(reviewApiSrc).toContain('throw new Error(error.message)')
    expect(reviewApiSrc).not.toContain('storageGet')
  })
  it('ฟอร์ม/กติกาเดิมของ R87 ยังอยู่ครบ (ห้ามรื้อ: eligibility delivered + RPC m099 + ลิงก์ /rewards)', () => {
    expect(reviewPageSrc).toContain("data-testid='review-write-form'")
    expect(reviewPageSrc).toContain("to='/rewards'")
    expect(reviewPageSrc).toContain("o.status === 'delivered'")
    expect(reviewPageSrc).toContain('submitVerifiedReview({')
    expect(reviewPageSrc).toContain('getOrdersByCustomer(customer.id)')
    expect(reviewPageSrc).toContain("data-testid='review-submit'")
  })
})

describe('R88-② D6b/f: หลังส่ง = คิวรออนุมัติ · รีวิวมีคำตอบจากร้านได้', () => {
  it('submit สำเร็จ = toast "คิวให้แอดมินอนุมัติ" (ไม่ใช่สัญญาขึ้นเว็บทันที) · ไม่มีของปลอมเดิม', () => {
    expect(reviewPageSrc).toContain('อยู่ในคิวให้แอดมินอนุมัติก่อนแสดงบนเว็บ')
    expect(reviewPageSrc).not.toMatch(/ส่งรีวิวสำเร็จ/)
    expect(reviewPageSrc).not.toMatch(/\+10\s*แต้ม/)
    expect(reviewPageSrc).not.toMatch(/from\('reviews'\)/)
  })
  it('badge ตัวเอง pending = บอกคิวอนุมัติ · รีวิวมีกล่องคำตอบร้าน (review.reply)', () => {
    expect(reviewPageSrc).toContain("=== 'pending'")
    expect(reviewPageSrc).toContain("{review.reply && (")
    expect(reviewPageSrc).toContain("data-testid='review-reply'")
    expect(reviewPageSrc).toContain('ร้านค้าตอบ:')
  })
})

describe('R88-③ D6c: อัลบั้มรูป = รูปจริงในโปรเจกต์ (ไม่ใช่คอลัมน์ที่ไม่มีจริง)', () => {
  it('ใช้ REAL_REVIEW_PHOTOS + เก็บ testid เดิม (uiTechnicalLabels) — เลิกกรอง reviews.photo_url', () => {
    expect(reviewPageSrc).toContain("import { REAL_REVIEW_PHOTOS } from '@/lib/realReviews'")
    expect(reviewPageSrc).toContain("data-testid='review-photo-album'")
    expect(reviewPageSrc).not.toContain('rv.photo_url')
    expect(reviewPageSrc).toContain('ยังไม่มีผลงานในอัลบั้ม')
    expect(reviewPageSrc).toContain('📸 รีวิวจริงจากลูกค้า')
  })
})

describe('R88-④ D6d: ปุ่มหน้า track → /reviews/<product_id> จริงของเมนูในออเดอร์', () => {
  it('ลิงก์ต่อรายการ = to={`/reviews/${item.product_id}`} (fallback /reviews เมื่อไม่มีรายการ)', () => {
    expect(trackSrc).toContain('to={`/reviews/${item.product_id}`}')
    expect(trackSrc).toContain('data-testid={`track-review-link-${item.product_id}`}')
    expect(trackSrc).toContain('<Link to="/reviews" className="btn btn-primary">ไปเขียนรีวิว</Link>')
  })
})

describe('R88-⑤ m199: ซ่อมดริฟต์คอลัมน์ + moderation ที่ DB', () => {
  it('คอลัมน์ที่ m093 สั่งแต่หายจริง = ถูก ADD กลับ (order_number/branch_id/product_name_display)', () => {
    expect(migSrc).toContain('ADD COLUMN IF NOT EXISTS order_number TEXT')
    expect(migSrc).toContain('ADD COLUMN IF NOT EXISTS branch_id TEXT')
    expect(migSrc).toContain('ADD COLUMN IF NOT EXISTS product_name_display TEXT')
  })
  it('status/reply + CHECK + RLS: สาธารณะเห็นเฉพาะ approved · INSERT ตรง = pending เท่านั้น · กันแก้ status เอง', () => {
    expect(migSrc).toContain("ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'pending'")
    expect(migSrc).toContain('ADD COLUMN IF NOT EXISTS reply TEXT')
    expect(migSrc).toContain("CHECK (status IN ('pending', 'approved', 'rejected'))")
    expect(migSrc).toContain("USING (status = 'approved')")
    expect(migSrc).toContain("WITH CHECK (customer_id = (auth.uid())::text AND status = 'pending')")
    expect(migSrc).toContain('DROP POLICY IF EXISTS customers_update_own_review')
  })
  it('RPC ทั้งสองตัว: batch เฉพาะ approved · submit = กติกา m198 เดิมครบ + status=pending + ชื่อเมนู', () => {
    expect(migSrc).toContain("AND r.status = 'approved'")
    expect(migSrc).toContain('ERR_REVIEW_ORDER_NOT_DELIVERED')
    expect(migSrc).toContain('ERR_REVIEW_ALREADY_EXISTS')
    expect(migSrc).toContain("p_order_number, p_branch_id, v_product_name, 'pending'")
    expect(migSrc).toContain('ERR_R88_REVIEW_COLUMNS_MISSING')
    expect(migSrc).toContain('COMMIT;')
  })
})

describe('R88-⑥ D6f: หน้าแอดมิน /admin/reviews = คิวอนุมัติ (อนุมัติ/ปัดตก/ตอบ/ลบ)', () => {
  it('route + nav มี /admin/reviews (ทั้งคู่ — menu ชี้ path ที่มีจริง)', () => {
    expect(appSrc).toContain('path="/admin/reviews"')
    expect(adminUiSrc).toContain("'/admin/reviews'")
    expect(adminUiSrc).toContain('อนุมัติรีวิว')
  })
  it('admin API ครบทั้ง 4 การกระทำ + อ่านผ่านเส้น reviews จริง', () => {
    expect(adminApiSrc).toContain('export async function getAllReviewsForAdmin(')
    expect(adminApiSrc).toContain('export async function approveReview(')
    expect(adminApiSrc).toContain('export async function rejectReview(')
    expect(adminApiSrc).toContain('export async function replyToReview(')
    expect(adminApiSrc).toContain('export async function deleteReview(')
    expect(adminApiSrc).toContain("update({ status: 'approved' })")
    expect(adminApiSrc).toContain("update({ status: 'rejected' })")
  })
  it('หน้า UI มี 4 ปุ่ม/ช่องตอบ + ยืนยันลบ + empty state + LoadErrorBanner', () => {
    expect(adminPageSrc).toContain('data-testid="admin-reviews-page"')
    expect(adminPageSrc).toContain('data-testid={`admin-review-approve-${review.id}`}')
    expect(adminPageSrc).toContain('data-testid={`admin-review-reject-${review.id}`}')
    expect(adminPageSrc).toContain('data-testid={`admin-review-delete-${review.id}`}')
    expect(adminPageSrc).toContain('data-testid={`admin-review-reply-send-${review.id}`}')
    expect(adminPageSrc).toContain('window.confirm(')
    expect(adminPageSrc).toContain('data-testid="admin-reviews-empty"')
    expect(adminPageSrc).toContain('LoadErrorBanner')
  })
})