// ============================================
// metaTokenExchange — สร้าง Long-Lived Page Access Token (Owner เลือก 2026-10-05)
//
//   node e2e/metaTokenExchange.cjs check    → ยืนยัน token ปัจจุบัน (read-only)
//   node e2e/metaTokenExchange.cjs exchange → USER token (env.local) → long-lived
//                                             user token → Page token → verify
//
// สายการแลก (Meta docs):
//   1. short-lived USER token (จาก Graph API Explorer)
//   2. GET /oauth/access_token?grant_type=fb_exchange_token
//        &client_id=APP_ID&client_secret=APP_SECRET&fb_exchange_token=<user>
//      → long-lived USER token (~60 วัน)
//   3. GET /me/accounts ด้วย long-lived user token
//      → Page Access Token ที่**ไม่มีวันหมดอายุ** (ตราบใดที่ user ไม่ revoke)
//   4. เขียนทับ META_PAGE_ACCESS_TOKEN ใน .env.local + set EF secret
//
// ไม่พิมพ์ token กลับออกมา — แสดงแค่ความยาว/สถานะ
// ============================================
const fs = require('fs')
const path = require('path')
const ROOT = path.resolve(__dirname, '..')

function loadEnv() {
  const env = {}
  for (const line of fs.readFileSync(path.join(ROOT, '.env.local'), 'utf8').split(/\r?\n/)) {
    const m = line.match(/^([A-Za-z_][A-Za-z0-9_]*)=(.*)$/)
    if (m) env[m[1]] = m[2]
  }
  return env
}

function saveEnvKey(key, value) {
  const file = path.join(ROOT, '.env.local')
  const lines = fs.readFileSync(file, 'utf8').split(/\r?\n/)
  const idx = lines.findIndex((l) => l.match(new RegExp('^' + key + '=', 'i')))
  if (idx >= 0) lines[idx] = key + '=' + value
  else lines.push(key + '=' + value)
  fs.writeFileSync(file, lines.join('\n'))
}

const GRAPH = 'https://graph.facebook.com/v21.0'

async function checkToken(token) {
  const r = await fetch(GRAPH + '/me?fields=id,name', { headers: { Authorization: 'Bearer ' + token } })
  const j = await r.json().catch(() => null)
  return { status: r.status, j }
}

async function exchange() {
  const env = loadEnv()
  const appId = env.META_APP_ID
  const appSecret = env.META_APP_SECRET
  const userToken = env.META_USER_ACCESS_TOKEN || ''
  if (!userToken) {
    console.error('META_EXCHANGE_FAIL: META_USER_ACCESS_TOKEN not set in .env.local')
    console.error('วิธี: Graph API Explorer (developers.facebook.com/tools/explorer) →')
    console.error('  เลือก App ' + appId + ' → Generate Access Token → สิทธิ์ pages_show_list, pages_read_engagement, pages_manage_posts')
    console.error('  → คัดลอก token → วางใน .env.local เป็น META_USER_ACCESS_TOKEN=... แล้วรัน node e2e/metaTokenExchange.cjs exchange อีกครั้ง')
    process.exit(1)
  }

  // Step 1: user token → long-lived user token
  const u = new URL(GRAPH + '/oauth/access_token')
  u.searchParams.set('grant_type', 'fb_exchange_token')
  u.searchParams.set('client_id', appId)
  u.searchParams.set('client_secret', appSecret)
  u.searchParams.set('fb_exchange_token', userToken)
  const r1 = await fetch(u)
  const j1 = await r1.json().catch(() => null)
  if (!r1.ok || !j1?.access_token) {
    console.error('META_EXCHANGE_FAIL (step1): HTTP ' + r1.status + ' ' + JSON.stringify(j1).slice(0, 300))
    process.exit(1)
  }
  console.log('STEP1_OK long_lived_user_token len=' + j1.access_token.length + ' expires_in=' + (j1.expires_in || 'n/a'))

  // Step 2: /me/accounts with the long-lived user token → page tokens
  const r2 = await fetch(GRAPH + '/me/accounts?fields=id,name,access_token', {
    headers: { Authorization: 'Bearer ' + j1.access_token },
  })
  const j2 = await r2.json().catch(() => null)
  if (!r2.ok || !Array.isArray(j2?.data) || j2.data.length === 0) {
    console.error('META_EXCHANGE_FAIL (step2 /me/accounts): HTTP ' + r2.status + ' ' + JSON.stringify(j2).slice(0, 300))
    process.exit(1)
  }

  // The BITE ME BABY page (business_id asset from the verified-domain screenshot)
  const page = j2.data.find((p) => /bite\s*me\s*baby/i.test(p.name || '')) || j2.data[0]
  if (!page?.access_token) {
    console.error('META_EXCHANGE_FAIL: no page token in /me/accounts response')
    process.exit(1)
  }

  // Step 3: verify the page token is live and long-lived
  const v = await checkToken(page.access_token)
  if (v.status !== 200) {
    console.error('META_EXCHANGE_FAIL (step3 verify): HTTP ' + v.status + ' ' + JSON.stringify(v.j).slice(0, 300))
    process.exit(1)
  }
  console.log('STEP2_OK page_id=' + page.id + ' name="' + page.name + '" token_len=' + page.access_token.length + ' verify=/' + v.j.id + ' (' + (v.j.name || '') + ')')

  // Step 4: persist + set EF secret
  saveEnvKey('META_PAGE_ACCESS_TOKEN', page.access_token)
  saveEnvKey('META_PAGE_ID', page.id)
  console.log('ENV_UPDATED META_PAGE_ACCESS_TOKEN + META_PAGE_ID (values not printed)')

  const res = await fetch(`https://api.supabase.com/v1/projects/ivkdfognyiwjcmrhcnwz/secrets`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${env.SUPABASE_ACCESS_TOKEN}`, 'Content-Type': 'application/json' },
    body: JSON.stringify([
      { name: 'META_PAGE_ACCESS_TOKEN', value: page.access_token },
      { name: 'META_PAGE_ID', value: page.id },
    ]),
  })
  if (!res.ok) {
    console.error('META_EXCHANGE_FAIL (step4 secrets): HTTP ' + res.status + ' ' + (await res.text()).slice(0, 200))
    process.exit(1)
  }
  console.log('META_EXCHANGE_OK — page token is long-lived, EF secrets updated. Redeploy social-publish-worker to be safe.')
}

async function check() {
  const env = loadEnv()
  const token = env.META_PAGE_ACCESS_TOKEN || ''
  if (!token) { console.error('META_PAGE_ACCESS_TOKEN missing'); process.exit(1) }
  const v = await checkToken(token)
  if (v.status === 200) console.log('TOKEN_OK identity=/' + v.j.id + ' (' + (v.j.name || '') + ')')
  else {
    console.log('TOKEN_REJECTED HTTP ' + v.status + ' ' + JSON.stringify(v.j?.error?.message || '').slice(0, 160))
    process.exit(1)
  }
}

const mode = process.argv[2] || 'check'
if (mode === 'exchange') exchange()
else check()