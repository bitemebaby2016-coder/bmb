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
  showIndicators?: boolean
}

export function HorizontalCarousel({ items, 'aria-label': ariaLabel, auto = false, intervalMs = 8000, className = '', showIndicators = true }: HorizontalCarouselProps) {
  const trackRef = useRef<HTMLDivElement>(null)
  const [paused, setPaused] = useState(false)
  const [currentIndex, setCurrentIndex] = useState(0)
  const reduced = usePrefersReducedMotion()

  const scrollByPage = useCallback((dir: 1 | -1) => {
    const el = trackRef.current
    if (!el) return
    const card = el.querySelector('[data-slide]') as HTMLElement | null
    const step = card ? card.offsetWidth + 16 : Math.min(el.clientWidth, 260)
    el.scrollBy({ left: step * dir, behavior: reduced ? 'auto' : 'smooth' })
  }, [reduced])

  // Update current index based on scroll position (for indicators)
  const updateCurrentIndex = useCallback(() => {
    const el = trackRef.current
    if (!el) return
    const card = el.querySelector('[data-slide]') as HTMLElement | null
    const step = card ? card.offsetWidth + 16 : Math.min(el.clientWidth, 260)
    const newIndex = Math.round(el.scrollLeft / step)
    setCurrentIndex(Math.max(0, Math.min(newIndex, items.length - 1)))
  }, [items.length])

  useEffect(() => {
    if (!auto || paused || reduced) return
    const id = window.setInterval(() => {
      if (trackRef.current) {
        const maxScroll = trackRef.current.scrollWidth - trackRef.current.clientWidth
        if (trackRef.current.scrollLeft >= maxScroll - 5) {
          // Loop back to start
          trackRef.current.scrollTo({ left: 0, behavior: reduced ? 'auto' : 'smooth' })
        } else {
          scrollByPage(1)
        }
      }
    }, intervalMs)
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
      <div ref={trackRef} className="hc-track" role="list" tabIndex={0} aria-label={ariaLabel} onScroll={updateCurrentIndex}>
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
      
      {/* Indicator dots */}
      {showIndicators && items.length > 1 && (
        <div className="hc-indicators flex justify-center gap-1.5 mt-3" role="tablist" aria-label="สไลด์">
          {items.map((_, i) => (
            <button
              key={i}
              type="button"
              role="tab"
              aria-selected={i === currentIndex}
              aria-label={`ไปสไลด์ ${i + 1}`}
              onClick={() => trackRef.current?.scrollTo({ left: i * (trackRef.current?.querySelector('[data-slide]')?.clientWidth ?? 260) + 16 * i, behavior: 'smooth' })}
              className={`hc-dot w-6 h-6 flex items-center justify-center p-0 bg-transparent border-0 cursor-pointer`}
            >
              <span
                className={`block rounded-full ${
                  i === currentIndex ? 'bg-brand-primary w-6 h-2' : 'bg-brand-muted/50 hover:bg-brand-muted w-2 h-2'
                }`}
                aria-hidden="true"
              />
            </button>
          ))}
        </div>
      )}
    </div>
  )
}