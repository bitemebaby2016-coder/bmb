'use strict'
// print FloatingAdBanners lines 89-199 (announcement merge region)
const fs = require('fs')
const path = require('path')
const lines = fs.readFileSync(path.join(process.cwd(), 'src/components/home/FloatingAdBanners.tsx'), 'utf8').split(/\r?\n/)
console.log(lines.slice(88, 199).map((l, i) => (i + 89) + ' ' + l).join('\n'))