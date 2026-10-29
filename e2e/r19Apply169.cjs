// R19 apply 169 (Owner สั่ง __apply 169__ · 2026-10-29): driver_path_folder ตัด run %XX ก่อน strip
// = fix regression จาก 166 (contract 138-139 G7 RLS บล็อก INSERT) · re-run ปลอดภัย (CREATE OR REPLACE)
// Evidence → e2e/r19Apply169-result.json. Run: node e2e/r19Apply169.cjs
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
// def ของ function จาก pg_get_functiondef (เช็กเนื้อหาว่า decode %XX แล้ว)
const DEF = (name, args) =>
  "SELECT pg_get_functiondef(p.oid)::text AS def FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace " +
  "WHERE n.nspname = 'public' AND p.proname = '" + name + "'" +
  (args ? " AND pg_get_function_identity_arguments(p.oid) = '" + args + "'" : '')
// พิสูจน์พฤติิิทธิ์: folder แบบ %XX-encoded ต้องเท่ากับ raw ทุกกรณี (space / #)
const PROBE =
  "SELECT " +
  "public.driver_path_folder('drv-%20c139-60bc') = public.driver_path_folder('drv- c139-60bc') AS space_eq, " +
  "public.driver_path_folder('drv-%23c139-60bc') = public.driver_path_folder('drv-#c139-60bc') AS hash_eq, " +
  "public.driver_path_folder('drv-%2520c139-60bc') = public.driver_path_folder('drv-%20c139-60bc') AS double_enc_eq, " +
  "public.driver_path_folder('drv-plain-60bc') AS plain, " +
  "public.driver_path_folder('drv-%20c139-60bc') AS enc_sanitized"

;(async () => {
  const out = { at: new Date().toISOString() }

  // stage 1: precheck (ต้องเห็น def เดิมของ 166 = ยังไม่ decode %XX)
  out.precheck = {
    ledgerTop: await q('SELECT version, name FROM supabase_migrations.schema_migrations ORDER BY version DESC LIMIT 3'),
    folderDefBefore: await q(DEF('driver_path_folder', 'text')),
    podDefBefore: await q(DEF('pod_path_is_driver', 'text')),
    probeBefore: await q(PROBE),
  }

  // stage 2: apply
  const sql = fs.readFileSync(path.join(ROOT, 'supabase', 'migrations', '169_pod_path_percent_encoding.sql'), 'utf8')
  out.apply = await q(sql)

  // stage 3: verify (def ใหม่ + พฤติกรรม)
  out.verify = {
    folderDefAfter: await q(DEF('driver_path_folder', 'text')),
    podDefAfter: await q(DEF('pod_path_is_driver', 'text')),
    probeAfter: await q(PROBE),
    podDefStillSecurityDefiner: await q(
      "SELECT p.prosecdef AS security_definer, p.provolatile AS volatility, l.lanname AS lang " +
      "FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace JOIN pg_language l ON l.oid = p.prolang " +
      "WHERE n.nspname = 'public' AND p.proname = 'pod_path_is_driver' AND pg_get_function_identity_arguments(p.oid) = 'text'"),
  }

  // stage 4: ledger
  out.record = {
    ins169: await q("INSERT INTO supabase_migrations.schema_migrations (version, name, statements) VALUES ('169','169_pod_path_percent_encoding','{}'::text[]) ON CONFLICT (version) DO NOTHING"),
    ledgerTopAfter: await q('SELECT version, name FROM supabase_migrations.schema_migrations ORDER BY version DESC LIMIT 5'),
  }

  // assertions
  try {
    const def = JSON.parse(out.verify.folderDefAfter)?.[0]?.def || ''
    out.assertions = { decodesPercent: def.includes('%[0-9A-Fa-f]{2}'), stripsOutsideSet: def.includes('[^A-Za-z0-9_-]') }
    const before = JSON.parse(out.precheck.folderDefBefore)?.[0]?.def || ''
    out.assertions.precheckHadNoDecode = !before.includes('%[0-9A-Fa-f]{2}')
  } catch (e) { out.assertions = { error: String(e).slice(0, 300) } }
  try {
    const p = JSON.parse(out.verify.probeAfter)?.[0] || {}
    out.probeAssertions = { space_eq: p.space_eq === true, hash_eq: p.hash_eq === true, double_enc_eq: p.double_enc_eq === true, plain: p.plain, enc_sanitized: p.enc_sanitized }
    const pb = JSON.parse(out.precheck.probeBefore)?.[0] || {}
    out.probeAssertions.before_space_eq = pb.space_eq
  } catch (e) { out.probeAssertions = { error: String(e).slice(0, 300), raw: String(out.verify.probeAfter).slice(0, 400) } }
  try {
    const sd = JSON.parse(out.verify.podDefStillSecurityDefiner)?.[0] || {}
    out.podAssertions = { security_definer: sd.security_definer === 's', volatility: sd.volatility, lang: sd.lang }
  } catch (e) { out.podAssertions = { error: String(e).slice(0, 300) } }
  try {
    const led = JSON.parse(out.record.ledgerTopAfter) || []
    out.ledgerAssertions = { top: led[0], has169: led.some((r) => r.version === '169'), count: led.length }
  } catch (e) { out.ledgerAssertions = { error: String(e).slice(0, 300) } }

  fs.writeFileSync(path.join(__dirname, 'r19Apply169-result.json'), JSON.stringify(out, null, 2))
  console.log(JSON.stringify(out, null, 2))
})().catch((e) => console.log('FATAL ' + String(e).slice(0, 500)))
