'use strict'
// STEP 3A.1 / G-SEC-01b — LOCAL migration-contract check (node, pre-deploy).
// Locks the get_inventory_requirements admin boundary in migration 053 so it
// cannot be silently removed/weakened. (Live RLS/RPC enforcement is verified
// post-deploy by e2e/ct-gsec01b-probe.cjs.)
const fs = require('fs')
const path = require('path')
const sql = fs.readFileSync(path.join(__dirname, '..', 'supabase', 'migrations', '053_g_sec01b_inventory_requirements_guard.sql'), 'utf8')
const has = (re) => re.test(sql)
let fail = 0
const check = (name, ok, detail) => { console.log((ok ? 'PASS' : 'FAIL') + ' :: ' + name + (detail ? ' :: ' + detail : '')); if (!ok) fail++ }

check('defines get_inventory_requirements', has(/create\s+or\s+replace\s+function\s+public\.get_inventory_requirements/i), '')
check('SECURITY DEFINER', has(/security\s+definer/i), '')
check('SET search_path = public', has(/set\s+search_path\s*=\s*public/i), '')
check('anon denied (ERR_NOT_AUTHENTICATED)', has(/ERR_NOT_AUTHENTICATED/), '')
check('admin boundary (is_admin -> ERR_FORBIDDEN)', has(/IF\s+NOT\s+public\.is_admin\(\)\s+THEN\s+RAISE\s+EXCEPTION\s+'ERR_FORBIDDEN'/i), '')
check('grant kept TO authenticated', has(/grant\s+execute\s+on\s+function\s+public\.get_inventory_requirements\s+to\s+authenticated/i), '')
check('no anon/public grant', !has(/grant\s+execute\s+on\s+function\s+public\.get_inventory_requirements\s+to\s+(anon|public)/i), '')
check('return payload unchanged (requirements/feasible/current_stock)', has(/'requirements'/) && has(/'feasible'/) && has(/current_stock/) && has(/min_stock/), '')

console.log(fail === 0 ? 'CONTRACT = PASS' : ('FAILURES=' + fail))
process.exit(fail === 0 ? 0 : 1)