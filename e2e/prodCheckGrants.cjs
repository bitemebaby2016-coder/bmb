// ============================================
// Bite Me Baby — TABLE-ACL grant state checker (033 / F-3) — READ-ONLY
// ============================================
// One probe query, run identically on local (docker psql) and remote
// (Management API). Verifies migration 033 outcome:
//   anon_write_residue = 0        (anon holds no INSERT/UPDATE/DELETE/TRUNCATE/REFERENCES/TRIGGER)
//   anon_extra_select = 0         (anon SELECT exactly the canonical 8)
//   anon_mascot_read = granted    (storefront mascot read)
//   auth_public_profiles_write = 0 (VIEW write path closed — RLS bypass fix)
//   auth_preorders_write = 0      (024 read-only archive)
//   auth_new_grants = 10          (business_settings+content_approvals SELECT, media_assets+mascot_overrides CRUD)
//   service_role_missing = 0      (full CRUD restored platform-wide)
//
// Usage:
//   node e2e/prodCheckGrants.cjs           → local stack truth
//   set SUPABASE_ACCESS_TOKEN + --remote   → also probes production
// Evidence: e2e/prod-check-grants-result.json
// ============================================
'use strict'
const fs = require('fs')
const path = require('path')
const { spawnSync } = require('node:child_process')

const PROJ = 'D:/A PROJECT/Bite Me Baby'
const LOCAL_CTR = 'supabase_db_ivkdfognyiwjcmrhcnwz'
const REF = process.env.SUPABASE_PROJECT_REF || 'ivkdfognyiwjcmrhcnwz'
const OUT = path.join(PROJ, 'e2e', 'prod-check-grants-result.json')
const DO_REMOTE = process.argv.includes('--remote')
let TOKEN = process.env.SUPABASE_ACCESS_TOKEN || ''
if (!TOKEN) {
  const p = path.join(PROJ, 'supabase.temp', 'at.local')
  if (fs.existsSync(p)) TOKEN = fs.readFileSync(p, 'utf8').trim()
}

const PROBE_SQL = `select coalesce(json_agg(t), '[]'::json) as probe from (
  select 'anon_write_residue' as kind,
    (select count(*) from pg_class c join pg_namespace n on n.oid=c.relnamespace
      where n.nspname='public' and c.relkind in ('r','p','v')
        and (has_table_privilege('anon',c.oid,'INSERT')
          or has_table_privilege('anon',c.oid,'UPDATE')
          or has_table_privilege('anon',c.oid,'DELETE')
          or has_table_privilege('anon',c.oid,'TRUNCATE')
          or has_table_privilege('anon',c.oid,'REFERENCES')
          or has_table_privilege('anon',c.oid,'TRIGGER')))::text as items
  union all
  select 'anon_extra_select' as kind,
    (select count(*) from pg_class c join pg_namespace n on n.oid=c.relnamespace
      where n.nspname='public' and c.relkind in ('r','p','v')
        and has_table_privilege('anon',c.oid,'SELECT')
        and c.relname not in ('products','product_categories','delivery_rounds',
                              'reviews','promotions','preorder_votes','orders','mascot_overrides'))::text as items
  union all
  select 'anon_mascot_read' as kind,
    case when has_table_privilege('anon','public.mascot_overrides','SELECT')
         then 'granted' else 'missing' end as items
  union all
  select 'auth_public_profiles_write' as kind,
    (has_table_privilege('authenticated','public.public_profiles','INSERT')::int
     +has_table_privilege('authenticated','public.public_profiles','UPDATE')::int
     +has_table_privilege('authenticated','public.public_profiles','DELETE')::int)::text as items
  union all
  select 'auth_preorders_write' as kind,
    (has_table_privilege('authenticated','public.pre_orders','INSERT')::int
     +has_table_privilege('authenticated','public.pre_orders','UPDATE')::int
     +has_table_privilege('authenticated','public.pre_orders','DELETE')::int)::text as items
  union all
  select 'auth_new_grants' as kind,
    (has_table_privilege('authenticated','public.business_settings','SELECT')::int
     +has_table_privilege('authenticated','public.content_approvals','SELECT')::int
     +has_table_privilege('authenticated','public.media_assets','SELECT')::int
     +has_table_privilege('authenticated','public.media_assets','INSERT')::int
     +has_table_privilege('authenticated','public.media_assets','UPDATE')::int
     +has_table_privilege('authenticated','public.media_assets','DELETE')::int
     +has_table_privilege('authenticated','public.mascot_overrides','SELECT')::int
     +has_table_privilege('authenticated','public.mascot_overrides','INSERT')::int
     +has_table_privilege('authenticated','public.mascot_overrides','UPDATE')::int
     +has_table_privilege('authenticated','public.mascot_overrides','DELETE')::int)::text as items
  union all
  select 'service_role_missing' as kind,
    (select count(*) from pg_class c join pg_namespace n on n.oid=c.relnamespace
      where n.nspname='public' and c.relkind in ('r','p','v')
        and (not has_table_privilege('service_role',c.oid,'SELECT')
          or not has_table_privilege('service_role',c.oid,'INSERT')
          or not has_table_privilege('service_role',c.oid,'UPDATE')
          or not has_table_privilege('service_role',c.oid,'DELETE')))::text as items
) t;`

