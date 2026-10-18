import { Link } from 'react-router-dom'
import { SHOP_CONTACT } from '@/components/layout/Footer'

interface BlogPost {
  title: string
  excerpt: string
  date: string
  readTime: string
  emoji: string
}

const posts: BlogPost[] = [
  {
    title: '5 เคล็ดลับการเลือกวัตถุดิบคุณภาพสำหรับร้านอาหาร',
    excerpt: 'เรียนรู้วิธีเลือกวัตถุดิบที่ดีเพื่อรักษาคุณภาพอาหารและบริการลูกค้าได้ดีขึ้น...',
    date: '15 ส.ค. 2026',
    readTime: '5 นาที',
    emoji: '🥗'
  },
  {
    title: 'Cloud Kitchen คืออะไร? ทำไมถึงกำลังมาแรงในไทย',
    excerpt: 'ทำความรู้จักกับโมเดล Cloud Kitchen และแนวโน้มที่กำลังเปลี่ยนแปลงอุตสาหกรรมอาหาร...',
    date: '28 ก.ย. 2026',
    readTime: '7 นาที',
    emoji: '🏪'
  },
  {
    title: 'เมนูแนะนำประจำเดือน: ผัดไทยกุ้งสดสูตรพิเศษ',
    excerpt: 'แชร์สูตรผัดไทยกุ้งสดสุดอร่อยที่ลูกค้ารีวิวว่าน่ากินที่สุด... มาดูรายละเอียดกันเลย!',
    date: '10 ก.ย. 2026',
    readTime: '4 นาที',
    emoji: '🍜'
  },
  {
    title: 'วิธีประหยัดค่าจัดส่งกับ Bite Me Baby',
    excerpt: 'เคล็ดลับการสั่งออเดอร์ให้ได้รับสิทธิส่งฟรีและโปรโมชั่นดีๆ...',
    date: '5 ก.ย. 2026',
    readTime: '3 นาที',
    emoji: '💰'
  },
  {
    title: 'อนาคตของ AI ในอุตสาหกรรมร้านอาหาร',
    excerpt: 'AI กำลังเปลี่ยนวิธีการบริการร้านอาหารอย่างไร — จากแชทบอทจนถึงระบบแนะนำเมนูอัตโนมัติ...',
    date: '1 ต.ค. 2026',
    readTime: '6 นาที',
    emoji: '🤖'
  }
]

export function BlogPage() {
  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      <h1 className="text-3xl font-bold text-brand-accent mb-2">Blog & News</h1>
      <p className="text-brand-muted mb-8">บทความ เคล็ดลับ ข่าวสาร และโปรโมชั่นล่าสุดจาก Bite Me Baby</p>

      {/* Featured Post */}
      <div className="card mb-6 bg-gradient-to-r from-orange-50 to-yellow-50 border-2 border-orange-200">
        <div className="flex items-start gap-4">
          <span className="text-4xl">{posts[0].emoji}</span>
          <div className="flex-1">
            {/* ZERO-FAKE: บทความยังไม่มีหน้ารายละเอียด — แสดงเป็นการ์ดบทความ (ไม่ใช่ลิงก์ตาย) */}
            <h3 className="font-bold text-lg text-brand-accent">{posts[0].title}</h3>
            <p className="text-brand-muted text-sm mt-1">{posts[0].excerpt}</p>
            <div className="flex gap-4 mt-2 text-xs text-brand-muted">
              <span>{posts[0].date}</span>
              <span>|</span>
              <span>{posts[0].readTime} อ่าน</span>
            </div>
          </div>
          <span className="badge badge-primary whitespace-nowrap">Featured</span>
        </div>
      </div>

      {/* Posts Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {posts.slice(1).map((post, idx) => (
          <article key={idx} className="card">
            <div className="text-3xl mb-3">{post.emoji}</div>
            <h3 className="font-bold text-brand-accent mb-2 line-clamp-2">{post.title}</h3>
            <p className="text-sm text-brand-muted line-clamp-2 mb-3">{post.excerpt}</p>
            <div className="flex justify-between text-xs text-brand-muted">
              <span>{post.date}</span>
              <span>{post.readTime} อ่าน</span>
            </div>
          </article>
        ))}
      </div>

      {/* Follow CTA — ช่องทางติดตามจริงของร้าน (เดิม: ฟอร์ม Subscribe ปุ่มไม่มี handler = fake CTA) */}
      <div className="mt-8 card bg-gradient-to-r from-purple-50 to-pink-50 text-center">
        <h3 className="text-lg font-bold text-brand-accent mb-2">ติดตามข่าวสารจาก Bite Me Baby</h3>
        <p className="text-brand-muted mb-4">อัปเดตเมนูและโปรโมชันใหม่ผ่าน Facebook ของร้าน หรือทักถามเราได้ที่หน้าติดต่อ</p>
        <div className="flex gap-2 justify-center flex-wrap">
          <a href={SHOP_CONTACT.facebook} target="_blank" rel="noopener noreferrer" className="btn btn-primary">Facebook →</a>
          <Link to="/contact" className="btn btn-outline">หน้าติดต่อเรา</Link>
        </div>
      </div>
    </div>
  )
}