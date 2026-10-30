// e28: ดู Actions ด้วย GITHUB_TOKEN_BMB (อ่านจาก .env.local · ไม่พิมพ์ token) — read-only
const fs = require('fs')
const path = require('path')
const ROOT = path.resolve(__dirname, '..')
const TK = (/^GITHUB_TOKEN_BMB=(.*)$/m.exec(fs.readFileSync(path.join(ROOT, '.env.local'), 'utf8')) || [])[1]
if (!TK) { console.log('NO_TOKEN_GITHUB_TOKEN_BMB'); process.exit(1) }
const H = { Authorization: 'Bearer ' + TK, Accept: 'application/vnd.github+json', 'User-Agent': 'bmb-probe' }
const api = async (u) => { const r = await fetch(u, { headers: H }); return { s: r.status, t: await r.text() } }
;(async () => {
  let r = await api('https://api.github.com/repos/bitemebaby2016-coder/bmb/actions/runs/40999383734/jobs')
  let j = JSON.parse(r.t)
  console.log('SCHED1845=' + (j.jobs || []).map((x) => x.name + ':' + x.conclusion + ' steps=' + (x.steps || []).map((s) => s.name + '=' + s.conclusion).join(',')).join(' || '))
  r = await api('https://api.github.com/repos/bitemebaby2016-coder/bmb/actions/runs/40996949621/jobs')
  j = JSON.parse(r.t)
  console.log('CIRUN40996949621=' + (j.jobs || []).map((x) => x.name + ':' + x.conclusion + ' id=' + x.id).join(' || '))
  r = await api('https://api.github.com/repos/bitemebaby2016-coder/bmb/actions/runs?per_page=8')
  const L = JSON.parse(r.t)
  console.log('RUNS=\n' + (L.workflow_runs || []).map((x) => '  ' + x.id + ' | ' + x.name + ' | ' + x.head_sha.slice(0, 7) + ' | ' + x.event + ' | ' + x.conclusion + ' | ' + x.created_at).join('\n'))
})().catch((e) => console.log('FATAL ' + String(e).slice(0, 500)))