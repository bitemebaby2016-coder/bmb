// R22 CF diagnostics v2 — แก้ URL ต้องมี /client/v4/ (v1 ขาด v4 → 10404 = ตัววัดผิดเอง)
// + สืบต้นตอ account 0341... (มาจากไหน) จาก user wrangler config แบบ redact ไม่โชว์ secret
const fs = require('fs')
const path = require('path')
const os = require('os')
const ROOT = path.resolve(__dirname, '..')
const raw = fs.readFileSync(path.join(ROOT, '.env.local'), 'utf8')
const envAcct = ((/^CLOUDFLARE_ACCOUNT_ID=(.*)$/m.exec(raw) || [])[1] || '').trim()
const AT = (/^CLOUDFLARE_API_TOKEN=(.*)$/m.exec(raw) || [])[1]
console.log('ENV_ACCOUNT_ID=' + envAcct)
// --- user wrangler default.toml: แสดงเฉพาะ 'ชื่อ key' + บ่งชี้ account id (ไม่พิมพ์ค่า token) ---
try {
  const p = path.join(os.homedir(), '.wrangler', 'config', 'default.toml')
  const t = fs.readFileSync(p, 'utf8')
  const keyNames = t
    .split(/\r?\n/)
    .filter((l) => l.includes('='))
    .map((l) => l.slice(0, l.indexOf('=')).trim())
  console.log('DEFAULT_TOML_KEYS=' + JSON.stringify(keyNames))
  const stripped = t.replace(/-/g, '')
  const hexes = stripped.match(/[a-f0-9]{32}/gi) || []
  console.log('DEFAULT_TOML_HEX32=' + JSON.stringify([...new Set(hexes)]))
  console.log('DEFAULT_TOML_CONTAINS_0341=' + t.includes('034195615593c7af513441baa83e5408'))
  console.log('DEFAULT_TOML_CONTAINS_B895=' + t.includes('b89501b69eef20998a9d3dae480c52af'))
} catch (e) {
  console.log('NO_DEFAULT_TOML=' + e.code)
}
const A0341 = '034195615593c7af513441baa83e5408'
const AB895 = 'b89501b69eef20998a9d3dae480c52af'
async function probe(u, label) {
  try {
    const r = await fetch(u, { headers: { Authorization: 'Bearer ' + AT } })
    const j = await r.json().catch(() => null)
    const summary = j
      ? {
          success: j.success,
          errors: j.errors,
          resultCount: Array.isArray(j.result) ? j.result.length : typeof j.result,
          sample: Array.isArray(j.result)
            ? j.result.slice(0, 5).map((x) => ({ id: x.id, name: x.name, tag: x.tag, account: x.account && x.account.id }))
            : j.result,
        }
      : null
    console.log(label + ' status=' + r.status + ' ' + JSON.stringify(summary).slice(0, 600))
  } catch (e) {
    console.log(label + '_ERR=' + String(e).slice(0, 200))
  }
}
;(async () => {
  await probe('https://api.cloudflare.com/client/v4/accounts', 'V4_ACCOUNTS_LIST')
  await probe('https://api.cloudflare.com/client/v4/accounts/' + AB895 + '/workers/services', 'V4_B895_WORKERS')
  await probe('https://api.cloudflare.com/client/v4/accounts/' + A0341 + '/workers/services', 'V4_0341_WORKERS')
  await probe('https://api.cloudflare.com/client/v4/zones?name=biteme-baby.com', 'V4_ZONE_biteme-baby.com')
})()