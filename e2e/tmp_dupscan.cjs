'use strict'
// tmp_dupscan — count react-router module instances baked into dist + node_modules sources
const fs = require('fs')
const path = require('path')
const MARK = 'may be used only in the context of a <Router>'
const RRCRE = /createBrowserRouter|react-router v7|React Router/i

function count(file, mark) {
  try {
    const t = fs.readFileSync(file, 'utf8')
    return { hits: t.split(mark).length - 1, size: t.length }
  } catch (e) { return { hits: -1, size: -1 } }
}

console.log('--- node_modules/react-router/dist/production ---')
for (const f of fs.readdirSync('node_modules/react-router/dist/production')) {
  if (!/\.(js|mjs)$/.test(f)) continue
  const r = count(path.join('node_modules/react-router/dist/production', f), MARK)
  if (r.hits > 0) console.log('  ' + f + ' MARK=' + r.hits + ' size=' + r.size)
}
console.log('--- node_modules/react-router-dom/dist ---')
const rrd = 'node_modules/react-router-dom/dist'
if (fs.existsSync(rrd)) {
  for (const f of fs.readdirSync(rrd)) {
    if (!/\.(js|mjs)$/.test(f)) continue
    const r = count(path.join(rrd, f), MARK)
    if (r.hits > 0) console.log('  ' + f + ' MARK=' + r.hits + ' size=' + r.size)
  }
} else console.log('  (no dist dir)')
console.log('--- dist/assets (MARK + brand strings) ---')
for (const f of fs.readdirSync('dist/assets')) {
  if (!f.endsWith('.js')) continue
  const p = path.join('dist/assets', f)
  const t = fs.readFileSync(p, 'utf8')
  const m = t.split(MARK).length - 1
  // brand strings only present in react-router's own error text / dev messages
  const s1 = t.split('useNavigate() may be used only').length - 1
  const s2 = t.split('useLoaderData() may be used only').length - 1
  const s3 = t.split('useLocation() may be used only').length - 1
  const s4 = t.split('useParams() may be used only').length - 1
  const s5 = t.split('useSearchParams() may be used only').length - 1
  const s6 = t.split('useSubmit() may be used only').length - 1
  if (m || s1 || s2) console.log('  ' + f + ' MARK=' + m + ' nav=' + s1 + ' loader=' + s2 + ' loc=' + s3 + ' params=' + s4 + ' search=' + s5 + ' submit=' + s6)
}
console.log('DONE')