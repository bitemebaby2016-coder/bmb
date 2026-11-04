// R65 CI log fetch — ดึง log ทั้งของ failed job → save + แสดงบรรทัดที่มี error + context
const fs = require('fs')
const path = require('path')
const ROOT = path.resolve(__dirname, '..')
const TOK = (/^GITHUB_TOKEN_BMB=(.*)$/m.exec(fs.readFileSync(path.join(ROOT, '.env.local'), 'utf8')) || [])[1]
if (!TOK) { console.error('NO_TOKEN'); process.exit(1) }
const REPO = 'bitemebaby2016-coder/bmb'

const JOBS = [
  { id: 126200474968, name: 'contract153-6012720' },
  { id: 126202649826, name: 'unittests-e684d87' },
]

;(async () => {
  for (const j of JOBS) {
    const r = await fetch(`https://api.github.com/repos/${REPO}/actions/jobs/${j.id}/logs`, {
      headers: { Authorization: 'Bearer ' + TOK, 'User-Agent': 'r65-log' },
    })
    const txt = await r.text()
    const file = path.join(ROOT, 'e2e', `r65ciLog-${j.name}.txt`)
    fs.writeFileSync(file, txt)
    const lines = txt.split('\n')
    const hits = []
    for (let i = 0; i < lines.length; i++) {
      if (/##\[error\]|ERROR:|FAIL |AssertionError|XMARK/.test(lines[i])) {
        hits.push('--- ctx ' + i + ' ---')
        for (let k = Math.max(0, i - 6); k <= Math.min(lines.length - 1, i + 3); k++) hits.push(lines[k])
      }
    }
    console.log(`===== ${j.name} (status=${r.status}, ${lines.length} lines, saved) =====`)
    console.log(hits.slice(0, 120).join('\n'))
  }
})().catch((e) => { console.error('LOG_FAILED ' + String(e).slice(0, 300)); process.exit(1) })