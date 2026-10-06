// ============================================
// metaTokenDebug — inspect the Page Access Token via debug_token (read-only)
//   node scripts/metaTokenDebug.mjs
// Reports is_valid / type / expiry / granted scopes WITHOUT publishing anything.
// ============================================
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')

const env = {}
for (const line of fs.readFileSync(path.join(ROOT, '.env.local'), 'utf8').split(/\r?\n/)) {
  const m = line.match(/^([A-Za-z_][A-Za-z0-9_]*)=(.*)$/)
  if (m) env[m[1]] = m[2]
}

const appToken = env.META_APP_ID + '|' + env.META_APP_SECRET
const u = new URL('https://graph.facebook.com/v21.0/debug_token')
u.searchParams.set('input_token', env.META_PAGE_ACCESS_TOKEN || '')
u.searchParams.set('access_token', appToken)

const r = await fetch(u)
const j = await r.json().catch(() => null)
const d = (j && j.data) || {}
console.log('is_valid   =', d.is_valid)
console.log('type       =', d.type)
console.log('app_id     =', d.app_id)
console.log('expires_at =', d.expires_at === 0 ? 'never (long-lived page token)' : new Date(d.expires_at * 1000).toISOString())
console.log('issued_at  =', d.issued_at ? new Date(d.issued_at * 1000).toISOString() : 'n/a')
console.log('scopes     =', JSON.stringify(d.scopes))
const scopes = d.scopes || []
console.log('HAS pages_manage_posts     =', scopes.includes('pages_manage_posts'))
console.log('HAS pages_manage_metadata  =', scopes.includes('pages_manage_metadata'))
console.log('HAS pages_read_engagement  =', scopes.includes('pages_read_engagement'))