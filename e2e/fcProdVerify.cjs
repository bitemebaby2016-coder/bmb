// fcProdVerify — PART 7 production runtime verify (read-only ทั้งหมด)
const fs = require('fs')
const path = require('path')
const ROOT = path.resolve(__dirname, '..')
const env = {}
for (const line of fs.readFileSync(path.join(ROOT, '.env.local'), 'utf8').split(/\r?\n/)) {
  const m = line.match(/^(\w+)=(.*)$/)
  if (m) env[m[1]] = m[2]
}
async function q(sql) {
  const r = await fetch('https://api.supabase.com/v1/projects/ivkdfognyiwjcmrhcnwz/database/query', {
    method: 'POST',
    headers: { Authorization: `Bearer ${env.SUPABASE_ACCESS_TOKEN}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ query: sql }),
  })
  const j = await r.json()
  if (j.message) throw new Error(j.message)
  return j
}
let pass = 0
function t(name, ok, detail) {
  if (!ok) { console.error(`FAIL ${name} ${detail || ''}`); process.exit(1) }
  pass++; console.log(`PASS ${name}`)
}
async function main() {
  // 1) auto-build จาก push 0996493 — รอ asset ใหม่
  let js = ''
  for (let i = 0; i < 8; i++) {
    const home = await fetch('https://biteme-baby.com/', { headers: { 'Cache-Control': 'no-cache' } })
    const html = await home.text()
    const asset = (html.match(/assets\/index-[\w-]+\.js/) || [null])[0]
    if (asset) {
      const r = await fetch('https://biteme-baby.com/' + asset)
      js = await r.text()
      if (js.includes('tier2_markup_pct')) break
    }
    await new Promise((res) => setTimeout(res, 20000))
  }
  t('prod_bundle_hydrates_new_keys',
    js.includes('tier2_markup_pct') && js.includes('bite_drive_enabled') &&
    js.includes('cutoff_hours') && js.includes('daily_quota') &&
    js.includes('theme_tokens') && js.includes('service_radius_km'),
    'bundle missing hydration keys')

  // 2) customer/anon read path: business_settings (ค่าใหม่ใน key เดิม) + branches + brands
  const H = { apikey: env.VITE_SUPABASE_ANON_KEY, Authorization: `Bearer ${env.VITE_SUPABASE_ANON_KEY}` }
  const bs = await (await fetch(`${env.VITE_SUPABASE_URL}/rest/v1/business_settings?select=key,value`, { headers: H })).json()
  const dp = bs.find((r) => r.key === 'delivery_policy')?.value || {}
  const op = bs.find((r) => r.key === 'order_policy')?.value || {}
  t('anon_settings_has_new_config',
    dp.bite_drive_enabled === true && Number(dp.tier2_markup_pct) === 12 &&
    Number(dp.free_shipping_threshold) === 300 && Number(op.cutoff_hours) === 2 && Number(op.daily_quota) === 120,
    JSON.stringify({ dp, op }))
  t('anon_settings_legacy_radius_retired', !('radius_km' in dp), JSON.stringify(dp))

  const br = await (await fetch(`${env.VITE_SUPABASE_URL}/rest/v1/branches?select=service_radius_km&is_default=eq.true`, { headers: H })).json()
  t('anon_branch_radius_readable', Array.isArray(br) && br.length === 1 && Number(br[0].service_radius_km) === 5, JSON.stringify(br))

  const bd = await (await fetch(`${env.VITE_SUPABASE_URL}/rest/v1/brands?select=display_name,theme_tokens&is_default=eq.true`, { headers: H })).json()
  t('anon_brand_glass_readable', Array.isArray(bd) && bd[0]?.theme_tokens?.glass?.bg, JSON.stringify(bd))

  // 3) RPC/canonical: def ใหม่ + legacy row ปลอดภัย (read-only)
  const defs = await q(`select pg_get_functiondef('public.create_order_with_items'::regproc) c,
    pg_get_functiondef('public.admin_sync_legacy_pre_order'::regproc) s`)
  t('rpc_fc1_fc5_live', defs[0].c.includes('ERR_BITE_DRIVE_DISABLED') && defs[0].c.includes('v_resolved_branch_id)'))
  t('sync_fn_live', defs[0].s.includes('ERR_CANONICAL_NOT_TERMINAL'))
  const legacy = await q(`select (select status from public.pre_orders where order_number='PO-20260919-430') legacy,
    (select status from public.orders where id='ord-mig-20260919-430') canon`)
  t('legacy_row_safe', legacy[0].legacy === 'cancelled' && legacy[0].canon === 'cancelled', JSON.stringify(legacy[0]))
  const active = await q(`select count(*)::int n from public.orders
    where status not in ('cancelled','delivered')`)
  t('no_active_orders', active[0].n === 0, JSON.stringify(active[0]))

  console.log(`FC_PROD_ALL_PASS (${pass} checks)`)
}
main().catch((e) => { console.error('FC_PROD_FAIL: ' + e.message); process.exit(1) })