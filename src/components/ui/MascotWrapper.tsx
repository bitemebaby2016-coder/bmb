// ============================================
// Bite Me Baby — MascotWrapper (Floating 2.5D Guard)
// ============================================
// Anchors the decorative mascot with an `absolute pointer-events-none
// select-none` wrapper so it never steals click events from order CTAs, while
// layering an OS drop-shadow for the 3D "lift" + a gentle float animation.

import type { ReactNode, CSSProperties } from 'react'

export interface MascotWrapperProps {
  children: ReactNode
  /** Position within the nearest relatively-positioned ancestor. */
  position?: 'top-right' | 'bottom-right' | 'bottom-left' | 'top-left'
  /** Optional inline (z-index / offsets). */
  style?: CSSProperties
  className?: string
  ariaHidden?: boolean
}

const POSITION_CLASS: Record<NonNullable<MascotWrapperProps['position']>, string> = {
  'top-right': 'top-4 right-4',
  'bottom-right': 'bottom-4 right-4',
  'bottom-left': 'bottom-4 left-4',
  'top-left': 'top-4 left-4',
}

export function MascotWrapper({
  children,
  position = 'bottom-right',
  style,
  className = '',
  ariaHidden = true,
}: MascotWrapperProps) {
  return (
    <div
      aria-hidden={ariaHidden}
      className={[
        'absolute pointer-events-none select-none',
        POSITION_CLASS[position],
        'animate-float',
        // 2.5D drop-shadow — decorative element only, no box-shadow on the asset.
        'filter drop-shadow-[0_15px_12px_rgba(0,0,0,0.18)]',
        className,
      ]
        .filter(Boolean)
        .join(' ')}
      style={style}
    >
      {children}
    </div>
  )
}
