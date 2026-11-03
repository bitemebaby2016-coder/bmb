'use strict'
// quick probe: storage list POST shape (R63 sweep fix)
const { SB, SERVICE } = require('./wave2Lib.cjs')
;(async () => {
  for (const prefix of ['', 'ai-generated']) {
    const r = await fetch(SB + '/storage/v1/object/list/bmb-images', {
      method: 'POST',
      headers: { apikey: SERVICE, Authorization: 'Bearer ' + SERVICE, 'Content-Type': 'application/json' },
      body: JSON.stringify({ prefix, limit: 5 }),
    })
    const j = await r.json().catch(() => null)
    console.log('prefix=' + JSON.stringify(prefix), 'status=' + r.status, JSON.stringify(j).slice(0, 500))
  }
})()