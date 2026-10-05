// ============================================
// push115Apply — สมัคร migration 115 (Web Push) + ตั้ง VAPID/Meta secrets
//
// รูปแบบเดียวกับ fcApply114.cjs: ไฟล์ SQL = transaction เดียว ผ่าน
// Supabase Management API (single-statement discipline ต่อ verify ภายหลัง)
//
//   node e2e/push115Apply.cjs           → apply migration 115 (idempotent)
//   node e2e/push115Apply.cjs secrets   → set Edge Function secrets
//   node e2e/push115Apply.cjs list      → รายชื่อ secrets ปัจจุบัน (ไม่แสดงค่า)
//
// Secret values are NEVER echoed — only name + length.
// ============================================
const fs = require('fs')
const path = require('path')
const ROOT = path.resolve(__dirname, '..')

const env = {}
for (const line of fs.readFileSync(path.join(ROOT, '.env.local'), 'utf8').split(/\r?\n/)) {
  const m = line.match(/^(\w+)=(.*)$/)
  if (m) env[m[1]] = m[2]
}

const PROJECT = 'ivkdfognyiwjcmrhcnwz'
const API = `https://api.supabase.com/v1/projects/${PROJECT}`

// VAPID pair accepted by the REAL web-push implementation
// (scripts/vapidWebpushCheck.cjs → WEBPUSH_ACCEPT=true, Authorization signed).
//
// Two format rules that both had to be discovered the hard way:
//   1. NO '=' padding — web-push validates with /^[A-Za-z0-9\-_]+$/.
//   2. NO leading 'B' — the 'B' marker belongs to the BROWSER-facing
//      ApplicationServerKey convention only; web-push's server-side key must be
//      the bare 87-char base64url body.
// The browser copy is built by prefixing 'B' in get_push_config consumers.
const VAPID_PUBLIC_KEY = 'BMwKuaU1rBMs6w-7GAxocIdxLcvMyQmRoClMZyzn3ClB7c8rJi3Wl83rSf6UzkKiyfG4L_0fQnV2KbfpKYkFLJE'
const VAPID_PRIVATE_KEY = 'WPVuHEHFoY3iAQDaSElPDSIYtIK2Hswq11hkXFuoy88'
const VAPID_SUBJECT = 'mailto:admin@biteme-baby.com'

// Meta credentials live in .env.local lines 23-26 but are COMMENTED OUT, so the
// naive parser above cannot see them. Parse the commented form as a fallback.
// The .env.local Meta block is malformed across three shapes:
//   line 23: "App ID=1746001833371898"          (bare label=value — NOT a comment)
//   line 24: "App Secret=e2172a0c..."           (same)
//   line 25: "Page Access Token"                (label only)
//   line 26: "=EAAYzZBrsOKPoB..."              (value only, leading '=')
// so the token needs label-line + value-line pairing, not one regex.
function readMetaCredentials() {
  const raw = fs.readFileSync(path.join(ROOT, '.env.local'), 'utf8')
  const lines = raw.split(/\r?\n/)

  const inline = (label) => {
    const re = new RegExp(`^\\s*#?\\s*${label}\\s*=\\s*(\\S+)\\s*$`, 'i')
    for (const line of lines) {
      const m = line.match(re)
      if (m && m[1].length > 6) return m[1].trim()
    }
    return ''
  }
  // label on one line, "=VALUE" on the next (as in lines 25/26)
  const splitLines = (label) => {
    for (let i = 0; i < lines.length - 1; i++) {
      if (new RegExp(`^\\s*#?\\s*${label}\\s*$`, 'i').test(lines[i])) {
        const m = lines[i + 1].match(/^=\s*(\S+)\s*$/)
        if (m) return m[1].trim()
      }
    }
    return ''
  }

  return {
    appId: env.META_APP_ID || inline('App ID'),
    appSecret: env.META_APP_SECRET || inline('App Secret'),
    pageToken: env.META_PAGE_ACCESS_TOKEN || splitLines('Page Access Token'),
  }
}

