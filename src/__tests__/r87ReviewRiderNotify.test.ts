// ============================================
// Bite Me Baby — R87 (Owner 2026-11-08 · งานเพิ่ม 3 ชิ้น):
// ① ยกเลิกแล้วแจ้งเตือนลูกค้า (enqueue ถึง customer เจ้าของออเดอร์)
// ② ไรเดอร์ปิดลูปแล้วกลับมาว่าง (m197 guard + backfill — applied ลง prod แล้ว)
// ③ ระบบรีวิวทั้งเส้นทำงานจริง (เมนูลิงก์จริง · ฟอร์ม verified · ลิงก์ระบบแต้ม · ไม่มี localStorage)
// NOTE: ไฟล์ต้องเป็น `.ts` (vitest include ไม่รับ .tsx)
// ============================================
import { describe, it, expect } from 'vitest'
import notifySrc from '../lib/notifications/notificationManager.ts?raw'
import ordersSrc from '../lib/bmbAdminApi_orders.ts?raw'
import aiToolSrc from '../lib/aiToolCalling.ts?raw'
import reviewApiSrc from '../lib/reviewApi.ts?raw'
import reviewPageSrc from '../pages/ReviewPage.tsx?raw'
import menuCardSrc from '../components/FoodMenuCard.tsx?raw'
import menuPageSrc from '../pages/MenuPage.tsx?raw'
import riderMigSrc from '../../supabase/migrations/197_rider_available_after_loop.sql?raw'
import reviewMigSrc from '../../supabase/migrations/198_review_verified_rules.sql?raw'

describe('R87-① ยกเลิกออเดอร์ → แจ้งเตือนลูกค้า', () => {
  it('notificationManager ส่ง p_customer_id จาก ev.customerId (ของเดิม hardcode null)', () => {
    expect(notifySrc).toContain('p_customer_id: ev.customerId ?? null')
    expect(notifySrc).toContain('customerId?: string | null')
  })
  it('cancelOrder ยิง event ord-<num>-cancelled ถึงลูกค้าเจ้าของออเดอร์ (best-effort · ทุกเส้นทาง)', () => {
    expect(ordersSrc).toContain("import { emitNotification } from './notifications/notificationManager'")
    expect(ordersSrc).toContain('key: `ord-${result.order_number}-cancelled`')
    expect(ordersSrc).toContain('customerId: row.customer_id')
    expect(ordersSrc).toContain('if (result.success) {')
  })
})

describe('R87-② ไรเดอร์: ปิดลูปแล้วต้องว่าง (m197 — applied แล้ว)', () => {
  it('guard นับเฉพาะงานค้างของออเดอร์ที่ยังมีชีวิต + backfill ปิดแถวค้าง + คืน available', () => {
    expect(riderMigSrc).toContain("o.status NOT IN ('cancelled', 'failed', 'delivered')")
    expect(riderMigSrc).toContain('backfill: ปิด assignment')
    expect(riderMigSrc).toContain('backfill: คืน')
    expect(riderMigSrc).toContain("SET status = 'available', updated_at = NOW()")
  })
})

describe('R87-③ ระบบรีวิวทั้งเส้น = จริง ไม่มีม็อก/เพลสโฮลเดอร์/ฮาร์ดโค้ด', () => {
  it('reviewApi: localStorage ชั้นเก่าถูกลบหมด — เส้นจริง = ตาราง reviews + RPC m099', () => {
    expect(reviewApiSrc).not.toContain('bmb_reviews')
    expect(reviewApiSrc).not.toContain('storageGet')
    expect(reviewApiSrc).toContain("rpc('submit_verified_review'")
  })
  it('AI tool get_reviews อ่านตาราง reviews จริง (เดิม = localStorage = คำตอบปลอม)', () => {
    expect(aiToolSrc).toContain('getVerifiedReviewsByProduct(args.product_id)')
    expect(aiToolSrc).not.toContain('getAverageRating(')
  })
  it('ReviewPage: ฟอร์มจริงผูกออเดอร์ delivered ของตัวเอง + ลิงก์ระบบแต้ม /rewards', () => {
    expect(reviewPageSrc).toContain("data-testid='review-write-form'")
    expect(reviewPageSrc).toContain("to='/rewards'")
    expect(reviewPageSrc).toContain("o.status === 'delivered'")
    expect(reviewPageSrc).toContain('submitVerifiedReview({')
    expect(reviewPageSrc).toContain('getOrdersByCustomer(customer.id)')
    expect(reviewPageSrc).toContain("data-testid='review-submit'")
  })
  it('เมนู: การ์ดมีลิงก์เขียนรีวิวจริงไป /reviews/<id> + คะแนทรีวิวจริงจาก MenuPage', () => {
    expect(menuCardSrc).toContain('to={`/reviews/${product.id}`}')
    expect(menuCardSrc).toContain('data-testid={`write-review-${product.id}`}')
    expect(menuPageSrc).toContain('getVerifiedReviewsForProducts(')
    expect(menuPageSrc).toContain('reviewSummary={reviewSummaryById[product.id]}')
  })
  it('m198 (applied): verified = ได้รับของแล้วจริง (delivered) + 1 ออเดอร์/1 รีวิวต่อเมนู', () => {
    expect(reviewMigSrc).toContain('ERR_REVIEW_ORDER_NOT_DELIVERED')
    expect(reviewMigSrc).toContain('ERR_REVIEW_ALREADY_EXISTS')
  })
})
