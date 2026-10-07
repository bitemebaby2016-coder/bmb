// ============================================
// Bite Me Baby — Talk to Bite (Unified AI Waiter — full screen)
// ============================================
// ONE experience with two full-screen phases:
//   - "Talk to Bite Home" (landing) — brand + mascot + 7-day greeting + a big
//     "🎙 พูดกับ Bite" CTA + quick actions + เข้าสู่ร้าน
//   - Conversation — the actual chat (header, messages, product cards, mic bar)
// The SAME component drives both phases (not two projects).
//   - mode="hero"  → landing renders inline on the app Home; the conversation
//                    becomes a full-screen layer on top.
//   - mode="overlay" (default) → the whole component is always a full-screen
//                    layer (Floating Bite, /talk-to-bite page) and starts at the
//                    landing unless initialPhase="conversation".
//
// Data & authority rules (unchanged):
//   - Menu / price / availability  → real catalog (`getProducts`, DB-backed)
//   - Order history / status        → real customer orders (`getOrdersByCustomer`, RLS-own)
//   - Free-text answers             → `chatWithAI` (ai-proxy, server-side key) with DB context
//   - Add-to-cart                   → canonical `cartStore.addItem` ONLY (mode + isolation)
// The AI never fabricates prices/products, never generates images, and never
// mutates privileged state.
// ============================================

import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuthStore } from '@/store/authStore'
import { useCartStore } from '@/store/cartStore'
import { useBiteAIStore } from '@/stores/useBiteAIStore'
import { MascotBadge } from '@/components/MascotBadge'
import { ProductCard } from './ProductCard'
import { showToast } from '@/components/ui/ToastContainer'
import { chatWithAI } from '@/lib/aiService'
import {
  getAIVoiceService,
  isSpeechRecognitionSupported,
  isSpeechSynthesisSupported,
  isVoiceReplyEnabled,
  setVoiceReplyEnabled,
  type AIVoiceService,
} from '@/lib/aiVoice'
import { getOrdersByCustomer } from '@/lib/bmbAdminApi_orders'
import { getServerStatusLabel } from '@/lib/orderVocabulary'
import { hydrateMemoryFromServer } from '@/lib/aiServerMemory'
import type { Product } from '@/types'
import {
  bitePoseForState,
  buildBiteGreeting,
  chatStatusLabel,
  getGreetingIndex,
  pickTopAvailable,
  resolveOrderAgainFromOrder,
  type DraftLine,
  type UnavailableLine,
} from '@/lib/talkToBite'
import type { OrderMode } from '@/config/platformConfig'

interface TalkToBiteProps {
  /** 'overlay' (default): always a full-screen layer. 'hero': landing inline on Home. */
  mode?: 'overlay' | 'hero'
  /** Which phase to open in ('landing' = Talk to Bite Home, 'conversation' = straight to chat). */
  initialPhase?: 'landing' | 'conversation'
  onClose?: () => void
}

type ChatMsg =
  | { kind: 'text'; id: string; role: 'user' | 'assistant'; content: string }
  | { kind: 'products'; id: string; intro: string; products: Product[] }
  | { kind: 'draft'; id: string; intro: string; draft: DraftLine[]; unavailable: UnavailableLine[]; total: number; applied: boolean }

let uid = 0
function nextId(): string {
  uid += 1
  return `ttb-${Date.now()}-${uid}`
}

const FALLBACK_GREETING =
  'สวัสดีครับ ผม Bite พนักงานเสิร์ฟของ Bite Me Baby 🍊 วันนี้อยากกินอะไรดีครับ?'

