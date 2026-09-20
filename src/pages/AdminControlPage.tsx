// ============================================
// Bite Me Baby — Admin Control page shell
// Composes the AdminControl quota/rider dashboard alongside a live order
// state-machine demo timeline.
// ============================================

import { useEffect } from 'react'
import { AdminControl } from '@/components/dashboard/AdminControl'
import { CustomerTimeline } from '@/components/dashboard/CustomerTimeline'
import { useOrderStateMachine } from '@/stores/useOrderStateMachine'

export function AdminControlPage() {
  const init = useOrderStateMachine((s) => s.init)
  const advance = useOrderStateMachine((s) => s.advance)

  useEffect(() => {
    init('PRE_ORDER', 'BMB-ADMIN-DEMO')
  }, [init])

  return (
    <div className="max-w-xl mx-auto px-4 py-6 space-y-5">
      <h1 className="text-2xl font-bold text-brand-accent">🛎️ Admin Control</h1>
      <AdminControl currentOrders={102} />

      <div>
        <div className="flex items-center gap-2 mb-2">
          <h2 className="font-bold text-brand-accent">ตัวอย่าง Timeline (Pre-Order)</h2>
          <button onClick={() => advance()} className="btn btn-outline text-xs" data-testid="advance-status">
            เดินสถานะ ▸
          </button>
        </div>
        <CustomerTimeline orderId="BMB-ADMIN-DEMO" />
      </div>
    </div>
  )
}

