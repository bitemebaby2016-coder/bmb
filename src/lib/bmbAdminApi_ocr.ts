// ============================================
// Bite Me Baby Admin API — OCR Documents (Phase 2 Cost Intelligence)
// DB-backed via SECURITY DEFINER/INVOKER RPC (migration 233) — RLS enforced.
// Approval writes price history only — never PO/GRN/WAVG (Owner §4).
// ============================================
import { supabase } from './supabase'
import type { ApprovalLine, OcrDocStatus, OcrDocType, OcrDocument, OcrFields } from './ocr/types'

export type { OcrDocument, OcrDocStatus, OcrDocType, OcrFields, ApprovalLine }

export interface OcrCreateInput {
  docType: OcrDocType
  storagePath: string | null
  imageMime: string | null
  ocrRaw: unknown
  ocrFields: OcrFields
  modelUsed: string | null
  promptVersion: string | null
  contentHash: string | null
  tenantId: string | null
  branchId: string | null
}

export async function createOcrDocument(input: OcrCreateInput): Promise<OcrDocument | null> {
  const { data, error } = await supabase.rpc('ocr_create_document', {
    p_doc_type: input.docType,
    p_storage_path: input.storagePath,
    p_image_mime: input.imageMime,
    p_ocr_raw: input.ocrRaw ?? null,
    p_ocr_fields: input.ocrFields ?? {},
    p_model_used: input.modelUsed,
    p_prompt_version: input.promptVersion,
    p_content_hash: input.contentHash,
    p_tenant_id: input.tenantId,
    p_branch_id: input.branchId,
  })
  if (error) { console.error('[createOcrDocument] Error:', error); return null }
  return data as OcrDocument
}

export async function listOcrDocuments(status?: OcrDocStatus, limit = 50): Promise<OcrDocument[]> {
  const { data, error } = await supabase.rpc('ocr_list_documents', {
    p_status: status ?? null,
    p_limit: limit,
    p_offset: 0,
  })
  if (error) { console.error('[listOcrDocuments] Error:', error); return [] }
  return (data || []) as OcrDocument[]
}

export async function getOcrDocument(id: string): Promise<OcrDocument | null> {
  const { data, error } = await supabase.rpc('ocr_get_document', { p_id: id })
  if (error) { console.error('[getOcrDocument] Error:', error); return null }
  return data as OcrDocument
}

export async function approveOcrDocument(
  id: string,
  lines: ApprovalLine[],
  matchedSupplierId: string | null,
  note: string,
): Promise<OcrDocument | null> {
  const { data, error } = await supabase.rpc('ocr_approve_document', {
    p_id: id,
    p_lines: lines,
    p_matched_supplier_id: matchedSupplierId,
    p_note: note,
  })
  if (error) { console.error('[approveOcrDocument] Error:', error); return null }
  return data as OcrDocument
}

export async function rejectOcrDocument(id: string, note: string): Promise<OcrDocument | null> {
  const { data, error } = await supabase.rpc('ocr_reject_document', { p_id: id, p_note: note })
  if (error) { console.error('[rejectOcrDocument] Error:', error); return null }
  return data as OcrDocument
}