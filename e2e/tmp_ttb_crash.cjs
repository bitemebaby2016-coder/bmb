'use strict'
// tmp_ttb_crash — identify component T at TalkToBite-BWbZ5bvD.js line 2 col 1054
const fs = require('fs')
const file = 'dist/assets/TalkToBite-BWbZ5bvD.js'
const lines = fs.readFileSync(file, 'utf8').split(/\r?\n/)
const l2 = lines[1] || ''
console.log('line2 len=' + l2.length)
console.log('== @1054 ==')
console.log(l2.slice(754, 1354))
// also show imports of the chunk (line 1) to see where useNavigate comes from
console.log('== line1 head ==')
console.log((lines[0] || '').slice(0, 600))
console.log('DONE')
