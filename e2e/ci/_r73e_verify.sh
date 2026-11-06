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

echo "===== R73E STAGE 1: apply migration 190 ====="
psql -X -v ON_ERROR_STOP=1 -f /tmp/w/supabase/migrations/190_bkk_promo_gates_core.sql || { echo APPLY190_FAIL; exit 1; }
echo "APPLY190_OK"

echo "===== R73E STAGE 2: prosrc audit — public fns still using CURRENT_DATE ====="
psql -X -Atc "SELECT proname FROM pg_proc WHERE prosrc ILIKE '%CURRENT_DATE%' AND pronamespace = 'public'::regnamespace ORDER BY 1"
echo "(expected residue = kitchen display fns only: create_production_batch/get_kitchen_summary/kitchen_queue — report-only scope)"
bad=$(psql -X -Atc "SELECT count(*) FROM pg_proc WHERE prosrc ILIKE '%CURRENT_DATE%' AND pronamespace = 'public'::regnamespace AND proname IN ('create_order_with_items','create_order_with_items_i','create_order_with_items_core','create_pre_order_with_items','create_pickup_order_i','promotion_apply_rules')")
if [ "$bad" != "0" ]; then echo "PROSRC_AUDIT_FAIL order/promo fns=$bad"; exit 1; fi
echo "PROSRC_AUDIT_OK order_promo_utc=0"
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
