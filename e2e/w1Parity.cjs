// W-1 — เทียบ schema snapshot: fresh replay (ท้องถิ่น) vs production (read-only)
//   node e2e/w1Parity.cjs [stamp]
// ผล = e2e/w1-parity-<stamp>.json + สรุป stdout
// **Normalisation (ความต่างเชิงรูปแบบเท่านั้น — ไม่ใช่ schema drift):**
//   1. policies.roles — Management API คืน text[] เป็นสตรี {'a','b'} แต่ psql/json_agg คืน array → ปรับเป็นชุดเดียวกัน
//   2. ledger.name — production บันทึกชื่อโดยไม่มี prefix เลข (initial_schema) replay บันทึกชื่อไฟล์ (001_initial_schema)
//      → เทียบ "version" (หัวใจของ parity) และเทียบ name หลังตัด prefix
//   3. functions.body_md5 — ค่าดิบต่างเพราะ CRLF/ช่องว่างท้ายบรรทัด → เทียบ body_md5_norm (ตัด \r + ช่องว่างท้ายบรรทัด)
//   4. meta = ข้อมูล environment (server/db) ไม่นับเป็น drift
// ทุก drift ที่เหลือ = ต้องมีคำอธิบาย + แผน ใน BMB_MASTER_STATUS §4
const fs = require('fs');
const path = require('path');

const stamp = process.argv[2] || '2026-10-26';
const read = (f) => JSON.parse(fs.readFileSync(path.join(__dirname, f), 'utf8'));
const local = read(`w1-local-snapshot-${stamp}.json`);
const prod = read(`w1-prod-snapshot-${stamp}.json`);

const stripBraces = (s) => String(s).replace(/^\{|\}$/g, '').split(',').filter(Boolean);
function normalize(label, row) {
  const r = { ...row };
  if (label === 'policies') {
    r.roles = Array.isArray(r.roles) ? [...r.roles].sort().join('|') : stripBraces(r.roles).sort().join('|');
  }
  if (label === 'ledger') {
    r.nameNorm = String(r.name).replace(/^\d+_/, '');
    delete r.name;
  }
  if (label === 'functions' && r.body_md5_norm) { r.body_md5 = r.body_md5_norm; delete r.body_md5_norm; }
  if (label === 'meta') return r;
  return r;
}

const key = (row) => JSON.stringify(Object.keys(row).sort().map((k) => [k, row[k] ?? null]));
const tally = (rows) => {
  const m = new Map();
  for (const r of rows) { const k = key(r); m.set(k, (m.get(k) || 0) + 1); }
  return m;
};

const labels = [...new Set([...Object.keys(local.rows), ...Object.keys(prod.rows)])].sort();
const report = {
  stamp,
  generatedAt: new Date().toISOString(),
  localCapturedAt: local.capturedAt,
  prodCapturedAt: prod.capturedAt,
  scope: "schema 'public' เท่านั้น — auth/storage/realtime = Supabase-managed + prelude stubs (เทียบไม่ได้) → ตัดออก",
  normalization: ['policies.roles: {a,b} vs array', 'ledger.name: strip numeric prefix (เทียบ version)', 'functions.body_md5 = หลังตัด \\r + trailing space', 'meta = info'],
  labels: {},
  queryErrors: { local: local.errors || {}, prod: prod.errors || {} },
};

const driftLabels = [];
for (const label of labels) {
  const a = local.rows[label];
  const b = prod.rows[label];
  const info = label === 'meta';
  if (!a || !b) {
    report.labels[label] = { status: 'MISSING_ON_' + (a ? 'PROD' : 'LOCAL'), info };
    if (!info) driftLabels.push(label);
    continue;
  }
  const na = a.map((r) => normalize(label, r));
  const nb = b.map((r) => normalize(label, r));
  const ma = tally(na), mb = tally(nb);
  const onlyLocal = [], onlyProd = [];
  for (const [k, n] of ma) { const d = n - (mb.get(k) || 0); if (d > 0) onlyLocal.push({ row: JSON.parse(k), count: d }); }
  for (const [k, n] of mb) { const d = n - (ma.get(k) || 0); if (d > 0) onlyProd.push({ row: JSON.parse(k), count: d }); }
  const status = onlyLocal.length || onlyProd.length ? 'DRIFT' : 'MATCH';
  report.labels[label] = { status, info, localRows: a.length, prodRows: b.length, onlyLocal, onlyProd };
  if (status === 'DRIFT' && !info) driftLabels.push(label);
}

report.verdict = driftLabels.length ? 'DRIFT' : 'PASS';
report.driftLabels = driftLabels;

const out = path.join(__dirname, `w1-parity-${stamp}.json`);
fs.writeFileSync(out, JSON.stringify(report, null, 2));

for (const label of labels) {
  const r = report.labels[label];
  const n = (r.onlyLocal || []).length + (r.onlyProd || []).length;
  console.log(`${label.padEnd(14)} ${r.status}${r.info ? ' (info)' : ''}  local=${r.localRows ?? '-'} prod=${r.prodRows ?? '-'} diff=${n}`);
}
console.log(`VERDICT=${report.verdict}  drift=${driftLabels.join(',') || 'none'}`);
console.log(`WROTE ${out}`);