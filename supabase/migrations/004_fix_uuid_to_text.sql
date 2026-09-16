-- ============================================
-- Bite Me Baby — Migration 004: Fix UUID → TEXT PK Mismatch
-- Date: 2026-09-16
--
-- PROBLEM: Old migration 002 (destructive rewrite) created tables with UUID PKs.
-- Frontend generates TEXT IDs (prod-${Date.now()}, cat-${Date.now()}, etc.).
-- Migration 003 failed because pre_orders.product_id (TEXT) can't FK to products.id (UUID).
--
-- SOLUTION: Convert all UUID PKs to TEXT PKs (preserving data), then create
-- missing tables (pre_orders, payment_intents) with correct TEXT types.
-- Idempotent: safe to re-run.
-- ============================================

-- ============================================
-- 1. DROP partial tables from failed migration 003
-- ============================================
DROP TABLE IF EXISTS pre_orders CASCADE;
DROP TABLE IF EXISTS payment_intents CASCADE;

-- ============================================
-- 2. Convert UUID PKs to TEXT PKs (all tables)
--    preserves existing data via USING id::text
-- ============================================

-- 2.0 Drop every FK that depends on the tables being converted.
--     The live DB still has UUID FK columns referencing the UUID PK
--     indexes (order_items.product_id, inventory.product_id,
--     preorder_votes.product_id, reviews.product_id,
--     ai_recommendations.product_id, products.category_id,
--     products/orders.delivery_round_id, order_items.order_id,
--     loyalty_points/notifications/ai_conversations/ai_recommendations
--     .customer_id, inventory_transactions.inventory_id ...).
--     Those FKs MUST be dropped BEFORE the PK columns can change type.
DO $$
DECLARE r record;
BEGIN
  FOR r IN
    SELECT con.conname AS conname,
           tbl.relname  AS rel
    FROM pg_constraint con
    JOIN pg_class tbl ON tbl.oid = con.conrelid
    JOIN pg_class ref ON ref.oid = con.confrelid
    JOIN pg_namespace ns ON ns.oid = ref.relnamespace
    WHERE con.contype = 'f'
      AND ns.nspname = 'public'
      AND ref.relname IN (
        'products','product_categories','delivery_rounds',
        'orders','order_items','inventory','customers'
      )
  LOOP
    EXECUTE format('ALTER TABLE %I DROP CONSTRAINT %I', r.rel, r.conname);
  END LOOP;
END $$;

-- 2.1 Convert the PK columns: id UUID → TEXT.
--     The PK index is rebuilt automatically — no need to drop/re-add it,
--     and none of the old DROP-CONSTRAINT dependency errors can occur
--     because every dependent FK was removed in 2.0.
--     DEFENSIVE: any uuid-generating DEFAULT (e.g. gen_random_uuid() from
--     the old destructive 002) is dropped first — PostgreSQL refuses to
--     auto-cast a volatile default during ALTER COLUMN TYPE. Dropping the
--     default is always safe here: the frontend supplies TEXT ids explicitly
--     and the seed data inserts them too (canonical 001 has no id default).
DO $$
DECLARE r record;
BEGIN
  FOR r IN
    SELECT cls.relname AS rel
    FROM pg_class cls
    JOIN pg_namespace ns ON ns.oid = cls.relnamespace
    WHERE ns.nspname = 'public'
      AND cls.relname IN (
        'products','product_categories','delivery_rounds',
        'orders','order_items','inventory','customers'
      )
  LOOP
    EXECUTE format('ALTER TABLE %I ALTER COLUMN id DROP DEFAULT', r.rel);
    -- No-op when the column is already TEXT; idempotent.
    EXECUTE format('ALTER TABLE %I ALTER COLUMN id TYPE TEXT USING id::text', r.rel);
  END LOOP;
END $$;

