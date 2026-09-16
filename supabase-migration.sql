-- ============================================
-- Bite Me Baby — Supabase Migration v3.1
-- Pre-order System + Full Database Integration
-- ============================================
-- รัน SQL นี้ใน Supabase SQL Editor:
-- https://ivkdfognyiwjcmrhcnwz.supabase.co/editor
-- ============================================

-- ============================================
-- 1. EXTENSIONS
-- ============================================
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";

-- ============================================
-- 2. TYPES (ENUMS)
-- ============================================
CREATE TYPE order_status AS ENUM (
  'pending', 'confirmed', 'preparing', 'ready_for_dispatch',
  'dispatched', 'in_transit', 'arrived', 'delivered',
  'cancelled', 'failed'
);

CREATE TYPE payment_status AS ENUM (
  'pending', 'paid', 'refund', 'partially_refunded'
);

CREATE TYPE payment_method AS ENUM (
  'promptpay_qr', 'credit_card', 'cash_on_delivery'
);

CREATE TYPE delivery_method AS ENUM (
  'self_delivery', 'grab_rider', 'linemen_rider', 'foodpanda_rider'
);

CREATE TYPE round_period AS ENUM (
  'morning', 'midday', 'evening'
);

CREATE TYPE ingredient_status AS ENUM (
  'in_stock', 'low_stock', 'out_of_stock'
);

CREATE TYPE product_category_slug AS ENUM (
  'dish', 'rice', 'curry', 'drink', 'dessert'
);

-- ============================================
-- 3. TABLES
-- ============================================

