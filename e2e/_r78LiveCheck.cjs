// ============================================
// BMB R78 — live deploy check (READ-ONLY · ไม่แตะ production)
//   เทียบหน้า live biteme-baby.com กับ dist/ ท้องถิ่น (สร้างจาก HEAD = 9db6664 gates)
//   1) index.html = asset hashes ตรงกันไหม (deploy = HEAD build?)
//   2) sha256 ของ asset ทุกตัวที่ตรง path = byte-identical? (แบบ r55_prod_file)
//   3) marker R77 ใน entry JS: inapp-close / preorder-day-strip
// Evidence: e2e/_r78_live_check.json
// Usage: node e2e/_r78LiveCheck.cjs
// ============================================
'use strict'
const fs = require('fs')
const path = require('path')
const crypto = require('crypto')

const LIVE = 'https://biteme-baby.com'
const DIST = path.join(__dirname, '..', 'dist')
const OUT = path.join(__dirname, '_r78_live_check.json')

const sha256 = (buf) => crypto.createHash('sha256').update(buf).digest('hex')
const assetsOf = (html) => [...String(html).matchAll(/(?:src|href)=["']([^"']*\/assets\/[^"']+)["']/g)].map((m) => m[1])

;(async () => {
  const result = { at: new Date().toISOString(), live: LIVE, checks: [] }
  const t = (name, pass, detail) => { result.checks.push({ name, pass: !!pass, detail: String(detail).slice(0, 400) }) }

  const localIndex = fs.readFileSync(path.join(DIST, 'index.html'), 'utf8')
  const liveRes = await fetch(LIVE + '/', { headers: { 'user-agent': 'bmb-r78-probe' } })
  const liveHtml = await liveRes.text()
  t('live-http-200', liveRes.status === 200, 'status=' + liveRes.status)

  const localAssets = assetsOf(localIndex).map((a) => a.replace(/^\//, ''))
  const liveAssets = assetsOf(liveHtml).map((a) => a.replace(/^\//, ''))
  result.local_assets = localAssets
  result.live_assets = liveAssets
  const onlyLocal = localAssets.filter((x) => !liveAssets.includes(x))
  const onlyLive = liveAssets.filter((x) => !localAssets.includes(x))
  // entry+chunks ที่มี env define จะคนละ hash ข้ามเครื่อง (local .env.local vs CF build env) — ไม่ถือว่า fail
  // กติกา: ต้องไม่มีไฟล์ "ฝั่งเดียว" ที่ไม่ใช่ index-*.js (vendor/chunk ทั่วไปต้องชื่อตรงกันทั้งคู่)
  // index-*.js/css = hash ต่างได้ถูกต้อง (chain จาก md ที่ Tailwind scan → CSS ต่าง → entry ต่าง) — ยกเว้นคู่นี้
  const structuralOnlyLocal = onlyLocal.filter((x) => !/^assets\/index-[\w-]+\.(js|css)$/.test(x))
  const structuralOnlyLive = onlyLive.filter((x) => !/^assets\/index-[\w-]+\.(js|css)$/.test(x))
  t('asset-sets-structural-equal', structuralOnlyLocal.length === 0 && structuralOnlyLive.length === 0,
    'only_local=' + JSON.stringify(onlyLocal) + ' only_live=' + JSON.stringify(onlyLive))

  // byte-compare เฉพาะไฟล์ที่ชื่อตรงกัน (entry ตัวที่ชื่อไม่ตรง = ข้าม env → ข้ามการเทียบ hash)
  let identical = 0
  let comparable = 0
  const perFile = []
  for (const a of liveAssets.filter((x) => localAssets.includes(x))) {
    const localPath = path.join(DIST, a)
    if (!fs.existsSync(localPath)) { perFile.push({ asset: a, match: 'LOCAL_MISSING' }); continue }
    const r = await fetch(LIVE + '/' + a, { headers: { 'user-agent': 'bmb-r78-probe' } })
    if (!r.ok) { perFile.push({ asset: a, match: 'HTTP_' + r.status }); continue }
    const buf = Buffer.from(await r.arrayBuffer())
    const match = sha256(buf) === sha256(fs.readFileSync(localPath))
    comparable++
    if (match) identical++
    perFile.push({ asset: a, match: match ? 'IDENTICAL' : 'DIFF' })
  }
  result.assets = perFile
  t('shared-assets-byte-identical', comparable > 0 && identical === comparable,
    identical + '/' + comparable + ' identical · diffs=' + JSON.stringify(perFile.filter((p) => p.match !== 'IDENTICAL')))

  // marker R77 — ดึง live entry แล้วไล่ตาม dynamic import ไปเอา lazy chunk ด้วย
  // (preorder-day-strip = MenuPage · lazy — ไม่อยู่ใน index.html refs ต้อง parse จาก code)
  const markers = { inapp_close: false, notice_dismiss_key: false, preorder_strip: false, preorder_chip: false, inapp_open_external: false, gps_fb_blocked: false }
  const seen = new Set()
  const scanQueue = [...liveAssets]
  // entry ตัวที่ live ใช้จริง (ต่างจาก local เพราะ env define → hash คนละตัว — ต้อง scan ตัว live)
  const liveEntry = liveAssets.find((a) => /assets\/index-.*\.js$/.test(a))
  if (liveEntry) scanQueue.push(liveEntry)
  let scanned = 0
  while (scanQueue.length) {
    const a = scanQueue.shift()
    if (!a || seen.has(a)) continue
    seen.add(a)
    const r = await fetch(LIVE + '/' + a, { headers: { 'user-agent': 'bmb-r78-probe' } }).catch(() => null)
    if (!r || !r.ok) continue
    const txt = await r.text()
    scanned++
    if (txt.includes('inapp-close')) markers.inapp_close = true
    if (txt.includes('bmb:inapp-notice-dismissed')) markers.notice_dismiss_key = true
    if (txt.includes('preorder-day-strip')) markers.preorder_strip = true
    if (txt.includes('preorder-day-chip')) markers.preorder_chip = true
    if (txt.includes('inapp-open-external')) markers.inapp_open_external = true
    if (txt.includes('เบราว์เซอร์ของ Facebook ใช้ GPS ไม่ได้')) markers.gps_fb_blocked = true
    // เก็บ path ของ lazy chunks ที่อ้างในโค้ด (dynamic import) เพื่อ follow ต่อ
    for (const m of txt.matchAll(/["'(]\/?(assets\/[\w.-]+\.js)["')]/g)) {
      if (!seen.has(m[1])) scanQueue.push(m[1])
    }
  }
  result.r77_markers = markers
  result.chunks_scanned = scanned
  t('r77-markers-in-live-bundle',
    markers.inapp_close && markers.notice_dismiss_key && markers.preorder_strip && markers.preorder_chip && markers.inapp_open_external && markers.gps_fb_blocked,
    'chunks=' + scanned + ' ' + JSON.stringify(markers))

  result.pass = result.checks.every((c) => c.pass)
  result.pass_count = result.checks.filter((c) => c.pass).length
  result.total = result.checks.length
  fs.writeFileSync(OUT, JSON.stringify(result, null, 2))
  console.log('LIVE_CHECK ' + result.pass_count + '/' + result.total + (result.pass ? ' ALL_PASS' : ' HAS_FAIL') + ' → ' + OUT)
  for (const c of result.checks) console.log((c.pass ? 'PASS ' : 'FAIL ') + c.name + ' :: ' + c.detail)
  process.exit(result.pass ? 0 : 1)
})().catch((e) => {
  try { fs.writeFileSync(OUT, JSON.stringify({ at: new Date().toISOString(), fatal: String(e && e.stack || e) }, null, 2)) } catch {}
  console.log('FATAL ' + String(e && e.message || e))
  process.exit(1)
})