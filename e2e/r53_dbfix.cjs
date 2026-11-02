// e2e/r53_dbfix.cjs — N2 (Owner ย้ำ "ไบ๊ ไม่หาย"): แทนชื่อผิดทุก form ใน business_settings ทั้งตาราง
// ใช้ SERVICE ROLE (อ่านจาก supabase/secrets.local.env — ไม่ commit / ไม่พิมพ์ key ออก stdout)
// ทำเสร็จ = re-GET ตรวจสอบ 0 variant เหลือ (evidence log: e2e/r53_dbfix.log)
const fs = require('fs')
const path = require('path')
const ROOT = path.join(__dirname, '..')
function envOf(file, key) {
  const txt = fs.readFileSync(path.join(ROOT, file), 'utf8')
  const m = new RegExp(`^${key}=(.*)$`, 'm').exec(txt)
  return m ? m[1].trim() : ''
}
const URL = envOf('.env', 'VITE_SUPABASE_URL')
const SERVICE = envOf('supabase/secrets.local.env', 'SUPABASE_SERVICE_ROLE_KEY')
if (!URL || !SERVICE) { console.log('MISSING_ENV'); process.exit(1) }
const H = { apikey: SERVICE, Authorization: `Bearer ${SERVICE}`, 'Content-Type': 'application/json' }

// REPLACEMENTS (longest-first — ตรง brandName.ts normalizeBrandNames)
const REPL = [
  ['ไบ๊ท์มีเบบี้', 'Bite Me Baby'], ['ไบ๊มีเบบี้', 'Bite Me Baby'], ['ไบท์มีเบบี้', 'Bite Me Baby'],
  ['ไบทมีเบบี้', 'Bite Me Baby'], ['บิทมีเบบี้', 'Bite Me Baby'],
  ['ไบ๊ท์', 'Bite'], ['ไบ๊ด์', 'Bite'], ['ไบ๊ท', 'Bite'], ['ไบ๊', 'Bite'],
  ['ไบท์', 'Bite'], ['ไบท๊', 'Bite'], ['ไบด์', 'Bite'], ['ไบช์', 'Bite'], ['ไบท', 'Bite'],
  ['บั๊บ', 'Bite'], ['บัป', 'Bite'], ['บัพ', 'Bite'], ['บิท', 'Bite'],
]
function fix(s) {
  let out = s
  for (const [from, to] of REPL) if (out.includes(from)) out = out.split(from).join(to)
  while (out.includes('BiteBite')) out = out.split('BiteBite').join('Bite')
  return out
}
function countVariants(s) {
  return REPL.filter(([from]) => s.includes(from)).map(([from]) => from)
}

async function main() {
  const list = await fetch(`${URL}/rest/v1/business_settings?select=key,value`, { headers: H }).then((r) => r.json())
  if (!Array.isArray(list)) { console.log('LIST_FAIL', JSON.stringify(list).slice(0, 200)); return }
  console.log('ROWS', list.length)
  let patched = 0
  for (const row of list) {
    const before = JSON.stringify(row.value ?? {})
    const found = countVariants(before)
    if (found.length === 0) continue
    const after = fix(before)
    const res = await fetch(`${URL}/rest/v1/business_settings?key=eq.${encodeURIComponent(row.key)}`, {
      method: 'PATCH', headers: { ...H, Prefer: 'return=representation' },
      body: JSON.stringify({ value: JSON.parse(after) }),
    })
    const txt = await res.text()
    console.log('PATCH', row.key, res.status, 'variants=' + found.join(','), 'after=' + countVariants(txt).length)
    if (res.ok) patched++
  }
  console.log('PATCHED', patched)
  // verify pass
  const again = await fetch(`${URL}/rest/v1/business_settings?select=key,value`, { headers: H }).then((r) => r.json())
  let bad = 0
  for (const row of again) { const f = countVariants(JSON.stringify(row.value ?? {})); if (f.length) { bad++; console.log('STILL', row.key, f.join(',')) } }
  console.log(bad === 0 ? 'VERIFY_ALL_CLEAN' : 'VERIFY_DIRTY=' + bad)
}
main().catch((e) => console.log('ERR', e && e.message))