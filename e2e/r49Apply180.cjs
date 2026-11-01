// R49 apply 180 + 181 — cart_sessions/reminder_days + Add-on Margin Rules (Admin-driven)
// re-run ปลอดภัย (IF NOT EXISTS / ON CONFLICT / CREATE OR REPLACE) · strip BEGIN/COMMIT
// evidence → e2e/r49Apply180-result.json
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
  return r.text()
}

const strip = (f) => fs.readFileSync(path.join(ROOT, 'supabase', 'migrations', f), 'utf8')
  .split('\n').filter((l) => !/^BEGIN;\s*$/i.test(l.trim()) && !/^COMMIT;\s*$/i.test(l.trim())).join('\n')

;(async () => {
  const out = { at: new Date().toISOString() }
  out.precheck = { ledgerTop: await q('SELECT version, name FROM supabase_migrations.schema_migrations ORDER BY version DESC LIMIT 3') }
  out.apply180 = await q(strip('180_cart_sessions_reminder.sql'))
  out.apply181 = await q(strip('181_addon_margin_rules.sql'))
  out.reload = await q("NOTIFY pgrst, 'reload schema'")
  out.verify = {
    tables: await q("SELECT table_name FROM information_schema.tables WHERE table_schema='public' AND table_name = 'cart_sessions'"),
    settingFn: await q("SELECT p.proname FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace WHERE n.nspname='public' AND p.proname = 'addon_margin_setting'"),
    promoFnHasAdminCap: await q("SELECT (prosrc LIKE '%addon_margin_setting%') AS admin_cap, (prosrc LIKE '%* 0.15%') AS still_hardcoded FROM pg_proc WHERE proname='promotion_apply_rules'"),
    addonFnHasPromo: await q("SELECT (prosrc LIKE '%promo_price%') AS reads_promo FROM pg_proc WHERE proname='compute_addons_price'"),
    policy: await q("SELECT value FROM business_settings WHERE key='addon_margin_policy'"),
    reminderDays: await q("SELECT value->>'reminder_days' AS rd FROM business_settings WHERE key='order_policy'"),
  }
  out.record = {
    ins180: await q("INSERT INTO supabase_migrations.schema_migrations (version, name, statements) VALUES ('180','180_cart_sessions_reminder','{}'::text[]) ON CONFLICT (version) DO NOTHING"),
    ins181: await q("INSERT INTO supabase_migrations.schema_migrations (version, name, statements) VALUES ('181','181_addon_margin_rules','{}'::text[]) ON CONFLICT (version) DO NOTHING"),
    ledgerTopAfter: await q('SELECT version, name FROM supabase_migrations.schema_migrations ORDER BY version DESC LIMIT 5'),
  }
  const parse = (t) => { try { return JSON.parse(t) } catch { return null } }
  const tables = parse(out.verify.tables) || []
  const settingFn = parse(out.verify.settingFn) || []
  const promoFn = (parse(out.verify.promoFnHasAdminCap) || [{}])[0] || {}
  const addonFn = (parse(out.verify.addonFnHasPromo) || [{}])[0] || {}
  const checks = {
    cart_sessions: tables.length === 1,
    addon_margin_setting: settingFn.length === 1,
    cap_admin_driven: promoFn.admin_cap === true && promoFn.still_hardcoded === false,
    promo_price_server: addonFn.reads_promo === true,
    ledger180: String(out.record.ledgerTopAfter || '').includes('180'),
    ledger181: String(out.record.ledgerTopAfter || '').includes('181'),
  }
  out.ALL_PASS = Object.values(checks).every(Boolean)
  out.checks = checks
  fs.writeFileSync(path.join(ROOT, 'e2e', 'r49Apply180-result.json'), JSON.stringify(out, null, 2))
  console.log(JSON.stringify({ ALL_PASS: out.ALL_PASS, checks }))
  process.exit(out.ALL_PASS ? 0 : 1)
})().catch((e) => { console.error('APPLY_FAILED', e); process.exit(1) })