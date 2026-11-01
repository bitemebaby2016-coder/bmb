// R44 T9 attempt-2 — ยิง Maps JS loader endpoint แล้วอ่าน marker ข้อผิดพลาด (browser จะได้ 200+JS
// ที่ฝัง error code เช่น InvalidKey/RefererNotAllowed/BillingNotEnabled)
// node e2e/r44_gmaps_key_probe.cjs
'use strict'
;(async () => {
  const js = await (await fetch('https://biteme-baby.com/assets/googleMaps-BahH_a9T.js', { signal: AbortSignal.timeout(20000) })).text()
  const m = js.match(/AIza[A-Za-z0-9_\-]{20,}/)
  if (!m) { console.log('NO_KEY_IN_CHUNK'); process.exitCode = 1; return }
  const key = m[0]
  console.log('KEY_FOUND masked=' + key.slice(0, 8) + '… len=' + key.length)
  const out = { ran_at: new Date().toISOString(), key_masked: key.slice(0, 8) + '…', attempts: [] }
  // attempt A: Maps JS API loader
  try {
    const url = 'https://maps.googleapis.com/maps/api/js?key=' + key + '&v=weekly&callback=x'
    const r = await fetch(url, { signal: AbortSignal.timeout(15000) })
    const body = await r.text()
    const markers = ['InvalidKey', 'RefererNotAllowed', 'BillingNotEnabled', 'ApiNotActivated', 'REQUEST_DENIED', 'MissingKey', 'InvalidRequests', 'quota', 'DeletedApiProject']
    const found = markers.filter((s) => body.includes(s))
    console.log('JS_LOADER HTTP=' + r.status + ' bytes=' + body.length + ' markers=' + JSON.stringify(found))
    out.attempts.push({ kind: 'js_loader', http: r.status, bytes: body.length, markers: found, head: body.slice(0, 300) })
  } catch (e) { console.log('JS_LOADER_ERR ' + e); out.attempts.push({ kind: 'js_loader', err: String(e).slice(0, 200) }) }
  // attempt B: geocoding legacy endpoint (region=th รอบสองหลัง 404 รอบแรก)
  try {
    const url = 'https://maps.googleapis.com/maps/api/geocoding/json?address=Chanthaburi&region=th&key=' + key
    const r = await fetch(url, { signal: AbortSignal.timeout(15000) })
    const body = await r.text()
    console.log('GEOCODING HTTP=' + r.status + ' head=' + body.slice(0, 200).replace(/\s+/g, ' '))
    let status = null, em = null
    try { const j = JSON.parse(body); status = j.status; em = j.error_message || null } catch { /* non-json */ }
    console.log('GEO_STATUS=' + status + (em ? ' ERR=' + em : ''))
    out.attempts.push({ kind: 'geocoding', http: r.status, status, error_message: em, head: body.slice(0, 300) })
  } catch (e) { console.log('GEOCODING_ERR ' + e); out.attempts.push({ kind: 'geocoding', err: String(e).slice(0, 200) }) }
  require('fs').writeFileSync(require('path').join(__dirname, 'r44_gmaps_key_probe.json'), JSON.stringify(out, null, 2))
  console.log('SAVED e2e/r44_gmaps_key_probe.json')
})().catch((e) => { console.log('FATAL ' + String(e).slice(0, 300)); process.exitCode = 1 })