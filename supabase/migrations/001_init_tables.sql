-- ============================================
-- Bite Me Baby - Database Schema
-- Migration 001: Core Tables
-- ============================================

-- Enums
CREATE TYPE order_status AS ENUM (
  'pending', 'confirmed', 'preparing', 'ready_for_dispatch',
  'dispatched', 'in_transit', 'arrived', 'delivered',
  'cancelled', 'failed'
);

CREATE TYPE delivery_method AS ENUM (
  'self_delivery', 'grab_rider', 'linemen_rider', 'foodpanda_rider'
);

CREATE TYPE payment_status AS ENUM ('pending', 'paid', 'refund', 'partially_refunded');
CREATE TYPE payment_method AS ENUM ('promptpay_qr', 'credit_card', 'cash_on_delivery');
CREATE TYPE round_period AS ENUM ('morning', 'midday', 'evening');
CREATE TYPE promo_type AS ENUM (
  'fixed_discount', 'percentage_discount', 'free_shipping',
  'spend_threshold', 'buy_x_get_y', 'combo', 'loyalty',
  'referral', 'birthday', 'flash_sale', 'round_based'
);
CREATE TYPE promo_status AS ENUM ('draft', 'scheduled', 'active', 'paused', 'expired');
CREATE TYPE inventory_status AS ENUM ('in_stock', 'low_stock', 'out_of_stock', 'critical');
CREATE TYPE ingredient_unit AS ENUM ('kg', 'g', 'liter', 'ml', 'piece', 'dozen', 'pack', 'bunch');
CREATE TYPE inventory_transaction_type AS ENUM ('in', 'out', 'adjustment', 'waste');

-- ============================================
-- Core Tables
-- ============================================

-- Products (เมนอาหาร)
CREATE TABLE products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  price DECIMAL(10,2) NOT NULL,
  category_id UUID REFERENCES product_categories(id),
  image_url TEXT,
  is_available BOOLEAN DEFAULT true,
  is_featured BOOLEAN DEFAULT false,
  prep_minutes INTEGER DEFAULT 15,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_products_category ON products(category_id);
CREATE INDEX idx_products_available ON products(is_available);

-- Product Categories (หมวดหม่)
CREATE TABLE product_categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  slug TEXT UNIQUE NOT NULL,
  icon TEXT,
  sort_order INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Product Addons (ตัวเลือกเสริม)
