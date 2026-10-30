// e63: ดึง log CI unit tests ที่ fail (run 41014469429) หา test name จริง
const fs = require('fs')
const path = require('path')
const ROOT = path.resolve(__dirname, '..')
const TK = (/^GITHUB_TOKEN_BMB=(.*)$/m.exec(fs.readFileSync(path.join(ROOT, '.env.local'), 'utf8')) || [])[1]
const H = { Authorization: 'Bearer ' + TK, Accept: 'application/vnd.github+json', 'User-Agent': 'bmb-e63' }
;(async () => {
  const J = await (await fetch('https://api.github.com/repos/bitemebaby2016-coder/bmb/actions/runs/41014469429/jobs', { headers: H })).json()
  const job = (J.jobs || [])[0]
  if (!job) return console.log('NO_JOB')
  const lg = await fetch('https://api.github.com/repos/bitemebaby2016-coder/bmb/actions/jobs/' + job.id + '/logs', { headers: H, redirect: 'follow' })
  const text = await lg.text()
  console.log('LOG_HTTP=' + lg.status + ' len=' + text.length)
  for (const key of ['FAIL ', 'AssertionError', '× ', 'Failed Tests', 'expected']) {
    const idx = text.indexOf(key)
    if (idx >= 0) console.log('--- ' + key + ' @' + idx + ' ---\n' + text.slice(Math.max(0, idx - 200), idx + 700))
  }
})().catch((e) => console.log('FATAL ' + String(e).slice(0, 300)))