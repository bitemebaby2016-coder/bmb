// R12 apply 165 (Owner ยืนยัน 2026-10-28): seed business_settings key 'seo'
// = {description, tagline} — SEO copy ให้ admin แก้เอง (meta/JSON-LD อ่านค่าจริง)
// Applies supabase/migrations/165_seed_business_settings_seo_copy.sql then verifies
// the row + keeps the anon-read policy (164) intact + records the ledger.
// Evidence → e2e/r12Apply165-result.json. Run: node e2e/r12Apply165.cjs
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
    seoBefore: await q("SELECT key, value, jsonb_typeof(value) AS vt FROM public.business_settings WHERE key IN ('seo','social_links') ORDER BY key"),
    publicReadPolicy: await q("SELECT cmd, roles, qual FROM pg_policies WHERE schemaname='public' AND tablename='business_settings' AND policyname='business_settings_public_read'"),
  }

  // ---- stage 2: apply migration 165 (idempotent seed) ----
  const sql = fs.readFileSync(path.join(ROOT, 'supabase', 'migrations', '165_seed_business_settings_seo_copy.sql'), 'utf8')
  out.apply = await q(sql)

  // ---- stage 3: verify (row 'seo' มาแล้ว + policy 164 ยังเปิดอ่าน) ----
  out.verify = {
    seoAfter: await q("SELECT key, jsonb_build_object('description', value->>'description', 'tagline', value->>'tagline') AS copy FROM public.business_settings WHERE key = 'seo'"),
    publicReadPolicyAfter: await q("SELECT cmd, roles, qual FROM pg_policies WHERE schemaname='public' AND tablename='business_settings' AND policyname='business_settings_public_read'"),
  }

  // ---- stage 4: record ledger 165 ----
  out.record = {
    ins165: await q("INSERT INTO supabase_migrations.schema_migrations (version, name, statements) VALUES ('165','165_seed_business_settings_seo_copy','{}'::text[]) ON CONFLICT (version) DO NOTHING"),
    ledgerTopAfter: await q('SELECT version, name FROM supabase_migrations.schema_migrations ORDER BY version DESC LIMIT 5'),
  }

  fs.writeFileSync(path.join(__dirname, 'r12Apply165-result.json'), JSON.stringify(out, null, 2))
  console.log(JSON.stringify(out, null, 2))
})().catch((e) => console.log('FATAL ' + String(e).slice(0, 300)))