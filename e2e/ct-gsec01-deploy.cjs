'use strict'
// ============================================
// STEP 3A / G-SEC-01 — apply migration 052 ONLY (Owner-approved deploy gate).
// Executes EXACTLY the SQL in supabase/migrations/052_g_sec01_inventory_public_read.sql
// via the management query endpoint. No other schema/RPC/EF changes.
// ============================================
const fs = require('fs')
const path = require('path')
const TOKEN = process.env.SUPABASE_ACCESS_TOKEN || ''
const REF = 'ivkdfognyiwjcmrhcnwz'
const sql = fs.readFileSync(path.join(__dirname, '..', 'supabase', 'migrations', '052_g_sec01_inventory_public_read.sql'), 'utf8')
;(async () => {
  const r = await fetch(`https://api.supabase.com/v1/projects/${REF}/database/query`, {
    method: 'POST',
    headers: { Authorization: 'Bearer ' + TOKEN, 'Content-Type': 'application/json' },
    body: JSON.stringify({ query: sql }),
  })
  const b = await r.text()
  console.log('HTTP', r.status)
  console.log('BODY', b.slice(0, 600))
  process.exit(r.ok ? 0 : 1)
})().catch((e) => { console.error('FATAL', String(e).slice(0, 300)); process.exit(2) })