// ============================================
// Bite Me Baby — Customer Order Timeline (Glass UI)
// ============================================

import { SAME_DAY_CHAIN, PRE_ORDER_CHAIN, type OrderFlowStatus } from '@/lib/orderStateMachine'

export interface CustomerTimelineProps {
  orderId: string
  orderNumber: string
  mode: 'SAME_DAY' | 'PRE_ORDER'
  currentStatus: OrderFlowStatus
}

const STATUS_ICONS: Record<OrderFlowStatus, string> = {
  'Created': '🛒', 'Accepted': '✅', 'Preparing': '👨‍🍳',
  'Booked': '📋', 'Allocated': '📦', 'Batch Production': '🏭',
  'Ready for Pickup': '🔔', 'Dispatched': '🚀', 'Delivered': '🎉',
  'Cancelled': '❌', 'Failed': '⚠️',
}

const STATUS_LABELS: Record<OrderFlowStatus, string> = {
  'Created': 'รับออเดอร์แล้ว', 'Accepted': 'ร้านยอมรับ', 'Preparing': 'เตรียมอาหาร',
  'Booked': 'จองไว้แล้ว', 'Allocated': 'จัดสรรสินค้า', 'Batch Production': 'ผลิตเป็นชุด',
  'Ready for Pickup': 'พร้อมส่ง', 'Dispatched': 'ไรเดอร์เดินทาง', 'Delivered': 'จัดส่งสำเร็จ',
  'Cancelled': 'ยกเลิก', 'Failed': 'ล้มเหลว',
}

function getStepIndex(mode: string, status: OrderFlowStatus): number {
  const chain = mode === 'SAME_DAY' ? SAME_DAY_CHAIN : PRE_ORDER_CHAIN
  return chain.indexOf(status as any)
}

const groups: Array<{ label: string; statuses: OrderFlowStatus[] }> = [
  { label: 'ยืนยันคำสั่งซื้อ', statuses: ['Created', 'Accepted'] },
  { label: 'เตรียม/ผลิต', statuses: ['Preparing', 'Booked', 'Allocated', 'Batch Production'] },
  { label: 'พร้อมส่ง-เสร็จสิ้น', statuses: ['Ready for Pickup', 'Dispatched', 'Delivered'] },
]

function getStatusGroup(status: OrderFlowStatus): string {
  for (const g of groups) if (g.statuses.includes(status)) return g.label
  return ''
}

export function CustomerTimeline({ orderId, orderNumber, mode, currentStatus }: CustomerTimelineProps) {
  const chain = mode === 'SAME_DAY' ? SAME_DAY_CHAIN : PRE_ORDER_CHAIN
  const currentIdx = getStepIndex(mode, currentStatus)
  const totalSteps = chain.length
  const isTerminal = ['Delivered', 'Cancelled', 'Failed'].includes(currentStatus)

  return (
    <div className="glass-card p-6 rounded-2xl max-w-2xl mx-auto" data-testid="customer-timeline">
      {/* Header */}
      <div className="flex items-center justify-between mb-6 pb-4 border-b border-white/20">
        <div>
          <h3 className="text-lg font-bold text-brand-accent">ติดตามคำสั่งซื้อ</h3>
          <p className="text-sm text-brand-muted">{orderNumber} • {orderId.slice(0, 8)}</p>
        </div>
        <span className={`px-3 py-1 rounded-full text-xs font-semibold ${
          isTerminal
            ? currentStatus === 'Delivered' ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'
            : 'bg-amber-100 text-amber-700 animate-pulse'
        }`}>
          {STATUS_ICONS[currentStatus]} {STATUS_LABELS[currentStatus]}
        </span>
      </div>

      {/* Progress Bar with Steps */}
      <div className="relative mb-8">
        <div className="absolute left-4 top-6 bottom-6 w-1 bg-slate-200 rounded" />
        <div
          className="absolute left-4 top-6 w-1 bg-gradient-to-b from-brand-primary to-brand-secondary rounded transition-all duration-500"
          style={{ height: `${(currentIdx / Math.max(totalSteps - 1, 1)) * ((totalSteps - 1) * 100)}%` }}
        />
        <div className="relative flex justify-between pl-4">
          {chain.map((step, idx) => {
            const isActive = idx <= currentIdx && !isTerminal
            const isPast = idx < currentIdx || isTerminal
            const label = STATUS_LABELS[step]
            const icon = STATUS_ICONS[step]
            return (
              <div key={step} className="flex flex-col items-center min-w-[50px]" title={`${getStatusGroup(step)}: ${label}`}>
                <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm border-2 transition-all duration-300 ${
                  isActive ? 'border-brand-primary bg-brand-primary text-white scale-110 shadow-lg shadow-brand-primary/30'
                    : isPast ? 'border-emerald-500 bg-emerald-500 text-white'
                    : 'border-slate-300 bg-white text-slate-400'
                }`}>{icon}</div>
                <span className={`mt-1 text-[10px] text-center leading-tight ${isActive ? 'font-bold text-brand-primary' : isPast ? 'text-emerald-600' : 'text-slate-400'}`}>
                  {label.split(' ').slice(0, 2).join(' ')}
                </span>
              </div>
            )
          })}
        </div>
      </div>

      {/* Phase Groups */}
      <div className="grid grid-cols-3 gap-4 mb-4">
        {groups.map(g => {
          const isComplete = g.statuses.every(s => chain.indexOf(s as any) < currentIdx)
          const isCurrent = g.statuses.includes(currentStatus)
          return (
            <div key={g.label} className={`rounded-xl p-3 text-center ${isCurrent ? 'bg-brand-primary/10 border-2 border-brand-primary/30 shadow-md' : isComplete ? 'bg-emerald-50/50 border border-emerald-200' : 'bg-slate-50/50 border border-slate-200'}`}>
              <p className={`text-xs font-semibold ${isCurrent ? 'text-brand-primary' : isComplete ? 'text-emerald-600' : 'text-slate-400'}`}>{g.label}</p>
            </div>
          )
        })}
      </div>
    </div>
  )
}