// temp: where did wmic gates process go? (DELETE at session end)
const fs = require('fs')
const { execSync } = require('child_process')
const log = 'D:/A PROJECT/Bite Me Baby/e2e/gates_ui2026-10-26.log'
console.log('log exists:', fs.existsSync(log))
console.log('sys32 log exists:', fs.existsSync('C:/Windows/System32/e2e/gates_ui2026-10-26.log'))
try {
  const out = execSync('tasklist /fi "PID eq 21632"', { encoding: 'utf8' })
  console.log(out.trim())
} catch (e) { console.log('tasklist err', e.message) }
try {
  const out = execSync('schtasks /query /fo csv', { encoding: 'utf8', maxBuffer: 10 * 1024 * 1024 })
  for (const l of out.split(/\r?\n/)) if (/bmb/i.test(l)) console.log(l.trim())
} catch (e) { console.log('schtasks err', e.message) }
