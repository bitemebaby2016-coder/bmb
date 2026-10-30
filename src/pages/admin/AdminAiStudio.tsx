// ============================================
// Bite Me Baby — Admin AI Content Studio v2 (AI-OPT Phase)
// Generates promo captions from LIVE store data:
//   a) Branch best-sellers  (products.is_featured)
//   b) Admin Portfolio      (M094 admin_portfolio_items)
//   c) Verified Reviews     (M093 reviews)
// v2 additions:
//   • A/B Generation: 3 tone options (formal / friendly / promo) per template
//   • Generation History + ⭐ Favorites (persisted to localStorage)
// C7/Q5 (audit D7): mock "Schedule Queue" ถูกลบ (zero-fake) — ตั้งเวลาโพสต์จริง
//   ใช้แท็บ "📅 ปฏิทิน" ของ AdminMarketing (marketing_schedule_post)
// Quick templates + One-Click Copy. Optional AI polish via chatWithAI.
// ============================================

import { useState, useEffect, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import { chatWithAI } from '@/lib/aiService'
import { showToast } from '@/components/ui/ToastContainer'

interface GenItem { id: string; text: string; label: string; tone: string; createdAt: number; favorite: boolean }

const TEMPLATES = [
  { key: 'daily', label: '☀️ แคปชันเปิดร้านประจำวัน' },
  { key: 'bestseller', label: '🔥 โปรโมตเมนูขายดี' },
  { key: 'portfolio', label: '📸 แคปชันอัลบั้มผลงาน' },
]

// v2: A/B tone options — each generate run produces all 3 side-by-side.
const TONES = [
  { key: 'formal', label: '🏢 เป็นทางการ' },
  { key: 'friendly', label: '🤝 เพื่อนสนิท' },
  { key: 'promo', label: '🎉 โปรโมชัน' },
]

const HISTORY_KEY = 'bmb-ai-studio-history-v2'

function loadHistory(): GenItem[] {
  try { return JSON.parse(localStorage.getItem(HISTORY_KEY) || '[]') as GenItem[] } catch { return [] }
}

function saveHistory(items: GenItem[]): void {
  try { localStorage.setItem(HISTORY_KEY, JSON.stringify(items.slice(0, 50))) } catch { /* quota — ignore */ }
}

function appendToneInstruction(text: string, tone: string): string {
  switch (tone) {
    case 'formal': return `${text}\n(โทน: สุภาพ เป็นทางการ แต่อบอุ่น)`
    case 'friendly': return `${text}\n(โทน: พูดกันแบบเพื่อนสนิท ใช้คำเรียกลูกค้าแบบกันเอง)`
    case 'promo': return `${text}\n(โทน: เน้นกระตุ้นการตัดสินใจ มี CTA ชัดเจน เร่งสั่งก่อนหมดเวลา)`
    default: return text
  }
}

/** R32 (Owner): แคปชันที่ AI ขัดให้ ห้ามมี "ราคา" ที่ไม่มีในสินค้าจริง — ถ้ามี = ไม่เอา polished ใช้ต้นฉบับแทน
 *  (pure — test ได้ · จับทั้ง ฿79 / ฿ 79 / 79 บาท ที่ AI อาจแต่งขึ้น) */
export function pricesAreReal(polished: string, realPrices: Set<number>): boolean {
  // ไม่มีราคาจริงอ้างอิง = ห้ามมีราคาใด ๆ ใน polished (กัน AI แต่งลอย)
  if (realPrices.size === 0) return !/฿\s?\d+|\d+\s*บาท/.test(polished)
  const baht = polished.match(/฿\s?(\d+)/g) || []
  for (const m of baht) {
    if (!realPrices.has(Number(m.replace(/[^\d]/g, '')))) return false
  }
  const bare = polished.match(/(\d+)\s*บาท/g) || []
  for (const m of bare) {
    if (!realPrices.has(Number(m.replace(/[^\d]/g, '')))) return false
  }
  return true
}

export function AdminAiStudio() {
  const [bestSellers, setBestSellers] = useState<any[]>([])
  const [portfolio, setPortfolio] = useState<any[]>([])
  const [reviews, setReviews] = useState<any[]>([])
  const [items, setItems] = useState<GenItem[]>([])
  const [history, setHistory] = useState<GenItem[]>(loadHistory)
  const [tab, setTab] = useState<'generate' | 'history'>('generate')
  const [busy, setBusy] = useState<string | null>(null)

  useEffect(() => { setHistory(loadHistory()) }, [])

  const persist = useCallback((next: GenItem[]) => {
    setHistory(next)
    saveHistory(next)
  }, [])

  useEffect(() => {
    void (async () => {
      const [p, pf, rv] = await Promise.all([
        // R32 (Owner): ใช้ "ข้อมูลจริงจากสินค้าที่แอดมินตั้ง" เสมอ — ไม่ใช่แค่ is_featured
        // (featured ขึ้นก่อน · ไม่ครบ = เติมสินค้าที่เปิดขายปกติ → แคปชันไม่มีทางว่าง/มั่วเมนูที่ไม่มีจริง)
        supabase.from('products').select('name,price,description,is_featured').eq('is_available', true).order('is_featured', { ascending: false }).order('sort_order').limit(12),
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

  // v2: generate all 3 tone variants sequentially (chatWithAI shares one
  // module-level conversation history, so parallel calls would interleave it).
  const generate = useCallback(async (label: string) => {
    setBusy(label)
    const local = compose(label)
    const runLabel = TEMPLATES.find((t) => t.key === label)?.label ?? label
    const results: GenItem[] = []
    // R32: ชุดราคาจริงจากสินค้าที่แอดมินตั้ง — ราคาใหม่ใน polished = ฟันทิ้ง (ใช้ต้นฉบับ)
    const realPrices = new Set(bestSellers.map((p) => Number(p.price)).filter((n) => Number.isFinite(n)))
    for (const tone of TONES) {
      let text = appendToneInstruction(local, tone.key)
      try {
        const polished = await chatWithAI(
          `ช่วยเรียบเรียงแคปชันโซเชียลมีเดียนี้ให้น่าสนใจ สั้นกระชับ ไม่เกิน 4 บรรทัด ใช้อีโมจิเล็กน้อย ภาษาไทย และปรับโทนตามคำสั่งสุดท้ายในวงเล็บ ห้ามแต่งข้อมูลราคาหรือเมนูใหม่ที่ไม่มีในต้นฉบับ ห้ามเพิ่มราคาที่ไม่ปรากฏในต้นฉบับเด็ดขาด:\n\n${local}`
        )
        if (polished && polished.length > 10 && pricesAreReal(polished, realPrices)) text = polished
      } catch { /* fall back to local template */ }
      results.push({ id: `${Date.now()}-${tone.key}`, text, label: runLabel, tone: tone.key, createdAt: Date.now(), favorite: false })
    }
    setItems(results)
    persist([...results, ...history].slice(0, 50))
    setBusy(null)
  }, [compose, persist, history])

  const copy = useCallback(async (text: string) => {
    try { await navigator.clipboard.writeText(text); showToast('คัดลอกแล้ว!', 'success') }
    catch { showToast('คัดลอกไม่สำเร็จ', 'error') }
  }, [])

  const toggleFavorite = useCallback((item: GenItem) => {
    const updated = { ...item, favorite: !item.favorite }
    persist(history.map((h) => (h.id === item.id ? updated : h)))
    setItems((prev) => prev.map((it) => (it.id === item.id ? updated : it)))
    showToast(updated.favorite ? '⭐ เพิ่มรายการโปรดแล้ว' : 'ยกเลิกรายการโปรดแล้ว', 'success')
  }, [history, persist])

  const clearHistory = useCallback(() => { persist([]) }, [persist])

  const toneBadge = useCallback((tone: string) => TONES.find((t) => t.key === tone)?.label ?? tone, [])

  return (
    <div className="max-w-3xl mx-auto p-4 space-y-4" data-testid="ai-studio">
      <div>
        <h1 className="text-xl font-bold text-brand-accent">🤖 AI Content Studio</h1>
        <p className="text-sm text-brand-muted">สร้างแคปชันจากข้อมูลจริง: เมนูขายดี · อัลบั้มผลงาน · รีวิว verified — พร้อม A/B Style และประวัติ</p>
      </div>

      <div className="flex gap-2" role="tablist" aria-label="โหมดของ AI Studio">
        {([['generate', '✨ สร้าง'], ['history', '📁 ประวัติ & โปรด']] as const).map(([k, label]) => (
          <button key={k} role="tab" aria-selected={tab === k} onClick={() => setTab(k)}
            className={`btn text-sm ${tab === k ? 'btn-primary' : 'btn-outline'}`}>{label}</button>
        ))}
      </div>

      {tab === 'generate' && (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
            {TEMPLATES.map((t) => (
              <button key={t.key} onClick={() => void generate(t.key)} disabled={!!busy}
                className="btn btn-outline text-sm justify-center disabled:opacity-50">
                {busy === t.key ? '⏳ กำลังสร้าง 3 สไตล์…' : t.label}
              </button>
            ))}
          </div>

          {bestSellers.length === 0 && portfolio.length === 0 && reviews.length === 0 && (
            <div className="card text-sm text-brand-muted">ยังไม่มีข้อมูลต้นทาง (สินค้า featured / ผลงาน / รีวิว) — เพิ่มข้อมูลแล้วกลับมาสร้างใหม่ได้</div>
          )}

          <div className="space-y-4">
            {items.map((it) => (
              <div key={it.id} className="card" data-testid="ab-caption-card">
                <div className="flex items-center justify-between mb-2 gap-2">
                  <span className="text-xs font-semibold text-brand-muted truncate">{it.label} · {toneBadge(it.tone)}</span>
                  <div className="flex gap-1 shrink-0">
                    <button onClick={() => toggleFavorite(it)} aria-label="ติดดาวแคปชัน" className="btn text-xs px-2 py-1">{it.favorite ? '⭐' : '☆'}</button>
                    <button onClick={() => void copy(it.text)} className="btn btn-primary text-xs px-3 py-1">📋 Copy</button>
                  </div>
                </div>
                <pre className="text-sm whitespace-pre-wrap font-sans">{it.text}</pre>
              </div>
            ))}
          </div>
        </>
      )}
      {tab === 'history' && (
        <>
          {history.length === 0 && <div className="card text-sm text-brand-muted">ยังไม่มีประวัติการสร้าง — ไปที่แท็บ "สร้าง" เพื่อเริ่มแรก</div>}
          <div className="space-y-2">
            {history.map((h) => (
              <div key={h.id} className="card" data-testid="history-item">
                <div className="flex items-center justify-between mb-1 gap-2">
                  <span className="text-xs text-brand-muted truncate">{new Date(h.createdAt).toLocaleString('th-TH')} · {toneBadge(h.tone)}</span>
                  <div className="flex gap-1 shrink-0">
                    <button onClick={() => toggleFavorite(h)} aria-label="ติดดาว" className="btn text-xs px-2 py-1">{h.favorite ? '⭐' : '☆'}</button>
                    <button onClick={() => void copy(h.text)} className="btn text-xs px-2 py-1 btn-outline">📋</button>
                  </div>
                </div>
                <pre className="text-sm whitespace-pre-wrap font-sans">{h.text}</pre>
              </div>
            ))}
          </div>
          {history.length > 0 && <button onClick={clearHistory} className="btn btn-outline text-xs">🗑️ ล้างประวัติทั้งหมด</button>}
        </>
      )}

    </div>
  )
}
