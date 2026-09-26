// ============================================
// Bite Me Baby — MascotWrapper (Floating 2.5D Guard + Draggable)
// ============================================
// Anchors the decorative mascot with a `fixed pointer-events-none
// select-none` wrapper so it floats with scroll and never steals click
// events from order CTAs. The inner button handles drag to let users
// reposition the mascot anywhere on screen.
// ============================================

import type { ReactNode, CSSProperties } from 'react'
import { forwardRef, useState, useRef, useEffect, useCallback } from 'react'

export interface MascotWrapperProps {
  children: ReactNode
  /** Position within the viewport (fixed positioning). */
  position?: 'top-right' | 'bottom-right' | 'bottom-left' | 'top-left'
  /** Optional inline (z-index / offsets). */
  style?: CSSProperties
  className?: string
  ariaHidden?: boolean
}

const POSITION_CLASS: Record<NonNullable<MascotWrapperProps['position']>, string> = {
  'top-right': 'top-4 right-4',
  'bottom-right': 'bottom-24 right-4',
  'bottom-left': 'bottom-24 left-4',
  'top-left': 'top-4 left-4',
}

const STORAGE_KEY = 'bmb_mascot_position'

export const MascotWrapper = forwardRef<HTMLDivElement, MascotWrapperProps>(
  ({ children, position = 'bottom-right', style, className = '', ariaHidden = true }, ref) => {
  const [savedPosition, setSavedPosition] = useState<{ x: number; y: number } | null>(() => {
    if (typeof window !== 'undefined') {
      try {
        const stored = localStorage.getItem(STORAGE_KEY)
        if (stored) {
          const parsed = JSON.parse(stored)
          if (parsed && typeof parsed.x === 'number' && typeof parsed.y === 'number') {
            return parsed
          }
        }
      } catch {}
    }
    return null
  })

  const [isDragging, setIsDragging] = useState(false)
  const dragStartRef = useRef<{ x: number; y: number } | null>(null)
  const wrapperRef = useRef<HTMLDivElement>(null)

  const savePosition = useCallback((x: number, y: number) => {
    const pos = { x, y }
    setSavedPosition(pos)
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(pos)) } catch {}
  }, [])

  const handleDragStart = useCallback((clientX: number, clientY: number) => {
    if (!wrapperRef.current) return
    const rect = wrapperRef.current.getBoundingClientRect()
    dragStartRef.current = { x: clientX - rect.left, y: clientY - rect.top }
    setIsDragging(true)
    document.body.style.userSelect = 'none'
    document.body.style.cursor = 'grabbing'
  }, [])

  const handleDragMove = useCallback((clientX: number, clientY: number) => {
    if (!isDragging || !dragStartRef.current || !wrapperRef.current) return
    const newX = clientX - dragStartRef.current.x
    const newY = clientY - dragStartRef.current.y
    const padding = 16
    const maxX = window.innerWidth - wrapperRef.current.offsetWidth - padding
    const maxY = window.innerHeight - wrapperRef.current.offsetHeight - padding
    const constrainedX = Math.max(padding, Math.min(newX, maxX))
    const constrainedY = Math.max(padding, Math.min(newY, maxY))
    wrapperRef.current.style.transform = `translate(${constrainedX}px, ${constrainedY}px)`
  }, [isDragging])

  const handleDragEnd = useCallback((clientX: number, clientY: number) => {
    if (!isDragging || !wrapperRef.current) return
    const rect = wrapperRef.current.getBoundingClientRect()
    let saveX: number, saveY: number
    if (position.includes('right')) saveX = window.innerWidth - rect.right
    else saveX = rect.left
    if (position.includes('bottom')) saveY = window.innerHeight - rect.bottom
    else saveY = rect.top
    savePosition(saveX, saveY)
    setIsDragging(false)
    document.body.style.userSelect = ''
    document.body.style.cursor = ''
    dragStartRef.current = null
  }, [isDragging, position, savePosition])

  useEffect(() => {
    if (!isDragging) return
    const handleMouseMove = (e: MouseEvent) => handleDragMove(e.clientX, e.clientY)
    const handleMouseUp = (e: MouseEvent) => handleDragEnd(e.clientX, e.clientY)
    const handleTouchMove = (e: TouchEvent) => handleDragMove(e.touches[0].clientX, e.touches[0].clientY)
    const handleTouchEnd = (e: TouchEvent) => handleDragEnd(e.changedTouches[0].clientX, e.changedTouches[0].clientY)
    document.addEventListener('mousemove', handleMouseMove, { passive: true })
    document.addEventListener('mouseup', handleMouseUp, { passive: true })
    document.addEventListener('touchmove', handleTouchMove, { passive: true })
    document.addEventListener('touchend', handleTouchEnd, { passive: true })
    return () => {
      document.removeEventListener('mousemove', handleMouseMove)
      document.removeEventListener('mouseup', handleMouseUp)
      document.removeEventListener('touchmove', handleTouchMove)
      document.removeEventListener('touchend', handleTouchEnd)
    }
  }, [isDragging, handleDragMove, handleDragEnd])

  useEffect(() => {
    if (savedPosition && wrapperRef.current) {
      const { x, y } = savedPosition
      let transformX = position.includes('right') ? -x : x
      let transformY = position.includes('bottom') ? -y : y
      wrapperRef.current.style.transform = `translate(${transformX}px, ${transformY}px)`
    }
  }, [savedPosition, position])

  const positionClass = POSITION_CLASS[position]

  return (
    <div
      ref={(el) => { wrapperRef.current = el; if (ref && typeof ref === 'object') ref.current = el; else if (typeof ref === 'function') ref(el); }}
      aria-hidden={ariaHidden}
      className={['fixed pointer-events-none select-none', positionClass, 'animate-float', 'filter drop-shadow-[0_15px_12px_rgba(0,0,0,0.18)]', className].filter(Boolean).join(' ')}
      style={style}
    >
      {children}
    </div>
  )
}
)

