'use strict'
// _close_prodvendor — LIVE react-vendor must contain exactly ONE react-router copy
// (two copies = "/" crashes with useNavigate-outside-Router — the R67 boot bug)
;(async () => {
  const html = await (await fetch('https://biteme-baby.com/', { headers: { 'User-Agent': 'bmb-probe' } })).text()
  const vendor = (html.match(/href="(\/assets\/react-vendor-[^"]+)"/) || [])[1]
  if (!vendor) { console.log('NO_REACT_VENDOR_IN_HTML'); process.exit(1) }
  const js = await (await fetch('https://biteme-baby.com' + vendor, { headers: { 'User-Agent': 'bmb-probe' } })).text()
  const NAV = 'useNavigate() may be used only in the context of a <Router>'
  const LOC = 'useLocation() may be used only in the context of a <Router>'
  const navCount = js.split(NAV).length - 1
  const locCount = js.split(LOC).length - 1
  const out = { at: new Date().toISOString(), vendor, size: js.length, navCount, locCount, verdict: navCount === 1 && locCount === 1 ? 'SINGLE_ROUTER_COPY_LIVE' : 'DUPLICATED_ROUTER_LIVE' }
  require('fs').writeFileSync(require('path').join(__dirname, '_close_prodvendor.json'), JSON.stringify(out, null, 2), 'utf8')
  console.log(out.verdict + ' ' + vendor + ' nav=' + navCount + ' loc=' + locCount)
  process.exit(navCount === 1 ? 0 : 1)
})().catch((e) => { console.log('FATAL ' + String(e).slice(0, 300)); process.exit(1) })