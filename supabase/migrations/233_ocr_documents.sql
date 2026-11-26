-- ============================================
-- Bite Me Baby — Migration 233: OCR Documents (Phase 2 Cost Intelligence)
-- Date: 2026-11-26 · Owner: AI OCR for receipts / invoices / purchase docs is
--   part of Phase 2 Cost Intelligence — must not be cut.
-- Scope:
--   1) ocr_documents table (original image ref + raw OCR + normalized fields +
--      per-field confidence + model/prompt provenance + review state + duplicate)
--   2) RLS (admin/inventory/finance write; staff read) + org/branch isolation
--   3) RPCs: create / list / get / approve / reject
--   4) Approval writes purchase_price_history (price_type='approved') +
--      supplier_products.last_approved_price — NEVER auto WAVG/GRN/PO.
--   5) Audit via append_audit_log.
-- Dependencies: 214 (suppliers), 217 (supplier_products), 221 (price_history),
--   223 (has_org_row_scope), 146 (role predicates).
-- Idempotent / re-runnable.
-- ============================================

BEGIN;

CREATE TABLE IF NOT EXISTS public.ocr_documents (
  id                  TEXT PRIMARY KEY,
  tenant_id           TEXT REFERENCES public.tenants(id) ON DELETE SET NULL,
  branch_id           TEXT REFERENCES public.branches(id) ON DELETE SET NULL,
  doc_type            TEXT NOT NULL DEFAULT 'receipt'
    CHECK (doc_type IN ('receipt', 'invoice', 'supplier_quote', 'other')),
  storage_path        TEXT,                       -- original image (storage bucket)
  image_mime          TEXT,
  content_hash        TEXT,                       -- sha256 of original image → duplicate
  ocr_raw             JSONB,                      -- raw model JSON (untrusted, stored as-is)
  ocr_fields          JSONB NOT NULL DEFAULT '{}'::jsonb, -- normalized fields + per-field confidence
  model_used          TEXT,
  prompt_version      TEXT,
  status              TEXT NOT NULL DEFAULT 'pending_review'
    CHECK (status IN ('pending_review', 'approved', 'rejected')),
  duplicate_of        TEXT REFERENCES public.ocr_documents(id) ON DELETE SET NULL,
  subtotal            NUMERIC(12,2),
  tax                 NUMERIC(12,2),
  total               NUMERIC(12,2),
  currency            TEXT,
  suggested_supplier_id TEXT REFERENCES public.suppliers(id) ON DELETE SET NULL,
  matched_supplier_id   TEXT REFERENCES public.suppliers(id) ON DELETE SET NULL,
  created_by          UUID REFERENCES auth.users(id),
  reviewed_by         UUID REFERENCES auth.users(id),
  reviewed_at         TIMESTAMPTZ,
  review_note         TEXT,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ocr_documents_status ON public.ocr_documents(status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_ocr_documents_hash ON public.ocr_documents(content_hash);
CREATE INDEX IF NOT EXISTS idx_ocr_documents_tenant ON public.ocr_documents(tenant_id, branch_id);
-- Prevent TWO APPROVED docs with the same hash (double price-history write).
-- Pending duplicates are allowed (flagged via duplicate_of) so upload never errors.
CREATE UNIQUE INDEX IF NOT EXISTS uq_ocr_documents_hash_approved
  ON public.ocr_documents(content_hash) WHERE content_hash IS NOT NULL AND status = 'approved';

DROP TRIGGER IF EXISTS ocr_documents_updated_at ON public.ocr_documents;
CREATE TRIGGER ocr_documents_updated_at
  BEFORE UPDATE ON public.ocr_documents
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

ALTER TABLE public.ocr_documents ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS ocr_doc_admin ON public.ocr_documents;
CREATE POLICY ocr_doc_admin ON public.ocr_documents
  FOR ALL TO authenticated
  USING (public.is_admin() AND public.has_org_row_scope(tenant_id, branch_id))
  WITH CHECK (public.is_admin() AND public.has_org_row_scope(tenant_id, branch_id));

DROP POLICY IF EXISTS ocr_doc_staff_rw ON public.ocr_documents;
CREATE POLICY ocr_doc_staff_rw ON public.ocr_documents
  FOR ALL TO authenticated
  USING ((public.is_inventory() OR public.is_finance())
         AND public.has_org_row_scope(tenant_id, branch_id))
  WITH CHECK ((public.is_inventory() OR public.is_finance())
         AND public.has_org_row_scope(tenant_id, branch_id));

DROP POLICY IF EXISTS ocr_doc_read ON public.ocr_documents;
CREATE POLICY ocr_doc_read ON public.ocr_documents
  FOR SELECT TO authenticated
  USING ((public.is_admin() OR public.is_inventory() OR public.is_finance()
          OR public.is_kitchen() OR public.is_pos())
         AND public.has_org_row_scope(tenant_id, branch_id));

GRANT SELECT, INSERT, UPDATE ON public.ocr_documents TO authenticated;

-- ============================================
-- RPC: create (SECURITY DEFINER — role + org scope checked inside)
-- ============================================
CREATE OR REPLACE FUNCTION public.ocr_create_document(
  p_doc_type TEXT,
  p_storage_path TEXT,
  p_image_mime TEXT,
  p_ocr_raw JSONB,
  p_ocr_fields JSONB,
  p_model_used TEXT,
  p_prompt_version TEXT,
  p_content_hash TEXT,
  p_tenant_id TEXT,
  p_branch_id TEXT
)
RETURNS public.ocr_documents
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_id TEXT;
  v_dup TEXT;
  v_row public.ocr_documents;
BEGIN
  IF NOT (public.is_admin() OR public.is_inventory() OR public.is_finance()) THEN
    RAISE EXCEPTION 'ERR_FORBIDDEN';
  END IF;
  IF NOT public.has_org_row_scope(p_tenant_id, p_branch_id) THEN
    RAISE EXCEPTION 'ERR_OUT_OF_SCOPE';
  END IF;

  v_id := 'ocr-' || replace(gen_random_uuid()::text, '-', '');

  IF p_content_hash IS NOT NULL THEN
    SELECT id INTO v_dup FROM public.ocr_documents
     WHERE content_hash = p_content_hash AND status <> 'rejected'
     LIMIT 1;
  END IF;

  INSERT INTO public.ocr_documents (
    id, tenant_id, branch_id, doc_type, storage_path, image_mime, content_hash,
    ocr_raw, ocr_fields, model_used, prompt_version, status, duplicate_of,
    subtotal, tax, total, currency,
    suggested_supplier_id, created_by
  ) VALUES (
    v_id, p_tenant_id, p_branch_id, COALESCE(p_doc_type, 'receipt'), p_storage_path,
    p_image_mime, p_content_hash, p_ocr_raw, COALESCE(p_ocr_fields, '{}'::jsonb),
    p_model_used, p_prompt_version, 'pending_review', v_dup,
    (p_ocr_fields->>'subtotal')::numeric, (p_ocr_fields->>'tax')::numeric,
    (p_ocr_fields->>'total')::numeric, p_ocr_fields->>'currency',
    NULLIF(p_ocr_fields->>'suggested_supplier_id', ''), auth.uid()
  ) RETURNING * INTO v_row;

  PERFORM public.append_audit_log('ocr_document_created', 'ocr_document', v_id,
    'OCR document created' || CASE WHEN v_dup IS NOT NULL THEN ' (duplicate of ' || v_dup || ')' ELSE '' END,
    jsonb_build_object('doc_type', v_row.doc_type, 'model', p_model_used,
                       'duplicate_of', v_dup));

  RETURN v_row;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.ocr_create_document(TEXT, TEXT, TEXT, JSONB, JSONB, TEXT, TEXT, TEXT, TEXT, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.ocr_create_document(TEXT, TEXT, TEXT, JSONB, JSONB, TEXT, TEXT, TEXT, TEXT, TEXT) TO authenticated;

-- ============================================
-- RPC: list / get (SECURITY INVOKER — RLS enforced)
-- ============================================
CREATE OR REPLACE FUNCTION public.ocr_list_documents(
  p_status TEXT DEFAULT NULL,
  p_limit INT DEFAULT 50,
  p_offset INT DEFAULT 0
)
RETURNS SETOF public.ocr_documents
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT * FROM public.ocr_documents
  WHERE (p_status IS NULL OR status = p_status)
  ORDER BY created_at DESC
  LIMIT LEAST(p_limit, 200) OFFSET GREATEST(p_offset, 0);
END;
$$;

REVOKE EXECUTE ON FUNCTION public.ocr_list_documents(TEXT, INT, INT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.ocr_list_documents(TEXT, INT, INT) TO authenticated;

CREATE OR REPLACE FUNCTION public.ocr_get_document(p_id TEXT)
RETURNS public.ocr_documents
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE v_row public.ocr_documents;
BEGIN
  SELECT * INTO v_row FROM public.ocr_documents WHERE id = p_id;
  RETURN v_row;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.ocr_get_document(TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.ocr_get_document(TEXT) TO authenticated;

-- ============================================
-- RPC: approve — writes price history (approved) + supplier_products approved price.
--   NEVER creates PO/GRN/Inventory txn, NEVER touches WAVG (Owner §4).
--   p_lines: jsonb array of {supplier_id, supplier_product_id, ingredient_id,
--     purchase_unit, use_unit, conversion_factor, unit_price, received_qty}
-- ============================================
CREATE OR REPLACE FUNCTION public.ocr_approve_document(
  p_id TEXT,
  p_lines JSONB,
  p_matched_supplier_id TEXT,
  p_note TEXT
)
RETURNS public.ocr_documents
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_doc public.ocr_documents;
  v_line JSONB;
  v_pph_id BIGINT;
BEGIN
  IF NOT (public.is_admin() OR public.is_inventory() OR public.is_finance()) THEN
    RAISE EXCEPTION 'ERR_FORBIDDEN';
  END IF;

  SELECT * INTO v_doc FROM public.ocr_documents WHERE id = p_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'ERR_NOT_FOUND'; END IF;
  IF NOT public.has_org_row_scope(v_doc.tenant_id, v_doc.branch_id) THEN
    RAISE EXCEPTION 'ERR_OUT_OF_SCOPE';
  END IF;
  IF v_doc.status = 'approved' THEN RAISE EXCEPTION 'ERR_ALREADY_APPROVED'; END IF;
  IF v_doc.status = 'rejected' THEN RAISE EXCEPTION 'ERR_REJECTED'; END IF;

  -- Duplicate guard (parity): a flagged duplicate must be rejected/merged first —
  -- approving it would double-write price history.
  IF v_doc.duplicate_of IS NOT NULL THEN
    RAISE EXCEPTION 'ERR_DUPLICATE_NEEDS_REVIEW';
  END IF;

  -- Server-side validation parity (Owner §4) — totals + per-line reconciliation.
  IF v_doc.subtotal IS NOT NULL AND v_doc.tax IS NOT NULL AND v_doc.total IS NOT NULL THEN
    IF abs(v_doc.subtotal + v_doc.tax - v_doc.total) > 0.02 THEN
      RAISE EXCEPTION 'ERR_TOTALS_INVALID';
    END IF;
  END IF;
  FOR v_line IN SELECT * FROM jsonb_array_elements(COALESCE(v_doc.ocr_fields->'lines', '[]'::jsonb)) LOOP
    IF (v_line->>'quantity') IS NOT NULL AND (v_line->>'unit_price') IS NOT NULL AND (v_line->>'line_total') IS NOT NULL THEN
      IF abs((v_line->>'quantity')::numeric * (v_line->>'unit_price')::numeric - (v_line->>'line_total')::numeric) > 0.02 THEN
        RAISE EXCEPTION 'ERR_LINE_INVALID';
      END IF;
    END IF;
  END LOOP;

  -- price history rows (approved) — append-only ledger
  IF p_lines IS NOT NULL AND jsonb_typeof(p_lines) = 'array' THEN
    FOR v_line IN SELECT * FROM jsonb_array_elements(p_lines) LOOP
      IF (v_line->>'supplier_product_id') IS NOT NULL
         AND (v_line->>'ingredient_id') IS NOT NULL
         AND (v_line->>'unit_price') IS NOT NULL THEN
        INSERT INTO public.purchase_price_history (
          supplier_id, supplier_product_id, ingredient_id, price_type,
          purchase_unit, use_unit, conversion_factor, unit_price, received_qty,
          effective_date, approval_status, source_user, source_document, tenant_id, branch_id
        ) VALUES (
          v_line->>'supplier_id',
          v_line->>'supplier_product_id',
          v_line->>'ingredient_id',
          'approved',
          COALESCE(v_line->>'purchase_unit', 'unit'),
          COALESCE(v_line->>'use_unit', 'unit'),
          COALESCE((v_line->>'conversion_factor')::numeric, 1.0),
          (v_line->>'unit_price')::numeric,
          NULLIF(v_line->>'received_qty', '')::numeric,
          (NOW() AT TIME ZONE 'Asia/Bangkok')::DATE, 'approved', auth.uid(), v_doc.storage_path, v_doc.tenant_id, v_doc.branch_id
        ) RETURNING id INTO v_pph_id;

        UPDATE public.supplier_products
           SET last_approved_price = (v_line->>'unit_price')::numeric,
               last_approved_at = NOW(),
               updated_at = NOW()
         WHERE id = v_line->>'supplier_product_id';
      END IF;
    END LOOP;
  END IF;

  UPDATE public.ocr_documents
     SET status = 'approved', reviewed_by = auth.uid(), reviewed_at = NOW(),
         review_note = COALESCE(p_note, ''), matched_supplier_id = COALESCE(p_matched_supplier_id, matched_supplier_id)
   WHERE id = p_id
   RETURNING * INTO v_doc;

  PERFORM public.append_audit_log('ocr_document_approved', 'ocr_document', p_id,
    'OCR document approved; price history rows written',
    jsonb_build_object('lines', jsonb_array_length(COALESCE(p_lines, '[]'::jsonb)), 'supplier', p_matched_supplier_id));

  RETURN v_doc;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.ocr_approve_document(TEXT, JSONB, TEXT, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.ocr_approve_document(TEXT, JSONB, TEXT, TEXT) TO authenticated;

-- ============================================
-- RPC: reject
-- ============================================
CREATE OR REPLACE FUNCTION public.ocr_reject_document(p_id TEXT, p_note TEXT)
RETURNS public.ocr_documents
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE v_doc public.ocr_documents;
BEGIN
  IF NOT (public.is_admin() OR public.is_inventory() OR public.is_finance()) THEN
    RAISE EXCEPTION 'ERR_FORBIDDEN';
  END IF;
  SELECT * INTO v_doc FROM public.ocr_documents WHERE id = p_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'ERR_NOT_FOUND'; END IF;
  IF NOT public.has_org_row_scope(v_doc.tenant_id, v_doc.branch_id) THEN
    RAISE EXCEPTION 'ERR_OUT_OF_SCOPE';
  END IF;
  IF v_doc.status = 'approved' THEN RAISE EXCEPTION 'ERR_ALREADY_APPROVED'; END IF;

  UPDATE public.ocr_documents
     SET status = 'rejected', reviewed_by = auth.uid(), reviewed_at = NOW(),
         review_note = COALESCE(p_note, '')
   WHERE id = p_id RETURNING * INTO v_doc;

  PERFORM public.append_audit_log('ocr_document_rejected', 'ocr_document', p_id,
    'OCR document rejected', jsonb_build_object('note', p_note));
  RETURN v_doc;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.ocr_reject_document(TEXT, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.ocr_reject_document(TEXT, TEXT) TO authenticated;

COMMIT;