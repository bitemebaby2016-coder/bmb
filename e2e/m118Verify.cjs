'use strict'
// m118Verify — TEXTUAL verify ไฟล์ migration 118 ก่อน apply (ไม่แตะ production)
// เทียบ 3 ทาง: 118 markers ครบ · เสียจาก 117 แค่ 3 บรรทัดที่ถูกแทนที่ · หายจาก 114 เฉพาะที่ตั้งใจไม่ restore
const fs = require('fs')
const path = require('path')
const ROOT = path.resolve(__dirname, '..')
const norm = (s) => String(s).replace(/\r\n/g, '\n')
function extractBody(text) {
  const lines = text.split('\n')
  const si = lines.findIndex((l) => /^AS \$[A-Za-z_]*\$;?$/.test(l))
  if (si < 0) throw new Error('no AS line')
  const tag = lines[si].replace(/^AS /, '').replace(/;$/, '')
  const ei = lines.findIndex((l, i) => i > si && (l === tag + ';' || l === tag))
  if (ei < 0) throw new Error('no closing ' + tag)
  return lines.slice(si + 1, ei)
}
const rd = (p) => norm(fs.readFileSync(path.join(ROOT, 'supabase', 'migrations', p), 'utf8'))
const f118 = rd('118_restore_fc_gates_after_117.sql')
const f117 = rd('117_channel_intake_repair.sql')
const f114 = rd('114_final_config_closure.sql')
const b118 = extractBody(f118), b117 = extractBody(f117), b114 = extractBody(f114)
const body118 = b118.join('\n')
let pass = 0, fail = 0
const t = (n, ok, d) => ok ? (pass++, console.log('PASS ' + n)) : (fail++, console.log('FAIL ' + n + ' :: ' + (d || '')))

// 1) FC markers (112/114) ต้องกลับมา
t('fc1_branch_scoped_policy', body118.includes('branch_id IS NULL OR branch_id = v_resolved_branch_id'))
t('fc3_radius_override', body118.includes('v_radius_override'))
t('fc5_bitedrive_gate', body118.includes('ERR_BITE_DRIVE_DISABLED'))
t('external_methods_gate', body118.includes('ERR_EXTERNAL_METHOD_DISABLED'))
t('allow_external_gate', body118.includes('allow_external_within_radius'))
t('fee_passes_branch', /compute_delivery_fee\([^)]*v_resolved_branch_id\s*\)/s.test(body118))
t('no_hardcoded_500', !body118.includes('5.00'))
// 2) channel intake (117) ต้องคงเดิม
t('sig_18_param', ['p_source_channel text DEFAULT NULL', 'p_external_ref_id text DEFAULT NULL', 'p_customer_ref uuid DEFAULT NULL'].every((s) => f118.includes(s)))
t('channel_validation', body118.includes('ERR_INVALID_SOURCE_CHANNEL') && body118.includes('ERR_FORBIDDEN_CUSTOMER_REF'))
t('duplicate_guard_and_tag', body118.includes('unique_violation') && body118.includes("'duplicate', false"))
// 3) เทียบกับ 117: เสียแค่ 3 บรรทัดที่ถูกแทนที่จริง
const set = (a) => new Set(a.filter((l) => l.trim() !== ''))
const s117 = set(b117), s118 = set(b118), s114 = set(b114)
const lost117 = [...s117].filter((l) => !s118.has(l))
const expectLost = [
  (l) => l.includes('THEN v_distance ELSE NULL END') && !l.includes(','),
  (l) => l.includes('v_dist <= 5.00'),
  (l) => l.includes('v_dist > 5.00'),
]
const badLost = lost117.filter((l) => !expectLost.some((p) => p(l)))
t('117_lost_exactly_3_replaced', lost117.length === 3 && badLost.length === 0, 'lost=' + lost117.length + ' unexpected=' + JSON.stringify(badLost.map((l) => l.slice(0, 80))))
// 4) เทียบกับ 114: หายเฉพาะที่ตั้งใจไม่ restore (auth เดิม/INSERT branch_id/audit+return แบบ channel)
const notRestored = [
  (l) => l.trim() === 'v_uid := auth.uid();',
  (l) => l.trim() === "IF v_uid IS NULL THEN RAISE EXCEPTION 'ERR_NOT_AUTHENTICATED'; END IF;",
  (l) => l.includes('FC-1: config load MOVED'),
  (l) => l.includes('TEN-07 BRANCH RESOLUTION (after auth'),
  (l) => l.trimStart().startsWith('INSERT INTO public.orders') && !l.includes('branch_id'),
  (l) => l.trimStart().startsWith('VALUES (v_order_id') && !l.includes('v_resolved_branch_id)'),
  (l) => l.includes("p_description := 'canonical order created") && !l.includes('[channel'),
  (l) => l.includes('p_metadata := jsonb_build_object') && !l.includes("'source_channel'"),
  (l) => l.includes("'branch_id', v_resolved_branch_id") && !l.includes('duplicate'),
]
const missing114 = [...s114].filter((l) => !s118.has(l))
const bad114 = missing114.filter((l) => !notRestored.some((p) => p(l)))
t('114_missing_only_intentional', bad114.length === 0, JSON.stringify(bad114.map((l) => l.slice(0, 80))))
t('114_missing_count_9', missing114.length === 9, 'got ' + missing114.length + ': ' + JSON.stringify(missing114.map((l) => l.slice(0, 55))))
// 5) ทุกบรรทัดของ FC+zone blocks จาก 114 ต้องอยู่ใน 118
const m114 = f114.split('\n')
const fc1i = m114.findIndex((l) => l.includes('-- ===== FC-1: branch-scoped delivery policy'))
const fcE = m114.findIndex((l, i) => i > fc1i && l.trim() === 'SELECT status, max_capacity, current_count, scheduled_date, cutoff_time')
const fcLines = m114.slice(fc1i, fcE).filter((l) => l.trim() !== '')
const z1 = m114.findIndex((l) => l.includes("IF v_delivery_method = 'self_delivery' AND NOT COALESCE((v_dp_setting->>'bite_drive_enabled')"))
const z2 = m114.findIndex((l, i) => i > z1 && l.includes('ERR_EXTERNAL_METHOD_DISABLED'))
const zLines = m114.slice(z1, z2 + 1).filter((l) => l.trim() !== '')
const missingFc = [...fcLines, ...zLines].filter((l) => !s118.has(l))
t('all_114_fc_lines_in_118', missingFc.length === 0, JSON.stringify(missingFc.map((l) => l.slice(0, 70))))
// 6) signature/head checks
t('pinned_118_header_pending', f118.includes('Owner approval: PENDING'))
t('fee_signature_6args_in_118', f118.includes('REVOKE EXECUTE ON FUNCTION public.create_order_with_items FROM PUBLIC;'))
console.log('M118_VERIFY:', pass + '/' + (pass + fail), fail ? 'HAS FAIL' : 'ALL PASS', '| body ' + b117.length + '→' + b118.length + ' lines')
process.exit(fail ? 1 : 0)
