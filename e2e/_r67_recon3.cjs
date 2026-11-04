'use strict'
// _r67_recon3 — final E2E feasibility checks (read-only):
//  1) scheduled products (menu_schedule 11-04/05) — are they orderable?
//  2) MenuPage pre-order tab filter semantics
//  3) checkout → payment redirect mechanism
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
    console.log(t.slice(0, 1200))
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
  await q('scheduled products', '/rest/v1/products?select=id,name,is_available,available_same_day,available_preorder,is_preorder,price&or=(id.eq.prod-1793370728049-b1uqeg,id.eq.prod-1793370681553-cd6ol7,id.eq.prod-1793370625449-zzn457,id.eq.prod-1792810253606-0x3ycg)')
  await q('published schedule 11-05', '/rest/v1/menu_schedule?select=scheduled_date,product_id,is_published&scheduled_date=eq.2026-11-05')
  console.log('== file greps ==')
  grep('src/pages/MenuPage.tsx', ['pre-order', 'filtered', 'menuTab', 'scheduleMap'])
  grep('src/pages/CheckoutPage.tsx', ['navigate(', '/payment/'])
  grep('src/pages/PaymentConfirmationPage.tsx', ['handlePromptPaySubmit', 'submit_offline_payment_reference'])
  console.log('RECON_DONE')
})()
