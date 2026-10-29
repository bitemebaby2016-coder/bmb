// CI poller (R20) — ดึงเฉพาะ fields ที่ต้องกรอก §9.0: workflow / run / status / conclusion
// Run: node e2e/r19bCi.cjs <full-sha>            -> list runs ของ SHA นั้น
//      node e2e/r19bCi.cjs jobs <run_id>         -> งาน/step ที่ failure ของรันนั้น
const BASE = 'https://api.github.com/repos/bitemebaby2016-coder/bmb/actions'
const H = { Accept: 'application/vnd.github+json' }
const arg = process.argv[2] || ''

async function listRuns(sha) {
  const r = await fetch(`${BASE}/runs?head_sha=${sha}&per_page=10`, { headers: H })
  const j = await r.json()
  if (!j.workflow_runs) return console.log('API_ERROR ' + JSON.stringify(j).slice(0, 400))
  console.log(`head=${sha} total=${j.total_count}`)
  for (const w of j.workflow_runs.sort((a, b) => a.run_number - b.run_number)) {
    console.log(`${w.name} #${w.run_number} id=${w.id} status=${w.status} conclusion=${w.conclusion ?? '-'} path=${w.path}`)
  }
}

async function listJobs(runId) {
  const r = await fetch(`${BASE}/runs/${runId}/jobs?per_page=20`, { headers: H })
  const j = await r.json()
  if (!j.jobs) return console.log('API_ERROR ' + JSON.stringify(j).slice(0, 400))
  for (const job of j.jobs) {
    console.log(`JOB id=${job.id} ${job.name} conclusion=${job.conclusion ?? job.status}`)
    for (const s of job.steps || []) {
      if (s.conclusion && s.conclusion !== 'success' && s.conclusion !== 'skipped') {
        console.log(`  STEP ${s.number} ${s.name} -> ${s.conclusion}`)
      }
    }
  }
}

// joblog <job_id> — ดึง log ของ job แล้วตัดเฉพาะบรรทัดที่มี error/failed + หาง log
async function jobLog(jobId) {
  const r = await fetch(`${BASE}/jobs/${jobId}/logs`, { headers: H })
  const t = await r.text()
  if (!r.ok) return console.log(`LOG_HTTP_${r.status} ` + t.slice(0, 300))
  const lines = t.split(/\r?\n/)
  const hits = lines
    .map((l, i) => `${i + 1}: ${l}`)
    .filter((l) => /error|failed|ELIFECYCLE|npm ERR|problems/i.test(l))
  console.log(`--- hits (${hits.length}) ---`)
  console.log(hits.slice(0, 60).join('\n'))
  console.log('--- tail ---')
  console.log(lines.slice(-15).join('\n'))
}

;(async () => {
  try {
    if (arg === 'jobs') await listJobs(process.argv[3] || '')
    else if (arg === 'joblog') await jobLog(process.argv[3] || '')
    else await listRuns(arg)
  } catch (e) {
    console.log('FATAL ' + String(e).slice(0, 300))
  }
})()

