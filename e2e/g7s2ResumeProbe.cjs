// G7-S2 resume — D-G7-A prerequisite check (READ-ONLY)
// 1) content_approvals.created_by IS NULLABLE  2) service_role has INSERT grant
const fs = require('node:fs')
const T = fs.readFileSync('.env.local', 'utf8').match(/^SUPABASE_ACCESS_TOKEN=(.*)$/m)[1].trim()
const q = async (sql) => {
  const r = await fetch('https://api.supabase.com/v1/projects/ivkdfognyiwjcmrhcnwz/database/query', {
    method: 'POST',
    headers: { Authorization: `Bearer ${T}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ query: sql }),
    signal: AbortSignal.timeout(30000),
  })
  const t = await r.text()
  return r.ok ? t.slice(0, 300) : 'ERR ' + r.status + ' ' + t.slice(0, 120)
}
;(async () => {
  console.log('CREATED_BY_NULLABLE ' + await q("select is_nullable from information_schema.columns where table_schema='public' and table_name='content_approvals' and column_name='created_by'"))
  console.log('SR_INSERT_GRANT ' + await q("select privilege_type from information_schema.role_table_grants where table_schema='public' and table_name='content_approvals' and grantee='service_role' and privilege_type='INSERT'"))
  console.log('AUDIT_LOGS_COLS ' + await q("select column_name,data_type from information_schema.columns where table_schema='public' and table_name='audit_logs' order by ordinal_position"))
})()