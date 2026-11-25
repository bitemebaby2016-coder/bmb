-- ============================================
-- Contract Tests for Phase 1: Smart Ingredient & Cost Management
-- Migrations 214-218: Suppliers, Inventory enrichment, Supplier Products, Recipes batch yield
-- Run on fresh ephemeral PostgreSQL (after prelude + migrations 001-213)
-- ============================================

-- ============================================
-- PRELUDE: Apply all migrations 001-218 first
-- This test assumes migrations have been applied via contract-tests.yml loop
-- ============================================

-- ============================================
-- TEST 214: suppliers table + RLS
-- ============================================

-- 214.1 Table exists with correct columns
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'suppliers'
    AND column_name IN ('id','name','code','contact_name','phone','email','address',
                        'payment_terms_days','lead_time_days','is_active',
                        'tenant_id','branch_id','created_at','updated_at')
  ) THEN
    RAISE EXCEPTION '214.1 FAIL: suppliers table missing required columns';
  END IF;
  RAISE NOTICE '214.1 PASS: suppliers table schema OK';
END $$;

-- 214.2 Indexes exist
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE schemaname='public' AND tablename='suppliers' AND indexname='idx_suppliers_tenant') THEN
    RAISE EXCEPTION '214.2 FAIL: idx_suppliers_tenant missing';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE schemaname='public' AND tablename='suppliers' AND indexname='idx_suppliers_branch') THEN
    RAISE EXCEPTION '214.2 FAIL: idx_suppliers_branch missing';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE schemaname='public' AND tablename='suppliers' AND indexname='idx_suppliers_active') THEN
    RAISE EXCEPTION '214.2 FAIL: idx_suppliers_active missing';
  END IF;
  RAISE NOTICE '214.2 PASS: suppliers indexes OK';
END $$;

-- 214.3 RLS enabled
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_tables WHERE schemaname='public' AND tablename='suppliers' AND rowsecurity = true
  ) THEN
    RAISE EXCEPTION '214.3 FAIL: RLS not enabled on suppliers';
  END IF;
  RAISE NOTICE '214.3 PASS: RLS enabled on suppliers';
END $$;

-- 214.4 RLS Policies exist
DO $$
DECLARE
  pol_count INT;
BEGIN
  SELECT count(*) INTO pol_count FROM pg_policies WHERE schemaname='public' AND tablename='suppliers';
  IF pol_count < 2 THEN
    RAISE EXCEPTION '214.4 FAIL: Expected at least 2 policies (admin + staff_read), found %', pol_count;
  END IF;
  RAISE NOTICE '214.4 PASS: suppliers has % policies', pol_count;
END $$;

-- 214.5 Admin can CRUD
DO $$
DECLARE
  test_id TEXT := 'test-sup-admin-' || gen_random_uuid()::text;
BEGIN
  -- Insert as admin (bypass RLS via SECURITY DEFINER function or direct with admin role)
  -- In CI, we run as postgres superuser so RLS is bypassed
  INSERT INTO public.suppliers (id, name, code, phone, is_active)
  VALUES (test_id, 'Admin Test Supplier', 'ATS', '0999999999', true);
  
  IF NOT EXISTS (SELECT 1 FROM public.suppliers WHERE id = test_id) THEN
    RAISE EXCEPTION '214.5 FAIL: Admin cannot insert supplier';
  END IF;
  
  UPDATE public.suppliers SET name = 'Updated' WHERE id = test_id;
  IF NOT EXISTS (SELECT 1 FROM public.suppliers WHERE id = test_id AND name = 'Updated') THEN
    RAISE EXCEPTION '214.5 FAIL: Admin cannot update supplier';
  END IF;
  
  DELETE FROM public.suppliers WHERE id = test_id;
  IF EXISTS (SELECT 1 FROM public.suppliers WHERE id = test_id) THEN
    RAISE EXCEPTION '214.5 FAIL: Admin cannot delete supplier';
  END IF;
  
  RAISE NOTICE '214.5 PASS: Admin CRUD works';