-- 2.2 Convert the FK columns that referenced the converted PKs
--     (UUID → TEXT), plus any other uuid `id` on sibling legacy tables.
--     Required: re-creating a FK between a TEXT id and a UUID column is
--     impossible, and the frontend inserts TEXT ids everywhere.
DO $$
DECLARE r record;
BEGIN
  FOR r IN
    SELECT cls.relname AS rel,
           att.attname  AS col
    FROM pg_attribute att
    JOIN pg_class cls    ON cls.oid = att.attrelid
    JOIN pg_namespace ns ON ns.oid = cls.relnamespace
    JOIN pg_type typ     ON typ.oid = att.atttypid
    WHERE ns.nspname = 'public'
      AND NOT att.attisdropped
      AND att.attnum > 0
      AND typ.typname = 'uuid'
      AND cls.relname IN (
        'products','product_categories','delivery_rounds','orders','order_items',
        'inventory','inventory_transactions','preorder_votes','reviews',
        'loyalty_points','notifications','ai_conversations','ai_recommendations'
      )
      AND att.attname IN (
        'id','category_id','delivery_round_id','order_id',
        'product_id','inventory_id','customer_id'
      )
  LOOP
    EXECUTE format(
      'ALTER TABLE %I ALTER COLUMN %I TYPE TEXT USING %I::text',
      r.rel, r.col, r.col
    );
  END LOOP;
END $$;

-- 2.3 inventory.product_id is a live-DB legacy column (old destructive 002;
--     canonical 001 has no inventory → products FK). Ensure it is nullable so
--     the seed data and frontend inventory inserts keep working.
DO $$ BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_attribute att
    JOIN pg_class cls ON cls.oid = att.attrelid
    WHERE cls.relname = 'inventory'
      AND att.attname = 'product_id'
      AND NOT att.attisdropped
  ) THEN
    ALTER TABLE inventory ALTER COLUMN product_id DROP NOT NULL;
  END IF;
END $$;

-- ============================================
-- 3. Recreate FK constraints (now TEXT → TEXT)
--    Every FK dropped in 2.0 is restored from the canonical 001 schema.
--    Each block is guarded (idempotent): only created when the constraint
--    is absent AND both tables + the FK column exist.
-- ============================================

-- products.category_id → product_categories.id
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint c
    JOIN pg_class t ON t.oid = c.conrelid
    JOIN pg_namespace n ON n.oid = t.relnamespace
    WHERE n.nspname = 'public' AND t.relname = 'products'
      AND c.conname = 'products_category_id_fkey'
  )
  AND EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'products' AND column_name = 'category_id'
  )
  AND EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'product_categories' AND column_name = 'id'
  ) THEN
    ALTER TABLE products ADD CONSTRAINT products_category_id_fkey
      FOREIGN KEY (category_id) REFERENCES product_categories(id);
  END IF;
END $$;

-- products.delivery_round_id → delivery_rounds.id
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint c
    JOIN pg_class t ON t.oid = c.conrelid
    JOIN pg_namespace n ON n.oid = t.relnamespace
    WHERE n.nspname = 'public' AND t.relname = 'products'
      AND c.conname = 'products_delivery_round_id_fkey'
  )
  AND EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'products' AND column_name = 'delivery_round_id'
  )
  AND EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'delivery_rounds' AND column_name = 'id'
  ) THEN
    ALTER TABLE products ADD CONSTRAINT products_delivery_round_id_fkey
      FOREIGN KEY (delivery_round_id) REFERENCES delivery_rounds(id);
  END IF;
END $$;

-- orders.delivery_round_id → delivery_rounds.id
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint c
    JOIN pg_class t ON t.oid = c.conrelid
    JOIN pg_namespace n ON n.oid = t.relnamespace
    WHERE n.nspname = 'public' AND t.relname = 'orders'
      AND c.conname = 'orders_delivery_round_id_fkey'
  )
  AND EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'orders' AND column_name = 'delivery_round_id'
  )
  AND EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'delivery_rounds' AND column_name = 'id'
  ) THEN
    ALTER TABLE orders ADD CONSTRAINT orders_delivery_round_id_fkey
      FOREIGN KEY (delivery_round_id) REFERENCES delivery_rounds(id);
  END IF;
END $$;

-- order_items.order_id → orders.id (ON DELETE CASCADE — canonical 001)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint c
    JOIN pg_class t ON t.oid = c.conrelid
    JOIN pg_namespace n ON n.oid = t.relnamespace
    WHERE n.nspname = 'public' AND t.relname = 'order_items'
      AND c.conname = 'order_items_order_id_fkey'
  )
  AND EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'order_items' AND column_name = 'order_id'
  )
  AND EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'orders' AND column_name = 'id'
  ) THEN
    ALTER TABLE order_items ADD CONSTRAINT order_items_order_id_fkey
      FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE;
  END IF;
END $$;

