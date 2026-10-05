// ============================================
// Bite Me Baby — GlassCard (2.5D/3D Hybrid Glassmorphism Base)
// ============================================
// Refactored glass surface per the design system:
//   bg-white/70 backdrop-blur-md border border-white/20 text-slate-800
//
// `elevated` — for hero products / mascots: pulls the surface up with a
// negative top margin and a soft OS drop-shadow filter. NOTE: never apply
// `shadow-*` to the inner product image; 3D depth must come from `filter
// drop-shadow-*` here, so sibling stacking (z-index) stays predictable.
//
// `decorative` — tags an anchor with `pointer-events-none select-none` so
// decorative layers never swallow taps/clicks from real controls.

import { forwardRef, type CSSProperties, type HTMLAttributes } from 'react'
import { usePlatformConfig } from '@/config/platformConfig'

export interface GlassCardProps extends HTMLAttributes<HTMLDivElement> {
  /** Elevate the card out of the layout (hero product / mascot). */
  elevated?: boolean
  /** Decorative surface — guaranteed not to interfere with user interaction. */
  decorative?: boolean
}

export const GlassCard = forwardRef<HTMLDivElement, GlassCardProps>(
  ({ elevated = false, decorative = false, className = '', children, style, ...rest }, ref) => {
    // FINAL CONFIG CLOSURE: glass tokens = brands.theme_tokens.glass (hydrated ตอน boot)
    // default ของ config = ค่า look เดิมเป๊ะ (rgba/blur CSS values — ไม่ใช่ Tailwind class)
    const { theme } = usePlatformConfig()

    const base = 'rounded-3xl'
    const depth = elevated ? 'relative -mt-12 z-10' : ''
    const guard = decorative ? 'pointer-events-none select-none' : ''

    const glassStyle: CSSProperties = {
      background: theme.glassBg,
      backdropFilter: `blur(${theme.glassBlur})`,
      WebkitBackdropFilter: `blur(${theme.glassBlur})`,
      border: `1px solid ${theme.glassBorder}`,
      color: theme.glassText,
      ...(elevated ? { filter: theme.depthShadow } : {}),
      ...style,
    }

    return (
      <div
        ref={ref}
        className={[base, depth, guard, className].filter(Boolean).join(' ')}
        style={glassStyle}
        {...rest}
      >
        {children}
      </div>
    )
  },
)

GlassCard.displayName = 'GlassCard'
