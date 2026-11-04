'use strict'
// tmp_mascot_scan — find every mascotService call site + whether awaited
const fs = require('fs')
const path = require('path')
function walk(d) {
  for (const f of fs.readdirSync(d, { withFileTypes: true })) {
    const p = path.join(d, f.name)
    if (f.isDirectory()) {
      if (!f.name.includes('node_modules') && !f.name.startsWith('.')) walk(p)
    } else if (/\.(ts|tsx)$/.test(f.name)) {
      const lines = fs.readFileSync(p, 'utf8').split(/\r?\n/)
      lines.forEach((l, i) => {
        if (/loadMascotOverrides|getMascotOverrides|getOverrideUrl|invalidateMascotOverrides/.test(l)) {
          console.log(p + ':' + (i + 1) + ': ' + l.trim().slice(0, 140))
        }
      })
    }
  }
}
walk('src')
console.log('DONE')
