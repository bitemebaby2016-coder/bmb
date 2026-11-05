// R72 — behavioral smoke of 188 (dedup) + 189 (claim fallback) on PRODUCTION (net-zero)
// evidence → e2e/_r72_smoke.json
'use strict'
const fs = require('fs')
const path = require('path')
const ROOT = path.resolve(__dirname, '..')
const AT = (/^SUPABASE_ACCESS_TOKEN=(.*)$/m.exec(fs.readFileSync(path.join(ROOT, '.env.local'), 'utf8')) || [])[1]
if (!AT) { console.error('NO_SUPABASE_ACCESS_TOKEN'); process.exit(1) }

const q = async (query) => {
  const r = await fetch('https://api.supabase.com/v1/projects/ivkdfognyiwjcmrhcnwz/database/query', {
    method: 'POST',
    headers: { Authorization: 'Bearer ' + AT, 'Content-Type': 'application/json' },
    body: JSON.stringify({ query }),
  })
  return await r.text()
}

const RIDER_UID = '091c3306-ef59-43f3-a754-2f0b1e490326'
const T = 'BMB-R72TEST-1'

const SQL = `
CREATE OR REPLACE FUNCTION pg_temp.r72_smoke() RETURNS jsonb LANGUAGE plpgsql AS $fn$
DECLARE
  v jsonb;
  v_hook_rows int; v_hook_rows2 int; v_worker_dup int;
  v_claim_ok boolean; v_asg text;
BEGIN
  -- A) 188 dedup: order ใหม่ (PRE_ORDER = ข้าม shop-hours gate) → trigger เขียน evt-ord-<ord>-pending
  BEGIN
    INSERT INTO public.orders (id, order_number, customer_id, status, order_mode, payment_status, payment_method, total_amount, customer_name, customer_phone, dropoff_detail, scheduled_date, delivery_round_id)
    VALUES ('ord-${T}', '${T}', (SELECT c.id FROM public.customers c LEFT JOIN public.notification_prefs p ON p.customer_id = c.id WHERE COALESCE((p.channels->>'Transactional')::boolean, true) LIMIT 1), 'pending', 'PRE_ORDER', 'paid', 'promptpay_qr', 1, 'R72 smoke', '0000000000', 'R72 smoke addr', (now() AT TIME ZONE 'Asia/Bangkok')::date + 1, 'round-20261106-morning');
  EXCEPTION WHEN OTHERS THEN
    RETURN jsonb_build_object('insert_blocked', SQLERRM);
  END;
  SELECT count(*) INTO v_hook_rows FROM public.notifications WHERE id = 'evt-ord-${T}-pending';
  -- จำลอง worker เขียน id เดียวกัน (resolution=ignore-duplicates ≈ ON CONFLICT)
  BEGIN
    INSERT INTO public.notifications (id, customer_id, title, message, is_read, notification_type, category)
    VALUES ('evt-ord-${T}-pending', (SELECT id FROM public.customers LIMIT 1), 'x', 'y', false, 'ORDER_CREATED', 'Transactional')
    ON CONFLICT (id) DO NOTHING;
  END;
  SELECT count(*) INTO v_hook_rows2 FROM public.notifications WHERE id = 'evt-ord-${T}-pending';
  -- เปลี่ยนสถานะซ้ำ 2 ครั้ง = แถวเดียว (ผ่าน trusted flag เดียวกับ delivery-sync path + claims แอดมิน
  -- เพราะ trigger ตัดสต็อกตอนยืนยันต้องการ auth — ออเดอร์ทดสอบไม่มี order_items = ไม่ตัดสต็อกจริง)
  PERFORM set_config('request.jwt.claims', '{"sub":"dddf4b57-405f-4852-a985-76d8d52b1b72","role":"authenticated"}', true);
  PERFORM set_config('role', 'authenticated', true);
  PERFORM set_config('app.delivery_sync_order', '${T}', true);
  UPDATE public.orders SET status = 'confirmed' WHERE order_number = '${T}';
  UPDATE public.orders SET status = 'preparing' WHERE order_number = '${T}';
  UPDATE public.orders SET status = 'preparing' WHERE order_number = '${T}';
  SELECT count(*) INTO v_worker_dup FROM public.notifications
   WHERE id IN ('evt-ord-${T}-confirmed', 'evt-ord-${T}-preparing');

  -- B) 189 claim fallback: assignment 'assigned' ของไรเดอร์จริง → claim ต้อง ok (เดิม ERR_OFFER_NOT_AVAILABLE)
  INSERT INTO public.delivery_assignments (id, order_number, driver_id, status, branch_id, assigned_at, notes)
  VALUES ('das-r72-${T}', '${T}', (SELECT id FROM public.drivers WHERE user_id = '${RIDER_UID}' LIMIT 1), 'assigned', 'branch-tenant-bmb-001-main', NOW(), 'r72 smoke');
  PERFORM set_config('request.jwt.claims', '{"sub":"${RIDER_UID}","role":"authenticated"}', true);
  PERFORM set_config('role', 'authenticated', true);
  BEGIN
    v := public.claim_dispatch_offer('${T}');
  EXCEPTION WHEN OTHERS THEN
    v := jsonb_build_object('ok', false, 'error', SQLERRM);
  END;
  v_claim_ok := COALESCE(v->>'ok', 'false') = 'true' AND COALESCE(v->>'via', '') = 'assigned_fallback';
  SELECT status INTO v_asg FROM public.delivery_assignments WHERE order_number = '${T}';
  PERFORM set_config('role', 'none', true);

  RETURN jsonb_build_object(
    'a_hook_created_one', v_hook_rows,
    'a_worker_dup_collapsed', v_hook_rows2,
    'a_status_rows', v_worker_dup,
    'b_claim_fallback_ok', v_claim_ok,
    'b_assignment_status', v_asg
  );
END
$fn$;
SELECT pg_temp.r72_smoke() AS smoke;`

;(async () => {
  const out = { at: new Date().toISOString() }
  out.sqlResult = await q(SQL)
  out.cleanup = await q(`DELETE FROM public.order_messages WHERE order_number = '${T}'; DELETE FROM public.delivery_assignments WHERE order_number = '${T}'; DELETE FROM public.notifications WHERE id LIKE 'evt-ord-${T}-%' OR id LIKE 'evt-pay-${T}-%'; DELETE FROM public.orders WHERE order_number = '${T}'; DELETE FROM public.dispatch_offers WHERE order_number = '${T}';`)
  const s = String(out.sqlResult)
  out.checks = {
    hook_created_one: /"a_hook_created_one":\s*1/.test(s),
    worker_dup_collapsed_one: /"a_worker_dup_collapsed":\s*1/.test(s),
    status_rows_two: /"a_status_rows":\s*2/.test(s),
    claim_fallback_ok: /"b_claim_fallback_ok":\s*true/.test(s),
    assignment_accepted: /"b_assignment_status":\s*"accepted"/.test(s),
  }
  out.ALL_PASS = Object.values(out.checks).every(Boolean)
  fs.writeFileSync(path.join(__dirname, '_r72_smoke.json'), JSON.stringify(out, null, 2))
  console.log(JSON.stringify({ ALL_PASS: out.ALL_PASS, checks: out.checks }, null, 1))
  console.log('SQL_RESULT:', s.slice(0, 500))
})().catch((e) => { console.error('SMOKE_FAIL', String(e).slice(0, 300)); process.exit(1) })