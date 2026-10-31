// R42 — สแกน "ภาษาเพี้ยน" ทั้งโปรเจกต์: U+FFFD / mojibake (????) / คำผิดที่รู้จริง
// findstr บอดกับ UTF-8 → node อ่าน utf8 เอง · skip ตัวเอง + UTF-16 (อ่านเป็น FFFD ปลอม) + archive (ประวัติ ไม่แก้)
const fs = require('fs')
const path = require('path')
const ROOT = path.resolve(__dirname, '..')
const SELF = __filename
const SKIP_FILES = new Set(['g9CheckLine.cjs']) // มี ? รันจงใจ (pattern ทดสอบเอง)
const exts = new Set(['.ts', '.tsx', '.md', '.sql', '.cjs', '.toml', '.yml', '.css'])
const skipDirs = new Set(['node_modules', 'dist', 'build', 'backups', 'lighthouse', '.git', 'artifacts', 'archive'])
let files = 0
let hits = 0
const walk = (dir) => {
  for (const name of fs.readdirSync(dir)) {
    if (skipDirs.has(name)) continue
    const p = path.join(dir, name)
    let st
    try { st = fs.statSync(p) } catch { continue }
    if (st.isDirectory()) { walk(p); continue }
    if (!exts.has(path.extname(name))) continue
    if (path.resolve(p) === path.resolve(SELF)) continue // ไม่สแกนตัวเอง (pattern มีคำผิดเจตนา)
    if (SKIP_FILES.has(name)) continue
    let raw
    try { raw = fs.readFileSync(p) } catch { continue }
    if (raw.includes(0)) continue // UTF-16/ไบนารี = อ่าน utf8 แล้ว FFFD ปลอม → ข้าม
    files++
    const lines = raw.toString('utf8').split('\n')
    lines.forEach((l, i) => {
      const problems = []
      if (l.includes('\uFFFD')) problems.push('U+FFFD')
      if (/\?{4,}/.test(l)) problems.push('mojibake????')
      if (l.includes('ทะเบิน')) problems.push('typo:ทะเบิน')
      if (l.includes('เอAI')) problems.push('typo:เอAI')
      if (problems.length) {
        hits++
        console.log(`${path.relative(ROOT, p)}:${i + 1} [${problems.join(',')}] ${l.trim().slice(0, 120)}`)
      }
    })
  }
}
walk(ROOT)
console.log(`SCAN_DONE files=${files} hits=${hits} (archive/UTF-16/ตัวเอง = ข้าม)`)