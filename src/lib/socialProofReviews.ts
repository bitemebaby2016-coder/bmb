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
//    - image = ภาพอาหารจริงจากตาราง products (พื้หลังการ์ด)
//    - R55 (Owner 2026-11-02: "รีวิวรูปหาย — ให้มีรูปให้ลิ้งกับเมนูอาหารที่มีอยู่จริง"):
//      productId/foodName ผูกกับ products จริงที่ "เป็นเจ้าของรูปใบนั้น" (ทั้ง 6 รูปพอดีกับ
//      image_url ของสินค้าจริง · ตรวจแล้ว HTTP 200 ทุกใบ — e2e/r55_review_imgs.cjs)
//      → การ์ดแสดงชื่อเมนูจริง + CTA เพิ่มเมนูนั้นเข้าตะกร้าได้ทันที
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
    // R55 รอบแก้ "ภาษาที่ก๊อปปี้มาใส่รีวิว ยังเพี้ยน" — อ่านทวนทุกภาพต้นฉบับด้วยโมเดล vision
    // (e2e/r55_vision_reviews.cjs · ครบทั้ง 24 สกรีนช็อต + 9 merchant-edit + อัลบั้ม 32 ใบ)
    // พบข้อจริง: ชื่อผู้รีวิว/ข้อความ/วันที่ หลายรายการเพี้ยนจากการอ่านรอบ R54 → แก้เป็นค่าจริง
    id: 'sp-006',
    customerName: 'GUBGIB',
    rating: 5,
    comment: 'ชอบมากกกก ดูสะอาด ตรงปก รสชาติดี ขายไม่แพงเมื่อเทียบกับปริมาณ สั่งกี่ครั้งก็ประทับใจค่ะ',
    source: 'grabfood',
    sourceLabel: 'GrabFood',
    dateLabel: '6 Apr 2026',
    foodName: 'Fish & Ships',
    productId: 'prod-1793068894506-07k8af',
    image: 'https://ivkdfognyiwjcmrhcnwz.supabase.co/storage/v1/object/public/bmb-images/uploads/1793068885663-Fish_ShipS.webp',
  },
  {
    id: 'sp-001',
    customerName: 'ชุติกาญจน์ เจริญฤทธิ์',
    rating: 5,
    comment: 'อร่อยมากเลยค่ะ จัดกล่องมาสวยงาม มีผักหลากหลาย',
    source: 'facebook',
    sourceLabel: 'Facebook',
    dateLabel: '25 Mar 2026',
    foodName: 'ลุยสวนหมู+กุ้ง',
    productId: 'prod-5',
    image: 'https://ivkdfognyiwjcmrhcnwz.supabase.co/storage/v1/object/public/bmb-images/products/prod-5/image.webp',
  },
  {
    id: 'sp-002',
    customerName: 'LLLLLLLL',
    rating: 5,
    comment: 'อร่อยมาก ตรงปก (ไข่ต้มเอง)',
    source: 'grabfood',
    sourceLabel: 'GrabFood',
    dateLabel: '22 Mar 2026',
    foodName: 'เมี่ยงหมู+กุ้ง',
    productId: 'prod-4',
    image: 'https://ivkdfognyiwjcmrhcnwz.supabase.co/storage/v1/object/public/bmb-images/products/prod-4/image.webp',
  },
  {
    id: 'sp-003',
    customerName: 'Da K.',
    rating: 5,
    comment: 'อร่อยมากค่ะน้ำจิ้มแซ่บไม่ติดหวาน ผักเยอะตรงปกสั่งเลยค่า 😋',
    source: 'facebook',
    sourceLabel: 'Facebook',
    dateLabel: '20 Mar 2026',
    foodName: 'สปาเกตตี้ผัดพริกแห้งกุ้ง',
    productId: 'prod-1789607383214-t8rm95',
    image: 'https://ivkdfognyiwjcmrhcnwz.supabase.co/storage/v1/object/public/bmb-images/products/prod-1789607383214-t8rm95/image.webp',
  },
  {
    id: 'sp-004',
    customerName: 'Bronus P.',
    rating: 5,
    comment: 'ชอบมากค่าให้ผักเยอะมากมากกก',
    source: 'grabfood',
    sourceLabel: 'GrabFood',
    dateLabel: '16 Mar 2026',
    foodName: 'ข้าวลาบอกไก่+ไข่ต้ม',
    productId: 'prod-1789610117076-2p5e8u',
    image: 'https://ivkdfognyiwjcmrhcnwz.supabase.co/storage/v1/object/public/bmb-images/products/prod-1789610117076-2p5e8u/image.webp',
  },
  {
    id: 'sp-005',
    customerName: 'view p.',
    rating: 5,
    comment: 'อร่อยค่ะ สั่งแทบทุกวัน น้ำจิ้มคือดีมาก',
    source: 'facebook',
    sourceLabel: 'Facebook',
    dateLabel: '14 Mar 2026',
    foodName: 'ปลาต้มผักกาดดองเสฉวน (ซวนช่ายหยุย)',
    productId: 'prod-3',
    image: 'https://ivkdfognyiwjcmrhcnwz.supabase.co/storage/v1/object/public/bmb-images/products/prod-3/image.webp',
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