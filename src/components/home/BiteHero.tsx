// ============================================
// Bite Me Baby — BiteHero (UI v5)
// Bite = conversational AI service staff. Greeting + contextual status + quick actions.
// Data comes ONLY from the message contract (BiteMessage) — no hard-coded business text.
// ============================================

import { Link } from 'react-router-dom'
import type { BiteMessage } from '@/types'
import { MascotBadge } from '@/components/MascotBadge'

export function BiteHero({ message }: { message: BiteMessage }) {
  return (
    <section className="bite-hero card relative overflow-hidden" aria-label="Bite ผู้ช่วยแนะนำเมนู">
      <div className="bite-hero-glow" aria-hidden="true" />
      <div className="flex items-center gap-4 relative z-10">
        <MascotBadge
          pose="greeting"
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
            <Link
              to="/ai-chat"
              className="inline-flex items-center gap-1 mt-2 text-brand-primary font-medium hover:underline"
              aria-label="ให้ Bite แนะนำเมนู"
            >
              <span role="img" aria-hidden="true">🤖</span>
              {message.recommendLabel}
            </Link>
          )}
        </div>
      </div>

      <div className="quick-actions grid grid-cols-2 sm:grid-cols-4 gap-2 mt-4 relative z-10">
        {message.quickActions.map((qa) => (
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
        ))}
      </div>
    </section>
  )
}