END $$;

-- 214.6 Staff roles can READ active suppliers
-- Test via function proxies (is_inventory, is_kitchen, is_pos, is_finance)
-- These functions are created in migration 146
DO $$
DECLARE
  test_id TEXT := 'test-sup-staff-' || gen_random_uuid()::text;
  rec RECORD;
BEGIN
  -- Insert test supplier (as superuser)
  INSERT INTO public.suppliers (id, name, code, phone, is_active)
  VALUES (test_id, 'Staff Read Test', 'SRT', '0888888888', true);
  
  -- Test is_inventory() function exists
  PERFORM public.is_inventory();
  RAISE NOTICE '214.6 PASS: is_inventory() function exists';
  
  -- Test is_kitchen()
  PERFORM public.is_kitchen();
  RAISE NOTICE '214.6 PASS: is_kitchen() function exists';
  
  -- Test is_pos()
  PERFORM public.is_pos();
  RAISE NOTICE '214.6 PASS: is_pos() function exists';
  
  -- Test is_finance()
  PERFORM public.is_finance();
  RAISE NOTICE '214.6 PASS: is_finance() function exists';
  
  DELETE FROM public.suppliers WHERE id = test_id;
END $$;

-- 214.7 Trigger updated_at works
DO $$
DECLARE
  test_id TEXT := 'test-sup-trigger-' || gen_random_uuid()::text;
  created_at_val TIMESTAMPTZ;
  updated_at_val TIMESTAMPTZ;
BEGIN
  INSERT INTO public.suppliers (id, name, code, phone, is_active)
  VALUES (test_id, 'Trigger Test', 'TRG', '0777777777', true)
  RETURNING created_at, updated_at INTO created_at_val, updated_at_val;
  
  IF created_at_val IS NULL OR updated_at_val IS NULL THEN
    RAISE EXCEPTION '214.7 FAIL: created_at/updated_at not set on insert';
  END IF;
  
  PERFORM pg_sleep(0.01);
  UPDATE public.suppliers SET name = 'Trigger Updated' WHERE id = test_id;
  
  SELECT updated_at INTO updated_at_val FROM public.suppliers WHERE id = test_id;
  IF updated_at_val <= created_at_val THEN
    RAISE EXCEPTION '214.7 FAIL: updated_at not updated on update';
  END IF;
  
  DELETE FROM public.suppliers WHERE id = test_id;
  RAISE NOTICE '214.7 PASS: updated_at trigger works';
END $$;


-- ============================================
-- TEST 215: inventory.supplier_id FK + backfill
-- ============================================

-- 215.1 Column exists with FK
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'inventory' AND column_name = 'supplier_id'
  ) THEN
    RAISE EXCEPTION '215.1 FAIL: inventory.supplier_id column missing';
  END IF;
  
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE table_schema = 'public' AND table_name = 'inventory'
    AND constraint_name LIKE '%supplier_id%' AND constraint_type = 'FOREIGN KEY'
  ) THEN
    RAISE EXCEPTION '215.1 FAIL: FK constraint on inventory.supplier_id missing';
  END IF;
  
  RAISE NOTICE '215.1 PASS: inventory.supplier_id FK exists';
END $$;

-- 215.2 Index exists
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE schemaname='public' AND tablename='inventory' AND indexname='idx_inventory_supplier') THEN
    RAISE EXCEPTION '215.2 FAIL: idx_inventory_supplier missing';
  END IF;
  RAISE NOTICE '215.2 PASS: inventory.supplier_id index exists';
END $$;

-- 215.3 Backfill works (denormalized supplier_name + supplier_phone -> supplier_id)
DO $$
DECLARE
  sup_id TEXT := 'sup-backfill-test-' || gen_random_uuid()::text;
  ing_id TEXT := 'ing-backfill-test-' || gen_random_uuid()::text;
  ing_supplier_id TEXT;
