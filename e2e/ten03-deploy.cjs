'use strict'
// TEN-03 Deployment Script
// Deploys migrations 067→071 against production in correct order
const TOKEN = process.env.SUPABASE_ACCESS_TOKEN || ''
const REF = 'ivkdfognyiwjcmrhcnwz'
const fs = require('fs')
const path = require('path')

const MIGRATION_DIR = path.join(__dirname, '..', 'supabase', 'migrations')
const SQL_FILES = [
  '067_catalog_tenant_nullable.sql',       // Phase A: ADD tenant_id NULL + indexes
  '068_verify_catalog_pre_backfill.sql',   // Phase B: Read-only pre-backfill verification
  '069_backfill_catalog_tenants.sql',      // Phase C: Backfill to tenant-bmb-001
  '070_enforce_catalog_not_null.sql',      // Phase D: SET NOT NULL
  '071_catalog_rls_rewrite.sql'            // Phase E: Rewrite RLS policies
]

async function executeMigration(filename) {
  const sql = fs.readFileSync(path.join(MIGRATION_DIR, filename), 'utf-8')
  console.log(`\n[DEPLOY] ${filename} ...`)
  
  const r = await fetch(`https://api.supabase.com/v1/projects/${REF}/database/query`, {
    method: 'POST',
    headers: { Authorization: 'Bearer ' + TOKEN, 'Content-Type': 'application/json' },
    body: JSON.stringify({ query: sql })
  })
  
  const text = await r.text()
  if (!r.ok) {
    console.error(`[FAIL] ${filename}: HTTP ${r.status} - ${text.slice(0, 500)}`)
    throw new Error(`Migration ${filename} failed: HTTP ${r.status} - ${text.slice(0, 200)}`)
  }
  
  try {
    const data = JSON.parse(text)
    if (data.notice) {
      console.log(`[NOTICE] ${data.notice.slice(0, 200)}`)
    }
    console.log(`[OK] ${filename} — success`)
  } catch (e) {
    console.log(`[OK] ${filename} — executed (non-JSON response likely NOTICE only)`)
  }
}

;(async () => {
  console.log('TEN-03 DEPLOYMENT START')
  console.log(`Target: ${REF}`)
  console.log(`Migrations: ${SQL_FILES.length}`)
  console.log('Order:', SQL_FILES.join(' → '))
  console.log('---')
  
  for (const file of SQL_FILES) {
    try {
      await executeMigration(file)
    } catch (e) {
      console.error(`\n[HALTED] Migration ${file} failed. Remaining skipped.`)
      console.error(e.message)
      process.exit(1)
    }
  }
  
  console.log(`\n=== DEPLOYMENT COMPLETE ===`)
  console.log(`Success: ${SQL_FILES.length}/${SQL_FILES.length}`)
  console.log('Proceed to post-deploy verification.')
})().catch(e => { console.error('FATAL:', e.message); process.exit(1) })