export function useMascotDrag(
  wrapperRef: React.RefObject<HTMLDivElement>,
  position: NonNullable<MascotWrapperProps['position']>,
  savePosition: (x: number, y: number) => void
) {
  const dragStartRef = useRef<{ x: number; y: number } | null>(null)
  const [isDragging, setIsDragging] = useState(false)

  const handleDragStart = useCallback((clientX: number, clientY: number) => {
    if (!wrapperRef.current) return
    const rect = wrapperRef.current.getBoundingClientRect()
    dragStartRef.current = { x: clientX - rect.left, y: clientY - rect.top }
    setIsDragging(true)
    document.body.style.userSelect = 'none'
    document.body.style.cursor = 'grabbing'
  }, [wrapperRef])

  const handleDragMove = useCallback((clientX: number, clientY: number) => {
    if (!isDragging || !dragStartRef.current || !wrapperRef.current) return
    const newX = clientX - dragStartRef.current.x
    const newY = clientY - dragStartRef.current.y
    const padding = 16
    const maxX = window.innerWidth - wrapperRef.current.offsetWidth - padding
    const maxY = window.innerHeight - wrapperRef.current.offsetHeight - padding
    const constrainedX = Math.max(padding, Math.min(newX, maxX))
    const constrainedY = Math.max(padding, Math.min(newY, maxY))
    wrapperRef.current.style.transform = `translate(${constrainedX}px, ${constrainedY}px)`
  }, [isDragging, wrapperRef])

  const handleDragEnd = useCallback((clientX: number, clientY: number) => {
    if (!isDragging || !wrapperRef.current) return
    const rect = wrapperRef.current.getBoundingClientRect()
    let saveX: number, saveY: number
    if (position.includes('right')) saveX = window.innerWidth - rect.right
    else saveX = rect.left
    if (position.includes('bottom')) saveY = window.innerHeight - rect.bottom
    else saveY = rect.top
    savePosition(saveX, saveY)
    setIsDragging(false)
    document.body.style.userSelect = ''
    document.body.style.cursor = ''
    dragStartRef.current = null
  }, [isDragging, position, savePosition, wrapperRef])

  return { handleDragStart, handleDragMove, handleDragEnd, isDragging }
}