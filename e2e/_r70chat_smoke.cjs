// R70 — behavioral smoke of migration 183 on PRODUCTION (temp function · net-zero cleanup)
// จำลอง jwt claims แบบ c_order170 · ทุกขั้นอยู่ในฟังก์ชันเดียว (SQL API คืนผลเฉพาะ
// statement สุดท้าย) · ล้างแถวทดสอบก่อน return = ไม่ทิ้งของจริงไว้
// evidence → e2e/_r70chat_smoke.json
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

;(async () => {
  const out = { at: new Date().toISOString(), checks: {} }
  out.lookup = { customerUser: await q("SELECT id, user_id FROM public.customers WHERE id = '23cbe150-e5f4-4a37-a969-02e2db8df395'") }
  const uidMatch = /"user_id":"([0-9a-f-]{36})"/i.exec(String(out.lookup.customerUser))
  const custUid = uidMatch ? uidMatch[1] : null
  const adminUid = 'dddf4b57-405f-4852-a985-76d8d52b1b72'
  if (!custUid) { console.error('NO_CUSTOMER_UID'); process.exit(1) }

  const SQL = `
CREATE OR REPLACE FUNCTION pg_temp.r70_smoke() RETURNS jsonb LANGUAGE plpgsql AS $fn$
DECLARE
  v_res jsonb;
  v_b_echo int; v_c_both int; v_d text;
BEGIN
  -- A) แอดมินส่ง → แถวแจ้งลูกค้า (customer-owned · msgn-)
  PERFORM set_config('request.jwt.claims', '{"sub":"${adminUid}","role":"authenticated"}', true);
  PERFORM set_config('role', 'authenticated', true);
  v_res := public.send_order_message('BMB-20261105-896', 'R70 smoke admin->customer', 'admin');
  IF COALESCE(v_res->>'ok', 'false') <> 'true' THEN
    RAISE EXCEPTION 'A_SEND_FAILED %', v_res;
  END IF;

  -- B) ลูกค้าส่ง → แถวแจ้งแอดมิน (customer_id NULL) + ลูกค้าต้องไม่เห็น echo ตัวเอง
  PERFORM set_config('request.jwt.claims', '{"sub":"${custUid}","role":"authenticated"}', true);
  v_res := public.send_order_message('BMB-20261105-896', 'R70 smoke customer->admin', 'customer');
  IF COALESCE(v_res->>'ok', 'false') <> 'true' THEN
    RAISE EXCEPTION 'B_SEND_FAILED %', v_res;
  END IF;
  SELECT count(*) INTO v_b_echo FROM public.notifications
   WHERE id LIKE 'msgn-%' AND message LIKE '%R70 smoke customer->admin%';

  -- C) แอดมิน (is_admin) เห็นครบทั้ง 2 แถว
  PERFORM set_config('request.jwt.claims', '{"sub":"${adminUid}","role":"authenticated"}', true);
  SELECT count(*) INTO v_c_both FROM public.notifications
   WHERE id LIKE 'msgn-%' AND (message LIKE '%R70 smoke admin->customer%' OR message LIKE '%R70 smoke customer->admin%');

  -- D) ไรเดอร์ที่ไม่ได้ผูกงาน = ERR_FORBIDDEN (ของเดิม m182 คงอยู่)
  v_res := public.send_order_message('BMB-20261105-896', 'R70 smoke fake rider', 'rider');
  v_d := COALESCE(v_res->>'error', v_res->>'ok');

  RETURN jsonb_build_object(
    'a_leftover_rows', (SELECT count(*) FROM public.order_messages WHERE body LIKE 'R70 smoke%'),
    'b_no_echo', v_b_echo,
    'c_admin_sees_both', v_c_both,
    'd_rider_guard', v_d
  );
END
$fn$;
SELECT pg_temp.r70_smoke() AS smoke;`

  out.sqlResult = await q(SQL)
  // เก็บกวาดนอกฟังก์ชัน (สิทธิ์เจ้าของตาราง — net-zero: ของจริงห้ามค้าง)
  out.cleanup = await q("DELETE FROM public.order_messages WHERE body LIKE 'R70 smoke%' OR body LIKE 'R70 diag%'; DELETE FROM public.notifications WHERE id LIKE 'msgn-%' AND message LIKE '%R70 smoke%';")
  const s = String(out.sqlResult)
  out.checks = {
    ran: s.includes('"smoke"'),
    a_msg_inserted_then_cleaned: /"a_leftover_rows":\s*2/.test(s),
    b_no_echo_zero: /"b_no_echo":\s*0/.test(s),
    c_admin_sees_both_two: /"c_admin_sees_both":\s*2/.test(s),
    d_rider_guard: s.includes('ERR_FORBIDDEN'),
  }
  out.checks.a_send_ok = !s.includes('A_SEND_FAILED')
  out.checks.b_send_ok = !s.includes('B_SEND_FAILED')
  out.ALL_PASS = Object.values(out.checks).every(Boolean)
  fs.writeFileSync(path.join(__dirname, '_r70chat_smoke.json'), JSON.stringify(out, null, 2))
  console.log(JSON.stringify({ ALL_PASS: out.ALL_PASS, checks: out.checks }, null, 1))
  console.log('SQL_RESULT:', s.slice(0, 800))
})().catch((e) => { console.error('SMOKE_FAIL', String(e).slice(0, 300)); process.exit(1) })
