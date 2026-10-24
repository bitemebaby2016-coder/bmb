#!/usr/bin/env bash
# Concurrency contract (isolated CI DB only): two SEPARATE sessions submit the
# SAME client_submit_key + payload simultaneously → advisory xact lock must
# serialize them ⇒ at most ONE order. Job DB is ephemeral (dies with the job).
set -euo pipefail

KEY='CK-CONC-1'
PHONE='0911111111'
ITEMS='[{"product_id":"prod-1","quantity":1,"options":{},"special_request":null}]'

# fixtures (contracts_123/124 ROLLBACK ไปแล้ว → สร้างเองทั้งหมด)
psql -X -v ON_ERROR_STOP=1 -q -c \
  "SELECT public.ensure_rounds_for_date((now() AT TIME ZONE 'Asia/Bangkok')::date);
   UPDATE public.delivery_rounds SET cutoff_time='23:59', same_day_cutoff='23:59', max_capacity=50, current_count=0
    WHERE scheduled_date=(now() AT TIME ZONE 'Asia/Bangkok')::date;
   UPDATE public.products SET is_available=true, available_same_day=true WHERE id='prod-1';
   INSERT INTO auth.users (id, email, encrypted_password, created_at, updated_at, raw_app_meta_data, raw_user_meta_data, aud, role)
   VALUES ('a1111111-1111-1111-1111-111111111111','conc@bmb.test','x',now(),now(),'{}','{}','authenticated','authenticated')
   ON CONFLICT (id) DO NOTHING;"


call() {
  # 19 positional args (18 ของ wrapper ปัจจุบัน + p_client_submit_key) + claims
  # เพื่อให้ 118 ผ่าน identity gate (v_uid := COALESCE(auth.uid(), p_customer_ref))
  psql -X -At -v ON_ERROR_STOP=1 -c "
    SET ROLE authenticated;
    SELECT set_config('request.jwt.claims', '{\"sub\":\"a1111111-1111-1111-1111-111111111111\",\"role\":\"authenticated\"}', false);
    SELECT public.create_order_with_items_i(
      '${ITEMS}'::jsonb,
      (SELECT id FROM public.delivery_rounds
        WHERE scheduled_date = (now() AT TIME ZONE 'Asia/Bangkok')::date
          AND status = 'active' ORDER BY id LIMIT 1), -- ตรึงการเลือก (LIMIT 1 ไม่มี ORDER BY = เลือกแถวไม่คงที่หลัง trigger ขยับ physical row → fingerprint เพี้ยนเอง)
      'self_delivery', '', ((public.kitchen_location()->>'latitude')::numeric + 0.002), ((public.kitchen_location()->>'longitude')::numeric + 0.002), 'ConcQA', '${PHONE}', 'cash_on_delivery',
      '', NULL, 0, 'SAME_DAY', NULL, NULL, NULL, NULL, NULL, '${KEY}')::text;"
}

call > /tmp/conc_a.out 2>/tmp/conc_a.err &
PID_A=$!
call > /tmp/conc_b.out 2>/tmp/conc_b.err &
PID_B=$!

set +e
wait $PID_A; SA=$?
wait $PID_B; SB=$?
set -e

echo "--- A (exit $SA) ---"; cat /tmp/conc_a.out /tmp/conc_a.err || true
echo "--- B (exit $SB) ---"; cat /tmp/conc_b.out /tmp/conc_b.err || true

# ทั้งสองสำเร็จและคืนเลข order เดียวกัน
if [ "$SA" -ne 0 ] || [ "$SB" -ne 0 ]; then
  echo "FAIL: concurrent submit error (A=$SA B=$SB)"; exit 1
