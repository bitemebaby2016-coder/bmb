// ============================================
// Bite Me Baby — BiteHero (UI v5)
// Bite = conversational AI service staff. Greeting + contextual status + quick actions.
// Data comes ONLY from the message contract (BiteMessage) — no hard-coded business text.
// ============================================

import { Link, useState } from 'react'
import type { BiteMessage } from '@/types'
import { MascotBadge } from '@/components/MascotBadge'
import { BiteAIChat } from '@/components/ai/BiteAIChat'

// USP Bar items (static trust signals)
const USP_ITEMS = [
  { icon: '🚚', text: 'ส่งฟรีครบ ฿200' },
  { icon: '🤖', text: 'AI แนะนำ 24/7' },
  { icon: '📍', text: 'จันทบุรี 5 กม.' },
] as const

export function BiteHero({ message, pose = 'greeting' }: { message: BiteMessage; pose?: 'greeting' | 'thinking' | 'pointing' | 'empty' }) {
  const [showAIChat, setShowAIChat] = useState(false)

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
              onClick={() => setShowAIChat(true)}
              className="inline-flex items-center gap-1 mt-2 text-brand-primary font-medium hover:underline"
              aria-label="เปิดแชทกับ AI ไบต์"
            >
              <span role="img" aria-hidden="true">🤖</span>
              {message.recommendLabel}
            </button>
          )}
          
          {/* USP Bar — Trust Signals */}
          <div className="usp-bar flex flex-wrap items-center justify-center sm:justify-start gap-3 mt-3" role="list" aria-label="จุดเด่นของบริการ">
            {USP_ITEMS.map((item, i) => (
              <span key={i} className="usp-item inline-flex items-center gap-1 text-xs sm:text-sm text-brand-muted font-medium" role="listitem">
                <span aria-hidden="true">{item.icon}</span>
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
                onClick={() => setShowAIChat(true)}
                className="quick-action"
                aria-label={qa.label}
              >
                <span className="text-xl leading-none" aria-hidden="true">{qa.icon}</span>
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
              <span className="text-xl leading-none" aria-hidden="true">{qa.icon}</span>
              <span className="text-xs sm:text-sm font-medium">{qa.label}</span>
            </Link>
          )
        })}
      </div>

      {/* AI Chat Modal */}
      {showAIChat && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50"
          role="dialog"
          aria-modal="true"
          aria-labelledby="ai-chat-title"
          onClick={() => setShowAIChat(false)}
        >
          <div
            className="bg-white rounded-2xl max-w-md w-full max-h-[80vh] overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between p-4 border-b border-brand-border">
              <h2 id="ai-chat-title" className="font-display font-bold text-brand-accent">💬 แชทกับ AI ไบต์</h2>
              <button
                type="button"
                onClick={() => setShowAIChat(false)}
                className="p-2 rounded-lg hover:bg-brand-bg transition-colors"
                aria-label="ปิดแชท"
              >
                ✕
              </button>
            </div>
            <BiteAIChat />
          </div>
        </div>
      )}
    </section>
  )
}