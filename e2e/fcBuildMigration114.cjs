// ============================================================
// fcBuildMigration114 — สร้าง supabase/migrations/114_final_config_closure.sql
// จาก live defs (prod) ด้วย anchor-guarded replace (ทุก anchor ต้องเจอ exact ครั้งเดียว)
// FC-1..FC-5 + guarded seeds + retire radius_km + admin_sync_legacy_pre_order
// ไม่เปลี่ยน business rule: default ทุกตัว = พฤติกรรมเดิม
// ============================================================
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
function rep(text, anchor, replacement, name) {
  const n = text.split(anchor).length - 1
  if (n !== 1) throw new Error(`ANCHOR ${name}: found ${n}x (must be 1)`)
  return text.replace(anchor, replacement)
}

const FEE_NEW = `CREATE OR REPLACE FUNCTION public.compute_delivery_fee(p_dropoff_latitude numeric, p_dropoff_longitude numeric, p_delivery_method text DEFAULT 'self_delivery'::text, p_items_count integer DEFAULT 1, p_distance_km numeric DEFAULT NULL::numeric, p_branch_id text DEFAULT NULL::text)
 RETURNS numeric
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_dist    numeric;
  v_fee     numeric;
  v_kitchen jsonb;
  v_dp jsonb;
  v_method  text := COALESCE(p_delivery_method, 'self_delivery');
  v_radius  numeric;
  v_br      numeric;
BEGIN
  -- W-1.4: config from DB (no hardcode)
  SELECT value INTO v_dp FROM public.business_settings WHERE key = 'delivery_policy';
  IF v_dp IS NULL THEN RAISE EXCEPTION 'ERR_CONFIG_MISSING: business_settings.delivery_policy'; END IF;
  IF v_dp->>'bite_drive_radius_km' IS NULL THEN RAISE EXCEPTION 'ERR_CONFIG_MISSING: delivery_policy.bite_drive_radius_km'; END IF;
  v_radius := (v_dp->>'bite_drive_radius_km')::numeric;
  -- FC-3: branch-specific radius canonical (branches.service_radius_km) เมื่อมี branch context
  IF p_branch_id IS NOT NULL THEN
    SELECT b.service_radius_km INTO v_br FROM public.branches b WHERE b.id = p_branch_id;
    IF v_br IS NOT NULL AND v_br > 0 THEN v_radius := v_br; END IF;
  END IF;

  IF p_distance_km IS NOT NULL AND p_distance_km > 0 THEN
    v_dist := p_distance_km;
  ELSIF p_dropoff_latitude IS NOT NULL AND p_dropoff_longitude IS NOT NULL THEN
    v_kitchen := public.kitchen_location();
    v_dist := public.haversine_km(
      (v_kitchen->>'latitude')::numeric, (v_kitchen->>'longitude')::numeric,
      p_dropoff_latitude, p_dropoff_longitude
    );
  ELSE
    v_dist := 0;
  END IF;

  -- server-side self-delivery radius gate (canonical = branch override > delivery_policy)
  IF v_method = 'self_delivery' AND v_dist > v_radius THEN
    RAISE EXCEPTION 'SELF_DELIVERY_EXCEEDS_5KM_LIMIT: % km > configured radius % km', v_dist, v_radius;
  END IF;

  SELECT fee INTO v_fee
    FROM public.delivery_zones
   WHERE is_active = true
     AND (p_branch_id IS NULL OR branch_id = p_branch_id OR branch_id IS NULL)
     AND v_dist >= min_distance_km
     AND v_dist <= max_distance_km
   ORDER BY (branch_id IS NULL) ASC, max_distance_km ASC
   LIMIT 1;

  IF v_fee IS NOT NULL THEN
    RETURN v_fee;
  END IF;

  -- W-1.4: no silent hardcode fallback — admin must cover distance with an active zone
  RAISE EXCEPTION 'ERR_NO_DELIVERY_ZONE: no active delivery_zone covers % km (admin: adjust delivery_zones)', v_dist;
  END;
$function$`
const WRAPPER_NEW = `CREATE OR REPLACE FUNCTION public.compute_delivery_fee_rpc(p_dropoff_latitude numeric DEFAULT NULL::numeric, p_dropoff_longitude numeric DEFAULT NULL::numeric, p_delivery_method text DEFAULT 'self_delivery'::text, p_items_count integer DEFAULT 1, p_distance_km numeric DEFAULT NULL::numeric, p_branch_id text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_uid uuid;
BEGIN
  v_uid := auth.uid();
  IF v_uid IS NULL THEN RAISE EXCEPTION 'ERR_NOT_AUTHENTICATED'; END IF;
  RETURN jsonb_build_object(
    'delivery_fee', public.compute_delivery_fee(p_dropoff_latitude, p_dropoff_longitude, p_delivery_method, p_items_count, p_distance_km, p_branch_id),
    'method', COALESCE(p_delivery_method, 'self_delivery')
  );
END;
$function$`

