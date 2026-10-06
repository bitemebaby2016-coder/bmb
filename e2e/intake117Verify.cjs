// Verify migration 117 body vs 089 body (line-level containment, ignoring blank diffs)
'use strict'
const fs = require('fs')
const a = fs.readFileSync('supabase/migrations/089_create_order_branch_id.sql', 'utf8').split(/\r?\n/)
const b = fs.readFileSync('supabase/migrations/117_channel_intake_repair.sql', 'utf8').split(/\r?\n/)
const bset = new Set(b.map((l) => l.trim()))
let missing = []
for (let i = 55; i < a.length; i++) {
  const t = a[i].trim()
  if (!t || t.startsWith('--')) continue
  if (t.includes('v_uid := auth.uid()')) continue // intentionally replaced (048 semantics)
  if (t.startsWith('GRANT') || t.startsWith('REVOKE')) continue // reissued in 117
  if (!bset.has(t)) missing.push('089:L' + (i + 1) + ' | ' + t)
}
console.log('089 body lines missing in 117 (expect ONLY the replaced auth line):')
console.log(missing.length ? missing.join('\n') : '(none)')
// sanity: BEGIN/END balance in 117
const text = b.join('\n')
console.log('117: has CREATE FUNCTION:', text.includes('CREATE OR REPLACE FUNCTION public.create_order_with_items'), '| COMMIT count:', (text.match(/^COMMIT;$/gm) || []).length, '| $$; count:', (text.match(/\$\$;/g) || []).length)