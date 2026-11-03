// R65c — one-shot CI probe for HEAD 34dca48 (repo public · no token · no polling)
'use strict'
;(async () => {
  const SHA = '34dca488deb856e10f9f53d3173d9a77d586e1e8'
  const H = { Accept: 'application/vnd.github+json', 'User-Agent': 'bmb-ci-probe' }
  const r = await fetch('https://api.github.com/repos/bitemebaby2016-coder/bmb/actions/runs?head_sha=' + SHA, { headers: H })
  const d = await r.json().catch(() => null)
  const runs = (d && d.workflow_runs) || []
  const out = {
    at: new Date().toISOString(),
    status: r.status,
    total: d ? d.total_count : null,
    runs: runs.map((x) => ({ id: x.id, name: x.name, run_number: x.run_number, status: x.status, conclusion: x.conclusion, html_url: x.html_url })),
  }
  console.log(JSON.stringify(out, null, 1))
  require('fs').writeFileSync(require('path').join(__dirname, 'r65cCiProbe-result.json'), JSON.stringify(out, null, 2))
  const bad = runs.some((x) => x.conclusion === 'failure' || x.conclusion === 'cancelled')
  const pending = runs.some((x) => x.status !== 'completed')
  console.log(bad ? 'CI_FAIL' : pending ? 'CI_PENDING' : runs.length ? 'CI_ALL_GREEN' : 'CI_NO_RUNS')
})().catch((e) => { console.error(e); process.exit(1) })
