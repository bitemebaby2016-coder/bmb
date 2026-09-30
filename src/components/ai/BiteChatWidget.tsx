// ============================================
// Bite Me Baby — น้อง Bite Chat Widget (AI-EXT Phase)
// Floating bottom-right assistant on the Public Storefront.
//   • Text chat via aiService.chatWithAI (+ live store context)
//   • Voice input via Web Speech API (webkitSpeechRecognition)
//   • Voice output via SpeechSynthesis (optional toggle)
// ============================================

import { useState, useRef, useEffect, useCallback } from 'react'
import { chatWithAI, chatWithAIStream } from '@/lib/aiService'
import { buildAiStoreContext } from '@/lib/ai/aiContextBuilder'

interface Msg { id: string; role: 'user' | 'assistant'; content: string }

type SpeechRecognitionLike = {
  lang: string
  interimResults: boolean
  continuous: boolean
  onresult: ((e: any) => void) | null
  onerror: ((e: any) => void) | null
  onend: (() => void) | null
  start: () => void
  stop: () => void
}

function createRecognition(): SpeechRecognitionLike | null {
  const w = window as any
  const Ctor = w.SpeechRecognition || w.webkitSpeechRecognition
  if (!Ctor) return null
  const r: SpeechRecognitionLike = new Ctor()
  r.lang = 'th-TH'
  r.interimResults = false
  r.continuous = false
  return r
}

