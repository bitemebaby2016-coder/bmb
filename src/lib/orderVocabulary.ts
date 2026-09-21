// ============================================
// Bite Me Baby — Canonical Order Status Vocabulary (PAY-04)
// ============================================
// ONE vocabulary bridging the three status systems that used to drift:
//   server enum  (orders.status            — migration 001 order_status enum)
//   client chain (orderStateMachine        — same-day / pre-order display chains)
//   provider enum(provider_orders.status   — external delivery providers)
//
// Rules enforced here (and verified by orderVocabulary.test.ts):
//   - every server status maps to a defined client display per mode (no orphans)
//   - every client status maps back to a server status
//   - provider <-> server mapping is complete and bidirectional
//   - "UI แสดงตรง DB" — pages must use these mappers, never ad-hoc label maps.

import type { OrderMode } from '@/config/platformConfig'

// ---------------------------------------------------------------------------
// 1. Canonical status sets (source of truth)
// ---------------------------------------------------------------------------

export const SERVER_ORDER_STATUSES = [
  'pending',
  'confirmed',
  'preparing',
  'ready_for_dispatch',
  'dispatched',
  'in_transit',
  'arrived',
  'delivered',
  'cancelled',
  'failed',
] as const
export type ServerOrderStatus = (typeof SERVER_ORDER_STATUSES)[number]

export const CLIENT_ORDER_STATUSES = [
  'Created',
  'Accepted',
  'Preparing',
  'Ready for Pickup',
  'Dispatched',
  'Delivered',
  'Cancelled',
  'Failed',
] as const
export type ClientOrderStatus = (typeof CLIENT_ORDER_STATUSES)[number]

export const PRE_ORDER_CLIENT_STATUSES = [
  'Booked',
  'Allocated',
  'Batch Production',
  'Ready for Pickup',
  'Dispatched',
  'Delivered',
  'Cancelled',
  'Failed',
] as const
export type PreOrderClientStatus = (typeof PRE_ORDER_CLIENT_STATUSES)[number]

export const PROVIDER_ORDER_STATUSES = [
  'requested',
  'accepted',
  'picked_up',
  'in_transit',
  'delivered',
  'cancelled',
] as const
export type ProviderOrderStatus = (typeof PROVIDER_ORDER_STATUSES)[number]

// ---------------------------------------------------------------------------
// 2. server -> client (display timeline — customer sees these)
// ---------------------------------------------------------------------------

export const SERVER_TO_CLIENT: Record<ServerOrderStatus, { sameDay: ClientOrderStatus; preOrder: PreOrderClientStatus }> = {
  pending: { sameDay: 'Created', preOrder: 'Booked' },
  confirmed: { sameDay: 'Accepted', preOrder: 'Allocated' },
  preparing: { sameDay: 'Preparing', preOrder: 'Batch Production' },
  ready_for_dispatch: { sameDay: 'Ready for Pickup', preOrder: 'Ready for Pickup' },
  dispatched: { sameDay: 'Dispatched', preOrder: 'Dispatched' },
  in_transit: { sameDay: 'Dispatched', preOrder: 'Dispatched' },
  arrived: { sameDay: 'Dispatched', preOrder: 'Dispatched' },
  delivered: { sameDay: 'Delivered', preOrder: 'Delivered' },
  cancelled: { sameDay: 'Cancelled', preOrder: 'Cancelled' },
  failed: { sameDay: 'Failed', preOrder: 'Failed' },
}

// ---------------------------------------------------------------------------
// 3. client -> server (UI actions / admin transitions)
// ---------------------------------------------------------------------------

export const CLIENT_TO_SERVER: Record<ClientOrderStatus | PreOrderClientStatus, ServerOrderStatus> = {
  Created: 'pending',
  Booked: 'pending',
  Accepted: 'confirmed',
  Allocated: 'confirmed',
  Preparing: 'preparing',
  'Batch Production': 'preparing',
  'Ready for Pickup': 'ready_for_dispatch',
  Dispatched: 'dispatched',
  Delivered: 'delivered',
  Cancelled: 'cancelled',
  Failed: 'failed',
}

// ---------------------------------------------------------------------------
// 4. provider <-> server
// ---------------------------------------------------------------------------

export const SERVER_TO_PROVIDER: Record<ServerOrderStatus, ProviderOrderStatus> = {
  pending: 'requested',
  confirmed: 'accepted',
  preparing: 'accepted',
  ready_for_dispatch: 'picked_up',
  dispatched: 'in_transit',
  in_transit: 'in_transit',
  arrived: 'in_transit',
  delivered: 'delivered',
  cancelled: 'cancelled',
  failed: 'cancelled',
}

// ---------------------------------------------------------------------------
// 5. Mappers + guards
// ---------------------------------------------------------------------------

export function isServerOrderStatus(v: string): v is ServerOrderStatus {
  return (SERVER_ORDER_STATUSES as readonly string[]).includes(v)
}

export function isClientOrderStatus(v: string): v is ClientOrderStatus | PreOrderClientStatus {
  return (
    (CLIENT_ORDER_STATUSES as readonly string[]).includes(v) ||
    (PRE_ORDER_CLIENT_STATUSES as readonly string[]).includes(v)
  )
}

export function isProviderOrderStatus(v: string): v is ProviderOrderStatus {
  return (PROVIDER_ORDER_STATUSES as readonly string[]).includes(v)
}

/** server status -> customer-facing timeline step label for the given mode. */
export function serverToClientStatus(server: string, mode: OrderMode = 'SAME_DAY'): string {
  if (!isServerOrderStatus(server)) return server
  return mode === 'PRE_ORDER' ? SERVER_TO_CLIENT[server].preOrder : SERVER_TO_CLIENT[server].sameDay
}

/** client timeline label -> canonical server status. */
export function clientToServerStatus(client: string): string {
  if (!isClientOrderStatus(client)) return client
  return CLIENT_TO_SERVER[client]
}

/** server status -> provider_orders.status for external rider dispatch. */
export function serverToProviderStatus(server: string): string {
  if (!isServerOrderStatus(server)) return server
  return SERVER_TO_PROVIDER[server]
}

/** provider_orders.status -> canonical server status (customer tracking). */
export function providerToServerStatus(provider: string): string {
  if (!isProviderOrderStatus(provider)) return provider
  return PROVIDER_TO_SERVER[provider]
}

/** Human-readable Thai label for a server status (shared by UI surfaces). */
export const SERVER_STATUS_LABEL_TH: Record<ServerOrderStatus, string> = {
  pending: 'รอการยืนยัน',
  confirmed: 'ยืนยันแล้ว',
  preparing: 'กำลังเตรียมอาหาร',
  ready_for_dispatch: 'พร้อมส่ง',
  dispatched: 'กำลังจัดส่ง',
  in_transit: 'คนส่งกำลังเดินทาง',
  arrived: 'ถึงปลายทาง',
  delivered: 'ส่งสำเร็จ',
  cancelled: 'ยกเลิก',
  failed: 'ส่งไม่สำเร็จ',
}

export function getServerStatusLabel(server: string, mode: OrderMode = 'SAME_DAY'): string {
  if (!isServerOrderStatus(server)) return server
  return SERVER_STATUS_LABEL_TH[server]
}

export const PROVIDER_TO_SERVER: Record<ProviderOrderStatus, ServerOrderStatus> = {
  requested: 'pending',
  accepted: 'confirmed',
  picked_up: 'ready_for_dispatch',
  in_transit: 'dispatched',
  delivered: 'delivered',
  cancelled: 'cancelled',
}