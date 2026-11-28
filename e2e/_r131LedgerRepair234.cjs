// R131 — ledger repair 234 (apply ผ่าน Management API ไม่บันทึก schema_migrations อัตโนมัติ)
//   + migration list เพื่อยืนยัน Remote ครบทุกเวอร์ชัน (AI_ENTRYPOINT ข้อ 20)
//   evidence → e2e/_r131_ledger_234.log · ไม่พิมพ์ PAT
// Usage: node e2e/_r131LedgerRepair234.cjs
'use strict'
const fs = require('fs')
const path = require('path')
const { spawnSync } = require('child_process')

const ROOT = path.resolve(__dirname, '..')
const REF = 'ivkdfognyiwjcmrhcnwz'
const LOG = path.join(__dirname, '_r131_ledger_234.log')
fs.writeFileSync(LOG, 'LEDGER_START ' + new Date().toISOString() + '\n')
const _log = console.log.bind(console)
console.log = (...a) => { try { fs.appendFileSync(LOG, a.join(' ') + '\n') } catch {} ; _log(...a) }

const lines = fs.readFileSync(path.join(ROOT, '.env.local'), 'utf8').split(/\r?\n/)
const tokLine = lines.filter((l) => l.indexOf('SUPABASE_ACCESS_TOKEN=') === 0).pop()
const PAT = tokLine ? String(tokLine).substring(22).trim() : ''
if (!PAT) { console.log('NO_PAT'); process.exit(1) }

function run(args) {
  const r = spawnSync('npx', ['--no-install', 'supabase'].concat(args), {
    cwd: ROOT, encoding: 'utf8', shell: true,
    env: Object.assign({}, process.env, { SUPABASE_ACCESS_TOKEN: PAT }),
    timeout: 180000,
  })
  console.log('== supabase ' + args.join(' ') + ' exit=' + r.status)
  console.log(String(r.stdout || '').slice(-1500))
  if (r.stderr) console.log('STDERR ' + String(r.stderr).slice(-400))
  return r.status
}

const s1 = run(['migration', 'repair', '--status', 'applied', '234', '--project-ref', REF])
const s2 = run(['migration', 'list', '--project-ref', REF])
const out = String(fs.readFileSync(LOG, 'utf8'))
const ok = s1 === 0 && s2 === 0 && /234/.test(out)
console.log(ok ? 'R131_LEDGER_OK 234 recorded + list ผ่าน' : 'R131_LEDGER_FAILED')
process.exit(ok ? 0 : 1)