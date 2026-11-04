'use strict'
// tmp_reactscan2 — count REAL react copies per chunk via React 19 internals key
const fs = require('fs')
const path = require('path')
const MARKERS = [
  '__CLIENT_INTERNALS_DO_NOT_USE_OR_WARN_USERS_THEY_CANNOT_UPGRADE',
  '__SERVER_INTERNALS_DO_NOT_USE_OR_WARN_USERS_THEY_CANNOT_UPGRADE',
  'react.transitional.element',
  'react.element',
]
for (const f of fs.readdirSync('dist/assets')) {
  if (!f.endsWith('.js')) continue
  const t = fs.readFileSync(path.join('dist/assets', f), 'utf8')
  const hits = MARKERS.map((m) => (t.split(m).length - 1)).reduce((a, b) => a + b, 0)
  const importReact = /from\s*"\.\/react-vendor[^"]*"/.test(t) || /from"\.\/react-vendor[^"]*"/.test(t)
  if (hits > 0 || /useCallback/.test(t)) console.log(f, 'markerHits=' + hits, 'importsReactVendor=' + importReact)
}
const pkg = JSON.parse(fs.readFileSync('package.json', 'utf8'))
console.log('zustand=' + (pkg.dependencies && pkg.dependencies.zustand))
console.log('DONE')
