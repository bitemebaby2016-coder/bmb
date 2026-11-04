'use strict'
// _r67_t5_e2e_e — click-robustness: Header + FloatingCart BOTH render a[href="/cart"]
// (strict-mode multiple match would throw) — pin clicks to the first match.
// Assertions/records untouched. Applied to every `page.click('a[href="/cart"]')`.
const fs = require('fs')
const FILE = 'e2e/runE2E.cjs'
const lines = fs.readFileSync(FILE, 'utf8').split(/\r?\n/)
let n = 0
for (let i = 0; i < lines.length; i++) {
  if (lines[i].includes("page.click('a[href=\"/cart\"]')")) {
    lines[i] = lines[i].replace(
      "page.click('a[href=\"/cart\"]')",
      "page.locator('a[href=\"/cart\"]').first().click()",
    )
    n++
    console.log('OK @' + (i + 1) + ': ' + lines[i].trim())
  }
}
fs.writeFileSync(FILE, lines.join('\n'), 'utf8')
console.log('cart clicks hardened=' + n)
if (n < 1) { console.error('FAIL no cart clicks found'); process.exit(1) }
console.log('E2E_E_OK')
