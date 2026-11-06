#!/usr/bin/env bash
# ============================================================
# e2e/ci/_r73e_verify.sh — R73e: ปิดคลาส UTC/BKK date gate ของสายโปรโมชัน
# stage 0 = replay ทั้ง chain ผ่าน _r73_verify.sh (inventory + shims + legacy 7/7)
# stage 1 = apply migration 190 · stage 2 = prosrc audit
# stage 3 = night-sim (extreme timezone) — repro gate เก่า + พิสูจน์ gate ใหม่/fn จริง
# stage 4 = contract 190 (guard) · stage 5 = legacy batch ซ้ำ (regression หลัง 190)
# รันผ่าน e2e/ci/_r73e_verify.bat เท่านั้น (path มีช่องว่าง)
# ============================================================
set -uo pipefail
exec > >(tee -a /mnt/repo/e2e/_r73e_verify_progress.log) 2>&1

if [ "${RESUME:-0}" != "1" ]; then
echo "===== R73E STAGE 0: base replay via _r73_verify.sh ====="
bash /mnt/repo/e2e/ci/_r73_verify.sh
base_rc=$?
if [ $base_rc -ne 0 ]; then echo "R73E_BASE_FAIL rc=$base_rc"; exit 1; fi
export PGUSER=postgres PGDATABASE=bmb_contract
cd /tmp/w || { echo NO_WORKDIR; exit 1; }

echo "===== R73E STAGE 1: apply migrations 190-192 ====="
for f in 190_bkk_promo_gates_core.sql 191_kitchen_date_bkk.sql 192_crm_automation_and_sales_stats.sql 193_customers_crm_consent.sql; do
  psql -X -v ON_ERROR_STOP=1 -f "/tmp/w/supabase/migrations/$f" || { echo "APPLY_FAIL $f"; exit 1; }
  echo "APPLY_OK $f"
done

echo "===== R73E STAGE 2: UTC date class audit (pg_get_functiondef · body + defaults · whole public schema) ====="
psql -X -Atc "SELECT proname FROM pg_proc WHERE pronamespace = 'public'::regnamespace AND pg_get_functiondef(oid) ILIKE '%CURRENT_DATE%' ORDER BY 1"
bad=$(psql -X -Atc "SELECT count(*) FROM pg_proc WHERE pronamespace = 'public'::regnamespace AND pg_get_functiondef(oid) ILIKE '%CURRENT_DATE%'")
if [ "$bad" != "0" ]; then echo "PROSRC_AUDIT_FAIL utc_residue=$bad"; exit 1; fi
echo "PROSRC_AUDIT_OK utc_class_residue=0 (body + arg defaults · pg_get_functiondef)"
else
export PGUSER=postgres PGDATABASE=bmb_contract
cd /tmp/w || { echo NO_WORKDIR; exit 1; }
echo "===== R73E RESUME=1 — skip stage 0-2 ====="
fi

echo "===== R73E STAGE 3: night-sim via extreme timezone (พฤติกรรมจริง ไม่ใช่ static) ====="
TZ1='Etc/GMT+12'; TZ2='Etc/GMT-12'
div1=$(psql -X -Atc "SELECT ((now() AT TIME ZONE '$TZ1')::date <> (now() AT TIME ZONE 'Asia/Bangkok')::date)::int")
div2=$(psql -X -Atc "SELECT ((now() AT TIME ZONE '$TZ2')::date <> (now() AT TIME ZONE 'Asia/Bangkok')::date)::int")
if [ "$div1" = "1" ]; then SIMTZ=$TZ1; elif [ "$div2" = "1" ]; then SIMTZ=$TZ2; else echo "NIGHTSIM_FAIL: no divergent TZ (div1=$div1 div2=$div2)"; exit 1; fi
echo "SIMTZ=$SIMTZ (CURRENT_DATE ของ session นี้ != วัน BKK = เลียนแบบ 00:00-07:00 ICT)"
psql -X -v ON_ERROR_STOP=1 <<SQL
BEGIN;
INSERT INTO public.promotions (id, name, code, discount_type, discount_value, min_order_amount, start_date, end_date, is_active)
VALUES ('r73e-bkk-1', 'R73E night-sim', 'R73E-BKK', 'percentage', 10, 0,
        (now() AT TIME ZONE 'Asia/Bangkok')::date, (now() AT TIME ZONE 'Asia/Bangkok')::date, true);
SET LOCAL timezone = '$SIMTZ';
DO \$\$
DECLARE
  v_old integer; v_new integer; v_disc numeric;
  v_utc date := CURRENT_DATE;
  v_bkk date := (now() AT TIME ZONE 'Asia/Bangkok')::date;
