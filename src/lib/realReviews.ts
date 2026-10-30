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

// R34: รายชื่อ = ไฟล์จริงบนดิสก์ 32 ใบ (review-01..24 + review-30..37 — 25–29 ไม่มี)
// ห้าม rig จำนวนเอง → รูปผี 404 (กัน regression ด้วย test เทียบ readdir)
const REVIEW_NUMBERS: number[] = [
  ...Array.from({ length: 24 }, (_, i) => i + 1),
  ...Array.from({ length: 8 }, (_, i) => i + 30),
]

export const REAL_REVIEW_PHOTOS: RealReviewPhoto[] = REVIEW_NUMBERS.map((n) => {
  const s = String(n).padStart(2, '0')
  return {
    src: `/assets/reviews/small/review-${s}.jpg`,
    alt: `รีวิวจริงจากลูกค้า ภาพที่ ${n}`,
  }
})
