// R72 — apply migrations 188 (notification dedup) + 189 (claim=accept fallback)
// re-run ปลอดภัย (CREATE OR REPLACE / idempotent) → evidence e2e/_r72Apply-result.json
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
  return await r.text()
}

const MIGS = [
  ['188', '188_order_notification_dedup.sql'],
  ['189', '189_claim_offer_accept_fallback.sql'],
]
const strip = (f) => fs.readFileSync(path.join(ROOT, 'supabase', 'migrations', f), 'utf8')
  .split('\n').filter((l) => !/^BEGIN;\s*$/i.test(l.trim()) && !/^COMMIT;\s*$/i.test(l.trim())).join('\n')

;(async () => {
  const out = { at: new Date().toISOString(), steps: [] }
  for (const [V, FILE] of MIGS) {
    const has = await q(`SELECT 1 FROM supabase_migrations.schema_migrations WHERE version = '${V}'`)
    if (String(has).includes('"1"') && !process.env.FORCE) {
      out.steps.push({ v: V, action: 'already_in_ledger' })
      continue
    }
    const res = await q(strip(FILE))
    // R72 fix: Supabase SQL API error บางแบบไม่มี key "code" (syntax error = {"message": ...})
    // — ถ้า response ไม่ใช่ผลลัพธ์ปกติ ([...]) ให้ถือว่าพัง
    const err = !/^\s*\[/.test(res)
    if (err) {
      out.steps.push({ v: V, action: 'apply_failed', detail: String(res).slice(0, 400) })
      out.ALL_PASS = false
      fs.writeFileSync(path.join(ROOT, 'e2e', '_r72Apply-result.json'), JSON.stringify(out, null, 2))
      console.log(JSON.stringify({ ALL_PASS: false, failed: V, detail: String(res).slice(0, 200) }))
      process.exit(1)
    }
    await q(`INSERT INTO supabase_migrations.schema_migrations (version, name, statements) VALUES ('${V}', '${FILE}', '{}'::text[]) ON CONFLICT (version) DO NOTHING`)
    out.steps.push({ v: V, action: 'applied+recorded', apply: String(res).slice(0, 160) })
  }
  out.reload = await q("NOTIFY pgrst, 'reload schema'")
  // DATA FIX: HALLOW10 หมดอายุ 2026-11-04 (Owner สั่ง "ทำให้ใช้ในหน้าเช็คเอาท์ด้วย") → ต่ออายุ
  out.hallow = await q("UPDATE public.promotions SET end_date = '2026-11-30', updated_at = NOW() WHERE upper(code) = 'HALLOW10' AND end_date < (now() AT TIME ZONE 'Asia/Bangkok')::date")
  out.verify = {
    fn188: await q("SELECT prosrc LIKE '%evt-ord-%' AS dedup_id, prosrc LIKE '%ON CONFLICT (id) DO NOTHING%' AS on_conflict, prosrc LIKE '%evt-pay-%' AS pay_ns FROM pg_proc WHERE proname = 'orders_notify_hook'"),
    fn189: await q("SELECT prosrc LIKE '%assigned_fallback%' AS fallback, prosrc LIKE '%ERR_OFFER_NOT_AVAILABLE%' AS guard_kept FROM pg_proc WHERE proname = 'claim_dispatch_offer'"),
    hallow: await q("SELECT code, is_active, start_date, end_date FROM public.promotions WHERE upper(code) = 'HALLOW10'"),
    ledger: await q('SELECT version, name FROM supabase_migrations.schema_migrations ORDER BY version DESC LIMIT 3'),
  }
  const vRaw = [out.verify.fn188, out.verify.fn189, out.verify.hallow, out.verify.ledger].map((x) => String(x)).join(' | ')
  out.checks = {
    hook_dedup_id: /"dedup_id":\s*true/.test(String(out.verify.fn188)),
    hook_on_conflict: /"on_conflict":\s*true/.test(String(out.verify.fn188)),
    claim_fallback: /"fallback":\s*true/.test(String(out.verify.fn189)),
    hallow_extended: /2026-11-30/.test(String(out.verify.hallow)),
    ledger_188_189: /"version":\s*"188"/.test(String(out.verify.ledger)) && /"version":\s*"189"/.test(String(out.verify.ledger)),
  }
  out.ALL_PASS = Object.values(out.checks).every(Boolean)
  fs.writeFileSync(path.join(ROOT, 'e2e', '_r72Apply-result.json'), JSON.stringify(out, null, 2))
  console.log(JSON.stringify({ ALL_PASS: out.ALL_PASS, checks: out.checks }))
  process.exit(out.ALL_PASS ? 0 : 1)
})().catch((e) => { console.error('APPLY_FAILED', String(e).slice(0, 300)); process.exit(1) })