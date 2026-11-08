// ============================================
// BMB R78 — CI runs ของ SHA R75/R76/R77 (repo public · ไม่ต้องใช้ token)
//   เติม §9.0 ให้ครบ "ทุก SHA" (แถว 57-60) — ปิด pending "CI ของ 9db6664 ยังไม่ยืนยัน"
// Evidence: e2e/_r78_ci_runs.json
// Usage: node e2e/_r78CiRuns.cjs
// ============================================
'use strict'
const fs = require('fs')
const path = require('path')
const SHAS = ['834df11', '4d91432', 'dcc0c71', 'a16668c'] // R79/R79b/R80 (อัปเดต R80)

fetch('https://api.github.com/repos/bitemebaby2016-coder/bmb/actions/runs?per_page=80')
  .then((r) => r.json())
  .then((d) => {
    const out = { at: new Date().toISOString(), shas: {} }
    for (const sha of SHAS) {
      const runs = (d.workflow_runs || []).filter((r) => String(r.head_sha).startsWith(sha))
      out.shas[sha] = runs.map((r) => ({ id: r.id, name: r.name, status: r.status, conclusion: r.conclusion, url: r.html_url }))
      console.log(sha + ': ' + (out.shas[sha].length
        ? out.shas[sha].map((r) => r.name + '=' + r.id + '/' + r.conclusion).join(' · ')
        : 'NO_RUN_IN_PAGE'))
    }
    out.all_green = Object.values(out.shas).every((rs) => rs.length > 0 && rs.every((r) => r.status === 'completed' && r.conclusion === 'success'))
    // รายงาน failed ทั้งหมดในหน้า (กันโกง — ถ้ามี failure ใหม่ต้องเห็นชื่อ SHA/เวลา)
    out.failed_runs = (d.workflow_runs || [])
      .filter((r) => r.conclusion === 'failure')
      .map((r) => ({ id: r.id, name: r.name, sha: String(r.head_sha).slice(0, 7), created_at: r.created_at, url: r.html_url }))
    out.no_failed = out.failed_runs.length === 0
    console.log('ALL_GREEN=' + out.all_green + ' · NO_FAILED_RUN=' + out.no_failed + ' · failed=' + JSON.stringify(out.failed_runs))
    fs.writeFileSync(path.join(__dirname, '_r78_ci_runs.json'), JSON.stringify(out, null, 2))
  })
  .catch((e) => console.log('ERR ' + e.message))