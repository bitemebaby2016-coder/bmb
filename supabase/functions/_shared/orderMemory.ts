// ============================================
// Bite Me Baby — Order Memory RPCs (R97 · fix 2026-11-15)
// ============================================
// Order history lookup + cancel for AI worker (social-ai-worker)
//
// BUGS ที่พิสูจน์จากโค้ดเดิม (ทำให้ R97 ไม่เคยทำงานจริง — แก้แล้ว):
//   ① getCustomerOrders ยิง `orders.customer_id=eq.<PSID>` — แต่ orders.customer_id
//      เก็บ auth uuid (025:307 `v_uid::text`) ไม่ใช่ PSID → ไม่มีวัน match
//      → ต้อง resolve PSID → customer_ref ผ่าน customer_channel_identities (046) ก่อน
//   ② select `items,total,order_id` — คอลัมน์เหล่านี้ไม่มีใน orders (จริงคือ
//      total_amount · id/order_number · items อยู่ตารางลูก order_items) → PostgREST
//      400 ทุกครั้ง → history ว่างเสมอ
//   ③ cancelOrder PATCH orders ตรง — bypass canonical `cancel_order` RPC (025/195)
//      = capacity ไม่ release · inventory ไม่ restore · payment ไม่ void · ไม่มี audit
//      → แก้เป็น RPC `cancel_order_as_customer` (205) ซึ่งตรวจผูกตัวตนแล้วเรียก
//      canonical cancel_order ภายใต้ JWT claims ของลูกค้า = logic 025/195 ครบทุกขั้น
//   ④ modifyOrder PATCH items/total ตรง + query `is_available.eq.true` ผิดรูปแบบ —
//      bypass authority ตั้งแต่ต้น → ลบทิ้ง: การแก้ไขออเดอร์ผ่าน AI ใช้แนวเดียวกับเว็บ
//      (TalkToBite.handleModifyOrder) = cancel canonical + สร้างใหม่ผ่าน intake (205 flow)
//
// CONTRACT:
//   - resolveCustomerRef: READ-ONLY customer_channel_identities (PSID → auth uuid)
//   - getCustomerOrders: READ-ONLY, รับ customer_ref (uuid), คืน 10 ใบล่าสุด + items จริง
//   - cancelOrder: ผ่าน cancel_order_as_customer (guard ผูกตัวตน + canonical logic)
//   - READ-ONLY ยกเว้น cancelOrder — ห้ามแตะ business authority ของออเดอร์คนอื่น
// ============================================

export interface OrderSummary {
  order_id: string
  order_number: string
  items: Array<{ name: string; quantity: number; price: number }>
  total: number
  status: string
  order_mode: string
  payment_status: string
  customer_name: string
  customer_phone: string
  address: string
  scheduled_date: string | null
  created_at: string
}

