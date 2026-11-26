// ============================================
// Bite Me Baby Admin API - Goods Receipts (Phase 2 WP4)
// DB-backed via RPC (migration 225) + table reads (220).
// No mock/stub: every call hits Supabase.
// ============================================

import { supabase } from './supabase'
import type {
  GoodsReceipt,
  GoodsReceiptLine,
  GoodsReceiptWithLines,
  GRNForm,
  GRNStatus,
} from '@/types'

export type {
  GoodsReceipt,
  GoodsReceiptLine,
  GoodsReceiptWithLines,
  GRNForm,
  GRNStatus,
}

export interface GRNRpcResult {
  ok: boolean
  grn_id?: string
  grn_number?: string
  status?: string
}

function rpcError(scope: string, error: { message?: string } | null): never {
  console.error(`[${scope}] RPC error:`, error)
  throw new Error(error?.message || `${scope} failed`)
}

export async function createGrnDraft(form: GRNForm): Promise<GRNRpcResult> {
  const { data, error } = await supabase.rpc('create_grn_draft', {
    p_po_id: form.po_id,
    p_lines: form.lines,
    p_receipt_date: form.receipt_date ?? null,
    p_notes: form.notes ?? null,
  })
  if (error) rpcError('createGrnDraft', error)
  return data as GRNRpcResult
}

export async function approveGrn(grnId: string): Promise<GRNRpcResult> {
  const { data, error } = await supabase.rpc('approve_grn', { p_grn_id: grnId })
  if (error) rpcError('approveGrn', error)
  return data as GRNRpcResult
}

export async function getGoodsReceipts(status?: GRNStatus): Promise<GoodsReceipt[]> {
  let query = supabase.from('goods_receipts').select('*').order('created_at', { ascending: false })
  if (status) query = query.eq('status', status)
  const { data, error } = await query
  if (error) { console.error('[getGoodsReceipts] Error:', error); return [] }
  return (data || []) as GoodsReceipt[]
}

export async function getGoodsReceiptById(id: string): Promise<GoodsReceiptWithLines | null> {
  const { data, error } = await supabase
    .from('goods_receipts')
    .select('*, lines:goods_receipt_lines(*)')
    .eq('id', id)
    .single()
  if (error) { console.error('[getGoodsReceiptById] Error:', error); return null }
  const row = data as unknown as GoodsReceipt & { lines?: GoodsReceiptLine[] }
  return { ...row, lines: row.lines || [] }
}

export async function getGoodsReceiptLines(grnId: string): Promise<GoodsReceiptLine[]> {
  const { data, error } = await supabase
    .from('goods_receipt_lines')
    .select('*')
    .eq('grn_id', grnId)
    .order('created_at')
  if (error) { console.error('[getGoodsReceiptLines] Error:', error); return [] }
  return (data || []) as GoodsReceiptLine[]
}