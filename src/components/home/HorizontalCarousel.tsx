// ============================================
// Bite Me Baby — HorizontalCarousel (UI v5)
// Generic, accessible, touch-first, auto-slide with pause-on-interaction.
// Respects prefers-reduced-motion (no auto-slide, instant scroll).
// ============================================

import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react'

function usePrefersReducedMotion(): boolean {
  const [reduced, setReduced] = useState(false)
  useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)')
    const update = () => setReduced(mq.matches)
    update()
    mq.addEventListener?.('change', update)
    return () => mq.removeEventListener?.('change', update)
  }, [])
  return reduced
}

interface HorizontalCarouselProps {
  items: ReactNode[]
  'aria-label': string
  auto?: boolean
  intervalMs?: number
  className?: string
}

export function HorizontalCarousel({ items, 'aria-label': ariaLabel, auto = false, intervalMs = 5000, className = '' }: HorizontalCarouselProps) {
  const trackRef = useRef<HTMLDivElement>(null)
  const [paused, setPaused] = useState(false)
  const reduced = usePrefersReducedMotion()

  const scrollByPage = useCallback((dir: 1 | -1) => {
    const el = trackRef.current
    if (!el) return
    const card = el.querySelector('[data-slide]') as HTMLElement | null
    const step = card ? card.offsetWidth + 16 : Math.min(el.clientWidth, 260)
    el.scrollBy({ left: step * dir, behavior: reduced ? 'auto' : 'smooth' })
  }, [reduced])

  useEffect(() => {
    if (!auto || paused || reduced) return
    const id = window.setInterval(() => scrollByPage(1), intervalMs)
    return () => window.clearInterval(id)
  }, [auto, paused, reduced, intervalMs, scrollByPage])

  const pauseProps = {
    onMouseEnter: () => setPaused(true),
    onMouseLeave: () => setPaused(false),
    onFocusCapture: () => setPaused(true),
    onBlurCapture: () => setPaused(false),
    onTouchStartCapture: () => setPaused(true),
    onTouchEndCapture: () => setPaused(false),
  }

  return (
    <div className={`hc relative ${className}`.trim()} {...pauseProps}>
      <button type="button" className="hc-nav hc-nav--prev" aria-label="เลื่อนก่อนหน้า" onClick={() => scrollByPage(-1)}>
        ‹
      </button>
      <div ref={trackRef} className="hc-track" role="list" tabIndex={0} aria-label={ariaLabel}>
        {items.length === 0 ? (
          <p className="text-sm text-brand-muted py-6 text-center w-full">ยังไม่มีรายการ</p>
        ) : (
          items.map((node, i) => (
            <div key={i} data-slide role="listitem" className="hc-slide">
              {node}
            </div>
          ))
        )}
      </div>
      <button type="button" className="hc-nav hc-nav--next" aria-label="เลื่อนถัดไป" onClick={() => scrollByPage(1)}>
        ›
      </button>
    </div>
  )
}