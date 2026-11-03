'use strict'
// ดึง implementation ของ za (decodeCartParam) จาก production bundle
;(async () => {
  const js = await (await fetch('https://biteme-baby.com/assets/index-CyFclIea.js')).text()
  const i = js.indexOf('v!==1')
  console.log('--- ctx around v!==1 (' + i + ') ---')
  console.log(js.slice(Math.max(0, i - 900), i + 500).replace(/\s+/g, ' '))
  const k = js.indexOf('function za')
  console.log('--- function za @' + k + ' ---')
  if (k >= 0) console.log(js.slice(k, k + 700).replace(/\s+/g, ' '))
  const m = js.match(/za\s*=\s*[^;]{0,600}/)
  console.log('--- za= assignment ---')
  console.log(m ? m[0].replace(/\s+/g, ' ') : 'NOT FOUND')
})().catch((e) => { console.error('FAIL ' + e.message); process.exit(1) })
