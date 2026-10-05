// ============================================================
// M113 build — แก้บั๊ก ensure_rounds_for_date (Owner อนุมัติ 2026-10-05)
// ดึง def จาก PRODUCTION แล้ว patch แบบ anchor-guard (แนวทางเดียวกับ
// e2e/w14BuildMigration112.cjs) → supabase/migrations/113_fix_ensure_rounds_branch_id.sql
// บั๊ก: INSERT ไม่เขียน branch_id (NOT NULL, ไม่มี default) → 23502
// ============================================================
const fs = require('fs')
const path = require('path')

const ROOT = path.resolve(__dirname, '..')
const env = {}
for (const line of fs.readFileSync(path.join(ROOT, '.env.local'), 'utf8').split(/\r?\n/)) {
  const m = line.match(/^(\w+)=(.*)$/)
  if (m) env[m[1]] = m[2]
}
const API = 'https://api.supabase.com/v1/projects/ivkdfognyiwjcmrhcnwz/database/query'

async function q(sql) {
  const res = await fetch(API, {
    method: 'POST',
    headers: { Authorization: `Bearer ${env.SUPABASE_ACCESS_TOKEN}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ query: sql }),
  })
  const json = await res.json()
  if (!res.ok || json.message) throw new Error('SQL failed: ' + (json.message || res.statusText))
  return json
}

function mustContain(text, anchor, label) {
  if (!text.includes(anchor)) {
    console.error(`ANCHOR MISSING [${label}]: ${anchor.slice(0, 90)}`)
    process.exit(1)
  }
}

function patch(def) {
  const colsAnchor = `      id, round_key, name, display_name, cutoff_time, delivery_start, delivery_end,`
  const valsAnchor = `      v_id, v_key, v_key, v_tpl.display_name, v_tpl.cutoff_time, v_tpl.delivery_start,`
  mustContain(def, 'INSERT INTO public.delivery_rounds (', 'insert-head')
  mustContain(def, colsAnchor, 'insert-cols')
  mustContain(def, valsAnchor, 'insert-vals')

  let out = def.replace(
    colsAnchor,
    `      id, round_key, name, display_name, branch_id, cutoff_time, delivery_start, delivery_end,`
  )
  out = out.replace(
    valsAnchor,
    `      v_id, v_key, v_key, v_tpl.display_name, v_tpl.branch_id, v_tpl.cutoff_time, v_tpl.delivery_start,`
  )
  mustContain(out, 'v_tpl.branch_id, v_tpl.cutoff_time', 'branch-id-patched')
  if ((out.match(/branch_id/g) || []).length < 2) { console.error('branch_id patch incomplete'); process.exit(1) }
  return out
}

async function main() {
  const rows = await q("select pg_get_functiondef('public.ensure_rounds_for_date'::regproc) def")
  const fn = patch(rows[0].def).replace(/^\$function\$/m, '$function$;')

  const header = `-- ============================================
-- Migration 113 — fix ensure_rounds_for_date: write branch_id (NOT NULL)
--
-- BUG (found during W-1.4 probe 2026-10-05, Owner approved fix):
--   INSERT INTO delivery_rounds omitted branch_id (NOT NULL, no default)
--   → instantiating rounds for a new date fails with 23502 and rounds for
--     today/tomorrow cannot be created automatically (blocks W-2.2 live).
-- FIX (behavior-preserving):
--   clone branch_id from the template row (v_tpl) together with the other
--   template fields; tenant_id already defaults via default_tenant_id().
-- UNCHANGED: template selection, validations, id scheme, return shape,
--   error codes ERR_ROUND_TEMPLATE_MISSING / ERR_ROUND_TEMPLATE_INVALID.
-- VERIFY: node e2e/m113ApplyVerify.cjs (real call inside BEGIN...ROLLBACK
--   + idempotent second call) — production has NO rounds after rollback.
-- GENERATED: node e2e/m113BuildMigration113.cjs (reproducible; live def + anchors)
-- ============================================

BEGIN;

`

  const file = header + fn + '\nCOMMIT;\n'
  const outPath = path.join(ROOT, 'supabase', 'migrations', '113_fix_ensure_rounds_branch_id.sql')
  fs.writeFileSync(outPath, file, 'utf8')
  console.log('WROTE ' + outPath + ' (' + file.split('\n').length + ' lines)')
}

main().catch((e) => { console.error('ERROR ' + e.message); process.exit(1) })
