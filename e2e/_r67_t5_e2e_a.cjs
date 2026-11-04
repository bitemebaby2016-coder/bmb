'use strict'
// _r67_t5_e2e_a — R67-T1 E2E fixes A+B (content-anchored):
//  A) TalkToBite.tsx — restore `home-menu-cta` (docs contract "testid kept for E2E")
//  B) runE2E.cjs — provider-option (ถูกถอดตาม audit) -> fulfillment-delivery
const fs = require('fs')

function findLine(lines, needle) {
  for (let i = 0; i < lines.length; i++) if (lines[i].includes(needle)) return i
  return -1
}

// ---- A) home-menu-cta button before ttb-enter-store ----
{
  const file = 'src/components/ai/TalkToBite.tsx'
  const lines = fs.readFileSync(file, 'utf8').split(/\r?\n/)
  const at = findLine(lines, 'data-testid="ttb-enter-store"')
  if (at < 0) { console.error('FAIL ttb-enter-store not found'); process.exit(1) }
  if (lines.some((l) => l.includes('home-menu-cta'))) { console.log('SKIP home-menu-cta already present') }
  else {
    const BTN = [
      '        <button type="button" onClick={() => navigate(\'/menu\')} className="btn btn-outline px-6 py-2.5 rounded-full text-sm font-medium" data-testid="home-menu-cta">',
      '          🍽️ ดูเมนูทั้งหมด',
      '        </button>',
    ]
    lines.splice(at, 0, ...BTN)
    fs.writeFileSync(file, lines.join('\n'), 'utf8')
    console.log('OK inserted home-menu-cta button @' + (at + 1))
  }
}

// ---- B) provider-option -> fulfillment-delivery ----
{
  const file = 'e2e/runE2E.cjs'
  const lines = fs.readFileSync(file, 'utf8').split(/\r?\n/)
  const at = findLine(lines, 'data-testid=\\"provider-option\\"')
  if (at < 0) {
    if (findLine(lines, 'fulfillment-delivery') >= 0) console.log('SKIP provider selector already updated')
    else { console.error('FAIL provider-option line not found'); process.exit(1) }
  } else {
    if (!lines[at].includes('waitForSelector')) { console.error('FAIL unexpected provider line: ' + lines[at]); process.exit(1) }
    lines[at] = lines[at].replace('provider-option', 'fulfillment-delivery')
    fs.writeFileSync(file, lines.join('\n'), 'utf8')
    console.log('OK provider-option -> fulfillment-delivery @' + (at + 1))
  }
}
console.log('ALL_E2E_AB_OK')
