'use strict'
// _r69b_trigger — R69 Phase B runtime verification ผ่านเส้นทาง canonical:
// queue-enqueue (x-automation-token) → automation_queue → queue-dispatcher → automation-worker
// params: maxAgeMinutes=120 (เดิม) + cancelAfterMinutes=720 (ใหม่ · opt-in auto-cancel)
// หลักฐาน = ผลตอบกลับของ dispatcher + แถว automation.execution (เก็บลง _r69b_trigger_result.json)
const fs = require('fs')
const path = require('path')
const ROOT = path.resolve(__dirname, '..')

function parseEnv(file) {
  const out = {}
  try {
    for (const line of fs.readFileSync(file, 'utf8').split(/\r?\n/)) {
      const m = line.match(/^([A-Z0-9_]+)=(.*)$/)
      if (m && m[2]) out[m[1]] = m[2]
    }
  } catch { /* missing */ }
  return out
}
const sec = parseEnv(path.join(ROOT, 'supabase', 'secrets.local.env'))
const local = parseEnv(path.join(ROOT, '.env.local'))
const TOKEN = sec.AUTOMATION_TOKEN || local.AUTOMATION_TOKEN || ''
if (!TOKEN) { console.error('MISSING: AUTOMATION_TOKEN'); process.exit(2) }

const BASE = 'https://ivkdfognyiwjcmrhcnwz.supabase.co/functions/v1'
const APIKEY = 'sb_publishable_Q7AHrjSYOrysDjxS9_ZB-g_NMmytLOH'

async function post(url, body) {
  const r = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      apikey: APIKEY,
      'x-automation-token': TOKEN,
    },
    body: JSON.stringify(body),
  })
  const t = await r.text()
  let j = null
  try { j = JSON.parse(t) } catch { /* keep raw */ }
  return { http: r.status, json: j, raw: t.slice(0, 1500) }
}

;(async () => {
  const out = { at: new Date().toISOString(), steps: [] }
  const REF = 'manual-r69b-verify-1'

  // 1) enqueue (idempotent identity 'sched-orders_stale_pending-<ref>')
  const en = await post(BASE + '/queue-enqueue', {
    job: 'orders_stale_pending',
    ref: REF,
    params: { maxAgeMinutes: 120, cancelAfterMinutes: 720 },
  })
  out.steps.push({ step: 'enqueue', ...en })
  console.log('ENQUEUE http=' + en.http + ' ' + JSON.stringify(en.json))
  if (en.http !== 200) { fs.writeFileSync(path.join(__dirname, '_r69b_trigger_result.json'), JSON.stringify(out, null, 2)); process.exit(1) }

  // 2) dispatch (อ้างสิทธิ์ job + เรียก worker → คืนผลรวม)
  const dp = await post(BASE + '/queue-dispatcher', { jobType: 'orders_stale_pending' })
  out.steps.push({ step: 'dispatch', ...dp })
  console.log('DISPATCH http=' + dp.http + ' ' + JSON.stringify(dp.json).slice(0, 1200))

  fs.writeFileSync(path.join(__dirname, '_r69b_trigger_result.json'), JSON.stringify(out, null, 2))
  const ok = dp.http === 200 && dp.json && Array.isArray(dp.json.results) &&
    dp.json.results.some(r => r.id === 'sched-orders_stale_pending-' + REF && r.queueResult === 'SUCCEEDED')
  console.log('TRIGGER_DONE verified=' + ok)
  if (!ok) process.exit(2)
})().catch(e => { console.error('ERR', e); process.exit(1) })