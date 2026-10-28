// R12 (Owner 2026-10-27): restore the missing LINE link in production.
// Uses the REAL values that were already saved by the admin in business_settings
// (line=https://line.me/ti/p/QFD3bSMFN9 · line_id=bitemebaby2016) — full object
// restore, other social keys untouched. Admin stays in control via AdminSettings.
// Evidence → e2e/r12RestoreLine-result.json. Run: node e2e/r12RestoreLine.cjs
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
  out.before = await q("SELECT value FROM public.business_settings WHERE key = 'social_links'")
  out.apply = await q(
    "INSERT INTO public.business_settings (key, value, updated_at) VALUES (" +
    "'social_links', " +
    "'{\"line\":\"https://line.me/ti/p/QFD3bSMFN9\",\"line_id\":\"bitemebaby2016\"," +
    "\"facebook\":\"https://web.facebook.com/profile.php?id=61586146030943\"," +
    "\"messenger\":\"https://m.me/61586146030943\",\"instagram\":\"\",\"tiktok\":\"\",\"youtube\":\"\"}'::jsonb, " +
    "NOW()) ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = NOW()"
  )
  out.after = await q("SELECT value FROM public.business_settings WHERE key = 'social_links'")
  fs.writeFileSync(path.join(__dirname, 'r12RestoreLine-result.json'), JSON.stringify(out, null, 2))
  console.log(JSON.stringify(out, null, 2))
})().catch((e) => console.log('FATAL ' + String(e).slice(0, 300)))