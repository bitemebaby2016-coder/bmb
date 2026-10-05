// W-1.4b production runtime verify — read-only
const fs = require('fs')
const path = require('path')
const ROOT = path.resolve(__dirname, '..')
const env = {}
for (const line of fs.readFileSync(path.join(ROOT, '.env.local'), 'utf8').split(/\r?\n/)) {
  const m = line.match(/^(\w+)=(.*)$/)
  if (m) env[m[1]] = m[2]
}
async function main() {
  // 1. homepage 200 + serving NEW hashed bundle
  const home = await fetch('https://biteme-baby.com/', { redirect: 'follow' })
  const html = await home.text()
  const asset = (html.match(/assets\/index-[\w-]+\.js/) || [null])[0]
  console.log(`HOME=${home.status} ASSET=${asset}`)

  // 2. bundle contains hydration key (W-1.4b code live)
  if (!asset) throw new Error('no asset in html')
  const js = await fetch('https://biteme-baby.com/' + asset)
  const jsText = await js.text()
  const hasKey = jsText.includes('bite_drive_radius_km')
  const hasHydrate = jsText.includes('delivery_policy')
  console.log(`BUNDLE=${js.status} HAS_RADIUS_KEY=${hasKey} HAS_DELIVERY_POLICY=${hasHydrate}`)

  // 3. anon-readable business_settings = hydration input ทำงานได้จริงจาก browser
  const rest = await fetch(`${env.VITE_SUPABASE_URL}/rest/v1/business_settings?select=key`, {
    headers: { apikey: env.VITE_SUPABASE_ANON_KEY, Authorization: `Bearer ${env.VITE_SUPABASE_ANON_KEY}` },
  })
  const keys = await rest.json()
  console.log(`SETTINGS_REST=${rest.status} KEYS=${JSON.stringify(Array.isArray(keys) ? keys.map((k) => k.key) : keys)}`)

  const pass = home.status === 200 && hasKey && hasHydrate && rest.status === 200 &&
    Array.isArray(keys) && keys.some((k) => k.key === 'delivery_policy')
  console.log('W14B_PROD_' + (pass ? 'PASS' : 'FAIL'))
  if (!pass) process.exit(1)
}
main().catch((e) => { console.error('ERROR ' + e.message); process.exit(1) })
