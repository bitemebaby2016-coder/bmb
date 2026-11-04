'use strict'
// tmp_mountscan — who renders <TalkToBite / calls createRoot / mounts outside Router
const fs = require('fs')
const path = require('path')
function walk(d) {
  for (const f of fs.readdirSync(d, { withFileTypes: true })) {
    const fp = path.join(d, f.name)
    if (f.isDirectory()) {
      if (!['node_modules', 'dist', '.git'].includes(f.name)) walk(fp)
      continue
    }
    if (!/\.(tsx?|html)$/.test(f.name)) continue
    const t = fs.readFileSync(fp, 'utf8')
    const cr = t.split('createRoot').length - 1
    const tag = t.split('<TalkToBite').length - 1
    const imp = /from ['"].*\/ai\/TalkToBite['"]/.test(t) || /import\(['"].*\/ai\/TalkToBite['"]\)/.test(t)
    if (cr || tag || imp) {
      console.log(fp.split(path.sep).join('/'), 'createRoot=' + cr, 'tag=' + tag, 'import=' + imp)
    }
  }
}
walk('src')
if (fs.existsSync('index.html')) {
  const t = fs.readFileSync('index.html', 'utf8')
  console.log('index.html createRoot=' + (t.split('createRoot').length - 1), 'scriptTags=' + (t.split('<script').length - 1))
}
console.log('DONE')
