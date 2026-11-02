// e2e/r53_products.cjs — ดึงรายการสินค้าจริง (anon SELECT) เลือกรูป decorative สำหรับการ์ดรีวิว (N4 fix)
const fs = require('fs')
const path = require('path')
const ROOT = path.join(__dirname, '..')
function env(key) {
  const txt = fs.readFileSync(path.join(ROOT, '.env'), 'utf8')
  const m = new RegExp(`^${key}=(.*)$`, 'm').exec(txt)
  return m ? m[1].trim() : ''
}
const URL = env('VITE_SUPABASE_URL')
const KEY = env('VITE_SUPABASE_ANON_KEY')
fetch(`${URL}/rest/v1/products?select=id,name,image_url,is_available,is_preorder&limit=60`, {
  headers: { apikey: KEY, Authorization: `Bearer ${KEY}` },
})
  .then(async (r) => {
    const j = await r.json()
    if (!Array.isArray(j)) { console.log('FAIL', JSON.stringify(j).slice(0, 200)); return }
    console.log('COUNT', j.length)
    for (const p of j) console.log(`${p.id} | ${p.name} | img=${p.image_url || 'NONE'} | avail=${p.is_available} | pre=${p.is_preorder}`)
  })
  .catch((e) => console.log('ERR', e && e.message))