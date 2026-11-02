// N2 DB check — อ่าน business_settings.theater_daily_copy จาก production ผ่าน anon (policy 164)
// READ-ONLY · key อ่านจาก .env ตอนรัน (ไม่ hardcode · ไม่พิมพ์ key ออก stdout)
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
if (!URL || !KEY) { console.log('MISSING_ENV'); process.exit(1) }
const endpoint = `${URL}/rest/v1/business_settings?key=eq.theater_daily_copy&select=value&limit=1`
fetch(endpoint, { headers: { apikey: KEY, Authorization: `Bearer ${KEY}` } })
  .then(async (r) => {
    console.log('HTTP', r.status)
    const j = await r.json()
    if (!Array.isArray(j) || j.length === 0) { console.log('NO_ROW'); return }
    const s = JSON.stringify(j[0].value ?? {})
    const variants = ['ไบ๊', 'ไบท์', 'ไบท', 'บั๊บ', 'บิท', 'บี้บ']
    const found = variants.filter((v) => s.includes(v))
    console.log('FOUND_VARIANTS', found.length ? found.join(',') : 'NONE')
    console.log('SIZE', s.length)
    // แสดงบรรทัดที่เจอ (ไม่รวม key ใด ๆ)
    for (const v of found) {
      const i = s.indexOf(v)
      console.log(`CTX[${v}]`, s.slice(Math.max(0, i - 60), i + 60))
    }
  })
  .catch((e) => { console.log('ERR', e && e.message) })