'use strict'
const fs = require('fs')
const path = require('path')
const dir = path.join(__dirname, '..', 'supabase', 'migrations')

// Migration 074: Tenants add default_brand_id field
const sql = `-- ============================================
-- Bite Me Baby — Migration 074: TEN-04 Tenants Add Default Brand
-- Date: 2026-09-29 · Baseline: post-migration-073 (seeding complete)
-- Scope: Add tenants.default_brand_id TEXT FK→brands(id)
-- Impact: Column addition only; backfill via application logic in migration-075
-- Owner decisions: tenant needs default_brand_id for routing fallback
-- ============================================

BEGIN;

-- Add default_brand_id to tenants table
ALTER TABLE public.tenants ADD COLUMN IF NOT EXISTS default_brand_id TEXT REFERENCES public.brands(id);

COMMENT ON COLUMN public.tenants.default_brand_id IS 'Reference to the default brand used for routing fallback when tenant has multiple brands.';

COMMIT;
`

fs.writeFileSync(path.join(dir, '074_tenants_add_default_brand.sql'), sql, 'utf-8')
console.log('Migration-074 written:', fs.statSync(path.join(dir, '074_tenants_add_default_brand.sql')).size, 'bytes')