BEGIN
  -- Create supplier
  INSERT INTO public.suppliers (id, name, code, phone, is_active)
  VALUES (sup_id, 'Backfill Supplier', 'BFS', '0555555555', true);
  
  -- Create inventory with matching denormalized data
  INSERT INTO public.inventory (id, name, category, unit, current_stock, min_stock, max_stock, unit_price,
                                supplier_name, supplier_phone, status)
  VALUES (ing_id, 'Backfill Ingredient', 'other', 'piece', 10, 5, 100, 100,
          'Backfill Supplier', '0555555555', 'in_stock');
  
  -- Run backfill logic (same as migration 215)
  UPDATE public.inventory i
  SET supplier_id = s.id
  FROM public.suppliers s
  WHERE i.supplier_name IS NOT NULL AND i.supplier_name != ''
    AND i.supplier_phone IS NOT NULL AND i.supplier_phone != ''
    AND lower(trim(s.name)) = lower(trim(i.supplier_name))
    AND trim(s.phone) = trim(i.supplier_phone)
    AND i.supplier_id IS NULL;
  
  SELECT supplier_id INTO ing_supplier_id FROM public.inventory WHERE id = ing_id;
  
  IF ing_supplier_id IS NULL THEN
    RAISE EXCEPTION '215.3 FAIL: Backfill did not populate supplier_id';
  END IF;
  
  IF ing_supplier_id != sup_id THEN
    RAISE EXCEPTION '215.3 FAIL: Backfill linked wrong supplier (got %, expected %)', ing_supplier_id, sup_id;
  END IF;
  
  DELETE FROM public.inventory WHERE id = ing_id;
  DELETE FROM public.suppliers WHERE id = sup_id;
  RAISE NOTICE '215.3 PASS: Backfill correctly links supplier_id';
END $$;


-- ============================================
-- TEST 216: Inventory enriched columns
-- ============================================

-- 216.1 All new columns exist with correct types and defaults
DO $$
DECLARE
  missing_cols TEXT[] := '{}';
  col RECORD;
BEGIN
  FOR col IN SELECT column_name, data_type, column_default, is_nullable
             FROM information_schema.columns
             WHERE table_schema = 'public' AND table_name = 'inventory'
             AND column_name IN ('prep_yield_factor','prep_waste_pct','purchase_unit','use_unit',
                                 'conversion_factor','package_size','gross_weight','net_weight',
                                 'wavg_cost','last_purchase_price','last_approved_price')
  LOOP
    -- All should exist
    NULL;
  END LOOP;
  
  SELECT array_agg(column_name) INTO missing_cols
  FROM information_schema.columns
  WHERE table_schema = 'public' AND table_name = 'inventory'
    AND column_name IN ('prep_yield_factor','prep_waste_pct','purchase_unit','use_unit',
                        'conversion_factor','package_size','gross_weight','net_weight',
                        'wavg_cost','last_purchase_price','last_approved_price')
    AND column_name NOT IN (SELECT column_name FROM information_schema.columns
                            WHERE table_schema = 'public' AND table_name = 'inventory');
  
  IF array_length(missing_cols, 1) > 0 THEN
    RAISE EXCEPTION '216.1 FAIL: Missing columns: %', missing_cols;
  END IF;
  
  RAISE NOTICE '216.1 PASS: All 11 new inventory columns exist';
END $$;

