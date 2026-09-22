// ============================================
// Bite Me Baby — Production migration state checker (READ-ONLY)
// ============================================
// Answers item "มิเกรชั่นวันนี้รันแล้วหรือยัง" definitively:
//   • which repo migrations are applied+RECORDED on the linked production project
//   • which objects (functions/tables) exist local-vs-remote (drift)
//   • whether the F-1 fix (migration 030 ELSE) and the 029 GRANT are live
//
// Usage:
//   node e2e/prodCheckMigrations.cjs              → local stack truth + guidance
//   set SUPABASE_ACCESS_TOKEN then add --remote   → also probes production
//
// Read-only: SELECT probes only. Evidence: e2e/prod-check-result.json
// ============================================
'use strict'
const fs = require('fs')
const path = require('path')
const { spawnSync } = require('node:child_process')

const PROJ = 'D:/A PROJECT/Bite Me Baby'
const LOCAL_CTR = 'supabase_db_ivkdfognyiwjcmrhcnwz'
const REF = process.env.SUPABASE_PROJECT_REF || 'ivkdfognyiwjcmrhcnwz'
const OUT = path.join(PROJ, 'e2e', 'prod-check-result.json')
const DO_REMOTE = process.argv.includes('--remote')
const TOKEN = process.env.SUPABASE_ACCESS_TOKEN || ''

// ONE probe query, run identically on local (docker psql) and remote (Management API)
const PROBE_SQL = `
select coalesce(json_agg(t), '[]'::json) from (
  select 'migration_history' as kind,
         coalesce((select string_agg(version || '|' || coalesce(name,''), E'\\n' order by version)
                   from supabase_migrations.schema_migrations), '') as items
  union all
  select 'functions' as kind,
         (select string_agg(p.proname || '(' || pg_get_function_identity_arguments(p.oid) || ')', E'\\n' order by 1)
            from pg_proc p join pg_namespace n on n.oid = p.pronamespace
           where n.nspname = 'public') as items
  union all
  select 'tables' as kind,
         (select string_agg(c.relname, E'\\n' order by c.relname)
            from pg_class c join pg_namespace n on n.oid = c.relnamespace
           where n.nspname = 'public' and c.relkind in ('r','p')) as items
  union all
  select 'f1_else' as kind,
         coalesce((select case when position('ELSE RETURN false' in pg_get_functiondef(oid)) > 0
                               then 'present' else 'absent' end
                     from pg_proc p join pg_namespace n on n.oid = p.pronamespace
                    where n.nspname = 'public' and p.proname = 'order_transition_allowed'),
                  'missing') as items
  union all
  select 'grant_029' as kind,
         coalesce((select 'granted' from information_schema.role_function_grants
                    where grantee = 'authenticated' and routine_name = 'ensure_rounds_for_date'
                    limit 1), 'not-granted') as items
) t;
`

function splitItems(s) {
  return String(s || '').split('\n').map((x) => x.trim()).filter(Boolean)
}

async function run() {
  const evidence = { timestamp: new Date().toISOString(), ref: REF, local: null, remote: null }

  // ---------- LOCAL ----------
  const psql = spawnSync('docker', ['exec', '-i', LOCAL_CTR, 'psql', '-U', 'postgres', '-d', 'postgres', '-At', '-v', 'ON_ERROR_STOP=1'],
    { input: PROBE_SQL, encoding: 'utf8', timeout: 30000 })
  if (psql.status !== 0) {
    console.log('XMARK local probe failed — is the local stack up? (docker ps)')
    console.log(String(psql.stderr || psql.stdout).slice(0, 400))
  } else {
    const rows = JSON.parse(String(psql.stdout).trim())
    evidence.local = Object.fromEntries(rows.map((r) => [r.kind, r.items]))
    console.log('check local probe ok: history=' + splitItems(evidence.local.migration_history).length +
      ' migrations, functions=' + splitItems(evidence.local.functions).length +
      ', tables=' + splitItems(evidence.local.tables).length +
      ', F1_else=' + evidence.local.f1_else + ', grant_029=' + evidence.local.grant_029)
  }

  // ---------- REMOTE (optional, needs SUPABASE_ACCESS_TOKEN) ----------
  if (DO_REMOTE) {
    if (!TOKEN) {
      console.log('XMARK --remote requested but SUPABASE_ACCESS_TOKEN is not set (read-only probe aborted)')
    } else {
      const r = await fetch('https://api.supabase.com/v1/projects/' + REF + '/database/query', {
        method: 'POST',
        headers: { Authorization: 'Bearer ' + TOKEN, 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: PROBE_SQL }),
      })
      const body = await r.json()
      if (!r.ok) {
        console.log('XMARK remote probe failed: ' + JSON.stringify(body).slice(0, 300))
      } else {
        const rows = Array.isArray(body) ? body : []
        evidence.remote = Object.fromEntries(rows.map((r2) => [r2.kind, r2.items]))
        console.log('check remote probe ok: history=' + splitItems(evidence.remote.migration_history).length +
          ' migrations, functions=' + splitItems(evidence.remote.functions).length +
          ', tables=' + splitItems(evidence.remote.tables).length +
          ', F1_else=' + evidence.remote.f1_else + ', grant_029=' + evidence.remote.grant_029)
      }
    }
  } else {
    console.log('INFO remote probe skipped (no --remote). Local truth is above.')
  }

  // ---------- VERDICT ----------
  if (evidence.local && evidence.remote) {
    const lh = splitItems(evidence.local.migration_history).map((x) => x.split('|')[0])
    const rh = splitItems(evidence.remote.migration_history).map((x) => x.split('|')[0])
    const files = fs.readdirSync(path.join(PROJ, 'supabase', 'migrations'))
      .filter((f) => /^\d{3}_.*\.sql$/.test(f))
      .map((f) => f.slice(0, 3))
    const missingOnRemote = files.filter((v) => !rh.includes(v))
    const extraOnRemote = rh.filter((v) => !lh.includes(v))
    evidence.missingOnRemote = missingOnRemote
    evidence.extraOnRemote = extraOnRemote
    if (missingOnRemote.length) {
      console.log('XMARK migrations NOT on production: ' + missingOnRemote.join(', ') +
        '  → apply with: supabase db push   (or node e2e/prodApplyMigrations.cjs --files ' + missingOnRemote.join(',') + ')')
    } else {
      console.log('check every repo migration is recorded on production')
    }
    if (extraOnRemote.length) {
      console.log('WARN stale remote history rows (files no longer in repo): ' + extraOnRemote.join(', ') +
        ' — harmless for db push; clean later with: supabase migration repair --status reverted ' + extraOnRemote.join(' '))
    }
    const lf = new Set(splitItems(evidence.local.functions))
    const rf = new Set(splitItems(evidence.remote.functions))
    const missingFns = [...lf].filter((f) => !rf.has(f))
    if (missingFns.length) console.log('WARN functions missing on production: ' + missingFns.slice(0, 12).join(' | '))
    if (evidence.remote.f1_else !== 'present') console.log('XMARK F-1 fix (030 ELSE) is NOT live on production yet')
    if (evidence.remote.grant_029 !== 'granted') console.log('XMARK 029 ensure_rounds_for_date GRANT is NOT live on production yet')
  }

  fs.writeFileSync(OUT, JSON.stringify(evidence, null, 2), 'utf8')
  console.log('\nPROD-CHECK done → ' + OUT)
}

run().catch((e) => { console.log('FATAL ' + String(e).slice(0, 300)); process.exit(1) })