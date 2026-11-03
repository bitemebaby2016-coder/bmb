'use strict'
// ดู CI ครั้งเดียวต่อ session (repo อาจเป็นส่วนตัว → 404 = บันทึกว่าดูไม่ได้)
;(async () => {
  const r = await fetch('https://api.github.com/repos/bitemebaby2016-coder/bmb/actions/runs?per_page=4', {
    headers: { Accept: 'application/vnd.github+json' },
  })
  const j = await r.json().catch(() => ({}))
  if (!j.workflow_runs) { console.log('CI_UNAVAILABLE status=' + r.status + ' ' + (j.message || '')); return }
  for (const w of j.workflow_runs) console.log(w.head_sha.slice(0, 7) + ' | ' + w.name + ' | ' + w.status + ' | ' + w.conclusion)
})().catch((e) => console.log('CI_ERR ' + e.message))