export function TalkToBite({ mode = 'overlay', initialPhase = 'landing', onClose }: TalkToBiteProps) {
  const navigate = useNavigate()
  const customer = useAuthStore((s) => s.customer)
  const biteState = useBiteAIStore((s) => s.biteState)
  const setBiteState = useBiteAIStore((s) => s.setBiteState)

  const [realm, setRealm] = useState<'landing' | 'conversation'>(initialPhase)
  const [messages, setMessages] = useState<ChatMsg[]>([])
  const [input, setInput] = useState('')
  const [typing, setTyping] = useState(false)
  const [listening, setListening] = useState(false)
  const [voiceReply, setVoiceReply] = useState(isVoiceReplyEnabled())
  const [greeting, setGreeting] = useState('')
  const micSupported = isSpeechRecognitionSupported()
  const ttsSupported = isSpeechSynthesisSupported()
  const voiceRef = useRef<AIVoiceService | null>(null)
  const endRef = useRef<HTMLDivElement>(null)
  const seededRef = useRef(false)

  // Greeting — deterministic 7-day rotation personalised ONLY with verified
  // server memory for the signed-in customer (name + favorite category); guests
  // get the same rotation without a name. Re-runs cleanly if identity loads.
  useEffect(() => {
    let active = true
    void (async () => {
      const index = getGreetingIndex()
      let text: string
      if (customer?.id) {
        const mem = await hydrateMemoryFromServer(customer.id).catch(() => null)
        if (!active) return
        text = buildBiteGreeting({
          index,
          name: mem?.name ?? customer?.name ?? null,
          favoriteCategory: mem?.favorite_categories?.[0] ?? null,
        })
      } else {
        text = buildBiteGreeting({ index })
      }
      if (!active) return
      setGreeting(text)
    })()
    return () => {
      active = false
    }
  }, [customer?.id])

  // Voice engine — the same shared singleton as the rest of Bite. Autoplay-safe:
  // subtitles/text are ALWAYS shown; voice only speaks/listens after a gesture.
  useEffect(() => {
    if (!micSupported) return
    const service = getAIVoiceService()
    voiceRef.current = service
    service.setCallbacks({
      onTranscript: (text) => setInput(text),
      onResponse: () => {},
      onError: () => setListening(false),
    })
    return () => {
      service.stopListening()
      service.stopSpeaking()
      voiceRef.current = null
    }
  }, [micSupported])

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, typing])

  const push = (msg: ChatMsg) => setMessages((prev) => [...prev, msg])

  function pushAssistant(content: string) {
    push({ kind: 'text', id: nextId(), role: 'assistant', content })
  }

  function pushUser(content: string) {
    push({ kind: 'text', id: nextId(), role: 'user', content })
  }

  function requireAuth(): boolean {
    if (customer?.id) return true
    pushAssistant('เรื่องนี้ต้องเข้าสู่ระบบก่อนนะครับ เพื่อให้ Bite จำออเดอร์เดิมของคุณได้อย่างปลอดภัย 🍊 กด "เข้าสู่ระบบ" เพื่อดำเนินการต่อ')
    setBiteState('IDLE')
    return false
  }

  // Enter the conversation (seeding the greeting once) and optionally run a flow.
  function openConversation(fn?: () => void) {
    setRealm('conversation')
    if (!seededRef.current) {
      seededRef.current = true
      setMessages([{ kind: 'text', id: nextId(), role: 'assistant', content: greeting || FALLBACK_GREETING }])
      setBiteState('WELCOME')
    }
    if (fn) fn()
  }

  function startListen() {
    const service = voiceRef.current
    if (service && service.startListening()) {
      setBiteState('LISTENING')
      setListening(true)
    } else {
      setBiteState('IDLE')
    }
  }

  async function handleRecommend() {
    setBiteState('RECOMMENDING')
    pushAssistant('เดี๋ยวครับ Bite เลือกจากเมนูจริงของวันนี้ให้เลย 🍊')
    setTyping(true)
    try {
      const { getProducts: load } = await import('@/lib/bmbAdminApi_products')
      const products = pickTopAvailable(await load(), 3)
      if (products.length === 0) {
        pushAssistant('วันนี้ยังไม่มีเมนูที่สั่งได้ครับ แนะนำลองแวะมาอีกที หรือดูที่หน้าเมนูแทนครับ 🙏')
      } else {
        push({ kind: 'products', id: nextId(), intro: 'เมนูที่ Bite แนะนำจากของจริงวันนี้ครับ:', products })
      }
      setBiteState('IDLE')
    } catch {
      pushAssistant('ขอโทษครับ ดึงเมนูไม่สำเร็จ กรุณาลองใหม่นะครับ 🙏')
      setBiteState('ERROR')
    } finally {
      setTyping(false)
    }
  }

  async function handleOrderAgain() {
    setBiteState('THINKING')
    pushAssistant('เดี๋ยวครับ Bite เช็กออเดอร์เดิมของคุณให้ก่อน…')
    if (!requireAuth()) return
    setTyping(true)
    try {
      const [orders, catalog] = await Promise.all([
        getOrdersByCustomer(customer!.id),
        (await import('@/lib/bmbAdminApi_products')).getProducts(),
      ])
      if (!orders || orders.length === 0) {
        pushAssistant('ยังไม่มีประวัติออเดอร์ที่ร้านนี้เลยครับ อยากให้ Bite แนะนำเมนูแทนไหมครับ? 🍊')
        setBiteState('IDLE')
        return
      }
      const res = resolveOrderAgainFromOrder(orders[0], catalog)
      if (res.draft.length === 0) {
        pushAssistant('ออเดอร์เดิมส่วนใหญ่หมดแล้วครับ เลยยังสั่งซ้ำไม่ได้ ขอแนะนำเมนูอื่นที่ยังมีนะครับ 🙏')
        setBiteState('IDLE')
        return
      }
      setBiteState('ORDER_DRAFT')
      push({
        kind: 'draft',
        id: nextId(),
        intro: `นี่คือรายการออเดอร์ล่าสุด #${orders[0].order_number || '-'} ที่ยังขายได้อยู่ครับ ตรวจทานแล้วกดเพิ่มลงตะกร้าได้เลย:`,
        draft: res.draft,
        unavailable: res.unavailable,
        total: res.total,
        applied: false,
      })
      if (res.unavailable.length > 0) {
        pushAssistant(`หมายเหตุ: ${res.unavailable.map((u) => `${u.name} (${u.requested})`).join(', ')} หมด/เปลี่ยนไปแล้ว จึงไม่รวมในรายการนี้ครับ`)
      }
      setBiteState('ORDER_DRAFT')
    } catch {
      pushAssistant('ขอโทษครับ อ่านออเดอร์ไม่สำเร็จ กรุณาลองใหม่นะครับ 🙏')
      setBiteState('ERROR')
    } finally {
      setTyping(false)
    }
  }

  async function handleCheckOrders() {
    setBiteState('THINKING')
    pushAssistant('เดี๋ยวครับ Bite เช็กออเดอร์ของคุณให้ก่อน…')
    if (!requireAuth()) return
    setTyping(true)
    try {
      const orders = await getOrdersByCustomer(customer!.id)
      if (!orders || orders.length === 0) {
        pushAssistant('ยังไม่มีออเดอร์ที่ร้านนี้เลยครับ อยากให้ Bite แนะนำเมนูแทนไหมครับ? 🍊')
        setBiteState('IDLE')
        return
      }
      const recent = [...orders].slice(0, 5)
      const lines = recent.map((o) => `• ${o.order_number} — ${getServerStatusLabel(String(o.status), (o.order_mode ?? 'SAME_DAY') as OrderMode)}`)
      pushAssistant(`ออเดอร์ล่าสุดของคุณ (${Math.min(orders.length, 5)}/${orders.length}) ที่ยังเข้าถึงได้:\n${lines.join('\n')}`)
      setBiteState('IDLE')
    } catch {
      pushAssistant('ขอโทษครับ อ่านสถานะออเดอร์ไม่สำเร็จครับ 🙏')
      setBiteState('ERROR')
    } finally {
      setTyping(false)
    }
  }

  function handleViewMenu() {
    navigate('/menu')
  }

  // --- Commerce actions (via the canonical cart path only) ---

  function addToCart(product: Product) {
    const mode: OrderMode = product.available_preorder && !product.available_same_day ? 'PRE_ORDER' : 'SAME_DAY'
    const res = useCartStore.getState().addItem(product, 1, {}, mode)
    if (res === 'added') {
      showToast(`เพิ่ม ${product.name} ลงตะกร้าแล้ว 🛒`)
      setBiteState('SUCCESS')
      window.setTimeout(() => setBiteState('IDLE'), 800)
    } else if (res === 'needs_confirmation') {
      showToast('มีสินค้ารอบอื่นในตะกร้า รอการยืนยันก่อนครับ', 'warning')
    } else {
      showToast('เพิ่มไม่ได้ในตอนนี้ กรุณาลองใหม่ครับ', 'warning')
    }
  }

  function confirmDraft(draft: DraftLine[]) {
    for (const line of draft) {
      const p = line.product
      const mode: OrderMode = p.available_preorder && !p.available_same_day ? 'PRE_ORDER' : 'SAME_DAY'
      useCartStore.getState().addItem(p, line.quantity, {}, mode)
    }
    setMessages((prev) => prev.map((m) => (m.kind === 'draft' ? { ...m, applied: true } : m)))
    setBiteState('SUCCESS')
    pushAssistant('เรียบร้อยครับ เอารายการออเดอร์เดิมใส่ตะกร้าแล้ว คุณสามารถตรวจและจ่ายเงินได้ที่หน้ากระเป๋า/ชำระเงินครับ 🛒 ราคาจริงยืนยันตอนชำระเงินเท่านั้นครับ')
    window.setTimeout(() => setBiteState('IDLE'), 900)
  }

  function goLogin() {
    setBiteState('IDLE')
    navigate('/login')
  }

  // --- Free-text send (real AI via chatWithAI) ---

  async function handleSend() {
    const text = input.trim()
    if (!text || typing) return
    pushUser(text)
    setInput('')
    setBiteState('THINKING')
    setTyping(true)
    voiceRef.current?.stopSpeaking()
    try {
      const reply = await chatWithAI(text, undefined, { voiceMode: voiceReply })
      setBiteState('SPEAKING')
      pushAssistant(reply)
      if (voiceReply && ttsSupported) await voiceRef.current?.speak(speakable(reply))
      setBiteState('IDLE')
    } catch {
      pushAssistant('ขอโทษครับ เกิดข้อผิดพลาดในการเชื่อมต่อ กรุณาลองใหม่อีกครั้งนะ 🙏')
      setBiteState('ERROR')
    } finally {
      setTyping(false)
    }
  }

  function toggleMic() {
    const service = voiceRef.current
    if (!service) return
    if (listening) {
      service.stopListening()
      setListening(false)
    } else if (service.startListening()) {
      setBiteState('LISTENING')
      setListening(true)
    }
  }

  function toggleVoiceReply() {
    const next = !voiceReply
    setVoiceReply(next)
    setVoiceReplyEnabled(next)
    if (!next) voiceRef.current?.stopSpeaking()
  }

  function goLanding() {
    voiceRef.current?.stopSpeaking()
    setBiteState('IDLE')
    setRealm('landing')
  }

  function handleClose() {
    voiceRef.current?.stopSpeaking()
    voiceRef.current?.stopListening()
    if (onClose) {
      onClose()
      return
    }
    if (mode === 'hero') {
      setRealm('landing')
      return
    }
    navigate('/')
  }

  const cartCount = useCartStore((s) => s.items).reduce((sum, i) => sum + i.quantity, 0)

  const liveGreeting = greeting || FALLBACK_GREETING
  // Fixed full-screen layer unless we are the inline hero landing on the Home page.
  const fixed = realm === 'conversation' || mode === 'overlay'

  // ---------------------------------------------------------------------------
  // Landing — "Talk to Bite Home"
  // ---------------------------------------------------------------------------
  const landingView = (
    <div className="flex flex-col items-center justify-center text-center px-6 py-10 gap-5">
      <p className="font-display font-bold text-2xl text-brand-accent tracking-wide">BITE ME BABY</p>
      <MascotBadge pose="greeting" size="lg" alt="Bite ทักทาย" className="animate-float" loading="eager" />
      <p className="text-lg md:text-xl text-brand-text whitespace-pre-line max-w-md" data-testid="ttb-greeting">
        “{liveGreeting}”
      </p>

      <button
        type="button"
        onClick={() => openConversation(micSupported ? startListen : undefined)}
        className="btn btn-primary text-base px-8 py-3 rounded-full gap-2"
        data-testid="ttb-talk"
      >
        🎙 พูดกับ Bite
      </button>

      <div className="flex flex-wrap items-center justify-center gap-2">
        <button type="button" onClick={() => openConversation(() => void handleOrderAgain())} data-testid="ttb-again" className="px-4 py-1.5 text-brand-accent border border-brand-border bg-white hover:bg-brand-bg rounded-full text-sm font-medium">
          🔄 สั่งเหมือนเดิม
        </button>
        <button type="button" onClick={() => openConversation(() => void handleRecommend())} data-testid="ttb-recommend" className="px-4 py-1.5 text-brand-accent border border-brand-border bg-white hover:bg-brand-bg rounded-full text-sm font-medium">
          🍊 ช่วยเลือกให้หน่อย
        </button>
        <button type="button" onClick={handleViewMenu} data-testid="ttb-menu" className="px-4 py-1.5 text-brand-accent border border-brand-border bg-white hover:bg-brand-bg rounded-full text-sm font-medium">
          🍽️ ดูเมนู
        </button>
      </div>

      <button
        type="button"
        onClick={handleViewMenu}
        className="text-brand-primary font-medium hover:underline mt-1"
        data-testid="ttb-enter-store"
      >
        เข้าสู่ร้าน →
      </button>

      {fixed && (
        <button
          type="button"
          onClick={handleClose}
          className="btn btn-outline btn-sm absolute top-4 right-4"
          aria-label="ปิด Talk to Bite"
          data-testid="ttb-close"
        >
          ✕
        </button>
      )}
    </div>
  )

  // ---------------------------------------------------------------------------
  // Conversation
  // ---------------------------------------------------------------------------
  const conversationView = (
    <div className="flex flex-col h-full max-w-3xl mx-auto w-full overflow-hidden">
      {/* Header — back to landing + identity + cart */}
      <header className="flex items-center gap-3 px-4 py-3 bg-gradient-to-r from-brand-bg to-white border-b border-brand-border shrink-0">
        <button
          type="button"
          onClick={goLanding}
          className="btn btn-outline btn-sm"
          aria-label="กลับไปหน้าแรกของ Talk to Bite"
          data-testid="ttb-back"
        >
          ←
        </button>
        <MascotBadge pose={bitePoseForState(biteState)} size="sm" alt="Bite" loading="eager" />
        <div className="flex-1 min-w-0 text-left">
          <h2 className="font-display font-bold text-brand-accent leading-tight">Talk to Bite</h2>
          <p className="text-xs text-brand-muted truncate" data-testid="ttb-status">
            {chatStatusLabel(biteState)}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold text-brand-primary bg-brand-bg rounded-full px-2 py-1" title="สินค้าในตะกร้า">
            🛒 {cartCount}
          </span>
          <button type="button" onClick={handleClose} className="btn btn-outline btn-sm" aria-label="ปิด Talk to Bite" data-testid="ttb-close-2">
            ✕
          </button>
        </div>
      </header>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3">
        {messages.map((m) => {
          if (m.kind === 'text') {
            return (
              <div key={m.id} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                <div
                  className={`max-w-[85%] rounded-2xl px-3 py-2 text-sm whitespace-pre-line ${
                    m.role === 'user'
                      ? 'bg-brand-primary text-white'
                      : 'bg-brand-bg border border-brand-border text-brand-text'
                  }`}
                >
                  {m.content}
                </div>
              </div>
            )
          }
          if (m.kind === 'products') {
            return (
              <div key={m.id} className="space-y-2">
                <p className="text-xs text-brand-muted">{m.intro}</p>
                {m.products.map((p) => (
                  <ProductCard key={p.id} product={p} onAdd={addToCart} />
                ))}
              </div>
            )
          }
          return (
            <div key={m.id} className="card bg-brand-surface p-3 space-y-2">
              <p className="text-sm text-brand-text">{m.intro}</p>
              <ul className="space-y-1">
                {m.draft.map((d) => (
                  <li key={d.product.id} className="flex items-center justify-between text-sm">
                    <span className="text-brand-text truncate">{d.quantity} × {d.product.name}</span>
                    <span className="text-brand-muted whitespace-nowrap">฿{Number(d.product.price) * d.quantity}</span>
                  </li>
                ))}
              </ul>
              <div className="flex items-center justify-between border-t border-brand-border pt-2">
                <span className="font-bold text-brand-accent">รวม (ราคาจริงปิดตอนจ่าย)</span>
                <span className="font-bold text-brand-primary">฿{m.total}</span>
              </div>
              {m.unavailable.length > 0 && (
                <p className="text-[11px] text-amber-700">หมด/มีเฉพาะออเดอร์เก่า: {m.unavailable.map((u) => u.name).join(', ')}</p>
              )}
              <button
                type="button"
                disabled={m.applied}
                onClick={() => confirmDraft(m.draft)}
                className="btn btn-primary w-full"
                data-testid="ttb-confirm-draft"
              >
                {m.applied ? '✓ เพิ่มลงตะกร้าแล้ว' : `เพิ่มลงตะกร้า · ฿${m.total}`}
              </button>
            </div>
          )
        })}
        {typing && (
          <div className="flex justify-start">
            <div className="card bg-brand-bg border border-brand-border flex items-center gap-2 px-3 py-2">
              <span className="text-xs text-brand-muted">Bite กำลัง…</span>
            </div>
          </div>
        )}
        <div ref={endRef} />
      </div>

      {/* Quick actions — real interactions, not placeholder input */}
      <div className="flex gap-2 px-4 pb-2 overflow-x-auto no-scrollbar shrink-0">
        {[
          { label: '🔄 สั่งเหมือนเดิม', fn: () => void handleOrderAgain(), id: 'ttb-again' },
          { label: '🍊 ช่วยเลือกให้หน่อย', fn: () => void handleRecommend(), id: 'ttb-recommend' },
          { label: '🍽️ ดูเมนู', fn: handleViewMenu, id: 'ttb-menu' },
          { label: '📦 เช็กออเดอร์', fn: () => void handleCheckOrders(), id: 'ttb-orders' },
          ...(customer ? [] : [{ label: '🔐 เข้าสู่ระบบ', fn: goLogin, id: 'ttb-login' }]),
        ].map((qa) => (
          <button
            key={qa.id}
            type="button"
            onClick={qa.fn}
            data-testid={qa.id}
            disabled={typing}
            className="px-3 py-1.5 bg-brand-bg text-brand-accent rounded-full text-xs whitespace-nowrap hover:bg-brand-secondary transition-colors disabled:opacity-50"
          >
            {qa.label}
          </button>
        ))}
      </div>

      {/* Input + voice */}
      <div className="flex items-center gap-2 px-4 py-3 border-t border-brand-border bg-white shrink-0">
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleSend()}
          placeholder={listening ? 'กำลังฟัง... พูดได้เลยครับ' : 'พิมพ์ข้อความ หรือกดไมค์เพื่อพูด…'}
          disabled={typing}
          className="input flex-1"
          data-testid="ttb-input"
        />
        {micSupported && (
          <button
            type="button"
            onClick={toggleMic}
            className={listening ? 'btn btn-primary' : 'btn btn-outline'}
            aria-label={listening ? 'หยุดฟัง' : 'กดเพื่อพูด'}
            data-testid="ttb-mic"
          >
            {listening ? '⏹' : '🎤'}
          </button>
        )}
        {ttsSupported && (
          <button
            type="button"
            onClick={toggleVoiceReply}
            className={voiceReply ? 'btn btn-primary' : 'btn btn-outline'}
            aria-label={voiceReply ? 'ปิดเสียงตอบ' : 'เปิดเสียงตอบ'}
            title={voiceReply ? 'ปิดเสียงตอบ' : 'เปิดเสียงตอบ'}
          >
            {voiceReply ? '🔊' : '🔇'}
          </button>
        )}
        <button
          type="button"
          onClick={handleSend}
          disabled={!input.trim() || typing}
          className="btn btn-primary"
          data-testid="ttb-send"
        >
          ส่ง
        </button>
      </div>
    </div>
  )

  return (
    <div
      data-testid="talk-to-bite"
      role={fixed ? 'dialog' : undefined}
      aria-modal={fixed ? true : undefined}
      aria-label="Talk to Bite"
      className={fixed ? 'fixed inset-0 z-[96] bg-white overflow-hidden flex flex-col' : 'relative w-full'}
    >
      {realm === 'landing' ? landingView : conversationView}
    </div>
  )
}

function speakable(text: string): string {
  return text.replace(/[#*`_~]/g, '').slice(0, 800)
}
