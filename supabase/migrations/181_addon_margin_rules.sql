-- ============================================
-- Bite Me Baby — Migration 181: Add-on Margin Rules + Admin-driven discount cap (R49 · 2026-11-01)
-- ============================================
-- Owner task: "Integrate Add-on Profit Margin Rules & Admin Control Panel"
--   a) ราคาปกติ + ราคาโปรโมชัน Add-on → products.addons.promo_price (JSONB ของเดิม — ไม่สร้างตารางใหม่)
--   b) เพดานส่วนลดสูงสุด (%) กันคูปอง/แต้มกัดกำไร Add-on → addon_margin_policy.max_discount_pct
--      → ใช้แทนค่า hardcode 0.15 ใน promotion_apply_rules (m172) — แอดมินปรับได้ ไม่ตายตัว
--   c) บังคับซื้อคู่เมนูหลัก → addon_margin_policy.main_dish_required (gate ฝั่ง UI cross-sell — ดู §S/T)
-- + compute_addons_price = คิด promo_price เมื่อแอดมินตั้งไว้ (server-authoritative เหมือนเดิม)
-- + helper addon_margin_setting อ่านค่าจาก policy (mirror order_setting)
-- ADDITIVE/REPLACE เฉพาะ 2 fn ที่เกี่ยวกับกำไร/ส่วนลด · ไม่แตะตัว RPC สั่งซื้อ/จ่ายเงิน · re-run ปลอดภัย

-- ① feature policy (ค่าเริ่มต้น = พฤติกรรมเดิม 15% · แอดมินแก้ผ่าน Admin → business_settings)
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.business_settings WHERE key = 'addon_margin_policy') THEN
    INSERT INTO public.business_settings (key, value)
    VALUES ('addon_margin_policy',
            '{"enabled": true, "max_discount_pct": 15, "min_addon_margin_pct": 0, "main_dish_required": false, "cross_sell_enabled": true}'::jsonb);
  END IF;
END $$;

-- ② helper อ่านค่าตัวเลขจาก policy (ค่าพัง/หาย = default — mirror order_setting)
CREATE OR REPLACE FUNCTION public.addon_margin_setting(p_field text, p_default numeric)
RETURNS numeric
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(
    (SELECT (value ->> p_field)::numeric
       FROM public.business_settings
      WHERE key = 'addon_margin_policy'),
    p_default)
$$;
REVOKE ALL ON FUNCTION public.addon_margin_setting(text, numeric) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.addon_margin_setting(text, numeric) TO PUBLIC, authenticated, service_role;

-- ③ compute_addons_price = ราคาโปรโมชันเมื่อแอดมินตั้ง (promo_price > 0) — body VERBATIM จาก 016
--    เปลี่ยนเฉพาะการเลือกแหล่งราคา (price → promo_price ถ้ามี) · server-authoritative เหมือนเดิม
CREATE OR REPLACE FUNCTION public.compute_addons_price(p_product_id text, p_options jsonb)
RETURNS numeric
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_addons  jsonb;
  v_addon   jsonb;
  v_entry   jsonb;
  v_total   numeric := 0;
  v_cnt     integer := 0;
  v_note    text;
  v_price   numeric;
BEGIN
  IF p_product_id IS NULL OR p_options IS NULL OR p_options->'addOns' IS NULL THEN
    RETURN 0;
  END IF;
  SELECT COALESCE(addons, '[]'::jsonb) INTO v_addons FROM public.products WHERE id = p_product_id;
  IF v_addons IS NULL OR jsonb_array_length(v_addons) = 0 THEN
    RETURN 0;
  END IF;
  FOR v_addon IN SELECT * FROM jsonb_array_elements(v_addons)
  LOOP
    -- R49: ราคาที่คิด = promo_price (แอดมินตั้ง) ถ้า > 0 มิฉะนั้นราคาปกติ
    v_price := COALESCE(NULLIF((v_addon->>'promo_price')::numeric, 0), COALESCE((v_addon->>'price')::numeric, 0));
    v_entry := NULL;
    SELECT value::jsonb INTO v_entry
      FROM jsonb_array_elements(COALESCE(p_options->'addOns', '[]'::jsonb)) AS e
     WHERE e.value->>'addonId' = v_addon->>'id'
     LIMIT 1;
    IF v_entry IS NOT NULL THEN
      v_cnt := (SELECT count(*)::int FROM jsonb_array_elements(COALESCE(v_entry->'selections', '[]'::jsonb)));
      v_note := COALESCE(v_entry->>'note', '');
      IF v_addon->>'type' = 'text' THEN
        IF v_cnt > 0 OR v_note <> '' THEN
          v_total := v_total + v_price;
        END IF;
      ELSE
        v_total := v_total + v_price * v_cnt;
      END IF;
    END IF;
  END LOOP;
  RETURN v_total;
