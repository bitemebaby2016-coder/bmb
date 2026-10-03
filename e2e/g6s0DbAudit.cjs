// ============================================
// BMB G6-S0 — Production DB audit (READ-ONLY)
// No INSERT/UPDATE/DELETE anywhere. No secret printed.
// Reads SUPABASE_ACCESS_TOKEN from .env.local (session env only).
// ============================================
const fs = require('node:fs')
const envLocal = fs.readFileSync('.env.local', 'utf8')
const m = envLocal.match(/^SUPABASE_ACCESS_TOKEN=(.*)$/m)
const TOKEN = (m ? m[1] : '').trim()
if (!TOKEN) { console.log('NO TOKEN'); process.exit(1) }
const REF = 'ivkdfognyiwjcmrhcnwz'

async function q(sql) {
  const r = await fetch(`https://api.supabase.com/v1/projects/${REF}/database/query`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${TOKEN}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ query: sql }),
    signal: AbortSignal.timeout(30000),
  })
  const t = await r.text()
  if (!r.ok) return { error: `${r.status} ${t.slice(0, 160)}` }
  try { return JSON.parse(t) } catch { return t }
}

;(async () => {
  // 1) tables of interest + row counts
  const tables = await q(`select c.relname as table_name, c.reltuples::bigint as est_rows
    from pg_class c join pg_namespace n on n.oid=c.relnamespace
    where n.nspname='public' and c.relkind='r'
    and c.relname in ('social_events','channel_page_bindings','brands','tenants','content_approvals','ai_memory','notifications','social_event_actions','social_replies')
    order by c.relname`)
  console.log('TABLES ' + JSON.stringify(tables))

  // 2) social_events schema
  const seCols = await q(`select column_name, data_type, is_nullable, column_default from information_schema.columns
    where table_schema='public' and table_name='social_events' order by ordinal_position`)
  console.log('SOCIAL_EVENTS_COLS ' + JSON.stringify(seCols))

  // 3) channel_page_bindings schema
  const cpbCols = await q(`select column_name, data_type from information_schema.columns
    where table_schema='public' and table_name='channel_page_bindings' order by ordinal_position`)
  console.log('PAGE_BINDINGS_COLS ' + JSON.stringify(cpbCols))

  // 4) content_approvals schema + status values
  const caCols = await q(`select column_name, data_type, is_nullable from information_schema.columns
    where table_schema='public' and table_name='content_approvals' order by ordinal_position`)
  console.log('CONTENT_APPROVALS_COLS ' + JSON.stringify(caCols))
  const caStatus = await q(`select distinct status from content_approvals`)
  console.log('CONTENT_APPROVALS_STATUS_VALUES ' + JSON.stringify(caStatus))
  const caCount = await q(`select status, count(*) as n from content_approvals group by status`)
  console.log('CONTENT_APPROVALS_ROWS ' + JSON.stringify(caCount))

  // 5) social_events RLS
  const rls = await q(`select c.relname, c.relrowsecurity, c.relforcerowsecurity
    from pg_class c join pg_namespace n on n.oid=c.relnamespace
    where n.nspname='public' and c.relname in ('social_events','content_approvals','channel_page_bindings')`)
  console.log('RLS_FLAGS ' + JSON.stringify(rls))

  // 6) social_events policies
  const pol = await q(`select tablename, policyname, cmd, roles from pg_policies
    where schemaname='public' and tablename in ('social_events','content_approvals') order by tablename, policyname`)
  console.log('POLICIES ' + JSON.stringify(pol))

  // 7) social_events realtime-relevant counts (no PII content)
  const seCounts = await q(`select platform, count(*) as n from social_events group by platform`)
  console.log('SOCIAL_EVENTS_BY_PLATFORM ' + JSON.stringify(seCounts))
  const seDup = await q(`select count(*) as dup_groups from (select external_event_id from social_events group by external_event_id having count(*)>1) d`)
  console.log('SOCIAL_EVENTS_DUP_GROUPS ' + JSON.stringify(seDup))

  // 8) RPCs relevant to social/approval
  const rpcs = await q(`select proname, pg_get_function_identity_arguments(oid) as args
    from pg_proc p join pg_namespace n on n.oid=p.pronamespace
    where n.nspname='public' and (proname ilike '%content%' or proname ilike '%social%' or proname ilike '%approve%' or proname ilike '%reply%')
    order by proname`)
  console.log('RPCS ' + JSON.stringify(rpcs))

  // 9) grants on content_approvals / social_events
  const grants = await q(`select table_name, grantee, privilege_type from information_schema.role_table_grants
    where table_schema='public' and table_name in ('social_events','content_approvals') and grantee in ('anon','authenticated','service_role')
    order by table_name, grantee`)
  console.log('GRANTS ' + JSON.stringify(grants))

  // 10) edge functions deployed (management api list)
  const lf = await fetch(`https://api.supabase.com/v1/projects/${REF}/functions`, {
    headers: { Authorization: `Bearer ${TOKEN}` }, signal: AbortSignal.timeout(20000),
  })
  const fl = await lf.json().catch(() => [])
  console.log('EDGE_FUNCTIONS ' + JSON.stringify((Array.isArray(fl) ? fl : []).map((f) => ({ slug: f.slug, verify_jwt: f.verify_jwt }))))
})()