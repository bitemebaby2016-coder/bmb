// ============================================
// Bite Me Baby — MarketingFeedSection (Home) · R38 (Owner 2026-10-31)
// "ทดสอบสร้างโพสและโต้ตอบ ดึงเข้าเว็บ" — โพสต์การตลาดที่เผยแพร่แล้ว
// ดึงขึ้นโชว์บนหน้าเว็บจริง: marketing_posts · status='published' · เรียงใหม่สุดก่อน
// อ่านไม่ได้ (ยังไม่ apply m176) / ว่าง / ผิดพลาด = ซ่อนตัวเงียบ (zero-fake ไม่โชว์ empty ปลอม)
// ============================================
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { GlassCard } from '@/components/ui/GlassCard'

interface FeedPost {
  id: string
  title: string
  body: string | null
  image_urls: string[] | null
  published_at: string | null
}

export function MarketingFeedSection() {
  const [posts, setPosts] = useState<FeedPost[]>([])
  const [ready, setReady] = useState(false)

  useEffect(() => {
    let alive = true
    void (async () => {
      try {
        const { data, error } = await supabase
          .from('marketing_posts')
          .select('id,title,body,image_urls,published_at')
          .eq('status', 'published')
          .order('published_at', { ascending: false })
          .limit(6)
        if (!alive) return
        if (!error && data && data.length > 0) setPosts(data as FeedPost[])
      } catch {
        /* เงียบ — ยังไม่มีสิทธิ์ anon (รอ apply m176) = ซ่อนตัว */
      } finally {
        if (alive) setReady(true)
      }
    })()
    return () => { alive = false }
  }, [])

  if (!ready || posts.length === 0) return null

  return (
    <section className="max-w-6xl mx-auto px-4 py-6" data-testid="marketing-feed">
      <h2 className="text-lg font-bold text-brand-accent mb-3">📣 ประกาศล่าสุดจาก BITE ME BABY</h2>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {posts.map((p) => {
          const img = Array.isArray(p.image_urls) ? p.image_urls[0] : null
          return (
            <GlassCard key={p.id} className="p-4" data-testid={`marketing-feed-${p.id}`}>
              {img && <img src={img} alt={p.title} className="w-full h-36 object-cover rounded-xl mb-2" />}
              <h3 className="font-semibold text-sm text-brand-accent">{p.title}</h3>
              {p.body && <p className="text-xs text-brand-muted mt-1 line-clamp-3">{p.body}</p>}
              {p.published_at && (
                <p className="text-xs text-brand-muted mt-2">
                  {new Date(p.published_at).toLocaleDateString('th-TH', { dateStyle: 'medium' })}
                </p>
              )}
            </GlassCard>
          )
        })}
      </div>
    </section>
  )
}