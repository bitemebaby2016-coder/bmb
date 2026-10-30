// e38: ตรวจ CI ของ HEAD ปัจจุบัน (SHA อ่านจาก git จริง) ด้วย GITHUB_TOKEN_BMB
const fs = require('fs')
const path = require('path')
const { execSync } = require('child_process')
const ROOT = path.resolve(__dirname, '..')
const SHA = execSync('git rev-parse HEAD', { cwd: ROOT }).toString().trim()
const TK = (/^GITHUB_TOKEN_BMB=(.*)$/m.exec(fs.readFileSync(path.join(ROOT, '.env.local'), 'utf8')) || [])[1]
const H = { Authorization: 'Bearer ' + TK, Accept: 'application/vnd.github+json', 'User-Agent': 'bmb-e38' }
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
;(async () => {
  console.log('SHA=' + SHA.slice(0, 7))
  await sleep(23000)
  const L = await (await fetch('https://api.github.com/repos/bitemebaby2016-coder/bmb/actions/runs?per_page=6', { headers: H })).json()
  const ci = (L.workflow_runs || []).find((x) => x.name === 'CI' && x.head_sha === SHA)
  if (!ci) { console.log('CI_RUN_NOT_FOUND'); console.log('RECENT=' + (L.workflow_runs || []).map((x) => x.name + '@' + x.head_sha.slice(0, 7) + ':' + x.status).join(' | ')); return }
  console.log('CIRUN=' + ci.id + ' ' + ci.status + '/' + ci.conclusion + ' ' + ci.html_url)
  const J = await (await fetch('https://api.github.com/repos/bitemebaby2016-coder/bmb/actions/runs/' + ci.id + '/jobs', { headers: H })).json()
  for (const job of J.jobs || []) {
    console.log('JOB=' + job.name + ' ' + job.status + '/' + job.conclusion)
    for (const s of job.steps || []) console.log('  ' + s.name + ' = ' + s.conclusion)
  }
})().catch((e) => console.log('FATAL ' + String(e).slice(0, 300)))