-- ============================================
-- Bite Me Baby — Supabase Migration Scripts
-- Version: 2.0 (Complete Schema)
-- Date: 2026-09-15
-- ============================================

-- ============================================
-- 1. CORE TABLES
-- ============================================

-- Products Table
CREATE TABLE IF NOT EXISTS products (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  price NUMERIC(10,2) NOT NULL,
  category_id TEXT REFERENCES product_categories(id),
  image_url TEXT,
  is_available BOOLEAN DEFAULT true,
  is_featured BOOLEAN DEFAULT false,
  prep_minutes INTEGER DEFAULT 15,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Product Categories Table
CREATE TABLE IF NOT EXISTS product_categories (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  slug TEXT UNIQUE NOT NULL,
  icon TEXT,
  sort_order INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Orders Table
CREATE TABLE IF NOT EXISTS orders (
  id TEXT PRIMARY KEY,
  order_number TEXT UNIQUE NOT NULL,
  customer_id TEXT REFERENCES customers(id),
  delivery_round_id TEXT REFERENCES delivery_rounds(id),
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'confirmed', 'preparing', 'ready_for_dispatch', 'dispatched', 'in_transit', 'arrived', 'delivered', 'cancelled', 'failed')),
  delivery_method TEXT DEFAULT 'self_delivery' CHECK (delivery_method IN ('self_delivery', 'grab_rider', 'linemen_rider', 'foodpanda_rider')),
  pickup_latitude NUMERIC(10,7),
  pickup_longitude NUMERIC(10,7),
  dropoff_latitude NUMERIC(10,7),
  dropoff_longitude NUMERIC(10,7),
  dropoff_detail TEXT,
  is_outside_self_zone BOOLEAN DEFAULT false,
  subtotal NUMERIC(10,2) DEFAULT 0,
  delivery_fee NUMERIC(10,2) DEFAULT 0,
  service_fee NUMERIC(10,2) DEFAULT 0,
  discount_amount NUMERIC(10,2) DEFAULT 0,
  tax_amount NUMERIC(10,2) DEFAULT 0,
  total_amount NUMERIC(10,2) DEFAULT 0,
  payment_status TEXT DEFAULT 'pending' CHECK (payment_status IN ('pending', 'paid', 'refund', 'partially_refunded')),
  payment_method TEXT CHECK (payment_method IN ('promptpay_qr', 'credit_card', 'cash_on_delivery')),
  special_instructions TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Order Items Table
CREATE TABLE IF NOT EXISTS order_items (
  id TEXT PRIMARY KEY,
  order_id TEXT REFERENCES orders(id) ON DELETE CASCADE,
  product_id TEXT REFERENCES products(id),
  quantity INTEGER NOT NULL DEFAULT 1,
  unit_price NUMERIC(10,2) NOT NULL,
  customizations JSONB DEFAULT '{}',
  special_request TEXT,
  item_total NUMERIC(10,2) NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Delivery Rounds Table
CREATE TABLE IF NOT EXISTS delivery_rounds (
  id TEXT PRIMARY KEY,
  round_key TEXT UNIQUE NOT NULL CHECK (round_key IN ('morning', 'midday', 'evening')),
  display_name TEXT NOT NULL,
  cutoff_time TIME NOT NULL,
  delivery_start TIME NOT NULL,
  delivery_end TIME NOT NULL,
  max_capacity INTEGER DEFAULT 50,
  current_count INTEGER DEFAULT 0,
  date DATE DEFAULT CURRENT_DATE,
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'closed', 'cancelled')),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Customers Table
CREATE TABLE IF NOT EXISTS customers (
  id TEXT PRIMARY KEY,
  email TEXT UNIQUE,
  phone TEXT UNIQUE,
  name TEXT,
  line_id TEXT,
  default_latitude NUMERIC(10,7),
  default_longitude NUMERIC(10,7),
  default_address_detail TEXT,
  loyalty_points INTEGER DEFAULT 0,
  total_orders INTEGER DEFAULT 0,
  total_spent NUMERIC(10,2) DEFAULT 0,
  referral_code TEXT UNIQUE,
  referred_by TEXT REFERENCES customers(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Inventory Table
CREATE TABLE IF NOT EXISTS inventory (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  category TEXT,
  unit TEXT,
  current_stock INTEGER DEFAULT 0,
  min_stock INTEGER DEFAULT 0,
  max_stock INTEGER DEFAULT 0,
  unit_price NUMERIC(10,2) DEFAULT 0,
  supplier_name TEXT,
  supplier_phone TEXT,
  status TEXT DEFAULT 'in_stock' CHECK (status IN ('in_stock', 'low_stock', 'out_of_stock', 'critical')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Inventory Transactions Table
CREATE TABLE IF NOT EXISTS inventory_transactions (
  id TEXT PRIMARY KEY,
  ingredient_id TEXT REFERENCES inventory(id),
  quantity_change INTEGER NOT NULL,
  reason TEXT,
  transaction_type TEXT CHECK (transaction_type IN ('purchase', 'usage', 'adjustment', 'return')),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Reviews Table
CREATE TABLE IF NOT EXISTS reviews (
  id TEXT PRIMARY KEY,
  product_id TEXT REFERENCES products(id),
  customer_id TEXT REFERENCES customers(id),
  rating INTEGER CHECK (rating BETWEEN 1 AND 5),
  comment TEXT,
  is_verified BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Loyalty Points Table
CREATE TABLE IF NOT EXISTS loyalty_points (
  id TEXT PRIMARY KEY,
  customer_id TEXT REFERENCES customers(id),
  points INTEGER NOT NULL,
  points_type TEXT CHECK (points_type IN ('earned', 'redeemed', 'expired')),
  source TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  is_used BOOLEAN DEFAULT false
);

-- Promotions Table
CREATE TABLE IF NOT EXISTS promotions (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  code TEXT UNIQUE,
  type TEXT CHECK (type IN ('fixed_discount', 'percentage_discount', 'free_shipping', 'spend_threshold', 'buy_x_get_y', 'combo', 'loyalty', 'referral', 'birthday', 'flash_sale', 'round_based')),
  discount_value NUMERIC(10,2),
  max_discount_cap NUMERIC(10,2),
  min_spend NUMERIC(10,2),
  starts_at TIMESTAMPTZ,
  ends_at TIMESTAMPTZ,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Notifications Table
CREATE TABLE IF NOT EXISTS notifications (
  id TEXT PRIMARY KEY,
  customer_id TEXT REFERENCES customers(id),
  type TEXT CHECK (type IN ('order_update', 'promotion', 'system', 'loyalty', 'referral')),
  title TEXT NOT NULL,
  message TEXT,
  is_read BOOLEAN DEFAULT false,
  action_url TEXT,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- AI Conversations Table
CREATE TABLE IF NOT EXISTS ai_conversations (
  id TEXT PRIMARY KEY,
  customer_id TEXT REFERENCES customers(id),
  message_role TEXT CHECK (message_role IN ('user', 'assistant', 'system')),
  message_content TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- AI Recommendations Log Table
CREATE TABLE IF NOT EXISTS ai_recommendations (
  id TEXT PRIMARY KEY,
  customer_id TEXT REFERENCES customers(id),
  preferences JSONB,
  recommended_product_ids TEXT[],
  reason TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- 2. INDEXES
-- ============================================

CREATE INDEX IF NOT EXISTS idx_products_category ON products(category_id);
CREATE INDEX IF NOT EXISTS idx_products_available ON products(is_available);
CREATE INDEX IF NOT EXISTS idx_products_featured ON products(is_featured);
CREATE INDEX IF NOT EXISTS idx_products_created_at ON products(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_orders_customer ON orders(customer_id);
CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status);
CREATE INDEX IF NOT EXISTS idx_orders_created_at ON orders(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_orders_order_number ON orders(order_number);

CREATE INDEX IF NOT EXISTS idx_order_items_order ON order_items(order_id);
CREATE INDEX IF NOT EXISTS idx_order_items_product ON order_items(product_id);

CREATE INDEX IF NOT EXISTS idx_delivery_rounds_date ON delivery_rounds(date);
CREATE INDEX IF NOT EXISTS idx_delivery_rounds_status ON delivery_rounds(status);

CREATE INDEX IF NOT EXISTS idx_customers_email ON customers(email);
CREATE INDEX IF NOT EXISTS idx_customers_phone ON customers(phone);
CREATE INDEX IF NOT EXISTS idx_customers_referral ON customers(referral_code);

CREATE INDEX IF NOT EXISTS idx_inventory_status ON inventory(status);
CREATE INDEX IF NOT EXISTS idx_inventory_stock ON inventory(current_stock);

CREATE INDEX IF NOT EXISTS idx_reviews_product ON reviews(product_id);
CREATE INDEX IF NOT EXISTS idx_reviews_customer ON reviews(customer_id);

CREATE INDEX IF NOT EXISTS idx_promotions_active ON promotions(is_active);
CREATE INDEX IF NOT EXISTS idx_promotions_code ON promotions(code);

CREATE INDEX IF NOT EXISTS idx_notifications_customer ON notifications(customer_id);
CREATE INDEX IF NOT EXISTS idx_notifications_read ON notifications(is_read);

CREATE INDEX IF NOT EXISTS idx_ai_conversations_customer ON ai_conversations(customer_id);
CREATE INDEX IF NOT EXISTS idx_ai_recommendations_customer ON ai_recommendations(customer_id);

-- ============================================
-- 3. TRIGGERS
-- ============================================

-- Update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_products_updated_at BEFORE UPDATE ON products
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_orders_updated_at BEFORE UPDATE ON orders
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_customers_updated_at BEFORE UPDATE ON customers
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_inventory_updated_at BEFORE UPDATE ON inventory
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Auto-increment current_count for delivery rounds
CREATE OR REPLACE FUNCTION update_delivery_round_count()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE delivery_rounds
  SET current_count = current_count + 1
  WHERE id = NEW.delivery_round_id;
  RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER increment_delivery_round_count
  AFTER INSERT ON orders
  FOR EACH ROW EXECUTE FUNCTION update_delivery_round_count();

-- Calculate order total
CREATE OR REPLACE FUNCTION calculate_order_total()
RETURNS TRIGGER AS $$
BEGIN
  NEW.total_amount = (
    SELECT COALESCE(SUM(item_total), 0)
    FROM order_items
    WHERE order_id = NEW.id
  ) + NEW.delivery_fee + NEW.service_fee - NEW.discount_amount + NEW.tax_amount;
  RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER calculate_order_total_before_insert
  BEFORE INSERT ON orders
  FOR EACH ROW EXECUTE FUNCTION calculate_order_total();

-- ============================================
-- 4. SEED DATA
-- ============================================

-- Default delivery rounds
INSERT INTO delivery_rounds (id, round_key, display_name, cutoff_time, delivery_start, delivery_end, max_capacity)
VALUES
  ('round-morning', 'morning', 'รอบเช้า', '08:00', '06:00', '09:00', 50),
  ('round-midday', 'midday', 'รอบกลางวัน', '10:30', '11:00', '14:00', 50),
  ('round-evening', 'evening', 'รอบเยน', '16:00', '17:00', '20:00', 50)
ON CONFLICT (id) DO NOTHING;

-- Default categories
INSERT INTO product_categories (id, name, slug, icon, sort_order)
VALUES
  ('cat-1', 'จานเดียว', 'dish', '🍜', 1),
  ('cat-2', 'ข้าว', 'rice', '🍚', 2),
  ('cat-3', 'แกง', 'curry', '🍛', 3),
  ('cat-4', 'เครื่องดื่ม', 'drink', '🥤', 4),
  ('cat-5', 'ของหวาน', 'dessert', '🍰', 5)
ON CONFLICT (id) DO NOTHING;

-- ============================================
-- END OF MIGRATION
-- ============================================