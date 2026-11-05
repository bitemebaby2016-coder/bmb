// one-shot diag: PK/unique constraints of notifications + drivers.user_id type
'use strict'
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
  return await r.text()
}
;(async () => {
  console.log('NOTIF_CONSTRAINTS:', await q("SELECT tc.constraint_type, kcu.column_name FROM information_schema.table_constraints tc JOIN information_schema.key_column_usage kcu ON tc.constraint_name = kcu.constraint_name WHERE tc.table_schema='public' AND tc.table_name='notifications'"))
  console.log('DRIVERS_COLS:', await q("SELECT column_name, data_type FROM information_schema.columns WHERE table_schema='public' AND table_name='drivers' AND column_name IN ('id','user_id')"))
  console.log('ASSIGN_COLS:', await q("SELECT column_name, data_type FROM information_schema.columns WHERE table_schema='public' AND table_name='delivery_assignments' ORDER BY ordinal_position"))
  console.log('ASSIGN_SAMPLE:', await q("SELECT da.*, d.user_id AS driver_uid FROM public.delivery_assignments da JOIN public.drivers d ON d.id = da.driver_id ORDER BY da.assigned_at DESC LIMIT 3"))
})().catch((e) => { console.error('DIAG_FAIL', String(e).slice(0, 200)); process.exit(1) })
