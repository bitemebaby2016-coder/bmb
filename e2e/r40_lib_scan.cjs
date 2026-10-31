// ค้นคำสั่งพิมพ์จริงใน lib niimbot (findstr บอดกับไฟล์นี้) — evidence ต่อการสอบ "ลดสเปซ"
const fs = require('fs')
const path = require('path')
const p = path.resolve(__dirname, '..', 'node_modules', 'niimbot-web-bluetooth', 'src', 'niimbot.js')
const lines = fs.readFileSync(p, 'utf8').split('\n')
const re = /printImage|imageToPacked|PageSize|labelType|0x1f|drawImage|SetPage|size\.h_px|size\.w_px|fit|scale|stretch|ratio/i
lines.forEach((l, i) => { if (re.test(l)) console.log((i + 1) + ': ' + l.trim().slice(0, 170)) })
console.log('TOTAL_LINES=' + lines.length)