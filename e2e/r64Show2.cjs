'use strict'
// print pushService 115-155 + grep pnputil dump for Nimbot + tests asserting merged order
const fs = require('fs')
const path = require('path')
const lines = fs.readFileSync(path.join(process.cwd(), 'src/lib/pushService.ts'), 'utf8').split(/\r?\n/)
console.log('--- pushService 115-155 ---')
console.log(lines.slice(114, 155).map((l, i) => (i + 115) + ' ' + l).join('\n'))
try {
  const pnp = fs.readFileSync(path.join(process.cwd(), 'e2e/r64_pnp.txt'), 'utf8')
  const blocks = pnp.split(/\r?\n\r?\n/)
  const hits = blocks.filter((b) => /nimbot|niimbot|b1\s*pro/i.test(b))
  console.log('--- pnputil nimbot hits: ' + hits.length + ' ---')
  for (const h of hits.slice(0, 4)) console.log(h.slice(0, 400) + '\n--')
} catch (e) { console.log('pnp read err ' + e) }