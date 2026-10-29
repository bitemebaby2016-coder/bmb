// R19 verify 169 (after apply): จับ def จริงจาก pg_get_functiondef + พฤติกรรม + ledger
// (ตัว apply เอง เขียน DEF query กรองด้วย identity args ผิด → ตัวนี้ยืนยันซ้ำให้ครบ)
// Evidence → e2e/r19Verify169-result.json. Run: node e2e/r19Verify169.cjs
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

  out.defs = await q(
    "SELECT p.proname, pg_get_function_identity_arguments(p.oid) AS args, p.prosecdef AS security_definer, " +
    "p.provolatile AS volatility, pg_get_functiondef(p.oid)::text AS def " +
    "FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace " +
    "WHERE n.nspname = 'public' AND p.proname IN ('driver_path_folder','pod_path_is_driver') ORDER BY p.proname")

  out.probe = await q(
    "SELECT " +
    "public.driver_path_folder('drv-%20c139-60bc') = public.driver_path_folder('drv- c139-60bc') AS space_eq, " +
    "public.driver_path_folder('drv-%23c139-60bc') = public.driver_path_folder('drv-#c139-60bc') AS hash_eq, " +
    "public.driver_path_folder('drv-%20%23c139-60bc') = public.driver_path_folder('drv- #c139-60bc') AS mixed_eq, " +
    "public.driver_path_folder(' drv-plain ') AS plain_stripped, " +
    "public.driver_path_folder('drv-%20c139-60bc') AS enc_sanitized")

  out.ledger = await q('SELECT version, name FROM supabase_migrations.schema_migrations ORDER BY version DESC LIMIT 5')

  try {
    const rows = JSON.parse(out.defs) || []
    const folder = rows.find((r) => r.proname === 'driver_path_folder') || {}
    const pod = rows.find((r) => r.proname === 'pod_path_is_driver') || {}
    out.assertions = {
      rowCount: rows.length,
      folderDropsPercentRun: String(folder.def || '').includes('%[0-9A-Fa-f]{2}'),
      folderStripsOutsideSet: String(folder.def || '').includes('[^A-Za-z0-9_-]'),
      folderImmutable: folder.volatility === 'i',
      podSecurityDefiner: pod.security_definer === true || pod.security_definer === 's',
      podStable: pod.volatility === 's',
      podCallsFolder: String(pod.def || '').includes('driver_path_folder'),
    }
  } catch (e) { out.assertions = { error: String(e).slice(0, 300) } }
  try {
    const p = JSON.parse(out.probe)?.[0] || {}
    out.probeAssertions = { space_eq: p.space_eq === true, hash_eq: p.hash_eq === true, mixed_eq: p.mixed_eq === true, plain_stripped: p.plain_stripped, enc_sanitized: p.enc_sanitized }
  } catch (e) { out.probeAssertions = { error: String(e).slice(0, 300) } }
  try {
    const led = JSON.parse(out.ledger) || []
    out.ledgerAssertions = { top: led[0], has169: led.some((r) => r.version === '169') }
  } catch (e) { out.ledgerAssertions = { error: String(e).slice(0, 300) } }

  fs.writeFileSync(path.join(__dirname, 'r19Verify169-result.json'), JSON.stringify(out, null, 2))
  console.log(JSON.stringify(out, null, 2))
})().catch((e) => console.log('FATAL ' + String(e).slice(0, 500)))
