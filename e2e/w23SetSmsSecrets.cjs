'use strict'
// W-2.3 + page token (2026-10-07): set production EF secrets จาก .env.local
//   - SMS_PROVIDER / SMS_API_URL / SMS_API_KEY / SMS_SENDER_NAME (THSMS)
//   - META_PAGE_ACCESS_TOKEN (โทเคนใหม่ที่ Owner ใส่ — pages_messaging scope)
// ไม่พิมพ์ค่าใด ๆ — แค่ชื่อ secret + HTTP status (rule: secrets ห้าม print)
const fs = require('fs')
const path = require('path')
const ROOT = path.resolve(__dirname, '..')
const h = {}
const tokens = []
for (const l of fs.readFileSync(path.join(ROOT, '.env.local'), 'utf8').split(/\r?\n/)) {
  const m = l.match(/^\s*([A-Za-z0-9_]+)\s*=\s*(.*)\s*$/)
  if (m && !l.trim().startsWith('#') && m[2]) {
    if (m[1] === 'SUPABASE_ACCESS_TOKEN') tokens.push(m[2])
    else h[m[1]] = m[2]
  }
}
const REF = 'ivkdfognyiwjcmrhcnwz'
async function main() {
  const thKey = h.THSMS_API_KEY, thSender = h.THSMS_SENDER_NAME, pageTok = h.META_PAGE_ACCESS_TOKEN
  if (!thKey || !thSender) throw new Error('THSMS_API_KEY / THSMS_SENDER_NAME missing in .env.local')
  if (!pageTok) throw new Error('META_PAGE_ACCESS_TOKEN missing in .env.local')
  const pairs = [
    ['SMS_PROVIDER', 'thsms'],
    ['SMS_API_URL', 'https://thsms.com/api/send-sms'],
    ['SMS_API_KEY', thKey],
    ['SMS_SENDER_NAME', thSender],
    ['META_PAGE_ACCESS_TOKEN', pageTok],
  ]
  let ok = false
  for (const tok of [...tokens].reverse()) {
    const r = await fetch('https://api.supabase.com/v1/projects/' + REF + '/secrets', {
      method: 'POST',
      headers: { Authorization: 'Bearer ' + tok, 'Content-Type': 'application/json' },
      body: JSON.stringify(pairs.map(([name, value]) => ({ name, value }))),
    })
    const t = await r.text()
    console.log('SET_SECRETS HTTP', r.status, t.slice(0, 200))
    if (r.ok || r.status === 201) { ok = true; break }
    if (r.status === 401 || r.status === 403) continue
    throw new Error('secrets POST failed: HTTP ' + r.status + ' ' + t.slice(0, 200))
  }
  if (!ok) throw new Error('no working SUPABASE_ACCESS_TOKEN')
  console.log('SECRET_NAMES_SET:', pairs.map(([n]) => n).join(', '))
  // verify: list เฉพาะชื่อ
  for (const tok of [...tokens].reverse()) {
    const r = await fetch('https://api.supabase.com/v1/projects/' + REF + '/secrets', { headers: { Authorization: 'Bearer ' + tok } })
    if (!r.ok) continue
    const j = await r.json().catch(() => [])
    const names = (Array.isArray(j) ? j : (j.secrets || [])).map((s) => s.name)
    const need = ['SMS_PROVIDER', 'SMS_API_URL', 'SMS_API_KEY', 'SMS_SENDER_NAME', 'META_PAGE_ACCESS_TOKEN']
    console.log('VERIFY:', need.map((n) => n + '=' + (names.includes(n) ? 'PRESENT' : 'MISSING')).join(' · '), '| total=' + names.length)
    return
  }
  throw new Error('secrets list verify failed')
}
main().catch((e) => { console.error('W23_SECRETS_FAIL:', String(e.message || e).slice(0, 300)); process.exit(1) })
