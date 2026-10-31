// R42 — Owner "อนุมัติ apply 177 178" → re-verify ทั้งคู่แบบเต็ม + เติม ledger 178 (ถ้าขาด = insert · ON CONFLICT)
// evidence → stdout (อ้างใน TEST_PACK/work-state)
const fs = require('fs')
const path = require('path')
const ROOT = path.resolve(__dirname, '..')
const AT = (/^SUPABASE_ACCESS_TOKEN=(.*)$/m.exec(fs.readFileSync(path.join(ROOT, '.env.local'), 'utf8')) || [])[1]
const ENV = fs.readFileSync(path.join(ROOT, '.env.local'), 'utf8')
const ANON = (/^VITE_SUPABASE_ANON_KEY=(.*)$/m.exec(ENV) || [])[1]
const REF = 'ivkdfognyiwjcmrhcnwz'
const q = async (query) => {
  const r = await fetch(`https://api.supabase.com/v1/projects/${REF}/database/query`, {
    method: 'POST', headers: { Authorization: 'Bearer ' + AT, 'Content-Type': 'application/json' },
    body: JSON.stringify({ query }),
  })
  return r.text()
}
;(async () => {
  const out = { at: new Date().toISOString() }
  out.ledgerBefore = await q("SELECT version, name FROM supabase_migrations.schema_migrations WHERE version IN ('176','177','178') ORDER BY version")
  // เติม ledger 178 (apply script รอบ R41 ตายก่อน insert — Owner อนุมัติแล้ว = บันทึกให้ครบ)
  out.ledger178 = await q("INSERT INTO supabase_migrations.schema_migrations (version, name, statements) VALUES ('178','178_cron_publish_tick','{}'::text[]) ON CONFLICT (version) DO NOTHING")
  out.ledgerAfter = await q("SELECT version, name FROM supabase_migrations.schema_migrations WHERE version IN ('176','177','178') ORDER BY version")
  // m177
  out.m177 = {
    fns: await q("SELECT p.proname, p.prosecdef, p.proacl::text FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='public' AND p.proname IN ('marketing_publish_due','marketing_feed_posts') ORDER BY 1"),
    promoteNow: await q('SELECT public.marketing_publish_due() AS promoted'),
    dueLeft: await q("SELECT id, status FROM public.marketing_posts WHERE status='scheduled' AND scheduled_for <= now()"),
  }
  // m178
  out.m178 = {
    ext: await q("SELECT extname FROM pg_extension WHERE extname IN ('pg_cron','pg_net')"),
    cron: await q("SELECT jobname, schedule, active FROM cron.job ORDER BY jobname"),
    fnTick: await q("SELECT proname FROM pg_proc WHERE proname='bmb_tick_http'"),
  }
  try {
    const r = await fetch(`https://${REF}.supabase.co/functions/v1/cron-tick`, {
      method: 'POST', headers: { 'Content-Type': 'application/json', 'x-tick-token': 'verify-wrong' },
      body: JSON.stringify({ job: 'marketing_publish' }), signal: AbortSignal.timeout(8000),
    })
    out.m178.gate = `HTTP ${r.status} ${(await r.text()).slice(0, 80)}`
  } catch (e) { out.m178.gate = 'ERR ' + String(e).slice(0, 120) }
  const has = (x, needle) => String(x).includes(needle)
  out.allPass =
    has(out.ledgerAfter, '"177"') && has(out.ledgerAfter, '"178"') &&
    has(out.m177.fns, 'marketing_publish_due') && has(out.m177.fns, 'marketing_feed_posts') &&
    has(out.m177.fns, 'anon') && // acl มี anon สำหรับ feed
    String(out.m177.dueLeft).trim() === '[]' &&
    has(out.m178.ext, 'pg_cron') && has(out.m178.ext, 'pg_net') &&
    has(out.m178.cron, 'bmb-promote') && has(out.m178.cron, 'bmb-tick') &&
    has(out.m178.gate, '401')
  console.log('ALL_PASS=' + out.allPass)
  console.log('LEDGER=' + out.ledgerAfter)
  console.log('M177_FNS=' + String(out.m177.fns).slice(0, 500))
  console.log('PROMOTED=' + out.m177.promoteNow + ' DUE_LEFT=' + out.m177.dueLeft)
  console.log('M178_EXT=' + out.m178.ext + ' CRON=' + out.m178.cron + ' GATE=' + out.m178.gate)
  fs.writeFileSync(path.join(__dirname, 'r42_verify177178.json'), JSON.stringify(out, null, 2))
})().catch((e) => console.log('FATAL ' + String(e).slice(0, 500)))