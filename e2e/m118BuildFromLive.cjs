// m118BuildFromLive — สร้าง migration 118: คืน FC gates (112/114) ที่ migration 117 clobber
// โดยไม่ทำลาย channel-intake semantics ของ 117 — อ่าน prod READ-ONLY, เขียนไฟล์เท่านั้น
// Apply = ต้องได้ Owner อนุมัติเป็นลายลักษณ์อักษรก่อน (script นี้ไม่แตะ prod)
'use strict'
const fs = require('fs')
const path = require('path')
const ROOT = path.resolve(__dirname, '..')
const env = {}
const tokens = []
for (const l of fs.readFileSync(path.join(ROOT, '.env.local'), 'utf8').split(/\r?\n/)) {
  const m = l.match(/^\s*([A-Za-z0-9_]+)\s*=\s*(.*)\s*$/)
  if (m && !l.trim().startsWith('#') && m[2]) {
    if (m[1] === 'SUPABASE_ACCESS_TOKEN') tokens.push(m[2])
    else env[m[1]] = m[2]
  }
}
const REF = 'ivkdfognyiwjcmrhcnwz'
const norm = (s) => String(s).replace(/\r\n/g, '\n')
const count = (hay, needle) => hay.split(needle).length - 1
function mustOnce(where, needle, label) {
  const n = count(where, needle)
  if (n !== 1) throw new Error('anchor [' + label + '] found ' + n + 'x (need exactly 1)')
}
async function q(sql) {
  let last = ''
  for (const tok of [...tokens].reverse()) {
    const r = await fetch('https://api.supabase.com/v1/projects/' + REF + '/database/query', {
      method: 'POST',
      headers: { Authorization: 'Bearer ' + tok, 'Content-Type': 'application/json' },
      body: JSON.stringify({ query: sql }),
    })
    const j = await r.json().catch(() => ({}))
    if (r.ok) return j
    if (r.status === 401 || r.status === 403) { last = 'HTTP ' + r.status; continue }
    throw new Error(JSON.stringify(j).slice(0, 300))
  }
  throw new Error(last || 'no working SUPABASE_ACCESS_TOKEN')
}
// ดึง body ระหว่าง `AS $tag$` กับ `$tag$;`
function extractBody(text) {
  const lines = text.split('\n')
  const si = lines.findIndex((l) => /^AS \$[A-Za-z_]*\$;?$/.test(l))
  if (si < 0) throw new Error('cannot find AS $...$ line')
  const tag = lines[si].replace(/^AS /, '').replace(/;$/, '')
  const ei = lines.findIndex((l, i) => i > si && (l === tag + ';' || l === tag))
  if (ei < 0) throw new Error('cannot find closing ' + tag)
  return { body: lines.slice(si + 1, ei).join('\n'), si, ei, tag }
}

