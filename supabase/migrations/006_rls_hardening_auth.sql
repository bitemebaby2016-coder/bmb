-- ============================================
-- Bite Me Baby — Migration 006: RLS Hardening + Auth Foundation
-- Date: 2026-09-18
-- Phase: B-B (P0 security foundation)
--
-- Fixes (อ้างอิง DATABASE_SECURITY_AUDIT.md / RLS_MATRIX.md):
--   B7  profiles role escalation (own UPDATE role guard)
--   B8  p_public_all_* ยังเป็น permissive ทั้ง 18 ตาราง
--   B9  orders/pre_orders anon read overbroad (OR phone / OR name)
--   IS-1 is_admin() ไม่มี SET search_path
--   P0-2/3 Supabase Auth hooks: auto-create profile + role trigger
--
-- NOTE (สำคัญ): 001/003 สร้าง `p_public_all_*` policies ไว้ และ 005
--   DROP เฉพาะ policy ชื่อใหม่ (orders_anon_read ฯลฯ) แต่**ไม่ได้ DROP**
--   `p_public_all_*` เดิม → policies เก่ายัง active อยู่คู่กับ 005
--   = ทุกตารางยังเปิด permissive เหมือนเดิม (เพราะ policy OR-union)
--   → 006 ต้อง DROP `p_public_all_*` ทั้งหมดก่อน policy ใหม่จะมีผล
--
-- Idempotent: safe to re-run.
-- ============================================

BEGIN;

-- ============================================
-- 0. Hardening: is_admin() ด้วย SET search_path
-- ============================================
CREATE OR REPLACE FUNCTION is_admin()
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin'
  );
END;
$$;

-- ============================================
-- 1. DROP ALL legacy permissive policies (001/003)
--    รวมทุกตารางที่เคยมี `p_public_all_*`
-- ============================================
DO $$
DECLARE t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'product_categories', 'delivery_rounds', 'products', 'customers', 'orders',
    'order_items', 'inventory', 'inventory_transactions', 'preorder_votes',
    'reviews', 'pre_orders', 'loyalty_points', 'promotions', 'notifications',
    'ai_conversations', 'ai_recommendations', 'profiles', 'payment_intents'
  ] LOOP
    EXECUTE format('DROP POLICY IF EXISTS p_public_all_%I ON %I', t, t);
  END LOOP;
END $$;

-- ============================================
-- 1.4 Ensure identity columns policies ใช้มีจริง (idempotent)
--     orders.customer_ref / customers.user_id มีใน 001 แล้ว แต่
--     pre_orders ยังไม่มี customer_ref → เพิ่มถ้ายังไม่มี (re-run safe)
-- ============================================
ALTER TABLE pre_orders ADD COLUMN IF NOT EXISTS customer_ref UUID REFERENCES auth.users(id) ON DELETE SET NULL;
ALTER TABLE customers ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL;
ALTER TABLE orders   ADD COLUMN IF NOT EXISTS customer_ref UUID REFERENCES auth.users(id) ON DELETE SET NULL;

