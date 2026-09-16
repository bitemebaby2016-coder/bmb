-- ============================================
-- Bite Me Baby — Migration 003: Add Missing Columns & Tables
-- Date: 2026-09-16
--
-- FIXED: Original file only added products.sort_order + delivery_rounds
-- aliases but used `ADD CONSTRAINT` (fails on re-run) and assumed the
-- UUID-era 002 schema. Now rewritten to be fully idempotent and to also
-- create tables that the frontend requires but earlier migrations missed:
--   - pre_orders        (src/lib/preOrderService.ts)
--   - payment_intents   (src/lib/paymentGateway.ts)
--   - profiles          (src/lib/supabase.ts isAdmin)
-- ============================================

-- ============================================
-- 1. products.sort_order + constraint (guarded, idempotent)
-- ============================================
ALTER TABLE products ADD COLUMN IF NOT EXISTS sort_order INTEGER NOT NULL DEFAULT 0;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'products_sort_order_check'
  ) THEN
    ALTER TABLE products ADD CONSTRAINT products_sort_order_check CHECK (sort_order >= 0);
  END IF;
END $$;

-- Seed sort_order for existing products that still have 0 (based on creation order)
UPDATE products SET sort_order = sub.rn
FROM (
  SELECT id, ROW_NUMBER() OVER (ORDER BY created_at ASC) AS rn
  FROM products
) sub
WHERE products.id = sub.id AND products.sort_order = 0
  AND EXISTS (SELECT 1 FROM products p2 WHERE p2.sort_order = 0);

-- ============================================
-- 2. delivery_rounds alias columns (idempotent)
-- ============================================
ALTER TABLE delivery_rounds ADD COLUMN IF NOT EXISTS date DATE;
ALTER TABLE delivery_rounds ADD COLUMN IF NOT EXISTS round_key TEXT;
ALTER TABLE delivery_rounds ADD COLUMN IF NOT EXISTS name TEXT;
ALTER TABLE delivery_rounds ADD COLUMN IF NOT EXISTS scheduled_date DATE;

UPDATE delivery_rounds SET date = scheduled_date WHERE date IS NULL AND scheduled_date IS NOT NULL;
UPDATE delivery_rounds SET round_key = name WHERE round_key IS NULL AND name IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_products_sort_order ON products(sort_order);
CREATE INDEX IF NOT EXISTS idx_delivery_rounds_date ON delivery_rounds(date);
CREATE INDEX IF NOT EXISTS idx_delivery_rounds_round_key ON delivery_rounds(round_key);

-- ============================================
-- 3. Tables that MUST exist for frontend but were missing from
--    the original migration chain. CREATE IF NOT EXISTS = safe to re-run.
--    (Full definitions live in 001_initial_schema.sql; these are
--     legacy-safety copies for databases that predate 001.)
-- ============================================

-- 3.1 pre_orders (preOrderService.ts)
CREATE TABLE IF NOT EXISTS pre_orders (
  id TEXT PRIMARY KEY,
  order_number TEXT NOT NULL UNIQUE,
  customer_id TEXT,
  customer_name TEXT NOT NULL,
  customer_phone TEXT,
  product_id TEXT REFERENCES products(id) ON DELETE SET NULL,
  product_name TEXT NOT NULL,
  quantity INTEGER NOT NULL DEFAULT 1 CHECK (quantity > 0),
  unit_price NUMERIC(10, 2) NOT NULL,
  total_amount NUMERIC(10, 2) NOT NULL,
  delivery_round_id TEXT,
  scheduled_date DATE,
  delivery_latitude NUMERIC(10, 7),
  delivery_longitude NUMERIC(10, 7),
  delivery_address TEXT DEFAULT '',
  status TEXT NOT NULL DEFAULT 'pending',
  special_instructions TEXT DEFAULT '',
  confirmed_at TIMESTAMPTZ,
  cancelled_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 3.2 payment_intents (paymentGateway.ts)
CREATE TABLE IF NOT EXISTS payment_intents (
  id TEXT PRIMARY KEY,
  order_number TEXT NOT NULL,
  amount NUMERIC(10, 2) NOT NULL,
  currency TEXT NOT NULL DEFAULT 'thb',
  status TEXT NOT NULL DEFAULT 'pending',
  method TEXT NOT NULL DEFAULT 'promptpay_qr',
  provider TEXT NOT NULL DEFAULT 'promptpay',
  client_secret TEXT,
  payment_intent_id TEXT,
  receipt_url TEXT,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at TIMESTAMPTZ,
  failure_reason TEXT
);

-- 3.3 profiles (supabase.ts isAdmin) — but only if the UUID-era 002
--     (which had no profiles) is in place. If auth.users table exists.
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'profiles') THEN
    CREATE TABLE public.profiles (
      id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
      email TEXT,
      phone TEXT,
      name TEXT,
      role TEXT NOT NULL DEFAULT 'customer' CHECK (role IN ('customer', 'admin')),
      is_active BOOLEAN NOT NULL DEFAULT true,
      avatar_url TEXT DEFAULT '',
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  END IF;
END $$;

-- ============================================
-- 4. Indexes for newly ensured tables
-- ============================================
CREATE INDEX IF NOT EXISTS idx_pre_orders_customer ON pre_orders(customer_id);
CREATE INDEX IF NOT EXISTS idx_pre_orders_status ON pre_orders(status);
CREATE INDEX IF NOT EXISTS idx_payment_intents_order ON payment_intents(order_number);
CREATE INDEX IF NOT EXISTS idx_profiles_role ON profiles(role);

-- ============================================
-- 5. RLS for legacy tables (idempotent; permissive posture — see 001 notes)
-- ============================================
ALTER TABLE pre_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE payment_intents ENABLE ROW LEVEL SECURITY;
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

DO $$
DECLARE t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY['pre_orders', 'payment_intents'] LOOP
    EXECUTE format('DROP POLICY IF EXISTS p_public_all_%I ON %I', t, t);
    EXECUTE format('CREATE POLICY p_public_all_%I ON %I FOR ALL TO anon, authenticated USING (true) WITH CHECK (true)', t, t);
  END LOOP;
END $$;

DROP POLICY IF EXISTS profiles_public_read ON profiles;
CREATE POLICY profiles_public_read ON profiles
  FOR SELECT TO anon, authenticated USING (true);

GRANT ALL ON pre_orders, payment_intents, profiles TO anon, authenticated;

-- ============================================
-- DONE
-- ============================================