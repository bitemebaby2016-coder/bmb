'use strict'
// _r67_t5_e2e_d — restore the documented "greeting/pointing" mascot pair on the
// landing: wrap home-menu-cta with the pointing mascot (mascot-point-cta class
// + animation already exist from the original design). E2E record
// "landing renders + mascots (greeting/pointing)" needs >= 2 img.mascot-badge.
const fs = require('fs')
const FILE = 'src/components/ai/TalkToBite.tsx'
const lines = fs.readFileSync(FILE, 'utf8').split(/\r?\n/)

const at = lines.findIndex((l) => l.includes('data-testid="home-menu-cta"'))
if (at < 0) { console.error('FAIL home-menu-cta not found'); process.exit(1) }
if (lines.some((l) => l.includes('mascot-point-cta'))) { console.log('SKIP pointing mascot already present'); process.exit(0) }

// button block = 3 lines starting at `at` (open, label, close)
if (!lines[at + 2].includes('</button>')) { console.error('FAIL unexpected button block shape'); process.exit(1) }

const WRAP_OPEN = [
  '        <div className="relative inline-block">',
  '          <MascotBadge pose="pointing" size="sm" alt="Bite the mascot pointing at the order menu button" className="mascot-point-cta" loading="eager" />',
]
const WRAP_CLOSE = ['        </div>']
// re-indent button lines by 2 spaces
for (let i = at; i < at + 3; i++) lines[i] = '  ' + lines[i]
// insert close after button, open before button
lines.splice(at + 3, 0, ...WRAP_CLOSE)
lines.splice(at, 0, ...WRAP_OPEN)

fs.writeFileSync(FILE, lines.join('\n'), 'utf8')
console.log('OK wrapped home-menu-cta with pointing mascot @' + (at + 1))
console.log('E2E_D_OK')