-- ============================================
-- 2. SUPABASE AUTH — auto-create profile on signup
--    (profiles.id = auth.uid(); role ล็อก customer ที่ signup)
-- ============================================
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_phone TEXT;
BEGIN
  v_phone := NULLIF(COALESCE(NEW.phone, NEW.raw_user_meta_data->>'phone', ''), '');
  INSERT INTO public.profiles (id, email, phone, name, role, is_active)
  VALUES (
    NEW.id,
    NULLIF(NEW.email, ''),
    v_phone,
    NULLIF(COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name', ''), ''),
    'customer',
    true
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ============================================
-- 3. ROLE ESCALATION GUARD (fix B7)
--    ห้าม user แก้ role ตัวเอง / ปิดใช้งานตัวเอง ยกเว้น admin
-- ============================================
CREATE OR REPLACE FUNCTION public.guard_profile_mutation()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- ห้ามเปลี่ยน role / is_active / id / email/phone ของตัวเองโดยไม่ใช่ admin
  IF NOT public.is_admin() THEN
    IF NEW.role IS DISTINCT FROM OLD.role THEN
      RAISE EXCEPTION 'FORBIDDEN: changing role requires admin';
    END IF;
    IF NEW.is_active IS DISTINCT FROM OLD.is_active THEN
      RAISE EXCEPTION 'FORBIDDEN: changing is_active requires admin';
    END IF;
    IF NEW.id IS DISTINCT FROM OLD.id THEN
      RAISE EXCEPTION 'FORBIDDEN: changing id requires admin';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS profiles_guard_mutation ON profiles;
CREATE TRIGGER profiles_guard_mutation
  BEFORE UPDATE ON profiles
  FOR EACH ROW EXECUTE FUNCTION public.guard_profile_mutation();

-- ============================================
-- 4. RLS POLICIES ใหม่ทั้งหมด (หลัง DROP p_public_all_*)
-- ============================================

-- --------------------------------------------
-- 4.1 products / product_categories
-- 005 สร้าง products_public_read + products_admin_manage ไว้แล้ว
-- และ p_public_all_products ถูก drop ในส่วน 1 → 005 policies มีผลจริง
-- (ไม่มี action เพิ่ม — คงไว้)

-- --------------------------------------------
-- 4.2 delivery_rounds: public read เฉพาะ active; admin manage
-- --------------------------------------------
DROP POLICY IF EXISTS delivery_rounds_public_read ON delivery_rounds;
CREATE POLICY delivery_rounds_public_read ON delivery_rounds
  FOR SELECT TO anon, authenticated
  USING (status = 'active');

DROP POLICY IF EXISTS delivery_rounds_admin_manage ON delivery_rounds;
CREATE POLICY delivery_rounds_admin_manage ON delivery_rounds
  FOR ALL TO authenticated
  USING (is_admin())
  WITH CHECK (is_admin());

-- --------------------------------------------
-- 4.3 customers: anon DENY; auth read own (user_id); admin manage
-- --------------------------------------------
DROP POLICY IF EXISTS customers_anon ON customers;
CREATE POLICY customers_anon ON customers
  FOR ALL TO anon USING (false);

DROP POLICY IF EXISTS customers_own_read ON customers;
CREATE POLICY customers_own_read ON customers
  FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR is_admin());

DROP POLICY IF EXISTS customers_admin_manage ON customers;
CREATE POLICY customers_admin_manage ON customers
  FOR ALL TO authenticated
  USING (is_admin())
  WITH CHECK (is_admin());

-- --------------------------------------------
-- 4.4 orders: anon read เฉพาะ delivered/cancelled; auth own CRUD; admin
-- --------------------------------------------
DROP POLICY IF EXISTS orders_anon_read ON orders;
CREATE POLICY orders_anon_read ON orders
  FOR SELECT TO anon
  USING (status IN ('delivered', 'cancelled'));

DROP POLICY IF EXISTS orders_own_read ON orders;
CREATE POLICY orders_own_read ON orders
  FOR SELECT TO authenticated
  USING (customer_ref = auth.uid() OR is_admin());

DROP POLICY IF EXISTS orders_own_create ON orders;
CREATE POLICY orders_own_create ON orders
  FOR INSERT TO authenticated
  WITH CHECK (customer_ref = auth.uid());

DROP POLICY IF EXISTS orders_own_update ON orders;
CREATE POLICY orders_own_update ON orders
  FOR UPDATE TO authenticated
  USING (false);  -- customer ไม่ได้แก้ order ผ่าน SQL ตรง;
                  -- ย้ายไป RPC/EF (Phase C state machine) เมื่อพร้อม
                  -- ว่า policy จะ pass เพื่อ role block ผิด docs

DROP POLICY IF EXISTS orders_admin_manage ON orders;
CREATE POLICY orders_admin_manage ON orders
  FOR ALL TO authenticated
  USING (is_admin())
  WITH CHECK (is_admin());

-- --------------------------------------------
-- 4.5 order_items: anon DENY; auth own (via orders); admin
-- --------------------------------------------
DROP POLICY IF EXISTS order_items_anon ON order_items;
CREATE POLICY order_items_anon ON order_items
  FOR ALL TO anon USING (false);

DROP POLICY IF EXISTS order_items_own ON order_items;
CREATE POLICY order_items_own ON order_items
  FOR ALL TO authenticated
  USING (order_id IN (SELECT id FROM orders WHERE customer_ref = auth.uid()))
  WITH CHECK (order_id IN (SELECT id FROM orders WHERE customer_ref = auth.uid()));

DROP POLICY IF EXISTS order_items_admin ON order_items;
CREATE POLICY order_items_admin ON order_items
  FOR ALL TO authenticated
  USING (is_admin())
  WITH CHECK (is_admin());

-- --------------------------------------------
-- 4.6 pre_orders: anon DENY (แก้ overbroad); auth own; admin
-- --------------------------------------------
DROP POLICY IF EXISTS pre_orders_anon_read ON pre_orders;
CREATE POLICY pre_orders_anon_read ON pre_orders
  FOR SELECT TO anon
  USING (false);

DROP POLICY IF EXISTS pre_orders_own ON pre_orders;
CREATE POLICY pre_orders_own ON pre_orders
  FOR ALL TO authenticated
  USING (customer_ref = auth.uid() OR is_admin())
  WITH CHECK (customer_ref = auth.uid() OR is_admin());

DROP POLICY IF EXISTS pre_orders_admin ON pre_orders;
CREATE POLICY pre_orders_admin ON pre_orders
  FOR ALL TO authenticated
  USING (is_admin())
  WITH CHECK (is_admin());

-- --------------------------------------------
-- 4.7 payment_intents: anon DENY; auth own; admin
-- --------------------------------------------
DROP POLICY IF EXISTS payment_intents_anon ON payment_intents;
CREATE POLICY payment_intents_anon ON payment_intents
  FOR ALL TO anon USING (false);

DROP POLICY IF EXISTS payment_intents_own ON payment_intents;
CREATE POLICY payment_intents_own ON payment_intents
  FOR SELECT TO authenticated
  USING (order_number IN (SELECT order_number FROM orders WHERE customer_ref = auth.uid()));

DROP POLICY IF EXISTS payment_intents_own_create ON payment_intents;
CREATE POLICY payment_intents_own_create ON payment_intents
  FOR INSERT TO authenticated
  WITH CHECK (order_number IN (SELECT order_number FROM orders WHERE customer_ref = auth.uid()));

DROP POLICY IF EXISTS payment_intents_admin ON payment_intents;
CREATE POLICY payment_intents_admin ON payment_intents
  FOR ALL TO authenticated
  USING (is_admin())
  WITH CHECK (is_admin());

-- --------------------------------------------
-- 4.8 profiles: public อ่านผ่าน VIEW (จำกัด field) เท่านั้น
--     anon ไม่เห็น email/phone/role โดยตรง
-- --------------------------------------------
DROP VIEW IF EXISTS public_profiles;
CREATE VIEW public_profiles AS
  SELECT id, name, avatar_url, created_at
  FROM profiles;

-- revoke direct SELECT (anon) จาก profiles
REVOKE SELECT ON profiles FROM anon;
GRANT SELECT ON public_profiles TO anon, authenticated;

DROP POLICY IF EXISTS profiles_public_read ON profiles;
CREATE POLICY profiles_public_read ON profiles
  FOR SELECT TO authenticated, anon
  USING (true);  -- anon ยังสามารถ SELECT ผ่าน view ได้ (ไม่มี direct grant)

DROP POLICY IF EXISTS profiles_own_read_limited ON profiles;
CREATE POLICY profiles_own_read_limited ON profiles
  FOR SELECT TO authenticated
  USING (auth.uid() = id);  -- เปิดให้อ่านของตัวเอง (email/phone/role ผ่าน own read)

DROP POLICY IF EXISTS profiles_own_write ON profiles;
CREATE POLICY profiles_own_write ON profiles
  FOR UPDATE TO authenticated
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);  -- role/is_active ถูก block โดย guard trigger

