-- Bite Me Baby Complete Schema
-- Generated: 2026-09-15

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";

-- Drop existing tables (if any from previous failed runs)
DROP TABLE IF EXISTS ai_recommendations CASCADE;
DROP TABLE IF EXISTS ai_conversations CASCADE;
DROP TABLE IF EXISTS notifications CASCADE;
DROP TABLE IF EXISTS promotions CASCADE;
DROP TABLE IF EXISTS loyalty_points CASCADE;
DROP TABLE IF EXISTS reviews CASCADE;
DROP TABLE IF EXISTS preorder_votes CASCADE;
DROP TABLE IF EXISTS inventory_transactions CASCADE;
DROP TABLE IF EXISTS inventory CASCADE;
DROP TABLE IF EXISTS order_items CASCADE;
DROP TABLE IF EXISTS orders CASCADE;
DROP TABLE IF EXISTS products CASCADE;
DROP TABLE IF EXISTS customers CASCADE;
DROP TABLE IF EXISTS delivery_rounds CASCADE;
DROP TABLE IF EXISTS product_categories CASCADE;

-- Drop custom types if they exist
DROP TYPE IF EXISTS loyalty_status CASCADE;
DROP TYPE IF EXISTS product_type CASCADE;
DROP TYPE IF EXISTS payment_status CASCADE;
DROP TYPE IF EXISTS order_status CASCADE;

-- Custom Enums
CREATE TYPE order_status AS ENUM ('pending', 'confirmed', 'preparing', 'ready_for_pickup', 'picked_up', 'completed', 'cancelled');
CREATE TYPE payment_status AS ENUM ('pending', 'paid', 'refunded', 'failed');
CREATE TYPE product_type AS ENUM ('custom', 'standard', 'promotional');
CREATE TYPE loyalty_status AS ENUM ('active', 'expired', 'redeemed');