-- 3.1 Product Categories (หมวดหมู่) - สร้างก่อนเพราะ products และ delivery_rounds 引用
CREATE TABLE product_categories (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  slug product_category_slug NOT NULL UNIQUE,
  icon TEXT DEFAULT '',
  sort_order INTEGER NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 3.2 Delivery Rounds (รอบส่ง) - สร้างก่อนเพราะ products และ orders 引用
CREATE TABLE delivery_rounds (
  id TEXT PRIMARY KEY,
  round_key round_period NOT NULL,
  display_name TEXT NOT NULL,
  cutoff_time TIME NOT NULL,
  delivery_start TIME NOT NULL,
  delivery_end TIME NOT NULL,
  max_capacity INTEGER NOT NULL DEFAULT 100,
  current_count INTEGER NOT NULL DEFAULT 0,
  date DATE NOT NULL,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'closed', 'cancelled')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_delivery_rounds_date ON delivery_rounds(date);
CREATE INDEX idx_delivery_rounds_status ON delivery_rounds(status);

-- 3.3 Products (เมนู) - สร้างหลังเพราะมี FK ไปยัง product_categories และ delivery_rounds
CREATE TABLE products (
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

CREATE INDEX idx_products_category ON products(category_id);
CREATE INDEX idx_products_preorder ON products(is_preorder) WHERE is_preorder = true;
CREATE INDEX idx_products_featured ON products(is_featured) WHERE is_featured = true;
CREATE INDEX idx_products_available ON products(is_available) WHERE is_available = true;
CREATE INDEX idx_products_scheduled ON products(scheduled_date);

-- 3.4 Orders (คำสั่งซื้อ)
CREATE TABLE orders (
  id TEXT PRIMARY KEY,
  order_number TEXT NOT NULL UNIQUE,
  customer_id UUID REFERENCES auth.users(id),
  customer_name TEXT NOT NULL,
  customer_phone TEXT NOT NULL,
  delivery_round_id TEXT NOT NULL REFERENCES delivery_rounds(id),
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

CREATE INDEX idx_orders_customer ON orders(customer_id);
CREATE INDEX idx_orders_number ON orders(order_number);
CREATE INDEX idx_orders_status ON orders(status);
CREATE INDEX idx_orders_round ON orders(delivery_round_id);
CREATE INDEX idx_orders_created ON orders(created_at);

-- 3.5 Order Items (รายการในคำสั่งซื้อ)
CREATE TABLE order_items (
  id TEXT PRIMARY KEY,
  order_id TEXT NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  product_id TEXT NOT NULL REFERENCES products(id),
  quantity INTEGER NOT NULL DEFAULT 1 CHECK (quantity > 0),
  unit_price NUMERIC(10, 2) NOT NULL,
  customizations JSONB DEFAULT '{}',
  special_request TEXT DEFAULT '',
  item_total NUMERIC(10, 2) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_order_items_order ON order_items(order_id);
CREATE INDEX idx_order_items_product ON order_items(product_id);

-- 3.6 Inventory (วัตถุดิบ)
CREATE TABLE inventory (
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
  status ingredient_status NOT NULL DEFAULT 'in_stock',
  last_restocked_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_inventory_category ON inventory(category);
CREATE INDEX idx_inventory_status ON inventory(status);

-- 3.7 Pre-order Votes (โหวตเมนู)
CREATE TABLE preorder_votes (
  id TEXT PRIMARY KEY,
  product_id TEXT NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  customer_id UUID REFERENCES auth.users(id),
  vote_count INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(product_id, customer_id)
);

CREATE INDEX idx_preorder_votes_product ON preorder_votes(product_id);

-- 3.8 Users (ผู้ใช้ — ใช้ Supabase Auth + profile)
CREATE TABLE profiles (
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

CREATE UNIQUE INDEX idx_profiles_email ON profiles(email);
CREATE INDEX idx_profiles_phone ON profiles(phone);
CREATE INDEX idx_profiles_role ON profiles(role);

-- ============================================
-- 4. ROW LEVEL SECURITY (RLS)
-- ============================================

ALTER TABLE products ENABLE ROW LEVEL SECURITY;
ALTER TABLE product_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE delivery_rounds ENABLE ROW LEVEL SECURITY;
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE order_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE inventory ENABLE ROW LEVEL SECURITY;
ALTER TABLE preorder_votes ENABLE ROW LEVEL SECURITY;
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "products_select" ON products FOR SELECT USING (true);
CREATE POLICY "products_insert" ON products FOR INSERT WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "products_update" ON products FOR UPDATE USING (auth.role() = 'authenticated');
CREATE POLICY "products_delete" ON products FOR DELETE USING (auth.role() = 'admin');

CREATE POLICY "categories_select" ON product_categories FOR SELECT USING (true);
CREATE POLICY "categories_insert" ON product_categories FOR INSERT WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "categories_update" ON product_categories FOR UPDATE USING (auth.role() = 'authenticated');
CREATE POLICY "categories_delete" ON product_categories FOR DELETE USING (auth.role() = 'admin');

CREATE POLICY "delivery_rounds_select" ON delivery_rounds FOR SELECT USING (true);
CREATE POLICY "delivery_rounds_insert" ON delivery_rounds FOR INSERT WITH CHECK (auth.role() = 'admin');
CREATE POLICY "delivery_rounds_update" ON delivery_rounds FOR UPDATE USING (auth.role() = 'admin');

CREATE POLICY "orders_select" ON orders FOR SELECT USING (auth.role() = 'admin' OR customer_id = auth.uid());
CREATE POLICY "orders_insert" ON orders FOR INSERT WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "orders_update" ON orders FOR UPDATE USING (auth.role() = 'admin');

CREATE POLICY "order_items_select" ON order_items FOR SELECT USING (
  EXISTS (SELECT 1 FROM orders WHERE orders.id = order_items.order_id AND (orders.customer_id = auth.uid() OR auth.role() = 'admin'))
);
CREATE POLICY "order_items_insert" ON order_items FOR INSERT WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "order_items_update" ON order_items FOR UPDATE USING (auth.role() = 'admin');

CREATE POLICY "inventory_select" ON inventory FOR SELECT USING (auth.role() = 'admin');
CREATE POLICY "inventory_insert" ON inventory FOR INSERT WITH CHECK (auth.role() = 'admin');
CREATE POLICY "inventory_update" ON inventory FOR UPDATE USING (auth.role() = 'admin');
CREATE POLICY "inventory_delete" ON inventory FOR DELETE USING (auth.role() = 'admin');

CREATE POLICY "preorder_votes_select" ON preorder_votes FOR SELECT USING (true);
CREATE POLICY "preorder_votes_insert" ON preorder_votes FOR INSERT WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "preorder_votes_update" ON preorder_votes FOR UPDATE USING (auth.role() = 'authenticated');

CREATE POLICY "profiles_select" ON profiles FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "profiles_insert" ON profiles FOR INSERT WITH CHECK (auth.uid() = id);
CREATE POLICY "profiles_update" ON profiles FOR UPDATE USING (auth.uid() = id);

-- ============================================
-- 5. FUNCTIONS & TRIGGERS
-- ============================================

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER products_updated_at BEFORE UPDATE ON products FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER delivery_rounds_updated_at BEFORE UPDATE ON delivery_rounds FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER orders_updated_at BEFORE UPDATE ON orders FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER inventory_updated_at BEFORE UPDATE ON inventory FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER profiles_updated_at BEFORE UPDATE ON profiles FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE OR REPLACE FUNCTION increment_delivery_round_count()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE delivery_rounds SET current_count = current_count + 1 WHERE id = NEW.delivery_round_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_order_insert_increment_round AFTER INSERT ON orders FOR EACH ROW EXECUTE FUNCTION increment_delivery_round_count();

CREATE OR REPLACE FUNCTION calculate_item_total()
RETURNS TRIGGER AS $$
BEGIN
  NEW.item_total = NEW.quantity * NEW.unit_price;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_order_items_calculate_total BEFORE INSERT OR UPDATE ON order_items FOR EACH ROW EXECUTE FUNCTION calculate_item_total();

CREATE OR REPLACE FUNCTION update_inventory_status()
RETURNS TRIGGER AS $$
BEGIN
  NEW.status = CASE
    WHEN NEW.current_stock <= 0 THEN 'out_of_stock'::ingredient_status
    WHEN NEW.current_stock <= NEW.min_stock THEN 'low_stock'::ingredient_status
    ELSE 'in_stock'::ingredient_status
  END;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_inventory_calculate_status BEFORE INSERT OR UPDATE ON inventory FOR EACH ROW EXECUTE FUNCTION update_inventory_status();

-- ============================================
-- 6. SEED DATA
-- ============================================

INSERT INTO product_categories (id, name, slug, icon, sort_order, is_active) VALUES
  ('cat-1', 'จานเดียว', 'dish', '🍜', 1, true),
  ('cat-2', 'ข้าว', 'rice', '🍚', 2, true),
  ('cat-3', 'แกง', 'curry', '🍛', 3, true),
  ('cat-4', 'เครื่องดื่ม', 'drink', '🥤', 4, true),
  ('cat-5', 'ของหวาน', 'dessert', '🍰', 5, true);

INSERT INTO delivery_rounds (id, round_key, display_name, cutoff_time, delivery_start, delivery_end, max_capacity, current_count, date, status) VALUES
  ('round-1', 'morning', 'เช้า (07:00-10:00)', '06:00', '07:00', '10:00', 60, 0, CURRENT_DATE, 'active'),
  ('round-2', 'midday', 'เที่ยง (11:00-14:00)', '10:00', '11:00', '14:00', 80, 0, CURRENT_DATE, 'active'),
  ('round-3', 'evening', 'เย็น (17:00-20:00)', '16:00', '17:00', '20:00', 100, 0, CURRENT_DATE, 'active');

INSERT INTO products (id, name, description, price, category_id, image_url, is_available, is_featured, is_preorder, prep_minutes, sort_order) VALUES
  ('prod-1', 'ผัดไทยกุ้งสด', 'ผัดไทยกุ้งสดสดใหม่', 65.00, 'cat-1', '', true, true, false, 15, 1),
  ('prod-2', 'ข้าวหมูทอดกระเทียม', 'ข้าวหมูทอดกระเทียมหอมๆ', 70.00, 'cat-2', '', true, false, false, 10, 2),
  ('prod-3', 'แกงเขียวหวานไก่', 'แกงเขียวหวานไก่ creamy', 75.00, 'cat-3', '', true, true, false, 20, 3),
  ('prod-4', 'กาแฟเย็น', 'กาแฟเย็นหอมๆ', 35.00, 'cat-4', '', true, false, false, 5, 4);

INSERT INTO products (id, name, description, price, category_id, image_url, is_available, is_featured, is_preorder, prep_minutes, sort_order, delivery_round_id, scheduled_date) VALUES
  ('prod-5', 'เมนูโหวต: ต้มยำกุ้งสด', 'โหวตเมนูนี้เพื่อจองล่วงหน้า — ส่งรอบหน้า', 85.00, 'cat-1', '', true, true, true, 25, 5, 'round-2', CURRENT_DATE + INTERVAL '7 days'),
  ('prod-6', 'เมนูใหม่: ผัดไทยทะเล', 'โหวตเมนูนี้เพื่อจองล่วงหน้า — ส่งรอบหน้า', 95.00, 'cat-1', '', true, true, true, 20, 6, 'round-3', CURRENT_DATE + INTERVAL '14 days');

INSERT INTO inventory (id, name, category, unit, current_stock, min_stock, max_stock, unit_price, supplier_name, supplier_phone) VALUES
  ('ing-1', 'ข้าว', 'carb', 'kg', 10, 5, 20, 45.00, 'ร้านข้าวจันทบุรี', '0812345678'),
  ('ing-2', 'ไก่', 'protein', 'kg', 5, 3, 15, 85.00, 'ฟาร์มไก่จันทบุรี', '0812345679'),
  ('ing-3', 'ไข่ไก่', 'protein', 'piece', 2, 10, 50, 3.00, 'ฟาร์มไข่จันทบุรี', '0812345680'),
  ('ing-4', 'น้ำมัน', 'sauce', 'liter', 3, 2, 10, 40.00, 'ร้านน้ำมันจันทบุรี', '0812345681');

-- ============================================
-- 7. SUPABASE STORAGE BUCKET (สร้างใน Dashboard > Storage)
-- ============================================
-- ชื่อ bucket: 'bmb-images'
-- Policy: Public read, authenticated write
-- ============================================

-- ============================================
-- END OF MIGRATION
-- ============================================