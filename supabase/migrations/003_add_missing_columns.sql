-- ============================================
-- Migration 003: Add missing columns for frontend compatibility
-- Date: 2026-09-16
-- Purpose: The frontend code (bmbAdminApi_products.ts) expects:
--   - products.sort_order (for ordering)
--   - delivery_rounds.date (for date filtering/ordering)
--   - delivery_rounds.round_key (for period key ordering)
-- The live database was created from 002_complete_schema.sql which uses:
--   - delivery_rounds.scheduled_date (instead of date)
--   - delivery_rounds.name (instead of round_key)
-- This migration adds the missing columns so the frontend can work.
-- ============================================

-- 1. Add sort_order to products table (missing from 002_complete_schema.sql)
ALTER TABLE products ADD COLUMN IF NOT EXISTS sort_order INTEGER NOT NULL DEFAULT 0;

-- 2. Add date column to delivery_rounds (alias for scheduled_date)
ALTER TABLE delivery_rounds ADD COLUMN IF NOT EXISTS date DATE;

-- 3. Add round_key column to delivery_rounds (alias for name)
ALTER TABLE delivery_rounds ADD COLUMN IF NOT EXISTS round_key TEXT;

-- 4. Populate new columns from existing data
UPDATE delivery_rounds SET date = scheduled_date;
UPDATE delivery_rounds SET round_key = name;

-- 5. Add indexes for the new columns
CREATE INDEX IF NOT EXISTS idx_products_sort_order ON products(sort_order);
CREATE INDEX IF NOT EXISTS idx_delivery_rounds_date_new ON delivery_rounds(date);
CREATE INDEX IF NOT EXISTS idx_delivery_rounds_round_key ON delivery_rounds(round_key);

-- 6. Seed data for existing rounds (if date/round_key are still null)
UPDATE delivery_rounds
SET date = scheduled_date,
    round_key = CASE
        WHEN name ILIKE '%เช้า%' OR name ILIKE 'morning' THEN 'morning'
        WHEN name ILIKE '%เที่ยง%' OR name ILIKE 'midday' THEN 'midday'
        WHEN name ILIKE '%เย็น%' OR name ILIKE 'evening' THEN 'evening'
        ELSE name
    END
WHERE date IS NULL OR round_key IS NULL;

-- 7. Seed sort_order for existing products
UPDATE products SET sort_order = id::text::int WHERE sort_order = 0 AND id ~ '^\d+$';

-- 8. Update RLS policies to allow the new columns
ALTER TABLE products ADD CONSTRAINT products_sort_order_check CHECK (sort_order >= 0);

-- Done