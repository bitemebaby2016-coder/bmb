// ONE-TIME fix: บล็อก R82 ใน docs/BMB_PRODUCTION_TEST_PACK.md ถูกแทรกซ้ำ 2 ครั้ง
// (เกิดจากคำสั่ง editor ถูกส่งซ้ำระหว่าง batch error) → เอา copy ที่ 2 ออก
// วิธี = slice บน string จับตำแหน่ง header ซ้ำตัวที่ 2 จนถึงหัวข้อ R81 (ไม่แตะ copy แรก)
// Usage: node e2e/_r82_dedupe_pack.cjs   (idempotent — เจอครั้งเดียว = ไม่ทำอะไร)
'use strict'
const fs = require('fs')
const path = require('path')

const TARGET = path.resolve(__dirname, '..', 'docs', 'BMB_PRODUCTION_TEST_PACK.md')
const H82 = '> ## 🔧 R82 — แก้แล้ว 2026-11-08'
const H81 = '> ## 🔧 R81 — แก้แล้ว 2026-11-08'

const text = fs.readFileSync(TARGET, 'utf8')
const i1 = text.indexOf(H82)
if (i1 < 0) { console.error('NOT_FOUND: R82 header — ไฟล์ไม่มีบล็อกที่จะตรวจ'); process.exit(1) }
const i2 = text.indexOf(H82, i1 + 1)
if (i2 < 0) { console.log('ALREADY_UNIQUE — ไม่มีอะไรต้องทำ (copy เดียว)'); process.exit(0) }
const i81 = text.indexOf(H81, i2)
if (i81 < 0) { console.error('ABORT: หาหัวข้อ R81 หลัง copy ที่ 2 ไม่เจอ — ห้ามเดา'); process.exit(1) }

const cleaned = text.slice(0, i2) + text.slice(i81)
// กันพลาดซ้ำ: หลังแก้ต้องเหลือ header R82 = 1 และ R81 = 1
const c82 = cleaned.split(H82).length - 1
const c81 = cleaned.split(H81).length - 1
if (c82 !== 1 || c81 !== 1) { console.error('ABORT: after-count R82=' + c82 + ' R81=' + c81); process.exit(1) }
fs.writeFileSync(TARGET, cleaned)
console.log('DEDUP_OK — เอาออก ' + (i81 - i2) + ' ตัวอักษร · เหลือ R82 x' + c82 + ' R81 x' + c81)