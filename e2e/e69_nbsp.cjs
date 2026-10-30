// e69: หา/ล้าง irregular whitespace (U+00A0 NBSP) ในไฟล์ที่แตะรอบนี้ — ALLOW = แก้เลย, ที่เหลือรายงาน
// ใช้เสร็จลบ
const fs = require('fs')
const path = require('path')
const ROOT = path.resolve(__dirname, '..')
const ALLOW_FIX = new Set([
  'src/lib/printService.ts',
  'src/lib/qzTray.ts',
  'src/lib/cartDeepLink.ts',
  'src/pages/admin/AdminPrintSettings.tsx',
  'src/components/layout/Layout.tsx',
  'src/__tests__/bmbSticker.test.ts',
  'src/__tests__/cartDeepLink.test.ts',
  'src/__tests__/qzTray.test.ts',
  'src/__tests__/socialAiContinuity.test.ts',
  'supabase/functions/_shared/shopContext.ts',
  'supabase/functions/_shared/socialOrderIntake.ts',
  'supabase/functions/social-ai-worker/index.ts',
])
const BAD = /[\u00A0\u2000-\u200B\u202F\u205F\u3000]/
function walk(dir, out = []) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    if (['node_modules', '.git', 'dist'].includes(e.name)) continue
    const p = path.join(dir, e.name)
    if (e.isDirectory()) walk(p, out)
    else if (/\.(ts|tsx)$/.test(e.name)) out.push(p)
  }
  return out
}
const files = [...walk(path.join(ROOT, 'src')), ...walk(path.join(ROOT, 'supabase'))]
let fixed = 0
for (const f of files) {
  const rel = path.relative(ROOT, f).replace(/\\/g, '/')
  const text = fs.readFileSync(f, 'utf8')
  if (!BAD.test(text)) continue
  const lines = text.split('\n')
  const hits = []
  lines.forEach((l, i) => { if (BAD.test(l)) hits.push(i + 1) })
  if (ALLOW_FIX.has(rel)) {
    const cleaned = text.replace(/[\u00A0\u2000-\u200B\u202F\u205F\u3000]/g, ' ')
    fs.writeFileSync(f, cleaned)
    console.log('FIXED ' + rel + ' lines=' + hits.join(','))
    fixed++
  } else {
    console.log('REPORT ' + rel + ' lines=' + hits.join(','))
  }
}
console.log('DONE fixed=' + fixed)