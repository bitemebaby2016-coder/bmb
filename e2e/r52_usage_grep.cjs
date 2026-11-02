// R52 — เก็บข้อมูลจริง: MascotBadge ใน MenuPage · นับ pose= ทั้ง src · css rules · showToast
const fs = require('fs')
const path = require('path')
const ROOT = path.resolve(__dirname, '..')
function walk(dir, out = []) {
  let entries
  try { entries = fs.readdirSync(dir, { withFileTypes: true }) } catch { return out }
  for (const e of entries) {
    if (['node_modules', 'dist', 'archive'].includes(e.name)) continue
    const p = path.join(dir, e.name)
    if (e.isDirectory()) walk(p, out)
    else if (/\.(ts|tsx|css)$/.test(e.name)) out.push(p)
  }
  return out
}
// (a) MenuPage MascotBadge lines
const mp = fs.readFileSync(path.join(ROOT, 'src/pages/MenuPage.tsx'), 'utf8').split(/\r?\n/)
mp.forEach((l, i) => { if (l.includes('MascotBadge')) console.log('MenuPage:' + (i + 1) + ': ' + l.trim()) })
// (b) pose=" counts
const counts = {}
for (const f of walk(path.join(ROOT, 'src'))) {
  const s = fs.readFileSync(f, 'utf8')
  for (const m of s.matchAll(/pose="([a-z_]+)"/g)) counts[m[1]] = (counts[m[1]] || 0) + 1
}
console.log('POSE_COUNTS ' + JSON.stringify(counts))
// (c) css rules of interest
const css = fs.readFileSync(path.join(ROOT, 'src/index.css'), 'utf8').split(/\r?\n/)
css.forEach((l, i) => {
  if (/review-float-logo\s*\{|animate-float\s*\{|--animate-float|@keyframes\s+float\b|section-float-mascot\s*\{|mascotWobble|mascot-badge\s*\{/.test(l)) {
    console.log('css:' + (i + 1) + ': ' + l.trim())
  }
})
// (d) showToast export
const tc = fs.readFileSync(path.join(ROOT, 'src/components/ui/ToastContainer.tsx'), 'utf8')
console.log('showToast export: ' + /export\s+(function|const)\s+showToast/.test(tc))
// (e) HomePage / ReviewPage imports MascotBadge?
for (const rel of ['src/pages/HomePage.tsx', 'src/pages/ReviewPage.tsx']) {
  const s = fs.readFileSync(path.join(ROOT, rel), 'utf8')
  console.log(rel + ' imports MascotBadge: ' + s.includes("from '@/components/MascotBadge'"))
}
// (f) review-float-logo full rule (3 lines around)
css.forEach((l, i) => {
  if (/\.review-float-logo\s*\{/.test(l)) {
    console.log('RULE ' + css.slice(i, i + 6).join('\n'))
  }
})