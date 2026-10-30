// e68: walk หาที่อยู่ cartPersistence / products fetch / deep-link handler (pattern ในไฟล์ — ไม่ผ่าน cmd) — ใช้เสร็จลบ
const fs = require('fs')
const path = require('path')
const ROOT = path.resolve(__dirname, '..')
const PATTERNS = {
  cartPersistence: /cartPersistence|persistCart|rehydrat/,
  productsFetch: /rest\/v1\/products|getProducts|fetchProducts|loadProducts|useProducts/,
  deepLink: /URLSearchParams|location\.search|searchParams\.get/,
  refParam: /get\('ref'\)|\?ref=/,
}
function walk(dir, out = []) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    if (['node_modules', '.git', 'dist'].includes(e.name)) continue
    const p = path.join(dir, e.name)
    if (e.isDirectory()) walk(p, out)
    else if (/\.(ts|tsx)$/.test(e.name)) out.push(p)
  }
  return out
}
const files = walk(path.join(ROOT, 'src'))
for (const [group, re] of Object.entries(PATTERNS)) {
  console.log('=== ' + group + ' ===')
  let hits = 0
  for (const f of files) {
    if (hits >= 25) break
    const lines = fs.readFileSync(f, 'utf8').split('\n')
    lines.forEach((l, i) => {
      if (hits >= 25) return
      if (re.test(l)) { console.log(path.relative(ROOT, f) + ':' + (i + 1) + ': ' + l.trim().slice(0, 140)); hits++ }
    })
  }
  if (hits === 0) console.log('(no hits)')
}