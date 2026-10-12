#!/usr/bin/env node
// ============================================
// brandNameGuard — สแกนทั้ง repo ห้ามมีชื่อแบรนด์/มาสคอตผิด
// ============================================
// รันอัตโนมัติทุกครั้งผ่าน `npm run lint` (ซึ่ง CI เรียกทุก push)
// ⇒ เป็นไปไม่ได้ที่ชื่อผิดจะหลุดเข้ามาอีกโดยไม่มีใครสังเกต
//
// ทำไมถึงแยกออกจาก vitest: โปรเจกต์นี้ไม่ได้ติด @types/node
// จึง import node:fs ในไฟล์ test ไม่ได้
//
// exit 0 = ผ่าน · exit 1 = พบชื่อผิด (CI จะตก)
// ============================================
'use strict'
const fs = require('fs')
const path = require('path')

const ROOT = path.resolve(__dirname, '..')

/** ไฟล์เดียวที่อนุญาตให้มีชื่อผิด — มันคือลิสต์ห้ามใช้นั่นเอง */
const ALLOWED = new Set([
  'src/lib/brandName.ts',
  'supabase/functions/_shared/brandName.ts',
  'src/__tests__/brandName.test.ts',
  'scripts/brandNameGuard.cjs',
])

/**
 * ⚠️ ห้ามแก้รายการนี้โดยไม่คุยกับ Owner
 * คัดเฉพาะชื่อที่ "ไม่ชน" กับคำไทยปกติ:
 *   ห้ามใส่ 'บิต' (⊂ เครดิต/เดบิต) · 'บับ' (⊂ บับเบิล) · 'บิด' · 'บีท'
 * ต้องตรงกับ BANNED_MASCOT_NAMES ใน src/lib/brandName.ts
 */
const BANNED = [
  'บั๊บ', 'บัป', 'บัพ',
  'บิท',
  'ไบท', 'ไบท์', 'ไบท๊', 'ไบด์', 'ไบช์',
  'ไบ๊ท์', 'ไบ๊ท', 'ไบ๊ด์',
]

const SKIP_DIRS = new Set(['node_modules', 'dist', '.git', 'screenshots', 'archive'])

function walk(dir, out = []) {
  let entries
  try { entries = fs.readdirSync(dir, { withFileTypes: true }) } catch { return out }
  for (const e of entries) {
    const p = path.join(dir, e.name)
    if (e.isDirectory()) { if (!SKIP_DIRS.has(e.name)) walk(p, out); continue }
    if (!/\.(ts|tsx)$/.test(e.name)) continue
    out.push(p)
  }
  return out
}

function main() {
  const files = [
    ...walk(path.join(ROOT, 'src')),
    ...walk(path.join(ROOT, 'supabase')),
  ]
  if (files.length < 100) {
    console.error('brandNameGuard: FAIL — สแกนเจอไฟล์น้อยผิดปกติ (' + files.length + ') อาจหา path ผิด')
    process.exit(1)
  }

  const offenders = []
  for (const f of files) {
    const rel = path.relative(ROOT, f).split(path.sep).join('/')
    if (ALLOWED.has(rel)) continue
    const lines = fs.readFileSync(f, 'utf8').split(/\r?\n/)
    lines.forEach((line, i) => {
      for (const bad of BANNED) {
        if (line.includes(bad)) {
          offenders.push(`${rel}:${i + 1} [${bad}] ${line.trim().slice(0, 100)}`)
          break
        }
      }
    })
  }

  if (offenders.length) {
    console.error('brandNameGuard: FAIL — พบชื่อแบรนด์/มาสคอตที่ผิดกฎ')
    console.error('ต้องแก้เป็น "ไบ๊" / "ไบ๊มีเบบี้" ทั้งหมด:')
    offenders.forEach((o) => console.error('  ' + o))
    process.exit(1)
  }
  console.log('brandNameGuard: OK — สแกน ' + files.length + ' ไฟล์ ไม่พบชื่อผิด')
}

main()
