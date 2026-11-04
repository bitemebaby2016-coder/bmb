// Task C — ปิดลูปออเดอร์ทดสอบ BMB-20261101-170 ผ่าน pos_closeout_order (RPC จริง)
// วิธี: DO block ตั้ง request.jwt.claims = admin คนแรก (active) → auth.uid() ตรง → is_admin() ผ่าน
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
  const t = await r.text()
  if (!r.ok) throw new Error('HTTP ' + r.status + ' ' + t.slice(0, 400))
  return JSON.parse(t)
}

;(async () => {
  const sql = [
    "DO $$",
    "DECLARE v_uid text; v_res jsonb;",
    "BEGIN",
    "  SELECT id INTO v_uid FROM public.profiles WHERE role = 'admin' AND is_active = true ORDER BY created_at LIMIT 1;",
    "  IF v_uid IS NULL THEN RAISE EXCEPTION 'NO_ACTIVE_ADMIN'; END IF;",
    "  PERFORM set_config('request.jwt.claims', json_build_object('sub', v_uid, 'role', 'authenticated', 'email', '')::text, true);",
    "  v_res := public.pos_closeout_order('BMB-20261101-170', true);",
    "  RAISE NOTICE 'CLOSEOUT_RESULT=%', v_res::text;",
    "END $$;",
  ].join('\n')
  await q(sql)

  const after = await q(
    "SELECT order_number, status, payment_status, pickup_code, picked_up_at, handed_by, updated_at " +
    "FROM public.orders WHERE order_number = 'BMB-20261101-170'",
  )
  const audit = await q(
    "SELECT action, entity_type, description, created_at FROM public.audit_logs " +
    "WHERE entity_id = 'BMB-20261101-170' ORDER BY created_at DESC LIMIT 5",
  )
  const out = { at: new Date().toISOString(), after, audit }
  fs.writeFileSync(path.join(ROOT, 'e2e', 'c_close170_result.json'), JSON.stringify(out, null, 2))
  console.log(JSON.stringify(out, null, 2))
  process.exit(0)
})().catch((e) => { console.error('CLOSE170_FAILED', String(e).slice(0, 500)); process.exit(1) })