// R71 — behavioral smoke of migration 187 on PRODUCTION (temp function · net-zero cleanup)
// เคสหลัก = "ไรเดอร์ส่งข้อความ" ที่ m183 ทำพัง (unique violation) + แถวรอรับของไรเดอร์
// ใช้งาน assignment จริง: drv-…-60bc (uid 091c3306…) / BMB-20261101-218
// evidence → e2e/_r71_smoke.json
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

const ORDER = 'BMB-20261101-218' // มี delivery_assignment จริง (status=delivered แต่ m182/187 ไม่ฟิลเตอร์สถานะ)
const RIDER_UID = '091c3306-ef59-43f3-a754-2f0b1e490326'
const ADMIN_UID = 'dddf4b57-405f-4852-a985-76d8d52b1b72'

;(async () => {
  const out = { at: new Date().toISOString(), checks: {} }
  out.lookup = { orderCustomer: await q(`SELECT o.customer_id, c.user_id AS uid FROM public.orders o LEFT JOIN public.customers c ON c.id = o.customer_id WHERE o.order_number = '${ORDER}'`) }
  const uidMatch = /"uid":"([0-9a-f-]{36})"/i.exec(String(out.lookup.orderCustomer))
  const custUid = uidMatch ? uidMatch[1] : null
  if (!custUid) { console.error('NO_CUSTOMER_UID'); process.exit(1) }

  const SQL = `
CREATE OR REPLACE FUNCTION pg_temp.r71_smoke() RETURNS jsonb LANGUAGE plpgsql AS $fn$
DECLARE
  v jsonb;
  v_a_ok boolean; v_b_ok boolean; v_c_ok boolean;
  v_rider_sees int; v_cust_sees int; v_rows int;
BEGIN
  -- A) ไรเดอร์ส่ง (เคสที่ m183 ทำพัง = unique violation → rollback) ต้อง ok + 2 แถวลูกค้า/แอดมิน
  PERFORM set_config('request.jwt.claims', '{"sub":"${RIDER_UID}","role":"authenticated"}', true);
  PERFORM set_config('role', 'authenticated', true);
  v := public.send_order_message('${ORDER}', 'R71 smoke rider->all', 'rider');
  v_a_ok := COALESCE(v->>'ok', 'false') = 'true';

  -- B) แอดมินส่ง → ต้องมีแถวรอรับของไรเดอร์ ('-r' · user_id = ไรเดอร์)
  PERFORM set_config('request.jwt.claims', '{"sub":"${ADMIN_UID}","role":"authenticated"}', true);
  v := public.send_order_message('${ORDER}', 'R71 smoke admin->rider', 'admin');
  v_b_ok := COALESCE(v->>'ok', 'false') = 'true';

  -- C) ลูกค้าส่ง → ต้องมีแถวรอรับของไรเดอร์เช่นกัน
  PERFORM set_config('request.jwt.claims', '{"sub":"${custUid}","role":"authenticated"}', true);
  v := public.send_order_message('${ORDER}', 'R71 smoke customer->rider', 'customer');
  v_c_ok := COALESCE(v->>'ok', 'false') = 'true';

  -- D) ฝั่งไรเดอร์เห็นเฉพาะแถวของตัวเอง ('-r' จาก B+C = 2 · ห้ามเห็น echo '-c'/'-a' ของ A/C)
  PERFORM set_config('request.jwt.claims', '{"sub":"${RIDER_UID}","role":"authenticated"}', true);
  SELECT count(*) INTO v_rider_sees FROM public.notifications
   WHERE message LIKE '%R71 smoke%';

  -- E) ฝั่งลูกค้าเห็นเฉพาะแถว '-c' ของตน (A+B = 2 · ห้ามเห็น '-a'/'-r')
  PERFORM set_config('request.jwt.claims', '{"sub":"${custUid}","role":"authenticated"}', true);
  SELECT count(*) INTO v_cust_sees FROM public.notifications
   WHERE message LIKE '%R71 smoke%';

  PERFORM set_config('role', 'none', true);
  -- นับแถวจริงทั้งหมด (สิทธิ์เจ้าของ) = A(2)+B(2)+C(2) = 6
  SELECT count(*) INTO v_rows FROM public.notifications
   WHERE message LIKE '%R71 smoke%';

  RETURN jsonb_build_object(
    'a_rider_send_ok', v_a_ok,
    'b_admin_send_ok', v_b_ok,
    'c_customer_send_ok', v_c_ok,
    'd_rider_sees_own_only', v_rider_sees,
    'e_customer_sees_own_only', v_cust_sees,
    'total_rows_created', v_rows
  );
END
$fn$;
SELECT pg_temp.r71_smoke() AS smoke;`

  out.sqlResult = await q(SQL)
  out.cleanup = await q("DELETE FROM public.order_messages WHERE body LIKE 'R71 smoke%'; DELETE FROM public.notifications WHERE message LIKE '%R71 smoke%';")
  const s = String(out.sqlResult)
  out.checks = {
    a_rider_send_ok: /"a_rider_send_ok":\s*true/.test(s),
    b_admin_send_ok: /"b_admin_send_ok":\s*true/.test(s),
    c_customer_send_ok: /"c_customer_send_ok":\s*true/.test(s),
    d_rider_sees_2: /"d_rider_sees_own_only":\s*2/.test(s),
    e_customer_sees_2: /"e_customer_sees_own_only":\s*2/.test(s),
    total_rows_6: /"total_rows_created":\s*6/.test(s),
  }
  out.ALL_PASS = Object.values(out.checks).every(Boolean)
  fs.writeFileSync(path.join(__dirname, '_r71_smoke.json'), JSON.stringify(out, null, 2))
  console.log(JSON.stringify({ ALL_PASS: out.ALL_PASS, checks: out.checks }, null, 1))
  console.log('SQL_RESULT:', s.slice(0, 600))
})().catch((e) => { console.error('SMOKE_FAIL', String(e).slice(0, 300)); process.exit(1) })