BEGIN
  IF v_utc = v_bkk THEN
    RAISE EXCEPTION 'NIGHTSIM_FAIL: session date not divergent (utc=% bkk=%)', v_utc, v_bkk;
  END IF;
  RAISE NOTICE 'NIGHTSIM_DIVERGENCE utc_date=% bkk_date=%', v_utc, v_bkk;
  SELECT count(*) INTO v_old FROM public.promotions
   WHERE code = 'R73E-BKK' AND is_active = true
     AND (start_date IS NULL OR start_date <= CURRENT_DATE)
     AND (end_date   IS NULL OR end_date   >= CURRENT_DATE);
  IF v_old <> 0 THEN
    RAISE EXCEPTION 'REPRO_FAIL: old UTC gate should NOT see the coupon (got %)', v_old;
  END IF;
  RAISE NOTICE 'REPRO_OK old_utc_gate_hits=0 (คูปองถูกมองข้ามเงียบ = อาการดีเฟคเดิม)';
  SELECT count(*) INTO v_new FROM public.promotions
   WHERE code = 'R73E-BKK' AND is_active = true
     AND (start_date IS NULL OR start_date <= (now() AT TIME ZONE 'Asia/Bangkok')::date)
     AND (end_date   IS NULL OR end_date   >= (now() AT TIME ZONE 'Asia/Bangkok')::date);
  IF v_new <> 1 THEN
    RAISE EXCEPTION 'FIX_FAIL: BKK gate should see the coupon (got %)', v_new;
  END IF;
  RAISE NOTICE 'FIX_OK new_bkk_gate_hits=1';
  v_disc := public.promotion_apply_rules('r73e-bkk-1', 100, 100);
  IF v_disc IS NULL OR v_disc <= 0 THEN
    RAISE EXCEPTION 'LIVE_FN_FAIL: promotion_apply_rules returned % at night', v_disc;
  END IF;
  RAISE NOTICE 'LIVE_FN_OK promotion_apply_rules=% (m186 · เส้น live ใช้ได้ช่วงกลางคืน)', v_disc;
END
\$\$;
ROLLBACK;
SQL
rc=$?
if [ $rc -ne 0 ]; then echo "NIGHTSIM_FAIL rc=$rc"; exit 1; fi
echo "NIGHTSIM_OK"

echo "===== R73E STAGE 3.5: CRM automation behavioral (winback/birthday/segments/sales stats) ====="
psql -X -v ON_ERROR_STOP=1 <<SQL
BEGIN;
-- fixtures (rollback ภายหลัง): ลูกค้า A = เคยสั่งนานมาแล้ว + วันนี้วันเกิด · ลูกค้า B = เพิ่งสั่ง
INSERT INTO public.customers (id, user_id, full_name, phone) VALUES
  ('crm-t-a', NULL, 'ลูกค้าเก่า', '0800000001'),
  ('crm-t-b', NULL, 'ลูกค้าใหม่', '0800000002');
UPDATE public.customers SET birthday = (now() AT TIME ZONE 'Asia/Bangkok')::date, crm_consent = true WHERE id = 'crm-t-a';
UPDATE public.customers SET crm_consent = true WHERE id = 'crm-t-b';
-- m193: ลูกค้า C = วันเกิดวันนี้ + เคยสั่งนานแล้ว แต่ "ไม่ยินยอม" = ห้ามได้รับข้อความใด ๆ
INSERT INTO public.customers (id, user_id, full_name, phone, birthday, crm_consent) VALUES
  ('crm-t-c', NULL, 'ลูกค้าไม่ยินยอม', '0800000003', (now() AT TIME ZONE 'Asia/Bangkok')::date, false);
INSERT INTO public.orders (id, order_number, customer_id, customer_name, customer_phone, status, total_amount, created_at) VALUES
  ('crm-o-old', 'CRM-T-OLD', 'crm-t-a', 'ลูกค้าเก่า', '0800000001', 'delivered', 100, now() - interval '60 days'),
  ('crm-o-new', 'CRM-T-NEW', 'crm-t-b', 'ลูกค้าใหม่', '0800000002', 'delivered', 120, now() - interval '2 days'),
  ('crm-o-old-c', 'CRM-T-OLD-C', 'crm-t-c', 'ลูกค้าไม่ยินยอม', '0800000003', 'delivered', 90, now() - interval '60 days');
INSERT INTO public.order_items (id, order_id, product_id, product_name, quantity, unit_price)
SELECT 'crm-oi-1', 'crm-o-new', p.id, p.name, 2, 45 FROM public.products p LIMIT 1;

DO \$\$
DECLARE
  w1 jsonb; w2 jsonb; b1 jsonb; b2 jsonb; s jsonb; k jsonb; n integer; ms integer;