fi
ORDERS_N=$(psql -Atc "SELECT count(*) FROM public.orders WHERE customer_phone = '${PHONE}'")
SUBS_N=$(psql -Atc "SELECT count(*) FROM public.order_submissions WHERE client_submit_key = '${KEY}'")
echo "orders_for_phone=${ORDERS_N} submissions_for_key=${SUBS_N}"
[ "$ORDERS_N" = "1" ] || { echo "FAIL: expected exactly 1 order"; exit 1; }
[ "$SUBS_N" = "1" ] || { echo "FAIL: expected exactly 1 submission row"; exit 1; }
# ผลลัพธ์ที่คืนออกมาทั้งสองฝั่งชี้เลขเดียวกัน
A_N=$(grep -oE '(BMB|PO)-[0-9]{8}-[0-9]+' /tmp/conc_a.out | head -1 || true)
B_N=$(grep -oE '(BMB|PO)-[0-9]{8}-[0-9]+' /tmp/conc_b.out | head -1 || true)
echo "A_order=${A_N:-none} B_order=${B_N:-none}"
[ -n "$A_N" ] && [ "$A_N" = "$B_N" ] || { echo "FAIL: same-key responses disagree"; exit 1; }
echo "PASS: concurrent same-key submits produced exactly one order"

# ============================================================
# R5: concurrent same key + DIFFERENT payloads → exactly ONE winner,
#     loser ต้องได้ ERR_IDEMPOTENCY_CONFLICT · orders=1 · submissions=1
# ============================================================
KEY2='CK-CONC-2'
ITEMS2='[{"product_id":"prod-1","quantity":2,"options":{},"special_request":null}]'
PHONE2='0922222222'

callx() {
  local key="$1" items="$2" phone="$3"
  psql -X -At -v ON_ERROR_STOP=1 -c "
    SET ROLE authenticated;
    SELECT set_config('request.jwt.claims', '{\"sub\":\"a1111111-1111-1111-1111-111111111111\",\"role\":\"authenticated\"}', false);
    SELECT public.create_order_with_items_i(
      '${items}'::jsonb,
      (SELECT id FROM public.delivery_rounds
        WHERE scheduled_date = (now() AT TIME ZONE 'Asia/Bangkok')::date
          AND status = 'active' ORDER BY id LIMIT 1), -- ตรึงการเลือกแบบเดียวกับ call() — R5/R6 ต้องต่างกันเฉพาะ payload/key เท่านั้น
      'self_delivery', '', ((public.kitchen_location()->>'latitude')::numeric + 0.002), ((public.kitchen_location()->>'longitude')::numeric + 0.002), 'ConcQA', '${phone}', 'cash_on_delivery',
      '', NULL, 0, 'SAME_DAY', NULL, NULL, NULL, NULL, NULL, '${key}')::text;"
}

callx "$KEY2" "$ITEMS" "$PHONE2" > /tmp/conc2_a.out 2>/tmp/conc2_a.err &
PID_A=$!
callx "$KEY2" "$ITEMS2" "$PHONE2" > /tmp/conc2_b.out 2>/tmp/conc2_b.err &
PID_B=$!
set +e
wait $PID_A; SA=$?
wait $PID_B; SB=$?
set -e
echo "--- R5 A (exit $SA) ---"; cat /tmp/conc2_a.out /tmp/conc2_a.err || true
echo "--- R5 B (exit $SB) ---"; cat /tmp/conc2_b.out /tmp/conc2_b.err || true
if [ "$SA" -eq 0 ] && [ "$SB" -eq 0 ]; then
  echo "FAIL: R5 payloads differ — only one may win"; exit 1
fi
if [ "$SA" -ne 0 ] && [ "$SB" -ne 0 ]; then
  echo "FAIL: R5 exactly one payload must win"; exit 1
fi
if [ "$SA" -ne 0 ]; then grep -q 'ERR_IDEMPOTENCY_CONFLICT' /tmp/conc2_a.out /tmp/conc2_a.err || { echo "FAIL: R5 loser must get ERR_IDEMPOTENCY_CONFLICT"; exit 1; }; fi
if [ "$SB" -ne 0 ]; then grep -q 'ERR_IDEMPOTENCY_CONFLICT' /tmp/conc2_b.out /tmp/conc2_b.err || { echo "FAIL: R5 loser must get ERR_IDEMPOTENCY_CONFLICT"; exit 1; }; fi
ORDERS2=$(psql -Atc "SELECT count(*) FROM public.orders WHERE customer_phone = '${PHONE2}'")
SUBS2=$(psql -Atc "SELECT count(*) FROM public.order_submissions WHERE client_submit_key = '${KEY2}'")
echo "R5 orders_for_phone=${ORDERS2} submissions_for_key=${SUBS2}"
[ "$ORDERS2" = "1" ] || { echo "FAIL: R5 expected exactly 1 order"; exit 1; }
[ "$SUBS2" = "1" ] || { echo "FAIL: R5 expected exactly 1 submission row"; exit 1; }
echo "PASS: R5 concurrent same-key different-payload → one winner, one conflict"

