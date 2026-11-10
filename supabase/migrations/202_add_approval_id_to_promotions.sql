-- ============================================
-- Migration 202: Add approval_id to promotions table
-- Links promotion/banner to content_approvals for audit trail
-- ============================================

-- Add approval_id column referencing content_approvals (id is TEXT, not uuid)
ALTER TABLE public.promotions
ADD COLUMN approval_id TEXT REFERENCES public.content_approvals(id) ON DELETE SET NULL;

-- Add index for lookup
CREATE INDEX IF NOT EXISTS idx_promotions_approval_id ON public.promotions(approval_id);

-- Comment
COMMENT ON COLUMN public.promotions.approval_id IS 'Link to content_approvals row for CNT-01 approval workflow';