DROP POLICY IF EXISTS profiles_admin_manage ON profiles;
CREATE POLICY profiles_admin_manage ON profiles
  FOR ALL TO authenticated
  USING (is_admin())
  WITH CHECK (is_admin());

-- --------------------------------------------
-- 4.9 reviews: public read (verified) + auth insert own; admin manage
-- --------------------------------------------
DROP POLICY IF EXISTS reviews_public_read ON reviews;
CREATE POLICY reviews_public_read ON reviews
  FOR SELECT TO anon, authenticated
  USING (is_verified = true OR is_admin());

DROP POLICY IF EXISTS reviews_own_insert ON reviews;
CREATE POLICY reviews_own_insert ON reviews
  FOR INSERT TO authenticated
  WITH CHECK (customer_id = auth.uid()::text OR customer_id IS NULL OR is_admin());

DROP POLICY IF EXISTS reviews_own_update ON reviews;
CREATE POLICY reviews_own_update ON reviews
  FOR UPDATE TO authenticated
  USING (customer_id = auth.uid()::text OR is_admin())
  WITH CHECK (customer_id = auth.uid()::text OR is_admin());

DROP POLICY IF EXISTS reviews_admin_manage ON reviews;
CREATE POLICY reviews_admin_manage ON reviews
  FOR ALL TO authenticated
  USING (is_admin())
  WITH CHECK (is_admin());

