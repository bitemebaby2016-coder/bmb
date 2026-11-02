// ============================================
// Bite Me Baby — Social Proof Review Feed (curated)
//
// ⚠️ CLASSIFICATION (RE-D2, Review Closure 2026-09-28):
//    ข้อมูลชุดนี้คือ MARKETING TESTIMONIALS (curated จาก Facebook/GrabFood)
//    ไม่ใช่ customer reviews จากฐานข้อมูล — ห้าม insert เข้า table `reviews`
//    ห้ามใช้คำนวณ products.rating/review_count
//    canonical customer reviews = table `reviews` (เปิดใช้ใน gate ภายหลัง)
//
// N4 (Owner 2026-11-01 "ยุบรีวิว 2 เซกชั่น"):
//    - ข้อความ/ชื่อผู้รีวิว/คะแนน/วันที่ = คัดจากสกรีนช็อตรีวิวจริงในไฟล์ repo
//      (public/assets/reviews/Screenshot_2026-09-17-19-0X-*.jpg ต้นฉบับ +
//       small/review-03..06.jpg ที่แสดงบนอัลบั้มหน้าแรก)
//    - foodName/productId = '' — ไม่ทราบเมนูจากในภาพ → ห้ามผูกมั่วกับสินค้าอื่น
//      (CTA ไม่มีสินค้า = handleReviewCta → navigate('/cart') ผ่าน guard แล้ว)
//    - เรียงใหม่ → เก่า (วันที่รีวิวจริงตามภาพ)
//
// แสดงผลบน HomePage (ReviewCarouselSection — label ระบุชัดว่า testimonial)
// @see docs/COMPONENT_SPEC_UI.md §12 CustomerReviewCard + Glassmorphism Spec
// ============================================

import type { SocialProofReview, MenuHighlightClip } from '@/types'

/**
 * รายการ Social Proof ทั้งหมด (Admin curate ผ่านไฟล์นี้ได้โดยตรง)
 * N4: ทุกแถบัดมาจากสกรีนช็อตจริง — ถ้าเพิ่มรายการใหม่ต้องมีภาพจริงใน repo อ้างอิง
 */
export const SOCIAL_PROOF_REVIEWS: SocialProofReview[] = [
  {
    id: 'sp-001',
    customerName: 'ชิสากุหนุ เรนยุคุร',
    rating: 5,
    comment: 'อร่อยหลายอย่าง จัดจ้านบ้านว่างๆ มีผิวกาแฟแก',
    source: 'facebook',
    sourceLabel: 'Facebook',
    dateLabel: '25 Mar 2026',
    foodName: '',
    productId: '',
  },
  {
    id: 'sp-002',
    customerName: 'LLLLLLLL',
    rating: 5,
    comment: 'อร่อยมาก สดจริง (ไม่ใส่แป้ง)',
    source: 'facebook',
    sourceLabel: 'Facebook',
    dateLabel: '22 Mar 2026',
    foodName: '',
    productId: '',
  },
  {
    id: 'sp-003',
    customerName: 'Da K.',
    rating: 5,
    comment: 'อร่อยมากไก่ญุ่นแซ่บไม่บอกใคร ผิวเหลืองร้อนส้าย่อย',
    source: 'facebook',
    sourceLabel: 'Facebook',
    dateLabel: '20 Mar 2026',
    foodName: '',
    productId: '',
  },
  {
    id: 'sp-004',
    customerName: 'Bronus P.',
    rating: 5,
    comment: 'ขอบคุณค่ะที่ฟีดแบคให้มากๆ',
    source: 'facebook',
    sourceLabel: 'Facebook',
    dateLabel: '16 Mar 2026',
    foodName: '',
    productId: '',
  },
  {
    id: 'sp-005',
    customerName: 'view p.',
    rating: 5,
    comment: 'อร่อยค่ะ ไส้ไก่ญุ่น นุ่มจริงๆทุนา',
    source: 'facebook',
    sourceLabel: 'Facebook',
    dateLabel: '14 Mar 2026',
    foodName: '',
    productId: '',
  },
  {
    id: 'sp-006',
    customerName: 'GUBGIB',
    rating: 5,
    comment: 'อร่อยมาก เนื้อเค็ม สดจริง',
    source: 'facebook',
    sourceLabel: 'Facebook',
    dateLabel: '11 Mar 2026',
    foodName: '',
    productId: '',
  },
]

/** ดึงรายการรีวิวสำหรับ Social Proof Review Feed (HomePage) */
export function getSocialProofReviews(): SocialProofReview[] {
  return SOCIAL_PROOF_REVIEWS
}

/**
 * Short Video Policy (Performance):
 * - ห้ามใช้วิดีโอในเซกชั่นรีวิว — เพื่อรักษา LCP / Mobile Performance
 * - อนุญาตเฉพาะ "เมนู Highlight" ไม่เกิน 1-2 คลิป
 * - สตรีมแบบ Lazy ผ่าน <LazyVideo /> (IntersectionObserver) เมื่อ scroll มาถึงเท่านั้น
 * - ว่างเปล่า = ไม่แสดง video section (เริ่มต้น policy-safe)
 */
export const MENU_HIGHLIGHT_CLIPS: MenuHighlightClip[] = []