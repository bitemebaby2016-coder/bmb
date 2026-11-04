// R65 — behavior verify 184 บน production: รัน contract (BEGIN..ROLLBACK) ผ่าน Management API
// contract ทุก group RAISE EXCEPTION เมื่อ fail → query error = fail · ไม่มี error = ทุก group ผ่าน
// ROLLBACK ท้ายไฟล์ = zero persisted data ( fixture/orders/hours ทั้งหมดหาย )
// evidence → e2e/r65Behavior184-result.json
const fs = require('fs')
const path = require('path')
const ROOT = path.resolve(__dirname, '..')
const AT = (/^SUPABASE_ACCESS_TOKEN=(.*)$/m.exec(fs.readFileSync(path.join(ROOT, '.env.local'), 'utf8')) || [])[1]
if (!AT) { console.error('NO_SUPABASE_ACCESS_TOKEN'); process.exit(1) }

;(async () => {
  const out = { at: new Date().toISOString(), file: 'e2e/contracts_184_pickup_outside_hours.sql' }
  const sql = fs.readFileSync(path.join(ROOT, 'e2e', 'contracts_184_pickup_outside_hours.sql'), 'utf8')

  const r = await fetch('https://api.supabase.com/v1/projects/ivkdfognyiwjcmrhcnwz/database/query', {
    method: 'POST',
    headers: { Authorization: 'Bearer ' + AT, 'Content-Type': 'application/json' },
    body: JSON.stringify({ query: sql }),
  })
  out.status = r.status
  out.response = String(await r.text()).slice(0, 1200)

  // error = message+code fields ของ PostgREST/PG error (ไม่ใช่ผลลัพธ์ [] ปกติ)
  const isError = /"message"/i.test(out.response) && /"code"/i.test(out.response) && !/^\s*\[\s*\]/.test(out.response.trim())
  out.contractPass = !isError

  // pollution check: orders ของ contract (phone 0900000000 + auth user fixture) ต้องเป็น 0 หลัง ROLLBACK
  const q = async (query) => {
    const rr = await fetch('https://api.supabase.com/v1/projects/ivkdfognyiwjcmrhcnwz/database/query', {
      method: 'POST',
      headers: { Authorization: 'Bearer ' + AT, 'Content-Type': 'application/json' },
      body: JSON.stringify({ query }),
    })
    return rr.text()
  }
  out.pollution = {
    orders0900: await q("SELECT count(*) AS n FROM public.orders WHERE customer_phone = '0900000000'"),
    contractAuthUser: await q("SELECT count(*) AS n FROM auth.users WHERE email = 'r65-184@bmb.test'"),
    hoursRestored: await q("SELECT value->>'open' AS open, value->>'close' AS close FROM public.business_settings WHERE key='hours'"),
  }
  const clean = String(out.pollution.orders0900).includes('"n":0')
    && String(out.pollution.contractAuthUser).includes('"n":0')
  out.zeroPollution = clean
  out.ALL_PASS = out.contractPass && clean
  fs.writeFileSync(path.join(ROOT, 'e2e', 'r65Behavior184-result.json'), JSON.stringify(out, null, 2))
  console.log('R65_BEHAVIOR_184 contractPass=' + out.contractPass + ' zeroPollution=' + clean)
  process.exit(out.ALL_PASS ? 0 : 1)
})().catch((e) => { console.error('BEHAVIOR_FAILED ' + String(e).slice(0, 300)); process.exit(1) })