-- order_items.product_id → products.id (ON DELETE RESTRICT — canonical 001)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint c
    JOIN pg_class t ON t.oid = c.conrelid
    JOIN pg_namespace n ON n.oid = t.relnamespace
    WHERE n.nspname = 'public' AND t.relname = 'order_items'
      AND c.conname = 'order_items_product_id_fkey'
  )
  AND EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'order_items' AND column_name = 'product_id'
  )
  AND EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'products' AND column_name = 'id'
  ) THEN
    ALTER TABLE order_items ADD CONSTRAINT order_items_product_id_fkey
      FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE RESTRICT;
  END IF;
END $$;

-- inventory_transactions.inventory_id → inventory.id (ON DELETE CASCADE)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint c
    JOIN pg_class t ON t.oid = c.conrelid
    JOIN pg_namespace n ON n.oid = t.relnamespace
    WHERE n.nspname = 'public' AND t.relname = 'inventory_transactions'
      AND c.conname = 'inventory_transactions_inventory_id_fkey'
  )
  AND EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'inventory_transactions' AND column_name = 'inventory_id'
  )
  AND EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'inventory' AND column_name = 'id'
  ) THEN
    ALTER TABLE inventory_transactions ADD CONSTRAINT inventory_transactions_inventory_id_fkey
      FOREIGN KEY (inventory_id) REFERENCES inventory(id) ON DELETE CASCADE;
  END IF;
END $$;

-- preorder_votes.product_id → products.id (ON DELETE CASCADE)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint c
    JOIN pg_class t ON t.oid = c.conrelid
    JOIN pg_namespace n ON n.oid = t.relnamespace
    WHERE n.nspname = 'public' AND t.relname = 'preorder_votes'
      AND c.conname = 'preorder_votes_product_id_fkey'
  )
  AND EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'preorder_votes' AND column_name = 'product_id'
  )
  AND EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'products' AND column_name = 'id'
  ) THEN
    ALTER TABLE preorder_votes ADD CONSTRAINT preorder_votes_product_id_fkey
      FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE;
  END IF;
END $$;

-- reviews.product_id → products.id (ON DELETE CASCADE)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint c
    JOIN pg_class t ON t.oid = c.conrelid
    JOIN pg_namespace n ON n.oid = t.relnamespace
    WHERE n.nspname = 'public' AND t.relname = 'reviews'
      AND c.conname = 'reviews_product_id_fkey'
  )
  AND EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'reviews' AND column_name = 'product_id'
  )
  AND EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'products' AND column_name = 'id'
  ) THEN
    ALTER TABLE reviews ADD CONSTRAINT reviews_product_id_fkey
      FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE;
  END IF;
END $$;

-- loyalty_points.customer_id → customers.id (ON DELETE CASCADE)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint c
    JOIN pg_class t ON t.oid = c.conrelid
    JOIN pg_namespace n ON n.oid = t.relnamespace
    WHERE n.nspname = 'public' AND t.relname = 'loyalty_points'
      AND c.conname = 'loyalty_points_customer_id_fkey'
  )
  AND EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'loyalty_points' AND column_name = 'customer_id'
  )
  AND EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'customers' AND column_name = 'id'
  ) THEN
    ALTER TABLE loyalty_points ADD CONSTRAINT loyalty_points_customer_id_fkey
      FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE CASCADE;
  END IF;
END $$;

-- notifications.customer_id → customers.id (ON DELETE CASCADE)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint c
    JOIN pg_class t ON t.oid = c.conrelid
    JOIN pg_namespace n ON n.oid = t.relnamespace
    WHERE n.nspname = 'public' AND t.relname = 'notifications'
      AND c.conname = 'notifications_customer_id_fkey'
  )
  AND EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'notifications' AND column_name = 'customer_id'
  )
  AND EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'customers' AND column_name = 'id'
  ) THEN
    ALTER TABLE notifications ADD CONSTRAINT notifications_customer_id_fkey
      FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE CASCADE;
  END IF;
END $$;

-- ai_conversations.customer_id → customers.id (ON DELETE CASCADE)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint c
    JOIN pg_class t ON t.oid = c.conrelid
    JOIN pg_namespace n ON n.oid = t.relnamespace
    WHERE n.nspname = 'public' AND t.relname = 'ai_conversations'
      AND c.conname = 'ai_conversations_customer_id_fkey'
  )
  AND EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'ai_conversations' AND column_name = 'customer_id'
  )
  AND EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'customers' AND column_name = 'id'
  ) THEN
    ALTER TABLE ai_conversations ADD CONSTRAINT ai_conversations_customer_id_fkey
      FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE CASCADE;
  END IF;
END $$;

