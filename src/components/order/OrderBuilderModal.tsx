// ============================================
// Bite Me Baby — OrderBuilderModal (upsell / add-on / topping sheet)
// Rendered globally by Layout. Style: bottom sheet on mobile, centered on desktop.
// ============================================

import { useEffect, useState } from 'react'
import type { Product, ProductAddon } from '@/types'
import { useOrderBuilderStore, pickRecommendations, type AddOnChoice, type OrderBuilderResult } from '@/store/orderBuilderStore'
import { showToast } from '@/components/ui/ToastContainer'

interface AddOnSelectionState {
  selected: string[]
  note: string
}

export function OrderBuilderModal() {
  const { open, product, catalog, onConfirm, closeBuilder } = useOrderBuilderStore()
  const [quantity, setQuantity] = useState(1)
  const [addOns, setAddOns] = useState<Record<string, AddOnSelectionState>>({})
  const [recommendedIds, setRecommendedIds] = useState<Set<string>>(new Set())
  const [recCandidates, setRecCandidates] = useState<Product[]>([])

  useEffect(() => {
    if (open && product) {
      setQuantity(1)
      setAddOns({})
      setRecommendedIds(new Set())
      setRecCandidates(pickRecommendations(product, catalog))
    }
  }, [open, product, catalog])

  if (!open || !product) return null

  const addonsList: ProductAddon[] = Array.isArray(product.addons) ? product.addons : []

  function selectedCount(addonId: string): number {
    return (addOns[addonId]?.selected ?? []).length
  }

  function toggleOption(addon: ProductAddon, option: string) {
    const cur = addOns[addon.id]?.selected ?? []
    if (cur.includes(option)) {
      setAddOns({ ...addOns, [addon.id]: { ...(addOns[addon.id] ?? { note: '' }), selected: cur.filter((o) => o !== option) } })
      return
    }
    if (cur.length >= addon.max_selections) {
      showToast(`Maximum ${addon.max_selections} selections for "${addon.name}"`, 'warning')
      return
    }
    setAddOns({ ...addOns, [addon.id]: { ...(addOns[addon.id] ?? { note: '' }), selected: [...cur, option] } })
  }

  function setRadio(addon: ProductAddon, option: string) {
    setAddOns({ ...addOns, [addon.id]: { ...(addOns[addon.id] ?? { note: '' }), selected: [option] } })
  }

  function setNote(addonId: string, note: string) {
    const base = addOns[addonId] ?? { selected: [], note: '' }
    setAddOns({ ...addOns, [addonId]: { ...base, note } })
  }

  // Server mirrors this math (migration 016 compute_addons_price).
  function addOnTotal(): number {
    let total = 0
    for (const addon of addonsList) {
      const state = addOns[addon.id]
      if (!state) continue
      const count = state.selected.length
      if (addon.type === 'text') {
        if (count > 0 || state.note.trim() !== '') total += Number(addon.price) || 0
      } else {
        total += (Number(addon.price) || 0) * count
      }
    }
    return total
  }

  const recTotal = recommendedIds.size > 0
    ? Array.from(recommendedIds).reduce((sum, id) => {
        const p = recCandidates.find((c) => c.id === id)
        return sum + (p ? Number(p.price) || 0 : 0)
      }, 0)
    : 0

  const unitTotal = (Number(product.price) || 0) + addOnTotal()
  const grandTotal = unitTotal * quantity + recTotal

  function confirm() {
    const result: OrderBuilderResult = {
      product: product as Product,
      quantity: Math.max(1, quantity),
      addOns: addonsList
        .map((a) => {
          const s = addOns[a.id]
          if (!s) return null
          return {
            addonId: a.id,
            addonName: a.name,
            selections: s.selected,
            note: a.type === 'text' ? s.note : undefined,
          } as AddOnChoice
        })
        .filter(Boolean) as AddOnChoice[],
      addOnTotal: addOnTotal(),
      recommended: Array.from(recommendedIds)
        .map((id) => recCandidates.find((c) => c.id === id))
        .filter((p) => !!p) as Product[],
    }
    onConfirm?.(result)
    closeBuilder()
  }

  const recommendations = recCandidates.filter((c) => !recommendedIds.has(c.id))
return (
    <div className="ob-backdrop" role="dialog" aria-modal="true" aria-label={`Customize ${product.name}`} onClick={closeBuilder}>
      <div className="ob-sheet" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="ob-header">
          <div className="flex items-center gap-3 min-w-0">
            {product.image_url ? (
              <img src={product.image_url} alt={product.name} className="ob-thumb" loading="lazy" />
            ) : (
              <img src="/images/mock/food-mock.svg" alt={product.name} className="ob-thumb" loading="lazy" />
            )}
            <div className="min-w-0">
              <h3 className="font-bold text-brand-accent truncate">{product.name}</h3>
              <div className="text-sm text-brand-muted">฿{Number(product.price) || 0}</div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button type="button" className="ob-qty-btn" aria-label="Decrease quantity" onClick={() => setQuantity(Math.max(1, quantity - 1))}>−</button>
            <span data-testid="ob-quantity" className="ob-qty">{quantity}</span>
            <button type="button" className="ob-qty-btn" aria-label="Increase quantity" onClick={() => setQuantity(Math.min(99, quantity + 1))}>+</button>
            <button type="button" className="ob-close" aria-label="Close" onClick={closeBuilder}>✕</button>
          </div>
        </div>

        <div className="ob-body">
          {/* Add-ons / toppings */}
          {addonsList.length > 0 && (
            <section className="ob-section">
              <h4 className="ob-section-title">➕ Toppings / Add-ons</h4>
              {addonsList.map((addon) => (
                <div key={addon.id} className="ob-addon" data-testid="ob-addon">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-medium">{addon.name}</span>
                    <span className="text-xs text-brand-muted">+฿{Number(addon.price) || 0}</span>
                  </div>

                  {addon.type === 'radio' && (
                    <div className="ob-options">
                      {addon.options.map((opt) => (
                        <button
                          key={opt}
                          type="button"
                          className={`ob-chip ${(addOns[addon.id]?.selected ?? []).includes(opt) ? 'ob-chip--on' : ''}`}
                          onClick={() => setRadio(addon, opt)}
                        >
                          {opt}
                        </button>
                      ))}
                    </div>
                  )}

                  {addon.type === 'checkbox' && (
                    <div className="ob-options">
                      {addon.options.map((opt) => (
                        <button
                          key={opt}
                          type="button"
                          className={`ob-chip ${(addOns[addon.id]?.selected ?? []).includes(opt) ? 'ob-chip--on' : ''}`}
                          onClick={() => toggleOption(addon, opt)}
                        >
                          {opt}
                        </button>
                      ))}
                      <div className="text-xs text-brand-muted">
                        {selectedCount(addon.id)}/{addon.max_selections} selected
                      </div>
                    </div>
                  )}

                  {addon.type === 'text' && (
                    <textarea
                      className="input mt-1"
                      rows={1}
                      placeholder="e.g. half sauce, no onions..."
                      value={addOns[addon.id]?.note ?? ''}
                      onChange={(e) => setNote(addon.id, e.target.value)}
                    />
                  )}
                </div>
              ))}
            </section>
          )}
{/* Upsell recommendations */}
          {recommendations.length > 0 && (
            <section className="ob-section">
              <h4 className="ob-section-title">✨ You might also like</h4>
              <div className="ob-recs" data-testid="ob-recs">
                {recommendations.map((rec) => {
                  const on = recommendedIds.has(rec.id)
                  return (
                    <div key={rec.id} className="ob-rec">
                      <div className="ob-rec-info">
                        {rec.image_url ? (
                          <img src={rec.image_url} alt={rec.name} className="ob-rec-img" loading="lazy" />
                        ) : (
                          <img src="/images/mock/food-mock.svg" alt={rec.name} className="ob-rec-img" loading="lazy" />
                        )}
                        <div className="min-w-0">
                          <div className="font-medium text-sm truncate">{rec.name}</div>
                          <div className="text-xs text-brand-muted">฿{Number(rec.price) || 0}</div>
                        </div>
                      </div>
                      <button
                        type="button"
                        className={`ob-chip ${on ? 'ob-chip--on' : ''}`}
                        onClick={() => {
                          const next = new Set(recommendedIds)
                          if (on) next.delete(rec.id)
                          else next.add(rec.id)
                          setRecommendedIds(next)
                        }}
                        aria-pressed={on}
                      >
                        {on ? '✓ Added' : '+ Add'}
                      </button>
                    </div>
                  )
                })}
              </div>
            </section>
          )}

          {!addonsList.length && recommendations.length === 0 && (
            <p className="text-sm text-brand-muted">This item has no extras available.</p>
          )}
        </div>

        {/* Footer */}
        <div className="ob-footer">
          <div className="text-sm text-brand-muted" data-testid="ob-item-total">
            {quantity} × ฿{unitTotal.toFixed(2)}{recTotal > 0 ? ` + ฿${recTotal.toFixed(2)} recommended` : ''}
          </div>
          <button
            type="button"
            data-testid="ob-confirm"
            className="btn btn-primary ob-confirm"
            onClick={confirm}
          >
            Add to cart · ฿{grandTotal.toFixed(2)}
          </button>
        </div>
      </div>
    </div>
  )
}