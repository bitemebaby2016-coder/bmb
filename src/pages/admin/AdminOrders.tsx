import { useState, useEffect, useCallback } from 'react'
import { Link } from 'react-router-dom'
import { useNotificationStore } from '@/store/notificationStore'
import { showToast } from '@/components/ui/ToastContainer'
import {
  getOrdersPaged, updateOrderStatus, confirmOfflinePayment, stripeRefundOrder, cancelOrder,
  getDeliveryAssignmentsFor, getOrderStatusHistory, getOrderAuditTrail, getRoundsByIds,
} from '@/lib/bmbAdminApi_orders'
import type { DeliveryAssignmentLiteRow } from '@/lib/bmbAdminApi_orders'
import { getProductsAdmin } from '@/lib/bmbAdminApi_products'
import { addOnLinesFromChoices } from '@/lib/addonDisplay'
import {
  orderModeBadge, paymentStateBadge, deliveryStateBadge,
  nextForwardAction, isCancellable,
} from '@/lib/adminOrderDisplay'
import {
  groupPreOrders, roundCapacityState, roundCutoffState, isPaymentException,
} from '@/lib/preOrderQueue'
import type { RoundLite } from '@/lib/preOrderQueue'
import type { OrderForm } from '@/lib/bmbAdminApi_orders'
import type { Product } from '@/types'
import { useAdminTenantContextStore } from '@/lib/adminTenantContext'

const PAGE_SIZE = 25

const STATUS_FILTERS = [
  { key: 'all', label: 'All' },
  { key: 'pending', label: 'Pending' },
  { key: 'confirmed', label: 'Confirmed' },
  { key: 'preparing', label: 'Preparing' },
  { key: 'ready_for_dispatch', label: 'Ready to dispatch' },
  { key: 'dispatched', label: 'Dispatched' },
  { key: 'in_transit', label: 'In transit' },
  { key: 'arrived', label: 'Arrived' },
  { key: 'delivered', label: 'Delivered' },
  { key: 'cancelled', label: 'Cancelled' },
  { key: 'failed', label: 'Failed' },
] as const

// STEP 3B-2A: operational status â†’ notification event (in-app surface only â€”
// SMS/email/push/LINE/pg_cron remain FROZEN per Owner decision 3).
const statusEventMap: Record<string, 'order_confirmed' | 'order_preparing' | 'order_ready_for_dispatch' | 'order_dispatched' | 'order_delivered'> = {
  confirmed: 'order_confirmed',
  preparing: 'order_preparing',
  ready_for_dispatch: 'order_ready_for_dispatch',
  dispatched: 'order_dispatched',
  delivered: 'order_delivered',
}

