// R12 apply 164 (Owner อนุมัติ 2026-10-28): anon+authenticated เห็น business_settings ทั้งหมด
// (policy `business_settings_public_read` เปลี่ยนจาก whitelist 5 key (077/088) เป็น USING (true))
// Applies supabase/migrations/164_anon_read_business_settings_all.sql then verifies
// the policy + records the migration ledger (same 4-stage pattern as r11Apply163).
// Evidence → e2e/r12Apply164-result.json. Run: node e2e/r12Apply164.cjs
const fs = require('fs')
const path = require('path')
const ROOT = path.resolve(__dirname, '..')
const AT = (/^SUPABASE_ACCESS_TOKEN=(.*)$/m.exec(fs.readFileSync(path.join(ROOT, '.env.local'), 'utf8')) || [])[1]
const q = async (query) => {
  const r = await fetch('https://api.supabase.com/v1/projects/ivkdfognyiwjcmrhcnwz/database/query', {
    method: 'POST', headers: { Authorization: 'Bearer ' + AT, 'Content-Type': 'application/json' },
    body: JSON.stringify({ query }) })
  return r.text()
}
;(async () => {
  const out = { at: new Date().toISOString() }

  // ---- stage 1: precheck (read-only) ----
  out.precheck = {
    ledgerTop: await q('SELECT version, name FROM supabase_migrations.schema_migrations ORDER BY version DESC LIMIT 5'),
    policiesBefore: await q(
      "SELECT policyname, cmd, roles, qual, with_check FROM pg_policies WHERE schemaname = 'public' AND tablename = 'business_settings' ORDER BY policyname"),
  }

  // ---- stage 2: apply migration 164 (idempotent — DROP IF EXISTS + CREATE) ----
  const sql = fs.readFileSync(path.join(ROOT, 'supabase', 'migrations', '164_anon_read_business_settings_all.sql'), 'utf8')
  out.apply = await q(sql)

  // ---- stage 3: verify (policy allowed to anon+authenticated with USING true) ----
  out.verify = {
    policiesAfter: await q(
      "SELECT policyname, cmd, roles, qual, with_check FROM pg_policies WHERE schemaname = 'public' AND tablename = 'business_settings' ORDER BY policyname"),
  }

  // ---- stage 4: record ledger 164 ----
  out.record = {
    ins164: await q("INSERT INTO supabase_migrations.schema_migrations (version, name, statements) VALUES ('164','164_anon_read_business_settings_all','{}'::text[]) ON CONFLICT (version) DO NOTHING"),
    ledgerTopAfter: await q('SELECT version, name FROM supabase_migrations.schema_migrations ORDER BY version DESC LIMIT 5'),
  }

  fs.writeFileSync(path.join(__dirname, 'r12Apply164-result.json'), JSON.stringify(out, null, 2))
  console.log(JSON.stringify(out, null, 2))
})().catch((e) => console.log('FATAL ' + String(e).slice(0, 300)))