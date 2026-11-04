// R65 time-bomb repro — พิสูจน์ว่า fixture เดิมพังตาม timestamp จริงของ CI และ fixture ใหม่ไม่พังเลย
// Evidence → e2e/r65timebombRepro-result.json
//
// Bombs ที่พิสูจน์แล้วจาก CI log จริง:
//   B1 menuScheduleGate (mock cutoff, src/__tests__/helpers/supabaseMock.ts:289-291):
//      startMs = TOMORROW(UTC+1d) 06:00+07:00 · fail เมื่อ now > startMs - 2h
//      boundary = (UTC+1d) 04:00 BKK - 2h = วัน UTC 21:00 → fail ช่วง 21:00–24:00 UTC
//      CI: pass 2026-11-03T20:57:58Z (6012720 unit tests) · fail 2026-11-03T21:03:48Z (e684d87 unit tests)
//   B2 contract 153 G2 (promotion_apply_rules end_date >= CURRENT_DATE(UTC), migration 153:244):
//      fixture เดิม end = BKK_date(run) - 1 → fail เมื่อ BKK_date = UTC_date+1 (ช่วง 17:00–24:00 UTC)
//      CI: fail 2026-11-03T20:57:58Z (contract-153) · pass ~2026-11-03T13:00Z (R64 34dca48)
const fs = require('fs')
const path = require('path')

const HOUR = 3_600_000
const bkkDateISO = (t) => new Date(t + 7 * HOUR).toISOString().slice(0, 10)
const utcDateISO = (t) => new Date(t).toISOString().slice(0, 10)

// ===== B1: mock cutoff gate =====
function b1Gate(nowMs, tomorrowIso) {
  const startMs = new Date(`${tomorrowIso}T06:00:00+07:00`).getTime()
  return nowMs > startMs - 2 * HOUR // true = ERR_CUTOFF_PASSED (FAIL)
}
const b1Old = (nowMs) => b1Gate(nowMs, new Date(nowMs + 86_400_000).toISOString().slice(0, 10))
const b1New = (nowMs) => b1Gate(nowMs, new Date(nowMs + 86_400_000 + 7 * HOUR).toISOString().slice(0, 10))

// ===== B2: contract 153 G2 expired-promo gate =====
function b2Gate(nowMs, endDateIso) {
  const curDate = utcDateISO(nowMs) // CURRENT_DATE = session TZ = UTC
  return endDateIso >= curDate // true = promo valid = discount 10 (FAIL — ต้อง expired)
}
const b2Old = (nowMs) => b2Gate(nowMs, bkkDateISO(nowMs) + '', false) || b2Gate(nowMs, bkkDateISO(nowMs))
// fixture เดิม: end = BKK_date - 1  (คำนวณตอน INSERT = ตอนรัน)
const b2OldEnd = (nowMs) => {
  const d = new Date(bkkDateISO(nowMs) + 'T00:00:00Z')
  d.setUTCDate(d.getUTCDate() - 1)
  return d.toISOString().slice(0, 10)
}
const b2OldFixed = (nowMs) => b2Gate(nowMs, b2OldEnd(nowMs))
const b2NewFixed = (nowMs) => b2Gate(nowMs, '2020-01-01') // fixture ใหม่

// ===== known CI observations =====
const T_UNIT_PASS = Date.parse('2026-11-03T20:57:58Z') // 6012720 unit tests (ก่อน 21:00 UTC)
const T_UNIT_FAIL = Date.parse('2026-11-03T21:03:48Z') // e684d87 unit tests (หลัง 21:00 UTC)
const T_C153_FAIL = Date.parse('2026-11-03T20:57:58Z') // contract-153 ของ 6012720 (ใน window 17-24 UTC)
const T_C153_PASS = Date.parse('2026-11-03T13:00:00Z') // R64 34dca48 contract job (นอก window)

const obs = {
  b1_old_pass_at_unit_pass: b1Old(T_UNIT_PASS) === false,
  b1_old_fail_at_unit_fail: b1Old(T_UNIT_FAIL) === true,
  b1_new_pass_at_unit_pass: b1New(T_UNIT_PASS) === false,
  b1_new_pass_at_unit_fail: b1New(T_UNIT_FAIL) === false,
  b2_old_fail_at_c153_fail: b2OldFixed(T_C153_FAIL) === true,
  b2_old_pass_at_c153_pass: b2OldFixed(T_C153_PASS) === false,
  b2_new_pass_at_c153_fail: b2NewFixed(T_C153_FAIL) === false,
  b2_new_pass_at_c153_pass: b2NewFixed(T_C153_PASS) === false,
}

// ===== sweep 72 ชั่วโมง (ทุกชั่วโมง) จาก 2026-11-03T00:00Z =====
const START = Date.parse('2026-11-03T00:00:00Z')
let b1OldFails = 0, b1NewFails = 0, b2OldFails = 0, b2NewFails = 0, total = 0
for (let t = START; t < START + 72 * HOUR; t += HOUR) {
  total++
  if (b1Old(t)) b1OldFails++
  if (b1New(t)) b1NewFails++
  if (b2OldFixed(t)) b2OldFails++
  if (b2NewFixed(t)) b2NewFails++
}

const out = {
  at: new Date().toISOString(),
  observations: obs,
  sweep72h: { samples: total, b1OldFails, b1NewFails, b2OldFails, b2NewFails },
}
out.ALL_PASS = Object.values(obs).every(Boolean) && b1NewFails === 0 && b2NewFails === 0
  && b1OldFails > 0 && b2OldFails > 0 // bom เดิมพิสูจน์ว่ามีจริงใน sweep
fs.writeFileSync(path.join(__dirname, 'r65timebombRepro-result.json'), JSON.stringify(out, null, 2))
console.log('R65_TIMEBOMB_REPRO ALL_PASS=' + out.ALL_PASS, JSON.stringify(out))
process.exit(out.ALL_PASS ? 0 : 1)