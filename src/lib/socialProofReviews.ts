// ============================================
// Bite Me Baby — Social Proof Review Feed (curated)
// "รีวิวจริงจาก Facebook / GrabFood" — แสดงผลบน HomePage
// @see docs/COMPONENT_SPEC_UI.md §12 CustomerReviewCard + Glassmorphism Spec
// ============================================

import type { SocialProofReview, MenuHighlightClip } from '@/types'

/**
 * รายการ Social Proof ทั้งหมด (Admin curate ผ่านไฟล์นี้ได้โดยตรง)
 * productId ต้องตรงกับ products.id จริงในฐานข้อมูล (ดู supabase-migration.sql seed)
 * - prod-1..prod-4 = Same-day Menu
 * - prod-5..prod-6 = Pre-order Menu (เมนูโหวต)
 */
export const SOCIAL_PROOF_REVIEWS: SocialProofReview[] = [
  {
    id: 'sp-001',
    customerName: 'แจน',
    rating: 5,
    comment: 'ผัดไทยกุ้งสดอร่อยมากค่ะ เส้นนุ่ม ๆ กุ้งสด ส่งถึงบ้านร้อน ๆ เลย',
    source: 'grabfood',
    sourceLabel: 'GrabFood',
    dateLabel: '1 สัปดาห์ที่แล้ว',
    foodName: 'ผัดไทยกุ้งสด',
    productId: 'prod-1',
  },
  {
    id: 'sp-002',
    customerName: 'พี่ตู่',
    rating: 5,
    comment: 'ข้าวหมูทอดกระเทียมหอมมาก กระเทียมกรุบ ๆ ฟีลมาก เหมาะกับมื้อเที่ยงสุด ๆ',
    source: 'facebook',
    sourceLabel: 'Facebook',
    dateLabel: '2 สัปดาห์ที่แล้ว',
    foodName: 'ข้าวหมูทอดกระเทียม',
    productId: 'prod-2',
  },
  {
    id: 'sp-003',
    customerName: 'มาร์ค',
    rating: 4,
    comment: 'แกงเขียวหวานไก่เข้มข้นดี หอมกะทิ ราคาคุ้มค่า ไว้จะสั่งซ้ำครับ',
    source: 'facebook',
    sourceLabel: 'Facebook',
    dateLabel: '2 สัปดาห์ที่แล้ว',
    foodName: 'แกงเขียวหวานไก่',
    productId: 'prod-3',
  },
  {
    id: 'sp-004',
    customerName: 'นุ้ย',
    rating: 4,
    comment: 'กาแฟเย็นหอมมันดีจริง ขวดแน่นหนาไม่หกตอนส่ง บริการดีมาก',
    source: 'grabfood',
    sourceLabel: 'GrabFood',
    dateLabel: '3 สัปดาห์ที่แล้ว',
    foodName: 'กาแฟเย็น',
    productId: 'prod-4',
  },
  {
    id: 'sp-005',
    customerName: 'เต้ย',
    rating: 5,
    comment: 'โหวตเมนูต้มยำกุ้งไปแล้ว อร่อยสมใจมาก รอรอบหน้าสั่งอีกแน่นอน',
    source: 'facebook',
    sourceLabel: 'Facebook',
    dateLabel: '1 เดือนที่แล้ว',
    foodName: 'ต้มยำกุ้งสด',
    productId: 'prod-5',
  },
  {
    id: 'sp-006',
    customerName: 'ฟ้า',
    rating: 5,
    comment: 'ผัดไทยทะเลจองล่วงหน้าได้ง่ายมาก พอวันส่งก็มาส่งตรงเวลา แนะนำเลย',
    source: 'grabfood',
    sourceLabel: 'GrabFood',
    dateLabel: '1 เดือนที่แล้ว',
    foodName: 'ผัดไทยทะเล',
    productId: 'prod-6',
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