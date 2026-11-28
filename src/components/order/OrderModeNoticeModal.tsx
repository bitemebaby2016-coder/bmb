// ============================================
// Bite Me Baby — OrderModeNoticeModal (R132)
// ============================================
// Global informational popup shown after add-to-cart (mounted by Layout).
// Subscribes to ORDER_MODE_ADD_EVENT (fired by cartStore.addItem on 'added'),
// and shows a one-time-per-mode notice while the per-subject+mode count is
// < NOTICE_MAX. Informational only — the item is already in the cart; a single
// accept button ("เข้าใจแล้ว ดำเนินการต่อ") bumps the counter and closes.
// Address the customer by the name the AI uses (server memory → auth name).
// z-[60] so it sits above OrderBuilderModal (z-50).
// ============================================

import { useEffect, useRef, useState } from 'react'
import type { OrderMode } from '@/config/platformConfig'
import { useAuthStore } from '@/store/authStore'
import { hydrateMemoryFromServer } from '@/lib/aiServerMemory'
import {
  ORDER_MODE_ADD_EVENT,
  noticeSubject,
  shouldShowNotice,
  bumpNoticeCount,
  noticeWho,
  noticeContent,
} from '@/lib/orderNotice'

export function OrderModeNoticeModal() {
  const customer = useAuthStore((s) => s.customer)
  const [open, setOpen] = useState(false)
  const [mode, setMode] = useState<OrderMode>('SAME_DAY')
  const [who, setWho] = useState('คุณ')
  // Ref mirrors `open` so rapid multi-adds are ignored synchronously (a second
  // event in the same tick must not stack a second modal).
  const openRef = useRef(false)

  useEffect(() => {
    if (typeof window === 'undefined') return
    const onAdd = (e: Event) => {
      if (openRef.current) return // already open → ignore (no stacking)
      const detail = (e as CustomEvent).detail as { mode?: OrderMode } | undefined
      const incoming: OrderMode = detail?.mode === 'PRE_ORDER' ? 'PRE_ORDER' : 'SAME_DAY'
      const subject = noticeSubject(customer?.id)
      if (!shouldShowNotice(subject, incoming)) return

      openRef.current = true
      setMode(incoming)
      setOpen(true)

      // Resolve the AI-address name: server memory first, else auth name, else guest.
      void (async () => {
        let name = customer?.name ?? ''
        if (customer?.id) {
          try {
            const mem = await hydrateMemoryFromServer(customer.id)
            if (mem?.name) name = mem.name
          } catch {
            /* offline / no memory = keep auth-name fallback */
          }
        }
        setWho(noticeWho(name))
      })()
    }
    window.addEventListener(ORDER_MODE_ADD_EVENT, onAdd as EventListener)
    return () => window.removeEventListener(ORDER_MODE_ADD_EVENT, onAdd as EventListener)
  }, [customer?.id, customer?.name])

  if (!open) return null

  const content = noticeContent(mode, who)

  const accept = () => {
    bumpNoticeCount(noticeSubject(customer?.id), mode)
    openRef.current = false
    setOpen(false)
  }

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/50"
      role="dialog"
      aria-modal="true"
      aria-label={content.title}
      data-testid="order-mode-notice"
    >
      <div className="w-full max-w-sm rounded-2xl bg-white p-5 shadow-xl">
        <h3 className="text-lg font-bold text-brand-accent">{content.title}</h3>
        <p className="mt-3 text-sm text-brand-muted whitespace-pre-line">{content.body}</p>
        <button
          type="button"
          className="btn btn-primary mt-5 w-full flex flex-col items-center gap-1 py-3"
          onClick={accept}
          data-testid="order-mode-notice-accept"
        >
          <span>{content.button}</span>
          <span className="text-[11px] font-normal opacity-80">{content.hint}</span>
        </button>
      </div>
    </div>
  )
}