-- Table: product_categories
CREATE TABLE product_categories (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name VARCHAR(100) NOT NULL,
  description TEXT,
  icon_url TEXT,
  sort_order INT DEFAULT 0,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- Table: delivery_rounds
CREATE TABLE delivery_rounds (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name VARCHAR(200) NOT NULL,
  description TEXT,
  scheduled_date DATE NOT NULL,
  pickup_location TEXT,
  status VARCHAR(50) DEFAULT 'scheduled',
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- Table: customers (FIX: Removed FK to auth.users to allow seed data without real users)
-- Added user_id column (nullable) for linking to auth.users when available
CREATE TABLE customers (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,  -- Nullable link to auth user
  full_name VARCHAR(255) NOT NULL,
  phone VARCHAR(20),
  email VARCHAR(255),
  address TEXT,
  loyalty_points INT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- Index on user_id for queries linking customers to auth users
CREATE INDEX IF NOT EXISTS idx_customers_user_id ON customers(user_id);

-- Table: products
CREATE TABLE products (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  category_id UUID REFERENCES product_categories(id) ON DELETE SET NULL,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  price DECIMAL(10, 2) NOT NULL,
  type product_type DEFAULT 'standard',
  image_url TEXT,
  is_available BOOLEAN DEFAULT TRUE,
  stock_count INT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- Table: orders
CREATE TABLE orders (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  customer_id UUID REFERENCES customers(id) ON DELETE SET NULL,
  delivery_round_id UUID REFERENCES delivery_rounds(id) ON DELETE SET NULL,
  total_amount DECIMAL(10, 2) NOT NULL,
  status order_status DEFAULT 'pending',
  payment_status payment_status DEFAULT 'pending',
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- Table: order_items
CREATE TABLE order_items (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  order_id UUID REFERENCES orders(id) ON DELETE CASCADE,
  product_id UUID REFERENCES products(id) ON DELETE RESTRICT,
  quantity INT NOT NULL CHECK (quantity > 0),
  unit_price DECIMAL(10, 2) NOT NULL,
  total_price DECIMAL(10, 2) GENERATED ALWAYS AS (quantity * unit_price) STORED,
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- Table: inventory (FIX #4+5: Add UNIQUE constraint for UPSERT support)
CREATE TABLE inventory (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  product_id UUID REFERENCES products(id) ON DELETE CASCADE,
  quantity INT NOT NULL DEFAULT 0 CHECK (quantity >= 0),
  updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (product_id)
);

-- Table: inventory_transactions
CREATE TABLE inventory_transactions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  inventory_id UUID REFERENCES inventory(id) ON DELETE CASCADE,
  type VARCHAR(50) NOT NULL CHECK (type IN ('stock_in', 'stock_out', 'adjustment')),
  quantity INT NOT NULL,
  reference_type VARCHAR(50),
  reference_id UUID,
  notes TEXT,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- Table: preorder_votes
CREATE TABLE preorder_votes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  customer_id UUID REFERENCES customers(id) ON DELETE CASCADE,
  product_id UUID REFERENCES products(id) ON DELETE CASCADE,
  vote_count INT DEFAULT 1,
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (customer_id, product_id)
);

-- Table: reviews
CREATE TABLE reviews (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  customer_id UUID REFERENCES customers(id) ON DELETE CASCADE,
  product_id UUID REFERENCES products(id) ON DELETE CASCADE,
  order_id UUID REFERENCES orders(id) ON DELETE SET NULL,
  rating INT NOT NULL CHECK (rating >= 1 AND rating <= 5),
  comment TEXT,
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (customer_id, product_id)
);

-- Table: loyalty_points
CREATE TABLE loyalty_points (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  customer_id UUID REFERENCES customers(id) ON DELETE CASCADE,
  points INT NOT NULL,
  status loyalty_status DEFAULT 'active',
  description TEXT,
  expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- Table: promotions
CREATE TABLE promotions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name VARCHAR(255) NOT NULL,
  description TEXT,
  discount_type VARCHAR(50) CHECK (discount_type IN ('percentage', 'fixed_amount')),
  discount_value DECIMAL(10, 2) NOT NULL,
  min_order_amount DECIMAL(10, 2) DEFAULT 0,
  start_date DATE,
  end_date DATE,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- Table: notifications
CREATE TABLE notifications (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  customer_id UUID REFERENCES customers(id) ON DELETE CASCADE,
  title VARCHAR(255) NOT NULL,
  message TEXT NOT NULL,
  is_read BOOLEAN DEFAULT FALSE,
  notification_type VARCHAR(50),
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- Table: ai_conversations
CREATE TABLE ai_conversations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  customer_id UUID REFERENCES customers(id) ON DELETE CASCADE,
  message TEXT NOT NULL,
  response TEXT,
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- Table: ai_recommendations
CREATE TABLE ai_recommendations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  customer_id UUID REFERENCES customers(id) ON DELETE CASCADE,
  product_id UUID REFERENCES products(id) ON DELETE SET NULL,
  reason TEXT,
  confidence_score DECIMAL(3, 2),
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- Triggers for updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_product_categories_updated_at
  BEFORE UPDATE ON product_categories
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_delivery_rounds_updated_at
  BEFORE UPDATE ON delivery_rounds
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_customers_updated_at
  BEFORE UPDATE ON customers
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_products_updated_at
  BEFORE UPDATE ON products
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_orders_updated_at
  BEFORE UPDATE ON orders
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Seed Data
INSERT INTO product_categories (name, description, sort_order) VALUES
  ('Custom Products', 'Custom made items tailored to your specifications', 1),
  ('Standard Products', 'Ready-made products available for immediate purchase', 2),
  ('Promotional Items', 'Special promotional merchandise', 3);

-- Seed data moved below with customer/fix blocks for better readability
INSERT INTO products (category_id, name, description, price, type) VALUES
  ((SELECT id FROM product_categories WHERE name = 'Custom Products'), 'Custom Mug', 'Personalized ceramic mug', 150.00, 'custom'),
  ((SELECT id FROM product_categories WHERE name = 'Standard Products'), 'Standard Tote Bag', 'Eco-friendly canvas tote', 250.00, 'standard'),
  ((SELECT id FROM product_categories WHERE name = 'Promotional Items'), 'Promotional Sticker Pack', 'Set of 10 stickers', 50.00, 'promotional');

-- FIX #3: Seed customer data (id is auto-generated, user_id is optional)
-- NOTE: To link customers to real auth users, update user_id column after creation:
--   UPDATE customers SET user_id = 'auth-user-uuid-here' WHERE id = 'customer-id-here';
INSERT INTO customers (full_name, phone, email, address, loyalty_points) VALUES
  ('สมชาย รักดี', '0812345678', 'somchai@example.com', '123 สุขสันต์ ซอย 1 กรุงเทพฯ 10100', 50),
  ('สมหญิง ดีใจ', '0898765432', 'somying@example.com', '456 ใหม่ ถนนเพชรบุรี กรุงเทพฯ 10400', 120);

-- Seed delivery rounds customers can reference
INSERT INTO delivery_rounds (name, scheduled_date, pickup_location) VALUES
  ('Week 1 Delivery', CURRENT_DATE + INTERVAL '7 days', 'Main Store'),
  ('Week 2 Delivery', CURRENT_DATE + INTERVAL '14 days', 'Main Store');

-- FIX #2: Seed inventory data (UPSERT to avoid duplicate key errors)
INSERT INTO inventory (product_id, quantity)
SELECT id, 100 FROM products
ON CONFLICT (product_id) DO UPDATE SET quantity = EXCLUDED.quantity;

-- Grant permissions
GRANT USAGE ON SCHEMA public TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO authenticated;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO authenticated;

-- Enable Row Level Security
ALTER TABLE product_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE delivery_rounds ENABLE ROW LEVEL SECURITY;
ALTER TABLE customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE products ENABLE ROW LEVEL SECURITY;
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE order_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE inventory ENABLE ROW LEVEL SECURITY;
ALTER TABLE inventory_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE preorder_votes ENABLE ROW LEVEL SECURITY;
ALTER TABLE reviews ENABLE ROW LEVEL SECURITY;
ALTER TABLE loyalty_points ENABLE ROW LEVEL SECURITY;
ALTER TABLE promotions ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_recommendations ENABLE ROW LEVEL SECURITY;

-- RLS Policies: product_categories (public read, admin write)
CREATE POLICY "product_categories_select" ON product_categories FOR SELECT TO authenticated USING (true);
CREATE POLICY "product_categories_insert" ON product_categories FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "product_categories_update" ON product_categories FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "product_categories_delete" ON product_categories FOR DELETE TO authenticated USING (true);

-- RLS Policies: delivery_rounds (public read, admin write)
CREATE POLICY "delivery_rounds_select" ON delivery_rounds FOR SELECT TO authenticated USING (true);
CREATE POLICY "delivery_rounds_insert" ON delivery_rounds FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "delivery_rounds_update" ON delivery_rounds FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "delivery_rounds_delete" ON delivery_rounds FOR DELETE TO authenticated USING (true);

-- RLS Policies: customers (own data only)
CREATE POLICY "customers_select_own" ON customers FOR SELECT TO authenticated USING (auth.uid() = id);
CREATE POLICY "customers_update_own" ON customers FOR UPDATE TO authenticated USING (auth.uid() = id) WITH CHECK (auth.uid() = id);

-- RLS Policies: products (public read)
CREATE POLICY "products_select" ON products FOR SELECT TO authenticated USING (true);
CREATE POLICY "products_insert" ON products FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "products_update" ON products FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "products_delete" ON products FOR DELETE TO authenticated USING (true);

-- RLS Policies: orders (own orders only - linked via customers.user_id)
CREATE POLICY "orders_select_own" ON orders FOR SELECT TO authenticated 
  USING (customer_id IN (SELECT id FROM customers WHERE user_id = auth.uid()));
CREATE POLICY "orders_insert_own" ON orders FOR INSERT TO authenticated 
  WITH CHECK (customer_id IN (SELECT id FROM customers WHERE user_id = auth.uid()));
CREATE POLICY "orders_update_own" ON orders FOR UPDATE TO authenticated 
  USING (customer_id IN (SELECT id FROM customers WHERE user_id = auth.uid())) 
  WITH CHECK (customer_id IN (SELECT id FROM customers WHERE user_id = auth.uid()));
CREATE POLICY "orders_delete_own" ON orders FOR DELETE TO authenticated 
  USING (customer_id IN (SELECT id FROM customers WHERE user_id = auth.uid()));

-- RLS Policies: order_items (FIX #7: Tied to customer's own orders for security)
CREATE POLICY "order_items_select" ON order_items FOR SELECT TO authenticated 
  USING (order_id IN (SELECT id FROM orders WHERE customer_id IN (SELECT id FROM customers WHERE user_id = auth.uid())));
CREATE POLICY "order_items_insert" ON order_items FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "order_items_update" ON order_items FOR UPDATE TO authenticated 
  USING (order_id IN (SELECT id FROM orders WHERE customer_id IN (SELECT id FROM customers WHERE user_id = auth.uid())))) 
  WITH CHECK (true);
CREATE POLICY "order_items_delete" ON order_items FOR DELETE TO authenticated 
  USING (order_id IN (SELECT id FROM orders WHERE customer_id IN (SELECT id FROM customers WHERE user_id = auth.uid())));

-- RLS Policies: inventory (admin only)
CREATE POLICY "inventory_select" ON inventory FOR SELECT TO authenticated USING (true);
CREATE POLICY "inventory_insert" ON inventory FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "inventory_update" ON inventory FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "inventory_delete" ON inventory FOR DELETE TO authenticated USING (true);

-- RLS Policies: inventory_transactions (audit trail)
CREATE POLICY "inventory_transactions_select" ON inventory_transactions FOR SELECT TO authenticated USING (true);
CREATE POLICY "inventory_transactions_insert" ON inventory_transactions FOR INSERT TO authenticated WITH CHECK (true);

-- RLS Policies: preorder_votes (own votes only)
CREATE POLICY "preorder_votes_select" ON preorder_votes FOR SELECT TO authenticated USING (true);
CREATE POLICY "preorder_votes_insert_own" ON preorder_votes FOR INSERT TO authenticated 
  WITH CHECK (customer_id IN (SELECT id FROM customers WHERE user_id = auth.uid()));
CREATE POLICY "preorder_votes_delete_own" ON preorder_votes FOR DELETE TO authenticated 
  USING (customer_id IN (SELECT id FROM customers WHERE user_id = auth.uid()));

-- RLS Policies: reviews (own reviews only)
CREATE POLICY "reviews_select" ON reviews FOR SELECT TO authenticated USING (true);
CREATE POLICY "reviews_insert_own" ON reviews FOR INSERT TO authenticated 
  WITH CHECK (customer_id IN (SELECT id FROM customers WHERE user_id = auth.uid()));
CREATE POLICY "reviews_update_own" ON reviews FOR UPDATE TO authenticated 
  USING (customer_id IN (SELECT id FROM customers WHERE user_id = auth.uid())) 
  WITH CHECK (customer_id IN (SELECT id FROM customers WHERE user_id = auth.uid()));
CREATE POLICY "reviews_delete_own" ON reviews FOR DELETE TO authenticated 
  USING (customer_id IN (SELECT id FROM customers WHERE user_id = auth.uid()));

-- RLS Policies: loyalty_points (own points only)
CREATE POLICY "loyalty_points_select_own" ON loyalty_points FOR SELECT TO authenticated 
  USING (customer_id IN (SELECT id FROM customers WHERE user_id = auth.uid()));
CREATE POLICY "loyalty_points_insert" ON loyalty_points FOR INSERT TO authenticated 
  WITH CHECK (customer_id IN (SELECT id FROM customers WHERE user_id = auth.uid()));
CREATE POLICY "loyalty_points_update" ON loyalty_points FOR UPDATE TO authenticated 
  USING (customer_id IN (SELECT id FROM customers WHERE user_id = auth.uid())) 
  WITH CHECK (customer_id IN (SELECT id FROM customers WHERE user_id = auth.uid()));

-- RLS Policies: promotions (public read)
CREATE POLICY "promotions_select" ON promotions FOR SELECT TO authenticated USING (true);
CREATE POLICY "promotions_insert" ON promotions FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "promotions_update" ON promotions FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "promotions_delete" ON promotions FOR DELETE TO authenticated USING (true);

-- RLS Policies: notifications (own notifications only)
CREATE POLICY "notifications_select_own" ON notifications FOR SELECT TO authenticated 
  USING (customer_id IN (SELECT id FROM customers WHERE user_id = auth.uid()));
CREATE POLICY "notifications_insert" ON notifications FOR INSERT TO authenticated 
  WITH CHECK (customer_id IN (SELECT id FROM customers WHERE user_id = auth.uid()));
CREATE POLICY "notifications_update_own" ON notifications FOR UPDATE TO authenticated 
  USING (customer_id IN (SELECT id FROM customers WHERE user_id = auth.uid())) 
  WITH CHECK (customer_id IN (SELECT id FROM customers WHERE user_id = auth.uid()));
CREATE POLICY "notifications_delete_own" ON notifications FOR DELETE TO authenticated 
  USING (customer_id IN (SELECT id FROM customers WHERE user_id = auth.uid()));

-- RLS Policies: ai_conversations (own conversations only)
CREATE POLICY "ai_conversations_select_own" ON ai_conversations FOR SELECT TO authenticated 
  USING (customer_id IN (SELECT id FROM customers WHERE user_id = auth.uid()));
CREATE POLICY "ai_conversations_insert_own" ON ai_conversations FOR INSERT TO authenticated 
  WITH CHECK (customer_id IN (SELECT id FROM customers WHERE user_id = auth.uid()));
CREATE POLICY "ai_conversations_delete_own" ON ai_conversations FOR DELETE TO authenticated 
  USING (customer_id IN (SELECT id FROM customers WHERE user_id = auth.uid()));

-- RLS Policies: ai_recommendations (own recommendations only)
CREATE POLICY "ai_recommendations_select_own" ON ai_recommendations FOR SELECT TO authenticated 
  USING (customer_id IN (SELECT id FROM customers WHERE user_id = auth.uid()));
CREATE POLICY "ai_recommendations_insert" ON ai_recommendations FOR INSERT TO authenticated 
  WITH CHECK (customer_id IN (SELECT id FROM customers WHERE user_id = auth.uid()));
CREATE POLICY "ai_recommendations_delete" ON ai_recommendations FOR DELETE TO authenticated USING (true);

-- Business Logic: Order Validation Function (ตรวจงานก่อนส่ง)
CREATE OR REPLACE FUNCTION validate_order_before_submit()
RETURNS TRIGGER AS $$
DECLARE
  v_order_items_total DECIMAL(10, 2);
BEGIN
  -- Check customer exists
  IF NOT EXISTS (SELECT 1 FROM customers WHERE id = NEW.customer_id) THEN
    RAISE EXCEPTION 'Customer not found';
  END IF;

  -- Calculate order total from items
  SELECT COALESCE(SUM(oi.unit_price * oi.quantity), 0)
  INTO v_order_items_total
  FROM order_items oi
  WHERE oi.order_id = NEW.id;

  -- Validate total matches items
  IF NEW.total_amount != v_order_items_total THEN
    RAISE EXCEPTION 'Order total does not match items total. Expected: %, Got: %', v_order_items_total, NEW.total_amount;
  END IF;

  -- Check delivery round is valid
  IF NEW.delivery_round_id IS NOT NULL THEN
    IF NOT EXISTS (SELECT 1 FROM delivery_rounds WHERE id = NEW.delivery_round_id) THEN
      RAISE EXCEPTION 'Delivery round not found';
    END IF;
  END IF;

  -- Set default status to pending
  IF NEW.status IS NULL THEN
    NEW.status = 'pending';
  END IF;

  -- Set default payment status to pending
  IF NEW.payment_status IS NULL THEN
    NEW.payment_status = 'pending';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Business Logic: Auto-Approve Order Function (อนุมัติอัตโนมัติ = ทำงานทั้งหมด)
CREATE OR REPLACE FUNCTION auto_approve_order()
RETURNS TRIGGER AS $$
DECLARE
  v_order_items_total DECIMAL(10, 2);
  v_loyalty_points INT;
  v_item RECORD;
BEGIN
  -- Auto-approve orders with status 'pending'
  IF NEW.status = 'pending' THEN
    -- Step 1: Calculate total and award loyalty points
    SELECT COALESCE(SUM(oi.unit_price * oi.quantity), 0)
    INTO v_order_items_total
    FROM order_items oi
    WHERE oi.order_id = NEW.id;

    -- Award loyalty points (1 point per 10 THB)
    v_loyalty_points := (v_order_items_total / 10)::INT;

    -- Step 2: Update order status and payment
    NEW.status := 'confirmed';
    NEW.payment_status := 'paid';
    NEW.updated_at := CURRENT_TIMESTAMP;

    -- Step 3: Deduct inventory for each item
    FOR v_item IN SELECT oi.product_id, oi.quantity
                  FROM order_items oi
                  WHERE oi.order_id = NEW.id
    LOOP
      -- Check if product exists and is available
      IF NOT EXISTS (SELECT 1 FROM products p WHERE p.id = v_item.product_id AND p.is_available = TRUE) THEN
        RAISE EXCEPTION 'Product % is not available', v_item.product_id;
      END IF;

      -- FIX #4: Deduct inventory using UPSERT (handles missing records)
      INSERT INTO inventory (product_id, quantity)
        VALUES (v_item.product_id, (SELECT COALESCE(quantity, 0) - v_item.quantity FROM inventory WHERE product_id = v_item.product_id))
      ON CONFLICT (product_id) DO UPDATE SET
        quantity = GREATEST(0, inventory.quantity - v_item.quantity),
        updated_at = CURRENT_TIMESTAMP;

      -- Log inventory transaction (stock_out)
      INSERT INTO inventory_transactions (inventory_id, type, quantity, reference_type, reference_id, notes, created_by)
      SELECT i.id, 'stock_out', v_item.quantity, 'order', NEW.id, 'Auto-approved order', auth.uid()
      FROM inventory i
      WHERE i.product_id = v_item.product_id;
    END LOOP;

    -- Step 4: Award loyalty points
    IF v_loyalty_points > 0 THEN
      INSERT INTO loyalty_points (customer_id, points, description, status)
      VALUES (NEW.customer_id, v_loyalty_points, 'Order completed - ' || v_loyalty_points || ' points earned', 'active');
    END IF;

    -- Step 5: Send confirmation notification
    INSERT INTO notifications (customer_id, title, message, notification_type)
    VALUES (
      NEW.customer_id,
      'Order Confirmed!',
      'Your order #' || NEW.id || ' has been confirmed and paid. Total: ' || v_order_items_total || ' THB. You earned ' || v_loyalty_points || ' loyalty points!',
      'order_confirmed'
    );

    -- Step 6: Send preparation notification
    INSERT INTO notifications (customer_id, title, message, notification_type)
    VALUES (
      NEW.customer_id,
      'Order Preparing',
      'Your order is being prepared. We will notify you when it is ready for pickup!',
      'order_preparing'
    );

  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Business Logic: Update Order Status Function (จัดการสถานะแบบ Manual - Admin เปลี่ยนเอง)
-- auto_approve_order() จะทำงานอัตโนมัติเมื่อ create order ใหม่
-- ฟังก์ชันนี้ใช้สำหรับ Admin เปลี่ยน status เอง (เช่น mark as ready_for_pickup, completed, cancelled)
CREATE OR REPLACE FUNCTION update_order_status()
RETURNS TRIGGER AS $$
BEGIN
  -- Only handle manual status changes (not auto-approved)
  IF OLD.status = 'confirmed' AND NEW.status = 'confirmed' THEN
    -- Status didn't change, just update timestamp
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
  END IF;

  -- Handle status transitions (manual changes by admin)
  IF NEW.status = 'ready_for_pickup' AND OLD.status != 'ready_for_pickup' THEN
    INSERT INTO notifications (customer_id, title, message, notification_type)
    VALUES (NEW.customer_id, 'Order Ready!', 'Your order is ready for pickup! Please come to the store.', 'order_ready');
  END IF;

  IF NEW.status = 'picked_up' AND OLD.status != 'picked_up' THEN
    INSERT INTO notifications (customer_id, title, message, notification_type)
    VALUES (NEW.customer_id, 'Order Picked Up', 'Thank you! We hope you enjoyed your purchase.', 'order_picked_up');
  END IF;

  IF NEW.status = 'completed' AND OLD.status != 'completed' THEN
    INSERT INTO notifications (customer_id, title, message, notification_type)
    VALUES (NEW.customer_id, 'Order Completed!', 'Thank you for your purchase! You earned loyalty points.', 'order_completed');
  END IF;

  IF NEW.status = 'cancelled' AND OLD.status != 'cancelled' THEN
    NEW.payment_status = 'refunded';

    -- Restore inventory (FIX #5: Use UPSERT pattern to handle missing records)
    INSERT INTO inventory (product_id, quantity)
    SELECT oi.product_id, (SELECT COALESCE(quantity, 0) + oi.quantity FROM inventory WHERE product_id = oi.product_id)
    FROM order_items oi
    WHERE oi.order_id = NEW.id
    ON CONFLICT (product_id) DO UPDATE SET
      quantity = inventory.quantity + EXCLUDED.quantity,
      updated_at = CURRENT_TIMESTAMP;

    -- Log inventory transaction (stock_in)
    INSERT INTO inventory_transactions (inventory_id, type, quantity, reference_type, reference_id, notes, created_by)
    SELECT i.id, 'stock_in', inv_add.quantity, 'order_cancel', NEW.id, 'Order cancelled - inventory restored', auth.uid()
    FROM (
      SELECT oi.product_id, oi.quantity as quantity
      FROM order_items oi
      WHERE oi.order_id = NEW.id
    ) inv_add
    JOIN inventory i ON i.product_id = inv_add.product_id;

    INSERT INTO notifications (customer_id, title, message, notification_type)
    VALUES (NEW.customer_id, 'Order Cancelled', 'Your order has been cancelled and refunded.', 'order_cancelled');
  END IF;

  NEW.updated_at = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Business Logic: Check Product Availability Function
CREATE OR REPLACE FUNCTION check_product_availability(p_product_id UUID)
RETURNS BOOLEAN AS $$
DECLARE
  v_stock INT;
BEGIN
  SELECT COALESCE(i.quantity, 0) INTO v_stock
  FROM inventory i
  WHERE i.product_id = p_product_id;

  RETURN EXISTS (
    SELECT 1 FROM products p
    WHERE p.id = p_product_id
    AND p.is_available = TRUE
    AND (v_stock IS NULL OR v_stock > 0)
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Business Logic: Calculate Loyalty Points Function
CREATE OR REPLACE FUNCTION calculate_loyalty_points(p_order_total DECIMAL(10, 2))
RETURNS INT AS $$
BEGIN
  RETURN (p_order_total / 10)::INT;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Triggers for Business Logic
CREATE TRIGGER validate_order_before_submit_trigger
  BEFORE INSERT ON orders
  FOR EACH ROW EXECUTE FUNCTION validate_order_before_submit();

CREATE TRIGGER auto_approve_order_trigger
  AFTER INSERT ON orders
  FOR EACH ROW EXECUTE FUNCTION auto_approve_order();

CREATE TRIGGER update_order_status_trigger
  BEFORE UPDATE ON orders
  FOR EACH ROW EXECUTE FUNCTION update_order_status();

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_orders_customer_id ON orders(customer_id);
CREATE INDEX IF NOT EXISTS idx_orders_delivery_round_id ON orders(delivery_round_id);
CREATE INDEX IF NOT EXISTS idx_order_items_order_id ON order_items(order_id);
CREATE INDEX IF NOT EXISTS idx_order_items_product_id ON order_items(product_id);
CREATE INDEX IF NOT EXISTS idx_inventory_product_id ON inventory(product_id);
CREATE INDEX IF NOT EXISTS idx_preorder_votes_customer_product ON preorder_votes(customer_id, product_id);
CREATE INDEX IF NOT EXISTS idx_reviews_customer_product ON reviews(customer_id, product_id);
CREATE INDEX IF NOT EXISTS idx_notifications_customer ON notifications(customer_id);
CREATE INDEX IF NOT EXISTS idx_ai_conversations_customer ON ai_conversations(customer_id);
CREATE INDEX IF NOT EXISTS idx_ai_recommendations_customer ON ai_recommendations(customer_id);

-- Create full-text search index for products
CREATE INDEX IF NOT EXISTS idx_products_name_trgm ON products USING gin (name gin_trgm_ops);

-- FIX #8: Add missing indexes for performance
CREATE INDEX IF NOT EXISTS idx_products_category_id ON products(category_id);
CREATE INDEX IF NOT EXISTS idx_orders_total_amount ON orders(total_amount);
CREATE INDEX IF NOT EXISTS idx_loyalty_points_customer_id ON loyalty_points(customer_id);