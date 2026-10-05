// G9 language cleanup audit - READ-ONLY mojibake/"alien text" scanner
const fs = require('fs'), path = require('path')
const ROOT = path.join(process.cwd(), 'src')
const results = []
const walk = (d) => {
  for (const f of fs.readdirSync(d)) {
    const p = path.join(d, f)
    const st = fs.statSync(p)
    if (st.isDirectory()) walk(p)
    else if (/\.(ts|tsx|json|html|css)$/.test(f)) {
      const text = fs.readFileSync(p, 'utf8')
      text.split('\n').forEach((line, i) => {
        // mojibake markers: UTF-8 Thai misdecoded as Latin-1 ("à¸ª..."), or common mojibake chars
        if (/[\u00C0-\u00FF]{2,}/.test(line) || /à¸|à¹/.test(line)) {
          results.push({ file: path.relative(process.cwd(), p), line: i + 1, text: line.trim().slice(0, 160) })
        }
      })
    }
  }
}
walk(ROOT)
console.log('TOTAL_OCCURRENCES=' + results.length)
const byFile = {}
for (const r of results) byFile[r.file] = (byFile[r.file] || 0) + 1
console.log(JSON.stringify(byFile, null, 1))
for (const r of results.slice(0, 60)) console.log(r.file + ':' + r.line + ': ' + r.text)