// e2e/r53_ci_probe.cjs — เช็ค CI ของ commit R53 (192d8c9) ครั้งเดียว (repo public · ไม่ใช้ token · ไม่ poll)
fetch('https://api.github.com/repos/bitemebaby2016-coder/bmb/actions/runs?per_page=5')
  .then((r) => r.json())
  .then((d) => {
    for (const run of d.workflow_runs || []) {
      console.log(`RUN ${run.id} ${run.name} | ${run.head_sha.slice(0, 7)} | ${run.status}/${run.conclusion} | ${run.html_url}`)
    }
    const mine = (d.workflow_runs || []).find((r) => r.head_sha.startsWith('192d8c9'))
    console.log('MY_RUN', mine ? `${mine.id} ${mine.status}/${mine.conclusion}` : 'NOT_FOUND_YET')
    const fail = (d.workflow_runs || []).find((r) => r.conclusion === 'failure')
    if (!fail) { console.log('NO_FAILED_RUN'); return }
    console.log('FAILED_RUN_PRESENT', fail.id, fail.head_sha.slice(0, 7), '(อาจเป็น run เก่า — ดู MY_RUN ก่อน)')
  })
  .catch((e) => console.log('ERR', e.message))