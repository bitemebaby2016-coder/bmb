// W-1 — อ่าน schema ไปเก็บเป็น snapshot (READ-ONLY ทั้งสองโหมด)
//   node e2e/w1Snapshot.cjs prod     → production ผ่าน Supabase Management API (SELECT เท่านั้น)
//   node e2e/w1Snapshot.cjs local    → replay DB ใน docker container (ค่าเริ่มต้น bmb_replay_w1)
// ผลลัพธ์ = e2e/w1-<mode>-snapshot-<stamp>.json — ห้ามแก้ผลหลังรัน (evidence)
const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');
const { QUERIES } = require('./w1SchemaQueries.cjs');

const mode = process.argv[2];
if (mode !== 'prod' && mode !== 'local') {
  console.error('usage: node e2e/w1Snapshot.cjs <prod|local> [stamp]');
  process.exit(2);
}
const stamp = process.argv[3] || '2026-10-26';
const container = process.env.W1_CONTAINER || 'bmb_replay_w1';
const outPath = path.join(__dirname, `w1-${mode}-snapshot-${stamp}.json`);
const root = path.join(__dirname, '..');

const result = { mode, stamp, capturedAt: new Date().toISOString(), rows: {}, errors: {} };

async function runProd() {
  const env = fs.readFileSync(path.join(root, '.env.local'), 'utf8');
  const token = (/^SUPABASE_ACCESS_TOKEN=(.*)$/m.exec(env) || [])[1];
  if (!token) throw new Error('NO_ACCESS_TOKEN');
  const REF = 'ivkdfognyiwjcmrhcnwz';
  for (const q of QUERIES) {
    const r = await fetch(`https://api.supabase.com/v1/projects/${REF}/database/query`, {
      method: 'POST',
      headers: { Authorization: 'Bearer ' + token, 'Content-Type': 'application/json' },
      body: JSON.stringify({ query: q.sql }),
    });
    const body = await r.text();
    if (r.status >= 400) {
      result.errors[q.label] = `status=${r.status} ${body.slice(0, 400)}`;
      continue;
    }
    let parsed;
    try { parsed = JSON.parse(body); } catch { result.errors[q.label] = 'unparsable body'; continue; }
    if (!Array.isArray(parsed)) { result.errors[q.label] = 'unexpected shape'; continue; }
    result.rows[q.label] = parsed;
    console.log(`[prod:${q.label}] rows=${parsed.length}`);
  }
}

function runLocal() {
  const wrapped = (sql) => `SELECT COALESCE(json_agg(t), '[]'::json) FROM (${sql}) t`;
  for (const q of QUERIES) {
    const r = spawnSync('docker', [
      'exec', container, 'psql', '-X', '-U', 'postgres', '-d', 'bmb_replay',
      '-A', '-t', '-v', 'ON_ERROR_STOP=1', '-c', wrapped(q.sql),
    ], { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
    if (r.status !== 0) {
      result.errors[q.label] = `exit=${r.status} ${(r.stderr || '').slice(0, 400)}`;
      console.error(`[local:${q.label}] FAIL ${result.errors[q.label]}`);
      continue;
    }
    const out = (r.stdout || '').trim();
    try {
      result.rows[q.label] = JSON.parse(out);
    } catch {
      result.errors[q.label] = `bad json: ${out.slice(0, 200)}`;
      continue;
    }
    console.log(`[local:${q.label}] rows=${result.rows[q.label].length}`);
  }
}

(async () => {
  if (mode === 'prod') await runProd();
  else runLocal();
  fs.writeFileSync(outPath, JSON.stringify(result, null, 2));
  const errLabels = Object.keys(result.errors);
  console.log(`WROTE ${outPath}`);
  if (errLabels.length) { console.log(`SNAPSHOT_ERRORS ${errLabels.join(',')}`); process.exitCode = 1; }
  else console.log('SNAPSHOT_OK');
})();