// R22 verify 175 (post-apply · pattern = r19Verify169 — apply ผ่านแล้วแต่ assertion
// `billingTable` ของสคริปต์ apply อ่านค่า to_regclass() ที่คืน regclass/OID ไม่ใช่ string
// → เทสต์ผิดฝั่ง = measurement bug ไม่ใช่ DB bug (rls+policies ที่ผ่านพิสูจน์ว่าตารางมีจริง)
// verify รอบนี้ cast ::text + ตรวจครบ: คอลัมน์ · ตาราง · RLS · policies · grant · seed · index · ledger
// Run: node e2e/r22Verify175.cjs → e2e/r22Verify175-result.json
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
;(async () => {
  const out = { at: new Date().toISOString() }
  out.state = {
    ledgerTop: await q('SELECT version, name FROM supabase_migrations.schema_migrations ORDER BY version DESC LIMIT 3'),
    domain: await q("SELECT column_name, data_type FROM information_schema.columns WHERE table_schema='public' AND table_name='tenants' AND column_name='custom_domain'"),
    prompt: await q("SELECT column_name FROM information_schema.columns WHERE table_schema='public' AND table_name='brands' AND column_name='ai_prompt'"),
    billing: await q("SELECT to_regclass('public.billing_subscriptions')::text AS t"),
    billingCols: await q("SELECT count(*) AS n FROM information_schema.columns WHERE table_schema='public' AND table_name='billing_subscriptions'"),
    rls: await q("SELECT relrowsecurity FROM pg_class WHERE oid='public.billing_subscriptions'::regclass"),
    policies: await q("SELECT policyname FROM pg_policies WHERE schemaname='public' AND tablename='billing_subscriptions' ORDER BY policyname"),
    grants: await q("SELECT grantee, privilege_type FROM information_schema.table_privileges WHERE table_name='billing_subscriptions' AND privilege_type='SELECT' ORDER BY grantee"),
    bmb: await q("SELECT id, custom_domain FROM public.tenants WHERE id='tenant-bmb-001'"),
    idx: await q("SELECT indexname FROM pg_indexes WHERE schemaname='public' AND indexname='idx_tenants_custom_domain'"),
  }
  const parse = (t) => {
    try {
      return JSON.parse(t)
    } catch (e) {
      return null
    }
  }
  const g = (t) => (parse(t) || [])[0] || {}
  const led = parse(out.state.ledgerTop) || []
  const pol = parse(out.state.policies) || []
  const gr = parse(out.state.grants) || []
  out.assertions = {
    ledgerTopIs175: ((led[0] || {}).version) === '175',
    domainColText: g(out.state.domain).column_name === 'custom_domain' && g(out.state.domain).data_type === 'text',
    promptCol: g(out.state.prompt).column_name === 'ai_prompt',
    billingTable: g(out.state.billing).t === 'public.billing_subscriptions',
    billingCols12: Number(g(out.state.billingCols).n) >= 12,
    rlsEnabled: g(out.state.rls).relrowsecurity === true,
    policies2:
      pol.some((p) => p.policyname === 'billing_admin_manage') &&
      pol.some((p) => p.policyname === 'billing_tenant_scope'),
    grantSelectAuthenticated: gr.some((x) => x.grantee === 'authenticated' && x.privilege_type === 'SELECT'),
    bmbDomainSeeded: g(out.state.bmb).custom_domain === 'biteme-baby.com',
    idxExists: (parse(out.state.idx) || []).some((r) => r.indexname === 'idx_tenants_custom_domain'),
  }
  out.allPass = Object.entries(out.assertions).every(([k, v]) => v === true)
  fs.writeFileSync(path.join(__dirname, 'r22Verify175-result.json'), JSON.stringify(out, null, 2))
  console.log('ALL_PASS=' + out.allPass)
  console.log(JSON.stringify(out.assertions, null, 2))
  if (!out.allPass) console.log('DETAIL=' + JSON.stringify(out.state).slice(0, 700))
})().catch((e) => console.log('FATAL ' + String(e).slice(0, 500)))