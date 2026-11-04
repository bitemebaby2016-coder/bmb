'use strict'
// _r67_recon2 — E2E-matrix feasibility recon (read-only):
//  1) delivery_rounds for 2026-11-04..06 (place-order requires selectedRoundId)
//  2) order_number format authority (which migration generates it)
//  3) BiteMascot img class + CheckoutPage payment-method testids
const fs = require('fs')
const path = require('path')

const envPath = path.join(__dirname, '..', 'supabase', 'secrets.local.env')
const env = {}
for (const line of fs.readFileSync(envPath, 'utf8').split(/\r?\n/)) {
  const m = line.match(/^([A-Z0-9_]+)=(.*)$/)
  if (m) env[m[1]] = m[2].replace(/^["']|["']$/g, '')
}
const BASE = 'https://ivkdfognyiwjcmrhcnwz.supabase.co'
const H = { apikey: env.SUPABASE_SERVICE_ROLE_KEY, Authorization: 'Bearer ' + env.SUPABASE_SERVICE_ROLE_KEY }

async function q(name, url) {
  try {
    const r = await fetch(BASE + url, { headers: H })
    const t = await r.text()
    console.log('== ' + name + ' status=' + r.status + ' ==')
    console.log(t.slice(0, 1400))
  } catch (e) {
    console.log('== ' + name + ' ERROR ' + String(e).slice(0, 200))
  }
}

function grep(file, pats) {
  try {
    const lines = fs.readFileSync(file, 'utf8').split(/\r?\n/)
    let hits = 0
    lines.forEach((l, i) => {
      if (pats.some((p) => l.includes(p))) { hits++; console.log(file + ':' + (i + 1) + ': ' + l.trim().slice(0, 150)) }
    })
    console.log('-- ' + file + ' HITS=' + hits)
  } catch (e) {
    console.log('-- ' + file + ' MISSING')
  }
}

;(async () => {
  await q('rounds 11-04..11-06', '/rest/v1/delivery_rounds?select=id,round_key,display_name,status,cutoff_time,delivery_start,delivery_end,date,current_count,max_capacity&date=gte.2026-11-04&date=lte.2026-11-06&order=date')
  await q('orders latest numbers', '/rest/v1/orders?select=order_number,order_mode,status&order=created_at.desc&limit=5')
  console.log('== file greps ==')
  grep('src/components/ai/BiteMascot.tsx', ['className=', 'mascot-badge'])
  grep('src/pages/CheckoutPage.tsx', ['payment', 'data-testid="pay', 'radio name="payment"', 'value="promptpay_qr"'])
  const migDir = 'supabase/migrations'
  for (const f of fs.readdirSync(migDir)) {
    if (!f.endsWith('.sql')) continue
    const t = fs.readFileSync(path.join(migDir, f), 'utf8')
    const hasNum = t.includes('order_number') && (t.includes('BMB-') || t.includes('PO-'))
    if (hasNum) {
      t.split(/\r?\n/).forEach((l, i) => {
        if (l.includes('BMB-') || l.includes('PO-')) console.log('ORDERNUM ' + f + ':' + (i + 1) + ': ' + l.trim().slice(0, 140))
      })
    }
  }
  console.log('RECON_DONE')
})()
