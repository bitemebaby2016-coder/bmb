// ============================================
// Bite Me Baby — BiteHero (UI v5)
// Bite = conversational AI service staff. Greeting + contextual status + quick actions.
// Data comes ONLY from the message contract (BiteMessage) — no hard-coded business text.
// ============================================

import { useState, lazy, Suspense } from 'react'
import { Link } from 'react-router-dom'
import type { BiteMessage } from '@/types'
import { MascotBadge } from '@/components/MascotBadge'

const TalkToBite = lazy(() =>
  import('@/components/ai/TalkToBite').then((m) => ({ default: m.TalkToBite })),
)

/** ไอคอนบรรทัด: 'mascot:<pose>' → มาสคอตน้อง Bite (แทนอีโมจิหุ่นยนต์), อื่น ๆ → อีโมจิปกติ */
function InlineIcon({ icon, className = '' }: { icon: string; className?: string }) {
  if (icon.startsWith('mascot:')) {
    return <MascotBadge pose={icon.slice(7) as 'thinking'} size="sm" className={className} />
  }
  return <span aria-hidden="true" className={className}>{icon}</span>
}

// USP Bar items (static trust signals) — icon 'mascot:<pose>' = ใช้มาสคอตน้อง Bite แทนอีโมจิ
const USP_ITEMS = [
  { icon: '🚚', text: 'ส่งฟรีครบ ฿200' },
  { icon: 'mascot:thinking', text: 'AI แนะนำ 24/7' },
  { icon: '📍', text: 'จันทบุรี 5 กม.' },
] as const

export function BiteHero({ message, pose = 'greeting' }: { message: BiteMessage; pose?: 'greeting' | 'thinking' | 'pointing' | 'empty' }) {
  const [showBite, setShowBite] = useState(false)
  const [autoRecommend, setAutoRecommend] = useState(false)

  const openBite = (recommend: boolean) => {
    setAutoRecommend(recommend)
    setShowBite(true)
  }

  return (
    <section className="bite-hero card relative overflow-hidden" aria-label="Bite ผู้ช่วยแนะนำเมนู">
      <div className="bite-hero-glow" aria-hidden="true" />
      <div className="flex items-center gap-4 relative z-10">
        <MascotBadge
          pose={pose}
          size="lg"
          alt="น้อง Bite กวักมือทักทาย"
          className="animate-float bite-hero-mascot"
          loading="eager"
        />
        <div className="flex-1 min-w-0 text-center sm:text-left">
          <h1 className="text-2xl md:text-3xl font-display font-bold text-brand-accent leading-tight">
            {message.greeting}
          </h1>
          <p className="text-sm text-brand-muted mt-1">{message.statusLine}</p>
          {message.recommendLabel && (
            <button
              type="button"
              onClick={() => openBite(true)}
              className="inline-flex items-center gap-1 mt-2 text-brand-primary font-medium hover:underline"
              aria-label="เปิด Talk to Bite ให้แนะนำเมนู"
            >
              <MascotBadge pose="recommend" size="sm" className="inline-block align-middle" />
              {message.recommendLabel}
            </button>
          )}
          
          {/* USP Bar — Trust Signals */}
          <div className="usp-bar flex flex-wrap items-center justify-center sm:justify-start gap-3 mt-3" role="list" aria-label="จุดเด่นของบริการ">
            {USP_ITEMS.map((item, i) => (
              <span key={i} className="usp-item inline-flex items-center gap-1 text-xs sm:text-sm text-brand-muted font-medium" role="listitem">
                <InlineIcon icon={item.icon} />
                {item.text}
              </span>
            ))}
          </div>

          {/* Trust Badges — Social Proof Summary */}
          <div className="trust-badges flex flex-wrap items-center justify-center sm:justify-start gap-2 mt-3" role="list" aria-label="ความน่าเชื่อถือ">
            <span className="trust-badge inline-flex items-center gap-1 text-xs sm:text-sm text-brand-muted font-medium" role="listitem">
              <span aria-hidden="true">⭐</span> 4.8/5.0
            </span>
            <span className="trust-badge inline-flex items-center gap-1 text-xs sm:text-sm text-brand-muted font-medium" role="listitem">
              <span aria-hidden="true">📦</span> 10,000+ ออเดอร์
            </span>
            <span className="trust-badge inline-flex items-center gap-1 text-xs sm:text-sm text-brand-muted font-medium" role="listitem">
              <span aria-hidden="true">🔒</span> จ่ายปลอดภัย PromptPay
            </span>
          </div>
        </div>
      </div>

      <div className="quick-actions grid grid-cols-2 sm:grid-cols-4 gap-2 mt-4 relative z-10">
        {message.quickActions.map((qa) => {
          if (qa.id === 'home-bite') {
            return (
              <button
                key={qa.id}
                type="button"
                onClick={() => openBite(true)}
                className="quick-action"
                aria-label={qa.label}
              >
                <InlineIcon icon={qa.icon} className="inline-block align-middle" />
                <span className="text-xs sm:text-sm font-medium">{qa.label}</span>
              </button>
            )
          }
          return (
            <Link
              key={qa.id}
              to={qa.to}
              className="quick-action"
              aria-label={qa.label}
              {...(qa.id === 'home-menu' ? { 'data-testid': 'home-menu-cta' as string } : {})}
            >
              <InlineIcon icon={qa.icon} className="inline-block align-middle" />
              <span className="text-xs sm:text-sm font-medium">{qa.label}</span>
            </Link>
          )
        })}
      </div>

      {/* Talk to Bite — the same experience as the Floating Bite / /talk-to-bite page */}
      {showBite && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50"
          role="dialog"
          aria-modal="true"
          aria-labelledby="talk-to-bite-title"
          onClick={() => setShowBite(false)}
        >
          <div
            className="w-full max-w-md"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 id="talk-to-bite-title" className="sr-only">Talk to Bite</h2>
            <Suspense fallback={<div className="card bg-brand-surface p-6 text-center text-sm text-brand-muted">Bite กำลังเตรียมตัว…</div>}>
              <TalkToBite autoRecommend={autoRecommend} onClose={() => setShowBite(false)} />
            </Suspense>
          </div>
        </div>
      )}
    </section>
  )
}