const EXPECT = {
  anon_write_residue: '0',
  anon_extra_select: '0',
  anon_mascot_read: 'granted',
  auth_public_profiles_write: '0',
  auth_preorders_write: '0',
  auth_new_grants: '10',
  service_role_missing: '0',
}

function judge(rows) {
  const byKey = Object.fromEntries(rows.map((r) => [r.kind, r.items]))
  let pass = true
  for (const [k, want] of Object.entries(EXPECT)) {
    const got = byKey[k] === undefined ? '(absent)' : byKey[k]
    const ok = got === want
    if (!ok) pass = false
    console.log((ok ? 'check PASS ' : 'XMARK FAIL ') + k + '=' + got + ' (want ' + want + ')')
  }
  return { byKey, pass }
}

async function run() {
  const evidence = { timestamp: new Date().toISOString(), ref: REF, local: null, remote: null }

  const psql = spawnSync('docker', ['exec', '-i', LOCAL_CTR, 'psql', '-U', 'postgres', '-d', 'postgres', '-At', '-v', 'ON_ERROR_STOP=1'],
    { input: PROBE_SQL, encoding: 'utf8', timeout: 30000 })
  if (psql.status !== 0) {
    console.log('XMARK local probe failed — is the local stack up? (docker ps)')
    console.log(String(psql.stderr || psql.stdout).slice(0, 400))
  } else {
    const rows = JSON.parse(String(psql.stdout).trim())
    console.log('check local grant probe ok')
    const j = judge(rows)
    evidence.local = j.byKey
    evidence.local_pass = j.pass
  }

  if (DO_REMOTE) {
    if (!TOKEN) {
      console.log('XMARK --remote requested but SUPABASE_ACCESS_TOKEN is not set (env or supabase.temp/at.local)')
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
        const first = Array.isArray(body) ? body[0] : null
        const raw = first && (first.probe ?? first.coalesce)
        const rows = typeof raw === 'string' ? JSON.parse(raw) : (Array.isArray(raw) ? raw : [])
        console.log('check remote grant probe ok')
        const j = judge(rows)
        evidence.remote = j.byKey
        evidence.remote_pass = j.pass
      }
    }
  } else {
    console.log('INFO remote probe skipped (no --remote). Local truth is above.')
  }

  fs.writeFileSync(OUT, JSON.stringify(evidence, null, 2), 'utf8')
  console.log('\nPROD-CHECK-GRANTS done → ' + OUT)
}

run().catch((e) => { console.log('FATAL ' + String(e).slice(0, 300)); process.exit(1) })