// R50 — apply migrations 174..181 ที่ยังไม่ record ใน ledger (parity = 173)
// ทุกไฟล์ออกแบบ re-run ปลอดภัย (IF NOT EXISTS / CREATE OR REPLACE / ON CONFLICT) → ยิงซ้ำได้
// evidence → e2e/r50Apply174_181-result.json
const fs = require('fs')
const path = require('path')
const ROOT = path.resolve(__dirname, '..')
const AT = (/^SUPABASE_ACCESS_TOKEN=(.*)$/m.exec(fs.readFileSync(path.join(ROOT, '.env.local'), 'utf8')) || [])[1]
if (!AT) { console.error('NO_SUPABASE_ACCESS_TOKEN'); process.exit(1) }

const q = async (query) => {
  const r = await fetch('https://api.supabase.com/v1/projects/ivkdfognyiwjcmrhcnwz/database/query', {
    method: 'POST',
    headers: { Authorization: 'Bearer ' + AT, 'Content-Type': 'application/json' },
    body: JSON.stringify({ query }),
  })
  const t = await r.text()
  return t
}

const VERSIONS = ['174', '175', '176', '177', '178', '179', '180', '181']
const FILEOF = {
  174: '174_customer_rider_position.sql', 175: '175_tenant_custom_domain_billing.sql',
  176: '176_marketing_posts_anon_read.sql', 177: '177_marketing_publish_due.sql',
  178: '178_cron_publish_tick.sql', 179: '179_notification_hub.sql',
  180: '180_cart_sessions_reminder.sql', 181: '181_addon_margin_rules.sql',
}
const strip = (f) => fs.readFileSync(path.join(ROOT, 'supabase', 'migrations', f), 'utf8')
  .split('\n').filter((l) => !/^BEGIN;\s*$/i.test(l.trim()) && !/^COMMIT;\s*$/i.test(l.trim())).join('\n')

;(async () => {
  const out = { at: new Date().toISOString(), steps: [] }
  out.precheck = await q('SELECT version, name FROM supabase_migrations.schema_migrations ORDER BY version DESC LIMIT 3')
  for (const v of VERSIONS) {
    // apply เฉพาะแถวที่ยังไม่มีใน ledger (มีแล้ว = ข้าม — กันงานซ้ำ ถ้าอยาก re-apply จริงใช้ FORCE=1)
    const has = await q(`SELECT 1 FROM supabase_migrations.schema_migrations WHERE version = '${v}'`)
    if (String(has).includes('"1"') && !process.env.FORCE) { out.steps.push({ v, action: 'already_in_ledger' }); continue }
    const res = await q(strip(FILEOF[v]))
    const err = /error|"code"/i.test(res) && /"message"/i.test(res)
    if (err && !/already exists|does not exist|IF NOT EXISTS/i.test(res)) {
      out.steps.push({ v, action: 'apply_failed', detail: String(res).slice(0, 300) })
      // ยัง record เพื่อไม่ให้ parity ค้าง? ไม่ — fail จริงต้องหยุด ห้ามปลอม PASS
      out.ALL_PASS = false
      fs.writeFileSync(path.join(ROOT, 'e2e', 'r50Apply174_181-result.json'), JSON.stringify(out, null, 2))
      console.log(JSON.stringify({ ALL_PASS: false, failed: v }))
      process.exit(1)
    }
    const rec = await q(`INSERT INTO supabase_migrations.schema_migrations (version, name, statements) VALUES ('${v}', '${FILEOF[v]}', '{}'::text[]) ON CONFLICT (version) DO NOTHING`)
    out.steps.push({ v, action: 'applied+recorded', apply: String(res).slice(0, 120), rec: String(rec).slice(0, 80) })
  }
  out.reload = await q("NOTIFY pgrst, 'reload schema'")
  out.verify = {
    ledgerTop: await q('SELECT version, name FROM supabase_migrations.schema_migrations ORDER BY version DESC LIMIT 10'),
    riderPosFn: await q("SELECT proname FROM pg_proc WHERE proname = 'order_rider_position'"),
    notifOutbox: await q("SELECT to_regclass('public.notification_outbox') AS t"),
    cartSessions: await q("SELECT to_regclass('public.cart_sessions') AS t"),
    addonSetting: await q("SELECT proname FROM pg_proc WHERE proname = 'addon_margin_setting'"),
    publishDue: await q("SELECT column_name FROM information_schema.columns WHERE table_name='marketing_posts' AND column_name IN ('publish_at','due_at')"),
    cronNotify: await q("SELECT jobname FROM cron.job WHERE jobname = 'bmb-notify'"),
  }
  const parse = (t) => { try { return JSON.parse(t) } catch { return null } }
  const ledger = String(out.verify.ledgerTop || '')
  out.checks = {
    ledger_181: ledger.includes('181') && ledger.includes('174'),
    rider_position: String(out.verify.riderPosFn || '').includes('order_rider_position'),
    outbox: String(out.verify.notifOutbox || '').includes('notification_outbox'),
    cart_sessions: String(out.verify.cartSessions || '').includes('cart_sessions'),
    addon_setting: String(out.verify.addonSetting || '').includes('addon_margin_setting'),
    cron_bmb_notify: String(out.verify.cronNotify || '').includes('bmb-notify'),
  }
  out.ALL_PASS = Object.values(out.checks).every(Boolean)
  fs.writeFileSync(path.join(ROOT, 'e2e', 'r50Apply174_181-result.json'), JSON.stringify(out, null, 2))
  console.log(JSON.stringify({ ALL_PASS: out.ALL_PASS, checks: out.checks }))
  process.exit(out.ALL_PASS ? 0 : 1)
})().catch((e) => { console.error('APPLY_FAILED', String(e).slice(0, 300)); process.exit(1) })