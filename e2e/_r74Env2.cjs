// R74-2 temp — ตรวจ .env.local ใหม่: key ครบทุกตัว (ไม่พิมพ์ค่า) + เทส auth ด้วย parse ที่ถูกต้อง
'use strict'
const fs = require('fs')
const path = require('path')
const ROOT = path.resolve(__dirname, '..')
const raw = fs.readFileSync(path.join(ROOT, '.env.local'), 'utf8')

// parse แบบรัดกุม: key=VALUE · รองรับ "ค่าที่มีช่องว่าง" หรือ '...' หรือดิบ · strip quotes+trim
const map = new Map()
const fmt = new Map()
const dup = new Map()
for (const [i, line] of raw.split(/\r?\n/).entries()) {
  const m = /^([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/.exec(line)
  if (!m) continue
  let v = m[2].trim()
  const rawQuoted = /^["']/.test(v) ? 'RAW_QUOTED' : ''
  if ((v.startsWith('"') && v.endsWith('"') && v.length >= 2) || (v.startsWith("'") && v.endsWith("'") && v.length >= 2)) {
    v = v.slice(1, -1).trim()
  }
  if (!dup.has(m[1])) dup.set(m[1], [])
  dup.get(m[1]).push({ line: i + 1, len: v.length })
  map.set(m[1], v)
  fmt.set(m[1], rawQuoted)
}
console.log('total_keys=' + map.size)
console.log('ALL_KEYS: ' + [...map.keys()].join(' | '))
// 1c) key จากไฟล์ env อื่น ๆ (ชื่ออย่างเดียว — ไม่แตะค่า)
for (const f of ['.env', 'supabase/secrets.local.env']) {
  try {
    const txt = fs.readFileSync(path.join(ROOT, f), 'utf8')
    const names = []
    for (const line of txt.split(/\r?\n/)) {
      const m = /^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=/.exec(line)
      if (m) names.push(m[1])
    }
    console.log('FILE ' + f + ' keys(' + names.length + '): ' + [...new Set(names)].join(' | '))
  } catch (e) { console.log('FILE ' + f + ' → ' + String(e && e.message).slice(0, 60)) }
}
for (const [k, arr] of dup) {
  if (arr.length > 1) console.log('DUP ' + k + ' → ' + JSON.stringify(arr))
}
// 1b) โครงสร้างบรรทัดจริงแบบ mask (ไม่พิมพ์ค่ากลาง): key อะไร · บรรทัดที่เท่าไร · มีช่องว่าง/#/เครื่องหมายคำพูดในค่าไหม
for (const [i, line] of raw.split(/\r?\n/).entries()) {
  if (!/TOKEN|SECRET|API_KEY|PAT\b/i.test(line)) continue
  const m = /^([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/.exec(line)
  if (!m) continue
  const v = m[2]
  const flags = []
  if (/\s/.test(v.trim())) flags.push('HAS_SPACE_INSIDE')
  if (/#/.test(v)) flags.push('HAS_HASH')
  if (/["']/.test(v.trim())) flags.push('HAS_QUOTE')
  if (v !== v.trim()) flags.push('LEAD_OR_TRAIL_WS')
  const mask = v.trim().slice(0, 5) + '…' + v.trim().slice(-5)
  console.log('L' + (i + 1) + ' ' + m[1] + ' rawlen=' + v.length + ' masked=' + mask + ' ' + flags.join(','))
}
// 1) รายชื่อ key ทั้งหมดที่เกี่ยวกับ token/secret/meta/graph/line/ship (ชื่ออย่างเดียว)
const interesting = [...map.keys()].filter((k) => /TOKEN|SECRET|META|GRAPH|LINE|THSMS|SHIP|FLASH|DHL|KERRY|APP_ID|WEBHOOK|API_KEY|PAT\b/i.test(k))
for (const k of interesting) {
  const v = map.get(k) || ''
  console.log('KEY ' + k + ' len=' + v.length + ' ' + (fmt.get(k) || ''))
}

// 1d) char-level inspection เฉพาะ 2 ตัวที่ fail (ไม่พิมพ์ค่ากลาง — เฉพาะรหัสอักขระที่ผิดปกติ)
for (const k of ['SUPABASE_ACCESS_TOKEN', 'META_USER_ACCESS_TOKEN', 'META_PAGE_ACCESS_TOKEN']) {
  const v = map.get(k) || ''
  const bad = []
  for (let i = 0; i < v.length; i++) {
    const c = v.charCodeAt(i)
    const ok = (c >= 48 && c <= 57) || (c >= 65 && c <= 90) || (c >= 97 && c <= 122) || c === 45 || c === 95 || c === 46 // 0-9 A-Z a-z - _ .
    if (!ok) bad.push(i + ':' + c)
  }
  console.log('CHARS ' + k + ' len=' + v.length + ' nonStd=' + (bad.length ? bad.join(',') : 'NONE') + ' head3=' + v.slice(0, 3) + ' tail3=' + v.slice(-3))
}
;(async () => {
  const test = async (name, fn) => {
    try {
      const r = await fn()
      console.log('AUTH ' + name + ' → ' + r)
    } catch (e) { console.log('AUTH ' + name + ' → EX ' + String(e && e.message).slice(0, 80)) }
  }
  await test('SUPABASE_ACCESS_TOKEN(/v1/projects)', async () => {
    const r = await fetch('https://api.supabase.com/v1/projects', { headers: { Authorization: 'Bearer ' + map.get('SUPABASE_ACCESS_TOKEN') } })
    const t = await r.text()
    return r.status + ' ' + t.slice(0, 60).replace(/\s+/g, ' ')
  })
  await test('META_USER_ACCESS_TOKEN(/me)', async () => {
    const r = await fetch('https://graph.facebook.com/v19.0/me?access_token=' + encodeURIComponent(map.get('META_USER_ACCESS_TOKEN') || ''))
    const t = await r.text()
    return r.status + ' ' + t.slice(0, 90).replace(/\s+/g, ' ')
  })
  await test('META_USER_ACCESS_TOKEN(/PAGE_ID)', async () => {
    const r = await fetch('https://graph.facebook.com/v19.0/' + (map.get('META_PAGE_ID') || '') + '?fields=id,name&access_token=' + encodeURIComponent(map.get('META_USER_ACCESS_TOKEN') || ''))
    const t = await r.text()
    return r.status + ' ' + t.slice(0, 90).replace(/\s+/g, ' ')
  })
  await test('META_PAGE_ACCESS_TOKEN(/me)', async () => {
    const r = await fetch('https://graph.facebook.com/v19.0/me?access_token=' + encodeURIComponent(map.get('META_PAGE_ACCESS_TOKEN') || ''))
    const t = await r.text()
    return r.status + ' ' + t.slice(0, 90).replace(/\s+/g, ' ')
  })
})()
module.exports = { map }