// R48 apply 179 — Notification Hub (channel_identities + notification_outbox + RPCs + flags + pg_cron bridge)
// re-run ปลอดภัย (IF NOT EXISTS / ON CONFLICT / CREATE OR REPLACE) · strip BEGIN/COMMIT ให้ Management API
// ตั้ง schedule pg_cron `bmb-notify` */5 ด้วย token ใหม่ random (แพทเทิร์น r41g: secrets set BMB_NOTIFY_TOKEN
// → format(%L) กัน $$ ซ้อน) — token ไม่อยู่ใน git · evidence → e2e/r48Apply179-result.json
const fs = require('fs')
const path = require('path')
const crypto = require('crypto')
const { execSync } = require('child_process')
const ROOT = path.resolve(__dirname, '..')
const AT = (/^SUPABASE_ACCESS_TOKEN=(.*)$/m.exec(fs.readFileSync(path.join(ROOT, '.env.local'), 'utf8')) || [])[1]
if (!AT) { console.error('NO_SUPABASE_ACCESS_TOKEN'); process.exit(1) }
const REF = 'ivkdfognyiwjcmrhcnwz'

const q = async (query) => {
  const r = await fetch(`https://api.supabase.com/v1/projects/${REF}/database/query`, {
    method: 'POST',
    headers: { Authorization: 'Bearer ' + AT, 'Content-Type': 'application/json' },
    body: JSON.stringify({ query }),
  })
  return r.text()
}

const FN = "SELECT p.proname FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace WHERE n.nspname='public' AND p.proname IN ('register_channel_identity','enqueue_notification','claim_notification_outbox','complete_notification','bmb_notify_http') ORDER BY 1"
const TBL = "SELECT table_name FROM information_schema.tables WHERE table_schema='public' AND table_name IN ('channel_identities','notification_outbox') ORDER BY 1"

;(async () => {
  const notifyToken = crypto.randomBytes(18).toString('hex')
  const out = { at: new Date().toISOString() }
  out.precheck = {
    ledgerTop: await q('SELECT version, name FROM supabase_migrations.schema_migrations ORDER BY version DESC LIMIT 3'),
    tablesBefore: await q(TBL),
  }
  const sql = fs.readFileSync(path.join(ROOT, 'supabase', 'migrations', '179_notification_hub.sql'), 'utf8')
    .split('\n').filter((l) => !/^BEGIN;\s*$/i.test(l.trim()) && !/^COMMIT;\s*$/i.test(l.trim())).join('\n')
  out.apply = await q(sql)

  // secret เฉพาะ cron (r41g pattern — ไม่แตะ AUTOMATION_TOKEN ของ path อื่น)
  try {
    execSync(`npx supabase secrets set BMB_NOTIFY_TOKEN=${notifyToken} --project-ref ${REF}`, {
      env: { ...process.env, SUPABASE_ACCESS_TOKEN: AT }, encoding: 'utf8', cwd: ROOT, maxBuffer: 4 * 1024 * 1024,
    })
    out.secret = 'SECRET_SET_OK'
  } catch (e) {
    out.secret = 'SECRET_FAIL ' + String(e.stdout || e.message).slice(0, 200)
  }

  // pg_cron schedule (idempotent + format(%L) = parse ปลอดภัย เหมือน r41g)
  out.schedule = await q(
    "DO $$ BEGIN PERFORM cron.unschedule('bmb-notify'); EXCEPTION WHEN OTHERS THEN NULL; END $$;\n" +
    `DO $$ BEGIN PERFORM cron.schedule('bmb-notify', '*/5 * * * *', format('SELECT public.bmb_notify_http(%L)', '${notifyToken}')); ` +
    "EXCEPTION WHEN OTHERS THEN RAISE NOTICE 'bmb-notify skip: %', SQLERRM; END $$;",
  )
  out.reload = await q("NOTIFY pgrst, 'reload schema'")
  out.verify = {
    fns: await q(FN),
    tables: await q(TBL),
    flags: await q("SELECT value FROM business_settings WHERE key='notification_channels'"),
    cron: await q("SELECT jobname, schedule FROM cron.job WHERE jobname='bmb-notify'"),
  }
  // gate: token ผิดต้อง 401 (ไม่ยิง builders จริง — แค่พิสูจน์ประตู)
  try {
    const r = await fetch(`https://${REF}.supabase.co/functions/v1/notification-dispatcher`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-automation-token': 'wrong' },
      body: JSON.stringify({ job: 'tick' }),
      signal: AbortSignal.timeout(8000),
    })
    out.gate = { status: r.status, body: (await r.text()).slice(0, 120) }
  } catch (e) { out.gate = { error: String(e).slice(0, 120) } }

  out.record = {
    ins179: await q("INSERT INTO supabase_migrations.schema_migrations (version, name, statements) VALUES ('179','179_notification_hub','{}'::text[]) ON CONFLICT (version) DO NOTHING"),
    ledgerTopAfter: await q('SELECT version, name FROM supabase_migrations.schema_migrations ORDER BY version DESC LIMIT 5'),
  }
  const parse = (t) => { try { return JSON.parse(t) } catch { return null } }
  const fns = parse(out.verify.fns) || []
  const tables = parse(out.verify.tables) || []
  const cron = parse(out.verify.cron) || []
  const checks = {
    tables: tables.length === 2,
    fns: fns.length === 5,
    cron: cron.length >= 1,
    secret: out.secret === 'SECRET_SET_OK',
    gate401: out.gate && out.gate.status === 401,
    ledger: String(out.record.ledgerTopAfter || '').includes('179'),
  }
  out.ALL_PASS = Object.values(checks).every(Boolean)
  out.checks = checks
  fs.writeFileSync(path.join(ROOT, 'e2e', 'r48Apply179-result.json'), JSON.stringify(out, null, 2))
  console.log(JSON.stringify({ ALL_PASS: out.ALL_PASS, checks, fns: fns.map((f) => f.proname || f), tables: tables.map((t) => t.table_name || t), gate: out.gate }))
  process.exit(out.ALL_PASS ? 0 : 1)
})().catch((e) => { console.error('APPLY_FAILED', e); process.exit(1) })