'use strict'
// R74-OMNI s7 — live probe: เรียก image-gen EF จริง (admin JWT) = ตรวจ ERR_FORBIDDEN หาย + เจนภาพได้จริง
const fs = require('fs')
const path = require('path')
const { S, ANON, SB, login } = require('./wave2Lib.cjs')
const LOG = path.join(__dirname, '_r74_imggen_live.log')
const out = (s) => { try { fs.appendFileSync(LOG, s + '\n') } catch {} ; console.log(s) }
fs.writeFileSync(LOG, 'IMGGEN_LIVE_START ' + new Date().toISOString() + '\n')
;(async () => {
  const admin = await login(S.BMB_TEST_ADMIN_EMAIL, S.BMB_TEST_ADMIN_PASSWORD)
  out('login: ' + admin.status)
  if (admin.status !== 200) return
  // 1) ยิงแบบที่หน้า AdminMarketing ยิง (kind/style/subject/note)
  const r = await fetch(SB + '/functions/v1/image-gen', {
    method: 'POST',
    headers: { apikey: ANON, Authorization: 'Bearer ' + admin.jwt, 'Content-Type': 'application/json' },
    body: JSON.stringify({ kind: 'promo', style: 'poster', subject: 'สุกี้แห้งหมู พร้อมน้ำซุปสตรอว์เบอร์รี', note: 'โปรโมชั่นพิเศษประจำสัปดาห์ (ทดสอบระบบ automation)' }),
  })
  const j = await r.json().catch(() => ({}))
  out('image-gen HTTP ' + r.status)
  out('body: ' + JSON.stringify(j).slice(0, 600))
  if (j && j.ok) {
    out('model=' + j.model + ' url=' + String(j.url).slice(0, 120))
    out('attempts=' + JSON.stringify(j.attempts).slice(0, 300))
  }
  out('IMGGEN_LIVE_DONE')
})().catch((e) => { out('FATAL ' + String(e).slice(0, 400)); process.exit(1) })