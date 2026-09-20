// ============================================
// Bite Me Baby — Add-on display helpers
// Renders the customer's add-on/topping choices stored in cart customizations
// and order_items.customizations as readable lines:
//   e.g. "➕ Extra cheese (Normal, Extra cheese)  +฿15"
// Prices shown are the advertised unit prices from products.addons; the
// authoritative total is always re-computed server-side (migration 016
// compute_addons_price) — this is purely a display layer.
// ============================================

import type { CartItem, Product, ProductAddon } from '@/types'

export interface AddOnLine {
  groupName: string
  kind: 'radio' | 'checkbox' | 'text'
  selections: string[]
  note?: string
  unitPrice: number
  units: number
  linePrice: number
}

export interface AddOnChoiceSnapshot {
  addonId?: string
  selections?: string[]
  note?: string
}

export function getAddonForId(addons: ProductAddon[] | undefined, addonId: string): ProductAddon | null {
  const list: any[] = Array.isArray(addons) ? addons : []
  return list.find((a) => String(a.id) === String(addonId)) || null
}

/** Resolve raw choices (with optional Addon definitions for names/prices). */
export function addOnLinesFromChoices(
  addons: ProductAddon[] | undefined,
  choices: AddOnChoiceSnapshot[] | undefined,
): AddOnLine[] {
  const raw: AddOnChoiceSnapshot[] = Array.isArray(choices) ? choices : []
  const lines: AddOnLine[] = []
  for (const choice of raw) {
    const addon = choice.addonId ? getAddonForId(addons, choice.addonId) : null
    const selections = Array.isArray(choice.selections) ? choice.selections.map(String) : []
    const note = typeof choice.note === 'string' ? choice.note.trim() : ''
    const isText = addon?.type === 'text'
    const isEmpty = selections.length === 0 && note.trim() === ''
    if (isEmpty && !isText) continue
    const unitPrice = Number(addon?.price ?? 0)
    const units = isText ? (selections.length > 0 || note.trim() !== '' ? 1 : 0) : selections.length
    lines.push({
      groupName: addon?.name || String(choice.addonId || ''),
      kind: addon?.type || 'checkbox',
      selections,
      note: isText ? note : undefined,
      unitPrice,
      units,
      linePrice: unitPrice * units,
    })
  }
  return lines
}

/**
 * Resolve the raw customizations object into readable lines (cart context —
 * the product already carries its addon definitions).
 * customizations look like: { addOns: [{ addonId, selections, note }] }
 */
export function resolveAddOnLines(
  product: Product | null | undefined,
  customizations?: Record<string, any> | null,
): AddOnLine[] {
  if (!product) return []
  return addOnLinesFromChoices(product.addons, customizations?.addOns)
}

/** Client-side add-on estimate for one cart item (server is authoritative). */
export function addOnTotalFor(item: Pick<CartItem, 'product' | 'customizations'>): number {
  return resolveAddOnLines(item.product, item.customizations).reduce((sum, l) => sum + l.linePrice, 0)
}

/** One-line summary e.g. "Sweetness: Normal, Extra cheese (+฿15)" — used in compact rows. */
export function addOnSummaryText(item: Pick<CartItem, 'product' | 'customizations'>): string {
  const lines = resolveAddOnLines(item.product, item.customizations)
  if (lines.length === 0) return ''
  return lines.map((l) => {
    const parts: string[] = []
    if (l.groupName) parts.push(l.groupName)
    if (l.selections.length > 0) parts.push(l.selections.join(', '))
    if (l.note && l.note.trim()) parts.push(`("${l.note.trim()}")`)
    let label = parts.join(': ')
    if (l.linePrice > 0) label += ` +฿${l.linePrice}`
    return label
  }).join(' • ')
}