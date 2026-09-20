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

import { forwardRef, type HTMLAttributes } from 'react'

export interface GlassCardProps extends HTMLAttributes<HTMLDivElement> {
  /** Elevate the card out of the layout (hero product / mascot). */
  elevated?: boolean
  /** Decorative surface — guaranteed not to interfere with user interaction. */
  decorative?: boolean
}

export const GlassCard = forwardRef<HTMLDivElement, GlassCardProps>(
  ({ elevated = false, decorative = false, className = '', children, ...rest }, ref) => {
    const base =
      'rounded-3xl bg-white/70 backdrop-blur-md border border-white/20 text-slate-800'

    // 3D depth layering: negative margin lifts the hero, drop-shadow casts a
    // soft virtual shadow onto the glass behind. No box-shadow on content.
    const depth = elevated
      ? 'relative -mt-12 z-10 filter drop-shadow-[0_15px_12px_rgba(0,0,0,0.18)]'
      : ''

    // Decorative placement guard — cannot hijack clicks (e.g. ordering CTA).
    const guard = decorative ? 'pointer-events-none select-none' : ''

    return (
      <div
        ref={ref}
        className={[base, depth, guard, className].filter(Boolean).join(' ')}
        {...rest}
      >
        {children}
      </div>
    )
  },
)

GlassCard.displayName = 'GlassCard'
