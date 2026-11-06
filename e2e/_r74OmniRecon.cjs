// ============================================
// BMB R74-OMNI — OMNI-1 recon (READ-ONLY, no secret values printed/committed)
// 1. env key NAMES from .env.local + supabase/secrets.local.env (values never read out)
// 2. Meta graph read-only: /me on user token, app roles (testers), page posts count
// 3. real message corpus sample from social_events (content only, masked ids) —
//    used for parse-dictionary tuning (OMNI-4)
// Evidence: e2e/_r74_omni_env.json
// Usage: node e2e/_r74OmniRecon.cjs
// ============================================
'use strict'
const fs = require('fs')
const path = require('path')
const { S, SERVICE, api } = require('./wave2Lib.cjs')

function keyNames(file) {
  try {
    return fs.readFileSync(path.join(process.cwd(), file), 'utf8')
      .split(/\r?\n/)
      .map((l) => l.trim())
      .filter((l) => l && !l.startsWith('#') && l.includes('='))
      .map((l) => l.split('=')[0].trim())
  } catch { return [] }
}

;(async () => {
  const out = { date: new Date().toISOString(), note: 'R74-OMNI OMNI-1 · key NAMES only — ค่าลับไม่ถูกบันทึก/commit', env_keys: {}, meta: {}, corpus: [] }

  out.env_keys['.env.local'] = keyNames('.env.local')
  out.env_keys['supabase/secrets.local.env'] = keyNames('supabase/secrets.local.env')

  const need = {
    channel_webhook: ['CHANNEL_WEBHOOK_APP_SECRET', 'CHANNEL_WEBHOOK_VERIFY_TOKEN'],
    meta: ['META_APP_ID', 'META_APP_SECRET', 'META_USER_ACCESS_TOKEN', 'META_PAGE_ID', 'META_PAGE_ACCESS_TOKEN'],
    worker: ['AUTOMATION_TOKEN', 'SUPABASE_SERVICE_ROLE_KEY', 'OPENROUTER_API_KEY'],
    line: ['LINE_CHANNEL_SECRET', 'LINE_CHANNEL_ACCESS_TOKEN', 'LINE_LOGIN_CHANNEL_ID'],
    external_delivery: ['GRAB', 'LINEMAN', 'SHIPPING', 'DELIVERY_PROVIDER'],
  }
  const all = [...out.env_keys['.env.local'], ...out.env_keys['supabase/secrets.local.env']]
  out.checks = {}
  for (const [group, keys] of Object.entries(need)) {
    out.checks[group] = keys.map((k) => {
      const matches = all.filter((n) => n.toLowerCase() === k.toLowerCase() || n.toLowerCase().includes(k.toLowerCase()))
      return { key: k, present: matches.length > 0, matches }
    })
  }

  // Meta graph read-only checks (no token values logged)
  const USER_TOKEN = S.META_USER_ACCESS_TOKEN
  const PAGE_TOKEN = S.META_PAGE_ACCESS_TOKEN
  const APP_ID = S.META_APP_ID
  const APP_SECRET = S.META_APP_SECRET || S.CHANNEL_WEBHOOK_APP_SECRET
  if (USER_TOKEN) {
    const me = await fetch('https://graph.facebook.com/v23.0/me?access_token=' + USER_TOKEN).then((r) => r.json()).catch(() => null)
    out.meta.user_token_ok = !!(me && me.id)
    out.meta.user_id = me && me.id ? String(me.id) : null
    out.meta.user_name = me && me.name ? String(me.name) : null
    if (!out.meta.user_token_ok) out.meta.user_token_error = me && me.error ? { code: me.error.code, type: me.error.type, message: String(me.error.message || '').slice(0, 160) } : 'no-response'
  } else out.meta.user_token_ok = false
  if (APP_ID && APP_SECRET && USER_TOKEN) {
    const dbg = await fetch(`https://graph.facebook.com/v23.0/debug_token?input_token=${USER_TOKEN}&access_token=${APP_ID}|${APP_SECRET}`).then((r) => r.json()).catch(() => null)
    const d = dbg && dbg.data
    out.meta.user_token_debug = d ? { valid: d.is_valid, type: d.type, app_id: d.app_id, expires_at: d.expires_at ? new Date(d.expires_at * 1000).toISOString() : 'never', scopes: d.scopes || [] } : (dbg && dbg.error ? { error: String(dbg.error.message || '').slice(0, 160) } : 'no-response')
  }
  if (APP_ID && APP_SECRET) {
    const roles = await fetch(`https://graph.facebook.com/v23.0/${APP_ID}/roles?access_token=${APP_ID}|${APP_SECRET}`).then((r) => r.json()).catch(() => null)
    const data = (roles && roles.data) || []
    out.meta.app_roles = data.map((d) => ({ role: d.role, user: d.user }))
    out.meta.testers_present = data.some((d) => d.role === 'testers')
  }
  if (PAGE_TOKEN && S.META_PAGE_ID) {
    const posts = await fetch(`https://graph.facebook.com/v23.0/${S.META_PAGE_ID}/posts?limit=3&fields=id,created_time&access_token=${PAGE_TOKEN}`).then((r) => r.json()).catch(() => null)
    out.meta.page_posts = (posts && posts.data) || []
  }

  // corpus: last real customer messages (content only — sender masked, max 20)
  const ev = await api(SERVICE, 'GET', "/rest/v1/social_events?event_type=in.(message,comment)&order=received_at.desc&limit=40&select=content,event_type,platform")
  if (ev.status === 200 && Array.isArray(ev.j)) {
    out.corpus = ev.j
      .filter((r) => r.content && String(r.content).trim().length > 1)
      .slice(0, 20)
      .map((r) => ({ platform: r.platform, event_type: r.event_type, content: String(r.content).slice(0, 200) }))
  }

  fs.writeFileSync(path.join(__dirname, '_r74_omni_env.json'), JSON.stringify(out, null, 2))
  console.log('OMNI1_RECON: keys=' + out.env_keys['.env.local'].length + '+' + out.env_keys['supabase/secrets.local.env'].length +
    ' user_token_ok=' + out.meta.user_token_ok + ' testers=' + out.meta.testers_present + ' corpus=' + out.corpus.length)
  for (const [g, arr] of Object.entries(out.checks)) {
    console.log(' ' + g + ': ' + arr.map((x) => x.key + '=' + (x.present ? 'YES' : 'no')).join(' · '))
  }
})().catch((e) => { console.error('OMNI1_RECON_ERR', String(e.message || e).slice(0, 300)); process.exit(1) })