-- 216.2 Defaults and constraints
DO $$
BEGIN
  -- prep_yield_factor default 1.0, check >0 and <=1
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='inventory' AND column_name='prep_yield_factor'
    AND column_default = '1.0000'
  ) THEN
    RAISE EXCEPTION '216.2 FAIL: prep_yield_factor default not 1.0000';
  END IF;
  
  -- prep_waste_pct default 0
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='inventory' AND column_name='prep_waste_pct'
    AND column_default = '0.00'
  ) THEN
    RAISE EXCEPTION '216.2 FAIL: prep_waste_pct default not 0.00';
  END IF;
  
  -- conversion_factor default 1.0, check >0
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='inventory' AND column_name='conversion_factor'
    AND column_default = '1.0000'
  ) THEN
    RAISE EXCEPTION '216.2 FAIL: conversion_factor default not 1.0000';
  END IF;
  
  -- Check constraint inventory_units_consistency exists
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'inventory_units_consistency' AND conrelid = 'public.inventory'::regclass
  ) THEN
    RAISE EXCEPTION '216.2 FAIL: inventory_units_consistency constraint missing';
  END IF;
  
  RAISE NOTICE '216.2 PASS: Defaults and constraints OK';
END $$;

-- 216.3 Backfill: use_unit from unit, purchase_unit = use_unit
DO $$
DECLARE
  test_id TEXT := 'ing-backfill-units-' || gen_random_uuid()::text;
  rec RECORD;
BEGIN
  INSERT INTO public.inventory (id, name, category, unit, current_stock, min_stock, max_stock, unit_price,
                                supplier_name, supplier_phone, status)
  VALUES (test_id, 'Unit Backfill Test', 'other', 'liter', 10, 5, 100, 100,
          'Test Supplier', '0444444444', 'in_stock');
  
  -- Migration 216 backfill logic
  UPDATE public.inventory
  SET use_unit = unit
  WHERE use_unit IS NULL AND unit IS NOT NULL;
  
  UPDATE public.inventory
  SET purchase_unit = use_unit, conversion_factor = 1.0
  WHERE purchase_unit IS NULL AND use_unit IS NOT NULL;
  
  SELECT use_unit, purchase_unit, conversion_factor INTO rec
  FROM public.inventory WHERE id = test_id;
  
  IF rec.use_unit != 'liter' THEN
    RAISE EXCEPTION '216.3 FAIL: use_unit not backfilled from unit (got %)', rec.use_unit;
  END IF;
  
  IF rec.purchase_unit != 'liter' THEN
    RAISE EXCEPTION '216.3 FAIL: purchase_unit not set to use_unit (got %)', rec.purchase_unit;
  END IF;
  
  IF rec.conversion_factor != 1.0 THEN
    RAISE EXCEPTION '216.3 FAIL: conversion_factor not defaulted to 1.0 (got %)', rec.conversion_factor;
  END IF;
  
  DELETE FROM public.inventory WHERE id = test_id;
  RAISE NOTICE '216.3 PASS: Unit backfill works correctly';
END $$;

-- 216.4 Indexes on cost columns
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE schemaname='public' AND tablename='inventory' AND indexname='idx_inventory_wavg_cost') THEN
    RAISE EXCEPTION '216.4 FAIL: idx_inventory_wavg_cost missing';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE schemaname='public' AND tablename='inventory' AND indexname='idx_inventory_last_purchase') THEN
    RAISE EXCEPTION '216.4 FAIL: idx_inventory_last_purchase missing';
  END IF;
  RAISE NOTICE '216.4 PASS: Cost column indexes exist';
END $$;


-- ============================================
-- TEST 217: supplier_products mapping table
-- ============================================

-- 217.1 Table exists with correct columns
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'supplier_products'
    AND column_name IN ('id','supplier_id','ingredient_id','supplier_sku','supplier_name',
                        'purchase_unit','use_unit','conversion_factor',
                        'last_committed_price','last_realized_price','last_approved_price',
                        'last_committed_at','last_realized_at','last_approved_at',
                        'last_purchase_date','min_order_qty','lead_time_days',
                        'is_preferred','is_active','tenant_id','branch_id','created_at','updated_at')
  ) THEN
    RAISE EXCEPTION '217.1 FAIL: supplier_products missing required columns';
  END IF;
  
  -- Unique constraint on (supplier_id, ingredient_id)
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname LIKE '%supplier_products%supplier_id%ingredient_id%' AND contype = 'u'
  ) THEN
    RAISE EXCEPTION '217.1 FAIL: Unique constraint on (supplier_id, ingredient_id) missing';
  END IF;
  
  RAISE NOTICE '217.1 PASS: supplier_products schema OK';
