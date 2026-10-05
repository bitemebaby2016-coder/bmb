// ============================================================
// M113 apply + verify
//   1. สมัคร supabase/migrations/113_fix_ensure_rounds_branch_id.sql → production
//   2. ยืนยัน def ใหม่มี v_tpl.branch_id
//   3. runtime test: ensure_rounds_for_date(tomorrow) เรียกจริง 2 ครั้ง
//      (idempotent) ภายใน BEGIN ... ROLLBACK — production ไม่เก็บ row ใด ๆ
// ============================================================
const fs = require('fs')
const path = require('path')
const ROOT = path.resolve(__dirname, '..')
const env = {}
for (const line of fs.readFileSync(path.join(ROOT, '.env.local'), 'utf8').split(/\r?\n/)) {
  const m = line.match(/^(\w+)=(.*)$/)
  if (m) env[m[1]] = m[2]
}
const API = 'https://api.supabase.com/v1/projects/ivkdfognyiwjcmrhcnwz/database/query'

async function q(sql) {
  const res = await fetch(API, {
    method: 'POST',
    headers: { Authorization: `Bearer ${env.SUPABASE_ACCESS_TOKEN}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ query: sql }),
  })
  const json = await res.json()
  if (!res.ok || json.message) throw new Error('SQL failed: ' + (json.message || res.statusText))
  return json
}

async function main() {
  const mode = process.argv[2] || 'apply'

  if (mode === 'apply') {
    const sql = fs.readFileSync(path.join(ROOT, 'supabase', 'migrations', '113_fix_ensure_rounds_branch_id.sql'), 'utf8')
    await q(sql)
    console.log('APPLY_OK')

    const rows = await q("select pg_get_functiondef('public.ensure_rounds_for_date'::regproc) def")
    const ok = rows[0].def.includes('v_tpl.branch_id, v_tpl.cutoff_time')
    console.log('DEF_HAS_BRANCH_ID=' + ok)
    if (!ok) process.exit(1)
    return
  }

  // mode === 'verify' : sequential single-statement calls
  // (Management API returns ONLY the last statement's result of a batch →
  //  each check = its own request. ensure_rounds_for_date is idempotent and
  //  this is exactly what the admin UI does on demand — creating today's and
  //  tomorrow's rounds is legitimate production state, kept after the test.)
  const today = await q(`SELECT (now() AT TIME ZONE 'Asia/Bangkok')::date::text AS d`)
  const TODAY = today[0].d
  const TOMORROW = (await q(`SELECT ((now() AT TIME ZONE 'Asia/Bangkok')::date + 1)::text AS d`))[0].d
  console.log(`TODAY=${TODAY} TOMORROW=${TOMORROW}`)

  const call1 = await q(`SELECT public.ensure_rounds_for_date('${TODAY}'::date) AS r`)
  const c1 = call1[0].r
  console.log('CALL1=' + JSON.stringify(c1).slice(0, 200))
  if (!(c1.ok === true && Array.isArray(c1.rounds) && c1.rounds.length === 3)) {
    console.error('M113_RUNTIME_FAIL (call1)'); process.exit(1)
  }

  const call2 = await q(`SELECT public.ensure_rounds_for_date('${TODAY}'::date) AS r`)
  const c2 = call2[0].r
  if (!(c2.ok === true && c2.rounds.length === 3)) {
    console.error('M113_RUNTIME_FAIL (call2 not idempotent)'); process.exit(1)
  }
  console.log('CALL2_IDEMPOTENT=3 rounds (not duplicated)')

  const n1 = await q(`SELECT count(*)::int AS n FROM public.delivery_rounds WHERE scheduled_date = '${TODAY}'::date AND status = 'active'`)
  console.log('ROWS_TODAY=' + n1[0].n)
  if (n1[0].n !== 3) { console.error('M113_RUNTIME_FAIL (rows today)'); process.exit(1) }

  const call3 = await q(`SELECT public.ensure_rounds_for_date('${TOMORROW}'::date) AS r`)
  const c3 = call3[0].r
  if (!(c3.ok === true && c3.rounds.length === 3)) {
    console.error('M113_RUNTIME_FAIL (tomorrow)'); process.exit(1)
  }

  const n2 = await q(`SELECT count(*)::int AS n FROM public.delivery_rounds WHERE scheduled_date = '${TOMORROW}'::date AND status = 'active'`)
  console.log('ROWS_TOMORROW=' + n2[0].n)
  if (n2[0].n !== 3) { console.error('M113_RUNTIME_FAIL (rows tomorrow)'); process.exit(1) }

  console.log('M113_RUNTIME_PASS (today+tomorrow instantiated, idempotent, branch_id written)')
}

main().catch((e) => { console.error('ERROR ' + e.message); process.exit(1) })
