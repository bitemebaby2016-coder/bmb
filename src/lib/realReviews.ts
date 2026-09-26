// ============================================
// Bite Me Baby — Real customer review photos (PROOF)
// รูปรีวิวจริงจากลูกค้า (Grab/Google/รูปส่วนตัว) — ย่อแล้วเก็บที่
// public/assets/reviews/small/review-NN.jpg (640px, q58 — สคริปต์
// scripts/compressReviews.ps1) ต้นฉบับเต็มอยู่ใน public/assets/reviews/
// แสดงผลโดย ReviewGallerySection (lazy — ไม่กระทบ LCP)
// ============================================

export interface RealReviewPhoto {
  src: string
  alt: string
}

export const REAL_REVIEW_PHOTOS: RealReviewPhoto[] = Array.from({ length: 37 }, (_, i) => {
  const n = String(i + 1).padStart(2, '0')
  return {
    src: `/assets/reviews/small/review-${n}.jpg`,
    alt: `รีวิวจริงจากลูกค้า ภาพที่ ${i + 1}`,
  }
})
