'use strict'
const fs = require('fs')
const path = require('path')
const dir = path.join(__dirname, '..', 'supabase', 'migrations')

// Migration 073: Brand seeding — insert default BMB brand for tenant-bmb-001
const sql = `-- ============================================
-- Bite Me Baby — Migration 073: TEN-04 Brand Seeding
-- Date: 2026-09-29 · Baseline: post-migration-072 (new columns added)
-- Scope: Insert default BMB brand for tenant-bmb-001
-- Impact: New row only; ON CONFLICT DO NOTHING for idempotency
-- Owner decisions: use existing BMB name as default brand
-- ============================================

BEGIN;

INSERT INTO public.brands (id, tenant_id, name, slug, display_name, tagline, logo_url, status, is_default, is_published)
VALUES (
  'brand-bmb-main',
  'tenant-bmb-001',
  'Bite Me Baby',
  'bmb-main',
  'Bite Me Baby',
  'Cloud kitchen with character',
  '',
  'active',
  true,
  true
)
ON CONFLICT (id) DO NOTHING;

-- Verify exactly 1 active brand exists for tenant-bmb-001 after seeding
DO $$ DECLARE v_count int; BEGIN
  SELECT count(*) INTO v_count FROM public.brands WHERE tenant_id = 'tenant-bmb-001' AND status = 'active';
  IF v_count <> 1 THEN
    RAISE EXCEPTION 'ERR_BRAND_SEEDING: Expected exactly 1 active brand for tenant-bmb-001, found %', v_count;
  END IF;
END $$;

COMMIT;
`

fs.writeFileSync(path.join(dir, '073_brand_seeding.sql'), sql, 'utf-8')
console.log('Migration-073 written:', fs.statSync(path.join(dir, '073_brand_seeding.sql')).size, 'bytes')
