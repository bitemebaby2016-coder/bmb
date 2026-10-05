// Prints sha256 digests of the LOCAL Stripe/Meta secrets so they can be compared
// against the digests reported by the Supabase secrets API (proves the deployed
// Edge Function secret really is the live key without echoing any value).
const crypto = require('crypto')
const fs = require('fs')
const path = require('path')
const ROOT = path.resolve(__dirname, '..')

const env = {}
for (const line of fs.readFileSync(path.join(ROOT, '.env.local'), 'utf8').split(/\r?\n/)) {
  const m = line.match(/^([A-Za-z_][A-Za-z0-9_]*)=(.*)$/)
  if (m) env[m[1]] = m[2]
}

const pairs = {
  STRIPE_SECRET_KEY: env.BMB_LIVE_STRIPE_SECRET_KEY,
  STRIPE_WEBHOOK_SECRET: env.LIVE_STRIPE_WEBHOOK_SECRET,
  META_APP_SECRET: env.META_APP_SECRET,
  META_PAGE_ACCESS_TOKEN: env.META_PAGE_ACCESS_TOKEN,
}

for (const [name, value] of Object.entries(pairs)) {
  if (!value) { console.log('LOCAL  ' + name + ' = MISSING'); continue }
  console.log('LOCAL  ' + name + ' = ' + crypto.createHash('sha256').update(value).digest('hex'))
}