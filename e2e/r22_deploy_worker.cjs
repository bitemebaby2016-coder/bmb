// r22 — deploy tenant-proxy worker (Owner: ทำ deploy ให้เสร็จ ห้ามค้าง — 2026-10-30 harden)
// จุดค้างเดิม: wrangler ไม่เห็น token → รอ prompt login ค้างนิรันดรใน shell แบบ non-interactive
// วิธีใหม่: node อ่าน .env.local เอง (ตัด quote/trim) → ตั้ง env ชัดเจน → spawn wrangler ด้วย
// CI=true (ห้าม prompt) + timeout 120-180 วิ (ค้าง = ถูกฆ่า ไม่ใช่ค้างเฉย ๆ)
const fs = require('fs')
const path = require('path')
const { spawnSync } = require('child_process')

const ROOT = path.resolve(__dirname, '..')
const envLocal = fs.readFileSync(path.join(ROOT, '.env.local'), 'utf8')
const m = /^CLOUDFLARE_API_TOKEN=(.*)$/m.exec(envLocal)
const token = m ? m[1].replace(/^["']|["']$/g, '').trim() : ''
if (!token) {
  console.error('[r22] MISSING CLOUDFLARE_API_TOKEN in .env.local — abort without prompt')
  process.exit(2)
}
process.env.CLOUDFLARE_API_TOKEN = token
process.env.WRANGLER_SEND_METRICS = 'false'
process.env.CI = 'true'
const wd = path.join(ROOT, 'workers', 'tenant-proxy')

let r = spawnSync('wrangler', ['deploy', '--minify'], {
  cwd: wd, stdio: 'inherit', shell: true, env: process.env, timeout: 120000,
})
if (r.error || r.status !== 0) {
  console.log('[r22] direct wrangler failed/unavailable — retry via npx --yes (non-interactive)')
  r = spawnSync('npx', ['--yes', 'wrangler', 'deploy', '--minify'], {
    cwd: wd, stdio: 'inherit', shell: true, env: process.env, timeout: 180000,
  })
}
console.log('WRANGLER_EXIT=' + (r.status ?? -1) + (r.signal ? ' SIGNAL=' + r.signal : ''))
process.exit(r.status ?? 1)
