// e37: ตรวจ CI run ของ 2f74855 ด้วย GITHUB_TOKEN_BMB (ยืนยัน Lint หลังแก้ catch (e))
const fs = require('fs')
const path = require('path')
const ROOT = path.resolve(__dirname, '..')
const TK = (/^GITHUB_TOKEN_BMB=(.*)$/m.exec(fs.readFileSync(path.join(ROOT, '.env.local'), 'utf8')) || [])[1]
const H = { Authorization: 'Bearer ' + TK, Accept: 'application/vnd.github+json', 'User-Agent': 'bmb-e37' }
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
;(async () => {
  await sleep(22000)
  const r = await fetch('https://api.github.com/repos/bitemebaby2016-coder/bmb/actions/runs?head_sha=2f7485561000000&per_page=1', { headers: H })
  // head_sha ต้องเต็ม → ดึงจาก list ล่าสุดแทน
  const r2 = await fetch('https://api.github.com/repos/bitemebaby2016-coder/bmb/actions/runs?per_page=6', { headers: H })
  const L = await r2.json()
  const ci = (L.workflow_runs || []).find((x) => x.name === 'CI' && x.head_sha.startsWith('2f74855'))
  if (!ci) { console.log('CI_RUN_NOT_FOUND_YET'); console.log('RECENT=' + (L.workflow_runs || []).map((x) => x.name + '@' + x.head_sha.slice(0, 7) + ':' + x.status).join(' | ')); return }
  console.log('CIRUN=' + ci.id + ' ' + ci.status + '/' + ci.conclusion + ' url=' + ci.html_url)
  const jr = await fetch('https://api.github.com/repos/bitemebaby2016-coder/bmb/actions/runs/' + ci.id + '/jobs', { headers: H })
  const J = await jr.json()
  for (const job of J.jobs || []) {
    console.log('JOB=' + job.name + ' ' + job.status + '/' + job.conclusion)
    for (const s of job.steps || []) console.log('  STEP ' + s.name + ' = ' + s.conclusion)
  }
})().catch((e) => console.log('FATAL ' + String(e).slice(0, 300)))