// One-shot CI probe (R65) — reads run status for HEAD SHA once; NO polling loop.
const https = require('https')
const SHA = process.argv[2] || '6012720'
const REPO = 'bitemebaby2016-coder/bmb'

function get(path) {
  return new Promise((resolve, reject) => {
    https.get({ host: 'api.github.com', path, headers: { 'User-Agent': 'r65-probe' } }, (res) => {
      let body = ''
      res.on('data', (c) => { body += c })
      res.on('end', () => {
        try { resolve({ status: res.statusCode, json: JSON.parse(body) }) }
        catch (e) { reject(e) }
      })
    }).on('error', reject)
  })
}

;(async () => {
  const out = { sha: SHA, probedAt: new Date().toISOString() }
  try {
    const wf = await get(`/repos/${REPO}/actions/runs?head_sha=${SHA}&per_page=10`)
    out.workflowRuns = (wf.json.workflow_runs || []).map((r) => ({
      id: r.id, name: r.name, status: r.status, conclusion: r.conclusion, html_url: r.html_url,
    }))
    const cr = await get(`/repos/${REPO}/commits/${SHA}/check-runs`)
    out.checkRuns = (cr.json.check_runs || []).map((c) => ({
      name: c.name, status: c.status, conclusion: c.conclusion, html_url: c.html_url,
    }))
    out.note = 'ONE-SHOT probe — status/conclusion may be in_progress; do NOT re-poll this SHA'
  } catch (e) {
    out.error = String(e)
  }
  console.log(JSON.stringify(out, null, 1))
})()
