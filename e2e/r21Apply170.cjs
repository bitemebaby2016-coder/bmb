// R21 apply 170 (Owner 2026-10-29: "อัปเดตตาราง products ให้มีฟิลด์ cogs / packaging_cost / อื่นๆ"):
// = ฟิลด์ต้นทุนต่อหน่วยสำหรับ Gross Margin / Net Profit + unit_cost GENERATED · re-run ปลอดภัย
// (ADD COLUMN IF NOT EXISTS · DROP CONSTRAINT IF EXISTS · CHECK ไม่ fix ข้อมูลเดิมเพราะค่าเริ่มต้น 0)
// Evidence → e2e/r21Apply170-result.json. Run: node e2e/r21Apply170.cjs
const fs = require('fs')
const path = require('path')
const ROOT = path.resolve(__dirname, '..')
const AT = (/^SUPABASE_ACCESS_TOKEN=(.*)$/m.exec(fs.readFileSync(path.join(ROOT, '.env.local'), 'utf8')) || [])[1]
const q = async (query) => {
  const r = await fetch('https://api.supabase.com/v1/projects/ivkdfognyiwjcmrhcnwz/database/query', {
    method: 'POST', headers: { Authorization: 'Bearer ' + AT, 'Content-Type': 'application/json' },
    body: JSON.stringify({ query }) })
  return r.text()
}

const COLS =
  "SELECT column_name, data_type, is_nullable, column_default, is_generated, generation_expression " +
  "FROM information_schema.columns WHERE table_schema='public' AND table_name='products' " +
  "AND column_name IN ('cogs','packaging_cost','other_unit_cost','unit_cost') ORDER BY column_name"
const CONSTRAINT =
  "SELECT conname, pg_get_constraintdef(oid) AS def FROM pg_constraint " +
  "WHERE conrelid='public.products'::regclass AND conname='products_cost_fields_nonneg'"
const UPDATE_GRANTS =
  "SELECT grantee, privilege_type FROM information_schema.role_table_grants " +
  "WHERE table_schema='public' AND table_name='products' AND privilege_type='UPDATE' ORDER BY grantee"

;(async () => {
  const out = { at: new Date().toISOString() }

  // stage 1: precheck — ยังไม่มีคอลัมน์ต้นทุน + ledger top (ต้องไม่ใช่ 170 ซ้ำ)
  out.precheck = {
    ledgerTop: await q('SELECT version, name FROM supabase_migrations.schema_migrations ORDER BY version DESC LIMIT 3'),
    colsBefore: await q(COLS),
    constraintBefore: await q(CONSTRAINT),
    updateGrantsBefore: await q(UPDATE_GRANTS),
  }

  // stage 2: apply
  const sql = fs.readFileSync(path.join(ROOT, 'supabase', 'migrations', '170_product_cost_margin_fields.sql'), 'utf8')
  out.apply = await q(sql)

  // stage 3: verify — คอลัมน์ครบ + unit_cost เป็น GENERATED + CHECK อยู่ + ข้อมูลเดิม self-consistent + grant ไม่เปลี่ยน
  out.verify = {
    colsAfter: await q(COLS),
    constraintAfter: await q(CONSTRAINT),
    updateGrantsAfter: await q(UPDATE_GRANTS),
    negativeRows: await q(
      'SELECT count(*) AS n FROM public.products WHERE cogs < 0 OR packaging_cost < 0 OR other_unit_cost < 0'),
    unitCostMismatch: await q(
      'SELECT count(*) AS n FROM public.products WHERE unit_cost IS DISTINCT FROM (cogs + packaging_cost + other_unit_cost)'),
    sampleRead: await q('SELECT id, name, price, cogs, packaging_cost, other_unit_cost, unit_cost FROM public.products ORDER BY updated_at DESC LIMIT 3'),
  }

  // stage 4: ledger
  out.record = {
    ins170: await q("INSERT INTO supabase_migrations.schema_migrations (version, name, statements) VALUES ('170','170_product_cost_margin_fields','{}'::text[]) ON CONFLICT (version) DO NOTHING"),
    ledgerTopAfter: await q('SELECT version, name FROM supabase_migrations.schema_migrations ORDER BY version DESC LIMIT 5'),
  }

  const parse = (t) => { try { return JSON.parse(t) } catch (e) { return null } }
  const cols = parse(out.verify.colsAfter) || []
  const before = parse(out.precheck.colsBefore) || []
  const cons = parse(out.verify.constraintAfter) || []
  const grantsBefore = parse(out.precheck.updateGrantsBefore) || []
  const grantsAfter = parse(out.verify.updateGrantsAfter) || []
  const unit = cols.find((c) => c.column_name === 'unit_cost') || {}
  const neg = parse(out.verify.negativeRows)?.[0]?.n
  const mismatch = parse(out.verify.unitCostMismatch)?.[0]?.n
  const led = parse(out.record.ledgerTopAfter) || []

  out.assertions = {
    allFourColumns: cols.length === 4,
    unitCostGenerated: unit.is_generated === 'ALWAYS',
    nonnegConstraintPresent: cons.length === 1 && cons[0].def.startsWith('CHECK') && cons[0].def.includes('>= (0)'),
    updateGrantsUnchanged: JSON.stringify(grantsBefore) === JSON.stringify(grantsAfter),
    noNegativeRows: neg === 0,
    unitCostMatchesSum: mismatch === 0,
    ledgerTopIs170: led[0] && led[0].version === '170',
    has170: led.some((r) => r.version === '170'),
  }
  out.ledgerTopAfterParsed = led.slice(0, 3)
  // info ไม่ใช่เกณฑ์ผ่าน: run แรก = true (ยังไม่มีคอลัมน์) · re-run = false (มีแล้ว — idempotent)
  out.precheckHadNoCostCols = before.length === 0
  out.allPass = Object.entries(out.assertions).every(([k, v]) => v === true)

  fs.writeFileSync(path.join(__dirname, 'r21Apply170-result.json'), JSON.stringify(out, null, 2))
  console.log('ALL_PASS=' + out.allPass)
  console.log(JSON.stringify(out.assertions, null, 2))
  if (!out.allPass) console.log('DETAIL=' + JSON.stringify({ cols, cons, neg, mismatch, led: led[0] }).slice(0, 800))
})().catch((e) => console.log('FATAL ' + String(e).slice(0, 500)))
