// ============================================
// Order delivery-address resolution — WAVE 5B parity fix (2026-10-16)
// ============================================
// Production schema has NO orders.delivery_address column (verified read-only
// 2026-10-15/16: 31 columns, only dropoff_detail). The canonical written
// address lives in `dropoff_detail` — create_order_with_items maps
// p_delivery_address -> dropoff_detail, and the pre-order trigger validates on
// dropoff_detail (035/037). Admin UIs historically read `delivery_address` and
// showed '—' for every RPC-era order (DeliveryManagement ที่อยู่จัดส่ง).
// This helper is the single safe display fallback: prefer a real
// `delivery_address` value (manual-era rows if ever present) and fall back to
// `dropoff_detail`. UI-level change only — no schema migration required.

export interface OrderAddressLike {
  delivery_address?: string | null
  dropoff_detail?: string | null
}

/** Trimmed delivery-address text; '' when neither source has content. */
export function resolveOrderDeliveryAddress(row: OrderAddressLike | null | undefined): string {
  const primary = typeof row?.delivery_address === 'string' ? row.delivery_address.trim() : ''
  if (primary) return primary
  const fallback = typeof row?.dropoff_detail === 'string' ? row.dropoff_detail.trim() : ''
  return fallback
}