-- --------------------------------------------
-- 4.10 promotions: public read (active) + admin manage
-- --------------------------------------------
DROP POLICY IF EXISTS promotions_public_read ON promotions;
CREATE POLICY promotions_public_read ON promotions
  FOR SELECT TO anon, authenticated
  USING (is_active = true);

DROP POLICY IF EXISTS promotions_admin_manage ON promotions;
CREATE POLICY promotions_admin_manage ON promotions
  FOR ALL TO authenticated
  USING (is_admin())
  WITH CHECK (is_admin());

-- --------------------------------------------
-- 4.11 notifications: auth own (via customers.user_id); admin
-- --------------------------------------------
DROP POLICY IF EXISTS notifications_anon ON notifications;
CREATE POLICY notifications_anon ON notifications
  FOR ALL TO anon USING (false);

DROP POLICY IF EXISTS notifications_own_read ON notifications;
CREATE POLICY notifications_own_read ON notifications
  FOR SELECT TO authenticated
  USING (customer_id IN (SELECT id FROM customers WHERE user_id = auth.uid()) OR is_admin());

DROP POLICY IF EXISTS notifications_own_update ON notifications;
CREATE POLICY notifications_own_update ON notifications
  FOR UPDATE TO authenticated
  USING (customer_id IN (SELECT id FROM customers WHERE user_id = auth.uid()))
  WITH CHECK (customer_id IN (SELECT id FROM customers WHERE user_id = auth.uid()));

DROP POLICY IF EXISTS notifications_admin ON notifications;
CREATE POLICY notifications_admin ON notifications
  FOR ALL TO authenticated
  USING (is_admin())
  WITH CHECK (is_admin());

-- --------------------------------------------
-- 4.12 loyalty_points: auth own; admin
-- --------------------------------------------
DROP POLICY IF EXISTS loyalty_points_anon ON loyalty_points;
CREATE POLICY loyalty_points_anon ON loyalty_points
  FOR ALL TO anon USING (false);

DROP POLICY IF EXISTS loyalty_points_own_read ON loyalty_points;
CREATE POLICY loyalty_points_own_read ON loyalty_points
  FOR SELECT TO authenticated
  USING (customer_id IN (SELECT id FROM customers WHERE user_id = auth.uid()) OR is_admin());

DROP POLICY IF EXISTS loyalty_points_admin ON loyalty_points;
CREATE POLICY loyalty_points_admin ON loyalty_points
  FOR ALL TO authenticated
  USING (is_admin())
  WITH CHECK (is_admin());

-- --------------------------------------------
-- 4.13 preorder_votes: anon vote allowed (public poll); admin
-- --------------------------------------------
DROP POLICY IF EXISTS preorder_votes_anon ON preorder_votes;
CREATE POLICY preorder_votes_anon ON preorder_votes
  FOR INSERT TO anon, authenticated
  WITH CHECK (true);  -- poll votes are intentionally public-contributed

DROP POLICY IF EXISTS preorder_votes_public_read ON preorder_votes;
CREATE POLICY preorder_votes_public_read ON preorder_votes
  FOR SELECT TO anon, authenticated
  USING (true);

DROP POLICY IF EXISTS preorder_votes_admin ON preorder_votes;
CREATE POLICY preorder_votes_admin ON preorder_votes
  FOR ALL TO authenticated
  USING (is_admin())
  WITH CHECK (is_admin());

-- --------------------------------------------
-- 4.14 inventory: anon DENY (ห้ามอ่าน supplier/ต้นทุน); auth own via RPC; admin
-- --------------------------------------------
DROP POLICY IF EXISTS inventory_anon_read ON inventory;
CREATE POLICY inventory_anon_read ON inventory
  FOR SELECT TO anon USING (false);

