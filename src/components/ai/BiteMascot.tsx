// ============================================
// Bite Me Baby — Bite AI Service Mascot (4-Stage)
// Stage 1 Ambient    : floating overlay + looping bubble + Web-Audio greeting
//                      on the user's first click (bypasses autoplay policy).
// Stage 2 Upsell     : cart vs free-shipping config → sweetener prompt.
// Stage 3 Micro-Hook : scroll-stall monitor (>5s) on the pre-order grid.
// Stage 4 Full-Chat  : mascot tap → full-screen contextual BiteAIChat.
// Guard: wrapper is fixed pointer-events-none; only the tap target has
// pointer-events-auto so order CTAs are never blocked.
// ============================================

import { useEffect, useRef, useState, useCallback, lazy, Suspense } from 'react'
import { MascotWrapper } from '@/components/ui/MascotWrapper'
import { GlassCard } from '@/components/ui/GlassCard'
import { useBiteAIStore } from '@/stores/useBiteAIStore'
import { useCartStore } from '@/stores/useCartStore'
import { usePlatformConfig } from '@/config/platformConfig'
import { loadMascotOverrides, getOverrideUrl } from '@/lib/mascotService'

// ⚡ PERF: the full AI chat UI + aiService/OpenRouter chain is only needed when
// the user taps the mascot — load it on demand instead of at boot (TBT).
const BiteAIChat = lazy(() => import('@/components/ai/BiteAIChat').then(m => ({ default: m.BiteAIChat })))

export interface BiteMascotProps {
  userName?: string
  activeSection?: string
}

// All 24 mascot poses from public/assets/mascot/ (ต้องตรงกับไฟล์จริงในโฟลเดอร์)
const MASCOT_POSES = [
  'bite_ready',
  'bite_menu',
  'bite_cooking',
  'bite_recommend',
  'bite_hero_greeting',
  'bite_thinking',
  'bite_shopping',
  'bite_pointing',
  'bite_waiting',
  'bite_success',
  'bite_eating',
  'bite_delivery_run',
  'bite_goodbye',
] as const

type MascotPose = (typeof MASCOT_POSES)[number]

function getMascotUrl(pose: MascotPose): string {
  return `/assets/mascot/${pose}.webp`
}

/** ท่าเริ่มต้นตามบริบทหน้าที่ลูกค้ากำลังดู (สลับมาสคอตให้เข้ากับสถานการณ์) */
function contextPose(activeSection: string): MascotPose {
  switch (activeSection) {
    case 'menu': return 'bite_menu'
    case 'pre-order': return 'bite_shopping'
    case 'orders': return 'bite_delivery_run'
    case 'ai-chat': return 'bite_recommend'
    default: return 'bite_ready'
  }
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

// AI-UI: one-time reset of saved mascot drag positions - the anchor side changed from
// bottom-LEFT to bottom-RIGHT; stale left-anchored offsets would misplace the mascot.
try { localStorage.removeItem('bmb_mascot_position') } catch { /* ignore */ }

export function BiteMascot({ userName, activeSection = 'home' }: BiteMascotProps) {
  const { bubble, upsell, stage, greetingPlayed, chatOpen } = useBiteAIStore()
  const firstInteraction = useBiteAIStore((s) => s.firstInteraction)
  const evaluateUpsell = useBiteAIStore((s) => s.evaluateUpsell)
  const triggerMicroHook = useBiteAIStore((s) => s.triggerMicroHook)
  const openChat = useBiteAIStore((s) => s.openChat)

  const cartCount = useCartStore((s) => s.items.length)
  const cartTotal = useCartStore((s) => s.cartTotal)
  const { delivery } = usePlatformConfig()


  const stallTimer = useRef<ReturnType<typeof setInterval> | null>(null)
  const [chatVisible, setChatVisible] = useState(false)
  // ท่าเริ่มต้น = บริบทหน้าที่ลูกค้ากำลังดู (home→ready, menu→menu, pre-order→shopping …)
  const [currentPoseIndex, setCurrentPoseIndex] = useState(() =>
    Math.max(0, MASCOT_POSES.indexOf(contextPose(activeSection)))
  )
  // Admin override ต่อ pose (mascot_overrides — role_name = pose key ตัดคำว่า bite_)
  const [overrideUrl, setOverrideUrl] = useState<string | undefined>(undefined)

  // AI-UI: เมื่อ activeSection เปลี่ยน → สลับไปท่าตามบริบท + อ่าน override ล่าสุด
  useEffect(() => {
    setCurrentPoseIndex(Math.max(0, MASCOT_POSES.indexOf(contextPose(activeSection))))
  }, [activeSection])

  useEffect(() => {
    let active = true
    void loadMascotOverrides().then(() => {
      if (!active) return
      setOverrideUrl(getOverrideUrl(MASCOT_POSES[currentPoseIndex].replace('bite_', '')))
    })
    return () => { active = false }
  }, [currentPoseIndex])

  // Cycle to next pose on each tap/interaction
  const cyclePose = useCallback(() => {
    setCurrentPoseIndex((prev) => (prev + 1) % MASCOT_POSES.length)
  }, [])

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
    cyclePose() // Cycle to next pose on tap
  }

  useEffect(() => setChatVisible(chatOpen), [chatOpen])

  const currentPose = MASCOT_POSES[currentPoseIndex]
  const mascotUrl = overrideUrl || getMascotUrl(currentPose)

  return (
    <>
      <MascotWrapper
        position="bottom-right"
        className="z-[95]"
        ariaHidden={false}
        // Single AI entry point: right:16px, bottom:84px above BottomNav —
        // lifts to bottom:152px while the FloatingCart button occupies the
        // 84px slot (cart visible only when items > 0), so they never overlap.
        style={{ bottom: cartCount > 0 ? 152 : 84 }}
      >
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
            className="pointer-events-auto flex h-16 w-16 items-center justify-center rounded-full shadow-lg animate-float hover:scale-105 active:scale-95 transition-transform overflow-hidden cursor-grab active:cursor-grabbing bg-transparent"
            data-testid="bite-mascot"
          >
            <img
              src={mascotUrl}
              alt={`Bite mascot - ${currentPose}`}
              className="h-full w-full object-cover"
              loading="lazy"
              onError={(e) => {
                // override เสีย → กลับไปใช้ 3D asset ปกติของ pose
                const el = e.currentTarget as HTMLImageElement
                if (el.dataset.fbk !== '1') { el.dataset.fbk = '1'; el.src = getMascotUrl(currentPose) }
              }}
            />
          </button>
        </div>
      </MascotWrapper>

      {chatVisible && (
        <Suspense fallback={null}>
          <BiteAIChat />
        </Suspense>
      )}
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
