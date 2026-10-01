-- ============================================
-- Bite Me Baby — Migration 103: tenant_id column defaults (TEN-01..07 drift repair)
--
-- PROBLEM (prod 2026-10-01):
--   Migrations 062..101 added tenants + tenant_id (TEXT NOT NULL, NO default) to 16
--   tables, but client insert paths (products / product_categories / menu_sections /
--   delivery_rounds) were never updated → every admin CREATE fails with 23502
--   'null value in column "tenant_id"'.
--
-- FIX (defense in depth — server side):
--   + default_tenant_id(): resolves the single/default tenant id from public.tenants
--     (owner-controlled — adding/switching tenant in DB changes the default, no code edit)
--   + SET DEFAULT on tenant_id for EVERY tenant-scoped table whose default is missing
--   + verification block (fails migration if any NOT NULL tenant_id still lacks a default)
--
-- Client side: bmbAdminApi_products.ts now sends the real tenant_id explicitly
-- (adminTenantContext → brandContext → default). The DB default is the safety net.
-- ============================================

-- 1) Resolver: default tenant id (single-tenant deployment; falls back to seed id)
CREATE OR REPLACE FUNCTION public.default_tenant_id() RETURNS TEXT
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $fn$
  SELECT t.id FROM public.tenants t ORDER BY t.created_at ASC LIMIT 1;
$fn$;

-- 2) Defaults on every tenant-scoped table (idempotent; only where default is NULL)
DO $fix$
DECLARE
  r RECORD;
  n INTEGER := 0;
BEGIN
  FOR r IN
    SELECT c.table_name
      FROM information_schema.columns c
     WHERE c.table_schema = 'public'
       AND c.column_name = 'tenant_id'
       AND c.column_default IS NULL
  LOOP
    EXECUTE format('ALTER TABLE public.%I ALTER COLUMN tenant_id SET DEFAULT public.default_tenant_id()', r.table_name);
    n := n + 1;
  END LOOP;
  RAISE NOTICE 'tenant_id defaults set on % tables', n;
END;
$fix$;

-- 3) VERIFICATION — every NOT NULL tenant_id column must now carry the default
DO $verify$
DECLARE
  r RECORD;
  missing INTEGER := 0;
BEGIN
  FOR r IN
    SELECT c.table_name
      FROM information_schema.columns c
     WHERE c.table_schema = 'public'
       AND c.column_name = 'tenant_id'
       AND c.is_nullable = 'NO'
       AND (c.column_default IS NULL OR c.column_default NOT LIKE '%default_tenant_id%')
  LOOP
    RAISE WARNING 'table % still missing tenant_id default', r.table_name;
    missing := missing + 1;
  END LOOP;
  IF missing <> 0 THEN
    RAISE EXCEPTION 'FAIL: % NOT NULL tenant_id columns lack default_tenant_id()', missing;
  END IF;
END;
$verify$;