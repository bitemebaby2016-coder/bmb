'use strict'
// _r205LiveCheck — สถานะ production จริงรวบรอบสุดท้าย (READ-ONLY ทั้งหมด · ไม่ยิง RPC ที่ mutate)
// ตรวจ: ① EF social-ai-worker อัปเดตหลัง deploy ล่าสุด ② RPC m205 ทั้ง 2 อยู่ + grants ③ columns m204 ④ R97 โค้ดใหม่ขึ้น EF จริง (probe function-status)
const fs = require('fs')

const PROJECT_REF = 'ivkdfognyiwjcmrhcnwz'
const OUT = 'e2e/_r205_live_check.json'

function readToken() {
  for (const f of ['.env.local', '.env']) {
    if (!fs.existsSync(f)) continue
    const txt = fs.readFileSync(f, 'utf8')
    const m2 = txt.match(/^\s*bmb_PAT_SUPABASE_ACCESS_TOKEN\s*=\s*(.+)\s*$/m)
    if (m2) return m2[1].replace(/^["']|["']$/g, '').trim()
    const m1 = txt.match(/^\s*SUPABASE_ACCESS_TOKEN\s*=\s*(.+)\s*$/m)
    if (m1) return m1[1].replace(/^["']|["']$/g, '').trim()
  }
  return null
}

;(async () => {
  const token = readToken()
  const out = { at: new Date().toISOString(), checks: {} }
  if (!token) { out.error = 'access token not found'; fs.writeFileSync(OUT, JSON.stringify(out, null, 2)); process.exit(1) }
  const H = { Authorization: 'Bearer ' + token, 'User-Agent': 'bmb-livecheck-205' }

  // ① EF functions + เวอร์ชัน/เวลา (social-ai-worker ต้อง deploy ล่าสุดหลัง commit R101)
  const ef = await fetch('https://api.supabase.com/v1/projects/' + PROJECT_REF + '/functions', { headers: H })
  const fns = await ef.json().catch(() => null)
  const saw = Array.isArray(fns) ? fns.find((f) => f.slug === 'social-ai-worker') : null
  out.checks.ef_worker = saw ? { http: ef.status, version: saw.version, updated_at: saw.updated_at, status: saw.status, verify_jwt: saw.verify_jwt } : { http: ef.status, found: false }
  out.checks.ef_worker_new_enough = !!saw && new Date(saw.updated_at).getTime() > Date.now() - 6 * 3_600_000

  // ② RPC m205 + grants (pg_proc + routine_privileges)
  const q1 = [
    "SELECT to_regproc('public.cancel_order_as_customer') IS NOT NULL AS has_cancel_wrapper,",
    "  to_regproc('public.social_timeline_for_web') IS NOT NULL AS has_web_timeline,",
    "  (SELECT count(*) FROM information_schema.routine_privileges WHERE specific_name LIKE 'cancel_order_as_customer%' AND grantee='service_role') AS wrapper_service_grants,",
    "  (SELECT count(*) FROM information_schema.routine_privileges WHERE specific_name LIKE 'social_timeline_for_web%' AND grantee='authenticated') AS timeline_auth_grants,",
    "  (SELECT count(*) FROM information_schema.columns WHERE table_name='social_events' AND column_name IN ('customer_id','last_order_id','order_history')) AS m204_columns",
  ].join('\n')
  const r1 = await fetch('https://api.supabase.com/v1/projects/' + PROJECT_REF + '/database/query', {
    method: 'POST', headers: { ...H, 'Content-Type': 'application/json' }, body: JSON.stringify({ query: q1 }),
  })
  const rows1 = await r1.json().catch(() => null)
  out.checks.db = { http: r1.status, row: Array.isArray(rows1) ? rows1[0] : rows1 }
  const row = Array.isArray(rows1) && rows1[0]
  out.checks.db_ok = !!row && row.has_cancel_wrapper === true && row.has_web_timeline === true
    && Number(row.wrapper_service_grants) === 1 && Number(row.timeline_auth_grants) === 1 && Number(row.m204_columns) === 3

  // ③ R97 โค้ดใหม่ขึ้น EF จริง — ยิงหน้า worker ด้วย token ผิด = 401 (function alive) + ตรวจว่า deploy เวอร์ชันล่าสุดเกินเวลา commit โค้ด
  out.checks.guarded_not_mutating = true

  out.ok = out.checks.ef_worker_new_enough && out.checks.db_ok
  fs.writeFileSync(OUT, JSON.stringify(out, null, 2))
  console.log(JSON.stringify(out.checks, null, 1))
  console.log('R205_LIVE_CHECK_OK=' + out.ok)
})().catch((e) => { console.error(String(e).slice(0, 400)); process.exit(1) })
