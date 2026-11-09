// R88 LIVE CHECK — READ-ONLY: หน้าเว็บ prod ได้ bundle ใหม่หรือยัง (markers ของ R88)
// วิธี: ดึง index.html → ดึง index-*.js ทุกตัว → หา string literals ที่ minify ไม่หาย
'use strict'
const MARKERS = [
  '/admin/reviews',            // route ใน App.tsx
  'อนุมัติรีวิว',               // label nav ใน adminUi.ts
  'track-review-link-',        // data-testid ปุ่ม track (D6d)
  'อยู่ในคิวให้แอดมินอนุมัติ',     // toast หลังส่ง (D6b)
  'review-photo-album',        // testid อัลบั้ม (D6c/D8)
  'p_order_number:',           // D7: แมป args เป็นชื่อ p_ จริงใน DB
  'รูปจริง 32 ใบดูได้ที่เซคชัน Admin Portfolio', // D8: บรรทัดชี้ทางหลังย้ายอัลบั้ม
]
const SITE = 'https://biteme-baby.com'

async function main() {
  const t0 = Date.now()
  const home = await fetch(SITE + '/', { redirect: 'follow' })
  console.log('HOME [' + home.status + ']')
  if (!home.ok) { console.log('LIVE_CHECK_FAIL_NO_HOME'); process.exit(2) }
  const html = await home.text()
  const assets = [...new Set((html.match(/assets\/index-[A-Za-z0-9_-]+\.js/g) || []))]
  console.log('INDEX_ASSETS ' + assets.length + ' ' + assets.join(' '))
  if (!assets.length) { console.log('LIVE_CHECK_FAIL_NO_ASSET'); process.exit(3) }

  const found = {}
  for (const m of MARKERS) found[m] = false
  const extra = new Set()
  for (const a of assets) {
    const r = await fetch(SITE + '/' + a)
    if (!r.ok) { console.log('ASSET_FAIL ' + a + ' [' + r.status + ']'); continue }
    const js = await r.text()
    for (const m of MARKERS) if (js.includes(m)) found[m] = true
    // เก็บชื่อ lazy chunk ที่โยงกับหน้ารีวิว/ track (dynamic import string ใน entry)
    for (const c of (js.match(/[A-Za-z0-9_-]+\.js/g) || [])) {
      if (/Review|OrderTrack|Track/i.test(c) && c !== a.split('/').pop()) extra.add(c)
    }
  }
  console.log('LAZY_CANDIDATES ' + extra.size + ' ' + [...extra].slice(0, 20).join(' '))
  for (const c of extra) {
    const r = await fetch(SITE + '/assets/' + c)
    if (!r.ok) continue
    const js = await r.text()
    for (const m of MARKERS) if (js.includes(m)) found[m] = true
  }
  let ok = true
  for (const m of MARKERS) {
    console.log((found[m] ? 'FOUND   ' : 'MISSING ') + m)
    if (!found[m]) ok = false
  }
  console.log((ok ? 'LIVE_CHECK_ALL_MARKERS_OK' : 'LIVE_CHECK_MARKERS_PENDING (deploy อาจยังไม่เสร็จ — รันซ้ำภายหลัง)') + ' · ' + (Date.now() - t0) + 'ms')
  process.exit(ok ? 0 : 4)
}
main().catch(e => { console.error('ERR', String(e).slice(0, 300)); process.exit(1) })