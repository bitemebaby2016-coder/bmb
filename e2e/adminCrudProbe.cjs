'use strict'
// adminCrudProbe — ทดสอบเขียนจริง (create→update→read→delete) ทุกพื้นผิวหลักของแอดมิน
//   ด้วย session แอดมิน + ล้างข้อมูลทดสอบทิ้งเสมอ ไม่พิมพ์รหัส/คีย์
const fs = require('fs')
const path = require('path')
const { createClient } = require('@supabase/supabase-js')
const ROOT = path.resolve(__dirname, '..')
function readEnv(file) {
  const h = {}
  for (const l of fs.readFileSync(file, 'utf8').split(/\r?\n/)) {
    const m = l.match(/^\s*([A-Za-z0-9_]+)\s*=\s*(.*)\s*$/)
    if (m && !l.trim().startsWith('#') && m[2]) h[m[1]] = m[2]
  }
  return h
}
const env = readEnv(path.join(ROOT, '.env.local'))
const sec = readEnv(path.join(ROOT, 'supabase', 'secrets.local.env'))
const sb = createClient(env.VITE_SUPABASE_URL, env.VITE_SUPABASE_ANON_KEY)
const TENANT = 'tenant-bmb-001'
const BRANCH = 'branch-tenant-bmb-001-main'
const TAG = Date.now()
let pass = 0, fail = 0
const ok = (n, e) => { if (!e) { pass++; console.log('PASS ' + n) } else { fail++; console.log('FAIL ' + n + ' :: ' + (e.message || e)) } }

;(async () => {
  const { error: le } = await sb.auth.signInWithPassword({ email: sec.BMB_TEST_ADMIN_EMAIL, password: sec.BMB_TEST_ADMIN_PASSWORD })
  if (le) { console.log('LOGIN_ERR ' + le.message); process.exit(1) }
  console.log('LOGIN ok')

  // ---- 1) product_categories ----
  const catId = 'cat-probe-' + TAG
  let e = (await sb.from('product_categories').insert({ id: catId, name: 'PROBE CAT', slug: 'probe-cat-' + TAG, tenant_id: TENANT }).select().single()).error
  ok('categories.insert', e)
  e = (await sb.from('product_categories').update({ name: 'PROBE CAT 2' }).eq('id', catId).select().single()).error
  ok('categories.update', e)
  const catRd = await sb.from('product_categories').select('name').eq('id', catId).single()
  ok('categories.readback', catRd.error || catRd.data?.name !== 'PROBE CAT 2')

  // ---- 2) products (create/update/base64 image/readback/delete) ----
  const prodId = 'prod-probe-' + TAG
  const PNG = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg=='
  e = (await sb.from('products').insert({
    id: prodId, name: 'PROBE PRODUCT', description: 'probe', price: 1,
    category_id: catId, image_url: PNG, is_available: true, is_featured: false,
    prep_minutes: 1, sort_order: 999, review_count: 0, tenant_id: TENANT,
  }).select().single()).error
  ok('products.insert(+base64 image)', e)
  e = (await sb.from('products').update({ name: 'PROBE PRODUCT 2', price: 2 }).eq('id', prodId).select().single()).error
  ok('products.update', e)
  const prd = await sb.from('products').select('name,price').eq('id', prodId).single()
  ok('products.readback', prd.error || prd.data?.name !== 'PROBE PRODUCT 2' || Number(prd.data?.price) !== 2)

  // ---- 3) menu_sections ----
  const secId = 'sec-probe-' + TAG
  e = (await sb.from('menu_sections').insert({ id: secId, name: 'PROBE SEC', slug: 'probe-sec-' + TAG, tenant_id: TENANT }).select().single()).error
  ok('menu_sections.insert', e)
  e = (await sb.from('menu_sections').update({ name: 'PROBE SEC 2' }).eq('id', secId).select().single()).error
  ok('menu_sections.update', e)
  e = (await sb.from('menu_sections').delete().eq('id', secId)).error
  ok('menu_sections.delete', e)

  // ---- 4) delivery_rounds (branch_id NOT NULL — regression check) ----
  const rndId = 'round-probe-' + TAG
  const today = new Date().toISOString().slice(0, 10)
  e = (await sb.from('delivery_rounds').insert({
    id: rndId, name: 'morning', round_key: 'morning', display_name: 'PROBE ROUND',
    cutoff_time: '08:00', delivery_start: '09:00', delivery_end: '12:00',
    max_capacity: 5, scheduled_date: today, tenant_id: TENANT, branch_id: BRANCH,
  }).select().single()).error
  ok('delivery_rounds.insert(with branch_id)', e)
  e = (await sb.from('delivery_rounds').update({ display_name: 'PROBE ROUND 2' }).eq('id', rndId).select().single()).error
  ok('delivery_rounds.update', e)
  e = (await sb.from('delivery_rounds').delete().eq('id', rndId)).error
  ok('delivery_rounds.delete', e)
  const noBranch = await sb.from('delivery_rounds').insert({
    id: rndId + '-nb', name: 'morning', round_key: 'morning', display_name: 'PROBE NOBRANCH',
    cutoff_time: '08:00', delivery_start: '09:00', delivery_end: '12:00',
    max_capacity: 5, scheduled_date: today, tenant_id: TENANT,
  }).select().single()
  console.log('      ↳ legacy path (no branch_id) — expected FAIL by RLS: ' + (noBranch.error ? 'FAIL: ' + noBranch.error.message : 'ok'))
  if (!noBranch.error) await sb.from('delivery_rounds').delete().eq('id', rndId + '-nb')

  // ---- 5) promotions ----
  const promoId = 'promo-probe-' + TAG
  e = (await sb.from('promotions').insert({ id: promoId, name: 'PROBE PROMO', discount_value: 5 }).select().single()).error
  ok('promotions.insert', e)
  e = (await sb.from('promotions').update({ name: 'PROBE PROMO 2', is_active: false }).eq('id', promoId).select().single()).error
  ok('promotions.update', e)
  e = (await sb.from('promotions').delete().eq('id', promoId)).error
  ok('promotions.delete', e)

  // ---- 6) media_assets toggle (setRegistryAssetActive path) ----
  const medId = 'probe-med-' + TAG
  e = (await sb.from('media_assets').insert({ id: medId, url: 'https://example.com/p.png', alt: 'probe', kind: 'image', tenant_id: TENANT }).select().single()).error
  ok('media_assets.insert', e)
  e = (await sb.from('media_assets').update({ is_active: false, updated_at: new Date().toISOString() }).eq('id', medId).select().single()).error
  ok('media_assets.update(is_active)', e)
  e = (await sb.from('media_assets').delete().eq('id', medId)).error
  ok('media_assets.delete', e)

  // ---- cleanup product + category ----
  e = (await sb.from('products').delete().eq('id', prodId)).error
  ok('products.delete', e)
  e = (await sb.from('product_categories').delete().eq('id', catId)).error
  ok('categories.delete', e)

  console.log('--- ADMIN_CRUD: ' + pass + ' pass / ' + fail + ' fail ---')
  process.exit(fail ? 1 : 0)
})().catch((ex) => { console.error('CRUD_ERR', String(ex.message || ex).slice(0, 300)); process.exit(1) })
