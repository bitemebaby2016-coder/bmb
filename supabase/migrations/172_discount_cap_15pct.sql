-- ============================================
-- 172 — R21 P2 (Owner 2026-10-29): เพดานส่วนลดรวมต่อออเดอร์ 15% ของยอดรวมสินค้า
-- ============================================
-- ที่มา: client guardrail = src/lib/discountGuardrail.ts (MAX_DISCOUNT_PCT = 15,
--   บล็อกปุ่มสั่งฝั่งตะกร้า) — แต่ server ยังไม่มี cap → คูปอง/โปรโมชั่นที่ให้เกิน 15%
--   ถูกหักเต็มจำนวน (เช่น 50% ของยอด 100 = หัก 50 · contract เดิมยืนยันพฤติกรรมนี้)
--   และ client guardrail บายพาสได้เสมอ (devtools/ช่องทางอื่น) → server ต้อง cap เอง
-- กติกาใหม่ (4c ด้านล่าง): promotion_apply_rules คืนส่วนลดไม่เกิน ROUND(v_sub * 0.15, 2)
--   = ที่เดียวที่ create_order_with_items ใช้คิดส่วนลด (153h)
-- body = VERBATIM จาก 153 (153h) — เปลี่ยนเฉพาะเพิ่ม (4c) · re-run ปลอดภัย (CREATE OR REPLACE)
-- contract: e2e/contracts_153 (G2 GRUSE/G5/G8 อัปเดตตามเพดาน + G8 ตรวจ id ไร้ '#'/space)
-- หลัง apply: production probe = e2e/r21eProdIdProbe.json (ก่อนแก้ cap=false · id มี '#')
-- ============================================

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
BEGIN
  IF v_sub <= 0 THEN RETURN 0; END IF;
  IF p_promo_id IS NULL OR btrim(p_promo_id) = '' THEN RETURN 0; END IF;

  -- ตรวจซ้ำทุกเงื่อนไข (active + date window เหมือน 114) — กันโค้ดถูกพักหลัง lookup
  SELECT * INTO v_promo
    FROM public.promotions
   WHERE id = p_promo_id
     AND is_active = true
     AND (start_date IS NULL OR start_date <= CURRENT_DATE)
     AND (end_date   IS NULL OR end_date   >= CURRENT_DATE)
   LIMIT 1;
  IF NOT FOUND THEN RETURN 0; END IF;

  -- (1) kill switch — Owner ⑥: ปิดได้ทันที ทุกโค้ด
  IF NOT public.promotions_enabled() THEN RETURN 0; END IF;

  -- (2) ยอดขั้นต่ำ — เทียบยอดรวมออเดอร์ (กติกา 114 เดิม ไม่เปลี่ยนความหมาย)
  IF v_sub < COALESCE(v_promo.min_order_amount, 0) THEN RETURN 0; END IF;

  -- (3) ฐานส่วนลดตาม scope สินค้าที่ร่วมรายการ
  v_elig := GREATEST(COALESCE(p_eligible, 0), 0);
  IF COALESCE(v_promo.applies_to, 'all_products') <> 'specific_products' THEN
    v_elig := v_sub;
  END IF;
  v_elig := LEAST(v_elig, v_sub);
  IF v_elig <= 0 THEN RETURN 0; END IF;

  -- (4) คำนวณ — mirror ของ 114 เป๊ะ (percentage/fixed · LEAST กับฐาน)
  IF v_promo.discount_type = 'percentage' THEN
    v_disc := LEAST(v_elig * COALESCE(v_promo.discount_value, 0) / 100, v_elig);
  ELSIF v_promo.discount_type = 'fixed_amount' THEN
    v_disc := LEAST(COALESCE(v_promo.discount_value, 0), v_elig);
  END IF;

  -- (4b) เพดานส่วนลดต่อออเดอร์ของแคมเปญ (max_discount_amount)
  IF v_promo.max_discount_amount IS NOT NULL THEN
    v_disc := LEAST(v_disc, GREATEST(v_promo.max_discount_amount, 0));
  END IF;

  -- (4c) R21 · Owner (2026-10-29): global cap — ส่วนลดรวมไม่เกิน 15% ของยอดรวมสินค้า
  --      (mirror client MAX_DISCOUNT_PCT ใน src/lib/discountGuardrail.ts —
  --       server = ความจริงเดียว · อยู่ก่อน budget/usage side effects)
  v_disc := LEAST(v_disc, ROUND(v_sub * 0.15, 2));

  IF v_disc IS NULL OR v_disc <= 0 THEN RETURN 0; END IF;
  v_disc := ROUND(v_disc, 2); -- ตรงกับคอลัมน์ numeric(10,2) ที่จะบันทึก
  IF v_disc <= 0 THEN RETURN 0; END IF;

  -- (5) budget gate — Owner ⑥: งบ = 15% ของยอดขาย (แอดมินปรับ · NULL = ไม่จำกัด)
  v_state := public.promotion_budget_state();
  v_pct := (v_state ->> 'percent')::numeric;
  IF v_pct IS NOT NULL THEN
    IF NOT ((COALESCE((v_state ->> 'spent')::numeric, 0) + v_disc)
            <= (v_pct / 100) * (COALESCE((v_state ->> 'sales')::numeric, 0) + v_sub)) THEN
      RETURN 0;
    END IF;
  END IF;

  -- (6) usage cap — atomic: ใช้ครบ usage_limit แล้วคืน 0 (นับเฉพาะตอนส่วนลด > 0)
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
END $$;
REVOKE EXECUTE ON FUNCTION public.promotion_apply_rules(text, numeric, numeric) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.promotion_apply_rules(text, numeric, numeric) TO authenticated, service_role;
