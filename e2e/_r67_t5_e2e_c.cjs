'use strict'
// _r67_t5_e2e_c — R67-T1: rewrite FLOW B to the CURRENT pre-order UX
// (pre-order flows through cart/checkout — createPreOrder was closed 2026-09-17).
// Assertion kept verbatim: tracking badge must contain 'PO-'.
const fs = require('fs')

function findLine(lines, needle) {
  for (let i = 0; i < lines.length; i++) if (lines[i].includes(needle)) return i
  return -1
}

const file = 'e2e/runE2E.cjs'
const lines = fs.readFileSync(file, 'utf8').split(/\r?\n/)
const start = findLine(lines, 'FLOW B: pre-order')
const rec = findLine(lines, "record('pre-order real order → tracking'")
if (start < 0 || rec < 0) { console.error('FAIL flow B block not found'); process.exit(1) }
let end = rec
while (end < lines.length && lines[end].trim() !== '}') end++
if (end >= lines.length) { console.error('FAIL flow B closing brace not found'); process.exit(1) }

const NEW = [
  '// ---------- FLOW B: pre-order -> cart -> checkout -> payment -> tracking (PO-) ----------',
  '    {',
  '      const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true })',
  '      const page = await ctx.newPage()',
  '      if (testUser) await loginUser(page, testUser.email, testUser.password)',
  "      page.on('console', (msg) => { if (msg.type() === 'error') errors.push('B:' + msg.text.slice(0, 200)) })",
  "      page.on('pageerror', (e) => errors.push('B-pageerror:' + String(e).slice(0, 200)))",
  '',
  "      await page.goto(BASE + '/menu', { waitUntil: 'networkidle', timeout: 45000 })",
  "      await page.waitForSelector('[data-testid=\"pre-order-tab\"]', { timeout: 15000 })",
  "      await page.click('[data-testid=\"pre-order-tab\"]')",
  "      await page.waitForSelector('[data-testid=\"pre-order-btn\"]', { timeout: 15000 })",
  "      await page.screenshot({ path: path.join(SHOTS, '07-menu-preorder.png'), fullPage: false })",
  '',
  "      await page.click('[data-testid=\"pre-order-btn\"] >> nth=0')",
  "      try { await page.waitForSelector('[data-testid=\"ob-confirm\"]', { timeout: 8000 }) } catch {}",
  "      const ob2 = await page.locator('[data-testid=\"ob-confirm\"]').count()",
  '      if (ob2 > 0) {',
  "        await page.locator('[data-testid=\"ob-confirm\"]').click()",
  '        await sleep(500)',
  '      }',
  '',
  "      await page.click('a[href=\"/cart\"]')",
  "      await page.waitForSelector('[data-testid=\"go-checkout\"]', { timeout: 15000 })",
  "      await page.click('[data-testid=\"go-checkout\"]')",
  "      await page.waitForSelector('[data-testid=\"checkout-address\"]', { timeout: 15000 })",
  "      await page.fill('[data-testid=\"checkout-address\"]', '123 Sukhumvit Rd, E2E Test')",
  "      await page.waitForSelector('[data-testid=\"place-order\"]', { timeout: 15000 })",
  '      await page.waitForFunction(() => {',
  "        const b = document.querySelector('[data-testid=\"place-order\"]');",
  '        return b && !b.disabled;',
  '      }, { timeout: 15000 }).catch(() => {})',
  "      await page.screenshot({ path: path.join(SHOTS, '07b-preorder-checkout.png'), fullPage: false })",
  "      await page.click('[data-testid=\"place-order\"]')",
  '      await page.waitForURL(/\\/payment\\//, { timeout: 30000 })',
  '      await sleep(2500)',
  "      const txn2 = '15160001' + String(Date.now()).slice(-8)",
  "      await page.waitForSelector('[data-testid=\"txn-input\"]', { timeout: 15000 })",
  "      await page.fill('[data-testid=\"txn-input\"]', txn2)",
  "      await page.click('[data-testid=\"confirm-payment\"]')",
  '      await page.waitForURL(/\\/track\\//, { timeout: 30000 })',
  "      await page.waitForSelector('[data-testid=\"track-order-number\"]', { timeout: 15000 })",
  "      const preBadge = await page.locator('[data-testid=\"track-order-number\"]').textContent()",
  "      await page.screenshot({ path: path.join(SHOTS, '08-preorder-tracking.png'), fullPage: false })",
  "      record('pre-order real order → tracking', preBadge !== null && String(preBadge).includes('PO-'), { badge: preBadge })",
  '      await ctx.close()',
  '    }',
]
lines.splice(start, end - start + 1, ...NEW)
fs.writeFileSync(file, lines.join('\n'), 'utf8')
console.log('OK flow B rewritten @' + (start + 1) + '-' + (end + 1) + ' -> ' + NEW.length + ' lines')
console.log('ALL_E2E_C_OK')
