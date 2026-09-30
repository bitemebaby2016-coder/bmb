-- ============================================
-- Bite Me Baby Migration 092-B: CAT-04 Products Branch Overrides
-- Date: 2026-09-30 · Baseline: M091 added orders.branch_id
-- Scope: Per-branch product availability overrides + OOS tracking
-- Design: products.is_available = global default; branch-specific rows override it
-- ============================================

BEGIN;

CREATE TABLE IF NOT EXISTS public.products_branch_overrides (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  product_id TEXT NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  branch_id TEXT NOT NULL REFERENCES public.branches(id) ON DELETE CASCADE,
  is_available_override BOOLEAN NOT NULL DEFAULT false,
  out_of_stock BOOLEAN NOT NULL DEFAULT false,
  out_of_stock_reason TEXT CHECK(out_of_stock_reason IN ('sold_out', 'paused_for_branch', 'supply_issue', 'seasonal')),
  branch_sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT uq_product_branch UNIQUE (product_id, branch_id)
);

COMMENT ON TABLE public.products_branch_overrides IS
  'CAT-04 MULTI-BRANCH CATALOG: Per-branch product availability overrides.';

CREATE INDEX IF NOT EXISTS idx_pbo_branch ON public.products_branch_overrides (branch_id);
CREATE INDEX IF NOT EXISTS idx_pbo_product ON public.products_branch_overrides (product_id);

-- RPC: Resolve effective availability for a product at a given branch
CREATE OR REPLACE FUNCTION public.get_product_branch_availability(
  p_product_id TEXT,
  p_branch_id TEXT
) RETURNS TABLE (
  is_available BOOLEAN,
  out_of_stock BOOLEAN,
  out_of_stock_reason TEXT,
  branch_sort_order INTEGER
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    COALESCE(pbo.is_available_override, p.is_available),
    CASE WHEN pbo.out_of_stock = true THEN true WHEN p.is_available = false THEN true ELSE false END,
    COALESCE(pbo.out_of_stock_reason, ''::text),
    COALESCE(pbo.branch_sort_order, p.sort_order)
  FROM public.products p
  LEFT JOIN public.products_branch_overrides pbo
    ON pbo.product_id = p.id AND pbo.branch_id = p_branch_id
  WHERE p.id = p_product_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMIT;
