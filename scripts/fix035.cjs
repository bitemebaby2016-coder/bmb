// One-off repair for migration 035: restore $$ dollar-quoting that was
// corrupted (first by a bad find/replace of $$ -> path, then $$ -> "Length").
'use strict'
const fs = require('fs')
const p = 'supabase/migrations/035_m1_closure_p0_blockers.sql'
let s = fs.readFileSync(p, 'utf8')
const D = '$' + '$'
// restore any remaining "Length" placeholders introduced earlier
const n1 = s.split('Length').length - 1
s = s.split('Length').join(D)
fs.writeFileSync(p, s)
const r = fs.readFileSync(p, 'utf8')
console.log('lengthPlaceholdersRestored:', n1)
console.log('openers:', (r.match(/AS \$\$/g) || []).length)
console.log('closers:', (r.match(/^\$\$;/gm) || []).length)
console.log('badLeft_AS_Length:', r.includes('AS Length'))
console.log('badLeft_Path:', r.includes('A PROJECT'))
