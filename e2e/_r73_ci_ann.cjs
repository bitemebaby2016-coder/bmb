'use strict'
// _r73_ci_ann — ดึง annotations ของ check-run (path ที่ถูก) ของ sha d48f83c (R73) — one-shot
;(async () => {
  const H = { Accept: 'application/vnd.github+json', 'User-Agent': 'bmb-ci-ann' }
  const b = 'https://api.github.com/repos/bitemebaby2016-coder/bmb/commits/d48f83c/check-runs?per_page=20'
  const r = await fetch(b, { headers: H })
  const d = await r.json().catch(() => null)
  const runs = (d && d.check_runs) || []
  const out = { at: new Date().toISOString(), http: r.status, total: d ? d.total_count : null, checks: [] }
  for (const c of runs) {
    const item = { name: c.name, status: c.status, conclusion: c.conclusion, id: c.id, summary: (c.output && c.output.summary) || '', title: (c.output && c.output.title) || '', annotations: [] }
    if (c.conclusion === 'failure') {
      const a = await fetch('https://api.github.com/repos/bitemebaby2016-coder/bmb/check-runs/' + c.id + '/annotations?per_page=50', { headers: H })
      const aj = await a.json().catch(() => null)
      if (Array.isArray(aj)) item.annotations = aj.map((x) => ({ level: x.annotation_level, path: x.path, line: x.start_line, msg: String(x.message).slice(0, 500) }))
      else item.annotations = aj
    }
    out.checks.push(item)
  }
  require('fs').writeFileSync(require('path').join(__dirname, '_r73_ci_ann.json'), JSON.stringify(out, null, 2))
  console.log(JSON.stringify(out, null, 1))
})().catch((e) => { console.error(String(e).slice(0, 300)); process.exit(1) })