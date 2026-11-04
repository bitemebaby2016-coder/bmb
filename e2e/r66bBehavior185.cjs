// R66-B — behavior verify 185 บน production: รัน contracts_185_admin_switches.sql (BEGIN..ROLLBACK)
// contract ทุก group RAISE EXCEPTION เมื่อ fail → query error = fail · ไม่มี error = ทุก group ผ่าน
// ROLLBACK ท้ายไฟล์ = zero persisted data
// evidence → e2e/r66bBehavior185-result.json
const fs = require('fs')
const path = require('path')
const ROOT = path.resolve(__dirname, '..')
const AT = (/^SUPABASE_ACCESS_TOKEN=(.*)$/m.exec(fs.readFileSync(path.join(ROOT, '.env.local'), 'utf8')) || [])[1]
if (!AT) { console.error('NO_SUPABASE_ACCESS_TOKEN'); process.exit(1) }

;(async () => {
  const out = { at: new Date().toISOString(), file: 'e2e/contracts_185_admin_switches.sql' }
  const sql = fs.readFileSync(path.join(ROOT, 'e2e', 'contracts_185_admin_switches.sql'), 'utf8')

  const r = await fetch('https://api.supabase.com/v1/projects/ivkdfognyiwjcmrhcnwz/database/query', {
    method: 'POST',
    headers: { Authorization: 'Bearer ' + AT, 'Content-Type': 'application/json' },
    body: JSON.stringify({ query: sql }),
  })
  out.status = r.status
  out.response = String(await r.text()).slice(0, 1600)

  const isError = /"message"/i.test(out.response) && /"code"/i.test(out.response) && !/^\s*\[\s*\]/.test(out.response.trim())
  out.contractPass = !isError

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
    contractAuthUser: await q("SELECT count(*) AS n FROM auth.users WHERE email = 'r66-185@bmb.test'"),
    masterRestored: await q("SELECT value FROM public.business_settings WHERE key = 'store_master_open'"),
    flagsRestored: await q('SELECT count(*) AS n FROM public.product_categories WHERE allow_same_day IS DISTINCT FROM true OR allow_pre_order IS DISTINCT FROM true'),
  }
  const clean = String(out.pollution.orders0900).includes('"n":0')
    && String(out.pollution.contractAuthUser).includes('"n":0')
    && String(out.pollution.masterRestored).includes('true')
    && String(out.pollution.flagsRestored).includes('"n":0')
  out.zeroPollution = clean
  out.ALL_PASS = out.contractPass && clean
  fs.writeFileSync(path.join(ROOT, 'e2e', 'r66bBehavior185-result.json'), JSON.stringify(out, null, 2))
  console.log('R66B_BEHAVIOR_185 contractPass=' + out.contractPass + ' zeroPollution=' + clean)
  process.exit(out.ALL_PASS ? 0 : 1)
})().catch((e) => { console.error('BEHAVIOR_FAILED ' + String(e).slice(0, 300)); process.exit(1) })