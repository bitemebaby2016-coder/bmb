// R44 T9 — crawl ทุก JS chunk ของ production หา AIza / ข้อความ key หาย (read-only)
// node e2e/r44_maps_bundle_probe.cjs
'use strict'
;(async () => {
  const get = async (u) => (await fetch(u, { signal: AbortSignal.timeout(20000) })).text()
  const html = await get('https://biteme-baby.com/')
  const seen = new Set()
  const queue = [...html.matchAll(/(?:src|href)="(\/assets\/[^"]+\.js)"/g)].map((m) => m[1])
  const out = { ran_at: new Date().toISOString(), hits: [], checked: 0, aiza_files: [], missing_msg_files: [] }
  while (queue.length && seen.size < 150) {
    const a = queue.shift()
    if (seen.has(a)) continue
    seen.add(a)
    const js = await get('https://biteme-baby.com' + a)
    out.checked++
    const aiza = js.match(/AIza[A-Za-z0-9_\-]{20,}/)
    if (aiza) out.aiza_files.push({ asset: a, sample: aiza[0].slice(0, 8) + '…(masked)' })
    if (js.includes('ไม่พบ VITE_GOOGLE_MAPS_API_KEY')) out.missing_msg_files.push(a)
    for (const m of js.matchAll(/["'(]((?:\.\/|\/)?(?:assets\/)?[A-Za-z0-9_./-]+\.js)["')]/g)) {
      let u = m[1]
      if (/^https?:/.test(u)) continue
      if (u.startsWith('./')) u = '/assets/' + u.slice(2)
      else if (u.startsWith('assets/')) u = '/' + u
      if (!u.startsWith('/assets/')) continue
      if (!seen.has(u)) queue.push(u)
    }
  }
  out.total_seen = seen.size
  out.queue_left = queue.length
  console.log('CHECKED=' + out.checked + ' AIZA_FILES=' + JSON.stringify(out.aiza_files))
  console.log('MISSING_MSG_FILES=' + JSON.stringify(out.missing_msg_files))
  require('fs').writeFileSync(require('path').join(__dirname, 'r44_maps_bundle_probe.json'), JSON.stringify(out, null, 2))
  console.log('SAVED e2e/r44_maps_bundle_probe.json')
})().catch((e) => { console.log('FATAL ' + String(e).slice(0, 300)); process.exitCode = 1 })