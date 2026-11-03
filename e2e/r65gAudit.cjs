// R65g — evening rows archived flag + audit trail around 2026-10-30 closes (read-only)
'use strict'
const fs = require('fs')
const path = require('path')
const { SB, SERVICE } = require('./wave2Lib.cjs')
const H = { apikey: SERVICE, Authorization: 'Bearer ' + SERVICE }
const get = async (q) => {
  const r = await fetch(SB + q, { headers: H })
  return { s: r.status, j: await r.json().catch(() => null) }
}
;(async () => {
  const out = { at: new Date().toISOString() }
  out.eveningArchived = await get("/rest/v1/delivery_rounds?select=id,scheduled_date,status,archived&round_key=eq.evening&scheduled_date=gte.2026-11-01&order=scheduled_date.asc&limit=30")
  out.auditOct30 = await get("/rest/v1/audit_logs?select=action,entity_id,description,created_at&entity_type=eq.delivery_round&created_at=gte.2026-10-30T13:00:00Z&created_at=lte.2026-10-30T16:00:00Z&order=created_at.asc&limit=50")
  fs.writeFileSync(path.join(__dirname, 'r65gAudit-result.json'), JSON.stringify(out, null, 2))
  const ev = Array.isArray(out.eveningArchived.j) ? out.eveningArchived.j : []
  const archived = ev.filter((r) => r.archived === true)
  console.log('evening rows:', ev.length, 'archived:', archived.length)
  const au = Array.isArray(out.auditOct30.j) ? out.auditOct30.j : []
  console.log('audit 10-30 13-16Z:', au.length, out.auditOct30.s)
  for (const a of au.slice(0, 30)) console.log(a.created_at, a.action, a.entity_id, (a.description || '').slice(0, 100))
})().catch((e) => { console.error(e); process.exit(1) })
