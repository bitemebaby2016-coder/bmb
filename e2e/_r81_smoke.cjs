// ============================================
// BMB R81 — deployed-EF SMOKE (ไม่แตะลูกค้า/ไม่สร้างอะไร)
//   ยิง social-ai-worker ด้วย event_id ปลอม → ระบบค้นหา 0 แถว = ตอบ 200 ทันที
//   = พิสูจน์ว่า build ที่ deploy แล้ว boot ได้จริง (import/env/auth/routing ครบ)
//   ถ้าโค้ดใหม่พัง runtime → จะได้ 5xx แทน
//   Evidence: e2e/_r81_smoke.json
// ============================================
'use strict'
process.chdir(require('path').join(__dirname, '..'))
const fs = require('fs')
const path = require('path')
const { SB, SERVICE, S } = require('./wave2Lib.cjs')

async function main() {
  const out = { tool: 'r81-ef-smoke', ts: new Date().toISOString(), safety: 'fake event_id = ไม่มีแถวให้ประมวลผล' }
  const r = await fetch(SB + '/functions/v1/social-ai-worker', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      apikey: SERVICE,
      Authorization: 'Bearer ' + SERVICE,
      'x-automation-token': S.AUTOMATION_TOKEN || '',
    },
    body: JSON.stringify({ event_id: 'smoke-r81-does-not-exist', limit: 1 }),
    signal: AbortSignal.timeout(30000),
  })
  const text = await r.text()
  out.http = r.status
  out.body = text.slice(0, 300)
  out.boot_ok = r.status === 200 && text.includes('no RECEIVED social events')
  fs.writeFileSync(path.join(__dirname, '_r81_smoke.json'), JSON.stringify(out, null, 2))
  console.log('R81_SMOKE http=' + r.status + ' boot_ok=' + out.boot_ok + ' body=' + out.body.slice(0, 160))
}

main().catch((e) => { console.error('R81_SMOKE_FAIL', String(e).slice(0, 200)); process.exit(1) })