// ============================================
// BMB — Food Theater ring geometry (pure presentation math)
// ============================================
// Maps a slide's offset from the active index to its ring position class.
// Presentation ONLY — no catalog/cart/business authority. Fully unit-tested.
// ============================================

/** Ring slot of a slide relative to the active (center) slide. */
export type TheaterPos = 'center' | 'near-left' | 'near-right' | 'far-left' | 'far-right'

/** Keep an index inside [0, count-1]; an empty list always resolves to 0. */
export function clampIndex(index: number, count: number): number {
  if (count <= 0) return 0
  return Math.max(0, Math.min(count - 1, Math.round(index)))
}

/**
 * Position of slide `index` when `active` is centered:
 * offset < 0 → left side (already scrolled past), offset > 0 → right side.
 * ±1 = near (full card, curved in), anything further = far (depth layer).
 */
export function theaterPosFor(index: number, active: number, count: number): TheaterPos {
  if (count <= 0) return 'center'
  const offset = index - clampIndex(active, count)
  if (offset === 0) return 'center'
  if (offset === -1) return 'near-left'
  if (offset === 1) return 'near-right'
  return offset < 0 ? 'far-left' : 'far-right'
}
