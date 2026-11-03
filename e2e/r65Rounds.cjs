// R65 — probe delivery_rounds today/tomorrow (BKK) for pickup checkout diagnosis
'use strict'
const fs = require('fs')
const path = require('path')
const { SB, SERVICE } = require('./wave2Lib.cjs')
;(async () => {
  const r = await fetch(SB + '/rest/v1/delivery_rounds?select=id,scheduled_date,status,cutoff_time,delivery_start,delivery_end,max_capacity,current_count&scheduled_date=gte.2026-11-03&order=scheduled_date.asc&limit=30', {
    headers: { apikey: SERVICE, Authorization: 'Bearer ' + SERVICE },
  })
  const j = await r.json().catch(() => null)
  console.log('status=' + r.status)
  console.log(JSON.stringify(j, null, 1).slice(0, 3000))
  fs.writeFileSync(path.join(__dirname, 'r65Rounds-result.json'), JSON.stringify({ at: new Date().toISOString(), status: r.status, rows: j }, null, 2))
})().catch((e) => { console.error(e); process.exit(1) })