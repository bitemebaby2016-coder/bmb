// ============================================
// Bite Me Baby Admin API - Purchase Orders (Phase 2 WP2)
// DB-backed via RPC (migration 224) + table reads (219).
// No mock/stub: every call hits Supabase (RPC or table).
// ============================================

import { supabase } from './supabase'
import type {
  PurchaseOrderHeader,
  PurchaseOrderLine,
  PurchaseOrderWithLines,
  PurchaseOrderForm,
  PurchaseOrderLineForm,
  POStatus,
} from '@/types'

export type {
  PurchaseOrderHeader,
  PurchaseOrderLine,
  PurchaseOrderWithLines,
  PurchaseOrderForm,
  PurchaseOrderLineForm,
  POStatus,
}

export interface PORpcResult {
  ok: boolean
  po_id?: string
  po_number?: string
  status?: string
  version?: number
}

function rpcError(scope: string, error: { message?: string } | null): never {
  console.error(`[${scope}] RPC error:`, error)
  throw new Error(error?.message || `${scope} failed`)
}

// ============================================
// Create PO draft (generate_po_number + lines from DB sequence)
// ============================================
export async function createPurchaseOrder(form: PurchaseOrderForm): Promise<PORpcResult> {
  const { data, error } = await supabase.rpc('create_purchase_order', {
    p_supplier_id: form.supplier_id,
    p_lines: form.lines,
    p_expected_date: form.expected_date ?? null,
    p_shipping_amount: form.shipping_amount ?? 0,
    p_discount_amount: form.discount_amount ?? 0,
    p_tax_amount: form.tax_amount ?? 0,
    p_notes: form.notes ?? null,
    p_tenant_id: form.tenant_id ?? null,
    p_branch_id: form.branch_id ?? null,
  })
  if (error) rpcError('createPurchaseOrder', error)
  return data as PORpcResult
}

// ============================================
// Update PO (optimistic lock via p_version + status gate)
// ============================================
export async function updatePurchaseOrder(
  poId: string,
  version: number,
  patch: {
    lines?: PurchaseOrderLineForm[]
    expected_date?: string | null
    shipping_amount?: number | null
    discount_amount?: number | null
    tax_amount?: number | null
    notes?: string | null
  },
): Promise<PORpcResult> {
  const { data, error } = await supabase.rpc('update_purchase_order', {
    p_po_id: poId,
    p_lines: patch.lines ?? null,
    p_expected_date: patch.expected_date ?? null,
    p_shipping_amount: patch.shipping_amount ?? null,
    p_discount_amount: patch.discount_amount ?? null,
    p_tax_amount: patch.tax_amount ?? null,
    p_notes: patch.notes ?? null,
    p_version: version,
  })
  if (error) rpcError('updatePurchaseOrder', error)
  return data as PORpcResult
}

// ============================================
// Submit PO (draft -> submitted)
// ============================================
export async function submitPurchaseOrder(poId: string): Promise<PORpcResult> {
  const { data, error } = await supabase.rpc('submit_purchase_order', { p_po_id: poId })
  if (error) rpcError('submitPurchaseOrder', error)
  return data as PORpcResult
}

// ============================================
// Approve PO (finance/admin; submitted -> approved)
// ============================================
export async function approvePurchaseOrder(poId: string): Promise<PORpcResult> {
  const { data, error } = await supabase.rpc('approve_purchase_order', { p_po_id: poId })
  if (error) rpcError('approvePurchaseOrder', error)
  return data as PORpcResult
}

// ============================================
// Reads (RLS-scoped by migration 223)
// ============================================
export async function getPurchaseOrders(status?: POStatus): Promise<PurchaseOrderHeader[]> {
  let query = supabase.from('purchase_orders').select('*').order('created_at', { ascending: false })
  if (status) query = query.eq('status', status)
  const { data, error } = await query
  if (error) { console.error('[getPurchaseOrders] Error:', error); return [] }
  return (data || []) as PurchaseOrderHeader[]
}

export async function getPurchaseOrderById(id: string): Promise<PurchaseOrderWithLines | null> {
  const { data, error } = await supabase
    .from('purchase_orders')
    .select('*, lines:purchase_order_lines(*)')
    .eq('id', id)
    .single()
  if (error) { console.error('[getPurchaseOrderById] Error:', error); return null }
  const row = data as unknown as PurchaseOrderHeader & { lines?: PurchaseOrderLine[] }
  return { ...row, lines: row.lines || [] }
}

export async function getPurchaseOrderLines(poId: string): Promise<PurchaseOrderLine[]> {
  const { data, error } = await supabase
    .from('purchase_order_lines')
    .select('*')
    .eq('po_id', poId)
    .order('created_at')
  if (error) { console.error('[getPurchaseOrderLines] Error:', error); return [] }
  return (data || []) as PurchaseOrderLine[]
}