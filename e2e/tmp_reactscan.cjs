'use strict'
// tmp_reactscan — find duplicate react instances in dist chunks + nested node_modules react
const fs = require('fs')
const path = require('path')
console.log('== chunks with react markers ==')
for (const f of fs.readdirSync('dist/assets')) {
  if (!f.endsWith('.js')) continue
  const t = fs.readFileSync(path.join('dist/assets', f), 'utf8')
  const useSES = (t.match(/useSyncExternalStore/g) || []).length
  const reactDom = (t.match(/react-dom/g) || []).length
  const unstable = (t.match(/REACT_PROFILING|__SECRET_INTERNALS|ReactSharedInternals/g) || []).length
  if (useSES || reactDom || unstable) console.log(f, 'useSES=' + useSES, 'reactdom=' + reactDom, 'internals=' + unstable)
}
console.log('== nested react copies in node_modules ==')
function walk(dir, depth) {
  if (depth > 4) return
  let entries
  try { entries = fs.readdirSync(dir, { withFileTypes: true }) } catch { return }
  for (const e of entries) {
    if (!e.isDirectory()) continue
    if (e.name === 'react' || e.name === 'react-dom') {
      const pkg = path.join(dir, e.name, 'package.json')
      if (fs.existsSync(pkg)) {
        const v = JSON.parse(fs.readFileSync(pkg, 'utf8')).version
        console.log(path.join(dir, e.name) + ' v' + v)
      }
    }
    if (e.name === '.bin' || e.name === '.vite') continue
    walk(path.join(dir, e.name), depth + 1)
  }
}
walk('node_modules', 0)
console.log('DONE')