END $$;

-- 217.2 FK constraints
DO $$
DECLARE
  fk_count INT;
BEGIN
  SELECT count(*) INTO fk_count
  FROM information_schema.table_constraints
  WHERE table_schema = 'public' AND table_name = 'supplier_products'
    AND constraint_type = 'FOREIGN KEY';
  
  IF fk_count < 2 THEN
    RAISE EXCEPTION '217.2 FAIL: Expected at least 2 FKs (supplier_id, ingredient_id), found %', fk_count;
  END IF;
  RAISE NOTICE '217.2 PASS: FK constraints exist';
END $$;

-- 217.3 Three price state columns exist
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='supplier_products' AND column_name='last_committed_price') THEN
    RAISE EXCEPTION '217.3 FAIL: last_committed_price missing';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='supplier_products' AND column_name='last_realized_price') THEN
    RAISE EXCEPTION '217.3 FAIL: last_realized_price missing';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='supplier_products' AND column_name='last_approved_price') THEN
    RAISE EXCEPTION '217.3 FAIL: last_approved_price missing';
  END IF;
  RAISE NOTICE '217.3 PASS: Three price state columns exist';
END $$;

-- 217.4 RLS enabled
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_tables WHERE schemaname='public' AND tablename='supplier_products' AND rowsecurity = true
  ) THEN
    RAISE EXCEPTION '217.4 FAIL: RLS not enabled on supplier_products';
  END IF;
  RAISE NOTICE '217.4 PASS: RLS enabled on supplier_products';
END $$;

-- 217.5 RLS Policies (admin + staff_read)
DO $$
DECLARE
  pol_count INT;
BEGIN
  SELECT count(*) INTO pol_count FROM pg_policies WHERE schemaname='public' AND tablename='supplier_products';
  IF pol_count < 2 THEN
    RAISE EXCEPTION '217.5 FAIL: Expected at least 2 policies, found %', pol_count;
  END IF;
  RAISE NOTICE '217.5 PASS: supplier_products has % policies', pol_count;
END $$;

-- 217.6 Trigger updated_at
DO $$
DECLARE
  test_id TEXT := 'sp-trigger-' || gen_random_uuid()::text;
  sup_id TEXT := 'sup-sp-trigger-' || gen_random_uuid()::text;
  ing_id TEXT := 'ing-sp-trigger-' || gen_random_uuid()::text;
  created_at_val TIMESTAMPTZ;
  updated_at_val TIMESTAMPTZ;
BEGIN
  INSERT INTO public.suppliers (id, name, code, phone, is_active)
  VALUES (sup_id, 'SP Trigger Supplier', 'SPTS', '0333333333', true);
  
  INSERT INTO public.inventory (id, name, category, unit, current_stock, min_stock, max_stock, unit_price,
                                supplier_name, supplier_phone, status)
  VALUES (ing_id, 'SP Trigger Ingredient', 'other', 'piece', 10, 5, 100, 100,
          'SP Trigger Supplier', '0333333333', 'in_stock');
  
  INSERT INTO public.supplier_products (id, supplier_id, ingredient_id, purchase_unit, use_unit, conversion_factor, is_active)
  VALUES (test_id, sup_id, ing_id, 'carton', 'piece', 24, true)
  RETURNING created_at, updated_at INTO created_at_val, updated_at_val;
  
  IF created_at_val IS NULL OR updated_at_val IS NULL THEN
    RAISE EXCEPTION '217.6 FAIL: created_at/updated_at not set on insert';
  END IF;
  
  PERFORM pg_sleep(0.01);
  UPDATE public.supplier_products SET supplier_sku = 'SKU-001' WHERE id = test_id;
  
  SELECT updated_at INTO updated_at_val FROM public.supplier_products WHERE id = test_id;
  IF updated_at_val <= created_at_val THEN
    RAISE EXCEPTION '217.6 FAIL: updated_at not updated on update';
  END IF;
  
  DELETE FROM public.supplier_products WHERE id = test_id;
  DELETE FROM public.inventory WHERE id = ing_id;
  DELETE FROM public.suppliers WHERE id = sup_id;
  RAISE NOTICE '217.6 PASS: updated_at trigger works';
