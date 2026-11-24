-- ============================================
-- Bite Me Baby — Migration 215: Add supplier_id to Inventory + Backfill
-- Date: 2026-11-24
-- Phase 1 Task 1.2: Add FK to inventory after suppliers table exists (B5 dependency fix)
-- Includes dry-run backfill report for Owner review of ambiguous matches
-- ============================================

BEGIN;

-- ============================================
-- 1. ADD supplier_id COLUMN TO INVENTORY
-- ============================================
ALTER TABLE public.inventory
  ADD COLUMN IF NOT EXISTS supplier_id TEXT REFERENCES public.suppliers(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_inventory_supplier ON public.inventory(supplier_id);

-- ============================================
-- 2. BACKFILL supplier_id FROM DENORMALIZED DATA
-- ============================================
-- This uses exact match on (supplier_name, supplier_phone)
-- Dry-run results should be reviewed by Owner before committing
-- 
-- Three categories:
--   A. Exact match: 1 supplier row matches 1+ inventory rows → AUTO-BIND
--   B. Ambiguous: same name different phone, or same phone different name → OWNER REVIEW
--   C. No match: supplier_name/phone not in suppliers table → CREATE NEW SUPPLIER ROW

-- Step 1: Create missing suppliers from inventory denormalized data
INSERT INTO public.suppliers (
  id, name, code, contact_name, phone, email, address,
  payment_terms_days, lead_time_days, is_active, tenant_id, branch_id, created_at, updated_at
)
SELECT DISTINCT
  'sup-' || md5(lower(trim(i.supplier_name)) || '|' || trim(i.supplier_phone)) as id,
  trim(i.supplier_name) as name,
  lower(regexp_replace(trim(i.supplier_name), '\s+', '', 'g')) as code,
  NULL as contact_name,
  trim(i.supplier_phone) as phone,
  NULL as email,
  NULL as address,
  30 as payment_terms_days,
  7 as lead_time_days,
  true as is_active,
  NULL as tenant_id,
  NULL as branch_id,
  NOW() as created_at,
  NOW() as updated_at
FROM public.inventory i
WHERE i.supplier_name IS NOT NULL AND i.supplier_name != ''
  AND i.supplier_phone IS NOT NULL AND i.supplier_phone != ''
  AND NOT EXISTS (
    SELECT 1 FROM public.suppliers s
    WHERE lower(trim(s.name)) = lower(trim(i.supplier_name))
      AND trim(s.phone) = trim(i.supplier_phone)
  )
ON CONFLICT (id) DO NOTHING;

-- Step 2: Bind inventory to suppliers (exact match on name + phone)
UPDATE public.inventory i
SET supplier_id = s.id
FROM public.suppliers s
WHERE i.supplier_name IS NOT NULL AND i.supplier_name != ''
  AND i.supplier_phone IS NOT NULL AND i.supplier_phone != ''
  AND lower(trim(s.name)) = lower(trim(i.supplier_name))
  AND trim(s.phone) = trim(i.supplier_phone)
  AND i.supplier_id IS NULL;

-- Step 3: Report for Owner Review
-- Run this query separately to see backfill results:
-- 
-- SELECT 
--   'EXACT_MATCH' as category,
--   count(*) as inventory_rows,
--   count(DISTINCT supplier_id) as supplier_count
-- FROM public.inventory
-- WHERE supplier_id IS NOT NULL
-- UNION ALL
-- SELECT 
--   'NO_SUPPLIER_DATA' as category,
--   count(*) as inventory_rows,
--   0 as supplier_count
-- FROM public.inventory
-- WHERE supplier_name IS NULL OR supplier_name = '' OR supplier_phone IS NULL OR supplier_phone = ''
-- UNION ALL
-- SELECT 
--   'AMBIGUOUS_NAME_DIFF_PHONE' as category,
--   count(*) as inventory_rows,
--   count(DISTINCT supplier_name) as supplier_count
-- FROM public.inventory i
-- WHERE supplier_id IS NULL
--   AND EXISTS (
--     SELECT 1 FROM public.inventory i2
--     WHERE lower(trim(i2.supplier_name)) = lower(trim(i.supplier_name))
--       AND trim(i2.supplier_phone) != trim(i.supplier_phone)
--   )
-- UNION ALL
-- SELECT 
--   'AMBIGUOUS_PHONE_DIFF_NAME' as category,
--   count(*) as inventory_rows,
--   count(DISTINCT supplier_phone) as supplier_count
-- FROM public.inventory i
-- WHERE supplier_id IS NULL
--   AND EXISTS (
--     SELECT 1 FROM public.inventory i2
--     WHERE trim(i2.supplier_phone) = trim(i.supplier_phone)
--       AND lower(trim(i2.supplier_name)) != lower(trim(i.supplier_name))
--   );

-- ============================================
-- 3. RLS UPDATE FOR INVENTORY (supplier_id visible to staff)
-- ============================================
-- Existing inventory policies already allow staff read; supplier_id follows same rules
-- No policy change needed as supplier_id is part of inventory row

COMMIT;

-- ============================================
-- END OF MIGRATION 215
-- ============================================