// R44: full vitest แบบ chunk (tool timeout 30s/คำสั่ง) — node e2e/r44_vitest_chunk.cjs <start> <count>
'use strict'
const { spawnSync } = require('child_process')
const fs = require('fs')
const path = require('path')
const ROOT = path.resolve(__dirname, '..')
const files = fs.readFileSync(path.join(__dirname, 'r44_testfiles.txt'), 'utf8')
  .split(/\r?\n/).filter(Boolean).map((f) => 'src/__tests__/' + f)
const start = Number(process.argv[2] || 0)
const count = Number(process.argv[3] || 30)
const chunk = files.slice(start, start + count)
console.log(`CHUNK ${start}..${start + chunk.length - 1} / total ${files.length}`)
const r = spawnSync('npx', ['vitest', 'run', '--reporter=basic', ...chunk], {
  shell: true, encoding: 'utf8', cwd: ROOT, timeout: 27000, maxBuffer: 16 * 1024 * 1024,
})
const out = ((r.stdout || '') + '\n' + (r.stderr || ''))
const keep = out.split(/\r?\n/).filter((l) => /FAIL|Test Files|Tests |failed|✗|×/.test(l))
console.log(keep.slice(-30).join('\n') || '(no summary lines)')
console.log('CHUNK_EXIT=' + r.status + (r.signal ? ' SIGNAL=' + r.signal : ''))
if (r.stdout) fs.writeFileSync(path.join(__dirname, `r44_chunk_${start}.log`), r.stdout)
process.exit(r.status === null ? 2 : r.status)