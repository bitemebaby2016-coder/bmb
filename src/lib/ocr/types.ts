// ============================================
// Bite Me Baby — OCR domain types (Phase 2 Cost Intelligence)
// Pure TS, no deps. Shared by service, admin API, UI and tests.
// ============================================

export type OcrDocType = 'receipt' | 'invoice' | 'supplier_quote' | 'other'
export type OcrDocStatus = 'pending_review' | 'approved' | 'rejected'

export interface OcrLine {
  description: string
  quantity: number | null
  unit: string | null
  unit_price: number | null
  line_total: number | null
  /** per-field confidence 0..1 (low = needs review, never guessed) */
  confidence: number
}

export interface OcrFields {
  supplier_name?: string | null
  document_date?: string | null
  currency?: string | null
  subtotal?: number | null
  tax?: number | null
  total?: number | null
  lines?: OcrLine[]
  suggested_supplier_id?: string | null
  /** true when the model reported the image is not a purchase document */
  error?: string
  [k: string]: unknown
}

export interface OcrDocument {
  id: string
  tenant_id: string | null
  branch_id: string | null
  doc_type: OcrDocType
  storage_path: string | null
  image_mime: string | null
  content_hash: string | null
  ocr_raw: unknown
  ocr_fields: OcrFields
  model_used: string | null
  prompt_version: string | null
  status: OcrDocStatus
  duplicate_of: string | null
  subtotal: number | null
  tax: number | null
  total: number | null
  currency: string | null
  suggested_supplier_id: string | null
  matched_supplier_id: string | null
  created_by: string | null
  reviewed_by: string | null
  reviewed_at: string | null
  review_note: string | null
  created_at: string
  updated_at: string
}

export interface FieldValidation {
  ok: boolean
  errors: string[]
  warnings: string[]
  /** per-field confidence (0..1); 1 = certain, low = needs review */
  fieldConfidence: Record<string, number>
  needsReview: boolean
}

/** A normalized purchase line used for CSV/Excel/manual import + approval. */
export interface PurchaseLineInput {
  description: string
  quantity: number | null
  unit: string | null
  unit_price: number | null
  line_total: number | null
}

/** A price-history line emitted on approval (never auto — Owner §4). */
export interface ApprovalLine {
  supplier_id: string
  supplier_product_id: string
  ingredient_id: string
  purchase_unit: string
  use_unit: string
  conversion_factor: number
  unit_price: number
  received_qty?: number
}

export interface MatchCandidate {
  id: string
  label: string
  score: number
}