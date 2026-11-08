// Bite Me Baby -- Review Page (CAT-04 Enhanced)
import { useParams, Link } from 'react-router-dom'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { getVerifiedReviewsByProduct, submitVerifiedReview } from '@/lib/reviewApi'
// R87: ฟอร์มเขียนรีวิวจริง — สิทธิ์ = ออเดอร์ delivered จริงของลูกค้า (ไม่ใช่ฟอร์มปลอม)
import { getOrdersByCustomer } from '@/lib/bmbAdminApi_orders'
import { useAuthStore } from '@/store/authStore'
import { showToast } from '@/components/ui/ToastContainer'
// R21d backlog: โหลดรีวิวไม่สำเร็จต้องฟ้อง (ห้ามโชว์ "No reviews yet." ปลอม)
import { LoadErrorBanner } from '@/components/ui/LoadErrorBanner'
import type { VerifiedCustomerReview } from '@/types'
import { MascotBadge } from '@/components/MascotBadge'

export function ReviewPage() {
  const { productId } = useParams()
  const [verifiedReviews, setVerifiedReviews] = useState<VerifiedCustomerReview[]>([])
  const [portfolio, setPortfolio] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  // R21d: โหลดล้มเหลว ≠ ยังไม่มีรีวิว + key สำหรับกดลองใหม่
  const [loadError, setLoadError] = useState('')
  const [retryKey, setRetryKey] = useState(0)
  // R87 (Owner 2026-11-08: "ลูกค้าต้องไปเขียนรีวิวได้... ลิงก์จริง + ลิงก์ระบบแต้ม"):
  // ฟอร์มเขียนรีวิว — เงื่อนไขสิทธิ์จริงทั้งหมด (login + ออเดอร์ delivered ของตัวเองที่มีเมนูนี้)
  const customer = useAuthStore((s) => s.customer)
  const [rating, setRating] = useState(5)
  const [comment, setComment] = useState('')
  const [eligibleOrder, setEligibleOrder] = useState<string | null>(null)
  const [eligChecked, setEligChecked] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [submitted, setSubmitted] = useState(false)

  useEffect(() => {
    async function loadReviews() {
      if (!productId) return
      setLoadError('')
      try { setVerifiedReviews(await getVerifiedReviewsByProduct(productId)) }
      catch (e) {
        console.error('ReviewPage error:', e)
        setLoadError('โหลดรีวิวไม่สำเร็จ — ตรวจสอบการเชื่อมต่อแล้วกด "ลองใหม่"')
      }
      finally { setLoading(false) }
    }
    loadReviews()
  }, [productId, retryKey])

  // AI-CLEANUP: portfolio images come from the real Admin Portfolio (M094)
  // admin_portfolio_items — the hardcoded mock [1,2,3] list was removed.
  useEffect(() => {
    void (async () => {
      try {
        const { data } = await supabase
          .from('admin_portfolio_items')
          .select('id,title,image_url')
          .eq('is_active', true)
          .order('display_order')
          .limit(9)
        if (data) setPortfolio(data as any[])
      } catch { /* portfolio is best-effort */ }
    })()
  }, [])

  // R87: เช็กสิทธิ์รีวิวจากออเดอร์จริง — เฉพาะออเดอร์ status='delivered' ของลูกค้า
  // ที่มีเมนูนี้ในรายการ · ไม่ผ่านเงื่อนไข = ไม่มีปุ่มส่ง (ห้ามมีฟอร์มปลอมส่งได้ทุกคน)
  useEffect(() => {
    setEligChecked(false)
    setSubmitted(false)
    if (!customer?.id || !productId) { setEligibleOrder(null); setEligChecked(true); return }
    void (async () => {
      try {
        const orders = await getOrdersByCustomer(customer.id)
        const hit = orders.find(
          (o) => o.status === 'delivered' && (o.items || []).some((it) => it.product_id === productId),
        )
        setEligibleOrder(hit?.order_number ?? null)
      } catch {
        setEligibleOrder(null)
      } finally {
        setEligChecked(true)
      }
    })()
  }, [customer?.id, productId])

  // R87: ส่งรีวิวจริงผ่าน RPC submit_verified_review (m099 — server ตรวจ ownership เอง)
  async function handleSubmitReview() {
    if (!eligibleOrder || !productId || submitting) return
    setSubmitting(true)
    const r = await submitVerifiedReview({
      order_number: eligibleOrder,
      product_id: productId,
      rating,
      comment: comment.trim(),
    })
    setSubmitting(false)
    if (r.success) {
      showToast('บันทึกรีวิวแล้ว — ขอบคุณที่รีวิวจากประสบการณ์จริง ⭐', 'success')
      setSubmitted(true)
      setComment('')
      setRetryKey((n) => n + 1) // โหลดรายการรีวิวใหม่ทันที (ข้อมูลจริงจาก DB)
    } else {
      showToast('บันทึกรีวิวไม่สำเร็จ: ' + (r.error || 'ลองใหม่อีกครั้ง'), 'error')
    }
  }

  return (
    <div className='max-w-4xl mx-auto px-4 py-6'>
      <h1 className='text-3xl font-bold text-brand-accent mb-6'>Reviews</h1>

      {/* R87 (Owner 2026-11-08): ฟอร์มเขียนรีวิวจริง + ลิงก์ระบบแต้ม (Rewards)
          เงื่อนไขทั้งหมด = ข้อมูลจริง (login · ออเดอร์ delivered ของตัวเองที่มีเมนูนี้)
          ไม่มี mock: ส่งผ่าน RPC submit_verified_review เท่านั้น (m099) */}
      {productId && (
        <div className='card mb-6 border-2 border-amber-200 bg-amber-50' data-testid='review-write-form'>
          <div className='flex items-center justify-between gap-2 mb-3 flex-wrap'>
            <h2 className='font-bold text-brand-accent'>✍️ เขียนรีวิวเมนูนี้</h2>
            <Link to='/rewards' className='text-sm font-medium text-brand-primary hover:underline' data-testid='review-rewards-link'>
              🎁 ดูแต้มสะสมของฉัน (ระบบ Rewards)
            </Link>
          </div>
          {!customer ? (
            <p className='text-sm text-brand-muted' data-testid='review-need-login'>
              <Link to='/login' className='text-brand-primary underline'>เข้าสู่ระบบ</Link> ก่อนเขียนรีวิว — รีวิวผูกกับออเดอร์จริงของคุณ
            </p>
          ) : !eligChecked ? (
            <p className='text-sm text-brand-muted'>⏳ กำลังตรวจสิทธิ์รีวิวจากออเดอร์ของคุณ…</p>
          ) : !eligibleOrder ? (
            <p className='text-sm text-brand-muted' data-testid='review-no-eligible'>
              รีวิวได้เฉพาะเมนูที่คุณสั่งและได้รับแล้ว (ส่งมอบเสร็จ) — เมนูนี้ยังไม่มีออเดอร์ที่ผ่านเงื่อนไขของคุณ ·{' '}
              <Link to='/menu' className='text-brand-primary underline'>กลับไปที่เมนู</Link>
            </p>
          ) : submitted || verifiedReviews.some((r: any) => r.customer_id === customer.id) ? (
            <p className='text-sm text-emerald-700' data-testid='review-already'>
              คุณรีวิวเมนูนี้ไปแล้ว — ขอบคุณที่แชร์ประสบการณ์ ⭐
            </p>
          ) : (
            <div className='space-y-3'>
              <div className='flex items-center gap-1' data-testid='review-star-picker'>
                {[1, 2, 3, 4, 5].map((n) => (
                  <button
                    key={n}
                    type='button'
                    aria-label={`${n} ดาว`}
                    onClick={() => setRating(n)}
                    className={`text-2xl transition-transform ${n <= rating ? '' : 'opacity-30 grayscale'}`}
                    data-testid={`review-star-${n}`}
                  >
                    ⭐
                  </button>
                ))}
                <span className='text-xs text-brand-muted ml-2'>{rating} ดาว</span>
              </div>
              <textarea
                className='input w-full'
                rows={3}
                maxLength={500}
                placeholder='รสชาติ/บริการ/ความคุ้มค่า — เขียนจากประสบการณ์จริงของคุณ'
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                data-testid='review-comment'
              />
              <div className='flex items-center justify-between gap-2 flex-wrap'>
                <span className='text-xs text-brand-muted'>ยืนยันด้วยออเดอร์ {eligibleOrder.slice(0, 14)}… (verified ✓)</span>
                <button
                  type='button'
                  onClick={() => void handleSubmitReview()}
                  disabled={submitting}
                  className='btn btn-primary text-sm disabled:opacity-50'
                  data-testid='review-submit'
                >
                  {submitting ? '⏳ กำลังบันทึก…' : '✅ ส่งรีวิว'}
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      <section className='mb-10'>
        <h2 className='text-xl font-display font-bold text-emerald-700 mb-4 flex items-center gap-2'><span className='w-8 h-8 rounded-full bg-emerald-100 text-emerald-700 font-bold inline-flex items-center justify-center'>{'\u2713'}</span>Verified Customer Reviews
            <MascotBadge pose="thumbsup" size="sm" alt="น้อง Bite การันตีรีวิวจริง" className="section-float-mascot" />
        </h2>
        {loading ? <p>Loading reviews...</p> : loadError ? (
          <div className='card py-4 text-center'>
            <LoadErrorBanner message={loadError} onRetry={() => setRetryKey((n) => n + 1)} testId="review-load-error" />
          </div>
        ) : verifiedReviews.length > 0 ? verifiedReviews.map((review: any) => (
          <div key={review.id} className='card p-4 mb-3 border-l-4 border-emerald-500'>
            <div className='flex justify-between'><span className='font-medium'>{review.customer_name}</span><span>{'\\u2B50'.repeat(Math.round(review.rating))}</span></div>
            <p className='mt-2 text-sm'>{review.comment}</p>
            {review.order_number && <Link to='/orders' className='text-xs text-brand-primary mt-2 block'>Order #{review.order_number.slice(0,8)}</Link>}
            <span className='text-xs text-emerald-600 mt-1 block'>Verified Purchase {'\u2713'}</span>
          </div>)) : productId ? <div className='card bg-gray-50 text-center py-8'><p className='text-brand-muted'>No reviews yet.</p></div>
        : <div className='card bg-gray-50 text-center py-8'><p className='text-brand-muted'>No reviews yet. Waiting for real customer reviews.</p></div>}
      </section>
      <section className='mb-10'>
        {/* R50: ยุบเซ็กชั่นรีวิวของหน้าแรก + หน้านี้เป็นหัวข้อเดียวตามคำสั่ง Owner + อัลบั้มรูปจริง */}
        <h2 className='text-xl font-display font-bold text-brand-accent flex items-center gap-2 mb-2'>📸 รีวิวจริงจากลูกค้า
            <MascotBadge pose="eating" size="sm" alt="น้อง Bite รูปรีวิวจากลูกค้า" className="section-float-mascot" />
        </h2>
        <p className='text-sm text-brand-muted mb-3'>รีวิวและรูปจริงจากลูกค้าที่สั่งผ่านระบบ</p>
        {/* อัลบั้มรูปรีวิวจริง (verified reviews ที่มีรูป) — ของเดิมเก็บผ่าน reviews.photo_url */}
        {verifiedReviews.filter((rv: any) => rv.photo_url).length > 0 && (
          <div className='grid grid-cols-3 gap-3 mb-4' data-testid='review-photo-album'>
            {verifiedReviews.filter((rv: any) => rv.photo_url).map((rv: any) => (
              <a key={rv.id} href={rv.photo_url} target='_blank' rel='noreferrer' className='aspect-square rounded-lg overflow-hidden bg-gray-100'>
                <img src={rv.photo_url} alt={`รีวิวของ ${rv.customer_name}`} loading='lazy' className='w-full h-full object-cover' />
              </a>
            ))}
          </div>
        )}
        <p className='text-sm text-brand-muted'>ข้อความรีวิวจริงแสดงที่หน้าแรกหัวข้อ 📸 รีวิวจริงจากลูกค้า และรายการverified ด้านบน</p>
      </section>
      <section className='mb-10'>
        <h2 className='text-xl font-display font-bold text-brand-accent flex items-center gap-2 mb-3'>Admin Portfolio
            <MascotBadge pose="award" size="sm" alt="น้อง Bite ผลงาน" className="section-float-mascot" />
        </h2>
        {portfolio.length > 0 ? (
          <div className='grid grid-cols-3 gap-3'>
            {portfolio.map((item: any) => (
              <div key={item.id} className='aspect-square rounded-lg bg-gray-100 overflow-hidden'>
                <img src={item.image_url} alt={item.title} loading='lazy' className='w-full h-full object-cover' />
              </div>
            ))}
          </div>
        ) : (
          <div className='card bg-gray-50 text-center py-8'><p className='text-brand-muted'>ผลงานล่าสุดกำลังจะมาเร็ว ๆ นี้</p></div>
        )}
      </section>
    </div>
  )
}