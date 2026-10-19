// ============================================
// Bite Me Baby — POS / Pickup / Shift / Daily Sales API
// Task: BACKEND-CAPABILITY-CLOSURE-2026-10-19
//
// POS rides the EXISTING Order Hub:
//   * delivery orders  -> create_order_with_items_i (via createOrder)
//   * pickup/counter   -> create_pickup_order_i (127, idempotent via 124)
//   * closeout         -> pos_closeout_order (129: legal transition path + cash)
// NO new order/payment engine. Duplicate-submit protection: client_submit_key.
// ============================================
import { supabase } from './supabase'
import { createOrder, OrderInput, OrderResult, OrderForm, hydrateOrderItems } from './bmbAdminApi_orders'

export interface PosOrderInput {
  items: Array<{ product_id: string; quantity: number; options?: Record<string, any>; special_request?: string }>
  delivery_round_id: string
  fulfillment: 'pickup' | 'delivery'
  customer_name: string
  customer_phone?: string
  payment_method: 'promptpay_qr' | 'cash_on_delivery' | 'credit_card'
  special_instructions?: string
  promotion_code?: string
  order_mode?: 'SAME_DAY' | 'PRE_ORDER'
  scheduled_date?: string
  branch_id?: string
  client_submit_key?: string
}

export interface PosOrderResult extends OrderResult {
  pickup_code?: string | null
  delivery_method?: string
}

export async function createPosOrder(input: PosOrderInput): Promise<PosOrderResult | null> {
  if (input.fulfillment === 'pickup') {
    const { data, error } = await supabase.rpc('create_pickup_order_i', {
      p_items: input.items.map((it) => ({
        product_id: it.product_id,
        quantity: it.quantity,
        options: it.options ?? {},
        special_request: it.special_request ?? '',
      })),
      p_delivery_round_id: input.delivery_round_id,
      p_customer_name: input.customer_name,
      p_customer_phone: input.customer_phone ?? '',
      p_payment_method: input.payment_method,
      p_special_instructions: input.special_instructions ?? '',
      p_promotion_code: input.promotion_code ?? undefined,
      p_order_mode: input.order_mode ?? 'SAME_DAY',
      p_scheduled_date: input.scheduled_date ?? undefined,
      p_branch_id: input.branch_id ?? null,
      p_source_channel: 'POS',
      p_client_submit_key: input.client_submit_key ?? undefined,
    })
    if (error) {
      console.error('[createPosOrder:pickup] RPC error:', error)
      return null
    }
    return data as PosOrderResult
  }
  const orderInput: OrderInput = {
    items: input.items,
    delivery_round_id: input.delivery_round_id,
    delivery_method: 'self_delivery',
    customer_name: input.customer_name,
    customer_phone: input.customer_phone ?? '',
    payment_method: input.payment_method,
    special_instructions: input.special_instructions ?? '',
    promotion_code: input.promotion_code ?? undefined,
    order_mode: input.order_mode ?? 'SAME_DAY',
    scheduled_date: input.scheduled_date ?? undefined,
    branch_id: input.branch_id ?? undefined,
    source_channel: 'POS',
    client_submit_key: input.client_submit_key ?? undefined,
  }
  return await createOrder(orderInput) as PosOrderResult | null
}

// ---------- closeout / pickup handover ----------

export async function posCloseoutOrder(orderNumber: string, markPaid = true): Promise<{ ok: boolean; status?: string; error?: string }> {
  const { data, error } = await supabase.rpc('pos_closeout_order', {
    p_order_number: orderNumber,
    p_mark_paid: markPaid,
  })
  if (error) return { ok: false, error: error.message }
  return { ok: true, status: (data as any)?.status }
}

/** Pickup orders awaiting handover (pending..ready_for_dispatch). */
export async function listPickupOrders(): Promise<OrderForm[]> {
  const { data, error } = await supabase
    .from('orders')
    .select('*')
    .eq('delivery_method', 'pickup')
    .in('status', ['pending', 'confirmed', 'preparing', 'ready_for_dispatch'])
    .order('created_at', { ascending: true })
  if (error) {
    console.error('[listPickupOrders]', error)
    return []
  }
  return await hydrateOrderItems((data ?? []) as unknown as OrderForm[])
}

// ---------- shifts ----------