-- ai_recommendations.customer_id → customers.id (ON DELETE CASCADE)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint c
    JOIN pg_class t ON t.oid = c.conrelid
    JOIN pg_namespace n ON n.oid = t.relnamespace
    WHERE n.nspname = 'public' AND t.relname = 'ai_recommendations'
      AND c.conname = 'ai_recommendations_customer_id_fkey'
  )
  AND EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'ai_recommendations' AND column_name = 'customer_id'
  )
  AND EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'customers' AND column_name = 'id'
  ) THEN
    ALTER TABLE ai_recommendations ADD CONSTRAINT ai_recommendations_customer_id_fkey
      FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE CASCADE;
  END IF;
END $$;

-- ai_recommendations.product_id → products.id (ON DELETE SET NULL)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint c
    JOIN pg_class t ON t.oid = c.conrelid
    JOIN pg_namespace n ON n.oid = t.relnamespace
    WHERE n.nspname = 'public' AND t.relname = 'ai_recommendations'
      AND c.conname = 'ai_recommendations_product_id_fkey'
  )
  AND EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'ai_recommendations' AND column_name = 'product_id'
  )
  AND EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'products' AND column_name = 'id'
  ) THEN
    ALTER TABLE ai_recommendations ADD CONSTRAINT ai_recommendations_product_id_fkey
      FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE SET NULL;
  END IF;
END $$;

-- ============================================
-- 4. Create pre_orders table (TEXT PK, TEXT FKs)
-- ============================================
CREATE TABLE IF NOT EXISTS pre_orders (
  id TEXT PRIMARY KEY,
  order_number TEXT NOT NULL UNIQUE,
  customer_id TEXT REFERENCES customers(id) ON DELETE SET NULL,
  customer_name TEXT NOT NULL,
  customer_phone TEXT,
  product_id TEXT REFERENCES products(id) ON DELETE SET NULL,
  product_name TEXT NOT NULL,
  quantity INTEGER NOT NULL DEFAULT 1 CHECK (quantity > 0),
  unit_price NUMERIC(10, 2) NOT NULL,
  total_amount NUMERIC(10, 2) NOT NULL,
  delivery_round_id TEXT REFERENCES delivery_rounds(id) ON DELETE SET NULL,
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

-- ============================================
-- 5. Create payment_intents table (TEXT PK)
-- ============================================
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

-- ============================================
-- 6. profiles table (UUID PK — keep as is, references auth.users)
-- ============================================
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
-- 7. Indexes
-- ============================================
CREATE INDEX IF NOT EXISTS idx_pre_orders_customer ON pre_orders(customer_id);
CREATE INDEX IF NOT EXISTS idx_pre_orders_status ON pre_orders(status);
CREATE INDEX IF NOT EXISTS idx_payment_intents_order ON payment_intents(order_number);
CREATE INDEX IF NOT EXISTS idx_profiles_role ON profiles(role);

-- ============================================
-- 8. RLS (Row Level Security)
-- ============================================
ALTER TABLE pre_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE payment_intents ENABLE ROW LEVEL SECURITY;
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

-- pre_orders: public read/write (permissive for early stage)
DROP POLICY IF EXISTS pre_orders_policy ON pre_orders;
CREATE POLICY pre_orders_policy ON pre_orders
  FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);

-- payment_intents: public read/write
DROP POLICY IF EXISTS payment_intents_policy ON payment_intents;
CREATE POLICY payment_intents_policy ON payment_intents
  FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);

-- profiles: public read, owner write
DROP POLICY IF EXISTS profiles_public_read ON profiles;
CREATE POLICY profiles_public_read ON profiles
  FOR SELECT TO anon, authenticated USING (true);
DROP POLICY IF EXISTS profiles_own_write ON profiles;
CREATE POLICY profiles_own_write ON profiles
  FOR ALL TO anon, authenticated USING (auth.uid() = id) WITH CHECK (auth.uid() = id);

-- ============================================
-- 9. GRANTS
-- ============================================
GRANT ALL ON pre_orders, payment_intents TO anon, authenticated;
GRANT USAGE ON SCHEMA public TO anon, authenticated;
GRANT ALL ON ALL TABLES IN SCHEMA public TO anon, authenticated;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO anon, authenticated;

-- ============================================
-- 10. Seed data (idempotent)
-- ============================================

