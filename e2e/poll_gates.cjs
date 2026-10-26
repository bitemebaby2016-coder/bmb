// temp poll for bmb_gatesui.bat (DELETE at session end)
const fs = require('fs')
const p = 'D:/A PROJECT/Bite Me Baby/e2e/gates_ui2026-10-26.log'
if (!fs.existsSync(p)) { console.log('LOG NOT STARTED'); process.exit(1) }
const s = fs.readFileSync(p, 'utf8')
if (s.includes('==== DONE ====')) {
  const exits = s.match(/(?:TSC|LINT|BRAND|VITEST|BUILD)_EXIT=\d+/g) || []
  console.log(exits.join('\n'))
  const allZero = exits.length === 5 && exits.every((e) => e.endsWith('=0'))
  console.log(allZero ? 'ALL_GATES_ZERO' : 'GATES_HAS_NONZERO_OR_INCOMPLETE')
  const fails = s.split(/\r?\n/).filter((l) => /FAIL|failed|✗|Error:/.test(l)).slice(0, 40)
  if (fails.length) console.log('--- fail-ish lines ---\n' + fails.join('\n'))
  process.exit(0)
}
console.log('RUNNING size=' + s.length)
console.log(s.slice(-600))
process.exit(1)
