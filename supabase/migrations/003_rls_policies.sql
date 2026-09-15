-- ============================================
-- Bite Me Baby — Row Level Security (RLS) Policies
-- Version: 1.0
-- Date: 2026-09-15
-- ============================================

-- Enable RLS on all tables
ALTER TABLE products ENABLE ROW LEVEL SECURITY;
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE order_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE inventory ENABLE ROW LEVEL SECURITY;
ALTER TABLE reviews ENABLE ROW LEVEL SECURITY;
ALTER TABLE loyalty_points ENABLE ROW LEVEL SECURITY;
ALTER TABLE promotions ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_recommendations ENABLE ROW LEVEL SECURITY;

-- ============================================
-- POLICIES FOR PUBLIC READ ACCESS
-- ============================================

-- Products: Everyone can read
CREATE POLICY "Products - Public Read" ON products
  FOR SELECT USING (true);

-- Categories: Everyone can read
CREATE POLICY "Categories - Public Read" ON product_categories
  FOR SELECT USING (true);

-- Promotions: Active promotions visible to everyone
CREATE POLICY "Promotions - Public Read" ON promotions
  FOR SELECT USING (is_active = true AND (ends_at IS NULL OR ends_at > NOW()));

-- ============================================
-- POLICIES FOR AUTHENTICATED USERS
-- ============================================

-- Customers: Users can read their own data
CREATE POLICY "Customers - Own Read" ON customers
  FOR SELECT USING (auth.uid()::text = id);

CREATE POLICY "Customers - Own Update" ON customers
  FOR UPDATE USING (auth.uid()::text = id);

-- Orders: Users can read their own orders
CREATE POLICY "Orders - Own Read" ON orders
  FOR SELECT USING (auth.uid()::text = customer_id);

-- Order Items: Users can read items from their own orders
CREATE POLICY "Order Items - Own Read" ON order_items
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM orders
      WHERE orders.id = order_items.order_id
      AND orders.customer_id = auth.uid()::text
    )
  );

-- Reviews: Users can create and read their own reviews
CREATE POLICY "Reviews - Own Create" ON reviews
  FOR INSERT WITH CHECK (auth.uid()::text = customer_id);

CREATE POLICY "Reviews - Own Read" ON reviews
  FOR SELECT USING (auth.uid()::text = customer_id);

-- Loyalty Points: Users can read their own points
CREATE POLICY "Loyalty Points - Own Read" ON loyalty_points
  FOR SELECT USING (auth.uid()::text = customer_id);

-- Notifications: Users can read their own notifications
CREATE POLICY "Notifications - Own Read" ON notifications
  FOR SELECT USING (auth.uid()::text = customer_id);

CREATE POLICY "Notifications - Own Update" ON notifications
  FOR UPDATE USING (auth.uid()::text = customer_id);

-- AI Conversations: Users can read their own conversations
CREATE POLICY "AI Conversations - Own Read" ON ai_conversations
  FOR SELECT USING (auth.uid()::text = customer_id);

CREATE POLICY "AI Conversations - Own Insert" ON ai_conversations
  FOR INSERT WITH CHECK (auth.uid()::text = customer_id);

-- AI Recommendations: Users can read their own recommendations
CREATE POLICY "AI Recommendations - Own Read" ON ai_recommendations
  FOR SELECT USING (auth.uid()::text = customer_id);

CREATE POLICY "AI Recommendations - Own Insert" ON ai_recommendations
  FOR INSERT WITH CHECK (auth.uid()::text = customer_id);

-- ============================================
-- POLICIES FOR ADMIN USERS
-- ============================================

-- Admins can read everything
CREATE POLICY "Admins - Read All" ON products
  FOR SELECT USING (true);

CREATE POLICY "Admins - Read All Orders" ON orders
  FOR SELECT USING (true);

CREATE POLICY "Admins - Read All Inventory" ON inventory
  FOR SELECT USING (true);

CREATE POLICY "Admins - Read All Customers" ON customers
  FOR SELECT USING (true);

-- Admins can update orders (status, payment)
CREATE POLICY "Admins - Update Orders" ON orders
  FOR UPDATE USING (true);

-- Admins can update inventory
CREATE POLICY "Admins - Update Inventory" ON inventory
  FOR UPDATE USING (true);

-- Admins can update products
CREATE POLICY "Admins - Update Products" ON products
  FOR UPDATE USING (true);

-- ============================================
-- POLICIES FOR SERVICE ROLE (Edge Functions)
-- ============================================

-- Service role can read/write everything (for backend operations)
CREATE POLICY "Service Role - Full Access" ON products
  FOR ALL USING (true) WITH CHECK (true);

CREATE POLICY "Service Role - Full Access Orders" ON orders
  FOR ALL USING (true) WITH CHECK (true);

CREATE POLICY "Service Role - Full Access Inventory" ON inventory
  FOR ALL USING (true) WITH CHECK (true);

-- ============================================
-- END OF POLICIES
-- ============================================