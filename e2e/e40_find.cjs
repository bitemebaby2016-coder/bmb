// e40: หาตำแหน่งจริงของ สถานะหน้าแรก / หน้าล็อกอิน / เอไอตอบคอมเม้น (ไม่เดา)
const fs = require('fs')
const path = require('path')
const ROOT = 'D:\\A PROJECT\\Bite Me Baby'
const SCAN = ['src', 'supabase/functions']
const PATS = [
  ['STATUS', /เปิดรับออเดอร์|Same-Day|รอบส่ง|Pre-Order|ปิดรับ/],
  ['LOGIN', /signInWithPassword|signInWithOAuth|ล็อกอิน|เข้าสู่ระบบ|useAuth|onAuthStateChange/],
  ['AIREPLY', /auto.?reply|aiReply|comment_reply|ตอบคอมเม้น|ตอบความเห็น|เอ.?ไอตอบ|replyToComment/i],
]
const out = { STATUS: [], LOGIN: [], AIREPLY: [] }
const walk = (d) => {
  for (const e of fs.readdirSync(d, { withFileTypes: true })) {
    const p = path.join(d, e.name)
    if (e.isDirectory()) { if (!/node_modules|\.git/.test(p)) walk(p); continue }
    if (!/\.tsx?$/.test(e.name)) continue
    let t
    try { t = fs.readFileSync(p, 'utf8') } catch { continue }
    const lines = t.split(/\r?\n/)
    lines.forEach((ln, i) => {
      for (const [k, re] of PATS) {
        if (out[k].length < 40 && re.test(ln)) out[k].push(path.relative(ROOT, p) + ':' + (i + 1) + ' | ' + ln.trim().slice(0, 150))
      }
    })
  }
}
for (const d of SCAN) if (fs.existsSync(path.join(ROOT, d))) walk(path.join(ROOT, d))
for (const k of Object.keys(out)) { console.log('== ' + k + ' (' + out[k].length + ') =='); out[k].forEach((x) => console.log(x)) }