-- ============================================
-- Bite Me Baby — Migration 001: Initial Canonical Schema
-- Date: 2026-09-16
-- Purpose: Single source-of-truth schema matching ALL frontend code
--   (src/lib/bmbAdminApi_*.ts, src/lib/preOrderService.ts,
--    src/lib/paymentGateway.ts, src/lib/supabase.ts, src/types/index.ts)
--
-- ID STRATEGY: TEXT primary keys (cat-1, prod-1, round-1, ord-*)
--   Frontend generates TEXT ids (e.g. `prod-${Date.now()}`) so UUID
--   columns would break inserts. TEXT matches original v3.1 schema.
--
-- IDEMPOTENT: safe to re-run (CREATE TABLE IF NOT EXISTS,
--   guarded enums, ON CONFLICT DO NOTHING seeds).
-- ============================================

-- ============================================
-- 1. EXTENSIONS
-- ============================================
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";

-- ============================================
-- 2. ENUMS (guarded so re-running is safe)
--    Values align exactly with src/types/index.ts
-- ============================================
DO $$ BEGIN
  CREATE TYPE order_status AS ENUM (
    'pending', 'confirmed', 'preparing', 'ready_for_dispatch',
    'dispatched', 'in_transit', 'arrived', 'delivered',
    'cancelled', 'failed'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE payment_status AS ENUM (
    'pending', 'paid', 'refund', 'partially_refunded'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE payment_method AS ENUM (
    'promptpay_qr', 'credit_card', 'cash_on_delivery'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE delivery_method AS ENUM (
    'self_delivery', 'grab_rider', 'linemen_rider', 'foodpanda_rider'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE round_period AS ENUM (
    'morning', 'midday', 'evening'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE ingredient_status AS ENUM (
    'in_stock', 'low_stock', 'out_of_stock'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ============================================
-- 3. TABLES
-- ============================================

-- 3.1 Product Categories
CREATE TABLE IF NOT EXISTS product_categories (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  icon TEXT DEFAULT '',
  sort_order INTEGER NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 3.2 Delivery Rounds
-- NOTE: frontend uses BOTH column sets:
--   bmbAdminApi_products.ts orders by `scheduled_date` and `name`
--   003_add_missing_columns.sql added `date` and `round_key`
-- We keep all four synchronized by trigger.
CREATE TABLE IF NOT EXISTS delivery_rounds (
  id TEXT PRIMARY KEY,
  round_key TEXT NOT NULL DEFAULT 'morning',   -- alias of name
  display_name TEXT NOT NULL,
  cutoff_time TIME NOT NULL,
  delivery_start TIME NOT NULL,
  delivery_end TIME NOT NULL,
  max_capacity INTEGER NOT NULL DEFAULT 100,
  current_count INTEGER NOT NULL DEFAULT 0,
  date DATE,                                    -- alias of scheduled_date
  scheduled_date DATE NOT NULL DEFAULT CURRENT_DATE,
  name TEXT,                                    -- alias of round_key
  status TEXT NOT NULL DEFAULT 'active'
    CHECK (status IN ('active', 'closed', 'cancelled', 'open', 'full', 'scheduled')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 3.3 Products
CREATE TABLE IF NOT EXISTS products (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  price NUMERIC(10, 2) NOT NULL CHECK (price >= 0),
  category_id TEXT NOT NULL REFERENCES product_categories(id),
  image_url TEXT DEFAULT '',
  is_available BOOLEAN NOT NULL DEFAULT true,
  is_featured BOOLEAN NOT NULL DEFAULT false,
  is_preorder BOOLEAN NOT NULL DEFAULT false,
  prep_minutes INTEGER NOT NULL DEFAULT 0,
  sort_order INTEGER NOT NULL DEFAULT 0,
  delivery_round_id TEXT REFERENCES delivery_rounds(id),
  scheduled_date DATE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 3.4 Customers
-- (part of 002 schema; linked to auth.users when available
CREATE TABLE IF NOT EXISTS customers (
  id TEXT PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,  -- nullable
  full_name TEXT NOT NULL,
  phone TEXT,
  email TEXT,
  address TEXT,
  loyalty_points INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 3.5 Orders
CREATE TABLE IF NOT EXISTS orders (
  id TEXT PRIMARY KEY,
  order_number TEXT NOT NULL UNIQUE,
  customer_id TEXT,                              -- TEXT not UUID (frontend passes test-user etc.)
  customer_name TEXT NOT NULL,
  customer_phone TEXT NOT NULL,
  delivery_round_id TEXT REFERENCES delivery_rounds(id),
  customer_ref UUID REFERENCES auth.users(id) ON DELETE SET NULL,  -- optional real link
  status order_status NOT NULL DEFAULT 'pending',
  delivery_method delivery_method NOT NULL DEFAULT 'self_delivery',
  pickup_latitude NUMERIC(10, 7),
  pickup_longitude NUMERIC(10, 7),
  dropoff_latitude NUMERIC(10, 7),
  dropoff_longitude NUMERIC(10, 7),
  dropoff_detail TEXT NOT NULL DEFAULT '',
  is_outside_self_zone BOOLEAN NOT NULL DEFAULT false,
  subtotal NUMERIC(10, 2) NOT NULL DEFAULT 0,
  delivery_fee NUMERIC(10, 2) NOT NULL DEFAULT 0,
  service_fee NUMERIC(10, 2) NOT NULL DEFAULT 0,
  discount_amount NUMERIC(10, 2) NOT NULL DEFAULT 0,
  tax_amount NUMERIC(10, 2) NOT NULL DEFAULT 0,
  total_amount NUMERIC(10, 2) NOT NULL,
  payment_status payment_status NOT NULL DEFAULT 'pending',
  payment_method payment_method NOT NULL DEFAULT 'promptpay_qr',
  special_instructions TEXT DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 3.6 Order Items
-- product_name column REQUIRED: bmbAdminApi_orders.createOrder inserts it
-- item_total computed by trigger calculate_item_total()
CREATE TABLE IF NOT EXISTS order_items (
  id TEXT PRIMARY KEY,
  order_id TEXT NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  product_id TEXT REFERENCES products(id) ON DELETE RESTRICT,
  product_name TEXT,                             -- frontend inserts this column
  quantity INTEGER NOT NULL DEFAULT 1 CHECK (quantity > 0),
  unit_price NUMERIC(10, 2) NOT NULL,
  customizations JSONB DEFAULT '{}',
  special_request TEXT DEFAULT '',
  item_total NUMERIC(10, 2) NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 3.7 Inventory
CREATE TABLE IF NOT EXISTS inventory (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  category TEXT NOT NULL,
  unit TEXT NOT NULL DEFAULT 'piece',
  current_stock NUMERIC(10, 2) NOT NULL DEFAULT 0,
  min_stock NUMERIC(10, 2) NOT NULL DEFAULT 0,
  max_stock NUMERIC(10, 2) NOT NULL DEFAULT 0,
  unit_price NUMERIC(10, 2) NOT NULL DEFAULT 0,
  supplier_name TEXT DEFAULT '',
  supplier_phone TEXT DEFAULT '',
  status TEXT NOT NULL DEFAULT 'in_stock',       -- TEXT: frontend type allows 'critical'
  last_restocked_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 3.8 Inventory Transactions
CREATE TABLE IF NOT EXISTS inventory_transactions (
  id TEXT PRIMARY KEY,
  inventory_id TEXT REFERENCES inventory(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN ('in', 'out', 'adjustment', 'waste', 'stock_in', 'stock_out')),
  quantity NUMERIC(10, 2) NOT NULL,
  reference_type TEXT,
  reference_id TEXT,
  notes TEXT,
  created_by TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 3.9 Pre-order Votes
CREATE TABLE IF NOT EXISTS preorder_votes (
  id TEXT PRIMARY KEY,
  product_id TEXT NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  customer_id TEXT,
  vote_count INTEGER NOT NULL DEFAULT 1,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 3.10 Reviews
-- Frontend (bmbAdminApi_reviews.ts) inserts: product_id, customer_id,
--   customer_name, rating, comment, is_verified, created_at
CREATE TABLE IF NOT EXISTS reviews (
  id TEXT PRIMARY KEY,
  product_id TEXT NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  customer_id TEXT,
  customer_name TEXT,
  rating INTEGER NOT NULL CHECK (rating >= 1 AND rating <= 5),
  comment TEXT,
  is_verified BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 3.11 Pre-Orders (Pre-order system — preOrderService.ts requires this table)
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

-- 3.12 Loyalty Points
CREATE TABLE IF NOT EXISTS loyalty_points (
  id TEXT PRIMARY KEY,
  customer_id TEXT REFERENCES customers(id) ON DELETE CASCADE,
  points INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'active',
  description TEXT,
  expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 3.13 Promotions
CREATE TABLE IF NOT EXISTS promotions (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  code TEXT,
  discount_type TEXT CHECK (discount_type IN ('percentage', 'fixed_amount')),
  discount_value NUMERIC(10, 2) NOT NULL DEFAULT 0,
  min_order_amount NUMERIC(10, 2) NOT NULL DEFAULT 0,
  start_date DATE,
  end_date DATE,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 3.14 Notifications
CREATE TABLE IF NOT EXISTS notifications (
  id TEXT PRIMARY KEY,
  customer_id TEXT REFERENCES customers(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  is_read BOOLEAN NOT NULL DEFAULT false,
  notification_type TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 3.15 AI Conversations
CREATE TABLE IF NOT EXISTS ai_conversations (
  id TEXT PRIMARY KEY,
  customer_id TEXT REFERENCES customers(id) ON DELETE CASCADE,
  message TEXT NOT NULL,
  response TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 3.16 AI Recommendations
CREATE TABLE IF NOT EXISTS ai_recommendations (
  id TEXT PRIMARY KEY,
  customer_id TEXT REFERENCES customers(id) ON DELETE CASCADE,
  product_id TEXT REFERENCES products(id) ON DELETE SET NULL,
  reason TEXT,
  confidence_score NUMERIC(3, 2),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 3.17 Profiles (Supabase Auth profiles — supabase.ts isAdmin() reads role)
CREATE TABLE IF NOT EXISTS profiles (
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

-- 3.18 Payment Intents (paymentGateway.ts REQUIRES this table)
CREATE TABLE IF NOT EXISTS payment_intents (
  id TEXT PRIMARY KEY,
  order_number TEXT NOT NULL,                    -- no hard FK; order may live in localStorage fallback
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
-- 4. INDEXES
-- ============================================
CREATE INDEX IF NOT EXISTS idx_delivery_rounds_date ON delivery_rounds(date);
CREATE INDEX IF NOT EXISTS idx_delivery_rounds_status ON delivery_rounds(status);
CREATE INDEX IF NOT EXISTS idx_products_category ON products(category_id);
CREATE INDEX IF NOT EXISTS idx_products_preorder ON products(is_preorder) WHERE is_preorder = true;
CREATE INDEX IF NOT EXISTS idx_products_featured ON products(is_featured) WHERE is_featured = true;
CREATE INDEX IF NOT EXISTS idx_products_available ON products(is_available) WHERE is_available = true;
CREATE INDEX IF NOT EXISTS idx_products_scheduled ON products(scheduled_date);
CREATE INDEX IF NOT EXISTS idx_products_sort_order ON products(sort_order);
CREATE INDEX IF NOT EXISTS idx_orders_customer ON orders(customer_id);
CREATE INDEX IF NOT EXISTS idx_orders_number ON orders(order_number);
CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status);
CREATE INDEX IF NOT EXISTS idx_orders_round ON orders(delivery_round_id);
CREATE INDEX IF NOT EXISTS idx_orders_created ON orders(created_at);
CREATE INDEX IF NOT EXISTS idx_order_items_order ON order_items(order_id);
CREATE INDEX IF NOT EXISTS idx_order_items_product ON order_items(product_id);
CREATE INDEX IF NOT EXISTS idx_inventory_category ON inventory(category);
CREATE INDEX IF NOT EXISTS idx_inventory_status ON inventory(status);
CREATE INDEX IF NOT EXISTS idx_products_name_trgm ON products USING gin (name gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_reviews_product ON reviews(product_id);
CREATE INDEX IF NOT EXISTS idx_pre_orders_customer ON pre_orders(customer_id);
CREATE INDEX IF NOT EXISTS idx_pre_orders_status ON pre_orders(status);
CREATE INDEX IF NOT EXISTS idx_payment_intents_order ON payment_intents(order_number);
CREATE INDEX IF NOT EXISTS idx_profiles_role ON profiles(role);
CREATE INDEX IF NOT EXISTS idx_notifications_customer ON notifications(customer_id);

-- ============================================
-- 5. FUNCTIONS & TRIGGERS
-- ============================================

-- update_updated_at helper
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Synchronize delivery_rounds alias columns (name<->round_key, date<->scheduled_date)
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

-- calculate order_items.item_total
CREATE OR REPLACE FUNCTION calculate_item_total()
RETURNS TRIGGER AS $$
BEGIN
  NEW.item_total := NEW.quantity * NEW.unit_price;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- auto-set inventory.status from stock levels
CREATE OR REPLACE FUNCTION update_inventory_status()
RETURNS TRIGGER AS $$
BEGIN
  NEW.status := CASE
    WHEN NEW.current_stock <= 0 THEN 'out_of_stock'
    WHEN NEW.current_stock <= NEW.min_stock THEN 'low_stock'
    ELSE 'in_stock'
  END;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- increment delivery round count on new order
CREATE OR REPLACE FUNCTION increment_delivery_round_count()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.delivery_round_id IS NOT NULL THEN
    UPDATE delivery_rounds
       SET current_count = current_count + 1
     WHERE id = NEW.delivery_round_id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Triggers (dropped first for idempotency; dropped then created on 002 if re-run)
DROP TRIGGER IF EXISTS delivery_rounds_updated_at ON delivery_rounds;
CREATE TRIGGER delivery_rounds_updated_at
  BEFORE UPDATE ON delivery_rounds
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS products_updated_at ON products;
CREATE TRIGGER products_updated_at
  BEFORE UPDATE ON products
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS delivery_round_sync_aliases ON delivery_rounds;
CREATE TRIGGER delivery_round_sync_aliases
  BEFORE INSERT OR UPDATE ON delivery_rounds
  FOR EACH ROW EXECUTE FUNCTION sync_delivery_round_aliases();

DROP TRIGGER IF EXISTS orders_updated_at ON orders;
CREATE TRIGGER orders_updated_at
  BEFORE UPDATE ON orders
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS order_items_calculate_total ON order_items;
CREATE TRIGGER order_items_calculate_total
  BEFORE INSERT OR UPDATE ON order_items
  FOR EACH ROW EXECUTE FUNCTION calculate_item_total();

DROP TRIGGER IF EXISTS inventory_updated_at ON inventory;
CREATE TRIGGER inventory_updated_at
  BEFORE UPDATE ON inventory
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS inventory_calculate_status ON inventory;
CREATE TRIGGER inventory_calculate_status
  BEFORE INSERT OR UPDATE ON inventory
  FOR EACH ROW EXECUTE FUNCTION update_inventory_status();

DROP TRIGGER IF EXISTS profiles_updated_at ON profiles;
CREATE TRIGGER profiles_updated_at
  BEFORE UPDATE ON profiles
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS orders_increment_round ON orders;
CREATE TRIGGER orders_increment_round
  AFTER INSERT ON orders
  FOR EACH ROW EXECUTE FUNCTION increment_delivery_round_count();

-- ============================================
-- 6. ROW LEVEL SECURITY
-- NOTE: Current app authenticates via localStorage (bmbAdminApi_users.ts)
--   and uses the ANON supabase client for all CRUD. Policies therefore
--   allow anon + authenticated. Replace with role-based policies once
--   Supabase Auth is fully integrated (documented P0 gap C-03).
-- ============================================
ALTER TABLE product_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE delivery_rounds ENABLE ROW LEVEL SECURITY;
ALTER TABLE products ENABLE ROW LEVEL SECURITY;
ALTER TABLE customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE order_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE inventory ENABLE ROW LEVEL SECURITY;
ALTER TABLE inventory_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE preorder_votes ENABLE ROW LEVEL SECURITY;
ALTER TABLE reviews ENABLE ROW LEVEL SECURITY;
ALTER TABLE pre_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE loyalty_points ENABLE ROW LEVEL SECURITY;
ALTER TABLE promotions ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_recommendations ENABLE ROW LEVEL SECURITY;
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE payment_intents ENABLE ROW LEVEL SECURITY;

-- Public-access policies for operational tables
-- (current app uses anon client + localStorage auth — see note above)
DO $$
DECLARE t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'product_categories', 'delivery_rounds', 'products', 'customers', 'orders',
    'order_items', 'inventory', 'inventory_transactions', 'preorder_votes',
    'reviews', 'pre_orders', 'loyalty_points', 'promotions', 'notifications',
    'ai_conversations', 'ai_recommendations', 'payment_intents'
  ] LOOP
    EXECUTE format('DROP POLICY IF EXISTS p_public_all_%I ON %I', t, t);
    EXECUTE format('CREATE POLICY p_public_all_%I ON %I FOR ALL TO anon, authenticated USING (true) WITH CHECK (true)', t, t);
  END LOOP;
END $$;

-- profiles: public read (isAdmin needs to read role), owner writes
DROP POLICY IF EXISTS profiles_public_read ON profiles;
CREATE POLICY profiles_public_read ON profiles
  FOR SELECT TO anon, authenticated USING (true);
DROP POLICY IF EXISTS profiles_own_write ON profiles;
CREATE POLICY profiles_own_write ON profiles
  FOR ALL TO anon, authenticated USING (auth.uid() = id) WITH CHECK (auth.uid() = id);

-- ============================================
-- 7. GRANTS
-- ============================================
GRANT USAGE ON SCHEMA public TO anon, authenticated;
GRANT ALL ON ALL TABLES IN SCHEMA public TO anon, authenticated;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO anon, authenticated;

-- ============================================
-- 8. SEED DATA (idempotent)
-- ============================================

INSERT INTO product_categories (id, name, slug, icon, sort_order, is_active) VALUES
  ('cat-1', 'จานเดียว', 'dish', '🍜', 1, true),
  ('cat-2', 'ข้าว', 'rice', '🍚', 2, true),
  ('cat-3', 'แกง', 'curry', '🍛', 3, true),
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