// Bite Me Baby — BiteHero (hero section หน้าแรก)
// R28 (Owner 2026-10-30): ไฟล์ถูกเขียนทับจน "ว่างเปล่า" (กู้เนื้อหาเดิมไม่ได้ — ไม่เคย commit)
// → สร้างใหม่เป็น component ใช้งานได้จริง ตามสไตล์หน้าแรก (ปุ่ม/คลาส/โทน ตาม codebase เดิม)
// ยังไม่ได้ผูกเข้า HomePage — ถ้าจะใช้: import { BiteHero } from './home/BiteHero' + วางจุด hero
import { Link } from 'react-router-dom'

export function BiteHero() {
  return (
    <section className="card text-center space-y-3 py-8" data-testid="bite-hero">
      <p className="text-sm text-brand-muted">Cloud Kitchen · จันทบุรี</p>
      <h1 className="text-3xl font-extrabold text-brand-accent">BITE ME BABY</h1>
      <p className="text-brand-muted italic">" MORE THAN DELLICIOUS "</p>
      <p className="text-sm">เปิดรับออเดอร์ทุกวัน 07:00-20:00 น. · Same-day ส่งวันนี้ · Pre-order จองล่วงหน้า</p>
      <div className="flex flex-wrap justify-center gap-3 pt-2">
        <Link className="btn btn-primary" to="/shop">สั่งอาหารเลย</Link>
        <Link className="btn btn-outline" to="/menu">ดูเมนู</Link>
      </div>
    </section>
  )
}

export default BiteHero