async function main() {
  // ---- preconditions (read-only) ----
  const pol = await q(`select value from public.business_settings where key='delivery_policy' and branch_id is null limit 1`)
  const dp = (pol[0] && pol[0].value) || {}
  for (const k of ['bite_drive_enabled', 'bite_drive_radius_km', 'allow_external_within_radius', 'external_methods_enabled']) {
    if (!(k in dp)) throw new Error('delivery_policy missing key: ' + k)
  }
  console.log('precondition delivery_policy keys: OK', JSON.stringify({
    bite_drive_enabled: dp.bite_drive_enabled, bite_drive_radius_km: dp.bite_drive_radius_km,
    allow_external_within_radius: dp.allow_external_within_radius, external_methods_enabled: dp.external_methods_enabled,
  }))
  const live = norm((await q(`select pg_get_functiondef('public.create_order_with_items'::regproc) d`))[0].d)

  // ---- source of truth: migration 117 file (ต้อง == live) ----
  const p117 = path.join(ROOT, 'supabase', 'migrations', '117_channel_intake_repair.sql')
  const f117 = norm(fs.readFileSync(p117, 'utf8'))
  const b117 = extractBody(f117).body
  const liveBody = extractBody(live).body
  if (liveBody !== b117) throw new Error('live function body != migration 117 file body (live drift — investigate before building 118)')
  console.log('live body == migration 117 file body: OK (' + b117.split('\n').length + ' lines)')
  if (!b117.includes('v_dist <= 5.00')) throw new Error('117 body does not show the hardcoded-5.00 regression')
  if (b117.includes('ERR_BITE_DRIVE_DISABLED')) throw new Error('117 body already has FC-5 — 118 not needed')

  // ---- ดึง FC blocks แบบ verbatim จาก migration 114 ----
  const m114 = norm(fs.readFileSync(path.join(ROOT, 'supabase', 'migrations', '114_final_config_closure.sql'), 'utf8')).split('\n')
  const fc1 = m114.findIndex((l) => l.includes('-- ===== FC-1: branch-scoped delivery policy'))
  const fcEnd = m114.findIndex((l, i) => i > fc1 && l.trim() === 'SELECT status, max_capacity, current_count, scheduled_date, cutoff_time')
  if (fc1 < 0 || fcEnd < 0) throw new Error('cannot locate FC-1/FC-3 block in 114')
  const fcBlock = m114.slice(fc1, fcEnd).join('\n').replace(/\s+$/, '')
  const z1 = m114.findIndex((l) => l.includes("IF v_delivery_method = 'self_delivery' AND NOT COALESCE((v_dp_setting->>'bite_drive_enabled')"))
  const z2 = m114.findIndex((l, i) => i > z1 && l.includes('ERR_EXTERNAL_METHOD_DISABLED'))
  if (z1 < 0 || z2 < 0) throw new Error('cannot locate zone-gate block in 114')
  const zoneBlock = m114.slice(z1, z2 + 1).join('\n').replace(/\s+$/, '')
  console.log('FC block from 114: ' + fcBlock.split('\n').length + ' lines · zone block: ' + zoneBlock.split('\n').length + ' lines')
  return { b117, live, fcBlock, zoneBlock }
}

function build(b117, fcBlock, zoneBlock) {
  let body = b117
  // T1: FC declarations
  mustOnce(body, '  v_resolved_branch_id text; v_resolved_tenant_id text;', 'T1-decl')
  body = body.replace('  v_resolved_branch_id text; v_resolved_tenant_id text;',
    '  v_resolved_branch_id text; v_resolved_tenant_id text;\n  v_dp_setting jsonb; v_radius numeric; v_radius_override numeric;')
  // T2: FC-1 + FC-3 block หลัง branch resolution
  const anchorsB = [
    '  END IF;\n\n  SELECT status, max_capacity, current_count, scheduled_date, cutoff_time',
    '  END IF;\n  \n  SELECT status, max_capacity, current_count, scheduled_date, cutoff_time',
  ]
  const aB = anchorsB.find((a) => count(body, a) === 1)
  if (!aB) throw new Error('T2 anchor not found exactly once')
  body = body.replace(aB, aB.replace('  END IF;\n', '  END IF;\n\n' + fcBlock + '\n'))
  // T3: fee call รับ branch
  const aC = '    CASE WHEN p_dropoff_latitude IS NULL OR p_dropoff_longitude IS NULL THEN v_distance ELSE NULL END\n  );'
  mustOnce(body, aC, 'T3-fee')
  body = body.replace(aC, '    CASE WHEN p_dropoff_latitude IS NULL OR p_dropoff_longitude IS NULL THEN v_distance ELSE NULL END,\n    v_resolved_branch_id\n  );')
  // T4: zone gates แบบ config-driven แทน hardcoded 5.00
  const aD = "    IF v_dist <= 5.00 AND v_delivery_method <> 'self_delivery' THEN RAISE EXCEPTION 'ERR_DELIVERY_METHOD_ZONE'; END IF;\n    IF v_dist > 5.00 AND v_delivery_method = 'self_delivery' THEN RAISE EXCEPTION 'ERR_DELIVERY_METHOD_ZONE'; END IF;"
  mustOnce(body, aD, 'T4-zone')
  body = body.replace(aD, zoneBlock)
  if (body.includes('5.00')) throw new Error('5.00 literal still present after transforms')
  if (!body.includes('p_source_channel') || !body.includes('ERR_FORBIDDEN_CUSTOMER_REF')) throw new Error('channel-intake semantics lost')
  if (!body.includes('ERR_BITE_DRIVE_DISABLED') || !body.includes('v_radius_override')) throw new Error('FC markers missing after transforms')
  return body
}