// Write the PUBLIC VAPID key into business_settings.push_config — this is the
// copy the browser reads via get_push_config. It must equal VAPID_PUBLIC_KEY
// above, otherwise PushManager.subscribe produces an endpoint the push service
// rejects. Only the public half is stored; the private half stays a secret.
async function writePushConfig() {
  const escaped = VAPID_PUBLIC_KEY.replace(/'/g, "''")
  const sql = `UPDATE public.business_settings
                SET value = jsonb_set(
                      jsonb_set(value, '{enabled}', to_jsonb(true), true),
                      '{vapid_public_key}', to_jsonb('${escaped}'::text), true
                    ),
                    updated_at = NOW()
                WHERE key = 'push_config'
                RETURNING key, value->>'vapid_public_key' AS pk, value->>'enabled' AS en;`
  const res = await fetch(`${API}/database/query`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${env.SUPABASE_ACCESS_TOKEN}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ query: sql }),
  })
  const json = await res.json().catch(() => null)
  if (!res.ok || (json && json.message)) {
    console.error('PUSH115_CONFIG_FAIL: HTTP ' + res.status + ' ' + JSON.stringify(json).slice(0, 800))
    process.exit(1)
  }
  const row = Array.isArray(json) ? json[0] : null
  if (!row || row.pk !== VAPID_PUBLIC_KEY) {
    console.error('PUSH115_CONFIG_FAIL: stored key does not match (' + (row ? 'len=' + String(row.pk).length : 'no row') + ')')
    process.exit(1)
  }
  console.log(`PUSH115_CONFIG_OK enabled=${row.en} key_len=${String(row.pk).length}`)
}

async function applyMigration() {
  const sql = fs.readFileSync(path.join(ROOT, 'supabase', 'migrations', '115_push_subscriptions.sql'), 'utf8')
  const res = await fetch(`${API}/database/query`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${env.SUPABASE_ACCESS_TOKEN}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ query: sql }),
  })
  const json = await res.json().catch(() => null)
  if (!res.ok || (json && json.message)) {
    console.error('PUSH115_APPLY_FAIL: HTTP ' + res.status + ' ' + JSON.stringify(json).slice(0, 2000))
    process.exit(1)
  }
  console.log('PUSH115_APPLY_OK')
}

async function setSecrets() {
  const meta = readMetaCredentials()
  if (!meta.appId || !meta.appSecret || !meta.pageToken) {
    console.error('PUSH115_SECRET_FAIL: Meta credentials not found in .env.local (App ID / App Secret / Page Access Token)')
    process.exit(1)
  }
  const pairs = [
    ['VAPID_PUBLIC_KEY', VAPID_PUBLIC_KEY],
    ['VAPID_PRIVATE_KEY', VAPID_PRIVATE_KEY],
    ['VAPID_SUBJECT', VAPID_SUBJECT],
    ['META_APP_ID', meta.appId],
    ['META_APP_SECRET', meta.appSecret],
    ['META_PAGE_ACCESS_TOKEN', meta.pageToken],
  ]
  for (const [name, value] of pairs) {
    const res = await fetch(`${API}/secrets`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${env.SUPABASE_ACCESS_TOKEN}`, 'Content-Type': 'application/json' },
      body: JSON.stringify([{ name, value }]),
    })
    if (!res.ok) {
      const txt = await res.text().catch(() => '')
      console.error(`PUSH115_SECRET_FAIL ${name}: HTTP ${res.status} ${txt.slice(0, 300)}`)
      process.exit(1)
    }
    console.log(`SECRET_SET ${name} len=${value.length}`)
  }
  console.log('PUSH115_SECRETS_OK')
}

async function listSecrets() {
  const res = await fetch(`${API}/secrets`, { headers: { Authorization: `Bearer ${env.SUPABASE_ACCESS_TOKEN}` } })
  const json = await res.json().catch(() => [])
  const names = (Array.isArray(json) ? json : []).map((s) => s.name).sort()
  console.log('SECRETS_PRESENT:', names.join(', ') || '(none)')
  for (const need of ['VAPID_PUBLIC_KEY', 'VAPID_PRIVATE_KEY', 'VAPID_SUBJECT', 'META_APP_ID', 'META_APP_SECRET', 'META_PAGE_ACCESS_TOKEN']) {
    console.log(`  ${need}: ${names.includes(need) ? 'PRESENT' : 'MISSING'}`)
  }
}

const mode = process.argv[2] || 'apply'
if (mode === 'secrets') setSecrets()
else if (mode === 'config') writePushConfig()
else if (mode === 'list') listSecrets()
else applyMigration()