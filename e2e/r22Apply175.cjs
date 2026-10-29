// R22 apply 175 (Owner สั่ง `apply 175` 2026-10-30 — Multi-Tenant & White-Label):
//   (a) tenants.custom_domain + unique idx + seed biteme-baby.com
//   (b) brands.ai_prompt
//   (c) billing_subscriptions + RLS (billing_admin_manage + billing_tenant_scope)
// re-run ปลอดภัย (IF NOT EXISTS / ON CONFLICT / DROP POLICY IF EXISTS) · evidence → e2e/r22Apply175-result.json
// Run: node e2e/r22Apply175.cjs
const fs = require('fs')
const path = require('path')
const ROOT = path.resolve(__dirname, '..')
const AT = (/^SUPABASE_ACCESS_TOKEN=(.*)$/m.exec(fs.readFileSync(path.join(ROOT, '.env.local'), 'utf8')) || [])[1]
const q = async (query) => {
  const r = await fetch('https://api.supabase.com/v1/projects/ivkdfognyiwjcmrhcnwz/database/query', {
    method: 'POST',
    headers: { Authorization: 'Bearer ' + AT, 'Content-Type': 'application/json' },
    body: JSON.stringify({ query }),
  })
  return r.text()
}
const COL = (t, c) =>
  `SELECT column_name FROM information_schema.columns WHERE table_schema='public' AND table_name='${t}' AND column_name='${c}'`
;(async () => {
  const out = { at: new Date().toISOString() }
  out.precheck = {
    ledgerTop: await q('SELECT version, name FROM supabase_migrations.schema_migrations ORDER BY version DESC LIMIT 3'),
    domainBefore: await q(COL('tenants', 'custom_domain')),
    promptBefore: await q(COL('brands', 'ai_prompt')),
    billingBefore: await q("SELECT to_regclass('public.billing_subscriptions') AS t"),
  }
  const sql = fs.readFileSync(path.join(ROOT, 'supabase', 'migrations', '175_tenant_custom_domain_billing.sql'), 'utf8')
  out.apply = await q(sql)
  out.verify = {
    domainAfter: await q(COL('tenants', 'custom_domain')),
    promptAfter: await q(COL('brands', 'ai_prompt')),
    billingAfter: await q("SELECT to_regclass('public.billing_subscriptions') AS t"),
    rls: await q("SELECT relrowsecurity FROM pg_class WHERE oid = 'public.billing_subscriptions'::regclass"),
    policies: await q("SELECT policyname FROM pg_policies WHERE schemaname='public' AND tablename='billing_subscriptions' ORDER BY policyname"),
    bmbDomain: await q("SELECT id, custom_domain FROM public.tenants WHERE id='tenant-bmb-001'"),
    idx: await q("SELECT indexname FROM pg_indexes WHERE schemaname='public' AND indexname='idx_tenants_custom_domain'"),
  }
  out.record = {
    ins175: await q("INSERT INTO supabase_migrations.schema_migrations (version, name, statements) VALUES ('175','175_tenant_custom_domain_billing','{}'::text[]) ON CONFLICT (version) DO NOTHING"),
    ledgerTopAfter: await q('SELECT version, name FROM supabase_migrations.schema_migrations ORDER BY version DESC LIMIT 5'),
  }
  const parse = (t) => {
    try {
      return JSON.parse(t)
    } catch (e) {
      return null
    }
  }
  const g = (t) => (parse(t) || [])[0] || {}
  const led = parse(out.record.ledgerTopAfter) || []
  const pol = parse(out.verify.policies) || []
  const bmb = g(out.verify.bmbDomain)
  const rls = g(out.verify.rls)
  const pre = {
    ledgerTopWas174: ((parse(out.precheck.ledgerTop) || [])[0] || {}).version === '174',
    noDomainBefore: (parse(out.precheck.domainBefore) || []).length === 0,
    noBillingBefore: g(out.precheck.billingBefore).t === null,
  }
  out.precheckAssertions = pre
  out.assertions = {
    domainCol: !!g(out.verify.domainAfter).column_name,
    promptCol: !!g(out.verify.promptAfter).column_name,
    billingTable: g(out.verify.billingAfter).t === 'public.billing_subscriptions',
    rlsEnabled: rls.relrowsecurity === true,
    policies2:
      pol.some((p) => p.policyname === 'billing_admin_manage') &&
      pol.some((p) => p.policyname === 'billing_tenant_scope'),
    bmbDomainSeeded: bmb.custom_domain === 'biteme-baby.com',
    idxExists: (parse(out.verify.idx) || []).some((r) => r.indexname === 'idx_tenants_custom_domain'),
    ledgerTopIs175: led[0] && led[0].version === '175',
    has175: led.some((r) => r.version === '175'),
  }
  out.allPass =
    pre.ledgerTopWas174 &&
    pre.noDomainBefore &&
    pre.noBillingBefore &&
    Object.entries(out.assertions).every(([k, v]) => v === true)
  fs.writeFileSync(path.join(__dirname, 'r22Apply175-result.json'), JSON.stringify(out, null, 2))
  console.log('ALL_PASS=' + out.allPass)
  console.log(JSON.stringify({ pre, ...out.assertions }, null, 2))
  if (!out.allPass) {
    console.log('DETAIL=' + JSON.stringify({ pre, a: out.assertions, apply: String(out.apply).slice(0, 400), bmb }).slice(0, 900))
  }
})().catch((e) => console.log('FATAL ' + String(e).slice(0, 500)))