# ============================================================
# R6a: deterministic fail-then-retry (ลำดับตายตัว — ไม่ใช่ race):
#   invalid payload → ต้องได้ ERR_EMPTY_ORDER เป๊ะ + orders/subs = 0 (fixture นี้เท่านั้น)
#   valid payload key เดิม → สร้างครั้งเดียว + replay ได้ (เลขเดิม, ไม่เพิ่มแถว)
# ============================================================
KEY3='CK-CONC-3'
PHONE3='0933333333'

set +e
callx "$KEY3" '[]' "$PHONE3" > /tmp/conc3a_a.out 2>/tmp/conc3a_a.err
RA=$?
set -e
echo "--- R6a invalid (exit $RA) ---"; cat /tmp/conc3a_a.out /tmp/conc3a_a.err || true
[ "$RA" -ne 0 ] || { echo "FAIL: R6a invalid payload must fail"; exit 1; }
grep -q 'ERR_EMPTY_ORDER' /tmp/conc3a_a.out /tmp/conc3a_a.err || { echo "FAIL: R6a invalid payload must fail with ERR_EMPTY_ORDER (deterministic)"; exit 1; }
if grep -q 'ERR_IDEMPOTENCY_CONFLICT' /tmp/conc3a_a.out /tmp/conc3a_a.err; then echo "FAIL: R6a must not conflict — no competing request here"; exit 1; fi
ORDERS3=$(psql -Atc "SELECT count(*) FROM public.orders WHERE customer_phone = '${PHONE3}'")
SUBS3=$(psql -Atc "SELECT count(*) FROM public.order_submissions WHERE client_submit_key = '${KEY3}'")
echo "R6a after-fail orders_for_phone=${ORDERS3} submissions_for_key=${SUBS3}"
[ "$ORDERS3" = "0" ] || { echo "FAIL: R6a failed submit must not create order"; exit 1; }
[ "$SUBS3" = "0" ] || { echo "FAIL: R6a failed submit must not persist submission"; exit 1; }

set +e
callx "$KEY3" "$ITEMS" "$PHONE3" > /tmp/conc3a_b.out 2>/tmp/conc3a_b.err
RB=$?
set -e
echo "--- R6a valid retry (exit $RB) ---"; cat /tmp/conc3a_b.out /tmp/conc3a_b.err || true
[ "$RB" -eq 0 ] || { echo "FAIL: R6a valid retry must succeed"; exit 1; }
W3=$(grep -oE '(BMB|PO)-[0-9]{8}-[0-9]+' /tmp/conc3a_b.out | head -1 || true)
[ -n "$W3" ] || { echo "FAIL: R6a valid retry must produce an order_number"; exit 1; }
ORDERS3=$(psql -Atc "SELECT count(*) FROM public.orders WHERE customer_phone = '${PHONE3}'")
SUBS3=$(psql -Atc "SELECT count(*) FROM public.order_submissions WHERE client_submit_key = '${KEY3}'")
SUBNUM3=$(psql -Atc "SELECT result->>'order_number' FROM public.order_submissions WHERE client_submit_key = '${KEY3}'")
echo "R6a after-retry orders_for_phone=${ORDERS3} submissions_for_key=${SUBS3} stored_order=${SUBNUM3:-none}"
[ "$ORDERS3" = "1" ] || { echo "FAIL: R6a expected exactly 1 order after retry"; exit 1; }
[ "$SUBS3" = "1" ] || { echo "FAIL: R6a expected exactly 1 submission row"; exit 1; }
[ "$SUBNUM3" = "$W3" ] || { echo "FAIL: R6a stored result must match the created order"; exit 1; }