const SYNC_FN = `CREATE OR REPLACE FUNCTION public.admin_sync_legacy_pre_order(p_order_number text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_role    text;
  v_legacy  public.pre_orders%ROWTYPE;
  v_status  text;
BEGIN
  -- controlled admin path (PART5): sync legacy archive row FROM canonical authority
  -- gate: platform/tenant admin (authenticated JWT) หรือ trusted role (service/postgres)
  v_role := COALESCE(NULLIF(current_setting('request.jwt.claims', true), '')::jsonb->>'role', current_user);
  IF v_role NOT IN ('service_role', 'postgres') THEN
    IF NOT public.is_admin() THEN RAISE EXCEPTION 'ERR_NOT_ADMIN'; END IF;
  END IF;

  IF p_order_number IS NULL OR trim(p_order_number) = '' THEN RAISE EXCEPTION 'ERR_MISSING_ORDER'; END IF;

  SELECT * INTO v_legacy FROM public.pre_orders WHERE order_number = p_order_number FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'ERR_ORDER_NOT_FOUND: %', p_order_number; END IF;
  IF v_legacy.migrated_order_id IS NULL THEN
    RAISE EXCEPTION 'ERR_NOT_MIGRATED: legacy-only rows go through cancel_pre_order';
  END IF;
  IF v_legacy.status <> 'pending' THEN
    RETURN jsonb_build_object('ok', true, 'order_number', p_order_number,
      'legacy_status', v_legacy.status, 'synced', false, 'note', 'already terminal');
  END IF;

  SELECT o.status INTO v_status
    FROM public.orders o WHERE o.id = v_legacy.migrated_order_id;
  IF v_status IS NULL THEN RAISE EXCEPTION 'ERR_CANONICAL_MISSING: %', v_legacy.migrated_order_id; END IF;
  IF v_status NOT IN ('cancelled', 'delivered', 'refunded') THEN
    RAISE EXCEPTION 'ERR_CANONICAL_NOT_TERMINAL: canonical=% (use cancel_order first)', v_status;
  END IF;

  UPDATE public.pre_orders
     SET status = v_status,
         cancelled_at = CASE WHEN v_status = 'cancelled'
                             THEN COALESCE(v_legacy.cancelled_at, now()) END,
         updated_at = now()
   WHERE id = v_legacy.id;

  PERFORM public.append_audit_log(p_action := 'legacy_pre_order_synced', p_entity_type := 'pre_order',
    p_entity_id := p_order_number,
    p_description := 'legacy archive row synced from canonical authority (controlled admin path)',
    p_metadata := jsonb_build_object('canonical_status', v_status, 'from', 'pending'));

  RETURN jsonb_build_object('ok', true, 'order_number', p_order_number,
    'legacy_status', v_status, 'synced', true);
END;
$function$`
async function main() {
  const defs = await q(`select proname, pg_get_functiondef(p.oid) d from pg_proc p
    where p.pronamespace='public'::regnamespace
      and p.proname in ('create_order_with_items','enforce_pre_order_window','enforce_pre_order_cancel_window')`)
  const get = (n) => {
    const r = defs.find((x) => x.proname === n)
    if (!r) throw new Error('missing ' + n)
    return r.d.replace(/\r\n/g, '\n')
  }

  // ---- create_order_with_items (FC-1/2/3/5 + fee branch arg) ----
  let co = get('create_order_with_items')
  co = rep(co,
    `  v_dp_setting jsonb; v_radius numeric;`,
    `  v_dp_setting jsonb; v_radius numeric; v_radius_override numeric;`,
    'co-declare')
  co = rep(co,
    `  -- ===== W-1.4: admin-configurable delivery policy (Owner mandate: NO HARDCODE) =====
  SELECT value INTO v_dp_setting FROM public.business_settings WHERE key = 'delivery_policy';
  IF v_dp_setting IS NULL THEN RAISE EXCEPTION 'ERR_CONFIG_MISSING: business_settings.delivery_policy'; END IF;
  IF v_dp_setting->>'bite_drive_radius_km' IS NULL THEN RAISE EXCEPTION 'ERR_CONFIG_MISSING: delivery_policy.bite_drive_radius_km'; END IF;
  IF v_dp_setting->>'allow_external_within_radius' IS NULL THEN RAISE EXCEPTION 'ERR_CONFIG_MISSING: delivery_policy.allow_external_within_radius'; END IF;
  IF v_dp_setting->'external_methods_enabled' IS NULL THEN RAISE EXCEPTION 'ERR_CONFIG_MISSING: delivery_policy.external_methods_enabled'; END IF;
  v_radius := (v_dp_setting->>'bite_drive_radius_km')::numeric;`,
    `  -- FC-1: config load MOVED below — รอ branch resolution เพื่อ branch-scoped policy`,
    'co-remove-config-load')
  co = rep(co,
    `  END IF;

  SELECT status, max_capacity, current_count, scheduled_date, cutoff_time`,
    `  END IF;

  -- ===== FC-1: branch-scoped delivery policy (tenant global default + branch override ผ่าน business_settings.branch_id) =====
  SELECT value INTO v_dp_setting FROM public.business_settings
   WHERE key = 'delivery_policy'
     AND (branch_id IS NULL OR branch_id = v_resolved_branch_id)
   ORDER BY (branch_id IS NULL) ASC
   LIMIT 1;
  IF v_dp_setting IS NULL THEN RAISE EXCEPTION 'ERR_CONFIG_MISSING: business_settings.delivery_policy'; END IF;
  IF v_dp_setting->>'bite_drive_radius_km' IS NULL THEN RAISE EXCEPTION 'ERR_CONFIG_MISSING: delivery_policy.bite_drive_radius_km'; END IF;
  IF v_dp_setting->>'allow_external_within_radius' IS NULL THEN RAISE EXCEPTION 'ERR_CONFIG_MISSING: delivery_policy.allow_external_within_radius'; END IF;
  IF v_dp_setting->'external_methods_enabled' IS NULL THEN RAISE EXCEPTION 'ERR_CONFIG_MISSING: delivery_policy.external_methods_enabled'; END IF;
  v_radius := (v_dp_setting->>'bite_drive_radius_km')::numeric;
  -- ===== FC-3: branch radius canonical = branches.service_radius_km (override เมื่อ > 0) =====
  IF v_resolved_branch_id IS NOT NULL THEN
    SELECT b.service_radius_km INTO v_radius_override FROM public.branches b WHERE b.id = v_resolved_branch_id;
    IF v_radius_override IS NOT NULL AND v_radius_override > 0 THEN v_radius := v_radius_override; END IF;
  END IF;

  SELECT status, max_capacity, current_count, scheduled_date, cutoff_time`,
    'co-insert-config-load')
  co = rep(co,
    `    IF v_dist > v_radius AND v_delivery_method = 'self_delivery' THEN RAISE EXCEPTION 'ERR_DELIVERY_METHOD_ZONE'; END IF;`,
    `    IF v_delivery_method = 'self_delivery' AND NOT COALESCE((v_dp_setting->>'bite_drive_enabled')::boolean, true) THEN
      RAISE EXCEPTION 'ERR_BITE_DRIVE_DISABLED';
    END IF;
    IF v_dist > v_radius AND v_delivery_method = 'self_delivery' THEN RAISE EXCEPTION 'ERR_DELIVERY_METHOD_ZONE'; END IF;`,
    'co-bitedrive-gate')
  co = rep(co,
    `  v_delivery_fee := public.compute_delivery_fee(
    p_dropoff_latitude, p_dropoff_longitude,
    v_delivery_method, v_items_total_qty,
    CASE WHEN p_dropoff_latitude IS NULL OR p_dropoff_longitude IS NULL THEN v_distance ELSE NULL END
  );`,
    `  v_delivery_fee := public.compute_delivery_fee(
    p_dropoff_latitude, p_dropoff_longitude,
    v_delivery_method, v_items_total_qty,
    CASE WHEN p_dropoff_latitude IS NULL OR p_dropoff_longitude IS NULL THEN v_distance ELSE NULL END,
    v_resolved_branch_id
  );`,
    'co-fee-branch-arg')
  // ---- enforce_pre_order_window (FC-4 cutoff_hours) ----
  let w = get('enforce_pre_order_window')
  w = rep(w, `  v_cutoff_ts timestamp;`, `  v_cutoff_ts timestamp;
  v_cutoff_hours numeric;`, 'w-declare')
  w = rep(w, `  v_cutoff_ts := NEW.scheduled_date::timestamp + (v_start - interval '2 hours');`,
    `  -- FC-4: cutoff ชม. จาก order_policy.cutoff_hours (default 2 = พฤติกรรมเดิม)
  -- NOTE: บวกลบเป็น timestamp ก่อนเพื่อไม่ให้ time- arithmetic wrap mod 24h (ค่า > start time ใช้การได้)
  v_cutoff_hours := COALESCE(public.order_setting('cutoff_hours', 2), 2);
  v_cutoff_ts := NEW.scheduled_date::timestamp + v_start - (v_cutoff_hours * interval '1 hour');`,
    'w-cutoff')

  // ---- enforce_pre_order_cancel_window (FC-4) ----
  let c = get('enforce_pre_order_cancel_window')
  c = rep(c, `  v_cutoff_ts timestamp;`, `  v_cutoff_ts timestamp;
  v_cutoff_hours numeric;`, 'c-declare')
  c = rep(c, `  v_cutoff_ts := OLD.scheduled_date::timestamp + (v_start - interval '2 hours');`,
    `  -- FC-4: cutoff ชม. จาก order_policy.cutoff_hours (default 2 = พฤติกรรมเดิม)
  -- NOTE: บวกลบเป็น timestamp ก่อนเพื่อไม่ให้ time- arithmetic wrap mod 24h (ค่า > start time ใช้การได้)
  v_cutoff_hours := COALESCE(public.order_setting('cutoff_hours', 2), 2);
  v_cutoff_ts := OLD.scheduled_date::timestamp + v_start - (v_cutoff_hours * interval '1 hour');`,
    'c-cutoff')
  const sql = `-- ============================================================
-- Migration 114 — FINAL CONFIGURATION CLOSURE (Owner APPROVED 2026-10-05)
-- สร้างโดย e2e/fcBuildMigration114.cjs จาก live defs ณ HEAD 619e805 (anchor-guarded)
-- FC-1 branch-scoped delivery_policy (business_settings.branch_id มีอยู่แล้ว — ไม่สร้าง key ใหม่)
-- FC-2 config load หลัง branch resolution
-- FC-3 branch radius canonical = branches.service_radius_km (มีอยู่แล้ว — ไม่ duplicate source)
-- FC-4 cutoff_hours จาก order_policy (default 2 = พฤติกรรมเดิม — ย้ายที่เก็บค่า ไม่ย้าย rule)
-- FC-5 Bite Drive enable/disable = delivery_policy.bite_drive_enabled (default true)
-- SEEDS: guarded merge เฉพาะ key ที่ยังไม่มี (ไม่ทับค่า Admin) + brands.theme_tokens.glass
-- RETIRE: delivery_policy.radius_km (precondition: 0 function consumers — e2e/fcAudit2.cjs)
-- NEW: admin_sync_legacy_pre_order (controlled admin path สำหรับ legacy archive row — ไม่ bypass canonical)
-- ============================================================
BEGIN;

-- ---- 1: create_order_with_items ----
${co};
-- ---- 4: enforce_pre_order_window ----
${w};
-- ---- 5: enforce_pre_order_cancel_window ----
${c};
-- ---- 6: fee ใหม่ (branch-aware) ----
${FEE_NEW};
-- ---- 7: wrapper passthrough ----
${WRAPPER_NEW};
-- ---- 8: drop signature เก่า (หลังสร้างใหม่ — callers rebind ด้วย default p_branch_id) ----
DROP FUNCTION IF EXISTS public.compute_delivery_fee(numeric, numeric, text, integer, numeric);
DROP FUNCTION IF EXISTS public.compute_delivery_fee_rpc(numeric, numeric, text, integer, numeric);
-- ---- 9: controlled legacy sync path ----
${SYNC_FN};
REVOKE ALL ON FUNCTION public.admin_sync_legacy_pre_order(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_sync_legacy_pre_order(text) TO authenticated, service_role;
REVOKE ALL ON FUNCTION public.compute_delivery_fee(numeric, numeric, text, integer, numeric, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.compute_delivery_fee(numeric, numeric, text, integer, numeric, text) TO anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.compute_delivery_fee_rpc(numeric, numeric, text, integer, numeric, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.compute_delivery_fee_rpc(numeric, numeric, text, integer, numeric, text) TO authenticated, service_role;
-- ---- 10: guarded seeds (merge เฉพาะ key ที่ขาด — ไม่ทับค่า Admin) ----
UPDATE public.business_settings
   SET value = value || CASE WHEN NOT (value ? 'bite_drive_enabled') THEN '{"bite_drive_enabled":true}'::jsonb ELSE '{}'::jsonb END
                            || CASE WHEN NOT (value ? 'tier2_markup_pct') THEN '{"tier2_markup_pct":12}'::jsonb ELSE '{}'::jsonb END
                            || CASE WHEN NOT (value ? 'free_shipping_threshold') THEN '{"free_shipping_threshold":300}'::jsonb ELSE '{}'::jsonb END,
       updated_at = now()
 WHERE key = 'delivery_policy';
UPDATE public.business_settings
   SET value = value || CASE WHEN NOT (value ? 'cutoff_hours') THEN '{"cutoff_hours":2}'::jsonb ELSE '{}'::jsonb END
                            || CASE WHEN NOT (value ? 'daily_quota') THEN '{"daily_quota":120}'::jsonb ELSE '{}'::jsonb END,
       updated_at = now()
 WHERE key = 'order_policy';
UPDATE public.brands
   SET theme_tokens = theme_tokens || CASE WHEN NOT (theme_tokens ? 'glass')
     THEN '{"glass":{"bg":"rgba(255,255,255,0.7)","blur":"12px","border":"rgba(255,255,255,0.2)","text":"#1f2937","shadow":"drop-shadow(0 15px 12px rgba(0,0,0,0.18))"}}'::jsonb
     ELSE '{}'::jsonb END,
       updated_at = now()
 WHERE id = (SELECT id FROM public.brands WHERE is_default ORDER BY created_at LIMIT 1);
-- ---- 11: retire legacy dead key (precondition = 0 function consumers ยืนยันโดย e2e/fcAudit2.cjs) ----
UPDATE public.business_settings
   SET value = value - 'radius_km', updated_at = now()
 WHERE key = 'delivery_policy' AND value ? 'radius_km';

COMMIT;
`
  const out = path.join(ROOT, 'supabase', 'migrations', '114_final_config_closure.sql')
  fs.writeFileSync(out, sql)
  console.log('WROTE ' + out + ' (' + sql.length + ' chars)')
}
main().catch((e) => { console.error('BUILD114_FAIL: ' + e.message); process.exit(1) })