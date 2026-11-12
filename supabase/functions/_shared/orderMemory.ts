// ============================================
// Bite Me Baby — Order Memory RPCs (R97)
// ============================================
// Order history lookup + modification RPCs for AI worker
// Used to:
//   - Answer "ทบทวน order" queries
//   - Handle cancel/modify order requests
//   - Inject order context into AI responses
//
// CONTRACT:
//   - getCustomerOrders: READ-ONLY, returns last 10 orders
//   - cancelOrder: SOFT DELETE (mark cancelled), requires order_id
//   - modifyOrder: Updates items + recalculates total, requires order_id
//   - All RPCs use service role key (admin authority)
// ============================================

export interface OrderSummary {
  order_id: string
  items: Array<{ name: string; quantity: number; price: number }>
  total: number
  status: 'pending' | 'confirmed' | 'processing' | 'delivered' | 'cancelled'
  created_at: string
}

export interface OrderMemoryDeps {
  sbUrl: string
  serviceKey: string
}

/** Get order history for a customer (last 10 orders) */
export async function getCustomerOrders(
  deps: OrderMemoryDeps,
  customerId: string,
): Promise<OrderSummary[]> {
  try {
    const res = await fetch(
      `${deps.sbUrl}/rest/v1/orders?select=order_id,items,total,status,created_at&customer_id=eq.${encodeURIComponent(customerId)}&order=created_at.desc&limit=10`,
      {
        headers: { apikey: deps.serviceKey, Authorization: `Bearer ${deps.serviceKey}` },
        signal: AbortSignal.timeout(5000),
      },
    )
    if (!res.ok) return []
    const data = await res.json()
    return (data || []).map((o: any) => ({
      order_id: o.order_id,
      items: o.items || [],
      total: o.total,
      status: o.status,
      created_at: o.created_at,
    }))
  } catch {
    return []
  }
}

/** Cancel an order (soft delete — mark as cancelled) */
export async function cancelOrder(
  deps: OrderMemoryDeps,
  orderId: string,
  reason?: string,
): Promise<{ ok: boolean; error?: string }> {
  try {
    const res = await fetch(`${deps.sbUrl}/rest/v1/orders?order_id=eq.${encodeURIComponent(orderId)}`, {
      method: 'PATCH',
      headers: {
        apikey: deps.serviceKey,
        Authorization: `Bearer ${deps.serviceKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        status: 'cancelled',
        cancel_reason: reason || 'cancelled_by_customer',
        cancelled_at: new Date().toISOString(),
      }),
    })
    if (!res.ok) return { ok: false, error: `HTTP ${res.status}` }
    return { ok: true }
  } catch (e) {
    return { ok: false, error: String(e) }
  }
}

/** Update order items (add/remove/modify) */
export async function modifyOrder(
  deps: OrderMemoryDeps,
  orderId: string,
  newItems: Array<{ name: string; quantity: number; note?: string }>,
): Promise<{ ok: boolean; error?: string; newTotal?: number }> {
  try {
    // Fetch products to calculate new total
    const productsRes = await fetch(
      `${deps.sbUrl}/rest/v1/products?select=id,name,price&is_available.eq.true`,
      {
        headers: { apikey: deps.serviceKey, Authorization: `Bearer ${deps.serviceKey}` },
        signal: AbortSignal.timeout(5000),
      },
    )
    if (!productsRes.ok) return { ok: false, error: 'Failed to fetch products' }
    const products = await productsRes.json()
    const productMap = new Map((products || []).map((p: any) => [p.name, p]))

    let newTotal = 0
    const updatedItems = newItems.map((item) => {
      const product = productMap.get(item.name)
      if (!product) return null
      const price = product.price * item.quantity
      newTotal += price
      return {
        product_id: product.id,
        name: item.name,
        quantity: item.quantity,
        note: item.note,
        price,
      }
    }).filter(Boolean)

    const res = await fetch(`${deps.sbUrl}/rest/v1/orders?order_id=eq.${encodeURIComponent(orderId)}`, {
      method: 'PATCH',
      headers: {
        apikey: deps.serviceKey,
        Authorization: `Bearer ${deps.serviceKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        items: updatedItems,
        total: newTotal,
        status: 'pending', // Reset to pending for modification
      }),
    })
    if (!res.ok) return { ok: false, error: `HTTP ${res.status}` }
    return { ok: true, newTotal }
  } catch (e) {
    return { ok: false, error: String(e) }
  }
}

/** Format order history for AI prompt injection */
export function formatOrderHistoryForPrompt(orders: OrderSummary[]): string {
  if (orders.length === 0) return ''
  
  const lines = orders.map((o) => {
    const date = new Date(o.created_at).toLocaleDateString('th-TH', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
    const itemsSummary = o.items.length > 0
      ? o.items.map((i) => `${i.name} x${i.quantity}`).join(', ')
      : 'ไม่มีรายการ'
    return `• ออเดอร์ ${o.order_id} (${date}) — ${o.status} — ฿${o.total} — ${itemsSummary}`
  }).join('\n')

  return `--- ประวัติออเดอร์ล่าสุดของลูกค้า (ข้อมูลจริงจาก DB) ---\n${lines}`
}
