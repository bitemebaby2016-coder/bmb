// ============================================
// Bite Me Baby — OrderTimeline (M1 · canonical customer timeline · A5)
// ============================================
// ONE customer timeline, driven by the canonical server enum (migration 001
// `orders.status`) through `lib/orderVocabulary` (PAY-04). Labels come from
// SERVER_STATUS_LABEL_TH ONLY and are unique per step (A5: the old inline map
// showed "กำลังจัดส่ง" on TWO steps — dispatched/in_transit).
// This replaces:
//   - the inline TIMELINE map inside OrderTrackPage.tsx (A5 duplicate bug)
//   - components/customer/CustomerTimeline.tsx + components/dashboard/
//     CustomerTimeline.tsx (a second vocabulary: Created/Booked/… chain)
// UI แสดงตรง DB — ห้ามแต่ง label เองนอก orderVocabulary
// ============================================

import {
  SERVER_ORDER_STATUSES,
  getServerStatusLabel,
  isServerOrderStatus,
  type ServerOrderStatus,
} from '@/lib/orderVocabulary'
import type { OrderMode } from '@/config/platformConfig'

/** Customer-visible forward chain = server enum minus terminal aborts. */
const FORWARD_CHAIN: readonly ServerOrderStatus[] = SERVER_ORDER_STATUSES.filter(
  (s) => s !== 'cancelled' && s !== 'failed',
)

const STEP_ICONS: Record<ServerOrderStatus, string> = {
  pending: '⏳',
  confirmed: '✅',
  preparing: '👨‍🍳',
  ready_for_dispatch: '📦',
  dispatched: '🛵',
  in_transit: '🚗',
  arrived: '📍',
  delivered: '🏁',
  cancelled: '❌',
  failed: '⚠️',
}

export interface OrderTimelineProps {
  /** Canonical server status (`orders.status`) — the only input. */
  status: string
  /** Owner 2026-10-27: ป้ายสถานะแยกชุด sameday/preorder (default = SAME_DAY) */
  mode?: OrderMode
}

export function OrderTimeline({ status, mode = 'SAME_DAY' }: OrderTimelineProps) {
  if (!isServerOrderStatus(status)) {
    // Unknown enum value — show what the server sent, never invent a step.
    return (
      <div className="mb-6 bg-brand-bg p-4 rounded-xl text-center" data-testid="order-timeline">
        <p className="text-sm text-brand-muted">{status}</p>
      </div>
    )
  }

  const label = getServerStatusLabel(status, mode)

  // Terminal aborts render as an end card — no fabricated progress bar.
  if (status === 'cancelled' || status === 'failed') {
    return (
      <div className="mb-6 bg-brand-bg p-4 rounded-xl text-center" data-testid="order-timeline">
        <div className="text-3xl mb-1">{STEP_ICONS[status]}</div>
        <p className="font-bold text-brand-accent">{label}</p>
      </div>
    )
  }

  const activeIdx = FORWARD_CHAIN.indexOf(status);
  return (
    <div className="mb-6" data-testid="order-timeline">
      <div className="flex items-center justify-between relative">
        <div className="absolute top-6 left-0 right-0 h-1 bg-brand-border z-0"></div>
        <div
          className="absolute top-6 left-0 h-1 w-full bg-brand-primary z-0 origin-left transition-transform duration-500"
          style={{ transform: `scaleX(${Math.min(100, (activeIdx / (FORWARD_CHAIN.length - 1)) * 100) / 100})` }}
        ></div>
        {FORWARD_CHAIN.map((step, index) => (
          <div key={step} className="relative z-10 flex flex-col items-center">
            <div className={`w-12 h-12 rounded-full flex items-center justify-center text-xl ${index <= activeIdx ? 'bg-brand-primary text-white' : 'bg-brand-border text-brand-muted'}`}>
              {STEP_ICONS[step]}
            </div>
            <span data-testid="order-timeline-step" className={`text-xs mt-2 text-center ${index <= activeIdx ? 'text-brand-primary font-bold' : 'text-brand-muted'}`}>
              {getServerStatusLabel(step, mode)}
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}