CREATE TABLE product_addons (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id UUID REFERENCES products(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  price DECIMAL(10,2) DEFAULT 0,
  type TEXT DEFAULT 'radio',
  options JSONB,
  max_selections INTEGER DEFAULT 1,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- Customer & Address Tables
-- ============================================

-- Customers (ลกค้า)
CREATE TABLE customers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  phone TEXT UNIQUE NOT NULL,
  name TEXT,
  line_id TEXT,
  default_latitude DECIMAL(9,6),
  default_longitude DECIMAL(9,6),
  default_address_detail TEXT,
  loyalty_points INTEGER DEFAULT 0,
  total_orders INTEGER DEFAULT 0,
  total_spent DECIMAL(10,2) DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  last_login_at TIMESTAMPTZ,
  is_active BOOLEAN DEFAULT true
);

-- Customer Addresses (ที่อย่)
CREATE TABLE customer_addresses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id UUID REFERENCES customers(id) ON DELETE CASCADE,
  label TEXT,
  name TEXT,
  phone TEXT,
  latitude DECIMAL(9,6) NOT NULL,
  longitude DECIMAL(9,6) NOT NULL,
  detail TEXT NOT NULL,
  is_default BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- Order Tables
-- ============================================

-- Delivery Rounds (รอบจัดส่ง)
CREATE TABLE delivery_rounds (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  round_key round_period NOT NULL,
  display_name TEXT NOT NULL,
  cutoff_time TIME NOT NULL,
  preparation_window_minutes INTEGER DEFAULT 60,
  delivery_start TIME NOT NULL,
  delivery_end TIME NOT NULL,
  max_capacity INTEGER DEFAULT 40,
  current_count INTEGER DEFAULT 0,
  date DATE NOT NULL,
  status TEXT DEFAULT 'open',
  route_sequence JSONB,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(date, round_key)
);

CREATE INDEX idx_rounds_date_status ON delivery_rounds(date, status);

-- Orders (ออเดอรหลัก)
CREATE TABLE orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_number TEXT UNIQUE NOT NULL,
  customer_id UUID REFERENCES customers(id),
  delivery_round_id UUID REFERENCES delivery_rounds(id),
  
  status order_status DEFAULT 'pending',
  previous_status order_status,
  delivery_method delivery_method DEFAULT 'self_delivery',
  
  pickup_latitude DECIMAL(9,6) NOT NULL,
  pickup_longitude DECIMAL(9,6) NOT NULL,
  dropoff_latitude DECIMAL(9,6) NOT NULL,
  dropoff_longitude DECIMAL(9,6) NOT NULL,
  dropoff_detail TEXT NOT NULL,
  
  is_outside_self_zone BOOLEAN DEFAULT false,
  outside_zone_fee DECIMAL(10,2) DEFAULT 0,
  
  subtotal DECIMAL(10,2) NOT NULL,
  delivery_fee DECIMAL(10,2) DEFAULT 0,
  service_fee DECIMAL(10,2) DEFAULT 0,
  discount_amount DECIMAL(10,2) DEFAULT 0,
  tax_amount DECIMAL(10,2) DEFAULT 0,
  total_amount DECIMAL(10,2) NOT NULL,
  
  payment_status payment_status DEFAULT 'pending',
  payment_method payment_method,
  payment_transaction_id TEXT,
  
  special_instructions TEXT,
  cancellation_reason TEXT,
  external_tracking_code TEXT,
  external_rider_eta TIMESTAMP,
  
  confirmed_at TIMESTAMPTZ,
  prepared_at TIMESTAMPTZ,
  dispatched_at TIMESTAMPTZ,
  delivered_at TIMESTAMPTZ,
  cancelled_at TIMESTAMPTZ,
  driver_id UUID,
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_orders_customer ON orders(customer_id);
CREATE INDEX idx_orders_round ON orders(delivery_round_id);
CREATE INDEX idx_orders_status ON orders(status);
CREATE INDEX idx_orders_created ON orders(created_at DESC);

-- Order Items (รายละเอียดออเดอร)
CREATE TABLE order_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID REFERENCES orders(id) ON DELETE CASCADE,
  product_id UUID REFERENCES products(id),
  quantity INTEGER NOT NULL,
  unit_price DECIMAL(10,2) NOT NULL,
  customizations JSONB,
  special_request TEXT,
  item_total DECIMAL(10,2) NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- Promotion Tables
-- ============================================

-- Promotions (ปรมชั่น)
CREATE TABLE promotions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  type promo_type NOT NULL,
  status promo_status DEFAULT 'active',
  trigger_type TEXT DEFAULT 'automatic',
  scope TEXT DEFAULT 'all',
  
  min_order_amount DECIMAL(10,2) DEFAULT 0,
  min_quantity INTEGER DEFAULT 0,
  max_uses_per_user INTEGER DEFAULT 1,
  max_uses_total INTEGER,
  current_uses INTEGER DEFAULT 0,
  
  discount_type TEXT DEFAULT 'percentage',
  discount_value DECIMAL(10,2) NOT NULL,
  max_discount DECIMAL(10,2),
  
  valid_from TIMESTAMPTZ NOT NULL,
  valid_until TIMESTAMPTZ NOT NULL,
  applicable_days_of_week INTEGER[] DEFAULT ARRAY[1,2,3,4,5,6,7],
  applicable_hours_start TIME DEFAULT '00:00',
  applicable_hours_end TIME DEFAULT '23:59',
  
  applicable_product_ids UUID[] DEFAULT '{}',
  applicable_category_ids UUID[] DEFAULT '{}',
  applicable_round_ids UUID[] DEFAULT '{}',
  is_stackable BOOLEAN DEFAULT false,
  priority INTEGER DEFAULT 0,
  metadata JSONB DEFAULT '{}',
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  CHECK (discount_value >= 0),
  CHECK (valid_until > valid_from)
);

CREATE INDEX idx_promotions_status ON promotions(status);
CREATE INDEX idx_promotions_dates ON promotions(valid_from, valid_until);

-- User Coupons (คปองของผ้ใช้)
CREATE TABLE user_coupons (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES customers(id) ON DELETE CASCADE,
  promotion_id UUID REFERENCES promotions(id) ON DELETE CASCADE,
  code TEXT,
  is_used BOOLEAN DEFAULT false,
  used_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ,
  order_id UUID REFERENCES orders(id),
  discount_applied DECIMAL(10,2) DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, promotion_id)
);

-- Promotion Usage History
CREATE TABLE promotion_usage (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  promotion_id UUID REFERENCES promotions(id) ON DELETE CASCADE,
  user_id UUID REFERENCES customers(id) ON DELETE SET NULL,
  order_id UUID REFERENCES orders(id) ON DELETE CASCADE,
  discount_applied DECIMAL(10,2) NOT NULL,
  applied_at TIMESTAMPTZ DEFAULT NOW(),
  source TEXT,
  campaign_name TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Combo Sets (ชุดคอมบ)
CREATE TABLE combo_sets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  image_url TEXT,
  original_price DECIMAL(10,2) NOT NULL,
  combo_price DECIMAL(10,2) NOT NULL,
  max_quantity_per_order INTEGER DEFAULT 3,
  is_available BOOLEAN DEFAULT true,
  valid_from TIMESTAMPTZ NOT NULL,
  valid_until TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  CHECK (combo_price < original_price)
);