INSERT INTO product_categories (id, name, slug, icon, sort_order, is_active) VALUES
  ('cat-1', 'จานเดียว', 'dish', '🍜', 1, true),
  ('cat-2', 'ข้าว', 'rice', '🍚', 2, true),
  ('cat-3', 'แกง', 'curry', '', 3, true),
  ('cat-4', 'เครื่องดื่ม', 'drink', '🥤', 4, true),
  ('cat-5', 'ของหวาน', 'dessert', '🍰', 5, true)
ON CONFLICT (id) DO NOTHING;

INSERT INTO delivery_rounds (id, round_key, display_name, cutoff_time, delivery_start, delivery_end, max_capacity, current_count, date, scheduled_date, name, status) VALUES
  ('round-1', 'morning', 'เช้า (07:00-10:00)', '06:00', '07:00', '10:00', 60, 0, CURRENT_DATE, CURRENT_DATE, 'morning', 'active'),
  ('round-2', 'midday', 'เที่ยง (11:00-14:00)', '10:00', '11:00', '14:00', 80, 0, CURRENT_DATE, CURRENT_DATE, 'midday', 'active'),
  ('round-3', 'evening', 'เย็น (17:00-20:00)', '16:00', '17:00', '20:00', 100, 0, CURRENT_DATE, CURRENT_DATE, 'evening', 'active')
ON CONFLICT (id) DO NOTHING;

INSERT INTO products (id, name, description, price, category_id, image_url, is_available, is_featured, is_preorder, prep_minutes, sort_order, delivery_round_id, scheduled_date) VALUES
  ('prod-1', 'ผัดไทยกุ้งสด', 'ผัดไทยกุ้งสดสดใหม่', 65.00, 'cat-1', '', true, true, false, 15, 1, NULL, NULL),
  ('prod-2', 'ข้าวหมูทอดกระเทียม', 'ข้าวหมูทอดกระเทียมหอมๆ', 70.00, 'cat-2', '', true, false, false, 10, 2, NULL, NULL),
  ('prod-3', 'แกงเขียวหวานไก่', 'แกงเขียวหวานไก่ creamy', 75.00, 'cat-3', '', true, true, false, 20, 3, NULL, NULL),
  ('prod-4', 'กาแฟเย็น', 'กาแฟเย็นหอมๆ', 35.00, 'cat-4', '', true, false, false, 5, 4, NULL, NULL),
  ('prod-5', 'เมนูโหวต: ต้มยำกุ้งสด', 'โหวตเมนูนี้เพื่อจองล่วงหน้า — ส่งรอบหน้า', 85.00, 'cat-1', '', true, true, true, 25, 5, 'round-2', CURRENT_DATE + INTERVAL '7 days'),
  ('prod-6', 'เมนูใหม่: ผัดไทยทะเล', 'โหวตเมนูนี้เพื่อจองล่วงหน้า — ส่งรอบหน้า', 95.00, 'cat-1', '', true, true, true, 20, 6, 'round-3', CURRENT_DATE + INTERVAL '14 days')
ON CONFLICT (id) DO NOTHING;

INSERT INTO inventory (id, name, category, unit, current_stock, min_stock, max_stock, unit_price, supplier_name, supplier_phone) VALUES
  ('ing-1', 'ข้าว', 'carb', 'kg', 10, 5, 20, 45.00, 'ร้านข้าวจันทบุรี', '0812345678'),
  ('ing-2', 'ไก่', 'protein', 'kg', 5, 3, 15, 85.00, 'ฟาร์มไก่จันทบุรี', '0812345679'),
  ('ing-3', 'ไข่ไก่', 'protein', 'piece', 2, 10, 50, 3.00, 'ฟาร์มไข่จันทบุรี', '0812345680'),
  ('ing-4', 'น้ำมัน', 'sauce', 'liter', 3, 2, 10, 40.00, 'ร้านน้ำมันจันทบุรี', '0812345681')
ON CONFLICT (id) DO NOTHING;

INSERT INTO customers (id, full_name, phone, email, address, loyalty_points) VALUES
  ('cust-1', 'สมชาย รักดี', '0812345678', 'somchai@example.com', '123 สุขสันต์ ซอย 1 กรุงเทพฯ 10100', 50),
  ('cust-2', 'สมหญิง ดีใจ', '0898765432', 'somying@example.com', '456 ใหม่ ถนนเพชรบุรี กรุงเทพฯ 10400', 120)
ON CONFLICT (id) DO NOTHING;

-- ============================================
-- DONE — Migration 004 complete
-- All UUID PKs converted to TEXT. pre_orders + payment_intents created.
-- ============================================