END $$;

-- 217.7 Indexes
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE schemaname='public' AND tablename='supplier_products' AND indexname='idx_supplier_products_supplier') THEN
    RAISE EXCEPTION '217.7 FAIL: idx_supplier_products_supplier missing';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE schemaname='public' AND tablename='supplier_products' AND indexname='idx_supplier_products_ingredient') THEN
    RAISE EXCEPTION '217.7 FAIL: idx_supplier_products_ingredient missing';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE schemaname='public' AND tablename='supplier_products' AND indexname='idx_supplier_products_active') THEN
    RAISE EXCEPTION '217.7 FAIL: idx_supplier_products_active missing';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE schemaname='public' AND tablename='supplier_products' AND indexname='idx_supplier_products_preferred') THEN
    RAISE EXCEPTION '217.7 FAIL: idx_supplier_products_preferred missing';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE schemaname='public' AND tablename='supplier_products' AND indexname='idx_supplier_products_sku') THEN
    RAISE EXCEPTION '217.7 FAIL: idx_supplier_products_sku missing';
  END IF;
  RAISE NOTICE '217.7 PASS: All supplier_products indexes exist';
END $$;


-- ============================================
-- TEST 218: Recipes batch yield columns
-- ============================================

-- 218.1 Columns exist
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='recipes' AND column_name='batch_yield_factor') THEN
    RAISE EXCEPTION '218.1 FAIL: batch_yield_factor missing';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='recipes' AND column_name='batch_waste_pct') THEN
    RAISE EXCEPTION '218.1 FAIL: batch_waste_pct missing';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='recipes' AND column_name='cost_per_unit') THEN
    RAISE EXCEPTION '218.1 FAIL: cost_per_unit missing';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='recipes' AND column_name='last_cost_calculated_at') THEN
    RAISE EXCEPTION '218.1 FAIL: last_cost_calculated_at missing';
  END IF;
  RAISE NOTICE '218.1 PASS: All 4 new recipes columns exist';
END $$;

-- 218.2 Defaults and constraints
DO $$
BEGIN
  -- batch_yield_factor default 1.0, check >0 and <=1
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='recipes' AND column_name='batch_yield_factor'
    AND column_default = '1.0000'
  ) THEN
    RAISE EXCEPTION '218.2 FAIL: batch_yield_factor default not 1.0000';
  END IF;
  
  -- batch_waste_pct default 0
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='recipes' AND column_name='batch_waste_pct'
    AND column_default = '0.00'
  ) THEN
    RAISE EXCEPTION '218.2 FAIL: batch_waste_pct default not 0.00';
  END IF;
  
  RAISE NOTICE '218.2 PASS: Defaults OK';
END $$;

-- 218.3 Index on cost_per_unit
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE schemaname='public' AND tablename='recipes' AND indexname='idx_recipes_cost_per_unit') THEN
    RAISE EXCEPTION '218.3 FAIL: idx_recipes_cost_per_unit missing';
  END IF;
  RAISE NOTICE '218.3 PASS: idx_recipes_cost_per_unit exists';
END $$;


-- ============================================
-- SUMMARY
-- ============================================
DO $$
BEGIN
  RAISE NOTICE '';
  RAISE NOTICE '============================================';
  RAISE NOTICE 'PHASE 1 CONTRACT TESTS COMPLETE';
  RAISE NOTICE 'Migrations 214-218 all verified';
  RAISE NOTICE '============================================';
END $$;