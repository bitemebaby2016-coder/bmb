// R65 CI diagnostic — ดึง failed steps + log tail ของ run ที่แดง (ใช้ GITHUB_TOKEN_BMB = rate limit 5k/h)
const fs = require('fs')
const path = require('path')
const ROOT = path.resolve(__dirname, '..')
const TOK = (/^GITHUB_TOKEN_BMB=(.*)$/m.exec(fs.readFileSync(path.join(ROOT, '.env.local'), 'utf8')) || [])[1]
if (!TOK) { console.error('NO_GITHUB_TOKEN_BMB'); process.exit(1) }
const REPO = 'bitemebaby2016-coder/bmb'
const RUNS = [
  { sha: '6012720', run: 41717275179, label: 'contract-6012720' },
  { sha: 'e684d87', run: 41717904288, label: 'contract-e684d87' },
  { sha: 'e684d87', run: 41717903989, label: 'testlint-e684d87' },
]

async function api(p) {
  const r = await fetch('https://api.github.com' + p, {
    headers: { Authorization: 'Bearer ' + TOK, 'User-Agent': 'r65-diag', Accept: 'application/vnd.github+json' },
  })
  if (!r.ok) return { error: r.status + ' ' + String(await r.text()).slice(0, 200) }
  return r.json()
}

;(async () => {
  const out = { at: new Date().toISOString(), runs: [] }
  for (const spec of RUNS) {
    const item = { label: spec.label, sha: spec.sha, run: spec.run }
    const jobs = await api(`/repos/${REPO}/actions/runs/${spec.run}/jobs`)
    if (jobs.error) { item.jobsError = jobs.error; out.runs.push(item); continue }
    item.conclusion = jobs.conclusion
    item.failedSteps = []
    for (const j of jobs.jobs || []) {
      for (const s of j.steps || []) {
        if (s.conclusion === 'failure') {
          item.failedSteps.push({ job: j.name, step: s.name, job_id: j.id })
        }
      }
    }
    // log tail ของ failed job ตัวแรก
    if (item.failedSteps.length > 0) {
      const fid = item.failedSteps[0].job_id
      try {
        const lr = await fetch(`https://api.github.com/repos/${REPO}/actions/jobs/${fid}/logs`, {
          headers: { Authorization: 'Bearer ' + TOK, 'User-Agent': 'r65-diag' },
        })
        const txt = await lr.text()
        item.logTail = txt.split('\n').slice(-60).join('\n').slice(0, 4000)
      } catch (e) { item.logError = String(e) }
    }
    out.runs.push(item)
  }
  fs.writeFileSync(path.join(ROOT, 'e2e', 'r65ciDiag-result.json'), JSON.stringify(out, null, 1))
  for (const r of out.runs) {
    console.log(`${r.label}: conclusion=${r.conclusion || r.jobsError || '?'} failed=${JSON.stringify((r.failedSteps || []).map((s) => s.step))}`)
  }
})().catch((e) => { console.error('DIAG_FAILED ' + String(e).slice(0, 300)); process.exit(1) })