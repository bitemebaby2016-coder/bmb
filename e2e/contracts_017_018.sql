-- ============================================
-- Bite Me Baby — QA-03 SQL Contract Suite for migrations 017/018 (OWNER: SQL Editor)
-- ALL tests run inside a transaction that ROLLS BACK — zero production writes persist.
-- Must pass AFTER:  supabase db push   (migrations 017 + 018)
-- ============================================
BEGIN;

-- helper assertion: raise on failure
DO $$
DECLARE
  v_prod public.products%ROWTYPE;
  v_round public.delivery_rounds%ROWTYPE;
  v_result jsonb;
  -- W-2 (B-2) 2026-10-26: เดิมมี `v_has fn%TYPE;` = syntax error (type `fn` ไม่มีอยู่จริง) → ลบออก (ไม่ถูกใช้)
  v_audit_count integer;
  v_subtotal numeric;
  v_fee numeric;
  v_total numeric;
  v_status text;
BEGIN
  -- W-2 (B-2): ตั้ง JWT context แบบ contracts_033 — RPC อ่าน auth.uid() (ต้องมี user จริงใน fixture)
  PERFORM set_config('request.jwt.claims',
    '{"sub":"dddf4b57-405f-4852-a985-76d8d52b1b72","role":"authenticated"}', true);
  -- 0) functions exist
  IF to_regprocedure('public.create_pre_order_with_items(text,integer,text,date,text,text,numeric,numeric,text,text)') IS NULL
     THEN RAISE EXCEPTION 'FAIL create_pre_order_with_items missing'; END IF;
  IF to_regprocedure('public.quote_pre_order(text,integer)') IS NULL
     THEN RAISE EXCEPTION 'FAIL quote_pre_order missing'; END IF;
  IF to_regprocedure('public.cancel_pre_order(text)') IS NULL
     THEN RAISE EXCEPTION 'FAIL cancel_pre_order missing'; END IF;
  IF to_regprocedure('public.append_audit_log(text,text,text,text,jsonb,text)') IS NULL
     THEN RAISE EXCEPTION 'FAIL append_audit_log missing'; END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'orders_guard_status_transition')
     THEN RAISE EXCEPTION 'FAIL orders status trigger missing'; END IF;

  -- 1) pick a pre-order product + open round with spare capacity
  SELECT * INTO v_prod FROM public.products WHERE is_preorder = true ORDER BY created_at, id LIMIT 1;
  IF NOT FOUND THEN RAISE EXCEPTION 'SKIP no pre-order product seeded'; END IF;
  SELECT * INTO v_round FROM public.delivery_rounds
   WHERE status IN ('active','open','scheduled') AND current_count < max_capacity
     AND scheduled_date > CURRENT_DATE   -- W-2: ต้องเป็นรอบอนาคต (gate 141/142/143 = scheduled_date >= วันนี้ + cutoff)
   ORDER BY scheduled_date ASC, id ASC LIMIT 1;
  IF NOT FOUND THEN RAISE EXCEPTION 'SKIP no future open round with capacity'; END IF;

  -- W-2 (B-2): fixture เมนูปฏิทินของรอบนั้น — gate ของ 142/153 กำหนดว่า PRE_ORDER
  -- ต้องมีเมนู published ของวันนั้น (มิฉะนั้น = ERR_PRE_ORDER_REQUIRES_MENU)
  -- ทั้งหมดอยู่ใน transaction เดียวกัน → ROLLBACK ท้ายไฟล์ ไม่มีข้อมูลหลงเหลือ
  INSERT INTO public.menu_schedule (scheduled_date, product_id, is_published, note)
  VALUES (v_round.scheduled_date, v_prod.id, true, 'qa contract fixture 017_018 (rollback)')
  ON CONFLICT DO NOTHING;

  -- 2) create a pre-order via the RPC (price must match products.price)
  v_result := public.create_pre_order_with_items(
    p_product_id := v_prod.id,
    p_quantity := 2,
    p_delivery_round_id := v_round.id,
    p_scheduled_date := v_round.scheduled_date,
    p_customer_name := 'QA Contract',
    p_customer_phone := '0800000000',
    -- W-2: 153 กำหนดให้ต้องมีพิกัดจุดส่ง (ERR_MISSING_DELIVERY_COORDS) → ใช้พิกัดครัว (ระยะ ~0 กม.)
    p_delivery_latitude := 12.615659,
    p_delivery_longitude := 102.098063,
    p_delivery_address := '123 ถนนสุขุมวิท ตำบลวัดใหม่ จังหวัดจันทบุรี'
  );
  IF (v_result->>'unit_price')::numeric <> v_prod.price THEN
    RAISE EXCEPTION 'FAIL unit_price not authoritative: got %', v_result->>'unit_price';
  END IF;
  -- W-2: ยอดบิลที่ถูกต้อง = subtotal (ราคา x จำนวน) + delivery_fee (แสดงแยก)
  -- (เดิม assert total = price*2 ล้าสมัย นับตั้งแต่มีค่าจัดส่ง self_delivery)
  SELECT o.subtotal, o.delivery_fee, o.total_amount
    INTO v_subtotal, v_fee, v_total
    FROM public.orders o WHERE o.order_number = v_result->>'order_number';
  IF NOT FOUND THEN RAISE EXCEPTION 'FAIL created pre-order row not found'; END IF;
  IF v_subtotal <> round(v_prod.price * 2, 2) THEN
    RAISE EXCEPTION 'FAIL subtotal not authoritative: got % want %', v_subtotal, round(v_prod.price * 2, 2);
  END IF;
  IF v_total <> v_subtotal + v_fee THEN
    RAISE EXCEPTION 'FAIL total_amount != subtotal + delivery_fee: % vs % + %', v_total, v_subtotal, v_fee;
  END IF;

  -- 3) cancel it (canonical path หลัง 141 รวม PRE_ORDER เข้า orders — cancel_pre_order
  --    มองหาแถวในตาราง archive `pre_orders` ซึ่งไม่มีแถวของออเดอร์ใหม่ → ERR_ORDER_NOT_FOUND)
  v_result := public.cancel_order(
    p_order_number := v_result->>'order_number',
    p_reason := 'qa contract 017/018 (rollback)');
  IF v_result IS NULL THEN RAISE EXCEPTION 'FAIL cancel_order returned NULL'; END IF;
  SELECT o.status INTO v_status FROM public.orders o WHERE o.order_number = v_result->>'order_number';
  IF v_status <> 'cancelled' THEN
    RAISE EXCEPTION 'FAIL cancel_order did not cancel (status=%)', v_status;
  END IF;

  -- 4) append_audit_log writes a row (even inside this rollback txn)
  v_result := public.append_audit_log('qa_probe','order',NULL,'qa sql contract');
  SELECT count(*) INTO v_audit_count FROM public.audit_logs WHERE action = 'qa_probe';
  IF v_audit_count < 1 THEN RAISE EXCEPTION 'FAIL append_audit_log no row'; END IF;

  RAISE NOTICE 'QA-03 017/018 SQL suite PASS (transaction rolled back — no writes persisted)';
END $$;

ROLLBACK;
-- ============================================
-- END — paste output into e2e/contracts-017-018-sql-result.txt (owner action, read-only)
-- ============================================