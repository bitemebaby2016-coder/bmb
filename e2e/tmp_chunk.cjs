'use strict'
// tmp_chunk — print regions of built chunks around the boot-crash offsets
const fs = require('fs')
function region(file, offset, span) {
  const t = fs.readFileSync(file, 'utf8')
  console.log('== ' + file + ' len=' + t.length + ' region@' + offset + ' ==')
  console.log(t.slice(Math.max(0, offset - span), offset + span))
  console.log('== end ==')
}
region('dist/assets/state-vendor-gNW87BoF.js', 1088, 400)
region('dist/assets/react-vendor-DLS49qVy.js', 44974, 250)
const idx = fs.readFileSync('dist/assets/index-ulWufhxi.js', 'utf8')
console.log('== index @12177 ==')
console.log(idx.slice(11800, 12500))
console.log('DONE')
