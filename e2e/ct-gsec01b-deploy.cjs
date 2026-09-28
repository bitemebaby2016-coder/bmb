'use strict'
// STEP 3A.1 / G-SEC-01b — apply migration 053 ONLY (Owner pre-authorized).
// Exact SQL from supabase/migrations/053_g_sec01b_inventory_requirements_guard.sql
const fs = require('fs')
const path = require('path')
const TOKEN = process.env.SUPABASE_ACCESS_TOKEN || ''
const REF = 'ivkdfognyiwjcmrhcnwz'
const sql = fs.readFileSync(path.join(__dirname, '..', 'supabase', 'migrations', '053_g_sec01b_inventory_requirements_guard.sql'), 'utf8')
;(async () => {
  const r = await fetch(`https://api.supabase.com/v1/projects/${REF}/database/query`, {
    method: 'POST',
    headers: { Authorization: 'Bearer ' + TOKEN, 'Content-Type': 'application/json' },
    body: JSON.stringify({ query: sql }),
  })
  const b = await r.text()
  console.log('HTTP', r.status)
  console.log('BODY', b.slice(0, 400))
  process.exit(r.ok ? 0 : 1)
})().catch((e) => { console.error('FATAL', String(e).slice(0, 300)); process.exit(2) })