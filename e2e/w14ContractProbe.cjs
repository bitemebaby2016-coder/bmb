// ============================================================
// W-1.4 runtime contract probe — node e2e/w14ContractProbe.cjs
// ทุกเคสอยู่ใน BEGIN ... ROLLBACK ชุดเดียว ไม่มีอะไรค้างใน production
// ต้องจบด้วย: W14_ALL_PASS (ทุก assert ผ่าน + rollback สะอาด)
// ตรวจหลังสมัคร migration 112 (admin-configurable delivery, NO HARDCODE)
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
  if (!res.ok || json.message) throw new Error(String(json.message || res.statusText).slice(0, 3000))
  return json
}

let pass = 0
function t(name, ok, detail) {
  if (!ok) {
    console.error(`FAIL ${name} ${detail || ''}`)
    process.exit(1)
  }
  pass++
  console.log(`PASS ${name}`)
}

async function main() {
  // --- static: definitions post-112 ---
  const defs = await q("select pg_get_functiondef('public.create_order_with_items'::regproc) c, pg_get_functiondef('public.compute_delivery_fee'::regproc) f")
  t('create_no_500_hardcode', !/v_dist\s*<=\s*5\.00|v_dist\s*>\s*5\.00/.test(defs[0].c))
  t('create_reads_settings', defs[0].c.includes('bite_drive_radius_km') && defs[0].c.includes('external_methods_enabled'))
  t('fee_no_legacy_formula', !/LEAST\(\d/.test(defs[0].f))
  t('fee_reads_settings', defs[0].f.includes('ERR_NO_DELIVERY_ZONE'))
  const pol = await q("select value from public.business_settings where key='delivery_policy'")
  const v = pol[0].value
  t('seed_radius_present', Number(v.bite_drive_radius_km) === 5, JSON.stringify(v))
  t('seed_allow_external', v.allow_external_within_radius === false)
  t('seed_methods_empty', Array.isArray(v.external_methods_enabled) && v.external_methods_enabled.length === 0)

  const sql = `
BEGIN;
SELECT set_config('request.jwt.claims', '{"sub":"${ADMIN}","role":"authenticated"}', false);
-- instantiate rounds for today+tomorrow manually (workaround: ensure_rounds_for_date
-- predates delivery_rounds.branch_id NOT NULL — real defect logged in master status doc)
DO $mk$
DECLARE
  v_key text; v_tpl public.delivery_rounds%ROWTYPE; v_id text; v_d date; v_br record;
BEGIN
  SELECT id, tenant_id INTO v_br FROM public.branches WHERE status = 'active'
   ORDER BY is_default DESC, created_at LIMIT 1;
  IF v_br.id IS NULL THEN RAISE EXCEPTION 'SETUP: no active branch'; END IF;
  FOR v_d IN SELECT generate_series(current_date::date, current_date + 1, '1 day'::interval)::date LOOP
    FOREACH v_key IN ARRAY ARRAY['morning','midday','evening'] LOOP
      SELECT * INTO v_tpl FROM public.delivery_rounds
       WHERE COALESCE(round_key, name) = v_key
       ORDER BY scheduled_date DESC NULLS LAST, created_at DESC LIMIT 1;
      IF NOT FOUND THEN RAISE EXCEPTION 'SETUP: round template missing %', v_key; END IF;
      IF v_tpl.cutoff_time IS NULL OR v_tpl.max_capacity IS NULL OR v_tpl.max_capacity <= 0 THEN
        RAISE EXCEPTION 'SETUP: round template invalid %', v_key;
      END IF;
      v_id := 'round-' || to_char(v_d, 'YYYYMMDD') || '-' || v_key;
      INSERT INTO public.delivery_rounds
        (id, round_key, name, display_name, cutoff_time, delivery_start, delivery_end,
         max_capacity, current_count, date, scheduled_date, status, branch_id, tenant_id)
      VALUES (v_id, v_key, v_key, v_tpl.display_name, v_tpl.cutoff_time, v_tpl.delivery_start,
              v_tpl.delivery_end, v_tpl.max_capacity, 0, v_d, v_d, 'active', v_br.id, v_br.tenant_id)
      ON CONFLICT (id) DO NOTHING;
    END LOOP;
  END LOOP;
END $mk$;

DO $$
DECLARE
  v_klat numeric; v_klng numeric;
  v_sd_round text; v_po_round text; v_res jsonb;
  v_far_lng numeric; v_mid_lng numeric; v_near_lng numeric;
BEGIN
  SELECT COALESCE(kitchen_latitude, latitude), COALESCE(kitchen_longitude, longitude)
    INTO v_klat, v_klng FROM public.branches LIMIT 1;
  IF v_klat IS NULL THEN
    SELECT (value->>'latitude')::numeric, (value->>'longitude')::numeric
      INTO v_klat, v_klng FROM public.business_settings WHERE key = 'kitchen_location';
  END IF;

  SELECT id INTO v_sd_round FROM public.delivery_rounds
   WHERE scheduled_date = current_date
     AND cutoff_time > ((now() AT TIME ZONE 'Asia/Bangkok')::time)
   ORDER BY cutoff_time DESC LIMIT 1;
  SELECT id INTO v_po_round FROM public.delivery_rounds
   WHERE scheduled_date = current_date + 1 ORDER BY cutoff_time LIMIT 1;
  IF v_sd_round IS NULL THEN RAISE EXCEPTION 'SETUP: no open SAME_DAY round today'; END IF;
  IF v_po_round IS NULL THEN RAISE EXCEPTION 'SETUP: no PRE_ORDER round tomorrow'; END IF;

  v_far_lng := v_klng + 0.064;   -- ~7 km
  v_mid_lng := v_klng + 0.045;   -- ~4.9 km
  v_near_lng := v_klng + 0.004;  -- ~0.44 km

  -- T1 baseline: PRE_ORDER self ภายในรัศมีต้องสร้างได้ (พฤติกรรมเดิม)
  v_res := public.create_order_with_items('[{"product_id":"prod-5","quantity":1}]'::jsonb, v_po_round, 'self_delivery', 'QA W1.4 address', v_klat, v_klng, 'W14 QA', '0000000000', 'promptpay_qr', '', NULL, 0.0, 'PRE_ORDER', current_date + 1, NULL);
  IF v_res->>'order_number' IS NULL THEN RAISE EXCEPTION 'ASSERT T1: no order_number %', v_res; END IF;

  -- T2 สวิต์ same_day_open=false ต้องปิดรับ SAME_DAY (D-01 toggle ที่มีอยู่แล้ว)
  UPDATE public.business_settings SET value = value || '{"same_day_open":false}'::jsonb WHERE key = 'operating_hours';
  BEGIN
    PERFORM public.create_order_with_items('[{"product_id":"prod-5","quantity":1}]'::jsonb, v_sd_round, 'self_delivery', 'QA W1.4 address', v_klat, v_klng, 'W14 QA', '0000000000', 'promptpay_qr', '', NULL, 0.0, 'SAME_DAY', NULL, NULL);
    RAISE EXCEPTION 'ASSERT T2: SAME_DAY accepted while closed';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM NOT LIKE '%ERR_ORDER_MODE_CLOSED%' THEN RAISE EXCEPTION 'ASSERT T2 wrong error: %', SQLERRM; END IF;
  END;
  UPDATE public.business_settings SET value = value || '{"same_day_open":true}'::jsonb WHERE key = 'operating_hours';

  -- T3 ลดรัศมีเหลือ 1km ผ่าน settings → self ที่ ~4.9km ต้องโดนปฏิเสธ
  UPDATE public.business_settings SET value = value || '{"bite_drive_radius_km":1}'::jsonb WHERE key = 'delivery_policy';
  BEGIN
    PERFORM public.create_order_with_items('[{"product_id":"prod-5","quantity":1}]'::jsonb, v_po_round, 'self_delivery', 'QA W1.4 address', v_klat, v_mid_lng, 'W14 QA', '0000000000', 'promptpay_qr', '', NULL, 0.0, 'PRE_ORDER', current_date + 1, NULL);
    RAISE EXCEPTION 'ASSERT T3: self accepted beyond configured radius';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM NOT LIKE '%ERR_DELIVERY_METHOD_ZONE%' AND SQLERRM NOT LIKE '%SELF_DELIVERY_EXCEEDS%' THEN RAISE EXCEPTION 'ASSERT T3 wrong error: %', SQLERRM; END IF;
  END;
  UPDATE public.business_settings SET value = value || '{"bite_drive_radius_km":5}'::jsonb WHERE key = 'delivery_policy';

  -- T4a external ยังไม่เปิด ([]) → ERR_EXTERNAL_METHOD_DISABLED ที่ ~7km
  BEGIN
    PERFORM public.create_order_with_items('[{"product_id":"prod-5","quantity":1}]'::jsonb, v_po_round, 'grab_rider', 'QA W1.4 address', v_klat, v_far_lng, 'W14 QA', '0000000000', 'promptpay_qr', '', NULL, 0.0, 'PRE_ORDER', current_date + 1, NULL);
    RAISE EXCEPTION 'ASSERT T4a: external accepted while provider disabled';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM NOT LIKE '%ERR_EXTERNAL_METHOD_DISABLED%' THEN RAISE EXCEPTION 'ASSERT T4a wrong error: %', SQLERRM; END IF;
  END;

  -- T4b admin เปิด grab → external เกินรัศมีสร้างได้
  UPDATE public.business_settings SET value = value || '{"external_methods_enabled":["grab_rider"]}'::jsonb WHERE key = 'delivery_policy';
  v_res := public.create_order_with_items('[{"product_id":"prod-5","quantity":1}]'::jsonb, v_po_round, 'grab_rider', 'QA W1.4 address', v_klat, v_far_lng, 'W14 QA', '0000000000', 'promptpay_qr', '', NULL, 0.0, 'PRE_ORDER', current_date + 1, NULL);
  IF v_res->>'order_number' IS NULL THEN RAISE EXCEPTION 'ASSERT T4b: no order_number %', v_res; END IF;

  -- T5 เปิด external ในรัศมี → เลือกวิธีส่งได้ใน ~0.44km (D-01 method choice)
  UPDATE public.business_settings SET value = value || '{"allow_external_within_radius":true}'::jsonb WHERE key = 'delivery_policy';
  v_res := public.create_order_with_items('[{"product_id":"prod-5","quantity":1}]'::jsonb, v_po_round, 'grab_rider', 'QA W1.4 address', v_klat, v_near_lng, 'W14 QA', '0000000000', 'promptpay_qr', '', NULL, 0.0, 'PRE_ORDER', current_date + 1, NULL);
  IF v_res->>'order_number' IS NULL THEN RAISE EXCEPTION 'ASSERT T5: no order_number %', v_res; END IF;

  -- T6 คืน default → external ในรัศมีต้องโดนปฏิเสธอีกครั้ง (พฤติกรรมเดิม)
  UPDATE public.business_settings SET value = value || '{"allow_external_within_radius":false,"external_methods_enabled":[]}'::jsonb WHERE key = 'delivery_policy';
  BEGIN
    PERFORM public.create_order_with_items('[{"product_id":"prod-5","quantity":1}]'::jsonb, v_po_round, 'grab_rider', 'QA W1.4 address', v_klat, v_near_lng, 'W14 QA', '0000000000', 'promptpay_qr', '', NULL, 0.0, 'PRE_ORDER', current_date + 1, NULL);
    RAISE EXCEPTION 'ASSERT T6: external within radius accepted with defaults';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM NOT LIKE '%ERR_DELIVERY_METHOD_ZONE%' THEN RAISE EXCEPTION 'ASSERT T6 wrong error: %', SQLERRM; END IF;
  END;

  -- T7 fee ไม่มี zone คลุม 99km → ERR_NO_DELIVERY_ZONE (ไม่ fallback สูตรลับ)
  BEGIN
    PERFORM public.compute_delivery_fee(NULL, NULL, 'grab_rider', 1, 99);
    RAISE EXCEPTION 'ASSERT T7: fee returned without zone';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM NOT LIKE '%ERR_NO_DELIVERY_ZONE%' THEN RAISE EXCEPTION 'ASSERT T7 wrong error: %', SQLERRM; END IF;
  END;

  -- T8 ขาดค่า config → ERR_CONFIG_MISSING (ไม่ hardcode เงียบ ๆ)
  UPDATE public.business_settings SET value = value - 'bite_drive_radius_km' WHERE key = 'delivery_policy';
  BEGIN
    PERFORM public.create_order_with_items('[{"product_id":"prod-5","quantity":1}]'::jsonb, v_po_round, 'self_delivery', 'QA W1.4 address', v_klat, v_klng, 'W14 QA', '0000000000', 'promptpay_qr', '', NULL, 0.0, 'PRE_ORDER', current_date + 1, NULL);
    RAISE EXCEPTION 'ASSERT T8: accepted without radius config';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM NOT LIKE '%ERR_CONFIG_MISSING%' THEN RAISE EXCEPTION 'ASSERT T8 wrong error: %', SQLERRM; END IF;
  END;
  UPDATE public.business_settings SET value = value || '{"bite_drive_radius_km":5}'::jsonb WHERE key = 'delivery_policy';
END $$;

ROLLBACK;

SELECT (SELECT count(*) FROM public.orders WHERE customer_name = 'W14 QA') AS qa_rows_left,
       (SELECT value->>'bite_drive_radius_km' FROM public.business_settings WHERE key = 'delivery_policy') AS radius_after,
       (SELECT value->>'same_day_open' FROM public.business_settings WHERE key = 'operating_hours') AS sameday_after,
       (SELECT value->'external_methods_enabled' FROM public.business_settings WHERE key = 'delivery_policy') AS methods_after;
`
  const r = await q(sql)
  const last = r[r.length - 1]
  t('all_runtime_asserts_passed', last && Number(last.qa_rows_left) === 0, JSON.stringify(last))
  t('rollback_restored_radius', last && Number(last.radius_after) === 5, JSON.stringify(last))
  t('rollback_restored_sameday', last && last.sameday_after === 'true', JSON.stringify(last))
  t('rollback_restored_methods', last && Array.isArray(last.methods_after) && last.methods_after.length === 0, JSON.stringify(last))
  console.log(`W14_ALL_PASS (${pass} checks)`)
}

main().catch((e) => { console.error('W14_FAIL: ' + e.message); process.exit(1) })
