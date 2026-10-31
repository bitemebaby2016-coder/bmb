// e2e/r36_ci_probe.cjs — ดึง log CI ที่พังจาก GitHub API (repo public ไม่ต้องใช้ token)
fetch('https://api.github.com/repos/bitemebaby2016-coder/bmb/actions/runs?per_page=5')
  .then((r) => r.json())
  .then(async (d) => {
    for (const run of d.workflow_runs || []) {
      console.log(`RUN ${run.id} ${run.name} | ${run.head_sha.slice(0, 7)} | ${run.status}/${run.conclusion} | ${run.html_url}`)
    }
    const fail = (d.workflow_runs || []).find((r) => r.conclusion === 'failure')
    if (!fail) { console.log('NO_FAILED_RUN'); return }
    const j = await fetch(`https://api.github.com/repos/bitemebaby2016-coder/bmb/actions/runs/${fail.id}/jobs`).then((r) => r.json())
    for (const job of j.jobs || []) {
      console.log(`JOB ${job.name} => ${job.conclusion}`)
      for (const s of job.steps || []) {
        if (s.conclusion === 'failure') console.log(`  FAILED_STEP: ${s.name} (#${s.number})`)
      }
      if (job.conclusion === 'failure' && job.id) {
        // ดึง log ของ job ที่พัง (redirect ไป text)
        const lg = await fetch(`https://api.github.com/repos/bitemebaby2016-coder/bmb/actions/jobs/${job.id}/logs`)
        if (lg.ok) {
          const txt = await lg.text()
          const lines = txt.split('\n')
          // โชว์ 80 บรรทัดท้าย = มักครอบคลุม error + summary
          console.log(`--- LOG_TAIL ${job.name} (${lines.length} lines) ---`)
          console.log(lines.slice(-80).join('\n'))
        } else {
          console.log('LOG_FETCH', lg.status)
        }
      }
    }
  })
  .catch((e) => console.log('ERR', e.message))
