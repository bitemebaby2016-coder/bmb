-- ============================================
-- Bite Me Baby Migration 080: TEN-06 Close Default Brand Authority
-- Date: 2026-09-30 · Baseline: m079 deployed
-- Scope: Add tenant_set_default_brand() RPC (MISSING from 079 contract)
-- Impact: Additive only — no destructive changes
-- NOTE: All SELECTs use explicit LIMIT 1 and no ambiguous aliases
-- ============================================

BEGIN;

-- -------------------------------------------------------
-- Check if brands.status and brands.is_published columns exist
-- These were added by migration 075 during TEN-04 expansion
-- If they do NOT exist yet (migration order issue), add them
-- -------------------------------------------------------
DO $$ BEGIN
  -- Check if status column exists on brands
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'brands' AND column_name = 'status'
  ) THEN
    ALTER TABLE public.brands ADD COLUMN status TEXT NOT NULL DEFAULT 'active'
      CHECK (status IN ('active', 'inactive', 'suspended'));
  END IF;

  -- Check if is_published column exists on brands
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'brands' AND column_name = 'is_published'
  ) THEN
    ALTER TABLE public.brands ADD COLUMN is_published BOOLEAN NOT NULL DEFAULT true;
  END IF;

  -- Check if theme_tokens column exists on brands (JSON, used for white-label theming)
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'brands' AND column_name = 'theme_tokens'
  ) THEN
    ALTER TABLE public.brands ADD COLUMN theme_tokens JSONB DEFAULT '{}'::jsonb;
  END IF;

  -- Check if slug column exists on brands
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'brands' AND column_name = 'slug'
  ) THEN
    ALTER TABLE public.brands ADD COLUMN slug TEXT UNIQUE;
  END IF;

  -- Check if display_name column exists on brands
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'brands' AND column_name = 'display_name'
  ) THEN
    ALTER TABLE public.brands ADD COLUMN display_name TEXT DEFAULT '';
  END IF;

  -- Check if tagline column exists on brands
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'brands' AND column_name = 'tagline'
  ) THEN
    ALTER TABLE public.brands ADD COLUMN tagline TEXT DEFAULT '';
  END IF;

END $$;

-- -------------------------------------------------------
-- Create tenant_set_default_brand() RPC
-- -------------------------------------------------------
CREATE OR REPLACE FUNCTION public.tenant_set_default_brand(p_tenant_id TEXT, p_brand_id TEXT)
RETURNS TABLE (tenant_id TEXT, default_brand_id TEXT, updated_at TIMESTAMPTZ)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_role TEXT; v_is_platform BOOLEAN; v_user_tenant TEXT; v_brand_tenant TEXT;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'UNAUTHENTICATED'; END IF;

  -- Fetch role & tenant from profiles safely (no ambiguous aliases)
  SELECT role, COALESCE(tenant_id, 'tenant-bmb-001') INTO v_role, v_user_tenant
    FROM public.profiles WHERE id = auth.uid() LIMIT 1;
  IF v_role IS NULL THEN RAISE EXCEPTION 'FORBIDDEN'; END IF;

  -- Check platform admin flag
  SELECT COALESCE(is_platform, false) INTO v_is_platform
    FROM public.profiles WHERE id = auth.uid() LIMIT 1;

  -- Verify tenant exists
  IF NOT EXISTS (SELECT 1 FROM public.tenants WHERE id = p_tenant_id) THEN
    RAISE EXCEPTION 'NOT_FOUND: Tenant does not exist.';
  END IF;

  -- Verify brand exists and belongs to this tenant
  SELECT b.tenant_id INTO v_brand_tenant
    FROM public.brands b
    WHERE b.id = p_brand_id AND b.tenant_id = p_tenant_id
    LIMIT 1;
  IF v_brand_tenant IS NULL THEN
    RAISE EXCEPTION 'CONFLICT: Brand does not belong to this tenant.';
  END IF;

  -- Verify brand is active+published
  IF NOT EXISTS (
    SELECT 1 FROM public.brands
    WHERE id = p_brand_id AND status = 'active' AND is_published = true
  ) THEN
    RAISE EXCEPTION 'BAD_REQUEST: Default brand must be active and published.';
  END IF;

  -- Authorization: platform admin or own tenant
  IF NOT v_is_platform AND v_user_tenant != p_tenant_id THEN
    RAISE EXCEPTION 'FORBIDDEN: Can only set default brand of own tenant.';
  END IF;

  -- Update tenant's default_brand_id
  UPDATE public.tenants SET default_brand_id = p_brand_id, updated_at = NOW() WHERE id = p_tenant_id;

  -- Return updated row
  RETURN QUERY SELECT tenant_id, default_brand_id, updated_at FROM public.tenants WHERE id = p_tenant_id;
END; $$;
REVOKE EXECUTE ON FUNCTION public.tenant_set_default_brand(text,text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.tenant_set_default_brand(text,text) TO authenticated;

COMMIT;
