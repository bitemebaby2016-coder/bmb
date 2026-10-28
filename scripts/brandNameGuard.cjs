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
// ============================================
// R12 (Owner 2026-10-28): ภาษาห้ามมี "ต่างดาว/จาก UTF-8 BOM"
// ติดตามการสแกนภาษาแบบเดียวกับแบรนด์ — ไฟล์ active เท่านั้น
// (docs/archive = เอกสารยุคเก่า/หลาย encoding จงใจไม่สแกน)
// Allowlist: HANDOFF_002_SCHEMA.md = เอกสาร legacy เก็บ encoding เดิมไว้ตั้งใจ
// ============================================
const ALIEN_LANG_EXT = /\.(ts|tsx|js|cjs|mjs|md|sql|json)$/
const LANGUAGE_SKIP_DIRS = new Set(['node_modules', 'dist', '.git', 'coverage', 'screenshots', 'archive'])
const LANGUAGE_ALLOW_NON_UTF8 = new Set(['supabase/migrations/HANDOFF_002_SCHEMA.md'])

// ชนชุดอื่นที่หลุดมา (ไม่นับไทย 0E00-0E7F / ละติน / กรีกที่ใช้คณิต เช่น Σ)
const ALIEN_RANGES = [
  [0x3400, 0x4dbf], [0x4e00, 0x9fff], // CJK
  [0x0400, 0x04ff], // Cyrillic
  [0x0590, 0x05ff], // Hebrew
  [0x0600, 0x06ff], // Arabic
  [0x0900, 0x097f], // Devanagari
  [0x0530, 0x058f], // Armenian
]
function alienSet(s) {
  const set = new Set()
  for (const ch of String(s)) {
    const c = ch.codePointAt(0)
    for (const [a, b] of ALIEN_RANGES) {
      if (c >= a && c <= b) { set.add(ch); break }
    }
  }
  return [...set]
}

function walkAll(dir, out = []) {
  let entries
  try { entries = fs.readdirSync(dir, { withFileTypes: true }) } catch { return out }
  for (const e of entries) {
    const p = path.join(dir, e.name)
    if (e.isDirectory()) { if (!LANGUAGE_SKIP_DIRS.has(e.name)) walkAll(p, out); continue }
    if (!ALIEN_LANG_EXT.test(e.name)) continue
    out.push(p)
  }
  return out
}

function languageCheck() {
  const files = [
    ...walkAll(path.join(ROOT, 'src')),
    ...walkAll(path.join(ROOT, 'supabase')),
    ...walkAll(path.join(ROOT, 'e2e')),
    ...walkAll(path.join(ROOT, 'scripts')),
    ...walkAll(path.join(ROOT, 'docs')),
  ]
  const bad = []
  for (const f of files) {
    const rel = path.relative(ROOT, f).split(path.sep).join('/')
    const buf = fs.readFileSync(f)
    const hasBom = buf.length >= 3 && buf[0] === 0xef && buf[1] === 0xbb && buf[2] === 0xbf
    if (hasBom) { bad.push(rel + ' (UTF-8 BOM)'); continue }
    if (LANGUAGE_ALLOW_NON_UTF8.has(rel)) continue
    const txt = buf.toString('utf8')
    if (!buf.equals(Buffer.from(txt, 'utf8'))) { bad.push(rel + ' (non-UTF8)'); continue }
    if (txt.includes('\uFFFD')) { bad.push(rel + ' (U+FFFD)'); continue }
    txt.split(/\r?\n/).forEach((l, i) => {
      const s = alienSet(l)
      if (s.length) bad.push(`${rel}:${i + 1} (${s.join('')}) ${l.trim().slice(0, 80)}`)
    })
  }
  return { files, bad }
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

  // ---- R12 (Owner 2026-10-28): ภาษาไทย/อังกฤษห้ามมี BOM / U+FFFD / ต่างดาว ----
  const lang = languageCheck()
  if (lang.bad.length) {
    console.error('languageSanity: FAIL — พบ BOM / U+FFFD / ตัวอักษรชุดอื่น (' + lang.bad.length + ' จุด)')
    lang.bad.forEach((o) => console.error('  ' + o))
    process.exit(1)
  }
  console.log('languageSanity: OK — สแกน ' + lang.files.length + ' ไฟล์ ไม่พบ BOM / ต่างดาว')
}

main()
