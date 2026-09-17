// ============================================
// Bite Me Baby — LazyVideo v1.0
// Short Video Policy (Performance):
// - อนุญาตเฉพาะ "เมนู Highlight" ไม่เกิน 1-2 คลิป
// - สตรีมแบบ Lazy: ตั้ง src ให้เมื่อ IntersectionObserver เห็นว่าผู้ใช้ scroll มาถึงเท่านั้น
//   (preload="none" + poster WebP → ไม่ดาวน์โหลดวิดีโอก่อนถึงจุดนั้น)
// - ห้ามใช้ในเซกชั่นรีวิว / หน้าแรกตอนต้น (LCP)
// - เคารพ Data Saver (navigator.connection.saveData) — ใช้ poster แทน autoplay
// @see docs/COMPONENT_SPEC_UI.md §12 (Video Policy)
// ============================================

import { useEffect, useRef, useState } from 'react'

interface LazyVideoProps {
  src: string
  title: string
  poster?: string
  className?: string
}

type ConnectionWithSaveData = Navigator & {
  connection?: { saveData?: boolean }
}

export function LazyVideo({ src, title, poster, className = '' }: LazyVideoProps) {
  const ref = useRef<HTMLVideoElement | null>(null)
  const [inView, setInView] = useState(false)
  const [shouldStream, setShouldStream] = useState(false)

  useEffect(() => {
    const el = ref.current
    if (!el) return

    if (typeof IntersectionObserver === 'undefined') {
      // Fallback (browser เก่า): โหลดทันที — แค่ 1-2 คลิปเท่านั้น
      setInView(true)
      return
    }

    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          setInView(true)
          io.disconnect()
        }
      },
      { rootMargin: '200px 0px' }
    )

    io.observe(el)
    return () => io.disconnect()
  }, [])

  useEffect(() => {
    if (!inView) return
    const conn = (navigator as ConnectionWithSaveData).connection
    // Data Saver / Slow network → ไม่ autoplay สตรีมไว ๆ ให้แตะเล่นเอง (ยังแสดง poster)
    setShouldStream(conn?.saveData ? false : true)
  }, [inView])

  return (
    <video
      ref={ref}
      className={`lazy-video ${className}`.trim()}
      controls
      playsInline
      muted
      loop
      preload="none"
      poster={poster}
      title={title}
      aria-label={title}
      src={shouldStream ? src : undefined}
    >
      {!shouldStream && 'แตะเพื่อเล่นวิดีโอ'}
    </video>
  )
}