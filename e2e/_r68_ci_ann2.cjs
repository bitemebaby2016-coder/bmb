'use strict'
// _r68_ci_ann2 — annotations ของ check-run ของ sha ที่ระบุ (argv[2]) — one-shot, no token
;(async () => {
  const SHA = process.argv[2] || 'a39d842'
  const H = { Accept: 'application/vnd.github+json', 'User-Agent': 'bmb-ci-ann2' }
  const r = await fetch('https://api.github.com/repos/bitemebaby2016-coder/bmb/commits/' + SHA + '/check-runs?per_page=25', { headers: H })
  const d = await r.json().catch(() => null)
  const runs = (d && d.check_runs) || []
  const out = { at: new Date().toISOString(), sha: SHA, http: r.status, total: d ? d.total_count : null, checks: [] }
  for (const c of runs) {
    const item = { name: c.name, id: c.id, status: c.status, conclusion: c.conclusion, annotations: [] }
    if (c.conclusion === 'failure') {
      const a = await fetch('https://api.github.com/repos/bitemebaby2016-coder/bmb/check-runs/' + c.id + '/annotations?per_page=50', { headers: H })
      const aj = await a.json().catch(() => null)
      item.annotations = Array.isArray(aj) ? aj.map((x) => ({ level: x.annotation_level, path: x.path, line: x.start_line, msg: String(x.message).slice(0, 600) })) : aj
    }
    out.checks.push(item)
  }
  require('fs').writeFileSync(require('path').join(__dirname, '_r68_ci_ann2.json'), JSON.stringify(out, null, 2))
  console.log(JSON.stringify(out, null, 1))
})().catch((e) => { console.error(String(e).slice(0, 300)); process.exit(1) })