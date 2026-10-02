-- REPLAY ALIGNMENT PATCH (ISOLATED LOCAL ONLY)
-- Aligns replay schema with verified production state for objects that exist
-- in production but are not produced by the repo migration files (manual
-- production-side actions, EXPLAINED HISTORICAL), and removes replay-only
-- policies that production does not have.
DROP POLICY IF EXISTS _mg_adm ON public.addon_groups;
DROP POLICY IF EXISTS _mg_adm ON public.addons;
DROP POLICY IF EXISTS _mg_adm ON public.product_addon_groups;
DROP POLICY IF EXISTS "Users can view own profile" ON public.profiles;
CREATE POLICY "Users can view own profile" ON public.profiles
  FOR SELECT TO public
  USING (auth.uid() = id);