set +e
callx "$KEY3" "$ITEMS" "$PHONE3" > /tmp/conc3a_c.out 2>/tmp/conc3a_c.err
RC=$?
set -e
echo "--- R6a replay (exit $RC) ---"; cat /tmp/conc3a_c.out /tmp/conc3a_c.err || true
[ "$RC" -eq 0 ] || { echo "FAIL: R6a replay must succeed"; exit 1; }
grep -oE '(BMB|PO)-[0-9]{8}-[0-9]+' /tmp/conc3a_c.out | head -1 | grep -qx "$W3" || { echo "FAIL: R6a replay must return the same order"; exit 1; }
grep -q '"replay": true' /tmp/conc3a_c.out || { echo "FAIL: R6a replay marker missing"; exit 1; }
ORDERS3=$(psql -Atc "SELECT count(*) FROM public.orders WHERE customer_phone = '${PHONE3}'")
SUBS3=$(psql -Atc "SELECT count(*) FROM public.order_submissions WHERE client_submit_key = '${KEY3}'")
[ "$ORDERS3" = "1" ] || { echo "FAIL: R6a replay must not create another order"; exit 1; }
[ "$SUBS3" = "1" ] || { echo "FAIL: R6a replay must not add submission rows"; exit 1; }
echo "PASS: R6a deterministic fail-then-retry → ERR_EMPTY_ORDER, no partial, one order, replay ok"

# ============================================================
# R6b: concurrent invalid-vs-valid race (race test — ห้ามใช้แทน R6a):
#   ลำดับการแข่งกำหนด error ของ A: ERR_EMPTY_ORDER (A เข้าก่อน แล้ว rollback ปล่อย
#   lock) หรือ ERR_IDEMPOTENCY_CONFLICT (B ชนะก่อน แล้ว A เจอ fingerprint ต่าง)
#   invariant ที่ตรึงได้: B สำเร็จเสมอ · orders=1 · submissions=1 (fixture KEY4/PHONE4)
# ============================================================
KEY4='CK-CONC-4'
PHONE4='0944444444'

callx "$KEY4" '[]' "$PHONE4" > /tmp/conc4_a.out 2>/tmp/conc4_a.err &
PID_A=$!
callx "$KEY4" "$ITEMS" "$PHONE4" > /tmp/conc4_b.out 2>/tmp/conc4_b.err &
PID_B=$!
set +e
wait $PID_A; SA=$?
wait $PID_B; SB=$?
set -e
echo "--- R6b A (exit $SA) ---"; cat /tmp/conc4_a.out /tmp/conc4_a.err || true
echo "--- R6b B (exit $SB) ---"; cat /tmp/conc4_b.out /tmp/conc4_b.err || true
if [ "$SB" -ne 0 ]; then echo "FAIL: R6b good payload must succeed"; exit 1; fi
if [ "$SA" -eq 0 ]; then echo "FAIL: R6b broken payload must fail"; exit 1; fi
grep -Eq 'ERR_EMPTY_ORDER|ERR_IDEMPOTENCY_CONFLICT' /tmp/conc4_a.out /tmp/conc4_a.err || { echo "FAIL: R6b unexpected A error"; exit 1; }
ORDERS4=$(psql -Atc "SELECT count(*) FROM public.orders WHERE customer_phone = '${PHONE4}'")
SUBS4=$(psql -Atc "SELECT count(*) FROM public.order_submissions WHERE client_submit_key = '${KEY4}'")
SUBNUM4=$(psql -Atc "SELECT result->>'order_number' FROM public.order_submissions WHERE client_submit_key = '${KEY4}'")
echo "R6b orders_for_phone=${ORDERS4} submissions_for_key=${SUBS4} stored_order=${SUBNUM4:-none} A_error=$(grep -oE 'ERR_[A-Z_]+' /tmp/conc4_a.out /tmp/conc4_a.err | head -1 || true)"
[ "$ORDERS4" = "1" ] || { echo "FAIL: R6b expected exactly 1 order (no partial)"; exit 1; }
[ "$SUBS4" = "1" ] || { echo "FAIL: R6b expected exactly 1 submission row"; exit 1; }
[ -n "$SUBNUM4" ] || { echo "FAIL: R6b stored result must carry the winner order_number"; exit 1; }
echo "PASS: R6b concurrent invalid-vs-valid race → no partial state (A error varies by schedule)"