export interface ShiftRow {
  id: string
  branch_id: string | null
  opened_by: string
  closed_by: string | null
  opened_at: string
  closed_at: string | null
  opening_cash: number
  counted_cash: number | null
  expected_cash: number | null
  difference: number | null
  notes: string | null
  status: 'open' | 'closed'
}

export async function openShift(openingCash: number, branchId?: string): Promise<{ ok: boolean; shift?: ShiftRow; error?: string }> {
  const { data, error } = await supabase.rpc('open_shift', {
    p_opening_cash: openingCash,
    p_branch_id: branchId ?? null,
  })
  if (error) return { ok: false, error: error.message }
  const id = (data as any)?.shift_id as string
  const { data: row } = await supabase.from('shifts').select('*').eq('id', id).maybeSingle()
  return { ok: true, shift: (row ?? undefined) as ShiftRow | undefined }
}

export async function closeShift(shiftId: string, countedCash: number, notes?: string): Promise<{ ok: boolean; expected?: number; difference?: number; error?: string }> {
  const { data, error } = await supabase.rpc('close_shift', {
    p_shift_id: shiftId,
    p_counted_cash: countedCash,
    p_notes: notes ?? undefined,
  })
  if (error) return { ok: false, error: error.message }
  return {
    ok: true,
    expected: Number((data as any)?.expected_cash ?? 0),
    difference: Number((data as any)?.difference ?? 0),
  }
}

export async function getCurrentShift(): Promise<ShiftRow | null> {
  const { data } = await supabase
    .from('shifts')
    .select('*')
    .eq('status', 'open')
    .order('opened_at', { ascending: false })
    .limit(1)
    .maybeSingle()
  return (data ?? null) as ShiftRow | null
}

// ---------- daily sales / closing ----------

export interface DailySales {
  date: string
  orders_count: number
  cancelled_count: number
  gross_sales: number
  discount_total: number
  delivery_fee_total: number
  tax_total: number
  net_sales: number
  paid_amount: number
  unpaid_amount: number
  refunded_amount: number
  paid_by_cash: number
  paid_by_promptpay: number
  paid_by_card: number
  sameday_count: number
  preorder_count: number
  pickup_count: number
  pickup_paid_amount: number
}

export async function getDailySales(date?: string): Promise<DailySales | null> {
  const { data, error } = await supabase.rpc('get_daily_sales', { p_date: date ?? undefined })
  if (error) {
    console.error('[getDailySales]', error)
    return null
  }
  return data as DailySales
}

export async function closeDay(date?: string): Promise<{ ok: boolean; sales?: DailySales; error?: string }> {
  const { data, error } = await supabase.rpc('close_day', { p_date: date ?? undefined })
  if (error) return { ok: false, error: error.message }
  return { ok: true, sales: (data as any)?.payload as DailySales }
}

// ---------- CSV export (pure builder — unit-tested) ----------

export const DAILY_SALES_CSV_LABELS: Record<keyof DailySales, string> = {
  date: 'วันที่',
  orders_count: 'จำนวนออเดอร์',
  cancelled_count: 'ยกเลิก/ล้มเหลว',
  gross_sales: 'ยอดขายรวม (ก่อนส่วนลด)',
  discount_total: 'ส่วนลดรวม',
  delivery_fee_total: 'ค่าจัดส่งรวม',
  tax_total: 'ภาษีรวม',
  net_sales: 'ยอดขายสุทธิ',
  paid_amount: 'ชำระแล้ว',
  unpaid_amount: 'ค้างชำระ',
  refunded_amount: 'คืนเงินแล้ว',
  paid_by_cash: 'ชำระแล้ว-เงินสด',
  paid_by_promptpay: 'ชำระแล้ว-PromptPay',
  paid_by_card: 'ชำระแล้ว-บัตร',
  sameday_count: 'SAME_DAY',
  preorder_count: 'PRE_ORDER',
  pickup_count: 'รับที่ร้าน',
  pickup_paid_amount: 'รับที่ร้าน(ชำระแล้ว)',
}

/** Builds a UTF-8-BOM CSV from daily sales rows (Excel-safe). */
export function buildDailySalesCsv(rows: DailySales[]): string {
  const keys = Object.keys(DAILY_SALES_CSV_LABELS) as Array<keyof DailySales>
  const header = keys.map((k) => DAILY_SALES_CSV_LABELS[k]).join(',')
  const body = rows
    .map((r) => keys.map((k) => String(r[k] ?? '')).join(','))
    .join('\n')
  return '\uFEFF' + header + '\n' + body + '\n'
}