CREATE TABLE combo_set_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  combo_set_id UUID REFERENCES combo_sets(id) ON DELETE CASCADE,
  product_id UUID REFERENCES products(id) ON DELETE CASCADE,
  quantity INTEGER NOT NULL,
  is_required BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(combo_set_id, product_id)
);

-- ============================================
-- Review & Voting Tables
-- ============================================

-- Reviews (รีวิว)
CREATE TABLE reviews (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID REFERENCES orders(id),
  customer_id UUID REFERENCES customers(id),
  product_id UUID REFERENCES products(id),
  rating INTEGER CHECK (rating BETWEEN 1 AND 5),
  comment TEXT,
  images TEXT[],
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_reviews_product ON reviews(product_id);
CREATE INDEX idx_reviews_customer ON reviews(customer_id);

-- Menu Votes (หวตเมน)
CREATE TABLE menu_votes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id UUID REFERENCES products(id) ON DELETE CASCADE,
  customer_id UUID REFERENCES customers(id) ON DELETE CASCADE,
  vote_type TEXT DEFAULT 'upvote',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(product_id, customer_id)
);

-- Menu Polls (หวตเมนใหม่)
CREATE TABLE menu_polls (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  description TEXT,
  starts_at TIMESTAMPTZ NOT NULL,
  ends_at TIMESTAMPTZ NOT NULL,
  is_active BOOLEAN DEFAULT true,
  total_votes INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE poll_options (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  poll_id UUID REFERENCES menu_polls(id) ON DELETE CASCADE,
  product_id UUID REFERENCES products(id),
  name TEXT NOT NULL,
  image_url TEXT,
  vote_count INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Random Menu Draws (สุ่มเมน)
CREATE TABLE random_menu_draws (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id UUID REFERENCES customers(id) ON DELETE CASCADE,
  selected_product_id UUID REFERENCES products(id),
  discount_code TEXT UNIQUE NOT NULL,
  used BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- Rewards & Points Tables
-- ============================================

-- Loyalty Points (แต้มสะสม)
CREATE TABLE loyalty_points (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES customers(id) ON DELETE CASCADE,
  points INTEGER NOT NULL,
  points_type TEXT DEFAULT 'earned',
  source TEXT NOT NULL,
  order_id UUID REFERENCES orders(id),
  expires_at TIMESTAMPTZ,
  is_used BOOLEAN DEFAULT false,
  used_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  CHECK (points > 0)
);

CREATE INDEX idx_loyalty_points_user ON loyalty_points(user_id);
CREATE INDEX idx_loyalty_points_expiry ON loyalty_points(expires_at);

-- Reward Redemptions (แลก奖励)
CREATE TABLE reward_redemptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES customers(id) ON DELETE CASCADE,
  points_used INTEGER NOT NULL,
  reward_type TEXT NOT NULL,
  reward_value TEXT NOT NULL,
  redeemed_at TIMESTAMPTZ DEFAULT NOW(),
  status TEXT DEFAULT 'pending',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Referrals (แนะนำเพื่อน)
CREATE TABLE referrals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  referrer_user_id UUID REFERENCES customers(id) ON DELETE CASCADE,
  referred_user_id UUID REFERENCES customers(id) ON DELETE CASCADE,
  referrer_reward DECIMAL(10,2) DEFAULT 0,
  referred_reward DECIMAL(10,2) DEFAULT 0,
  status TEXT DEFAULT 'pending',
  referred_order_id UUID REFERENCES orders(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  completed_at TIMESTAMPTZ,
  UNIQUE(referrer_user_id, referred_user_id)
);

-- Viral Activities (กิจกรรม)
CREATE TABLE viral_activities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  type TEXT NOT NULL,
  description TEXT,
  points_reward INTEGER NOT NULL,
  is_active BOOLEAN DEFAULT true,
  starts_at TIMESTAMPTZ NOT NULL,
  ends_at TIMESTAMPTZ,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE viral_activity_progress (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES customers(id) ON DELETE CASCADE,
  activity_id UUID REFERENCES viral_activities(id) ON DELETE CASCADE,
  progress INTEGER DEFAULT 0,
  target INTEGER NOT NULL,
  completed BOOLEAN DEFAULT false,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, activity_id)
);

CREATE TABLE user_badges (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES customers(id) ON DELETE CASCADE,
  badge_id TEXT NOT NULL,
  earned_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, badge_id)
);

-- Share Events (แชร)
CREATE TABLE share_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES customers(id) ON DELETE CASCADE,
  platform TEXT NOT NULL,
  content_type TEXT NOT NULL,
  content_id TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- Notification Tables
-- ============================================

CREATE TABLE notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES customers(id) ON DELETE CASCADE,
  order_id UUID REFERENCES orders(id),
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  type TEXT NOT NULL,
  data JSONB,
  channel TEXT DEFAULT 'push',
  is_read BOOLEAN DEFAULT false,
  sent_at TIMESTAMPTZ,
  read_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_notifications_user ON notifications(user_id);
CREATE INDEX idx_notifications_read ON notifications(is_read);

-- ============================================
-- Service Zone Table
-- ============================================

CREATE TABLE service_zones (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_name TEXT DEFAULT 'Bite Me Baby',
  shop_address TEXT NOT NULL,
  shop_lat DECIMAL(9,6) NOT NULL,
  shop_lng DECIMAL(9,6) NOT NULL,
  self_delivery_radius_km INTEGER DEFAULT 5,
  rider_overlay_min_km INTEGER DEFAULT 5,
  rider_overlay_max_km INTEGER DEFAULT 15,
  min_order_amount DECIMAL(10,2) DEFAULT 200,
  self_delivery_fee DECIMAL(10,2) DEFAULT 30,
  is_open BOOLEAN DEFAULT true,
  opening_time TIME DEFAULT '06:00',
  closing_time TIME DEFAULT '20:00',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- ROW LEVEL SECURITY (RLS) Policies
-- ============================================

ALTER TABLE products ENABLE ROW LEVEL SECURITY;
ALTER TABLE customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE order_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE reviews ENABLE ROW LEVEL SECURITY;
ALTER TABLE promotions ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_coupons ENABLE ROW LEVEL SECURITY;
ALTER TABLE loyalty_points ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

-- Products: Everyone can read
CREATE POLICY "Products - select" ON products FOR SELECT USING (true);

-- Customers: Own data
CREATE POLICY "Customers - select own" ON customers FOR SELECT USING (auth.uid() = id);
CREATE POLICY "Customers - update own" ON customers FOR UPDATE USING (auth.uid() = id);

-- Orders: Own data
CREATE POLICY "Orders - select own" ON orders FOR SELECT USING (auth.uid() = customer_id);
CREATE POLICY "Orders - insert own" ON orders FOR INSERT WITH CHECK (auth.uid() = customer_id);

-- Order Items: Based on order ownership
CREATE POLICY "Order Items - select based on order" ON order_items FOR SELECT USING (
  exists (select 1 from orders where orders.id = order_items.order_id and orders.customer_id = auth.uid())
);

-- Reviews: Own reviews
CREATE POLICY "Reviews - select own" ON reviews FOR SELECT USING (auth.uid() = customer_id);
CREATE POLICY "Reviews - insert own" ON reviews FOR INSERT WITH CHECK (auth.uid() = customer_id);

-- Promotions: Everyone can read active
CREATE POLICY "Promotions - select active" ON promotions FOR SELECT USING (status = 'active' OR auth.role() = 'service_role');

-- User Coupons: Own coupons
CREATE POLICY "User Coupons - select own" ON user_coupons FOR SELECT USING (auth.uid() = user_id);

-- Loyalty Points: Own points
CREATE POLICY "Loyalty Points - select own" ON loyalty_points FOR SELECT USING (auth.uid() = user_id);

-- Notifications: Own notifications
CREATE POLICY "Notifications - select own" ON notifications FOR SELECT USING (auth.uid() = user_id);

-- ============================================
-- Triggers & Functions
-- ============================================

-- Auto-update updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_products_updated_at BEFORE UPDATE ON products FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_orders_updated_at BEFORE UPDATE ON orders FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_promotions_updated_at BEFORE UPDATE ON promotions FOR EACH ROW EXECUTE FUNCTION update_promotions_updated_at_column();

-- Auto-generate order number
CREATE OR REPLACE FUNCTION generate_order_number()
RETURNS TRIGGER AS $$
BEGIN
  NEW.order_number := 'BM-' || TO_CHAR(NEW.created_at, 'YYYYMMDD') || '-' || LPAD(NEXTVAL('order_seq')::TEXT, 3, '0');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE SEQUENCE order_seq START 1;
CREATE TRIGGER set_order_number BEFORE INSERT ON orders FOR EACH ROW EXECUTE FUNCTION generate_order_number();

-- Initialize with seed data
INSERT INTO product_categories (name, slug, icon, sort_order) VALUES
  ('จานเดียว', 'jan-diao', '🍜', 1),
  ('แกง', 'gaeng', '🍛', 2),
  ('ข้าว', 'khao', '🍚', 3),
  ('เครื่องดื่ม', 'khrueang-dueam', '🥤', 4),
  ('ของหวาน', 'khong-wan', '🍰', 5);

INSERT INTO service_zones (shop_name, shop_address, shop_lat, shop_lng) VALUES
  ('Bite Me Baby', '123 ถ.ศรีสุวรร จ.จันทบุรี', 10.7016, 102.1429);