export interface OrderMemoryDeps {
  sbUrl: string
  serviceKey: string
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

function headers(deps: OrderMemoryDeps): HeadersInit {
  return { apikey: deps.serviceKey, Authorization: `Bearer ${deps.serviceKey}` }
}

async function restGet(deps: OrderMemoryDeps, path: string, timeoutMs = 6000): Promise<any[] | null> {
  try {
    const res = await fetch(deps.sbUrl + path, {
      headers: headers(deps),
      signal: AbortSignal.timeout(timeoutMs),
    })
    if (!res.ok) return null
    const j = await res.json().catch(() => null)
    return Array.isArray(j) ? j : null
  } catch {
    return null
  }
}

/**
 * Resolve ตัวตนช่องทางโซเชียล (PSID) → canonical customer (auth uuid) ผ่าน
 * customer_channel_identities (046 spine — ตารางเดียวกับ webhook/intake)
 * คืน null เมื่อไม่มี identity ผูกอยู่ (ไม่เดาว่าเป็นลูกค้าคนเดียวกัน)
 */
export async function resolveCustomerRef(
  deps: OrderMemoryDeps,
  senderId: string,
): Promise<string | null> {
  if (!senderId) return null
  if (UUID_RE.test(senderId)) return senderId // uuid อยู่แล้ว = ใช้ตรงได้
  const rows = await restGet(
    deps,
    `/rest/v1/customer_channel_identities?external_user_id=eq.${encodeURIComponent(senderId)}` +
      '&channel=in.(FACEBOOK,MESSENGER)&select=customer_ref&limit=5',
  )
  if (!rows || rows.length === 0) return null
  const ref = rows[0]?.customer_ref
  return ref ? String(ref) : null
}

/** ดึง items จริงของหลายออเดอร์ในครั้งเดียว (order_items — ตารางลูก) */
async function loadItemsForOrders(
  deps: OrderMemoryDeps,
  orderIds: string[],
): Promise<Map<string, Array<{ name: string; quantity: number; price: number }>>> {
  const map = new Map<string, Array<{ name: string; quantity: number; price: number }>>()
  if (orderIds.length === 0) return map
  const rows = await restGet(
    deps,
    `/rest/v1/order_items?order_id=in.(${encodeURIComponent(orderIds.join(','))})` +
      '&select=order_id,product_name,quantity,unit_price',
  )
  if (!rows) return map
  for (const r of rows as any[]) {
    const oid = String(r.order_id || '')
    if (!oid) continue
    const list = map.get(oid) || []
    list.push({
      name: String(r.product_name || r.product_id || 'รายการ'),
      quantity: Number(r.quantity || 1),
      price: Number(r.unit_price || 0),
    })
    map.set(oid, list)
  }
  return map
}

/**
 * ประวัติออเดอร์ของลูกค้า (10 ใบล่าสุด) — รับ customer_ref (auth uuid) เสมอ
 * worker: เรียก resolveCustomerRef(senderId) ก่อนแล้วส่ง uuid มาที่นี่
 * อ่านไม่ได้ = [] (ไม่เดา — ห้ามให้ AI แต่งประวัติ)
 */
export async function getCustomerOrders(
  deps: OrderMemoryDeps,
  customerRef: string,
): Promise<OrderSummary[]> {
  if (!customerRef || !UUID_RE.test(customerRef)) return []
  const rows = await restGet(
    deps,
    `/rest/v1/orders?customer_ref=eq.${encodeURIComponent(customerRef)}` +
      '&select=id,order_number,total_amount,status,order_mode,payment_status,customer_name,customer_phone,dropoff_detail,scheduled_date,created_at' +
      '&order=created_at.desc&limit=10',
  )
  if (!rows) return []
  const itemsByOrder = await loadItemsForOrders(deps, rows.map((r: any) => String(r.id)).filter(Boolean))
  return (rows as any[]).map((o) => ({
    order_id: String(o.id || ''),
    order_number: String(o.order_number || ''),
    items: itemsByOrder.get(String(o.id)) || [],
    total: Number(o.total_amount || 0),
    status: String(o.status || ''),
    order_mode: String(o.order_mode || ''),
    payment_status: String(o.payment_status || ''),
    customer_name: String(o.customer_name || ''),
    customer_phone: String(o.customer_phone || ''),
    address: String(o.dropoff_detail || ''),
    scheduled_date: o.scheduled_date ? String(o.scheduled_date) : null,
    created_at: String(o.created_at || ''),
  }))
}

/**
 * ยกเลิกออเดอร์แทนลูกค้า — ผ่าน RPC `cancel_order_as_customer` (migration 205)
 * ตรวจผูกตัวตน (orders.customer_ref = p_customer_ref) แล้วเรียก canonical
 * `cancel_order` ภายใต้ JWT claims ของลูกค้า → release capacity + restore inventory
 * + close payment (void) + audit log ครบทุกขั้นตาม 025/195 — ห้าม PATCH orders ตรง
 */
export async function cancelOrder(
  deps: OrderMemoryDeps,
  orderNumber: string,
  customerRef: string,
  reason?: string,
): Promise<{ ok: boolean; error?: string; detail?: string }> {
  if (!orderNumber || !customerRef) return { ok: false, error: 'ERR_MISSING_ORDER' }
  try {
    const res = await fetch(deps.sbUrl + '/rest/v1/rpc/cancel_order_as_customer', {
      method: 'POST',
      headers: { ...headers(deps), 'Content-Type': 'application/json' },
      body: JSON.stringify({
        p_order_number: orderNumber,
        p_customer_ref: customerRef,
        p_reason: reason || 'cancelled_by_customer_via_ai',
      }),
      signal: AbortSignal.timeout(6000),
    })
    const j: any = await res.json().catch(() => null)
    if (!res.ok) {
      const msg = String(j?.message || j?.error || `HTTP ${res.status}`)
      return { ok: false, error: msg.slice(0, 120) }
    }
    return { ok: true, detail: String(j?.note || '') }
  } catch (e) {
    return { ok: false, error: String(e).slice(0, 120) }
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
    const mode = o.order_mode === 'PRE_ORDER' ? 'พรีออเดอร์' : 'ส่งวันนี้'
    return `• ${o.order_number} (${date}) — ${o.status} — ${mode} — ฿${o.total} — ${itemsSummary}`
  }).join('\n')

  return `--- ประวัติออเดอร์ล่าสุดของลูกค้า (ข้อมูลจริงจาก DB — ห้ามแต่งเลขที่/ยอดเอง) ---\n${lines}`
}
