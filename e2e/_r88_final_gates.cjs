// R88/R89 FINAL GATES — รันครั้งเดียวจบ (ห้าม retry/loop): tsc → lint → vitest → build
// ผลรวมอยู่ใน e2e\_r88_final_gates.log (ALL_GATES_DONE หรือ GATE_FAILED_AT <name>)
'use strict'
const { spawn } = require('child_process')
const fs = require('fs')
const log = fs.createWriteStream('e2e\\_r88_final_gates.log', { flags: 'w' })
const steps = [
  ['tsc', 'npx', ['tsc', '--noEmit']],
  ['lint', 'npm', ['run', 'lint']],
  ['vitest', 'npx', ['vitest', 'run']],
  ['build', 'npm', ['run', 'build']],
]
let i = 0
function runNext() {
  if (i >= steps.length) {
    log.write('ALL_GATES_DONE\n')
    log.end()
    process.exit(0)
  }
  const [name, cmd, args] = steps[i++]
  log.write('=== GATE ' + name + ' START\n')
  const p = spawn(cmd, args, { shell: true, cwd: process.cwd() })
  p.stdout.on('data', (d) => log.write(d))
  p.stderr.on('data', (d) => log.write(d))
  p.on('close', (code) => {
    log.write('\n=== GATE ' + name + ' EXIT=' + code + '\n')
    if (code !== 0) {
      log.write('GATE_FAILED_AT ' + name + '\n')
      log.end()
      process.exit(1)
    }
    runNext()
  })
}
runNext()