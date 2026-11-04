// Task C — probe ออเดอร์ทดสอบ BMB-20261101-170 บน production (read-only)
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
  if (!r.ok) throw new Error('HTTP ' + r.status + ' ' + t.slice(0, 300))
  return JSON.parse(t)
}

;(async () => {
  const target = await q(
    "SELECT order_number, status, payment_status, payment_method, delivery_method, pickup_code, " +
    "picked_up_at, handed_by, subtotal, discount_amount, delivery_fee, total_amount, customer_name, " +
    "customer_phone, created_at, updated_at FROM public.orders WHERE order_number = 'BMB-20261101-170'",
  )
  // context: pickup orders วันเดียวกัน (ดูว่า 170 ต่างจากปกติตรงไหน)
  const siblings = await q(
    "SELECT order_number, status, payment_status, delivery_method, pickup_code, picked_up_at, created_at " +
    "FROM public.orders WHERE delivery_method = 'pickup' AND order_number LIKE 'BMB-20261101%' ORDER BY created_at",
  )
  const out = { at: new Date().toISOString(), target, siblings }
  fs.writeFileSync(path.join(ROOT, 'e2e', 'c_order170_probe.json'), JSON.stringify(out, null, 2))
  console.log(JSON.stringify(out, null, 2))
  process.exit(0)
})().catch((e) => { console.error('PROBE_FAILED', String(e).slice(0, 400)); process.exit(1) })