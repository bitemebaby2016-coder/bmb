// R74-OMNI s2 — ตรวจคีย์ใหม่ bmb_PAT_SUPABASE_ACCESS_TOKEN: สแกนกว้าง (case-insensitive · ทุกไฟล์ env · env var เครื่อง · mtime)
// ไม่พิมพ์ค่าลับ — เฉพาะชื่อ key / ความยาว / head-tail
'use strict'
const fs = require('fs')
const path = require('path')
const ROOT = path.resolve(__dirname, '..')

function scan(file) {
  let raw
  try { raw = fs.readFileSync(path.join(ROOT, file), 'utf8') } catch (e) { console.log('FILE ' + file + ' MISSING'); return }
  for (const l of raw.split(/\r?\n/)) {
    const m = l.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/)
    if (!m) continue
    if (/pat|bmb|supabase_access/i.test(m[1])) {
      const v = (m[2] || '').trim()
      console.log('FILE ' + file + ' KEY=' + m[1] + ' len=' + v.length + ' head=' + v.slice(0, 5) + ' tail=' + v.slice(-4))
    }
  }
}
scan('.env.local')
scan('supabase/secrets.local.env')
scan('.env')
for (const [k, v] of Object.entries(process.env)) {
  if (/pat|bmb|supabase_access/i.test(k)) console.log('ENVVAR ' + k + ' len=' + String(v).length)
}
for (const f of ['.env.local', 'supabase/secrets.local.env']) {
  try { console.log('MTIME ' + f + ' = ' + fs.statSync(path.join(ROOT, f)).mtime.toISOString()) } catch {}
}
console.log('KEYCHECK2_DONE')

