// temp: collapse accidental multi-blank-line runs in new test files (DELETE at session end)
const fs = require('fs')
const path = require('path')
const ROOT = 'D:/A PROJECT/Bite Me Baby'
const files = [
  'src/__tests__/menuTopTabs.test.ts',
  'src/__tests__/headingOrderFooter.test.ts',
  'src/__tests__/votePageUi.test.ts',
  'src/__tests__/preOrderLockUi.test.ts',
  'src/__tests__/uiTapScroll.test.ts',
]
for (const f of files) {
  const p = path.join(ROOT, f)
  const s = fs.readFileSync(p, 'utf8')
  const eol = s.includes('\r\n') ? '\r\n' : '\n'
  const lines = s.split(/\r?\n/)
  const out = []
  let empties = 0
  for (const l of lines) {
    if (l.trim() === '') {
      empties++
      if (empties <= 1) out.push('')
    } else {
      empties = 0
      out.push(l)
    }
  }
  const c = out.join(eol)
  if (c !== s) { fs.writeFileSync(p, c); console.log('collapsed', f) } else { console.log('unchanged', f) }
}
