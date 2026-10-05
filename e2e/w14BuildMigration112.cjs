// ============================================================
// W-1.4 migration generator (audit trail — reproducible)
// ดึง 2 functions จาก PRODUCTION แล้ว patch แบบ anchor-guarded
// สร้าง: supabase/migrations/112_w1_4_admin_delivery_config_no_hardcode.sql
// Owner mandate 2026-10-05: ห้ามฮาร์ดโค้ด 100% — ค่าปกครองอ่านจาก business_settings
// error codes เดิมคงไว้ (asserted by e2e/contracts_023, 028, 037)
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

async function q(sql) {
  const res = await fetch(API, {
    method: 'POST',
    headers: { Authorization: `Bearer ${env.SUPABASE_ACCESS_TOKEN}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ query: sql }),
  })
  const json = await res.json()
  if (!res.ok || json.message) throw new Error('SQL failed: ' + (json.message || res.statusText))
  return json
}

function mustContain(text, anchor, label) {
  if (!text.includes(anchor)) {
    console.error(`ANCHOR MISSING [${label}]: ${anchor.slice(0, 90)}`)
    process.exit(1)
  }
}

function patchFee(def) {
  mustContain(def, 'v_kitchen jsonb;', 'fee-decl')
  mustContain(def, "IF v_method = 'self_delivery' AND v_dist > 5 THEN", 'fee-5km')
  mustContain(def, '-- Fallback: legacy per-method formula (kept until all zones are seeded).', 'fee-fallback')

  let out = def.replace('v_kitchen jsonb;', 'v_kitchen jsonb;\n  v_dp jsonb;')
  out = out.replace(
    'BEGIN\n  IF p_distance_km IS NOT NULL',
    `BEGIN
  -- W-1.4: config from DB (no hardcode)
  SELECT value INTO v_dp FROM public.business_settings WHERE key = 'delivery_policy';
  IF v_dp IS NULL THEN RAISE EXCEPTION 'ERR_CONFIG_MISSING: business_settings.delivery_policy'; END IF;
  IF v_dp->>'bite_drive_radius_km' IS NULL THEN RAISE EXCEPTION 'ERR_CONFIG_MISSING: delivery_policy.bite_drive_radius_km'; END IF;

  IF p_distance_km IS NOT NULL`
  )
  out = out.replace(
    "IF v_method = 'self_delivery' AND v_dist > 5 THEN\n    RAISE EXCEPTION 'SELF_DELIVERY_EXCEEDS_5KM_LIMIT: %', v_dist;\n  END IF;",
    `IF v_method = 'self_delivery' AND v_dist > (v_dp->>'bite_drive_radius_km')::numeric THEN
    RAISE EXCEPTION 'SELF_DELIVERY_EXCEEDS_5KM_LIMIT: % km > delivery_policy.bite_drive_radius_km % km', v_dist, (v_dp->>'bite_drive_radius_km')::numeric;
  END IF;`
  )
  mustContain(out, "bite_drive_radius_km')::numeric THEN", 'fee-radius-patched')

  const legacyStart = out.indexOf('  -- Fallback: legacy per-method formula (kept until all zones are seeded).')
  const legacyEnd = out.indexOf('END;', legacyStart)
  if (legacyStart < 0 || legacyEnd < 0) { console.error('fee legacy block not found'); process.exit(1) }
  out = out.slice(0, legacyStart) +
    `  -- W-1.4: no silent hardcode fallback — admin must cover distance with an active zone
  RAISE EXCEPTION 'ERR_NO_DELIVERY_ZONE: no active delivery_zone covers % km (admin: adjust delivery_zones)', v_dist;
  ` + out.slice(legacyEnd)
  mustContain(out, 'ERR_NO_DELIVERY_ZONE', 'fee-nozone')
  if (/LEAST\(\d/.test(out)) { console.error('fee still contains numeric formula'); process.exit(1) }
  return out
}


function patchCreate(def) {
  const declAnchor = 'v_prod_name text; v_delivery_method text; v_distance numeric;'
  const modeAnchor = "IF v_mode NOT IN ('SAME_DAY', 'PRE_ORDER') THEN RAISE EXCEPTION 'ERR_INVALID_ORDER_MODE'; END IF;"
  const zoneA = "IF v_dist <= 5.00 AND v_delivery_method <> 'self_delivery' THEN RAISE EXCEPTION 'ERR_DELIVERY_METHOD_ZONE'; END IF;"
  const zoneB = "IF v_dist > 5.00 AND v_delivery_method = 'self_delivery' THEN RAISE EXCEPTION 'ERR_DELIVERY_METHOD_ZONE'; END IF;"
  mustContain(def, declAnchor, 'create-decl')
  mustContain(def, modeAnchor, 'create-mode')
  mustContain(def, zoneA, 'create-zoneA')
  mustContain(def, zoneB, 'create-zoneB')

  let out = def.replace(declAnchor, declAnchor + '\n  v_dp_setting jsonb; v_radius numeric;')

  out = out.replace(
    modeAnchor,
    `${modeAnchor}
  -- ===== W-1.4: admin-configurable delivery policy (Owner mandate: NO HARDCODE) =====
  SELECT value INTO v_dp_setting FROM public.business_settings WHERE key = 'delivery_policy';
  IF v_dp_setting IS NULL THEN RAISE EXCEPTION 'ERR_CONFIG_MISSING: business_settings.delivery_policy'; END IF;
  IF v_dp_setting->>'bite_drive_radius_km' IS NULL THEN RAISE EXCEPTION 'ERR_CONFIG_MISSING: delivery_policy.bite_drive_radius_km'; END IF;
  IF v_dp_setting->>'allow_external_within_radius' IS NULL THEN RAISE EXCEPTION 'ERR_CONFIG_MISSING: delivery_policy.allow_external_within_radius'; END IF;
  IF v_dp_setting->'external_methods_enabled' IS NULL THEN RAISE EXCEPTION 'ERR_CONFIG_MISSING: delivery_policy.external_methods_enabled'; END IF;
  v_radius := (v_dp_setting->>'bite_drive_radius_km')::numeric;`
  )

  out = out.replace(
    zoneA,
    `IF v_dist > v_radius AND v_delivery_method = 'self_delivery' THEN RAISE EXCEPTION 'ERR_DELIVERY_METHOD_ZONE'; END IF;

    IF v_dist <= v_radius AND v_delivery_method <> 'self_delivery' AND NOT (v_dp_setting->>'allow_external_within_radius')::boolean THEN RAISE EXCEPTION 'ERR_DELIVERY_METHOD_ZONE'; END IF;

    IF v_delivery_method <> 'self_delivery' AND NOT EXISTS (SELECT 1 FROM jsonb_array_elements_text(v_dp_setting->'external_methods_enabled') em WHERE em = v_delivery_method) THEN RAISE EXCEPTION 'ERR_EXTERNAL_METHOD_DISABLED: %', v_delivery_method; END IF;`
  )
  out = out.replace(zoneB, '')
  mustContain(out, 'v_radius', 'create-radius-used')
  if (/v_dist <= 5\.00|v_dist > 5\.00/.test(out)) { console.error('create still contains 5.00 hardcode'); process.exit(1) }
  return out
}

async function main() {
  const feeRows = await q("select pg_get_functiondef('public.compute_delivery_fee'::regproc) def")
  const createRows = await q("select pg_get_functiondef('public.create_order_with_items'::regproc) def")
  const fee = patchFee(feeRows[0].def).replace(/^\$function\$/m, '$function$;')
  const create = patchCreate(createRows[0].def).replace(/^\$function\$/m, '$function$;')

  const header = `-- ============================================
-- Migration 112 — W-1.4: admin-configurable delivery (NO-HARDCODE mandate, Owner 2026-10-05)
--
-- WHAT (behavior-preserving by default):
--   1. business_settings.delivery_policy gains (seeded only if absent):
--        bite_drive_radius_km         = 5.00  (was hardcoded '5.00'/'5' in 2 functions)
--        allow_external_within_radius = false (was implicit: external banned <= radius)
--        external_methods_enabled     = []    (was implicit: no provider actually live)
--   2. create_order_with_items: zone rules read delivery_policy (was literal 5.00 x2)
--      + rejects external providers not enabled by admin (ERR_EXTERNAL_METHOD_DISABLED)
--   3. compute_delivery_fee: self-radius gate reads delivery_policy (was v_dist > 5);
--      legacy magic formula fallback replaced with ERR_NO_DELIVERY_ZONE
--
-- UNCHANGED:
--   - SAME_DAY on/off: trigger enforce_operating_hours (operating_hours.same_day_open)
--     already enforces it from business_settings — admin editable today, untouched here
--   - error codes SELF_DELIVERY_EXCEEDS_5KM_LIMIT / ERR_DELIVERY_METHOD_ZONE retained
--     (asserted by e2e/contracts_023, 028, 037; default 5.00 keeps contracts identical)
--   - delivery_zones fee rows untouched (admin-editable)
--
-- ADMIN EDIT POINT: /admin/settings JSON keys delivery_policy + operating_hours
-- ROLLBACK: value - 'bite_drive_radius_km' - 'allow_external_within_radius'
--           - 'external_methods_enabled'; restore function defs from c64ed98 (pre-112)
-- VERIFY: node e2e/w14ContractProbe.cjs (BEGIN ... ROLLBACK runtime probes)
-- GENERATED: node e2e/w14BuildMigration112.cjs (reproducible; live defs + anchor guards)
-- ============================================

BEGIN;

-- ----- 1. Seed config (guarded: never overwrite admin's existing values) -----
UPDATE public.business_settings
   SET value = value || jsonb_build_object(
         'bite_drive_radius_km', 5.00,
         'allow_external_within_radius', false,
         'external_methods_enabled', '[]'::jsonb)
 WHERE key = 'delivery_policy'
   AND NOT (value ? 'bite_drive_radius_km');

-- ----- 2. compute_delivery_fee (settings-driven radius; explicit no-zone error) -----
`

  const mid = `

-- ----- 3. create_order_with_items (settings-driven zone + provider gate) -----
`

  const file = header + fee + mid + create + '\nCOMMIT;\n'
  const outPath = path.join(ROOT, 'supabase', 'migrations', '112_w1_4_admin_delivery_config_no_hardcode.sql')
  fs.writeFileSync(outPath, file, 'utf8')
  console.log('WROTE ' + outPath + ' (' + file.split('\n').length + ' lines)')
}

main().catch((e) => { console.error(e.message); process.exit(1) })

