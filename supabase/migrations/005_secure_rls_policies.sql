-- ============================================
-- Bite Me Baby — Migration 005: Secure RLS Policies
-- Date: 2026-09-18
-- Purpose: Convert RLS from Permissive → Secure/Strict Mode
-- ============================================

-- ============================================
-- 1. orders — Secure Mode
-- ============================================
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS orders_anon_read ON orders;
CREATE POLICY orders_anon_read ON orders
  FOR SELECT TO anon
  USING (status IN ('delivered', 'cancelled') OR customer_phone IS NOT NULL);

DROP POLICY IF EXISTS orders_own_read ON orders;
CREATE POLICY orders_own_read ON orders
  FOR SELECT TO authenticated
  USING (customer_phone = auth.email() OR role = 'admin');

DROP POLICY IF EXISTS orders_own_create ON orders;
CREATE POLICY orders_own_create ON orders
  FOR INSERT TO authenticated
  WITH CHECK (customer_phone = auth.email() OR role = 'admin');

DROP POLICY IF EXISTS orders_admin_manage ON orders;
CREATE POLICY orders_admin_manage ON orders
  FOR ALL TO authenticated
  USING (role = 'admin')
  WITH CHECK (role = 'admin');

-- ============================================
-- 2. order_items — Secure Mode
-- ============================================
ALTER TABLE order_items ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS order_items_anon ON order_items;
CREATE POLICY order_items_anon ON order_items
  FOR ALL TO anon USING (false);

DROP POLICY IF EXISTS order_items_own ON order_items;
CREATE POLICY order_items_own ON order_items
  FOR ALL TO authenticated
  USING (order_id IN (SELECT id FROM orders WHERE customer_phone = auth.email() OR role = 'admin'))
  WITH CHECK (order_id IN (SELECT id FROM orders WHERE customer_phone = auth.email() OR role = 'admin'));

DROP POLICY IF EXISTS order_items_admin ON order_items;
CREATE POLICY order_items_admin ON order_items
  FOR ALL TO authenticated
  USING (role = 'admin')
  WITH CHECK (role = 'admin');

-- ============================================
-- 3. pre_orders — Secure Mode
-- ============================================
ALTER TABLE pre_orders ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS pre_orders_anon_read ON pre_orders;
CREATE POLICY pre_orders_anon_read ON pre_orders
  FOR SELECT TO anon
  USING (status = 'pending' OR customer_name IS NOT NULL);

DROP POLICY IF EXISTS pre_orders_own ON pre_orders;
CREATE POLICY pre_orders_own ON pre_orders
  FOR ALL TO authenticated
  USING (customer_phone = auth.email() OR role = 'admin')
  WITH CHECK (customer_phone = auth.email() OR role = 'admin');

DROP POLICY IF EXISTS pre_orders_admin ON pre_orders;
CREATE POLICY pre_orders_admin ON pre_orders
  FOR ALL TO authenticated
  USING (role = 'admin')
  WITH CHECK (role = 'admin');

-- ============================================
-- 4. payment_intents — Secure Mode
-- ============================================
ALTER TABLE payment_intents ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS payment_intents_anon ON payment_intents;
CREATE POLICY payment_intents_anon ON payment_intents
  FOR ALL TO anon USING (false);

DROP POLICY IF EXISTS payment_intents_own ON payment_intents;
CREATE POLICY payment_intents_own ON payment_intents
  FOR SELECT TO authenticated
  USING (order_number IN (SELECT order_number FROM orders WHERE customer_phone = auth.email() OR role = 'admin'));

DROP POLICY IF EXISTS payment_intents_own_create ON payment_intents;
CREATE POLICY payment_intents_own_create ON payment_intents
  FOR INSERT TO authenticated
  WITH CHECK (order_number IN (SELECT order_number FROM orders WHERE customer_phone = auth.email() OR role = 'admin'));

DROP POLICY IF EXISTS payment_intents_admin ON payment_intents;
CREATE POLICY payment_intents_admin ON payment_intents
  FOR ALL TO authenticated
  USING (role = 'admin')
  WITH CHECK (role = 'admin');

-- ============================================
-- 5. profiles — Public Read, Own Write
-- ============================================
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS profiles_public_read ON profiles;
CREATE POLICY profiles_public_read ON profiles
  FOR SELECT TO anon, authenticated
  USING (true);

DROP POLICY IF EXISTS profiles_own_write ON profiles;
CREATE POLICY profiles_own_write ON profiles
  FOR UPDATE TO authenticated
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

DROP POLICY IF EXISTS profiles_admin_manage ON profiles;
CREATE POLICY profiles_admin_manage ON profiles
  FOR ALL TO authenticated
  USING (role = 'admin')
  WITH CHECK (role = 'admin');

-- ============================================
-- 6. products, categories, inventory — Public Read, Admin Write
-- ============================================
ALTER TABLE products ENABLE ROW LEVEL SECURITY;
ALTER TABLE product_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE inventory ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS products_public_read ON products;
CREATE POLICY products_public_read ON products
  FOR SELECT TO anon, authenticated
  USING (is_available = true);

DROP POLICY IF EXISTS product_categories_public_read ON product_categories;
CREATE POLICY product_categories_public_read ON product_categories
  FOR SELECT TO anon, authenticated
  USING (is_active = true);

DROP POLICY IF EXISTS inventory_public_read ON inventory;
CREATE POLICY inventory_public_read ON inventory
  FOR SELECT TO anon, authenticated
  USING (true);

DROP POLICY IF EXISTS products_admin_manage ON products;
CREATE POLICY products_admin_manage ON products
  FOR ALL TO authenticated
  USING (role = 'admin')
  WITH CHECK (role = 'admin');

DROP POLICY IF EXISTS product_categories_admin_manage ON product_categories;
CREATE POLICY product_categories_admin_manage ON product_categories
  FOR ALL TO authenticated
  USING (role = 'admin')
  WITH CHECK (role = 'admin');

DROP POLICY IF EXISTS inventory_admin_manage ON inventory;
CREATE POLICY inventory_admin_manage ON inventory
  FOR ALL TO authenticated
  USING (role = 'admin')
  WITH CHECK (role = 'admin');

-- ============================================
-- 7. customers — Admin only
-- ============================================
ALTER TABLE customers ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS customers_anon ON customers;
CREATE POLICY customers_anon ON customers
  FOR ALL TO anon USING (false);

DROP POLICY IF EXISTS customers_own_read ON customers;
CREATE POLICY customers_own_read ON customers
  FOR SELECT TO authenticated
  USING (phone = auth.email() OR role = 'admin');

DROP POLICY IF EXISTS customers_admin_manage ON customers;
CREATE POLICY customers_admin_manage ON customers
  FOR ALL TO authenticated
  USING (role = 'admin')
  WITH CHECK (role = 'admin');

-- ============================================
-- 8. GRANTS (secure posture)
-- ============================================
REVOKE ALL ON ALL TABLES IN SCHEMA public FROM public;
GRANT USAGE ON SCHEMA public TO anon, authenticated;
GRANT SELECT ON ALL TABLES IN SCHEMA public TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO authenticated;

-- ============================================
-- DONE — RLS Secure Mode
-- ============================================
