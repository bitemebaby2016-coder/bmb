// Production deploy robots/canonical gate for https://bitemebaby.com
// Usage: node scripts/checkProductionHeaders.cjs [url]
// Exit 0 = safe to be indexed · exit 1 = noindex/robots problem found.
// Checks:
//   1. X-Robots-Tag header must NOT contain noindex/nosnippet... (Cloudflare
//      pages.dev PREVIEW URLs send "X-Robots-Tag: noindex" automatically —
//      this gate catches it leaking into production)
//   2. <meta name="robots"> in served HTML must not be noindex
//   3. exactly ONE canonical and it must match https://bitemebaby.com/
//      (guards against the double-URL canonical regression)
//   4. /robots.txt reachable, not disallowing /
//   5. /sitemap.xml reachable
'use strict'
const BASE = (process.argv[2] || 'https://bitemebaby.com').replace(/\/+$/, '')
const EXPECTED_HOME = 'https://bitemebaby.com/'

function fail(msg) { console.log('FAIL ' + msg) }
function pass(msg) { console.log('PASS ' + msg) }

;(async () => {
  let bad = 0

  // 1) HTML + headers
  const res = await fetch(BASE + '/', { redirect: 'follow' })
  console.log('HTTP', res.status, res.url)
  if (!res.ok) { fail('homepage not reachable'); bad++ }

  const xrt = res.headers.get('x-robots-tag') || ''
  if (xrt && /noindex|none/i.test(xrt)) { fail('X-Robots-Tag: ' + xrt); bad++ }
  else pass('X-Robots-Tag ' + (xrt ? '(' + xrt + ')' : 'absent') + ' — no noindex')

  const html = await res.text()
  const robotsMeta = [...html.matchAll(/<meta\s+name=["']robots["'][^>]*content=["']([^"']*)["']/gi)].map(m => m[1])
  if (robotsMeta.some(c => /noindex|none/i.test(c))) { fail('meta robots: ' + robotsMeta.join(',')); bad++ }
  else pass('meta robots ' + (robotsMeta.join(',') || '(none)') + ' — no noindex')

  // 3) canonical: exactly one, correct value
  const canon = [...html.matchAll(/<link\s+rel=["']canonical["'][^>]*href=["']([^"']*)["']/gi)].map(m => m[1])
  if (canon.length === 0) { fail('no canonical in served HTML'); bad++ }
  else if (canon.length > 1) { fail('multiple canonicals: ' + canon.join(' | ')); bad++ }
  else if (canon[0] !== EXPECTED_HOME) { fail('canonical = ' + canon[0] + ' (expected ' + EXPECTED_HOME + ')'); bad++ }
  else pass('canonical ' + canon[0] + ' (single, correct)')

  // 4) robots.txt
  try {
    const r = await fetch(BASE + '/robots.txt')
    const t = r.ok ? await r.text() : ''
    const blockRoot = t.match(/^\s*disallow:\s*\/\s*$/im)
    if (!r.ok) { fail('robots.txt HTTP ' + r.status); bad++ }
    else if (blockRoot) { fail('robots.txt Disallow: /'); bad++ }
    else pass('robots.txt HTTP ' + r.status + ', root not disallowed')
  } catch (e) { fail('robots.txt fetch error: ' + String(e).slice(0, 120)); bad++ }

  // 5) sitemap.xml
  try {
    const s = await fetch(BASE + '/sitemap.xml')
    if (!s.ok) { fail('sitemap.xml HTTP ' + s.status); bad++ }
    else pass('sitemap.xml HTTP ' + s.status)
  } catch (e) { fail('sitemap.xml fetch error: ' + String(e).slice(0, 120)); bad++ }

  console.log(bad === 0 ? 'RESULT: ALL PASS — safe to be indexed' : 'RESULT: ' + bad + ' FAIL(S)')
  process.exit(bad === 0 ? 0 : 1)
})().catch((e) => { console.log('FAIL script error:', String(e).slice(0, 200)); process.exit(1) })
