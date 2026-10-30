// e54: recon AI ตอบคอมเม้น — EF ที่มี · endpoint ที่ TalkToBite/AI Studio เรียก · token Meta · comment/reply เดิม
const fs = require('fs')
const path = require('path')
const ROOT = 'D:\\A PROJECT\\Bite Me Baby'
console.log('== FUNCTIONS ==')
console.log(fs.readdirSync(path.join(ROOT, 'supabase/functions')).join(' | '))
console.log('== AI CALLS (src) ==')
const re = /functions\/v1\/[a-z0-9-]+|generateCaption|aiStudio|aiChat|talktobite|\/ai\b/i
const hit = []
const walk = (d) => {
  for (const e of fs.readdirSync(d, { withFileTypes: true })) {
    const p = path.join(d, e.name)
    if (e.isDirectory()) { if (!/node_modules|\.git/.test(p)) walk(p); continue }
    if (!/\.tsx?$/.test(e.name)) continue
    const lines = fs.readFileSync(p, 'utf8').split('\n')
    lines.forEach((l, i) => { if (hit.length < 25 && re.test(l)) hit.push(path.relative(ROOT, p) + ':' + (i + 1) + ' | ' + l.trim().slice(0, 140)) })
  }
}
walk(path.join(ROOT, 'src'))
hit.forEach((h) => console.log(h))
console.log('== META/COMMENTS in EFs ==')
const efDir = path.join(ROOT, 'supabase/functions')
for (const d of fs.readdirSync(efDir)) {
  const f = path.join(efDir, d, 'index.ts')
  if (!fs.existsSync(f)) continue
  const lines = fs.readFileSync(f, 'utf8').split('\n')
  lines.forEach((l, i) => {
    if (/Deno\.env\.get\(|graph\.facebook|\/comments|comment_id|repl/i.test(l)) console.log(d + ':' + (i + 1) + ' | ' + l.trim().slice(0, 140))
  })
}