export function BiteChatWidget() {
  const [open, setOpen] = useState(false)
  const [msgs, setMsgs] = useState<Msg[]>([
    { id: 'w', role: 'assistant', content: 'สวัสดีค่ะ น้อง Bite พร้อมช่วยเลือกเมนและตอบคำถามการจัดส่งค่ะ 🐶' },
  ])
  const [input, setInput] = useState('')
  const [busy, setBusy] = useState(false)
  const [listening, setListening] = useState(false)
  const [speak, setSpeak] = useState(false)
  const ctxRef = useRef<string>('')
  const endRef = useRef<HTMLDivElement>(null)
  const recogRef = useRef<SpeechRecognitionLike | null>(null)

  useEffect(() => { endRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [msgs, open])

  useEffect(() => {
    if (open && !ctxRef.current) {
      void buildAiStoreContext().then((c) => { ctxRef.current = c.rendered }).catch(() => {})
    }
  }, [open])

  const speakOut = useCallback((text: string) => {
    if (!speak || !('speechSynthesis' in window)) return
    const u = new SpeechSynthesisUtterance(text.replace(/[*_#`]/g, ' '))
    u.lang = 'th-TH'
    window.speechSynthesis.cancel()
    window.speechSynthesis.speak(u)
  }, [speak])

  const send = useCallback(async (text: string) => {
    const clean = text.trim()
    if (!clean || busy) return
    setInput('')
    setMsgs((m) => [...m, { id: `${Date.now()}-u`, role: 'user', content: clean }])
    setBusy(true)
    // AI-OPT: live typing effect — stream token deltas into a growing assistant
    // bubble instead of waiting for the whole completion.
    const replyId = `${Date.now()}-a`
    let streamed = ''
    try {
      const reply = await chatWithAIStream(clean, ctxRef.current || undefined, (delta) => {
        streamed += delta
        const snapshot = streamed
        setMsgs((m) => {
          const existing = m.find((x) => x.id === replyId)
          if (existing) return m.map((x) => (x.id === replyId ? { ...x, content: snapshot } : x))
          return [...m, { id: replyId, role: 'assistant', content: snapshot }]
        })
      })
      const final = reply || streamed
      setMsgs((m) => m.map((x) => (x.id === replyId ? { ...x, content: final } : x)))
      speakOut(final)
    } catch {
      setMsgs((m) => [...m, { id: 'err', role: 'assistant', content: 'ขอทษค่ะ เชื่อมต่อไม่สำเรจ ลองใหม่อีกครั้งนะคะ 🙏' }])
    } finally { setBusy(false) }
  }, [busy, speakOut])

  const toggleMic = useCallback(() => {
    if (listening) { recogRef.current?.stop(); setListening(false); return }
    const r = createRecognition()
    if (!r) { setMsgs((m) => [...m, { id: 'sr', role: 'assistant', content: 'เบราวเอรนี้ไม่รองรับการสั่งด้วยเสียงค่ะ (ลอง Chrome)' }]); return }
    recogRef.current = r
    r.onresult = (e: any) => {
      const t = e.results?.[0]?.[0]?.transcript ?? ''
      setListening(false)
      if (t) void send(t)
    }
    r.onerror = () => setListening(false)
    r.onend = () => setListening(false)
    try { r.start(); setListening(true) } catch { setListening(false) }
  }, [listening, send])

  return (
    <>
      {/* Floating launcher */}
      <button
        onClick={() => setOpen((o) => !o)}
        aria-label={open ? 'ปิดแชทน้อง Bite' : 'เปิดแชทน้อง Bite'}
        data-testid="bite-chat-launcher"
        className="fixed bottom-20 right-4 z-50 w-14 h-14 rounded-full bg-brand-primary text-white shadow-lg flex items-center justify-center text-2xl hover:scale-105 transition-transform no-print md:bottom-6"
      >
        {open ? '✕' : '🐶'}
      </button>

      {open && (
        <div
          data-testid="bite-chat-panel"
          className="fixed bottom-36 right-4 z-50 w-[min(360px,calc(100vw-2rem))] max-h-[70vh] bg-brand-surface border border-brand-border rounded-2xl shadow-2xl flex flex-col overflow-hidden no-print md:bottom-24"
        >
          <div className="flex items-center gap-2 px-4 py-3 bg-brand-primary text-white">
            <span aria-hidden="true">🐶</span>
            <div className="flex-1">
              <div className="text-sm font-bold">น้อง Bite</div>
              <div className="text-[11px] opacity-80">ผ้ช่วยเสิรฟประจำร้าน</div>
            </div>
            <button onClick={() => setSpeak((s) => !s)} aria-label={speak ? 'ปิดเสียงตอบ' : 'เปิดเสียงตอบ'} className={`text-lg px-1 rounded ${speak ? 'opacity-100' : 'opacity-50'}`}>🔊</button>
          </div>

          <div className="flex-1 overflow-y-auto px-3 py-2 space-y-2">
            {msgs.map((m) => (
              <div key={m.id} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                <div className={`max-w-[85%] px-3 py-2 rounded-xl text-sm whitespace-pre-wrap ${
                  m.role === 'user' ? 'bg-brand-primary text-white' : 'bg-brand-bg text-brand-primary'
                }`}>{m.content}</div>
              </div>
            ))}
            {busy && <div className="text-xs text-brand-muted px-1">น้อง Bite กำลังพิมพ…</div>}
            <div ref={endRef} />
          </div>

          <div className="flex items-center gap-1 px-2 py-2 border-t border-brand-border">
            <button onClick={toggleMic} aria-label={listening ? 'หยุดฟังเสียง' : 'พดสั่งงาน'} data-testid="bite-chat-mic"
              className={`w-9 h-9 rounded-full flex items-center justify-center text-lg border ${listening ? 'bg-red-500 text-white border-red-500 animate-pulse' : 'border-brand-border text-brand-muted'}`}>🎙️</button>
            <input value={input} onChange={(e) => setInput(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') void send(input) }}
              placeholder="ถามเมน ปรมชั่น หรือรอบจัดส่ง…" className="flex-1 bg-transparent text-sm outline-none" />
            <button onClick={() => void send(input)} disabled={busy || !input.trim()} aria-label="ส่งข้อความ"
              className="w-9 h-9 rounded-full bg-brand-primary text-white flex items-center justify-center disabled:opacity-40">➤</button>
          </div>
        </div>
      )}
    </>
  )
}
