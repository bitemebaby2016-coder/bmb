'use strict'
// _r205Probe — พิสูจน์ runtime ของ RPC ใหม่ (migration 205) บน production จริง
// ผ่าน Supabase Management API database/query (postgres session — ไม่มี JWT)
// ① cancel_order_as_customer เลขที่ปลอม = คาด ERR_ORDER_NOT_FOUND (ถึง logic
//    หลัง guard claims) — ไม่ใช่ ERR_FORBIDDEN
// ② social_timeline_for_web ไม่มี JWT = คาด ERR_NOT_AUTHENTICATED (guard ทำงาน)
// ห้ามแตะออเดอร์จริงรายการใด (เลขที่ปลอมเสมอ)
const fs = require('fs')

const PROJECT_REF = 'ivkdfognyiwjcmrhcnwz'
const OUT = 'e2e/_r205_probe.json'

function readToken() {
  for (const f of ['.env.local', '.env']) {
    if (!fs.existsSync(f)) continue
    const txt = fs.readFileSync(f, 'utf8')
    const m2 = txt.match(/^\s*bmb_PAT_SUPABASE_ACCESS_TOKEN\s*=\s*(.+)\s*$/m)
    if (m2) return m2[1].replace(/^["']|["']$/g, '').trim()
    const m1 = txt.match(/^\s*SUPABASE_ACCESS_TOKEN\s*=\s*(.+)\s*$/m)
    if (m1) return m1[1].replace(/^["']|["']$/g, '').trim()
  }
  return null
}

async function query(token, sql) {
  const r = await fetch('https://api.supabase.com/v1/projects/' + PROJECT_REF + '/database/query', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token, 'User-Agent': 'bmb-probe-205' },
    body: JSON.stringify({ query: sql }),
  })
  return { status: r.status, text: await r.text() }
}

;(async () => {
  const token = readToken()
  const out = { at: new Date().toISOString() }
  if (!token) { out.error = 'access token not found'; fs.writeFileSync(OUT, JSON.stringify(out, null, 2)); process.exit(1) }

  // ① cancel wrapper — เลขที่ปลอม (รูปแบบจริง · ไม่มีใน DB)
  const fakeNumber = 'BMB-20261115-PROBE000'
  const q1 = "SELECT public.cancel_order_as_customer('" + fakeNumber + "', '00000000-0000-0000-0000-000000000000'::uuid, 'runtime_probe');"
  const r1 = await query(token, q1)
  out.cancel_probe = { http: r1.status, body: r1.text.slice(0, 300) }
  out.cancel_probe.not_found_as_expected = /ERR_ORDER_NOT_FOUND/.test(r1.text)
  out.cancel_probe.forbidden_leak = /ERR_FORBIDDEN/.test(r1.text)

  // ② web timeline — postgres session = ไม่มี JWT → คาด ERR_NOT_AUTHENTICATED
  const r2 = await query(token, 'SELECT public.social_timeline_for_web();')
  out.timeline_probe = { http: r2.status, body: r2.text.slice(0, 300) }
  out.timeline_probe.not_authenticated_as_expected = /ERR_NOT_AUTHENTICATED/.test(r2.text)

  out.ok = out.cancel_probe.not_found_as_expected && !out.cancel_probe.forbidden_leak
    && out.timeline_probe.not_authenticated_as_expected
  fs.writeFileSync(OUT, JSON.stringify(out, null, 2))
  console.log('cancel=' + JSON.stringify(out.cancel_probe))
  console.log('timeline=' + JSON.stringify(out.timeline_probe))
  console.log('PROBE_OK=' + out.ok)
})().catch((e) => { console.error(String(e).slice(0, 400)); process.exit(1) })
