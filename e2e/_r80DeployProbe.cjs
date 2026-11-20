'use strict'
// _r80DeployProbe — READ-ONLY probe production ก่อน apply migration ที่ขาด
// Owner อนุมัติ 2026-11-20: "อนุมัติแอพพลายมิเกรชั่นที่ขาดอยู๋รวม209 สู่โปรดักชั่น"
// ตรวจ 6 ตัวที่ schema_migrations ไม่มี: 186 / 205 / 206 / 207 / 208 / 209
// (205/206 มีหลักฐาน apply เดิม _r205_apply.json/_r206_apply.json · 207/208 Owner ยืนยัน apply แล้ว —
//  probe นี้พิสูจน์ซ้ำด้วย schema จริง กัน re-apply ซ้ำ)
// ไม่พิมพ์ token · evidence: e2e/_r80_deploy_probe.json
const fs = require('fs')

const PROJECT_REF = 'ivkdfognyiwjcmrhcnwz'
const OUT = 'e2e/_r80_deploy_probe.json'

function readToken() {
  for (const f of ['.env.local', '.env']) {
    if (!fs.existsSync(f)) continue
    const txt = fs.readFileSync(f, 'utf8')
    const m2 = txt.match(/^\s*bmb_PAT_SUPABASE_ACCESS_TOKEN\s*=\s*(.+)\s*$/m)
    if (m2) return m2[1].replace(/^["']|["']$/g, '').trim()
    const m1 = txt.match(/^\s*SUPABASE_ACCESS_TOKEN\s*=\s*(.+)\s*$/m)
    if (m1) return m1[1].replace(/^["']|["']$/g, '').trim()
  }
  return null
}

const PROBE_SQL = `
select coalesce(json_agg(t), '[]'::json) as probe from (
  select 'm186_bkk' as kind,
    coalesce((select case when position('Asia/Bangkok' in pg_get_functiondef(p.oid)) > 0
      then 'bkk' else 'utc' end
      from pg_proc p join pg_namespace n on n.oid = p.pronamespace
      where n.nspname='public' and p.proname='promotion_apply_rules'
        and pg_get_function_identity_arguments(p.oid) = 'p_promo_id text, p_subtotal numeric, p_eligible numeric'),
      'missing') as items
  union all
  select 'm205_social' as kind,
    (SELECT count(*) FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
      WHERE n.nspname='public' AND p.proname IN ('cancel_order_as_customer','social_timeline_for_web'))::text as items
  union all
  select 'm206_mascot' as kind,
    coalesce((SELECT count(*)::text FROM storage.buckets WHERE id = 'Bite_Mascot' AND public = true), '0') as items
  union all
  select 'm207_deliveries' as kind,
    (SELECT count(*)::text FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
      WHERE n.nspname='public' AND p.proname='my_deliveries'
        AND pg_get_function_identity_arguments(p.oid) = 'p_driver_phone text, p_assigned_from timestamptz, p_assigned_to timestamptz, p_scheduled_from date, p_scheduled_to date') as items
  union all
  select 'm208_vote' as kind,
    (SELECT count(*)::text FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
      WHERE n.nspname='public' AND p.proname IN ('preorder_vote_cast','preorder_vote_status')) as items
  union all
  select 'm209_float' as kind,
    ((SELECT count(*)::text FROM information_schema.columns
       WHERE table_schema='public' AND table_name='products' AND column_name='is_floating_ad')
     || '/' ||
     (SELECT count(*)::text FROM information_schema.columns
       WHERE table_schema='public' AND table_name='marketing_posts' AND column_name='is_floating_ad')) as items
) t;
`

;(async () => {
  const token = readToken()
  const out = { at: new Date().toISOString(), project: PROJECT_REF, readonly: true }
  if (!token) { out.ok = false; out.error = 'token not found'; fs.writeFileSync(OUT, JSON.stringify(out, null, 2)); console.log(JSON.stringify(out)); process.exit(1) }
  const r = await fetch('https://api.supabase.com/v1/projects/' + PROJECT_REF + '/database/query', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token, 'User-Agent': 'bmb-probe-r80-readonly' },
    body: JSON.stringify({ query: PROBE_SQL }),
  })
  out.http = r.status
  const body = await r.json().catch(() => null)
  if (!r.ok) {
    out.ok = false
    out.error = JSON.stringify(body).slice(0, 400)
    fs.writeFileSync(OUT, JSON.stringify(out, null, 2))
    console.log(JSON.stringify(out))
    process.exit(1)
  }
  const first = Array.isArray(body) ? body[0] : null
  const raw = first && (first.probe ?? first.coalesce)
  const rows = typeof raw === 'string' ? JSON.parse(raw) : (Array.isArray(raw) ? raw : [])
  const m = Object.fromEntries(rows.map((x) => [x.kind, x.items]))
  out.m186_bkk = m.m186_bkk
  out.m205_social_count = m.m205_social
  out.m206_bucket = m.m206_mascot
  out.m207_v3 = m.m207_deliveries
  out.m208_vote_count = m.m208_vote
  out.m209_columns = m.m209_float
  // สรุป: อะไร "ยังไม่ถูก apply จริง" (ต้อง apply) และอะไร "applied แค่ไม่ได้ record" (ต้อง record)
  out.applied_missing_record = []
  out.needs_apply = []
  if (m.m186_bkk === 'bkk') out.applied_missing_record.push('186'); else if (m.m186_bkk === 'utc') out.needs_apply.push('186'); else out.needs_apply.push('186')
  if (Number(m.m205_social) === 2) out.applied_missing_record.push('205'); else out.needs_apply.push('205')
  if (Number(m.m206_mascot) === 1) out.applied_missing_record.push('206'); else out.needs_apply.push('206')
  if (Number(m.m207_v3) === 1) out.applied_missing_record.push('207'); else out.needs_apply.push('207')
  if (Number(m.m208_vote) === 2) out.applied_missing_record.push('208'); else out.needs_apply.push('208')
  const fl = String(m.m209_float || '0/0').split('/')
  if (fl[0] === '1' && fl[1] === '1') out.applied_missing_record.push('209'); else out.needs_apply.push('209')
  fs.writeFileSync(OUT, JSON.stringify(out, null, 2))
  console.log(JSON.stringify({ ok: true, m186: m.m186_bkk, m205: m.m205_social, m206: m.m206_mascot, m207: m.m207_v3, m208: m.m208_vote, m209: m.m209_float, applied_missing_record: out.applied_missing_record, needs_apply: out.needs_apply }))
})().catch((e) => {
  fs.writeFileSync(OUT, JSON.stringify({ ok: false, error: String(e && e.message || e) }, null, 2))
  console.log(JSON.stringify({ ok: false, error: String(e && e.message || e) }))
  process.exit(1)
})