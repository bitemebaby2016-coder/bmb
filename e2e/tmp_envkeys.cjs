'use strict'
// tmp_envkeys: print KEY NAMES only (never values) from env-like files
const fs = require('fs')
const files = ['supabase/secrets.local.env', '.env', 'e2e/.env']
for (const f of files) {
  if (!fs.existsSync(f)) { console.log(f + ' = MISSING'); continue }
  const lines = fs.readFileSync(f, 'utf8').split(/\r?\n/).filter((l) => l.trim() && !l.trim().startsWith('#'))
  const names = lines.map((l) => l.split('=')[0].trim()).filter(Boolean)
  console.log(f + ' = ' + names.join(', '))
}
console.log('ENV BMB_E2E_SVC_KEY present =', !!process.env.BMB_E2E_SVC_KEY)
console.log('DONE')
