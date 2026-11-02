// N4 helper — list public/assets/reviews (READ-ONLY)
const fs = require('fs')
const path = require('path')
const base = path.join(__dirname, '..', 'public', 'assets', 'reviews')
function list(dir, label) {
  try {
    const a = fs.readdirSync(dir)
    console.log(label, a.length)
    console.log(a.join(' | '))
  } catch (e) {
    console.log(label, 'ERR', e.message)
  }
}
list(base, 'ROOT')
list(path.join(base, 'small'), 'SMALL')
// subdirs?
try {
  for (const e of fs.readdirSync(base, { withFileTypes: true })) {
    if (e.isDirectory()) list(path.join(base, e.name), 'DIR:' + e.name)
  }
} catch { /* noop */ }