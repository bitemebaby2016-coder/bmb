'use strict'
// _r69n_commit — ปิดงานชุด N: รอ gates จบ → ตรวจ exit ทั้ง 4 ต้องเป็น 0 → secret scan
// → git add/commit/push (web ขึ้น live ผ่าน CI/Pages) · อะไรไม่เขียว = ABORT ไม่ push
const { execSync } = require('child_process')
const fs = require('fs')
const path = require('path')
const ROOT = path.resolve(__dirname, '..')
const log = path.join(__dirname, '_r69n_commit.log')
const gates = path.join(__dirname, '_r69n_gates.log')

function out(s) {
  fs.appendFileSync(log, s + '\n')
  console.log(s)
}
function sh(cmd) {
  return execSync(cmd, { cwd: ROOT, encoding: 'utf8', stdio: 'pipe', timeout: 180000 })
}

async function main() {
  fs.writeFileSync(log, '=== R69-N COMMIT CHAIN ' + new Date().toISOString() + ' ===\n')
  // 1) รอ gates (สูงสุด ~20 นาที)
  let t = ''
  for (let i = 0; i < 80; i++) {
    t = fs.existsSync(gates) ? fs.readFileSync(gates, 'utf8') : ''
    if (t.includes('ALL_DONE')) break
    await new Promise((r) => setTimeout(r, 15000))
  }
  if (!t.includes('ALL_DONE')) {
    out('GATES_TIMEOUT_ABORT')
    process.exit(1)
  }
  const exits = ['TSC_EXIT', 'LINT_EXIT', 'VITEST_EXIT', 'BUILD_EXIT'].map((k) => {
    const m = new RegExp(k + '=(\\d+)').exec(t)
    return [k, m ? m[1] : '?']
  })
  out('EXITS ' + JSON.stringify(exits))
  if (exits.some(([, v]) => v !== '0')) {
    out('GATES_FAILED_ABORT')
    process.exit(1)
  }
  // 2) stage + secret scan (ต้อง 0 hits)
  out(sh('git add -A').slice(0, 300))
  const scan = sh('node e2e/r62PreCommit.cjs')
  out(scan.slice(0, 800))
  if (!scan.includes('"SECRET_HITS": []')) {
    out('SECRET_HITS_ABORT')
    process.exit(1)
  }
  // 3) commit + push
  out(sh('git commit -m "R69-N4c: pickup status display - timeline ends at ready step, done label, hide transit steps (customer surfaces)"').slice(0, 500))
  out(sh('git push').slice(0, 500))
  out('PUSH_DONE')
}

main().catch((e) => {
  out('ERR ' + String(e))
  process.exit(1)
})