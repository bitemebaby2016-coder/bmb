// R38 apply 176 (Owner สั่ง "apply 176" 2026-10-31):
// marketing_posts: GRANT SELECT anon + policy เฉพาะ status='published' (แทน deny_anon เดิม 137)
// re-run ปลอดภัย (DROP POLICY IF EXISTS + GRANT idempotent) · evidence → e2e/r38Apply176-result.json
// หมายเหตุ: strip BEGIN;/COMMIT; ก่อนยิง Management API (run ใน implicit tx ของ endpoint — ไฟล์ต้นฉบับคงไว้ให้ CI/psql)
// พร้อมกันนี้ precheck ความจริงของ m175 (แถว BLK-2 เดิมในเอกสาร = stale — แก้ตามหลักฐานรอบนี้)
const fs = require('fs')
const path = require('path')
const ROOT = path.resolve(__dirname, '..')
const AT = (/^SUPABASE_ACCESS_TOKEN=(.*)$/m.exec(fs.readFileSync(path.join(ROOT, '.env.local'), 'utf8')) || [])[1]
const q = async (query) => {
  const r = await fetch('https://api.supabase.com/v1/projects/ivkdfognyiwjcmrhcnwz/database/query', {
    method: 'POST', headers: { Authorization: 'Bearer ' + AT, 'Content-Type': 'application/json' },
    body: JSON.stringify({ query }),
  })
  return r.text()
}
const POL = "SELECT policyname, qual FROM pg_policies WHERE schemaname='public' AND tablename='marketing_posts' AND roles @> ARRAY['anon']::name[] ORDER BY policyname"
const GRANT = "SELECT has_table_privilege('anon', 'public.marketing_posts', 'SELECT') AS sel"
;(async () => {
  const out = { at: new Date().toISOString() }
  out.precheck = {
    ledgerTop: await q('SELECT version, name FROM supabase_migrations.schema_migrations ORDER BY version DESC LIMIT 3'),
    anonPoliciesBefore: await q(POL),
    anonGrantBefore: await q(GRANT),
    billing175: await q("SELECT to_regclass('public.billing_subscriptions') AS t"),
    domain175: await q("SELECT count(*) AS n FROM information_schema.columns WHERE table_schema='public' AND table_name='tenants' AND column_name='custom_domain'"),
  }
  const sql = fs.readFileSync(path.join(ROOT, 'supabase', 'migrations', '176_marketing_posts_anon_read.sql'), 'utf8')
    .split('\n').filter((l) => !/^BEGIN;\s*$/i.test(l.trim()) && !/^COMMIT;\s*$/i.test(l.trim())).join('\n')
  out.apply = await q(sql)
  out.verify = {
    anonPoliciesAfter: await q(POL),
    anonGrantAfter: await q(GRANT),
    denyAnonGone: await q("SELECT count(*) AS n FROM pg_policies WHERE schemaname='public' AND tablename='marketing_posts' AND policyname='marketing_posts_deny_anon'"),
    publishedRows: await q("SELECT count(*) AS n FROM public.marketing_posts WHERE status='published'"),
    otherRows: await q("SELECT count(*) AS n FROM public.marketing_posts WHERE status <> 'published'"),
  }
  out.record = {
    ins176: await q("INSERT INTO supabase_migrations.schema_migrations (version, name, statements) VALUES ('176','176_marketing_posts_anon_read','{}'::text[]) ON CONFLICT (version) DO NOTHING"),
    ledgerTopAfter: await q('SELECT version, name FROM supabase_migrations.schema_migrations ORDER BY version DESC LIMIT 5'),
  }
  const parse = (t) => { try { return JSON.parse(t) } catch (e) { return null } }
  const polBefore = parse(out.precheck.anonPoliciesBefore) || []
  const polAfter = parse(out.verify.anonPoliciesAfter) || []
  const grantBefore = (parse(out.precheck.anonGrantBefore) || [])[0] || {}
  const grantAfter = (parse(out.verify.anonGrantAfter) || [])[0] || {}
  const denyGone = (parse(out.verify.denyAnonGone) || [])[0] || {}
  const led = parse(out.record.ledgerTopAfter) || []
  const billing = (parse(out.precheck.billing175) || [])[0] || {}
  const domain = (parse(out.precheck.domain175) || [])[0] || {}
  out.assertions = {
    // 176: anon เดิมไม่มีสิทธิ์/policy ห้าม → หลัง apply = มีสิทธิ์ + เฉพาะ published
    anonHadNoGrantBefore: grantBefore.sel !== true,
    anonSelectGranted: grantAfter.sel === true,
    publishedPolicyExists: polAfter.some((p) => p.policyname === 'marketing_posts_anon_published' && String(p.qual).includes('published')),
    denyAnonRemoved: Number(denyGone.n) === 0,
    // ไม่แตะ policy ฝั่ง authenticated/role (137/147 ยังอยู่ — ตรวจ deny-anon ก่อน = มี/หลัง = ไม่มี)
    anonPoliciesWereOnlyDeny: polBefore.every((p) => p.policyname === 'marketing_posts_deny_anon'),
    ledgerTopIs176: led[0] && led[0].version === '176',
    has176: led.some((r) => r.version === '176'),
    // BLK-2 truth (เอกสารเก่าบอก 175 ยังไม่ apply = stale): m175 objects อยู่จริงไหม
    billing175Live: billing.t === 'billing_subscriptions' && Number(domain.n) === 1,
  }
  out.allPass = Object.entries(out.assertions).every(([k, v]) => v === true)
  fs.writeFileSync(path.join(__dirname, 'r38Apply176-result.json'), JSON.stringify(out, null, 2))
  console.log('ALL_PASS=' + out.allPass)
  console.log(JSON.stringify(out.assertions, null, 2))
  if (!out.allPass) console.log('DETAIL=' + JSON.stringify({ grantBefore, grantAfter, polAfter, denyGone, led: led[0], billing, domain }).slice(0, 900))
})().catch((e) => console.log('FATAL ' + String(e).slice(0, 500)))