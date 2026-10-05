// fcVerify114 — runtime verify หลังสมัคร migration 114 (read-only, 1 query ต่อ check)
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
  const dp = (await q(`select value from public.business_settings where key='delivery_policy'`))[0].value
  t('dp_bite_drive_enabled_seeded', dp.bite_drive_enabled === true, JSON.stringify(dp))
  t('dp_markup_seeded', Number(dp.tier2_markup_pct) === 12)
  t('dp_freeship_seeded', Number(dp.free_shipping_threshold) === 300)
  t('dp_legacy_radius_retired', !('radius_km' in dp), JSON.stringify(dp))

  const op = (await q(`select value from public.business_settings where key='order_policy'`))[0].value
  t('op_cutoff_seeded', Number(op.cutoff_hours) === 2, JSON.stringify(op))
  t('op_quota_seeded', Number(op.daily_quota) === 120)

  const br = (await q(`select theme_tokens from public.brands where is_default limit 1`))[0].theme_tokens
  t('brand_glass_seeded', br && br.glass && typeof br.glass.bg === 'string', JSON.stringify(br && br.glass))

  const co = (await q(`select pg_get_functiondef('public.create_order_with_items'::regproc) d`))[0].d.replace(/\r\n/g, '\n')
  t('create_fc1_branch_scoped_policy', co.includes('branch_id IS NULL OR branch_id = v_resolved_branch_id'))
  t('create_fc3_branch_radius', co.includes('v_radius_override'))
  t('create_fc5_bitedrive_gate', co.includes('ERR_BITE_DRIVE_DISABLED'))
  t('create_passes_branch_to_fee', /compute_delivery_fee\([^)]*v_resolved_branch_id\s*\)/s.test(co))

  const fee = (await q(`select pg_get_functiondef('public.compute_delivery_fee'::regproc) d`))[0].d.replace(/\r\n/g, '\n')
  t('fee_has_branch_param', fee.includes('p_branch_id text DEFAULT NULL'))
  t('fee_uses_branch_radius', fee.includes('v_br'))
  t('fee_zone_branch_filter', fee.includes('branch_id = p_branch_id'))

  const w = (await q(`select pg_get_functiondef('public.enforce_pre_order_window'::regproc) d`))[0].d.replace(/\r\n/g, '\n')
  t('window_cutoff_from_settings', w.includes(`order_setting('cutoff_hours', 2)`) && !w.includes(`interval '2 hours'`))
  t('window_no_make_interval_numeric', w.includes(`+ v_start - (v_cutoff_hours * interval '1 hour')`) && !w.includes('make_interval') && !w.includes('(v_start - (v_cutoff'))
  const c = (await q(`select pg_get_functiondef('public.enforce_pre_order_cancel_window'::regproc) d`))[0].d.replace(/\r\n/g, '\n')
  t('cancel_cutoff_from_settings', c.includes(`order_setting('cutoff_hours', 2)`) && !c.includes(`interval '2 hours'`))
  t('cancel_no_make_interval_numeric', c.includes(`+ v_start - (v_cutoff_hours * interval '1 hour')`) && !c.includes('make_interval') && !c.includes('(v_start - (v_cutoff'))

  const sigs = await q(`select p.proname, pg_get_function_identity_arguments(p.oid) a
    from pg_proc p where p.pronamespace='public'::regnamespace
      and p.proname in ('compute_delivery_fee','compute_delivery_fee_rpc','admin_sync_legacy_pre_order') order by 1,2`)
  t('fee_old_sig_gone', !sigs.some((s) => s.proname === 'compute_delivery_fee' && !s.a.includes('p_branch_id')), JSON.stringify(sigs))
  t('wrapper_old_sig_gone', !sigs.some((s) => s.proname === 'compute_delivery_fee_rpc' && !s.a.includes('p_branch_id')))
  t('sync_fn_exists', sigs.some((s) => s.proname === 'admin_sync_legacy_pre_order'))

  const syncDef = (await q(`select pg_get_functiondef('public.admin_sync_legacy_pre_order'::regproc) d`))[0].d
  t('sync_gate_admin', syncDef.includes('ERR_NOT_ADMIN'))
  t('sync_requires_canonical_terminal', syncDef.includes('ERR_CANONICAL_NOT_TERMINAL'))
  t('sync_no_delete', !/DELETE\s+FROM\s+public\.pre_orders/i.test(syncDef))

  const grants = await q(`select p.proname, g.grantee::regrole::text gt from pg_proc p
    cross join lateral aclexplode(p.proacl) g
    where p.pronamespace='public'::regnamespace and p.proname='admin_sync_legacy_pre_order'`)
  t('sync_no_anon_grant', !grants.some((g) => g.gt === 'anon') && !grants.some((g) => g.gt === '"public"'), JSON.stringify(grants))

  console.log(`FC_VERIFY_114_ALL_PASS (${pass} checks)`)
}
main().catch((e) => { console.error('FC_VERIFY_FAIL: ' + e.message); process.exit(1) })