'use strict'
// _r68_verify186 — พิสูจน์ production จริงว่า migration 186 เข้าแล้ว (ไม่เชื่อแค่ HTTP 201)
const fs = require('fs')
const PROJECT_REF = 'ivkdfognyiwjcmrhcnwz'
const OUT = 'e2e/_r68_verify186.json'

function readToken() {
  for (const f of ['.env.local', '.env']) {
    if (!fs.existsSync(f)) continue
    const m = fs.readFileSync(f, 'utf8').match(/^\s*SUPABASE_ACCESS_TOKEN\s*=\s*(.+)\s*$/m)
    if (m) return m[1].replace(/^["']|["']$/g, '').trim()
  }
  return null
}

;(async () => {
  const token = readToken()
  const out = { at: new Date().toISOString(), project: PROJECT_REF }
  if (!token) { console.log('NO_TOKEN'); process.exit(1) }

  const q = [
    "SELECT proname,",
    "       (pg_get_functiondef(p.oid) LIKE '%' || 'Asia/Bangkok' || '%') AS has_bkk,",
    "       (pg_get_functiondef(p.oid) LIKE '%start_date <= (now()%' ) AS bkk_start_gate,",
    "       (pg_get_functiondef(p.oid) LIKE '%CURRENT_DATE%' ) AS still_current_date",
    "  FROM pg_proc p",
    " WHERE proname IN ('promotion_apply_rules','create_order_with_items')",
    "   AND pg_function_is_visible(p.oid)",
  ].join('\n')

  const r = await fetch('https://api.supabase.com/v1/projects/' + PROJECT_REF + '/database/query', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token, 'User-Agent': 'bmb-verify-186' },
    body: JSON.stringify({ query: q }),
  })
  out.http = r.status
  const text = await r.text()
  out.raw = text.slice(0, 3000)
  try { out.rows = JSON.parse(text) } catch (e) { out.rows = null }
  fs.writeFileSync(OUT, JSON.stringify(out, null, 2))
  console.log('http=' + r.status)
  console.log(text)
})().catch((e) => { console.error(String(e).slice(0, 400)); process.exit(1) })