export function AdminOrders() {
  const [orders, setOrders] = useState<OrderForm[]>([])
  const [filterStatus, setFilterStatus] = useState('all')
  // STEP 3B-2A: SAME_DAY / PRE_ORDER is a server-side filter (Phase D display only â€”
  // the pre-order queue/cutoff/capacity workflow itself belongs to 3B-2B).
  const [filterMode, setFilterMode] = useState<'all' | 'SAME_DAY' | 'PRE_ORDER'>('all')
  const [productById, setProductById] = useState<Record<string, Product>>({})
  // W4-A: server-side pagination â€” avoids loading the full orders table on every visit.
  const [page, setPage] = useState(0)
  const [total, setTotal] = useState(0)
  const [loadError, setLoadError] = useState('')
  // STEP 3B-2A Phase B: delivery-assignment state per order (migration 020 rows, RLS admin).
  const [assignmentByOrder, setAssignmentByOrder] = useState<Record<string, DeliveryAssignmentLiteRow>>({})
  // STEP 3B-2B: delivery_rounds rows (canonical capacity/cutoff source of truth) for the
  // PRE_ORDER queue header â€” DISPLAY ONLY; server RPCs (025/038) enforce the rules.
  const [roundsById, setRoundsById] = useState<Record<string, RoundLite>>({})
  // Phase C inspection: lazily-loaded lifecycle trace + audit trail per expanded order.
  const [expandedOrder, setExpandedOrder] = useState<string | null>(null)
  const [inspect, setInspect] = useState<{ history: any[]; audit: any[]; loading: boolean }>({ history: [], audit: [], loading: false })

  const loadOrders = useCallback(async (p: number = page, status: string = filterStatus, mode: string = filterMode) => {
    setLoadError('')
    const res = await getOrdersPaged({
      page: p,
      pageSize: PAGE_SIZE,
      status: status === 'all' ? undefined : status,
      
      // TEN-07: filter by active admin branch context\n      branchId: useAdminTenantContextStore.getState().activeBranchId || undefined,
    })
    setOrders(res.orders)
    setTotal(res.total)
    const numbers = res.orders.map((o) => o.order_number)
    const assignments = await getDeliveryAssignmentsFor(numbers)
    const amap: Record<string, DeliveryAssignmentLiteRow> = {}
    for (const a of assignments) amap[a.order_number] = a
    setAssignmentByOrder(amap)
    // 3B-2B: rounds for the current page (queue headers read the DB source of truth)
    const roundIds = Array.from(new Set(res.orders.map((o) => o.delivery_round_id).filter(Boolean))) as string[]
    const rounds = await getRoundsByIds(roundIds)
    const rmap: Record<string, RoundLite> = {}
    for (const r of rounds) rmap[(r as any).id] = r as RoundLite
    setRoundsById(rmap)
    const products = await getProductsAdmin()
    const map: Record<string, Product> = {}
    for (const p of products || []) map[p.id] = p
    setProductById(map)
  }, [page, filterStatus, filterMode])

  useEffect(() => { loadOrders() }, [loadOrders])

  function changeFilter(status: string) {
    setFilterStatus(status)
    setPage(0)
  }
  function changeMode(mode: 'all' | 'SAME_DAY' | 'PRE_ORDER') {
    setFilterMode(mode)
    setPage(0)
  }
  function changePage(p: number) {
    setPage(p)
  }

  async function handleStatusUpdate(orderNumber: string, newStatus: string) {
    // P0-6: transitions are validated server-side (allow-list + trigger);
    // an illegal jump (e.g. skip state) returns null and nothing changes.
    const updated = await updateOrderStatus(orderNumber, newStatus)
    loadOrders()

    if (!updated) {
      showToast(`Cannot change status -> ${newStatus} (state machine rule)`, 'error')
      return
    }

    const eventType = statusEventMap[newStatus]
    if (eventType) {
      useNotificationStore.getState().triggerEvent(eventType, { orderNumber })
    }

    showToast(`Status updated to ${newStatus}`, 'success')
  }

  async function handleConfirmPayment(orderNumber: string) {
    // P0-5: server-authoritative â€” COD requires delivered, PromptPay requires TXN submitted.
    const r = await confirmOfflinePayment(orderNumber)
    loadOrders()

    if (r.success) {
      useNotificationStore.getState().triggerEvent('payment_confirmed', { orderNumber })
      showToast('Payment confirmed', 'success')
    } else {
      showToast(r.error || 'Cannot confirm (rule: delivered/TXN)', 'error')
    }
  }

async function handleStripeRefund(orderNumber: string) {
    // C-6: server-side Stripe refund (admin-only EF). Full refund by default.
    const r = await stripeRefundOrder(orderNumber)
    loadOrders()
    if (r.success) {
      showToast(`Refund successful (${r.data?.payment_status || 'refund'})`, 'success')
    } else {
      showToast(r.error || 'Refund failed', 'error')
    }
  }

  // STEP 3B-2A GAP-A2: admin cancellation goes through the canonical ATOMIC
  // `cancel_order` RPC (authz + capacity release + inventory restore + delivery-
  // assignment cancel + audit in ONE transaction) â€” NOT transition_order_status.
  async function handleCancelOrder(orderNumber: string) {
    const reason = window.prompt(`Cancel reason for ${orderNumber} (optional)`)
    if (reason === null) return // operator aborted the prompt
    const r = await cancelOrder(orderNumber, reason)
    await loadOrders()
    if (r.success) {
      showToast(
        r.idempotent ? 'Already cancelled' : `Cancelled (${r.previous_status})${r.capacity_released ? ' Â· round capacity released' : ''}${r.inventory_restored ? ' Â· inventory restored' : ''}`,
        'success',
      )
      if (r.note) showToast(r.note, 'info')
    } else {
      showToast(r.error || 'Cannot cancel', 'error')
    }
  }

  // Phase C inspection: status history (order_status_history, migration 040) +
  // audit trail (audit_logs, migration 018) â€” both admin-RLS read-only.
  async function toggleInspect(orderNumber: string) {
    if (expandedOrder === orderNumber) {
      setExpandedOrder(null)
      return
    }
    setExpandedOrder(orderNumber)
    setInspect({ history: [], audit: [], loading: true })
    const [history, audit] = await Promise.all([
      getOrderStatusHistory(orderNumber),
      getOrderAuditTrail(orderNumber),
    ])
    setInspect({ history, audit, loading: false })
  }

  // W4-A: server already filtered the current page â€” no client re-filter.
  const filteredOrders = orders

  // STEP 3B-2B: PRE_ORDER queue grouping (display only â€” canonical spine columns)
  const preGroupsByKey: Record<string, ReturnType<typeof groupPreOrders>[number]> = {}
  if (filterMode === 'PRE_ORDER') {
    for (const g of groupPreOrders(filteredOrders)) preGroupsByKey[g.key] = g
  }

  return (
    <div className="max-w-7xl mx-auto px-4 py-6">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-3xl font-bold text-brand-accent">ðŸ“‹ Manage Orders</h1>
        <Link to="/admin" className="btn btn-outline">â† Dashboard</Link>
      </div>

      <div className="flex gap-2 mb-2 overflow-x-auto">
        {STATUS_FILTERS.map((status) => (
          <button
            key={status.key}
            onClick={() => changeFilter(status.key)}
            className={`px-4 py-2 rounded-full font-medium whitespace-nowrap transition-all ${
              filterStatus === status.key ? 'bg-brand-primary text-white' : 'bg-brand-surface text-brand-accent hover:bg-brand-bg'
            }`}
          >
            {status.label}
          </button>
        ))}
      </div>

      {/* STEP 3B-2A GAP-A4: SAME_DAY / PRE_ORDER distinguishable at filter level (display only) */}
      <div className="flex gap-2 mb-6">
        {([
          { key: 'all', label: 'All modes' },
          { key: 'SAME_DAY', label: 'âš¡ SAME_DAY' },
          { key: 'PRE_ORDER', label: 'ðŸ“… PRE_ORDER' },
        ] as const).map((mode) => (
          <button
            key={mode.key}
            onClick={() => changeMode(mode.key)}
            className={`px-4 py-2 rounded-full font-medium whitespace-nowrap transition-all text-sm ${
              filterMode === mode.key ? 'bg-brand-accent text-white' : 'bg-brand-surface text-brand-accent hover:bg-brand-bg'
            }`}
          >
            {mode.label}
          </button>
        ))}
      </div>
<div className="space-y-4">
        {filteredOrders.map((order) => {
          const modeBadge = orderModeBadge(order.order_mode, order.scheduled_date)
          const payBadge = paymentStateBadge(order.payment_status)
          const dlvBadge = deliveryStateBadge(assignmentByOrder[order.order_number])
          const forward = nextForwardAction(order.status)
          // 3B-2B queue context: group header before the first order of each (date|round) group
          const grp = filterMode === 'PRE_ORDER' ? preGroupsByKey[`${order.scheduled_date || 'â€”'}|${order.delivery_round_id || 'â€”'}`] : null
          const cap = grp ? roundCapacityState(roundsById[grp.roundId] ?? null, grp.orders.length) : null
          const cut = grp ? roundCutoffState(roundsById[grp.roundId] ?? null) : null
          const payExcCount = grp ? grp.orders.filter((o) => isPaymentException(o.payment_status)).length : 0
          return (
          <div key={order.id}>
          {grp && grp.orders[0].order_number === order.order_number && (
            <div className="card mb-2" data-testid="preorder-queue-header">
              <div className="flex flex-wrap items-center gap-2 text-sm">
                <span className="font-bold text-brand-accent">ðŸ“… {grp.scheduledDate}</span>
                <span className="badge badge-primary">{grp.roundId}</span>
                {roundsById[grp.roundId]?.display_name && <span className="badge badge-primary">{roundsById[grp.roundId].display_name}</span>}
                <span className={`badge ${cap!.cls}`}>{cap!.label}</span>
                <span className="badge badge-info">{cut!.label}</span>
                {roundsById[grp.roundId]?.status && <span className="badge badge-primary">round: {roundsById[grp.roundId].status}</span>}
                {payExcCount > 0 && <span className="badge badge-warning">âš  payment needs attention: {payExcCount}</span>}
                <span className="text-brand-muted">({grp.orders.length} orders)</span>
              </div>
            </div>
          )}
          <div className="card">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-brand-primary rounded-full flex items-center justify-center text-white font-bold">
                  {order.order_number.slice(-3)}
                </div>
                <div>
                  <div className="font-bold text-brand-accent">{order.order_number}</div>
                  <div className="text-sm text-brand-muted">
                    {order.customer_name} â€¢ {order.customer_phone} â€¢ {new Date(order.created_at).toLocaleTimeString('en', { hour: '2-digit', minute: '2-digit' })}
                  </div>
                  {/* STEP 3B-2A GAP-A3: mode / scheduled date / round / payment / delivery badges */}
                  <div className="flex flex-wrap gap-1 mt-1 text-xs" data-testid="admin-order-badges">
                    <span className={`badge ${modeBadge.mode === 'PRE_ORDER' ? 'badge-warning' : modeBadge.mode === 'SAME_DAY' ? 'badge-info' : 'badge-danger'}`}>
                      {modeBadge.label}
                    </span>
                    <span className="badge badge-primary">Round {order.delivery_round_id || 'â€”'}</span>
                    <span className={`badge ${payBadge.cls}`}>{payBadge.label}</span>
                    <span className="badge badge-primary">{order.payment_method || 'â€”'}</span>
                    <span className={`badge ${dlvBadge.cls}`} data-testid="admin-order-delivery-state">{dlvBadge.label}</span>
                  </div>
                </div>
              </div>
              <div className="text-right">
                <div className="font-bold text-brand-primary">à¸¿{order.total_amount}</div>
                <span className={`badge ${
                  order.status === 'delivered' ? 'badge-success' :
                  order.status === 'preparing' ? 'badge-info' :
                  order.status === 'pending' ? 'badge-warning' : 'badge-primary'
                }`} data-testid="admin-order-status">
                  {order.status}
                </span>
              </div>
            </div>

            <div className="text-sm text-brand-muted mb-3">
              <strong>Items:</strong>
              <ul className="mt-1 space-y-1" data-testid="admin-order-items">
                {order.items.map((i) => {
                  const addonLines = addOnLinesFromChoices(productById[i.product_id]?.addons, i.customizations?.addOns)
                  return (
                    <li key={i.product_id} className="flex items-baseline justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        <span className="font-medium text-brand-accent">{i.product_name}</span>
                        <span className="text-brand-muted"> Ã— {i.quantity}</span>
                        {addonLines.length > 0 && (
                          <ul className="pl-3 text-xs text-brand-muted list-disc list-inside">
                            {addonLines.map((line) => (
                              <li key={line.groupName}>
                                {line.groupName}{line.selections.length > 0 ? `: ${line.selections.join(', ')}` : ''}{line.note ? ` Â· "${line.note.trim()}"` : ''}
                                {line.linePrice > 0 ? `  +à¸¿${line.linePrice}` : ''}
                              </li>
                            ))}
                          </ul>
                        )}
                        {i.special_request && <div className="text-xs text-brand-muted italic">â€œ{i.special_request}â€</div>}
                      </div>
                      <span className="whitespace-nowrap">à¸¿{Number(i.unit_price || 0).toFixed(2)}</span>
                    </li>
                  )
                })}
              </ul>
            </div>

            <div className="flex flex-wrap gap-2">
              {/* STEP 3B-2A GAP-A1: ONLY the canonical next hop (008 allow-list mirror).
                  The server (transition_order_status RPC + guard trigger) remains the
                  authority â€” an off-list click is still rejected server-side. */}
              {forward && (
                <button onClick={() => handleStatusUpdate(order.order_number, forward.to)} className="btn btn-primary text-sm">
                  {forward.label}
                </button>
              )}

              {/* GAP-A2: canonical atomic cancel via cancel_order RPC (any non-terminal state) */}
              {isCancellable(order.status) && (
                <button onClick={() => handleCancelOrder(order.order_number)} className="btn btn-danger text-sm">âœ– Cancel</button>
              )}

              {/* Phase C inspection: lifecycle history + audit trail (read-only, admin RLS) */}
              <button onClick={() => toggleInspect(order.order_number)} className="btn btn-outline text-sm" data-testid={`admin-order-inspect-${order.order_number}`}>
                ðŸ•˜ History / Audit
              </button>

              {order.payment_status === 'pending' && (
                <button onClick={() => handleConfirmPayment(order.order_number)} className="btn btn-success text-sm">ðŸ’° Confirm payment</button>
              )}
              {order.payment_method === 'credit_card' && (order.payment_status === 'paid' || order.payment_status === 'partially_refunded') && (
                    <button onClick={() => handleStripeRefund(order.order_number)} className="btn btn-outline text-sm">ðŸ’¸ Refund (Stripe)</button>
                  )}

              <button className="btn btn-outline text-sm ml-auto">ðŸ“ž Call</button>
            </div>

            {expandedOrder === order.order_number && (
              <div className="mt-3 rounded-lg border border-brand-muted/30 p-3 text-xs" data-testid="admin-order-inspect-panel">
                {inspect.loading && <div className="text-brand-muted">Loading lifecycleâ€¦</div>}
                {!inspect.loading && (
                  <>
                    <div className="font-bold text-brand-accent mb-1">Status history (order_status_history)</div>
                    {inspect.history.length === 0 && <div className="text-brand-muted mb-2">No history rows (or not permitted).</div>}
                    <ul className="space-y-0.5 mb-3">
                      {inspect.history.map((h) => (
                        <li key={h.id}>
                          {h.from_status ? `${h.from_status} â†’ ` : 'create â†’ '}{h.to_status}
                          {' Â· '}{new Date(h.changed_at).toLocaleString()}
                          {' Â· '}{h.actor_type}{h.reason ? ` Â· â€œ${h.reason}â€` : ''}
                        </li>
                      ))}
                    </ul>
                    <div className="font-bold text-brand-accent mb-1">Audit trail (audit_logs Â· entity=order)</div>
                    {inspect.audit.length === 0 && <div className="text-brand-muted">No audit rows for this order.</div>}
                    <ul className="space-y-0.5">
                      {inspect.audit.map((a) => (
                        <li key={a.id}>
                          {a.action}{' Â· '}{new Date(a.created_at || a.timestamp).toLocaleString()}
                          {a.description ? ` Â· ${a.description}` : ''}
                        </li>
                      ))}
                    </ul>
                  </>
                )}
              </div>
            )}
          </div>
          </div>
          )
        })}
      </div>

      {filteredOrders.length === 0 && (
        <div className="text-center py-12">
          <div className="text-6xl mb-4">ðŸ“‹</div>
          <h3 className="text-xl font-bold text-brand-accent">No orders found</h3>
        </div>
      )}

      {/* W4-A pagination */}
      <div className="flex items-center justify-between mt-4 text-sm">
        <button
          disabled={page === 0}
          onClick={() => changePage(Math.max(0, page - 1))}
          className="px-3 py-1 rounded-lg border disabled:opacity-40"
        >â† à¸à¹ˆà¸­à¸™à¸«à¸™à¹‰à¸²</button>
        <span className="text-xs text-brand-muted">
          à¸«à¸™à¹‰à¸² {page + 1} Â· à¸—à¸±à¹‰à¸‡à¸«à¸¡à¸” {total} à¸­à¸­à¹€à¸”à¸­à¸£à¹Œ
        </span>
        <button
          disabled={(page + 1) * PAGE_SIZE >= total}
          onClick={() => changePage(page + 1)}
          className="px-3 py-1 rounded-lg border disabled:opacity-40"
        >à¸–à¸±à¸”à¹„à¸› â†’</button>
      </div>
    </div>
  )
}
