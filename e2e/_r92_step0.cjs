// R92 STEP 0 (Owner plan 2026-11-11) — พิสูจน์ก่อนแก้ (READ-ONLY เท่านั้น ไม่มี write ใด ๆ)
// ① products: มีเมนูสะกดเพี้ยนจริงไหม (ภาพ 1-2: "เมี่ยง…", "ลากลุล…", "ซองวัน…" — เอไอคัดลอกตามแคตตาล็อกหรือโมเดลเขียนเองเพี้ยน)
// ② social_events ล่าสุด: reply ที่ไม่มี ?cart= เกิดจาก branch ไหน (matched=0 / unmatched>0 / อื่น)
// ใช้ Supabase Management API SQL (PAT .env.local) — SELECT เท่านั้น
'use strict'
const fs = require('fs')
const path = require('path')

const ROOT = path.resolve(__dirname, '..')
const PROJECT_REF = 'ivkdfognyiwjcmrhcnwz'
const env = {}
for (const f of ['.env.local', '.env']) {
  try {
    for (const l of fs.readFileSync(path.join(ROOT, f), 'utf8').split(/\r?\n/)) {
      const m = l.match(/^([A-Za-z0-9_]+)=(.*)$/)
      if (m && !(m[1] in env)) env[m[1]] = m[2].trim()
    }
  } catch { /* skip */ }
}
const TOKENS = [env.SUPABASE_ACCESS_TOKEN, env.bmb_PAT_SUPABASE_ACCESS_TOKEN].filter(Boolean)
if (TOKENS.length === 0) { console.log('NO_ACCESS_TOKEN'); process.exit(1) }

async function sql(query) {
  for (const tok of TOKENS) {
    const r = await fetch('https://api.supabase.com/v1/projects/' + PROJECT_REF + '/database/query', {
      method: 'POST',
      headers: { apikey: tok, Authorization: 'Bearer ' + tok, 'Content-Type': 'application/json' },
      body: JSON.stringify({ query }),
    })
    const text = await r.text()
    if (r.status === 200 || r.status === 201) return { ok: true, data: JSON.parse(text) }
    if (r.status === 401 || r.status === 403) continue
    return { ok: false, status: r.status, text: text.slice(0, 500) }
  }
  return { ok: false, status: 0, text: 'all tokens rejected' }
}

;(async () => {
  // ① แคตตาล็อกจริง — ชื่อทั้งหมด (ห้ามเกิน 300 ตาม query ของ worker)
  const prods = await sql("SELECT id, name, is_available FROM public.products WHERE archived = false ORDER BY created_at DESC LIMIT 300")
  console.log('PRODUCTS_COUNT ' + (prods.ok ? prods.data.length : JSON.stringify(prods)))
  if (prods.ok) {
    for (const p of prods.data) console.log('PRODUCT ' + p.id.slice(0, 8) + ' | ' + p.name + ' | avail=' + p.is_available)
    // ค้นคำเพี้ยนจากภาพ owner (เมี่ยงจา/ลากลุล/ซองวัน) แบบ fuzzy — มีในแคตตาล็อกจริงหรือไม่
    const suspects = ['เมี่ยง', 'ลากลุล', 'ซองวัน', 'ยำวัน', 'ลาบ']
    for (const s of suspects) {
      const hit = prods.data.filter((p) => p.name && p.name.includes(s))
      console.log('SUSPECT "' + s + '" -> ' + (hit.length ? hit.map((h) => h.name).join(' ; ') : 'NO_MATCH_IN_CATALOG'))
    }
  }

  // ② reply จริงเก็บที่ตารางไหน — หาจากชื่อคอลัมน์ก่อน
  const replyTables = await sql("SELECT table_name, column_name FROM information_schema.columns WHERE table_schema='public' AND column_name IN ('ai_reply_text','reply_draft','draft_text') ORDER BY table_name")
  console.log('REPLY_TABLES ' + (replyTables.ok ? JSON.stringify(replyTables.data) : JSON.stringify(replyTables)))

  // ③ social_events ล่าสุด (raw event — โครงคอลัมน์จริงจาก information_schema)
  const cols = await sql("SELECT column_name FROM information_schema.columns WHERE table_schema='public' AND table_name='social_events' ORDER BY ordinal_position")
  console.log('SOCIAL_EVENTS_COLS ' + (cols.ok ? cols.data.map((c) => c.column_name).join(',') : JSON.stringify(cols)))
  const evs = await sql("SELECT event_id, platform, event_type, LEFT(COALESCE(content,''),120) AS msg_head, status, ai_model, reply_status, LEFT(COALESCE(ai_reply_text,''),500) AS reply_head, received_at FROM public.social_events ORDER BY received_at DESC LIMIT 15")
  if (evs.ok) {
    for (const e of evs.data) {
      const reply = String(e.reply_head || '').replace(/\s+/g, ' ')
      console.log('EV ' + e.received_at + ' | ' + e.platform + '/' + e.event_type + ' | ' + e.status + ' | model=' + (e.ai_model || '-') + ' | reply_status=' + (e.reply_status || '-'))
      console.log('   MSG: ' + String(e.msg_head || '').replace(/\s+/g, ' '))
      console.log('   REPLY: ' + reply)
      console.log('   HAS_CART_LINK=' + /cart=/.test(reply) + ' | HAS_HTTPS=' + /https:\/\//.test(reply))
    }
  } else {
    console.log('EV_ERR ' + JSON.stringify(evs))
  }
  console.log('R92_STEP0_DONE')
})().catch((e) => { console.error('ERR', e.message); process.exit(1) })
