'use strict'
// _r105bRecord196 — RECORD ONLY migration 196 background music bucket policies
// เข้า production ผ่าน Supabase Management API (pattern เดียวกับ _r80Apply209.cjs)
// Owner อนุมัติ 2026-11-24: "196 รันผ่าน record ลง schema_migrations ให้ด้วย"
// (migration apply ผ่าน SQL Editor โดย Owner แล้ว — ห้าม apply ซ้ำ RECORD ONLY)
//
// probe ก่อน (กฎ 16.3 — marker จากเนื้อไฟล์):
//   - 4 policies บน storage.objects ชื่อ background_music_* ต้องมีครบ
//   - definition ต้องใช้ bucket_id literal และไม่มี subquery storage.buckets (ยืนยันว่า Owner รันตัวแก้ใหม่)
// ไม่พิมพ์ค่า token ลง log · evidence: e2e/_r105b_record196.json
const fs = require('fs')
const path = require('path')

const ROOT = 'D:/A PROJECT/Bite Me Baby'
const PROJECT_REF = 'ivkdfognyiwjcmrhcnwz'
const OUT = path.join(ROOT, 'e2e', '_r105b_record196.json')

function readToken() {
  for (const f of ['.env.local', '.env']) {
    const full = path.join(ROOT, f)
    if (!fs.existsSync(full)) continue
    const txt = fs.readFileSync(full, 'utf8')
    const m2 = txt.match(/^\s*bmb_PAT_SUPABASE_ACCESS_TOKEN\s*=\s*(.+)\s*$/m)
    if (m2) return m2[1].replace(/^["']|["']$/g, '').trim()
    const m1 = txt.match(/^\s*SUPABASE_ACCESS_TOKEN\s*=\s*(.+)\s*$/m)
    if (m1) return m1[1].replace(/^["']|["']$/g, '').trim()
  }
  return null
}

const results = []
async function q(token, label, sql) {
  const r = await fetch('https://api.supabase.com/v1/projects/' + PROJECT_REF + '/database/query', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token, 'User-Agent': 'bmb-record-r105b' },
    body: JSON.stringify({ query: sql }),
  })
  const text = await r.text()
  results.push({ stage: label, status: r.status, body: text.slice(0, 800) })
  return text
}

;(async () => {
  const token = readToken()
  if (!token) { console.log('FATAL token not found'); process.exit(1) }
  const out = { at: new Date().toISOString(), project: PROJECT_REF, mode: 'RECORD ONLY (apply โดย Owner ผ่าน SQL Editor แล้ว)', owner_approved: '2026-11-24 record 196 + live test ผ่าน' }

  // ---- stage 1: probe marker — policies ครบ 4 ตัว + pattern แก้แล้ว (bucket_id literal) ----
  // pg_policies คอลัมน์จริง: policyname / qual (USING) / with_check (WITH CHECK)
  out.probe = {
    policies: await q(token, 'policies',
      "SELECT policyname, cmd, LEFT(COALESCE(qual, with_check), 300) AS def FROM pg_policies WHERE schemaname='storage' AND tablename='objects' AND policyname LIKE 'background_music_%' ORDER BY policyname"),
    brokenPattern: await q(token, 'broken-pattern',
      "SELECT count(*)::int AS n FROM pg_policies WHERE schemaname='storage' AND tablename='objects' AND policyname LIKE 'background_music_%' AND COALESCE(qual, with_check) LIKE '%FROM storage.buckets%'"),
    bucket: await q(token, 'bucket',
      "SELECT id, name, public FROM storage.buckets WHERE id='background_music'"),
    objectCount: await q(token, 'objects',
      "SELECT count(*)::int AS n FROM storage.objects WHERE bucket_id='background_music'"),
    ledgerBefore: await q(token, 'ledger-before',
      "SELECT version, name FROM supabase_migrations.schema_migrations WHERE version IN ('103','196') ORDER BY version"),
  }

  // ---- stage 2: gate — ต้องมี policies 4 ตัว + pattern เสีย 0 + bucket มี ก่อน record ----
  const pj = (t) => { try { const v = JSON.parse(t); return Array.isArray(v) ? v : [] } catch (e) { return [] } }
  const pol = pj(out.probe.policies)
  const broken = pj(out.probe.brokenPattern)
  const bucket = pj(out.probe.bucket)
  const expected = ['background_music_admin_delete', 'background_music_admin_update', 'background_music_authenticated_upload', 'background_music_public_read']
  const polOk = expected.every((n) => pol.some((p) => p.policyname === n)) && pol.length === 4
  const brokenOk = broken.length === 1 && Number(broken[0].n) === 0
  const bucketOk = bucket.length === 1 && bucket[0].public === true
  out.gate = { polOk, brokenOk, bucketOk, policies: pol.map((p) => p.policyname), defs: pol.map((p) => p.def) }

  if (!polOk || !brokenOk || !bucketOk) {
    out.ALL_OK = false
    out.abort = 'gate failed — ห้าม record ถ้า marker ไม่ตรงเนื้อไฟล์แก้ใหม่ (กฎ 16.3)'
    fs.writeFileSync(OUT, JSON.stringify(out, null, 2))
    console.log('GATE_FAILED ' + JSON.stringify(out.gate))
    process.exit(1)
  }

  // ---- stage 3: record ledger — 196 (idempotent) + NOTIFY pgrst ----
  out.record = {
    ins196: await q(token, 'record-196', "INSERT INTO supabase_migrations.schema_migrations (version, name, statements) VALUES ('196','196_background_music_bucket_policies','{}'::text[]) ON CONFLICT (version) DO NOTHING"),
    reload: await q(token, 'notify-pgrst', "NOTIFY pgrst, 'reload schema'"),
    ledgerTopAfter: await q(token, 'ledger-top', 'SELECT version, name FROM supabase_migrations.schema_migrations ORDER BY version DESC LIMIT 6'),
  }

  fs.writeFileSync(OUT, JSON.stringify(out, null, 2))

  // ---- assertions ----
  const parse = (t) => { try { return JSON.parse(t) } catch (e) { return null } }
  const led = parse(out.record.ledgerTopAfter) || []
  const led196 = led.some((x) => x.version === '196')
  out.ALL_OK = led196
  console.log(JSON.stringify({ ALL_OK: out.ALL_OK, ledger_top: led.map((x) => x.version).join(',') }))
  process.exit(out.ALL_OK ? 0 : 1)
})().catch((e) => {
  fs.writeFileSync(OUT, JSON.stringify({ ok: false, error: String(e && e.message || e), results }, null, 2))
  console.log('FATAL ' + String(e && e.message || e))
  process.exit(1)
})
