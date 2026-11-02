// e2e/r55_review_imgs.cjs — เช็ครูปประกอบรีวิว 6 รายการ (ต้อง 200 + เป็นรูปจริง) + รายการสินค้าจริง
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

const REVIEW_IMGS = [
  'https://ivkdfognyiwjcmrhcnwz.supabase.co/storage/v1/object/public/bmb-images/products/prod-5/image.webp',
  'https://ivkdfognyiwjcmrhcnwz.supabase.co/storage/v1/object/public/bmb-images/products/prod-4/image.webp',
  'https://ivkdfognyiwjcmrhcnwz.supabase.co/storage/v1/object/public/bmb-images/products/prod-1789607383214-t8rm95/image.webp',
  'https://ivkdfognyiwjcmrhcnwz.supabase.co/storage/v1/object/public/bmb-images/products/prod-1789610117076-2p5e8u/image.webp',
  'https://ivkdfognyiwjcmrhcnwz.supabase.co/storage/v1/object/public/bmb-images/products/prod-3/image.webp',
  'https://ivkdfognyiwjcmrhcnwz.supabase.co/storage/v1/object/public/bmb-images/uploads/1793068885663-Fish_ShipS.webp',
]

;(async () => {
  console.log('REVIEW IMAGES:')
  for (const u of REVIEW_IMGS) {
    try {
      const r = await fetch(u, { method: 'GET' })
      const buf = r.ok ? Buffer.from(await r.arrayBuffer()) : null
      console.log(`  ${r.status} bytes=${buf ? buf.length : 0} ${u.split('/').slice(-2).join('/')}`)
    } catch (e) {
      console.log(`  ERR ${e.message} ${u}`)
    }
  }
  const pr = await fetch(`${URL}/rest/v1/products?select=id,name,image_url,is_available&limit=80`, {
    headers: { apikey: KEY, Authorization: `Bearer ${KEY}` },
  })
  const raw = await pr.text()
  let j
  try { j = JSON.parse(raw) } catch { console.log('PRODUCTS HTTP', pr.status, raw.slice(0, 300)); return }
  console.log(`PRODUCTS (${Array.isArray(j) ? j.length : 'ERR'}):`)
  if (Array.isArray(j)) j.forEach((p) => console.log(`  ${p.id} | ${p.name} | img=${p.image_url || 'NONE'} | avail=${p.is_available}`))
})().catch((e) => console.log('FATAL ' + e.message))
