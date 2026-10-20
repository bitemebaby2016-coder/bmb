// ============================================
// Bite Me Baby — SlipThumb (mig 133): transfer-slip preview for admins
// ============================================
// Self-fetching READ-ONLY viewer: loads the order's payment_intents rows,
// finds the slip_path the customer attached, renders a signed-URL thumbnail
// (click = full size). NEVER mutates payment state — the confirm action stays
// canonical via confirm_offline_payment RPC on AdminOrders.

import { useEffect, useState } from 'react'
import { getPaymentIntents, getPaymentSlipSignedUrl } from '@/lib/paymentGateway'

export function SlipThumb({ orderNumber }: { orderNumber: string }) {
  const [signedUrl, setSignedUrl] = useState<string | null>(null)
  const [reference, setReference] = useState('')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    void (async () => {
      try {
        const intents = await getPaymentIntents({ orderNumber })
        const withSlip = intents.find((i) => i.slip_path)
        if (cancelled) return
        const ref = String((intents[0]?.metadata as Record<string, unknown> | undefined)?.reference ?? (withSlip?.metadata as Record<string, unknown> | undefined)?.reference ?? '')
        setReference(ref === 'undefined' ? '' : ref)
        if (withSlip?.slip_path) {
          const url = await getPaymentSlipSignedUrl(withSlip.slip_path)
          if (!cancelled) setSignedUrl(url)
        }
      } catch { /* keep empty */ }
      if (!cancelled) setLoading(false)
    })()
    return () => { cancelled = true }
  }, [orderNumber])

  if (loading) return <span className="text-xs text-brand-muted">…</span>
  if (!signedUrl && !reference) return <span className="text-xs text-brand-muted">—</span>

  return (
    <span className="inline-flex items-center gap-2" data-testid={`slip-thumb-${orderNumber}`}>
      {signedUrl && (
        <a href={signedUrl} target="_blank" rel="noopener" title="ดูสลิปเต็ม">
          <img
            src={signedUrl}
            alt={`สลิปการโอน ${orderNumber}`}
            data-testid="slip-thumb-img"
            className="w-12 h-12 object-cover rounded-lg border-2 border-brand-border"
            loading="lazy"
          />
        </a>
      )}
      {reference && <span className="text-xs text-brand-muted">ref: {reference}</span>}
    </span>
  )
}