// ============================================
// Review Page — /reviews/:productId
//
// RE-D2 (Review Closure): canonical customer reviews = table `reviews`
// (ยังไม่เปิดใช้ — 0 rows, เปิดใน gate ภายหลังพร้อม moderation UI ตาม RE-D4)
// ห้ามมี fake write path: ไม่มีการอ้างว่า "บันทึกรีวิวสำเร็จ" ถ้าไม่เขียนลง canonical
// ============================================

import { useParams } from 'react-router-dom'

export function ReviewPage() {
  const { productId } = useParams()

  return (
    <div className="max-w-4xl mx-auto px-4 py-6">
      <h1 className="text-3xl font-bold text-brand-accent mb-6">⭐ รีวิวเมนู</h1>

      <div className="card mb-6 bg-gradient-to-r from-yellow-50 to-orange-50">
        <div className="text-brand-muted">
          {productId
            ? 'ระบบรีวิวจากลูกค้ายังไม่เปิดใช้งาน — รีวิวจากการสั่งซื้อจริงจะแสดงที่นี่เมื่อเปิดใช้'
            : 'ระบบรีวิวจากลูกค้ายังไม่เปิดใช้งาน'}
        </div>
      </div>

      {/* Marketing Testimonials (แยกจาก customer reviews — ดู HomePage carousel) */}
      <div className="card">
        <h3 className="font-bold text-brand-accent mb-2">⭐ เสียงชมจากผู้ชม</h3>
        <p className="text-sm text-brand-muted">
          เสียงชมที่ได้รับจากช่องทางต่าง ๆ (Facebook / GrabFood) — เป็นข้อมูลเพื่อการตลาด
          ไม่ใช่รีวิวจากระบบสั่งซื้อ · ดูเพิ่มเติมที่หน้าแรก
        </p>
      </div>
    </div>
  )
}