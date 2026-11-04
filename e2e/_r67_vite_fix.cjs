'use strict'
// _r67_vite_fix — line-assert patch: add resolve.dedupe for react/react-dom
// Root cause (e2e/tmp_chunk5.cjs): production bundle contains TWO react copies
// (internals `w` @L1 + `h` @L11). react-dom renders with one, zustand gets the
// other via CJS interop → h.H = null → "Cannot read properties of null
// (reading 'useCallback')" at boot → every E2E case fails. dedupe forces ONE copy.
const fs = require('fs')
const FILE = 'vite.config.ts'
const lines = fs.readFileSync(FILE, 'utf8').split(/\r?\n/)

const ANCHOR = "      '@supabase/realtime-js': join(__dirname, 'src/lib/stubs/realtimeStub.ts'),"
const ai = lines.findIndex((l) => l.trim() === ANCHOR.trim())
if (ai === -1) { console.error('FAIL: anchor line not found'); process.exit(1) }
// anchor + next line must be the alias closing brace
if (lines[ai + 1].trim() !== '},') { console.error('FAIL: expected alias close after anchor, got: ' + lines[ai + 1]); process.exit(1) }
if (lines.some((l) => l.includes('dedupe'))) { console.log('SKIP: dedupe already present'); process.exit(0) }

const DEDUPE = '    // R67 boot-crash fix: force a SINGLE react instance across CJS/ESM interop'
const DEDUPE2 = '    // (two copies = zustand hook reads a dispatcher the renderer never sets).'
const DEDUPE3 = "    dedupe: ['react', 'react-dom', 'react/jsx-runtime', 'react/jsx-dev-runtime'],"

// insert after the alias block close (ai+1)
lines.splice(ai + 2, 0, DEDUPE, DEDUPE2, DEDUPE3)
fs.writeFileSync(FILE, lines.join('\n'), 'utf8')
console.log('OK: dedupe inserted after line ' + (ai + 2))
console.log('VERIFY:')
console.log(lines.slice(ai - 1, ai + 6).join('\n'))
