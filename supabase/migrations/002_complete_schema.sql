-- ============================================
-- Bite Me Baby — Migration 002: Frontend Compatibility
-- Date: 2026-09-16
--
-- FIXED: This file was previously a destructive full-schema rewrite
-- (DROP TABLE ... CASCADE + UUID primary keys). That broke the migration
-- chain because:
--   1. DROP TABLE wiped existing data
--   2. UUID PKs rejected the TEXT ids the frontend generates
--      (e.g. `prod-${Date.now()}`, `cat-${Date.now()}`)
--
-- REWRITTEN AS: an idempotent, non-destructive migration that only
-- adds/fixes the columns the frontend needs on top of 001_initial_schema.sql.
-- Safe to re-run. No DROPs, no UUID conversions.
-- ============================================

-- ============================================
-- 1. products.sort_order (used for menu ordering)
-- ============================================
ALTER TABLE products ADD COLUMN IF NOT EXISTS sort_order INTEGER NOT NULL DEFAULT 0;

-- ============================================
-- 2. delivery_rounds alias columns
--    (frontend reads/writes BOTH 'name' and 'round_key',
--     BOTH 'scheduled_date' and 'date' — keep in sync)
-- ============================================
ALTER TABLE delivery_rounds ADD COLUMN IF NOT EXISTS round_key TEXT;
ALTER TABLE delivery_rounds ADD COLUMN IF NOT EXISTS date DATE;
ALTER TABLE delivery_rounds ADD COLUMN IF NOT EXISTS name TEXT;
ALTER TABLE delivery_rounds ADD COLUMN IF NOT EXISTS scheduled_date DATE;

-- Backfill aliases from the existing values (idempotent)
UPDATE delivery_rounds SET date = scheduled_date WHERE date IS NULL AND scheduled_date IS NOT NULL;
UPDATE delivery_rounds SET scheduled_date = date WHERE scheduled_date IS NULL AND date IS NOT NULL;
UPDATE delivery_rounds SET round_key = name WHERE round_key IS NULL AND name IS NOT NULL;
UPDATE delivery_rounds SET name = round_key WHERE name IS NULL AND round_key IS NOT NULL;

-- ============================================
-- 3. orders columns required by frontend but often missing
-- ============================================
ALTER TABLE orders ADD COLUMN IF NOT EXISTS customer_name TEXT NOT NULL DEFAULT '';
ALTER TABLE orders ADD COLUMN IF NOT EXISTS customer_phone TEXT NOT NULL DEFAULT '';
ALTER TABLE orders ADD COLUMN IF NOT EXISTS dropoff_detail TEXT NOT NULL DEFAULT '';
ALTER TABLE orders ADD COLUMN IF NOT EXISTS payment_method TEXT;

-- ============================================
-- 4. order_items.product_name (createOrder() inserts this column)
-- ============================================
ALTER TABLE order_items ADD COLUMN IF NOT EXISTS product_name TEXT;

-- ============================================
-- 5. Ensure alias-sync trigger exists on delivery_rounds
-- ============================================
CREATE OR REPLACE FUNCTION sync_delivery_round_aliases()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.round_key IS NULL THEN NEW.round_key := NEW.name; END IF;
  IF NEW.name IS NULL THEN NEW.name := NEW.round_key; END IF;
  IF NEW.date IS NULL THEN NEW.date := NEW.scheduled_date; END IF;
  IF NEW.scheduled_date IS NULL THEN NEW.scheduled_date := NEW.date; END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS delivery_round_sync_aliases ON delivery_rounds;
CREATE TRIGGER delivery_round_sync_aliases
  BEFORE INSERT OR UPDATE ON delivery_rounds
  FOR EACH ROW EXECUTE FUNCTION sync_delivery_round_aliases();

-- ============================================
-- 6. Indexes for the new columns
-- ============================================
CREATE INDEX IF NOT EXISTS idx_products_sort_order ON products(sort_order);
CREATE INDEX IF NOT EXISTS idx_delivery_rounds_round_key ON delivery_rounds(round_key);
CREATE INDEX IF NOT EXISTS idx_delivery_rounds_name ON delivery_rounds(name);
CREATE INDEX IF NOT EXISTS idx_delivery_rounds_scheduled_date ON delivery_rounds(scheduled_date);

-- ============================================
-- 7. GRANTS (idempotent; align with 001)
-- ============================================
GRANT USAGE ON SCHEMA public TO anon, authenticated;
GRANT ALL ON ALL TABLES IN SCHEMA public TO anon, authenticated;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO anon, authenticated;

-- ============================================
-- DONE
-- ============================================