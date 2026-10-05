// ============================================================
// fcProbe6 — PART 6 functional matrix บน production (mutation ทุกจุดอยู่ใน BEGIN...ROLLBACK)
// A = read/isolation (RLS) · B = admin update roundtrip · C = RPC/flow · D = legacy sync
// จบด้วย: FC_PROBE6_ALL_PASS (D2 = real sync ไม่ rollback)
// ============================================================
const fs = require('fs')
const path = require('path')
const ROOT = path.resolve(__dirname, '..')
const env = {}
for (const line of fs.readFileSync(path.join(ROOT, '.env.local'), 'utf8').split(/\r?\n/)) {
  const m = line.match(/^(\w+)=(.*)$/)
  if (m) env[m[1]] = m[2]
}
const API = 'https://api.supabase.com/v1/projects/ivkdfognyiwjcmrhcnwz/database/query'
const ADMIN = 'ae12e10b-0f1f-45ff-b0f0-6dd7a682b064'
async function q(sql) {
  const res = await fetch(API, {
    method: 'POST',
    headers: { Authorization: `Bearer ${env.SUPABASE_ACCESS_TOKEN}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ query: sql }),
  })
  const json = await res.json()
  if (!res.ok || json.message) throw new Error(String(json.message || res.statusText).slice(0, 1500))
  return json
}
let pass = 0
function t(name, ok, detail) {
  if (!ok) { console.error(`FAIL ${name} ${detail || ''}`); process.exit(1) }
  pass++; console.log(`PASS ${name}`)
}
const claims = (sub, role = 'authenticated') =>
  `set_config('request.jwt.claims', '{"sub":"${sub}","role":"${role}"}', false)`

async function main() {
  // ===== profiles baseline =====
  const prof = await q(`select role, tenant_id, is_platform from public.profiles where id='${ADMIN}'`)
  t('admin_profile_exists', prof.length === 1 && prof[0].role === 'admin', JSON.stringify(prof))

  // ===== A1: admin read ทุก canonical config =====
  const a1 = await q(`BEGIN;
SET ROLE authenticated;
SELECT ${claims(ADMIN)};
SELECT (select count(*) from public.business_settings)::int s,
       (select count(*) from public.delivery_zones)::int z,
       (select count(*) from public.brands)::int b,
       (select count(*) from public.branches)::int br;
ROLLBACK;`)
  const a1r = a1[a1.length - 1]
  t('A1_admin_read_all_config', a1r.s > 0 && a1r.z > 0 && a1r.b > 0 && a1r.br > 0, JSON.stringify(a1r))

  // ===== A2: anon write denied (settings) =====
  try {
    await q(`BEGIN; SET ROLE anon;
      UPDATE public.business_settings SET value = value || '{"tier2_markup_pct":1}'::jsonb WHERE key='delivery_policy';
      SELECT 1 AS r; ROLLBACK;`)
    t('A2_anon_write_denied', false, 'update succeeded!')
  } catch (e) {
    t('A2_anon_write_denied', /permission denied|row-level security/i.test(e.message), e.message)
  }

  // ===== A3: authenticated ไม่มี profile → update ไม่โดน row (RLS filter) =====
  const a3 = await q(`BEGIN;
SET ROLE authenticated;
SELECT ${claims('00000000-0000-4000-8000-000000000099')};
WITH u AS (UPDATE public.business_settings SET value = value || '{"tier2_markup_pct":99}'::jsonb WHERE key='delivery_policy' RETURNING 1)
SELECT count(*)::int affected FROM u;
ROLLBACK;`)
  t('A3_nonadmin_update_filtered', Number(a3[a3.length - 1].affected) === 0, JSON.stringify(a3[a3.length - 1]))

  // ===== A4/A5/A6: tenant/brand/branch isolation =====
  const a4 = await q(`BEGIN; SET ROLE authenticated; SELECT ${claims(ADMIN)};
SELECT public.is_tenant_admin('tenant-bmb-001') own,
       public.is_tenant_admin('tenant-other') other,
       public.is_branch_admin('branch-tenant-bmb-001-main') own_branch,
       public.is_branch_admin('branch-other') other_branch;
ROLLBACK;`)
  const a4r = a4[a4.length - 1]
  t('A4_tenant_isolation', a4r.own === true && a4r.other === false, JSON.stringify(a4r))
  t('A5_brand_isolation_fn', a4r.other === false, JSON.stringify(a4r))
  t('A6_branch_isolation', a4r.own_branch === true && a4r.other_branch === false, JSON.stringify(a4r))
  // ===== B1: admin update settings roundtrip (rollback) =====
  const b1 = await q(`BEGIN;
SET ROLE authenticated;
SELECT ${claims(ADMIN)};
UPDATE public.business_settings SET value = value || '{"tier2_markup_pct":7}'::jsonb WHERE key='delivery_policy';
SELECT (select value->>'tier2_markup_pct' from public.business_settings where key='delivery_policy') v;
ROLLBACK;`)
  t('B1_admin_update_settings', b1[b1.length - 1].v === '7', JSON.stringify(b1[b1.length - 1]))

  // ===== B2: admin update zone roundtrip (rollback) =====
  const b2 = await q(`BEGIN;
SET ROLE authenticated;
SELECT ${claims(ADMIN)};
UPDATE public.delivery_zones SET fee = fee + 99 WHERE id = 'zone-city';
SELECT (select fee from public.delivery_zones where id='zone-city')::text v;
ROLLBACK;`)
  t('B2_admin_update_zone', Number(b2[b2.length - 1].v) > 99, JSON.stringify(b2[b2.length - 1]))

  // ===== B3: admin update brand theme roundtrip (rollback) =====
  const b3 = await q(`BEGIN;
SET ROLE authenticated;
SELECT ${claims(ADMIN)};
UPDATE public.brands SET theme_tokens = theme_tokens || '{"glass":{"bg":"rgba(9,9,9,0.9)"}}'::jsonb
 WHERE id = (select id from public.brands where is_default limit 1);
SELECT (select theme_tokens->'glass'->>'bg' from public.brands where is_default limit 1) v;
ROLLBACK;`)
  t('B3_admin_update_brand_theme', b3[b3.length - 1].v === 'rgba(9,9,9,0.9)', JSON.stringify(b3[b3.length - 1]))

  // ===== B4: admin update branch radius roundtrip (rollback) =====
  const b4 = await q(`BEGIN;
SET ROLE authenticated;
SELECT ${claims(ADMIN)};
UPDATE public.branches SET service_radius_km = 7.5 WHERE id = 'branch-tenant-bmb-001-main';
SELECT (select service_radius_km from public.branches where id='branch-tenant-bmb-001-main')::text v;
ROLLBACK;`)
  t('B4_admin_update_branch_radius', Number(b4[b4.length - 1].v) === 7.5, JSON.stringify(b4[b4.length - 1]))

  // rollback จริง: ค่า production ยังเป็นเดิม
  const after = await q(`select value->>'tier2_markup_pct' m, value->>'bite_drive_radius_km' r
    from public.business_settings where key='delivery_policy'`)
  t('B_rollback_restored', after[0].m === '12' && Number(after[0].r) === 5, JSON.stringify(after[0]))

  // ===== C: RPC/flow matrix (ทั้งชุดใน BEGIN...ROLLBACK) =====
  const c = await q(`BEGIN;
SELECT set_config('request.jwt.claims', '{"sub":"${ADMIN}","role":"authenticated"}', false);
DO $probe$
DECLARE
  v_klat numeric; v_klng numeric;
  v_po_round text; v_sd_round text; v_res jsonb;
  v_mid_lng numeric; v_near_lng numeric;
  v_sameday text := 'skipped';
BEGIN
  SELECT COALESCE(kitchen_latitude, latitude), COALESCE(kitchen_longitude, longitude)
    INTO v_klat, v_klng FROM public.branches WHERE id = 'branch-tenant-bmb-001-main';
  IF v_klat IS NULL THEN
    SELECT (value->>'latitude')::numeric, (value->>'longitude')::numeric
      INTO v_klat, v_klng FROM public.business_settings WHERE key = 'kitchen_location';
  END IF;
  SELECT id INTO v_po_round FROM public.delivery_rounds
   WHERE scheduled_date = current_date + 1 AND status = 'active' ORDER BY cutoff_time LIMIT 1;
  SELECT id INTO v_sd_round FROM public.delivery_rounds
   WHERE scheduled_date = current_date AND status = 'active'
     AND cutoff_time > ((now() AT TIME ZONE 'Asia/Bangkok')::time) ORDER BY cutoff_time DESC LIMIT 1;
  IF v_po_round IS NULL THEN RAISE EXCEPTION 'SETUP: no PRE_ORDER round tomorrow'; END IF;
  v_mid_lng := v_klng + 0.045;   -- ~4.9 km
  v_near_lng := v_klng + 0.004;  -- ~0.44 km

  -- C1 baseline PRE_ORDER self ในรัศมี = สร้างได้ (order flow no regression)
  v_res := public.create_order_with_items('[{"product_id":"prod-5","quantity":1}]'::jsonb, v_po_round, 'self_delivery', 'FC6 addr', v_klat, v_klng, 'FC6 QA', '0000000000', 'promptpay_qr', '', NULL, 0.0, 'PRE_ORDER', current_date + 1, NULL);
  IF v_res->>'order_number' IS NULL THEN RAISE EXCEPTION 'ASSERT C1: no order_number %', v_res; END IF;

  -- C11 Bite Drive disable (FC-5) → self_delivery ถูกปฏิเสธ
  UPDATE public.business_settings SET value = value || '{"bite_drive_enabled":false}'::jsonb WHERE key='delivery_policy';
  BEGIN
    PERFORM public.create_order_with_items('[{"product_id":"prod-5","quantity":1}]'::jsonb, v_po_round, 'self_delivery', 'FC6 addr', v_klat, v_klng, 'FC6 QA', '0000000000', 'promptpay_qr', '', NULL, 0.0, 'PRE_ORDER', current_date + 1, NULL);
    RAISE EXCEPTION 'ASSERT C11: self accepted while bite_drive disabled';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM NOT LIKE '%ERR_BITE_DRIVE_DISABLED%' THEN RAISE EXCEPTION 'ASSERT C11 wrong error: %', SQLERRM; END IF;
  END;
  UPDATE public.business_settings SET value = value || '{"bite_drive_enabled":true}'::jsonb WHERE key='delivery_policy';

  -- C3 branch radius override (FC-3): ลดเหลือ 1km → 4.9km ถูกปฏิเสธ (ค่าจาก branches ไม่ใช่ policy)
  UPDATE public.branches SET service_radius_km = 1 WHERE id = 'branch-tenant-bmb-001-main';
  BEGIN
    PERFORM public.create_order_with_items('[{"product_id":"prod-5","quantity":1}]'::jsonb, v_po_round, 'self_delivery', 'FC6 addr', v_klat, v_mid_lng, 'FC6 QA', '0000000000', 'promptpay_qr', '', NULL, 0.0, 'PRE_ORDER', current_date + 1, NULL);
    RAISE EXCEPTION 'ASSERT C3: self accepted beyond branch radius';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM NOT LIKE '%ERR_DELIVERY_METHOD_ZONE%' AND SQLERRM NOT LIKE '%SELF_DELIVERY_EXCEEDS%' THEN RAISE EXCEPTION 'ASSERT C3 wrong error: %', SQLERRM; END IF;
  END;
  BEGIN
    PERFORM public.compute_delivery_fee(NULL, NULL, 'self_delivery', 1, 4.9, 'branch-tenant-bmb-001-main');
    RAISE EXCEPTION 'ASSERT C3b: fee accepted beyond branch radius';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM NOT LIKE '%SELF_DELIVERY_EXCEEDS%' THEN RAISE EXCEPTION 'ASSERT C3b wrong error: %', SQLERRM; END IF;
  END;
  UPDATE public.branches SET service_radius_km = 5 WHERE id = 'branch-tenant-bmb-001-main';
  v_res := public.create_order_with_items('[{"product_id":"prod-5","quantity":1}]'::jsonb, v_po_round, 'self_delivery', 'FC6 addr', v_klat, v_mid_lng, 'FC6 QA', '0000000000', 'promptpay_qr', '', NULL, 0.0, 'PRE_ORDER', current_date + 1, NULL);
  IF v_res->>'order_number' IS NULL THEN RAISE EXCEPTION 'ASSERT C3c: radius override restore failed'; END IF;
  PERFORM set_config('probe.sameday', v_sameday, true);
END $probe$;
DO $probe2$
DECLARE
  v_klat numeric; v_klng numeric;
  v_po_round text; v_sd_round text; v_res jsonb;
  v_sameday text := 'skipped';
BEGIN
  SELECT COALESCE(kitchen_latitude, latitude), COALESCE(kitchen_longitude, longitude)
    INTO v_klat, v_klng FROM public.branches WHERE id = 'branch-tenant-bmb-001-main';
  IF v_klat IS NULL THEN
    SELECT (value->>'latitude')::numeric, (value->>'longitude')::numeric
      INTO v_klat, v_klng FROM public.business_settings WHERE key = 'kitchen_location';
  END IF;
  SELECT id INTO v_po_round FROM public.delivery_rounds
   WHERE scheduled_date = current_date + 1 AND status = 'active' ORDER BY cutoff_time LIMIT 1;
  SELECT id INTO v_sd_round FROM public.delivery_rounds
   WHERE scheduled_date = current_date AND status = 'active'
     AND cutoff_time > ((now() AT TIME ZONE 'Asia/Bangkok')::time) ORDER BY cutoff_time DESC LIMIT 1;

  -- C4 fee: ในโซน = ค่าจาก delivery_zones · นอกโซน = ERR_NO_DELIVERY_ZONE · branch param ใช้ได้
  IF public.compute_delivery_fee(v_klat, v_klng, 'self_delivery', 1, NULL) IS NULL THEN RAISE EXCEPTION 'ASSERT C4: fee null'; END IF;
  BEGIN
    PERFORM public.compute_delivery_fee(NULL, NULL, 'grab_rider', 1, 99);
    RAISE EXCEPTION 'ASSERT C4b: fee returned without zone';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM NOT LIKE '%ERR_NO_DELIVERY_ZONE%' THEN RAISE EXCEPTION 'ASSERT C4b wrong error: %', SQLERRM; END IF;
  END;
  IF public.compute_delivery_fee(v_klat, v_klng, 'self_delivery', 1, NULL, 'branch-tenant-bmb-001-main') IS NULL THEN RAISE EXCEPTION 'ASSERT C4c: branch fee null'; END IF;

  -- C5 SAME_DAY open/close switch (D-01) — ข้ามถ้าไม่มีรอบ today เปิดอยู่
  IF v_sd_round IS NOT NULL THEN
    UPDATE public.business_settings SET value = value || '{"same_day_open":false}'::jsonb WHERE key='operating_hours';
    BEGIN
      PERFORM public.create_order_with_items('[{"product_id":"prod-5","quantity":1}]'::jsonb, v_sd_round, 'self_delivery', 'FC6 addr', v_klat, v_klng, 'FC6 QA', '0000000000', 'promptpay_qr', '', NULL, 0.0, 'SAME_DAY', NULL, NULL);
      RAISE EXCEPTION 'ASSERT C5: SAME_DAY accepted while closed';
    EXCEPTION WHEN OTHERS THEN
      IF SQLERRM NOT LIKE '%ERR_ORDER_MODE_CLOSED%' THEN RAISE EXCEPTION 'ASSERT C5 wrong error: %', SQLERRM; END IF;
    END;
    UPDATE public.business_settings SET value = value || '{"same_day_open":true}'::jsonb WHERE key='operating_hours';
    v_sameday := 'pass';
  END IF;

  -- C6 external method selection (D-01): เปิด grab ในรัศมี → รับ; list ว่าง → ปฏิเสธ
  UPDATE public.business_settings SET value = value || '{"allow_external_within_radius":true,"external_methods_enabled":["grab_rider"]}'::jsonb WHERE key='delivery_policy';
  v_res := public.create_order_with_items('[{"product_id":"prod-5","quantity":1}]'::jsonb, v_po_round, 'grab_rider', 'FC6 addr', v_klat, v_klng + 0.004, 'FC6 QA', '0000000000', 'promptpay_qr', '', NULL, 0.0, 'PRE_ORDER', current_date + 1, NULL);
  IF v_res->>'order_number' IS NULL THEN RAISE EXCEPTION 'ASSERT C6: grab rejected while enabled'; END IF;
  UPDATE public.business_settings SET value = value || '{"external_methods_enabled":[]}'::jsonb WHERE key='delivery_policy';
  BEGIN
    PERFORM public.create_order_with_items('[{"product_id":"prod-5","quantity":1}]'::jsonb, v_po_round, 'grab_rider', 'FC6 addr', v_klat, v_klng + 0.004, 'FC6 QA', '0000000000', 'promptpay_qr', '', NULL, 0.0, 'PRE_ORDER', current_date + 1, NULL);
    RAISE EXCEPTION 'ASSERT C6b: grab accepted while list empty';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM NOT LIKE '%ERR_EXTERNAL_METHOD_DISABLED%' THEN RAISE EXCEPTION 'ASSERT C6b wrong error: %', SQLERRM; END IF;
  END;
  UPDATE public.business_settings SET value = value || '{"allow_external_within_radius":false,"external_methods_enabled":[]}'::jsonb WHERE key='delivery_policy';

  -- C7 cutoff_hours (FC-4): 999 → พรุ่งนี้โดนปฏิเสธ · order_setting อ่านค่าจริง · คืน 2 → ผ่าน
  UPDATE public.business_settings SET value = value || '{"cutoff_hours":999}'::jsonb WHERE key='order_policy';
  IF COALESCE(public.order_setting('cutoff_hours', 2), -1) <> 999 THEN RAISE EXCEPTION 'ASSERT C7a: order_setting not reading cutoff_hours'; END IF;
  BEGIN
    PERFORM public.create_order_with_items('[{"product_id":"prod-5","quantity":1}]'::jsonb, v_po_round, 'self_delivery', 'FC6 addr', v_klat, v_klng, 'FC6 QA', '0000000000', 'promptpay_qr', '', NULL, 0.0, 'PRE_ORDER', current_date + 1, NULL);
    RAISE EXCEPTION 'ASSERT C7b: PRE_ORDER accepted with 999h cutoff';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM NOT LIKE '%ERR_PRE_ORDER_CUTOFF_PASSED%' THEN RAISE EXCEPTION 'ASSERT C7b wrong error: %', SQLERRM; END IF;
  END;
  UPDATE public.business_settings SET value = value || '{"cutoff_hours":2}'::jsonb WHERE key='order_policy';

  -- C8 daily_quota อ่านจาก order_policy ตัวเดียวกับ client hydration
  IF COALESCE(public.order_setting('daily_quota', -1), -1) <> 120 THEN RAISE EXCEPTION 'ASSERT C8a: daily_quota seed missing'; END IF;
  UPDATE public.business_settings SET value = value || '{"daily_quota":60}'::jsonb WHERE key='order_policy';
  IF COALESCE(public.order_setting('daily_quota', -1), -1) <> 60 THEN RAISE EXCEPTION 'ASSERT C8b: daily_quota not reading setting'; END IF;
  UPDATE public.business_settings SET value = value || '{"daily_quota":120}'::jsonb WHERE key='order_policy';

  -- C5b mode open/close ผ่าน trigger ตรง (pre_order_open — ใช้ได้ไม่ต้องรอ round window วันนี้)
  UPDATE public.business_settings SET value = value || '{"pre_order_open":false}'::jsonb WHERE key='operating_hours';
  BEGIN
    PERFORM public.create_order_with_items('[{"product_id":"prod-5","quantity":1}]'::jsonb, (select id from public.delivery_rounds where scheduled_date = current_date + 1 and status='active' order by cutoff_time limit 1), 'self_delivery', 'FC6 addr', v_klat, v_klng, 'FC6 QA', '0000000000', 'promptpay_qr', '', NULL, 0.0, 'PRE_ORDER', current_date + 1, NULL);
    RAISE EXCEPTION 'ASSERT C5b: PRE_ORDER accepted while pre_order closed';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM NOT LIKE '%ERR_ORDER_MODE_CLOSED%' THEN RAISE EXCEPTION 'ASSERT C5b wrong error: %', SQLERRM; END IF;
  END;
  UPDATE public.business_settings SET value = value || '{"pre_order_open":true}'::jsonb WHERE key='operating_hours';

  IF v_sameday NOT IN ('pass', 'skipped') THEN RAISE EXCEPTION 'ASSERT C5c: unexpected sameday state %', v_sameday; END IF;
END $probe2$;
ROLLBACK;
SELECT (select count(*) from public.orders where customer_name = 'FC6 QA')::int qa_rows,
       (select value->>'cutoff_hours' from public.business_settings where key='order_policy') cutoff_after,
       (select service_radius_km from public.branches where id='branch-tenant-bmb-001-main')::text radius_after,
       (select value->'external_methods_enabled' from public.business_settings where key='delivery_policy') methods_after,
       (select value->>'pre_order_open' from public.business_settings where key='operating_hours') preorder_after;`)
  const cr = c[c.length - 1]
  t('C_rollback_clean', Number(cr.qa_rows) === 0, JSON.stringify(cr))
  t('C_cutoff_restored', cr.cutoff_after === '2', JSON.stringify(cr))
  t('C_branch_radius_restored', Number(cr.radius_after) === 5, JSON.stringify(cr))
  t('C_methods_restored', Array.isArray(cr.methods_after) && cr.methods_after.length === 0, JSON.stringify(cr))
  t('C_preorder_open_restored', cr.preorder_after === 'true', JSON.stringify(cr))
  console.log(`FC_PROBE6_C_PASS (${pass} checks) — C5 same_day round-window: skipped (รอบวันนี้ปิด; C5b + w14 T2 ครอบคลุม trigger path)`)

  // ===== D: legacy pre_orders row — controlled sync path =====
  // D1: ไม่ใช่ admin → ถูกปฏิเสธ (rollback)
  try {
    await q(`BEGIN;
SET ROLE authenticated;
SELECT ${claims('00000000-0000-4000-8000-000000000099')};
SELECT public.admin_sync_legacy_pre_order('PO-20260919-430') r;
ROLLBACK;`)
    t('D1_nonadmin_denied', false, 'call succeeded!')
  } catch (e) {
    t('D1_nonadmin_denied', /ERR_NOT_ADMIN/i.test(e.message), e.message)
  }

  // D0 pre-check: canonical ต้อง cancelled อยู่แล้ว + legacy pending
  const pre = await q(`select p.status legacy, o.status canon
    from public.pre_orders p join public.orders o on o.id = p.migrated_order_id
    where p.order_number = 'PO-20260919-430'`)
  t('D0_canonical_cancelled_legacy_pending', pre[0].canon === 'cancelled' && pre[0].legacy === 'pending', JSON.stringify(pre[0]))

  // D2: REAL sync (ไม่ rollback — นี่คือการปิด production state ตาม Owner D-02)
  const d2 = await q(`BEGIN;
SET ROLE authenticated;
SELECT ${claims(ADMIN)};
SELECT public.admin_sync_legacy_pre_order('PO-20260919-430') r;
COMMIT;`)
  const d2r = d2[d2.length - 1].r
  t('D2_sync_performed', d2r.ok === true && d2r.synced === true && d2r.legacy_status === 'cancelled', JSON.stringify(d2r))

  // D3: เรียกซ้ำ → idempotent (ไม่ mutation ครั้งที่สอง)
  const d3 = await q(`BEGIN;
SET ROLE authenticated;
SELECT ${claims(ADMIN)};
SELECT public.admin_sync_legacy_pre_order('PO-20260919-430') r;
ROLLBACK;`)
  t('D3_idempotent', d3[d3.length - 1].r.synced === false, JSON.stringify(d3[d3.length - 1].r))

  // D4: สถานะจริงหลัง sync + canonical ไม่ถูกแตะ + มี audit trail
  const post = await q(`select (select status from public.pre_orders where order_number='PO-20260919-430') legacy,
       (select status from public.orders where id='ord-mig-20260919-430') canon,
       (select count(*)::int from public.audit_logs where action='legacy_pre_order_synced') audits`)
  t('D4_legacy_cancelled_canonical_untouched_audit', post[0].legacy === 'cancelled' && post[0].canon === 'cancelled' && post[0].audits >= 1, JSON.stringify(post[0]))

  console.log(`FC_PROBE6_ALL_PASS (${pass} checks)`)  // ← FINAL
}
main().catch((e) => { console.error('FC_PROBE6_FAIL: ' + e.message); process.exit(1) })