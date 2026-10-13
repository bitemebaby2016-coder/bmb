#!/usr/bin/env bash
# Concurrency contract (isolated CI DB only): two SEPARATE sessions submit the
# SAME client_submit_key + payload simultaneously → advisory xact lock must
# serialize them ⇒ at most ONE order. Job DB is ephemeral (dies with the job).
set -euo pipefail

KEY='CK-CONC-1'
PHONE='0911111111'
ITEMS='[{"product_id":"prod-1","quantity":1,"options":{},"special_request":null}]'

# fixtures (contracts_123/124 ROLLBACK ไปแล้ว → สร้าง round/สินค้าวันนี้เอง)
psql -X -v ON_ERROR_STOP=1 -q -c \
  "SELECT public.ensure_rounds_for_date((now() AT TIME ZONE 'Asia/Bangkok')::date);
   UPDATE public.delivery_rounds SET cutoff_time='23:59', max_capacity=50, current_count=0
    WHERE scheduled_date=(now() AT TIME ZONE 'Asia/Bangkok')::date;
   UPDATE public.products SET is_available=true, available_same_day=true WHERE id='prod-1';"


call() {
  psql -X -At -v ON_ERROR_STOP=1 -c "
    SELECT public.create_order_with_items_i(
      '${ITEMS}'::jsonb,
      (SELECT id FROM public.delivery_rounds
        WHERE scheduled_date = (now() AT TIME ZONE 'Asia/Bangkok')::date
          AND status = 'active' LIMIT 1),
      'self_delivery', '', NULL, NULL, 'ConcQA', '${PHONE}', 'cash_on_delivery',
      '', NULL, 0, 'SAME_DAY', NULL, '${KEY}')::text;"
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
