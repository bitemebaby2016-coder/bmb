'use strict'
// _r206_apply — apply migration 206 (R206 mascot self-service: bucket Bite_Mascot + policies)
// เข้า production ผ่าน Supabase Management API (pattern เดียวกับ _r205Apply.cjs)
// อ่าน token จาก .env.local (คีย์ bmb_PAT_SUPABASE_ACCESS_TOKEN ก่อน —
// ค่า sbp_ เดิมของ SUPABASE_ACCESS_TOKEN ถูกยกเลิก · ไม่พิมพ์ค่าใด ๆ ลง log)
const fs = require('fs')

const PROJECT_REF = 'ivkdfognyiwjcmrhcnwz'
const SQL_FILE = 'supabase/migrations/206_mascot_bucket_selfservice.sql'
const OUT = 'e2e/_r206_apply.json'

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

;(async () => {
  const token = readToken()
  const out = { at: new Date().toISOString(), file: SQL_FILE, project: PROJECT_REF }
  if (!token) { out.ok = false; out.error = 'access token not found'; console.log(JSON.stringify(out)); fs.writeFileSync(OUT, JSON.stringify(out, null, 2)); process.exit(1) }
  const sql = fs.readFileSync(SQL_FILE, 'utf8')
  out.sql_bytes = Buffer.byteLength(sql)
  out.sql_has_begin = /^\s*BEGIN;/m.test(sql)

  const r = await fetch('https://api.supabase.com/v1/projects/' + PROJECT_REF + '/database/query', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token, 'User-Agent': 'bmb-apply-206' },
    body: JSON.stringify({ query: sql }),
  })
  out.http = r.status
  const text = await r.text()
  out.response = text.slice(0, 1500)
  out.ok = r.status === 200 || r.status === 201

  // verify จริง: bucket ต้อง public + policies ครบ 4 ตัว
  if (out.ok) {
    const vq = `SELECT
      (SELECT count(*) FROM storage.buckets WHERE id = 'Bite_Mascot' AND public = true) AS bucket_public,
      (SELECT count(*) FROM pg_policies WHERE schemaname = 'storage' AND tablename = 'objects'
        AND policyname IN ('bite_mascot_public_read','bite_mascot_admin_upload','bite_mascot_admin_update','bite_mascot_admin_delete')) AS policy_count;`
    const rv = await fetch('https://api.supabase.com/v1/projects/' + PROJECT_REF + '/database/query', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token, 'User-Agent': 'bmb-verify-206' },
      body: JSON.stringify({ query: vq }),
    })
    out.verify_http = rv.status
    out.verify = await rv.json().catch(() => null)
    const row = Array.isArray(out.verify) && out.verify[0]
    out.verified = !!(row && Number(row.bucket_public) === 1 && Number(row.policy_count) === 4)
  }

  fs.writeFileSync(OUT, JSON.stringify(out, null, 2))
  console.log(JSON.stringify({ ok: out.ok, http: out.http, verified: out.verified, bucket_public: out.verify?.[0]?.bucket_public, policy_count: out.verify?.[0]?.policy_count }))
  process.exit(out.ok && out.verified !== false ? 0 : 1)
})().catch((e) => {
  fs.writeFileSync(OUT, JSON.stringify({ ok: false, error: String(e && e.message || e) }, null, 2))
  console.log(JSON.stringify({ ok: false, error: String(e && e.message || e) }))
  process.exit(1)
})
