'use strict'
// _r68_ci_diag — ดึง job + annotation ของ Contract Tests ที่แดง (one-shot, no polling)
const RUN = process.argv[2] || '41876373101'
;(async () => {
  const H = { Accept: 'application/vnd.github+json', 'User-Agent': 'bmb-ci-diag' }
  const base = 'https://api.github.com/repos/bitemebaby2016-coder/bmb/actions/runs/' + RUN
  const j = await fetch(base + '/jobs?per_page=20', { headers: H })
  const jd = await j.json().catch(() => null)
  const jobs = (jd && jd.jobs) || []
  const summary = jobs.map((x) => ({
    name: x.name,
    status: x.status,
    conclusion: x.conclusion,
    steps: (x.steps || []).filter((s) => s.conclusion && s.conclusion !== 'success' && s.conclusion !== 'skipped')
      .map((s) => ({ n: s.name, c: s.conclusion, num: s.number })),
  }))
  // annotations = ข้อความ error จริงจาก GitHub
  const a = await fetch(base + '/annotations?per_page=30', { headers: H })
  const annRaw = await a.json().catch(() => null)
  const ann = Array.isArray(annRaw) ? annRaw : []
  const out = {
    at: new Date().toISOString(),
    run: RUN,
    jobs_status: j.status,
    jobs_total: jd ? jd.total_count : null,
    jobs: summary,
    annotations: ann.slice(0, 30).map((x) => ({ level: x.level, path: x.path, msg: String(x.message).slice(0, 400) })),
    ann_raw: Array.isArray(annRaw) ? undefined : annRaw,
  }
  require('fs').writeFileSync(require('path').join(__dirname, '_r68_ci_diag.json'), JSON.stringify(out, null, 2))
  console.log(JSON.stringify(out, null, 1))
})().catch((e) => { console.error(String(e).slice(0, 300)); process.exit(1) })