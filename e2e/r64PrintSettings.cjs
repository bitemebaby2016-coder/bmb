// R64 — probe print_settings (qz config) from business_settings
'use strict'
const fs = require('fs')
const path = require('path')
const { SB, SERVICE } = require('./wave2Lib.cjs')
;(async () => {
  const r = await fetch(SB + '/rest/v1/business_settings?select=key,value&key=eq.print_settings', {
    headers: { apikey: SERVICE, Authorization: 'Bearer ' + SERVICE },
  })
  const j = await r.json().catch(() => null)
  console.log('status=' + r.status)
  console.log(JSON.stringify(j, null, 1).slice(0, 2500))
  fs.writeFileSync(path.join(__dirname, 'r64PrintSettings-result.json'), JSON.stringify({ at: new Date().toISOString(), status: r.status, rows: j }, null, 2))
})().catch((e) => { console.error(e); process.exit(1) })