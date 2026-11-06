-- ============================================================
-- e2e/contracts_190_bkk_date_gates.sql — R73e: guard คลาส UTC/BKK date gate ของสายโปรโมชัน
-- (time-bomb ซ้ำ 3 ครั้ง: R68 contract, R73 CI, R73e _core — สัญญานี้กันไม่ให้กลับมา)
-- กติกา: wall-clock-independent (static prosrc assertions) — รันกลางวัน/กลางคืนผลเดียวกัน
-- หลักฐาน behavior ตอนกลางคืน = e2e/_r73e_verify_progress.log (night-sim ด้วย extreme TZ)
-- ============================================================
BEGIN;

DO $r73e190$
DECLARE
  v_fn text;
  v_src text;
  v_cnt integer;
  v_bad text := '';
  v_missing text := '';
BEGIN
  FOREACH v_fn IN ARRAY ARRAY[
    'create_order_with_items',
    'create_order_with_items_i',
    'create_order_with_items_core',
    'create_pre_order_with_items',
    'create_pickup_order_i',
    'promotion_apply_rules'
  ] LOOP
    SELECT count(*) INTO v_cnt
      FROM pg_proc
     WHERE proname = v_fn
       AND pronamespace = 'public'::regnamespace;
    IF v_cnt = 0 THEN
      v_missing := v_missing || v_fn || ' ';
      CONTINUE;
    END IF;
    SELECT string_agg(prosrc, E'\n--\n') INTO v_src
      FROM pg_proc
     WHERE proname = v_fn
       AND pronamespace = 'public'::regnamespace;
    IF v_src ILIKE '%CURRENT_DATE%' THEN
      v_bad := v_bad || v_fn || ' ';
    END IF;
  END LOOP;

  -- ตัวที่มี date gate จริง ต้องอ้างวัน BKK อย่างชัดเจน (wrappers ไม่มี logic วันที่ = ยกเว้น)
  FOREACH v_fn IN ARRAY ARRAY[
    'create_order_with_items',
    'create_order_with_items_core',
    'create_pre_order_with_items',
    'promotion_apply_rules'
  ] LOOP
    SELECT string_agg(prosrc, E'\n--\n') INTO v_src
      FROM pg_proc
     WHERE proname = v_fn
       AND pronamespace = 'public'::regnamespace;
    IF v_src NOT ILIKE '%Asia/Bangkok%' THEN
      v_bad := v_bad || v_fn || '(no-bkk) ';
    END IF;
  END LOOP;

  IF v_missing <> '' THEN
    RAISE EXCEPTION 'R73E_190 FAIL: missing function(s): %', v_missing;
  END IF;
  IF v_bad <> '' THEN
    RAISE EXCEPTION 'R73E_190 FAIL: UTC date gate remains / no BKK date source in: %', v_bad;
  END IF;

  RAISE NOTICE 'R73E_190_RESULTS OK bkk_date_gates=6/6 no_utc_gate';
END
$r73e190$;

ROLLBACK;
