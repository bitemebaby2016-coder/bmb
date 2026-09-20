// ============================================
// Bite Me Baby — Bite AI Service Mascot (4-Stage)
// Stage 1 Ambient    : floating overlay + looping bubble + Web-Audio greeting
//                      on the user's first click (bypasses autoplay policy).
// Stage 2 Upsell     : cart vs free-shipping config → sweetener prompt.
// Stage 3 Micro-Hook : scroll-stall monitor (>5s) on the pre-order grid.
// Stage 4 Full-Chat  : mascot tap → full-screen contextual BiteAIChat.
// Guard: wrapper is absolute pointer-events-none; only the tap target has
// pointer-events-auto so order CTAs are never blocked.
// ============================================

import { useEffect, useRef, useState } from 'react'
import { MascotWrapper } from '@/components/ui/MascotWrapper'
import { GlassCard } from '@/components/ui/GlassCard'
import { BiteAIChat } from '@/components/ai/BiteAIChat'
import { useBiteAIStore } from '@/stores/useBiteAIStore'
import { useCartStore } from '@/stores/useCartStore'
import { usePlatformConfig } from '@/config/platformConfig'

export interface BiteMascotProps {
  userName?: string
  activeSection?: string
}

function playGreetingSound() {
  try {
    const Ctor =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext
    const ctx = new Ctor()
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()
    osc.connect(gain)
    gain.connect(ctx.destination)
    osc.type = 'sine'
    osc.frequency.setValueAtTime(523.25, ctx.currentTime)
    gain.gain.setValueAtTime(0.0001, ctx.currentTime)
    gain.gain.exponentialRampToValueAtTime(0.2, ctx.currentTime + 0.02)
    gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.5)
    osc.start()
    osc.stop(ctx.currentTime + 0.55)
    osc.onended = () => ctx.close().catch(() => undefined)
  } catch {
    /* audio unavailable — greet silently */
  }
}

export function BiteMascot({ userName, activeSection = 'home' }: BiteMascotProps) {
  const { bubble, upsell, stage, greetingPlayed, chatOpen } = useBiteAIStore()
  const firstInteraction = useBiteAIStore((s) => s.firstInteraction)
  const evaluateUpsell = useBiteAIStore((s) => s.evaluateUpsell)
  const triggerMicroHook = useBiteAIStore((s) => s.triggerMicroHook)
  const openChat = useBiteAIStore((s) => s.openChat)

  const cartTotal = useCartStore((s) => s.cartTotal)
  const { delivery } = usePlatformConfig()

  const stallTimer = useRef<ReturnType<typeof setInterval> | null>(null)
  const [chatVisible, setChatVisible] = useState(false)

  // Stage 1 — greet via Web Audio on the user's first click anywhere (once).
  useEffect(() => {
    if (greetingPlayed) return
    const playFirst = () => {
      firstInteraction()
      playGreetingSound()
    }
    document.addEventListener('click', playFirst, { once: true })
    return () => document.removeEventListener('click', playFirst)
  }, [greetingPlayed, firstInteraction])

  // Stage 2 — free-shipping upsell recomputed whenever the cart total changes.
  useEffect(() => {
    evaluateUpsell(cartTotal, delivery.freeShippingThreshold)
  }, [cartTotal, delivery.freeShippingThreshold, evaluateUpsell])

  // Stage 3 — scroll-stall micro-hook: >5s without scrolling on the pre-order grid.
  useEffect(() => {
    if (chatOpen) return
    let lastMove = Date.now()
    const onScroll = () => (lastMove = Date.now())
    window.addEventListener('scroll', onScroll, { passive: true })
    stallTimer.current = setInterval(() => {
      if (activeSection === 'pre-order' && Date.now() - lastMove > 5000) {
        triggerMicroHook('เหลือน้อย')
      }
    }, 1000)
    return () => {
      window.removeEventListener('scroll', onScroll)
      if (stallTimer.current) clearInterval(stallTimer.current)
    }
  }, [activeSection, chatOpen, triggerMicroHook])

  // Stage 4 — clicking the mascot opens the full-screen chat with piped context.
  function handleTap() {
    const name = userName ?? readHistoryName() ?? 'คุณ'
    const context = `ลูกค้าชื่อ ${name} มีของในตะกร้า ${cartTotal} บาท กำลังดูเซกชั่น ${activeSection}`
    openChat(context)
    setChatVisible(true)
  }

  useEffect(() => setChatVisible(chatOpen), [chatOpen])

  return (
    <>
      <MascotWrapper position="bottom-right" className="z-[95]">
        <div className="relative flex flex-col items-end">
          {bubble && stage !== 'fullchat' && (
            <GlassCard className="px-3 py-1.5 text-xs animate-bounce mb-1 mr-4 max-w-[220px]">
              {bubble}
            </GlassCard>
          )}
          {upsell && upsell.remaining > 0 && stage === 'personalization' && (
            <p className="text-[10px] text-amber-700 mr-4 mb-0.5">ส่งฟรีเมื่อครบ ฿{upsell.remaining}</p>
          )}
          <button
            type="button"
            onClick={handleTap}
            aria-label="เปิดแชทกับน้อง Bite"
            className="pointer-events-auto flex h-16 w-16 items-center justify-center rounded-full bg-gradient-to-br from-brand-primary to-brand-secondary text-3xl shadow-lg animate-float hover:scale-105 active:scale-95 transition-transform"
            data-testid="bite-mascot"
          >
            🐻
          </button>
        </div>
      </MascotWrapper>

      {chatVisible && <BiteAIChat />}
    </>
  )
}

/** Read the blueprint's user-history marker from localStorage if present. */
function readHistoryName(): string | null {
  try {
    const raw = localStorage.getItem('bmb_user_history')
    if (!raw) return null
    const parsed = JSON.parse(raw)
    return typeof parsed?.name === 'string' ? parsed.name : null
  } catch {
    return null
  }
}