DROP POLICY IF EXISTS inventory_admin_manage ON inventory;
CREATE POLICY inventory_admin_manage ON inventory
  FOR ALL TO authenticated
  USING (is_admin())
  WITH CHECK (is_admin());

-- --------------------------------------------
-- 4.15 inventory_transactions: admin only
-- --------------------------------------------
DROP POLICY IF EXISTS inventory_transactions_anon ON inventory_transactions;
CREATE POLICY inventory_transactions_anon ON inventory_transactions
  FOR ALL TO anon USING (false);

DROP POLICY IF EXISTS inventory_transactions_admin ON inventory_transactions;
CREATE POLICY inventory_transactions_admin ON inventory_transactions
  FOR ALL TO authenticated
  USING (is_admin())
  WITH CHECK (is_admin());

-- --------------------------------------------
-- 4.16 ai_conversations / ai_recommendations: auth own; admin
-- --------------------------------------------
DROP POLICY IF EXISTS ai_conversations_anon ON ai_conversations;
CREATE POLICY ai_conversations_anon ON ai_conversations
  FOR ALL TO anon USING (false);

DROP POLICY IF EXISTS ai_conversations_own ON ai_conversations;
CREATE POLICY ai_conversations_own ON ai_conversations
  FOR ALL TO authenticated
  USING (customer_id IN (SELECT id FROM customers WHERE user_id = auth.uid()) OR is_admin())
  WITH CHECK (customer_id IN (SELECT id FROM customers WHERE user_id = auth.uid()) OR is_admin());

DROP POLICY IF EXISTS ai_conversations_admin ON ai_conversations;
CREATE POLICY ai_conversations_admin ON ai_conversations
  FOR ALL TO authenticated
  USING (is_admin())
  WITH CHECK (is_admin());

DROP POLICY IF EXISTS ai_recommendations_anon ON ai_recommendations;
CREATE POLICY ai_recommendations_anon ON ai_recommendations
  FOR ALL TO anon USING (false);

DROP POLICY IF EXISTS ai_recommendations_own ON ai_recommendations;
CREATE POLICY ai_recommendations_own ON ai_recommendations
  FOR ALL TO authenticated
  USING (customer_id IN (SELECT id FROM customers WHERE user_id = auth.uid()) OR is_admin())
  WITH CHECK (customer_id IN (SELECT id FROM customers WHERE user_id = auth.uid()) OR is_admin());

DROP POLICY IF EXISTS ai_recommendations_admin ON ai_recommendations;
CREATE POLICY ai_recommendations_admin ON ai_recommendations
  FOR ALL TO authenticated
  USING (is_admin())
  WITH CHECK (is_admin());

-- ============================================
-- 5. CAPACITY — decrement on cancel/fail (fix P1-1 direction)
-- ============================================
CREATE OR REPLACE FUNCTION public.decrement_delivery_round_count()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.status IN ('cancelled', 'failed') AND OLD.status NOT IN ('cancelled', 'failed') THEN
    IF OLD.delivery_round_id IS NOT NULL THEN
      UPDATE delivery_rounds
        SET current_count = GREATEST(0, current_count - 1)
        WHERE id = OLD.delivery_round_id;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS orders_decrement_round ON orders;
CREATE TRIGGER orders_decrement_round
  AFTER UPDATE OF status ON orders
  FOR EACH ROW EXECUTE FUNCTION public.decrement_delivery_round_count();

-- ============================================
-- 6. GRANTS (secure posture — จำกัด anon ตามความจำเป็น)
-- ============================================
-- anon: อ่านได้เฉพาะตารางที่ต้องแสดงสู่สาธารณะ
REVOKE ALL ON ALL TABLES IN SCHEMA public FROM anon;
REVOKE ALL ON ALL TABLES IN SCHEMA public FROM authenticated;
GRANT USAGE ON SCHEMA public TO anon, authenticated;
GRANT SELECT ON products, product_categories, delivery_rounds, reviews, promotions, preorder_votes, orders TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO authenticated;

-- ============================================
-- 7. DONE
-- ============================================
COMMIT;

-- ============================================
-- END OF MIGRATION 006 — RLS HARDENING + AUTH FOUNDATION
-- ============================================