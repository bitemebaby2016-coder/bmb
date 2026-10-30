// e66: ค้น pattern ใน BMB (findstr/PS เดี้ยง — node ชัวร์) — ใช้เสร็จลบ
const fs = require('fs')
const path = require('path')
const ROOT = path.resolve(__dirname, '..')
const QUERIES = {
  cart: [/useCartStore/, /addToCart/, /create<[^>]*cart/i, /cartItems/, /hydrateCart/],
  qr: [/qrserver/, /qrcode/, /QRCode/, /promptpay/i, /toDataURL/],
  waiter: [/TalkToBite/, /aiDbContext/, /bitePersona/, /BITE_PERSONA/],
  printCallers: [/printOrderTicket/, /runAutoPrintPair/],
  shop: [/path=['"]\/shop/, /ShopPage/, /CheckoutPage/],
}
function walk(dir, out = []) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    if (e.name === 'node_modules' || e.name === '.git' || e.name === 'dist') continue
    const p = path.join(dir, e.name)
    if (e.isDirectory()) walk(p, out)
    else if (/\.(ts|tsx)$/.test(e.name)) out.push(p)
  }
  return out
}
const files = [...walk(path.join(ROOT, 'src')), ...walk(path.join(ROOT, 'e2e')).filter((f) => f.endsWith('.cjs'))]
for (const [group, pats] of Object.entries(QUERIES)) {
  console.log('=== ' + group + ' ===')
  let hits = 0
  for (const f of files) {
    if (hits > 30) break
    const lines = fs.readFileSync(f, 'utf8').split('\n')
    lines.forEach((l, i) => {
      if (hits > 30) return
      if (pats.some((p) => p.test(l))) {
        console.log(path.relative(ROOT, f) + ':' + (i + 1) + ': ' + l.trim().slice(0, 150))
        hits++
      }
    })
  }
  if (hits === 0) console.log('(no hits)')
}