'use strict'
const fs = require('fs')
const path = require('path')
const dir = path.join(__dirname, '..', 'supabase', 'migrations')

// Migration 072: Brands constraints + new columns
const sql = `-- ============================================
-- Bite Me Baby — Migration 072: TEN-04 Brands Constraints & New Columns
-- Date: 2026-09-29 · Baseline: 11cef87 (TEN-03 deployed)
-- Scope: Add slug, display_name, tagline, description, status, is_default,
--        is_published, theme_tokens to brands table; add UNIQUE(slug, tenant_id)
-- Impact: Non-destructive column additions only; existing data preserved
-- Owner decisions applied: branding=brand-owned, slug per-tenant unique
-- ============================================

BEGIN;

-- -------------------------------------------------------
-- 1. ADD NEW COLUMNS TO brands TABLE
-- -------------------------------------------------------

ALTER TABLE public.brands ADD COLUMN IF NOT EXISTS slug TEXT DEFAULT '';
ALTER TABLE public.brands ADD COLUMN IF NOT EXISTS display_name TEXT NOT NULL DEFAULT '';
ALTER TABLE public.brands ADD COLUMN IF NOT EXISTS tagline TEXT DEFAULT '';
ALTER TABLE public.brands ADD COLUMN IF NOT EXISTS description TEXT DEFAULT '';
ALTER TABLE public.brands ADD COLUMN IF NOT EXISTS logo_url_icon TEXT DEFAULT '';
ALTER TABLE public.brands ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'active'
  CHECK (status IN ('active', 'inactive', 'suspended'));
ALTER TABLE public.brands ADD COLUMN IF NOT EXISTS is_default BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE public.brands ADD COLUMN IF NOT EXISTS is_published BOOLEAN NOT NULL DEFAULT true;

ALTER TABLE public.brands ADD COLUMN IF NOT EXISTS theme_tokens JSONB
  DEFAULT '{"primary_color":"#F97316","secondary_color":"#FBBF24","accent_color":"#92400E","bg_base":"#FFF7ED","surface_color":"#FFFFFF","text_base":"#1C1917","font_display":"Nunito","font_body":"Quicksand"}'::jsonb;

COMMENT ON COLUMN public.brands.slug IS 'Brand routing identity — unique per tenant for subdomain/QR routing compatibility.';
COMMENT ON COLUMN public.brands.display_name IS 'Human-readable brand name shown to customers.';
COMMENT ON COLUMN public.brands.tagline IS 'Short brand description under logo.';
COMMENT ON COLUMN public.brands.description IS 'Full brand description.';
COMMENT ON COLUMN public.brands.logo_url_icon IS 'Apple touch icon / favicon reference.';
COMMENT ON COLUMN public.brands.status IS 'Active/inactive/suspended — controls customer visibility.';
COMMENT ON COLUMN public.brands.is_default IS 'Default brand for tenant routing fallback.';
COMMENT ON COLUMN public.brands.is_published IS 'Published brands visible to customers via public-read policy.';
COMMENT ON COLUMN public.brands.theme_tokens IS 'JSONB controlled keyset: primary_color, secondary_color, accent_color, bg_base, surface_color, text_base, font_display, font_body. Used for runtime CSS injection.';

-- -------------------------------------------------------
-- 2. UNIQUE CONSTRAINT on (slug, tenant_id) — per-tenant uniqueness
-- This allows different tenants to use same brand slug without collision
-- -------------------------------------------------------

DO $$ BEGIN
  -- Drop existing unique index if it exists (from original CREATE UNIQUE on slug)
  EXECUTE 'DROP INDEX IF EXISTS public.brands_slug_key';
EXCEPTION WHEN undefined_object THEN NULL;
END $$;

-- Create composite unique constraint
DO $$ BEGIN
  ALTER TABLE public.brands ADD CONSTRAINT brands_slug_tenant_unique UNIQUE (slug, tenant_id);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

COMMIT;
`

fs.writeFileSync(path.join(dir, '072_brands_enforce_constraints.sql'), sql, 'utf-8')
console.log('Migration-072 written:', fs.statSync(path.join(dir, '072_brands_enforce_constraints.sql')).size, 'bytes')
