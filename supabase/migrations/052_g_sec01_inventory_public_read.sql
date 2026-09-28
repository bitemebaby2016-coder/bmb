-- ============================================
-- 052_g_sec01_inventory_public_read.sql
-- STEP 3A / G-SEC-01 — P0 SECURITY CLOSURE
-- ============================================
-- Finding (G-SEC-01): anonymous/public SELECT access to `inventory` via
--   POLICY inventory_public_read ON inventory FOR SELECT TO anon, authenticated USING (true)
-- exposes internal operational data: current_stock / min_stock / max_stock /
-- unit_price / supplier_name / supplier_phone / status / last_restocked_at.
--
-- Fix: DROP ONLY the permissive public-read policy.
--   • inventory_admin_manage (ALL, authenticated, USING(is_admin()))  → PRESERVED
--     (Admin read + mutation of inventory keep working through RLS.)
--   • inventory_anon_read (SELECT, anon, USING(false))                → PRESERVED
--     (defensive deny; harmless.)
--   • No legitimate public/customer workflow reads `inventory` directly
--     (verified: every `from('inventory')` in source is the Admin InventoryPage;
--       customer/menu surfaces read `products`, not `inventory`).
--   • Backend inventory RPCs are SECURITY DEFINER + admin-guarded
--     (get_inventory_requirements / list_recipes_with_inventory /
--       deduct_inventory_for_order / restore_inventory_for_order /
--       ensure_inventory_deducted_on_confirm) → bypass RLS; unaffected.
--
-- Scope: security-only. No schema / data / feature / order-spine change.
-- Reversible in principle:
--   CREATE POLICY inventory_public_read ON public.inventory
--     FOR SELECT TO anon, authenticated USING (true);
--   (Re-establishing the OPEN policy is deliberately NOT recommended; use a
--     scoped authenticated/admin policy instead if a future need arises.)
-- ============================================

DROP POLICY IF EXISTS inventory_public_read ON public.inventory;

COMMIT;