BEGIN
  w1 := public.crm_winback_scan(45, 50);
  IF NOT (w1 ->> 'ok')::boolean OR (w1 ->> 'candidates')::int < 1 OR (w1 ->> 'notified')::int < 1 THEN
    RAISE EXCEPTION 'CRM_WINBACK_FAIL first run: %', w1;
  END IF;
  w2 := public.crm_winback_scan(45, 50);
  IF (w2 ->> 'notified')::int <> 0 OR (w2 ->> 'deduped')::int < 1 THEN
    RAISE EXCEPTION 'CRM_WINBACK_DEDUP_FAIL second run: %', w2;
  END IF;
  RAISE NOTICE 'CRM_WINBACK_OK % / dedupe %', w1, w2;

  b1 := public.crm_birthday_scan(50);
  IF (b1 ->> 'notified')::int < 1 THEN RAISE EXCEPTION 'CRM_BIRTHDAY_FAIL first run: %', b1; END IF;
  b2 := public.crm_birthday_scan(50);
  IF (b2 ->> 'notified')::int <> 0 THEN RAISE EXCEPTION 'CRM_BIRTHDAY_DEDUP_FAIL: %', b2; END IF;
  RAISE NOTICE 'CRM_BIRTHDAY_OK % / dedupe %', b1, b2;

  -- m193: consent filter — winback ต้องเจอแค่คนยินยอม (crm-t-a · t-c มีออเดอร์เก่าเท่ากัน)
  IF (w1 ->> 'candidates')::int <> 1 THEN
    RAISE EXCEPTION 'CRM_WINBACK_CONSENT_FILTER_FAIL candidates=% (ต้องเป็น 1 = เฉพาะคนยินยอม)', (w1 ->> 'candidates');
  END IF;
  SELECT count(*) INTO n FROM public.notifications
   WHERE customer_id = 'crm-t-c' AND notification_type IN ('crm_winback', 'crm_birthday');
  IF n <> 0 THEN
    RAISE EXCEPTION 'CRM_CONSENT_FILTER_FAIL: ลูกค้าไม่ยินยอมได้รับข้อความ % ครั้ง', n;
  END IF;
  RAISE NOTICE 'CRM_CONSENT_FILTER_OK non-consented customer skipped (winback+birthday)';

  s := public.crm_segment_summary(45);
  IF (s ->> 'customers_total') IS NULL OR (s ->> 'customers_total')::int < 2 THEN
    RAISE EXCEPTION 'CRM_SEGMENTS_FAIL: %', s;
  END IF;
  RAISE NOTICE 'CRM_SEGMENTS_OK %', s;

  SELECT count(*) INTO ms FROM public.menu_sales_stats(30);
  IF ms < 1 THEN RAISE EXCEPTION 'MENU_SALES_STATS_FAIL rows=%', ms; END IF;
  RAISE NOTICE 'MENU_SALES_STATS_OK products_with_sales=%', ms;

  SELECT count(*) INTO n FROM public.notifications WHERE notification_type IN ('crm_winback','crm_birthday') AND category = 'Marketing';
  IF n < 2 THEN RAISE EXCEPTION 'CRM_NOTIFY_ROWS_FAIL n=%', n; END IF;

  -- kill-switch: business_settings ปิด = scan ข้าม
  DELETE FROM public.business_settings WHERE key = 'crm_automation';
  INSERT INTO public.business_settings (key, value) VALUES ('crm_automation', '{"enabled": false}'::jsonb);
  k := public.crm_winback_scan(45, 50);
  IF (k ->> 'skipped') IS DISTINCT FROM 'disabled_by_settings' THEN
    RAISE EXCEPTION 'CRM_KILLSWITCH_FAIL: %', k;
  END IF;
  RAISE NOTICE 'CRM_KILLSWITCH_OK %', k;
END
\$\$;
ROLLBACK;
SQL
rc=$?
if [ $rc -ne 0 ]; then echo "CRM_SIM_FAIL rc=$rc"; exit 1; fi
echo "CRM_SIM_OK"

echo "===== R73E STAGE 4: contract 190 (BKK date gates guard) ====="
psql -X -v ON_ERROR_STOP=1 -f e2e/contracts_190_bkk_date_gates.sql || { echo CONTRACT190_FAIL; exit 1; }
echo "CONTRACT190_OK"

echo "===== R73E STAGE 5: legacy batch 7/7 regression (after 190) ====="
fail=0
for f in e2e/contracts_017_018.sql e2e/contracts_019_kitchen.sql e2e/contracts_020_bite_drive.sql \
         e2e/contracts_021_phase4.sql e2e/contracts_022_phases_5_7.sql e2e/contracts_029_round_grant.sql \
         e2e/contracts_033_table_acl.sql; do
  echo "===== $f ====="
  psql -X -v ON_ERROR_STOP=1 -f "$f"
  rc=$?
  echo "FILE_EXIT=$rc"
  if [ $rc -ne 0 ]; then fail=$((fail+1)); fi
done
echo "R73E_LEGACY_BATCH_FAIL=$fail/7"
if [ $fail -ne 0 ]; then echo "R73E_VERIFY_RED"; exit 1; fi

echo "R73E_VERIFY_ALL_GREEN"
