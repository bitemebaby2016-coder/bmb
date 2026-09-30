// ============================================
// Bite Me Baby — Admin AI Content Studio (AI-EXT Phase)
// Generates promo captions from LIVE store data:
//   a) Branch best-sellers  (products.is_featured)
//   b) Admin Portfolio      (M094 admin_portfolio_items)
//   c) Verified Reviews     (M093 reviews)
// Quick templates + One-Click Copy. Optional AI polish via chatWithAI.
// ============================================

import { useState, useEffect, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import { chatWithAI } from '@/lib/aiService'
import { showToast } from '@/components/ui/ToastContainer'

interface GenItem { id: string; text: string; label: string }

const TEMPLATES = [
  { key: 'daily', label: '☀️ แคปชันเปิดร้านประจำวัน' },
  { key: 'bestseller', label: '🔥 โปรโมตเมนูขายดี' },
  { key: 'portfolio', label: '📸 แคปชันอัลบั้มผลงาน' },
]

export function AdminAiStudio() {
  const [bestSellers, setBestSellers] = useState<any[]>([])
  const [portfolio, setPortfolio] = useState<any[]>([])
  const [reviews, setReviews] = useState<any[]>([])
  const [items, setItems] = useState<GenItem[]>([])
  const [busy, setBusy] = useState<string | null>(null)

  useEffect(() => {
    void (async () => {
      const [p, pf, rv] = await Promise.all([
        supabase.from('products').select('name,price,description').eq('is_featured', true).eq('is_available', true).order('sort_order').limit(5),
        supabase.from('admin_portfolio_items').select('title,description,image_url').eq('is_active', true).order('display_order').limit(5),
        supabase.from('reviews').select('rating,comment,product_id,order_number').gte('rating', 4).order('created_at', { ascending: false }).limit(5),
      ])
      if (p.data) setBestSellers(p.data as any[])
      if (pf.data) setPortfolio(pf.data as any[])
      if (rv.data) setReviews(rv.data as any[])
    })()
  }, [])

  const compose = useCallback((label: string): string => {
    const today = new Date().toLocaleDateString('th-TH', { day: 'numeric', month: 'long' })
    const top = bestSellers[0]
    const rev = reviews[0]
    const pf = portfolio[0]
    switch (label) {
      case 'daily':
        return [
          `🐶 เปิดร้านวันนี้ ${today} พร้อมส่งค่ะ!`,
          top ? `เมนูแนะนำ: ${top.name} ฿${Number(top.price).toFixed(0)}${top.description ? ` — ${top.description}` : ''}` : 'เมนูใหม่รอคุณอยู่!',
          '🛵 รอบจัดส่ง: เช้า 06-09 / เที่ยง 11-14 / เย็น 17-20 — สั่งเลยที่ลิงก์ในโปรไฟล์!',
        ].join('\n')
      case 'bestseller':
        return bestSellers.slice(0, 3).map((p, i) =>
          `${['🥇', '🥈', '🥉'][i]} ${p.name} ฿${Number(p.price).toFixed(0)}${p.description ? ` — ${p.description}` : ''}`
        ).concat(['', 'ยอดขายอันดับต้นประจำสาขา! สั่งก่อน cutoff รอบล่าสุดได้เลย 🛵']).join('\n')
      case 'portfolio':
        return [
          `✨ ผลงานล่าสุดจากครัวเรา${pf ? ` — ${pf.title}` : ''}`,
          pf?.description ?? 'ทุกจานคือความตั้งใจของทีมครัว Bite Me Baby',
          rev ? `ฟีดแบ็คจริงจากลูกค้า: "${rev.comment ?? ''}" ⭐${rev.rating}/5` : 'ขอบคุณลูกค้าทุกท่านที่ไว้ใจเรา 💛',
        ].join('\n')
      default:
        return ''
    }
  }, [bestSellers, portfolio, reviews])

  const generate = useCallback(async (label: string) => {
    setBusy(label)
    const local = compose(label)
    let text = local
    try {
      const polished = await chatWithAI(
        `ช่วยเรียบเรียงแคปชันโซเชียลมีเดียนี้ให้น่าสนใจ สั้นกระชับ ไม่เกิน 4 บรรทัด ใช้อีโมจิเล็กน้อย ภาษาไทยเป็นกันเอง ห้ามแต่งข้อมูลราคาหรือเมนูใหม่ที่ไม่มีในต้นฉบับ:\n\n${local}`
      )
      if (polished && polished.length > 10) text = polished
    } catch { /* fall back to local template */ }
    setItems((prev) => [{ id: `${Date.now()}`, text, label: TEMPLATES.find((t) => t.key === label)?.label ?? label }, ...prev.slice(0, 7)])
    setBusy(null)
  }, [compose])

  const copy = useCallback(async (text: string) => {
    try { await navigator.clipboard.writeText(text); showToast('คัดลอกแล้ว!', 'success') }
    catch { showToast('คัดลอกไม่สำเร็จ', 'error') }
  }, [])

  return (
    <div className="max-w-3xl mx-auto p-4 space-y-4" data-testid="ai-studio">
      <div>
        <h1 className="text-xl font-bold text-brand-accent">🤖 AI Content Studio</h1>
        <p className="text-sm text-brand-muted">สร้างแคปชันโปรโมตจากข้อมูลจริง: เมนูขายดี · อัลบั้มผลงาน · รีวิว verified</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
        {TEMPLATES.map((t) => (
          <button key={t.key} onClick={() => void generate(t.key)} disabled={!!busy}
            className="btn btn-outline text-sm justify-center disabled:opacity-50">
            {busy === t.key ? '⏳ กำลังสร้าง…' : t.label}
          </button>
        ))}
      </div>

      {bestSellers.length === 0 && portfolio.length === 0 && reviews.length === 0 && (
        <div className="card text-sm text-brand-muted">ยังไม่มีข้อมูลต้นทาง (สินค้า featured / ผลงาน / รีวิว) — เพิ่มข้อมูลแล้วกลับมาสร้างใหม่ได้</div>
      )}

      <div className="space-y-3">
        {items.map((it) => (
          <div key={it.id} className="card">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-semibold text-brand-muted">{it.label}</span>
              <button onClick={() => void copy(it.text)} className="btn btn-primary text-xs px-3 py-1">📋 Copy</button>
            </div>
            <pre className="text-sm whitespace-pre-wrap font-sans">{it.text}</pre>
          </div>
        ))}
      </div>
    </div>
  )
}