// R21e — production read-only probe: ยืนยันรูปแบบ id จริง (to_char 11 หลัก = '#' · 14 หลัก = space นำ)
// + promotion_apply_rules ยังไม่มี cap (ก่อน apply 172) — evidence → e2e/r21eProdIdProbe.json
// Run: node e2e/r21eProdIdProbe.cjs
const fs = require('fs')
const path = require('path')
const ROOT = path.resolve(__dirname, '..')
const AT = (/^SUPABASE_ACCESS_TOKEN=(.*)$/m.exec(fs.readFileSync(path.join(ROOT, '.env.local'), 'utf8')) || [])[1]
const q = async (query) => {
  const r = await fetch('https://api.supabase.com/v1/projects/ivkdfognyiwjcmrhcnwz/database/query', {
    method: 'POST', headers: { Authorization: 'Bearer ' + AT, 'Content-Type': 'application/json' },
    body: JSON.stringify({ query }) })
  return r.text()
}
;(async () => {
  const out = { at: new Date().toISOString() }
  out.orders = await q('SELECT id, order_number, created_at FROM public.orders ORDER BY created_at DESC LIMIT 5')
  out.osh = await q('SELECT id, order_number, changed_at FROM public.order_status_history ORDER BY changed_at DESC LIMIT 3')
  out.notif = await q('SELECT id, title, created_at FROM public.notifications ORDER BY created_at DESC LIMIT 3')
  out.promoFnHasCap = await q("SELECT (prosrc LIKE '%0.15%') AS has_cap FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace WHERE n.nspname = 'public' AND p.proname = 'promotion_apply_rules'")
  out.orderIdHashCount = await q("SELECT COUNT(*) AS n_hash FROM public.orders WHERE id LIKE '%#%'")
  out.orderIdSpaceCount = await q("SELECT COUNT(*) AS n_space FROM public.orders WHERE id LIKE '% %'")
  fs.writeFileSync(path.join(__dirname, 'r21eProdIdProbe.json'), JSON.stringify(out, null, 2))
  console.log('ORDERS=' + out.orders.slice(0, 700))
  console.log('OSH=' + out.osh.slice(0, 400))
  console.log('NOTIF=' + out.notif.slice(0, 400))
  console.log('CAP=' + out.promoFnHasCap.slice(0, 200))
  console.log('HASH=' + out.orderIdHashCount.slice(0, 200) + ' SPACE=' + out.orderIdSpaceCount.slice(0, 200))
})().catch((e) => console.log('FATAL ' + String(e).slice(0, 300)))
