// ============================================
// Bite Me Baby — Supplier / Ingredient matching suggestions (Owner §4)
// Pure functions. Suggest only — never auto-bind (admin approves).
// ============================================
import type { MatchCandidate } from './types'

/** Normalize a name for fuzzy comparison (Thai + Latin safe). */
export function normalizeName(s: string | null | undefined): string {
  return (s ?? '')
    .toString()
    .trim()
    .toLowerCase()
    // eslint-disable-next-line no-misleading-character-class
    .replace(/[\u0E46\u0E4C\u0E4D\u0E4E]/gu, '') // Thai tone/typo marks that often differ
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

/** Score 0..1: exact=1, one contains the other=0.85, token overlap ratio. */
export function scoreMatch(query: string, candidate: string): number {
  const q = normalizeName(query)
  const c = normalizeName(candidate)
  if (!q || !c) return 0
  if (q === c) return 1
  if (c.includes(q) || q.includes(c)) return 0.85
  const qt = new Set(q.split(' '))
  const ct = new Set(c.split(' '))
  let inter = 0
  for (const t of qt) if (ct.has(t)) inter++
  const union = new Set([...qt, ...ct]).size
  return union === 0 ? 0 : inter / union
}

export interface NameId {
  id: string
  name: string
}

/** Rank candidates by score desc (only > 0). */
export function rankMatches<T extends NameId>(query: string, items: T[], label: (t: T) => string = (t) => t.name): MatchCandidate[] {
  return items
    .map((it) => ({ id: it.id, label: label(it), score: scoreMatch(query, it.name) }))
    .filter((c) => c.score > 0)
    .sort((a, b) => b.score - a.score)
}

export function matchSupplier(query: string, suppliers: NameId[]): MatchCandidate[] {
  return rankMatches(query, suppliers)
}

export function matchIngredient(query: string, ingredients: NameId[]): MatchCandidate[] {
  return rankMatches(query, ingredients)
}