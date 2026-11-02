// ============================================
// Bite Me Baby — Social Proof Review Feed (curated)
//
// ⚠️ CLASSIFICATION (RE-D2, Review Closure 2026-09-28):
//    ข้อมูลชุดนี้คือ MARKETING TESTIMONIALS (curated จาก Facebook/GrabFood)
//    ไม่ใช่ customer reviews จากฐานข้อมูล — ห้าม insert เข้า table `reviews`
//    ห้ามใช้คำนวณ products.rating/review_count
//    canonical customer reviews = table `reviews` (เปิดใช้ใน gate ภายหลัง)
//
// R54 (Owner 2026-11-02 feedback รอบแก้ "ภาษาเพี้ยน + รูปหาย + โลโก้สลับ"):
//    - ข้อความ/ชื่อ/วันที่ = อ่านจากสกรีนช็อตต้นฉบับทีละภาพโดยตรง
//      (public/assets/reviews/Screenshot_2026-09-17-*.jpg · หน้าเรตติ้งและรีวิว Facebook จริง)
//    - source สลับ facebook/grabfood ตามคำสั่ง Owner (โลโก้การ์ดสลับ FB ↔ Grab)
//    - image = ภาพอาหารจริงจากตาราง products (decorative พื้หลังการ์ด — ไม่ใช่เมนูที่รีวิว)
//    - foodName/productId = '' — ไม่ระบุเมนูที่สั่งในภาพ → ห้ามผูกมั่ว
//      (CTA ไม่มีสินค้า = handleReviewCta → navigate('/cart') ผ่าน guard แล้ว)
//    - เรียงใหม่ → เก่า (วันที่รีวิวจริงตามภาพ)
//
// แสดงผลบน HomePage (ReviewCarouselSection — label ระบุชัดว่า testimonial)
// @see docs/COMPONENT_SPEC_UI.md §12 CustomerReviewCard + Glassmorphism Spec
// ============================================

import type { SocialProofReview, MenuHighlightClip } from '@/types'

/**
 * รายการ Social Proof ทั้งหมด (Admin curate ผ่านไฟล์นี้ได้โดยตรง)
 * R54: ทุกแถบัดจากสกรีนช็อตจริง (อ่านภาพทีละใบ) — เพิ่มรายการใหม่ต้องมีภาพจริงอ้างอิง + image ชี้รูปอาหารจริง (products)
 */
export const SOCIAL_PROOF_REVIEWS: SocialProofReview[] = [
  {
    id: 'sp-001',
    customerName: 'ชิสากุหนุ เรนยุคุร',
    rating: 5,
    comment: 'อร่อยมากเลย วัตถุดิบอร่อย มีผักหลากหลาย',
    source: 'facebook',
    sourceLabel: 'Facebook',
    dateLabel: '25 Mar 2026',
    foodName: '',
    productId: '',
    image: 'https://ivkdfognyiwjcmrhcnwz.supabase.co/storage/v1/object/public/bmb-images/products/prod-5/image.webp',
  },
  {
    id: 'sp-002',
    customerName: 'LLLLLLLL',
    rating: 5,
    comment: 'อร่อยมาก สดมาก',
    source: 'grabfood',
    sourceLabel: 'GrabFood',
    dateLabel: '22 Mar 2026',
    foodName: '',
    productId: '',
    image: 'https://ivkdfognyiwjcmrhcnwz.supabase.co/storage/v1/object/public/bmb-images/products/prod-4/image.webp',
  },
  {
    id: 'sp-003',
    customerName: 'Da K.',
    rating: 5,
    comment: 'อร่อยมากค่ะ น้ำจิ้มแซ่บไม่ต้องคิด พิเศษรสจัดจ้านเลย',
    source: 'facebook',
    sourceLabel: 'Facebook',
    dateLabel: '20 Mar 2026',
    foodName: '',
    productId: '',
    image: 'https://ivkdfognyiwjcmrhcnwz.supabase.co/storage/v1/object/public/bmb-images/products/prod-1789607383214-t8rm95/image.webp',
  },
  {
    id: 'sp-004',
    customerName: 'Bronus P.',
    rating: 5,
    comment: 'อร่อยมากค่ะ ให้ผักมากๆ มากๆๆ',
    source: 'grabfood',
    sourceLabel: 'GrabFood',
    dateLabel: '16 Mar 2026',
    foodName: '',
    productId: '',
    image: 'https://ivkdfognyiwjcmrhcnwz.supabase.co/storage/v1/object/public/bmb-images/products/prod-1789610117076-2p5e8u/image.webp',
  },
  {
    id: 'sp-005',
    customerName: 'view p.',
    rating: 5,
    comment: 'อร่อยค่ะ สดหนุกๆ น้ำจิ้มดีมาก',
    source: 'facebook',
    sourceLabel: 'Facebook',
    dateLabel: '14 Mar 2026',
    foodName: '',
    productId: '',
    image: 'https://ivkdfognyiwjcmrhcnwz.supabase.co/storage/v1/object/public/bmb-images/products/prod-3/image.webp',
  },
  {
    id: 'sp-006',
    customerName: 'GUBGIB',
    rating: 5,
    comment: 'อร่อยมาก เนื้อดี สดมาก',
    source: 'grabfood',
    sourceLabel: 'GrabFood',
    dateLabel: '11 Mar 2026',
    foodName: '',
    productId: '',
    image: 'https://ivkdfognyiwjcmrhcnwz.supabase.co/storage/v1/object/public/bmb-images/uploads/1793068885663-Fish_ShipS.webp',
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