END;
$$;
-- ④ global cap = อ่านจาก addon_margin_policy.max_discount_pct (แอดมินตั้ง · default 15 = พฤติกรรมเดิม m172)
--    body = VERBATIM จาก 172 — เปลี่ยนเฉพาะ (4c) hardcode 0.15 → ค่าจาก policy (ไม่ฮาร์ดโคดกฎตายตัว)
CREATE OR REPLACE FUNCTION public.promotion_apply_rules(p_promo_id text, p_subtotal numeric, p_eligible numeric)
RETURNS numeric
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_promo public.promotions%ROWTYPE;
  v_sub numeric := GREATEST(COALESCE(p_subtotal, 0), 0);
  v_elig numeric;
  v_disc numeric := 0;
  v_state jsonb;
  v_pct numeric;
  v_cap_pct numeric;
BEGIN
  IF v_sub <= 0 THEN RETURN 0; END IF;
  IF p_promo_id IS NULL OR btrim(p_promo_id) = '' THEN RETURN 0; END IF;

  SELECT * INTO v_promo
    FROM public.promotions
   WHERE id = p_promo_id
     AND is_active = true
     AND (start_date IS NULL OR start_date <= CURRENT_DATE)
     AND (end_date   IS NULL OR end_date   >= CURRENT_DATE)
   LIMIT 1;
  IF NOT FOUND THEN RETURN 0; END IF;

  IF NOT public.promotions_enabled() THEN RETURN 0; END IF;

  IF v_sub < COALESCE(v_promo.min_order_amount, 0) THEN RETURN 0; END IF;

  v_elig := GREATEST(COALESCE(p_eligible, 0), 0);
  IF COALESCE(v_promo.applies_to, 'all_products') <> 'specific_products' THEN
    v_elig := v_sub;
  END IF;
  v_elig := LEAST(v_elig, v_sub);
  IF v_elig <= 0 THEN RETURN 0; END IF;

  IF v_promo.discount_type = 'percentage' THEN
    v_disc := LEAST(v_elig * COALESCE(v_promo.discount_value, 0) / 100, v_elig);
  ELSIF v_promo.discount_type = 'fixed_amount' THEN
    v_disc := LEAST(COALESCE(v_promo.discount_value, 0), v_elig);
  END IF;

  IF v_promo.max_discount_amount IS NOT NULL THEN
    v_disc := LEAST(v_disc, GREATEST(v_promo.max_discount_amount, 0));
  END IF;

  -- (4c) R49: เพดานส่วนลดรวม = addon_margin_policy.max_discount_pct% ของยอดสินค้า
  --      (แอดมินตั้งผ่าน Admin → business_settings · default 15 = ตรง m172 เดิม · ค่าพัง = 15)
  v_cap_pct := COALESCE(public.addon_margin_setting('max_discount_pct', 15), 15);
  v_disc := LEAST(v_disc, ROUND(v_sub * (GREATEST(0, LEAST(v_cap_pct, 90)) / 100), 2));

  IF v_disc IS NULL OR v_disc <= 0 THEN RETURN 0; END IF;
  v_disc := ROUND(v_disc, 2);
  IF v_disc <= 0 THEN RETURN 0; END IF;

  v_state := public.promotion_budget_state();
  v_pct := (v_state ->> 'percent')::numeric;
  IF v_pct IS NOT NULL THEN
    IF NOT ((COALESCE((v_state ->> 'spent')::numeric, 0) + v_disc)
            <= (v_pct / 100) * (COALESCE((v_state ->> 'sales')::numeric, 0) + v_sub)) THEN
      RETURN 0;
    END IF;
  END IF;

  IF v_promo.usage_limit IS NOT NULL THEN
    UPDATE public.promotions
       SET usage_count = usage_count + 1, updated_at = now()
     WHERE id = v_promo.id
       AND usage_count < usage_limit;
    IF NOT FOUND THEN RETURN 0; END IF;
  ELSE
    UPDATE public.promotions
       SET usage_count = usage_count + 1, updated_at = now()
     WHERE id = v_promo.id;
  END IF;

  RETURN v_disc;
EXCEPTION WHEN OTHERS THEN
  -- กันออเดอร์พังจากค่า settings ที่ไม่คาดคิด — ไม่ลดราคา = ไม่เอาเปรียบลูกค้า/ร้าน
  RETURN 0;
END;
$$;