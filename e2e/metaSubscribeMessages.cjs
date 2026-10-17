'use strict'
// metaSubscribeMessages — สมัคร webhook fields ของ Page ให้ครบถ้วน (แก้ปัญหา "ทัก Messenger แล้ว AI ไม่ตอบ")
//
// เหตุผลที่ต้องรัน: probe จริง 17 ต.ค. พบว่า social_events ไม่มี event แบบ message เข้ามาเลยตั้งแต่ 6 ต.ค.
// (comment เข้าปกติ = webhook ตายังใช้ได้ แต่ field "messages" ไม่ได้ subscribe)
//
// วิธีใช้:
//   1) ใส่ META_PAGE_ACCESS_TOKEN (page access token ของเพจ BITE ME BABY) ใน .env.local หรือ env
//   2) node e2e/metaSubscribeMessages.cjs
//   3) ทัก Messenger เข้าเพจอีกรอบ แล้วเช็ค social_events — ควรมีแถว platform=MESSENGER event_type=message
//
// (ถ้าทำใน Meta App Dashboard: App → Webhooks → Page → Subscribe fields: messages, messaging_postbacks, feed)
const fs = require('fs')
const path = require('path')
const ROOT = path.resolve(__dirname, '..')

function readToken() {
  if (process.env.META_PAGE_ACCESS_TOKEN) return process.env.META_PAGE_ACCESS_TOKEN.trim()
  const envPath = path.join(ROOT, '.env.local')
  if (!fs.existsSync(envPath)) return ''
  for (const l of fs.readFileSync(envPath, 'utf8').split(/\r?\n/)) {
    const m = l.match(/^\s*META_PAGE_ACCESS_TOKEN\s*=\s*(.*)\s*$/)
    if (m && !l.trim().startsWith('#') && m[1]) return m[1].trim().replace(/^["']|["']$/g, '')
  }
  return ''
}

// Page id จริงของเพจหลัก (จาก social_events.page_id ที่ probe เจอ)
const PAGE_ID = process.env.META_PAGE_ID || '862940416913026'
const FIELDS = 'messages,messaging_postbacks,messaging_optins,messaging_referrals,feed,messages_postbacks'

async function graph(path, params) {
  const url = new URL('https://graph.facebook.com/v21.0/' + path)
  for (const [k, v] of Object.entries(params || {})) url.searchParams.set(k, v)
  const r = await fetch(url, { method: params ? 'POST' : 'GET' })
  return { status: r.status, body: await r.json().catch(() => ({})) }
}

;(async () => {
  const token = readToken()
  if (!token) { console.error('NO_TOKEN: ใส่ META_PAGE_ACCESS_TOKEN ใน .env.local ก่อน'); process.exit(1) }

  // 1) สมัคร app เข้ากับเพจ พร้อม fields ที่ต้องรับ
  const sub = await graph(PAGE_ID + '/subscribed_apps', { subscribed_fields: FIELDS, access_token: token })
  console.log('SUBSCRIBE', sub.status, JSON.stringify(sub.body))

  // 2) ตรวจผล
  const check = await graph(PAGE_ID + '/subscribed_apps', { access_token: token })
  console.log('CHECK', check.status, JSON.stringify(check.body))
  console.log('ถ้า CHECK แสดง fields ครบ (มี messages) → ทัก Messenger ทดสอบได้เลย')
})().catch((e) => { console.error('META_SUB_ERR', String(e.message || e).slice(0, 400)); process.exit(1) })