'use strict'
// _r68_ci_log — ดึง log จริงของ job ที่แดง (Contract 154) — one-shot
const RUN = process.argv[2] || '41876373101'
;(async () => {
  const H = { Accept: 'application/vnd.github+json', 'User-Agent': 'bmb-ci-log' }
  const j = await fetch('https://api.github.com/repos/bitemebaby2016-coder/bmb/actions/runs/' + RUN + '/jobs?per_page=20', { headers: H })
  const jd = await j.json()
  const job = (jd.jobs || [])[0]
  if (!job) { console.log('NO_JOB'); process.exit(1) }
  const r = await fetch('https://api.github.com/repos/bitemebaby2016-coder/bmb/actions/jobs/' + job.id + '/logs', { headers: H, redirect: 'follow' })
  const txt = await r.text()
  const lines = txt.split(/\r?\n/)
  const bad = []
  lines.forEach((l, i) => {
    if (/ERROR:|FAIL|error:|Contract 154|154_/i.test(l)) bad.push(i + ': ' + l.slice(0, 300))
  })
  const out = { at: new Date().toISOString(), job: job.name, conclusion: job.conclusion, http: r.status, lines: lines.length, tail: lines.slice(-40).map((l) => l.slice(0, 300)), hits: bad.slice(-60) }
  require('fs').writeFileSync(require('path').join(__dirname, '_r68_ci_joblog.json'), JSON.stringify(out, null, 2))
  console.log(JSON.stringify({ http: r.status, lines: lines.length, hits: out.hits.slice(-25), tail: out.tail.slice(-15) }, null, 1))
})().catch((e) => { console.error(String(e).slice(0, 300)); process.exit(1) })