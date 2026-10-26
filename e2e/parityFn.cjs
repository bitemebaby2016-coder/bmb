// parity ย่อยหลัง apply 159 — เทียบ "ชุดฟังก์ชัน" local snapshot vs production แบบ fresh (READ-ONLY)
//   scope: functions (proname+identity args) + acl_functions (anon/auth/svc EXECUTE) — ไม่เทียบ body
//   เหตุผล: กลุ่ม drift เดิม 3 = functions/acl_functions/policies → policies ปิดด้วย 157/158 ·
//   functions/acl ควรปิดด้วย 159 → พิสูจน์รอบนี้
//   ผล = e2e/w1-parityfn-after159-2026-10-26.json + stdout
const fs = require('fs')
const path = require('path')
const token = (/^SUPABASE_ACCESS_TOKEN=(.*)$/m.exec(fs.readFileSync('.env.local', 'utf8')) || [])[1]
if (!token) { console.log('NO_TOKEN'); process.exit(1) }
const REF = 'ivkdfognyiwjcmrhcnwz'
const q = async (query) => {
  const r = await fetch(`https://api.supabase.com/v1/projects/${REF}/database/query`, {
    method: 'POST',
    headers: { Authorization: 'Bearer ' + token, 'Content-Type': 'application/json' },
    body: JSON.stringify({ query }),
  })
  return { status: r.status, body: await r.text() }
}
const local = JSON.parse(fs.readFileSync(path.join(__dirname, 'w1-local-snapshot-2026-10-26.json'), 'utf8'))
const keyFn = (r) => r.proname + '§' + r.args
const tally = (rows) => {
  const m = new Map()
  for (const r of rows) m.set(keyFn(r), (m.get(keyFn(r)) || 0) + 1)
  return m
}
const diff = (aRows, bRows) => {
  const ma = tally(aRows), mb = tally(bRows)
  const onlyA = [], onlyB = []
  for (const [k, n] of ma) { const d = n - (mb.get(k) || 0); if (d > 0) onlyA.push({ sig: k, count: d }) }
  for (const [k, n] of mb) { const d = n - (ma.get(k) || 0); if (d > 0) onlyB.push({ sig: k, count: d }) }
  return { onlyLocal: onlyA, onlyProd: onlyB, status: onlyA.length || onlyB.length ? 'DRIFT' : 'MATCH' }
}
;(async () => {
  const fnQ = await q(`SELECT p.proname, pg_get_function_identity_arguments(p.oid) AS args
    FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' ORDER BY 1, 2`)
  const aclQ = await q(`SELECT p.proname, pg_get_function_identity_arguments(p.oid) AS args,
      has_function_privilege('anon', p.oid, 'EXECUTE') AS anon_exec,
      has_function_privilege('authenticated', p.oid, 'EXECUTE') AS auth_exec,
      has_function_privilege('service_role', p.oid, 'EXECUTE') AS svc_exec
    FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' ORDER BY 1, 2`)
  if (fnQ.status >= 400 || aclQ.status >= 400) {
    console.log('QUERY_FAIL fn=' + fnQ.status + ' acl=' + aclQ.status)
    console.log(fnQ.body.slice(0, 300))
    process.exit(1)
  }
  const prodFn = JSON.parse(fnQ.body)
  const prodAcl = JSON.parse(aclQ.body)
  const localFn = local.rows.functions.map((r) => ({ proname: r.proname, args: r.args }))
  const localAcl = local.rows.acl_functions.map((r) => ({ proname: r.proname, args: r.args, anon_exec: r.anon_exec, auth_exec: r.auth_exec, svc_exec: r.svc_exec }))
  const fnD = diff(localFn, prodFn)
  // acl เทียบแบบ bool ด้วย key แยก (sig + flags)
  const aclKey = (r) => [r.proname, r.args, !!r.anon_exec, !!r.auth_exec, !!r.svc_exec].join('§')
  const aclTally = (rows) => { const m = new Map(); for (const r of rows) m.set(aclKey(r), (m.get(aclKey(r)) || 0) + 1); return m }
  const mla = aclTally(localAcl), mpa = aclTally(prodAcl)
  const aclOnlyLocal = [], aclOnlyProd = []
  for (const [k, n] of mla) { const d = n - (mpa.get(k) || 0); if (d > 0) aclOnlyLocal.push({ sig: k, count: d }) }
  for (const [k, n] of mpa) { const d = n - (mla.get(k) || 0); if (d > 0) aclOnlyProd.push({ sig: k, count: d }) }
  const aclStatus = aclOnlyLocal.length || aclOnlyProd.length ? 'DRIFT' : 'MATCH'
  const report = {
    generatedAt: new Date().toISOString(),
    scope: "schema public — functions (proname+identity args) + acl_functions (anon/auth/svc EXECUTE) เท่านั้น · ไม่เทียบ body/ผลลัพธ์",
    localSource: 'w1-local-snapshot-2026-10-26.json (replay ผ่าน 158 · 159 = DROP only จึง local set = repo set)',
    prodSource: 'fresh Management API read หลัง apply 159',
    functions: { status: fnD.status, local: localFn.length, prod: prodFn.length, onlyLocal: fnD.onlyLocal, onlyProd: fnD.onlyProd },
    acl_functions: { status: aclStatus, local: localAcl.length, prod: prodAcl.length, onlyLocal: aclOnlyLocal, onlyProd: aclOnlyProd },
    verdict: fnD.status === 'MATCH' && aclStatus === 'MATCH' ? 'PASS' : 'DRIFT',
  }
  fs.writeFileSync(path.join(__dirname, 'w1-parityfn-after159-2026-10-26.json'), JSON.stringify(report, null, 2))
  console.log('functions     ' + report.functions.status + '  local=' + report.functions.local + ' prod=' + report.functions.prod)
  if (fnD.onlyLocal.length) console.log('  onlyLocal: ' + JSON.stringify(fnD.onlyLocal.slice(0, 10)))
  if (fnD.onlyProd.length) console.log('  onlyProd: ' + JSON.stringify(fnD.onlyProd.slice(0, 10)))
  console.log('acl_functions ' + aclStatus + '  local=' + report.acl_functions.local + ' prod=' + report.acl_functions.prod)
  if (aclOnlyLocal.length) console.log('  onlyLocal: ' + JSON.stringify(aclOnlyLocal.slice(0, 10)))
  if (aclOnlyProd.length) console.log('  onlyProd: ' + JSON.stringify(aclOnlyProd.slice(0, 10)))
  console.log('VERDICT=' + report.verdict)
})().catch((e) => { console.log('ERR ' + e.message); process.exit(1) })