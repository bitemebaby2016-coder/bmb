// temp: fix 2 failing tests per Owner-newest-directive (DELETE at session end)
// 1) adminNavFeedback: Layout deps ตอนนี้ pathname+search (L-3)
// 2) canonicalFallbackContract INV-18 VotePage: L-5 Owner 2026-10-26 = กรองแค่ archived
const fs = require('fs')
const path = require('path')
const ROOT = 'D:/A PROJECT/Bite Me Baby'
let bad = 0
function load(f) { return fs.readFileSync(path.join(ROOT, f), 'utf8').split(/\r?\n/) }
function save(f, lines) { fs.writeFileSync(path.join(ROOT, f), lines.join('\n')) }

// --- 1) adminNavFeedback.test.ts ---
{
  const f = 'src/__tests__/adminNavFeedback.test.ts'
  const lines = load(f)
  let n = 0
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].includes('}, [location.pathname])')) {
      lines[i] = lines[i].replace('}, [location.pathname])', '}, [location.pathname, location.search])')
      n++
    }
  }
  if (n < 1) {
    const joined = lines.join('\n')
    if (joined.includes('}, [location.pathname, location.search])')) {
      console.log('adminNavFeedback: already updated (idempotent ok)')
    } else { console.log('FAIL adminNavFeedback: needle not found'); bad++ }
  }
  else { save(f, lines); console.log('adminNavFeedback: replaced', n, 'deps assertion(s)') }
}

// --- 2) canonicalFallbackContract.test.ts (INV-18 VotePage only) ---
{
  const f = 'src/__tests__/canonicalFallbackContract.test.ts'
  const lines = load(f)
  const ti = lines.findIndex((l) => l.includes('VotePage.tsx: poll options'))
  if (ti < 0) { console.log('FAIL canonicalFallback: VotePage it-title not found'); bad++ }
  else {
    lines[ti] = lines[ti].replace(
      'กรองด้วย canonical fallback — ไม่ใช่ filter raw alias',
      'กรองเฉพาะ archived — ครบทุกเมนู (Owner L-5 2026-10-26 แทน fallback)',
    )
    let n = 0
    for (let j = ti + 1; j < lines.length && j < ti + 60; j++) {
      if (lines[j].includes('available_preorder ??')) {
        lines[j] = lines[j].replace(/p\.available_preorder \?\? p\.is_preorder/g, '!p.archived')
        n++
        break
      }
    }
    if (n < 1) { console.log('FAIL canonicalFallback: needle after title not found'); bad++ }
    else { save(f, lines); console.log('canonicalFallback: VotePage expect -> !p.archived') }
  }
}
console.log(bad === 0 ? 'INV_FIX_OK' : 'INV_FIX_BAD ' + bad)
process.exitCode = bad ? 1 : 0
