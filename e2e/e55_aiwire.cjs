// e55: social-ai-worker ถูกเรียกจากใคร + comment events ตารางอะไร + webhook FB มีไหม
const fs = require('fs')
const path = require('path')
const ROOT = 'D:\\A PROJECT\\Bite Me Baby'
const hits = []
const re = /social-ai-worker|comment_event|social_comment|comments.*webhook|webhook.*comment/i
const scanDir = (d, depth) => {
  if (depth > 6) return
  for (const e of fs.readdirSync(d, { withFileTypes: true })) {
    const p = path.join(d, e.name)
    if (e.isDirectory()) { if (!/node_modules|\.git/.test(p)) scanDir(p, depth + 1); continue }
    if (!/\.(ts|tsx|sql|yml|yaml)$/.test(e.name)) continue
    let lines
    try { lines = fs.readFileSync(p, 'utf8').split('\n') } catch { continue }
    lines.forEach((l, i) => {
      if (hits.length < 40 && re.test(l)) hits.push(path.relative(ROOT, p) + ':' + (i + 1) + ' | ' + l.trim().slice(0, 150))
    })
  }
}
scanDir(path.join(ROOT, 'supabase'), 0)
scanDir(path.join(ROOT, '.github'), 0)
scanDir(path.join(ROOT, 'src'), 0)
hits.forEach((h) => console.log(h))
console.log('HITS=' + hits.length)