'use strict'
// PHASE 8 (C-4): ยืนยัน runtime-bound tests ทั้งหมดอยู่ใน test pack (ห้ามตัดข้อทิ้ง)
const fs = require('fs')
const path = require('path')
const pack = fs.readFileSync(path.join(process.cwd(), 'docs', 'BMB_PRODUCTION_TEST_PACK.md'), 'utf8')
const ids = ['T-A1', 'T-A2', 'T-A3', 'T-A4', 'T-A5', 'T-A6', 'T-D1', 'T-D2', 'T-D3', 'T-D4', 'T-E1', 'T-E2', 'CAP-10', 'CAP-11', 'CAP-13', 'CAP-14']
const out = ids.map((id) => ({ id, present: pack.includes(id) }))
const missing = out.filter((r) => !r.present).map((r) => r.id)
// เนื้อหาอาจมีภายใต้คำไทย/อังกฤษแทน label CAP — ตรวจนโยมด้วย
const keywords = ['สลิป', 'POD', 'push', 'SMS', 'การแจ้งเตือน', 'ตรวจสลิป']
const kw = keywords.map((k) => ({ k, count: pack.split(k).length - 1 }))
console.log(JSON.stringify({ checked: out.length, present: out.length - missing.length, missing, keywords: kw }, null, 2))
fs.writeFileSync(
  path.join(process.cwd(), 'e2e', 'r63PackC4-check.json'),
  JSON.stringify({ checked: out.length, present: out.length - missing.length, missing, keywords: kw, at: new Date().toISOString() }, null, 2),
)