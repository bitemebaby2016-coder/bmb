-- ============================================
-- Bite Me Baby Migration 157: B-6 — anon policy role scoping
-- Date: 2026-10-26 · Source: W-2 legacy-contract work (contracts_033 G5d) + production probes
--
-- PROBLEM (evidence-backed, ตรวจทั้ง production และ fresh replay):
--   * 129 ทำ 2 อย่างพร้อมกัน: (a) REVOKE EXECUTE ของ is_staff() FROM PUBLIC, anon
--     (b) CREATE POLICY *_staff_select ... USING (public.is_staff()) โดย "ไม่ระบุ TO role"
--     → policy นั้นมีบทบาท PUBLIC = รวม anon อยู่ในกลุ่มที่ต้องประเมิน
--   * เมื่อ PostgREST ยิงด้วยบทบาท anon (ผู้ชมที่ยังไม่ล็อกอิน) PostgreSQL ต้องประเมิน
--     is_staff() แต่ anon ไม่มีสิทธิ์ EXECUTE → 42501 "permission denied for function is_staff"
--     → ทั้ง statement ล้มเหลว (ไม่ใช่แค่ row ถูกกรอง) → guest เห็นเมนูว่าง
--   * หลักฐาน production: e2e/w2_guest_menu_probe.cjs (เปิด https://biteme-baby.com/menu
--     จริงด้วย Playwright = 401 ทุก /rest/v1/products · product_categories · delivery_rounds ·
--     business_settings · menu_schedule + console "permission denied for function is_staff")
--     และ e2e/w2_b6_policies.sql (19 policy ที่ anon ต้องประเมินแต่เรียก helper)
--
-- FIX (ไม่ลดทอนสิทธิ์ของ anyone ที่ควรเข้าถึงได้):
--   * policy ใดก็ตามที่ "มองเห็นโดย anon/public" และ "เรียก helper is_*()" → สร้างใหม่โดย
--     ตัด anon/public ออก เหลือ authenticated + service_role (แอดมิน/สตาฟฟ์ยังเข้าถึงเหมือนเดิม)
--   * อ่านแบบสาธารณะ (anon) ยังอยู่ครบผ่าน policy ที่ไม่เรียก helper เช่น
--     products_public_read · mascots_public_read_v2 · media_assets_public_read ·
--     admins_full_access/public_read_active (admin_portfolio_items) — ยกเว้น reviews ที่
--     public read ผูกกับ is_admin() → แยก policy ใหม่ให้ anon อ่านได้เฉพาะแถว is_verified
--   * fail-closed: ถ้าจบ DO block แล้วยังมี policy ที่ anon มองเห็นและเรียก helper → RAISE
--
-- RLS: ไม่มีการ disable RLS · ไม่มีการเพิ่มสิทธิ์ GRANT ใหม่ · แค่จำกัดบทบาทของ policy
-- ============================================

BEGIN;

DO $mig157$
DECLARE
  pol record;
  v_new text;
  v_fixed int := 0;
BEGIN
  FOR pol IN
    SELECT policyname, tablename, permissive, cmd,
           roles::text[] AS roles, qual, COALESCE(with_check, '') AS with_check
    FROM pg_policies
    WHERE schemaname = 'public'
      AND (roles::text[] @> ARRAY['anon'] OR roles::text[] @> ARRAY['public'])
      AND (qual ~ 'is_[a-z_]+\s*\(' OR COALESCE(with_check, '') ~ 'is_[a-z_]+\s*\(')
    ORDER BY tablename, policyname
  LOOP
    SELECT string_agg(quote_ident(r), ', ' ORDER BY r) INTO v_new
    FROM unnest(
      ARRAY(SELECT DISTINCT x
            FROM unnest(pol.roles || ARRAY['authenticated', 'service_role']) x
            WHERE x <> 'anon' AND x <> 'public')
    ) AS r;

    IF v_new IS NULL OR v_new = '' THEN
      RAISE NOTICE '157 SKIP % on % (no non-anon role left)', pol.policyname, pol.tablename;
      CONTINUE;
    END IF;

    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', pol.policyname, pol.tablename);
    EXECUTE format('CREATE POLICY %I ON public.%I AS %s FOR %s TO %s USING (%s)%s',
                   pol.policyname, pol.tablename, lower(pol.permissive), pol.cmd, v_new,
                   pol.qual,
                   CASE WHEN nullif(pol.with_check, '') IS NULL THEN ''
                        ELSE format(' WITH CHECK (%s)', pol.with_check) END);
    v_fixed := v_fixed + 1;
    RAISE NOTICE '157 rescoped % on % -> TO %', pol.policyname, pol.tablename, v_new;
  END LOOP;

  -- reviews: เดิม public read = (is_verified OR is_admin()) ซึ่ง anon เรียก is_admin() ไม่ได้
  -- → แยก policy ของ anon ให้อ่านเฉพาะแถวที่ verified (เนื้อหาเท่าเดิม ไม่มีแถวใหม่)
  IF NOT EXISTS (SELECT 1 FROM pg_policies
                 WHERE schemaname = 'public' AND tablename = 'reviews'
                   AND policyname = 'reviews_anon_read') THEN
    EXECUTE 'CREATE POLICY reviews_anon_read ON public.reviews FOR SELECT TO anon USING (is_verified = true)';
    v_fixed := v_fixed + 1;
    RAISE NOTICE '157 created reviews_anon_read (anon reads verified rows only)';
  END IF;

  -- fail-closed self-check
  IF EXISTS (
    SELECT 1 FROM pg_policies p
    WHERE p.schemaname = 'public'
      AND (p.roles::text[] @> ARRAY['anon'] OR p.roles::text[] @> ARRAY['public'])
      AND (p.qual ~ 'is_[a-z_]+\s*\(' OR COALESCE(p.with_check, '') ~ 'is_[a-z_]+\s*\(')
  ) THEN
    RAISE EXCEPTION '157 INCOMPLETE: anon-visible policy still calls is_*() helper';
  END IF;

  RAISE NOTICE '157 rescoped % policies (anon no longer evaluates is_* helpers)', v_fixed;
END $mig157$;

COMMIT;