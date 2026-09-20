// ============================================
// Bite Me Baby — Customer Timeline (3D Glassmorphism Status Feed)
// ============================================
// Animates the live order status over a glass timeline. Reads the reactive
// `useOrderStateMachine`. Real-time updates (WebSockets / long-polling) can
// drive `transition()` from the server without touching this component.

import { GlassCard } from '@/components/ui/GlassCard'
import { useOrderStateMachine } from '@/stores/useOrderStateMachine'

export interface CustomerTimelineProps {
  orderId?: string | null
}

const TAG: Record<string, { label: string; icon: string }> = {
  Created: { label: 'รับออเดอร์', icon: '📝' },
  Accepted: { label: 'ร้านยืนยัน', icon: '✅' },
  Preparing: { label: 'กำลังปรุง', icon: '👨‍🍳' },
  'Ready for Pickup': { label: 'พร้อมส่ง', icon: '🛍️' },
  Dispatched: { label: 'ไรเดอร์รับของ', icon: '🛵' },
  Delivered: { label: 'ส่งถึงมือ', icon: '🏠' },
  Booked: { label: 'จองแล้ว', icon: '📅' },
  Allocated: { label: 'จัดสรรสต็อก', icon: '🗂️' },
  'Batch Production': { label: 'กำลังผลิต batch', icon: '🏭' },
  Cancelled: { label: 'ยกเลิก', icon: '❌' },
  Failed: { label: 'ล้มเหลว', icon: '⚠️' },
}

export function CustomerTimeline({ orderId = null }: CustomerTimelineProps) {
  const { status, history, mode } = useOrderStateMachine()

  const activeIndex = history.length - 1

  return (
    <GlassCard className="p-5">
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-bold text-slate-800">ความคืบหน้าออเดอร์</h3>
        <span className="text-xs px-2 py-1 rounded-full bg-white/40 text-slate-600">
          {mode === 'SAME_DAY' ? 'Same-Day' : 'Pre-Order'}
          {orderId ? ` · ${orderId}` : ''}
        </span>
      </div>

      <ol className="relative border-l-2 border-white/40 ml-2 space-y-5" data-testid="customer-timeline">
        {history.map((step, i) => {
          const meta = TAG[step] ?? { label: step, icon: '·' }
          const isActive = i === activeIndex
          const isDone = i < activeIndex
          const isAbort = step === 'Cancelled' || step === 'Failed'
          return (
            <li key={`${step}-${i}`} className="ml-4 relative" data-state={step}>
              <span
                className={`absolute -left-[27px] mt-0.5 flex h-6 w-6 items-center justify-center rounded-full border text-xs ${
                  isAbort
                    ? 'bg-red-100 border-red-300 text-red-600'
                    : isDone
                      ? 'bg-brand-success border-brand-success text-white'
                      : isActive
                        ? 'bg-brand-primary border-brand-primary text-white animate-pulse'
                        : 'bg-white/50 border-white/40 text-slate-400'
                }`}
                aria-hidden="true"
              >
                {isDone ? '✓' : meta.icon}
              </span>
              <p className={`text-sm font-semibold ${isDone || isActive ? 'text-slate-800' : 'text-slate-400'}`}>
                {meta.label}
              </p>
              <p className="text-xs text-slate-400">
                {isActive ? 'สถานะปัจจุบัน' : isDone ? 'สำเร็จ' : 'รอ'}
              </p>
            </li>
          )
        })}
      </ol>

      <p className="mt-4 text-sm font-medium text-slate-600">สถานะปัจจุบัน: {status}</p>
    </GlassCard>
  )
}