const HEADER = [
  '-- ============================================================',
  '-- Migration 118 — RESTORE 112/114 ADMIN-CONFIG GATES CLOBBERED BY 117',
  '-- Owner approval: PENDING (ห้าม apply ก่อน Owner อนุมัติเป็นลายลักษณ์อักษร)',
  '-- Defect (ค้นพบ G10 verification 2026-10-07, READ-ONLY): migration 117 สร้าง',
  '--   create_order_with_items จากฐาน 089 ข้าม 112+114 → production สูญเสีย:',
  '--   FC-1 branch-scoped delivery_policy · FC-3 branches.service_radius_km override',
  '--   FC-5 bite_drive_enabled gate (ERR_BITE_DRIVE_DISABLED) · 112 settings-driven zone',
  '--   (hardcoded 5.00 x2 กลับมา) · external_methods_enabled/allow_external_within_radius',
  '--   gates · compute_delivery_fee ไม่ได้ branch arg',
  '-- Evidence: e2e/fcProdVerify FAIL rpc_fc1_fc5_live · e2e/fcVerify114 FAIL',
  '--   create_fc1_branch_scoped_policy · e2e/g10-prod-snapshot.json (FC markers false,',
  '--   hardcoded_500_literal=true) · อ่านเพิ่ม BMB_G10_DEFECT_117_FC_ROLLBACK.md',
  '-- Fix: 117 body (channel-intake คงเดิม) + FC blocks ดึง verbatim จาก 114',
  '--   สร้างโดย e2e/m118BuildFromLive.cjs (anchor-guarded; live == 117 file asserted)',
  '-- Verify ก่อน apply: node e2e/m118Verify.cjs',
  '-- Verify หลัง apply: node e2e/fcVerify114.cjs · node e2e/fcProdVerify.cjs',
  '--   · node e2e/intakeDriftProbe.cjs (18-param ต้องยัง OK)',
  '-- Rollback: apply ใหม่ supabase/migrations/117_channel_intake_repair.sql',
  '-- ============================================================',
  '',
  'BEGIN;',
  '',
].join('\n')

main().then(({ b117, live, fcBlock, zoneBlock }) => {
  const body = build(b117, fcBlock, zoneBlock)
  const xb = extractBody(live)
  const lines = live.split('\n')
  const patched = [...lines.slice(0, xb.si + 1), ...body.split('\n'), ...lines.slice(xb.ei)].join('\n')
  const tail = '\nREVOKE EXECUTE ON FUNCTION public.create_order_with_items FROM PUBLIC;\nGRANT EXECUTE ON FUNCTION public.create_order_with_items TO authenticated;\n\nCOMMIT;\n'
  const out = path.join(ROOT, 'supabase', 'migrations', '118_restore_fc_gates_after_117.sql')
  fs.writeFileSync(out, HEADER + patched + tail)
  console.log('WRITTEN', out)
  console.log('SUMMARY', JSON.stringify({
    body_lines_117: b117.split('\n').length,
    body_lines_118: body.split('\n').length,
    fc_block_lines: fcBlock.split('\n').length,
    zone_block_lines: zoneBlock.split('\n').length,
    has_channel_params: body.includes('p_source_channel'),
    has_fc1: body.includes('branch_id IS NULL OR branch_id = v_resolved_branch_id'),
    has_fc5: body.includes('ERR_BITE_DRIVE_DISABLED'),
    no_500: !body.includes('5.00'),
  }))
}).catch((e) => { console.error('M118_BUILD_FAIL:', String(e.message || e).slice(0, 400)); process.exit(1) })


