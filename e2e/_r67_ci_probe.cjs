'use strict'
// _r67_ci_probe — ONE-SHOT GitHub Actions status after the R67 push (public repo,
// no token, no polling). Prints the newest runs incl. their head sha.
;(async () => {
  const H = { Accept: 'application/vnd.github+json', 'User-Agent': 'bmb-ci-probe' }
  const r = await fetch('https://api.github.com/repos/bitemebaby2016-coder/bmb/actions/runs?per_page=5', { headers: H })
  const d = await r.json().catch(() => null)
  const runs = (d && d.workflow_runs) || []
  const out = {
    at: new Date().toISOString(),
    status: r.status,
    total: d ? d.total_count : null,
    runs: runs.map((x) => ({
      head_sha: String(x.head_sha).slice(0, 7),
      name: x.name,
      status: x.status,
      conclusion: x.conclusion,
      event: x.event,
      html_url: x.html_url,
    })),
  }
  console.log(JSON.stringify(out, null, 1))
  require('fs').writeFileSync(require('path').join(__dirname, '_r67_ci_probe.json'), JSON.stringify(out, null, 2))
  const ours = runs.filter((x) => ['c26c143', '2a7e29d', '4bdc2f8', '01e5802', '7b817d7'].includes(String(x.head_sha).slice(0, 7)))
  const bad = ours.some((x) => x.conclusion === 'failure' || x.conclusion === 'cancelled')
  const pending = ours.some((x) => x.status !== 'completed')
  console.log(ours.length === 0 ? 'CI_NO_OUR_RUNS' : bad ? 'CI_FAIL' : pending ? 'CI_PENDING' : 'CI_ALL_GREEN')
})().catch((e) => { console.error(String(e).slice(0, 300)); process.exit(1) })