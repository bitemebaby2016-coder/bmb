// R65f — WHEN were evening rounds closed? (updated_at + audit trail + cron search) read-only
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
  out.evenings = await get("/rest/v1/delivery_rounds?select=id,scheduled_date,status,updated_at,created_at&round_key=eq.evening&scheduled_date=gte.2026-11-01&order=scheduled_date.asc&limit=30")
  out.morning = await get("/rest/v1/delivery_rounds?select=id,scheduled_date,status,updated_at&round_key=eq.morning&scheduled_date=gte.2026-11-01&order=scheduled_date.asc&limit=5")
  out.auditRounds = await get("/rest/v1/audit_logs?select=action,entity_id,description,created_at&entity_type=eq.delivery_round&order=created_at.desc&limit=20")
  fs.writeFileSync(path.join(__dirname, 'r65fEvening-result.json'), JSON.stringify(out, null, 2))
  const ev = Array.isArray(out.evenings.j) ? out.evenings.j : []
  console.log('evening rows:', ev.length)
  for (const r of ev.slice(0, 15)) console.log(r.scheduled_date, r.status, 'updated=', r.updated_at, 'created=', r.created_at)
  console.log('audit n=', Array.isArray(out.auditRounds.j) ? out.auditRounds.j.length : out.auditRounds.s)
  if (Array.isArray(out.auditRounds.j)) for (const a of out.auditRounds.j.slice(0, 10)) console.log('AUDIT', a.created_at, a.entity_id, (a.description || '').slice(0, 90))
})().catch((e) => { console.error(e); process.exit(1) })
