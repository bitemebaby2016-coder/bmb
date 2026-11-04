'use strict'
// tmp_dist_check — verify current dist contains the restored UI contract
const fs = require('fs')
const files = fs.readdirSync('dist/assets').filter((x) => x.startsWith('index-') && x.endsWith('.js'))
console.log('INDEX_FILES=' + files.join(','))
for (const f of files) {
  const t = fs.readFileSync('dist/assets/' + f, 'utf8')
  console.log(f, 'home-menu-cta=' + t.includes('home-menu-cta'), 'fulfillment-delivery=' + t.includes('fulfillment-delivery'), 'mascot-point-cta=' + t.includes('mascot-point-cta'))
}
// also check the talk-to-bite chunk (landing lives there)
const ttb = fs.readdirSync('dist/assets').filter((x) => x.includes('TalkToBite'))
for (const f of ttb) {
  const t = fs.readFileSync('dist/assets/' + f, 'utf8')
  console.log(f, 'home-menu-cta=' + t.includes('home-menu-cta'), 'mascot-point-cta=' + t.includes('mascot-point-cta'))
}
const m = fs.statSync('dist/index.html')
console.log('dist/index.html mtime=' + m.mtime.toISOString())
console.log('DONE')
