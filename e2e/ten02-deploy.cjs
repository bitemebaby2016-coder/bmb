'use strict'
// TEN-02 Deployment Script
// Deploys migrations 059→066 against production in correct order
// Order adjusted: 066 (profiles tenant_id/is_platform) must run BEFORE 065 (RLS references profiles columns)
const TOKEN = process.env.SUPABASE_ACCESS_TOKEN || ''
const REF = 'ivkdfognyiwjcmrhcnwz'
const fs = require('fs')
const path = require('path')

const MIGRATION_DIR = path.join(__dirname, '..', 'supabase', 'migrations')
const SQL_FILES = [
  '059_tenant_foundation.sql',
  '060_ops_tenant_nullable.sql',
  '061_assignments_tenant_nullable.sql',
  '062_backfill_tenants.sql',
  '063_verify_backfill.sql',
  '064_enforce_not_null.sql',
  '066_profiles_tenant_authority.sql',  // Moved before 065 (RLS depends on profiles columns)
  '065_rls_isolation.sql'               // Last: RLS rewrite (needs profiles.tenant_id + is_platform)
]

async function executeMigration(filename) {
  const sql = fs.readFileSync(path.join(MIGRATION_DIR, filename), 'utf-8')
  console.log(`\n[DEPLOY] ${filename} ...`)
  
  // Use the management API's query endpoint
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
    // Handle NOTICE messages for verification migrations
    if (data.notice) {
      console.log(`[NOTICE] ${data.notice.slice(0, 200)}`)
    }
    console.log(`[OK] ${filename} — success`)
  } catch (e) {
    // Some responses might not be valid JSON (NOTICE-only responses)
    console.log(`[OK] ${filename} — executed (non-JSON response, likely NOTICE only)`)
  }
}

;(async () => {
  console.log('TEN-02 DEPLOYMENT START')
  console.log(`Target: ${REF}`)
  console.log(`Migrations: ${SQL_FILES.length}`)
  console.log('Order:', SQL_FILES.join(' → '))
  console.log('---')
  
  let successCount = 0
  for (const file of SQL_FILES) {
    try {
      await executeMigration(file)
      successCount++
    } catch (e) {
      console.error(`\n[HALTED] Migration ${file} failed. Remaining skipped.`)
      console.error(e.message)
      process.exit(1)
    }
  }
  
  console.log(`\n=== DEPLOYMENT COMPLETE ===`)
  console.log(`Success: ${successCount}/${SQL_FILES.length}`)
  console.log('Proceed to verification.')
})().catch(e => { console.error('FATAL:', e.message); process.exit(1) })
