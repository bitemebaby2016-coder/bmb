// TT VERIFY 2 (ครั้งเดียว): ทำไม verified 1 ใบไม่ขึ้น — เช็ก product_id ของรีวิว + catalog
//   + ตรวจ bundle จริงว่ามี marker "Verified Purchase" + การ์ด verified ถูก wire เข้า HomePage
'use strict'
const fs = require('fs')
const path = require('path')

const ROOT = path.resolve(__dirname, '..')
const PROJECT_REF = 'ivkdfognyiwjcmrhcnwz'
const env = {}
for (const f of ['.env.local', '.env']) {
  try {
    for (const l of fs.readFileSync(path.join(ROOT, f), 'utf8').split(/\r?\n/)) {
      const m = l.match(/^([A-Za-z0-9_]+)=(.*)$/)
      if (m && !(m[1] in env)) env[m[1]] = m[2].trim()
    }
  } catch { /* skip */ }
}
const TOKENS = [env.SUPABASE_ACCESS_TOKEN, env.bmb_PAT_SUPABASE_ACCESS_TOKEN].filter(Boolean)

async function sql(query) {
  for (const tok of TOKENS) {
    const r = await fetch('https://api.supabase.com/v1/projects/' + PROJECT_REF + '/database/query', {
      method: 'POST',
      headers: { apikey: tok, Authorization: 'Bearer ' + tok, 'Content-Type': 'application/json' },
      body: JSON.stringify({ query }),
    })
    const text = await r.text()
    if (r.status === 200 || r.status === 201) return { ok: true, data: JSON.parse(text) }
  }
  return { ok: false }
}

function get(url, headers) {
  return new Promise((resolve, reject) => {
    https
      .get(url, { headers: headers || { 'user-agent': 'Mozilla/5.0 (bmb-tt-verify2)' } }, (r) => {
        let d = ''
        r.on('data', (c) => (d += c))
        r.on('end', () => resolve({ status: r.statusCode, body: d }))
      })
      .on('error', reject)
  })
}
const https = require('https')

;(async () => {
  // 1) รีวิว approved → product_id + จำนวน products
  const rv = await sql("SELECT id, product_id, product_name_display, status FROM public.reviews WHERE status='approved'")
  console.log('APPROVED_ROWS ' + JSON.stringify(rv.ok ? rv.data : rv))
  const pc = await sql("SELECT COUNT(*)::int AS n FROM public.products")
  console.log('PRODUCT_COUNT ' + JSON.stringify(pc.ok ? pc.data : pc))
  // 2) product ของรีวิวอยู่ในตาราง products จริงไหม + is_available
  if (rv.ok && rv.data && rv.data[0] && rv.data[0].product_id) {
    const pid = String(rv.data[0].product_id).replace(/'/g, "''")
    const p = await sql("SELECT id, name, is_available FROM public.products WHERE id = '" + pid + "'")
    console.log('REVIEW_PRODUCT ' + JSON.stringify(p.ok ? p.data : p))
  }
  // 3) bundle จริง — marker การ์ด verified + wiring
  const idx = await get('https://biteme-baby.com/shop')
  console.log('SHOP_HTML ' + idx.status)
  const m = idx.body.match(/assets\/index-[\w-]+\.js/)
  if (!m) { console.log('NO_ASSET'); process.exit(1) }
  const js = await get('https://biteme-baby.com/' + m[0])
  console.log('ASSET ' + m[0] + ' ' + js.status + ' bytes=' + js.body.length)
  const markers = {
    VERIFIED_PURCHASE_LABEL: /Verified Purchase/.test(js.body),
    D5_NEW_COPY: /ไม่มีรอบส่ง/.test(js.body),
    REVIEW_STORE_LOGO: /review-store-logo/.test(js.body),
    OLD_HEADING_GONE: !/verified-reviews-heading/.test(js.body),
  }
  console.log('BUNDLE_MARKERS ' + JSON.stringify(markers))
  console.log('TT_VERIFY2_DONE')
})().catch((e) => {
  console.error('ERR', e.message)
  process.exit(1)
})