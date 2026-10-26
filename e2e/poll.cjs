// temp poll for bg gate (delete at session end): set LOGNAME=tsc && run via runner
const fs = require('fs')
const n = (process.env.LOGNAME || '').trim()
if (!n) { console.error('set LOGNAME=... first'); process.exit(2) }
const base = 'D:/A PROJECT/Bite Me Baby/e2e/bg_' + n
const codeFile = 'D:/A PROJECT/Bite Me Baby/zz_gate_' + n + '.code'
if (fs.existsSync(codeFile)) {
  console.log('EXIT=' + fs.readFileSync(codeFile, 'utf8').trim())
  const log = fs.readFileSync(base + '.log', 'utf8')
  console.log(log.length > 9000 ? log.slice(0, 4000) + '\n...TRUNC...\n' + log.slice(-5000) : log)
  process.exit(0)
}
console.log('STILL RUNNING')
try {
  const log = fs.readFileSync(base + '.log', 'utf8')
  console.log(log.length > 1500 ? '...tail...\n' + log.slice(-1500) : log)
} catch {}
process.exit(1)
