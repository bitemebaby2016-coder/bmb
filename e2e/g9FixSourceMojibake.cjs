// G9 repair: fix mojibake runs inside source files (UTF-8 text that was written
// through a CP1252-mangling shell). A mojibake run is the CP1252-decoded view of
// original UTF-8 bytes; repair = map chars back to CP1252 bytes, decode UTF-8.
// Usage: node e2e/g9FixSourceMojibake.cjs src/lib/adminUi.ts src/lib/bmbAdminApi_rounds.ts
const fs = require('fs')

// CP1252 single-byte map (0x80-0x9F specials + 0xA0-0xFF identity)
const CP1252 = new Map()
const specials = {
  0x80: 0x20ac, 0x82: 0x201a, 0x83: 0x0192, 0x84: 0x201e, 0x85: 0x2026,
  0x86: 0x2020, 0x87: 0x2021, 0x88: 0x02c6, 0x89: 0x2030, 0x8a: 0x0160,
  0x8b: 0x2039, 0x8c: 0x0152, 0x8e: 0x017d, 0x91: 0x2018, 0x92: 0x2019,
  0x93: 0x201c, 0x94: 0x201d, 0x95: 0x2022, 0x96: 0x2013, 0x97: 0x2014,
  0x98: 0x02dc, 0x99: 0x2122, 0x9a: 0x0161, 0x9b: 0x203a, 0x9c: 0x0153,
  0x9e: 0x017e, 0x9f: 0x0178,
}
for (let b = 0x80; b <= 0xff; b++) CP1252.set(specials[b] ?? b, b)
// latin1-mangled runs decode 0x80-0x9F as C1 controls (not CP1252 punctuation) —
// accept BOTH decodes of the same byte
for (let b = 0x80; b <= 0x9f; b++) CP1252.set(b, b)
// marker chars that only appear in mojibake runs of these files
// (U+0080-U+00FF covers Latin-1/C1 mojibake bytes incl. NBSP/`¸`/`¹` — the Thai
//  mojibake signature — plus the CP1252 punctuation/emoji decode chars)
const RUN = /[\u0080-\u00ff\u0152\u0153\u0160\u0161\u0178\u017d\u017e\u0192\u02c6\u02dc\u20ac\u2018\u2019\u201a\u201c\u201d\u201e\u2020\u2021\u2022\u2026\u2030\u2039\u203a\u2013\u2014\u2122]+/g

function repairRun(s) {
  const bytes = []
  for (const ch of s) {
    const b = CP1252.get(ch.codePointAt(0))
    if (b === undefined) return null
    bytes.push(b)
  }
  try {
    const decoded = new TextDecoder('utf-8', { fatal: true }).decode(Uint8Array.from(bytes))
    return decoded
  } catch {
    return null
  }
}

let fixedFiles = 0
for (const file of process.argv.slice(2)) {
  const before = fs.readFileSync(file, 'utf8')
  let fixedRuns = 0
  let skipped = 0
  const after = before.replace(RUN, (run) => {
    const out = repairRun(run)
    if (out == null) {
      skipped++
      const cps = [...run].map((c) => 'U+' + c.codePointAt(0).toString(16).toUpperCase().padStart(4, '0')).join(' ')
      console.log(`SKIP file=${file} cps=${cps}`)
      return run
    }
    fixedRuns++
    return out
  })
  if (after !== before) {
    fs.writeFileSync(file, after, 'utf8')
    fixedFiles++
  }
  console.log(`FILE=${file} runs_fixed=${fixedRuns} runs_skipped=${skipped} changed=${after !== before}`)
}
console.log(`FIXED_FILES=${fixedFiles}`)