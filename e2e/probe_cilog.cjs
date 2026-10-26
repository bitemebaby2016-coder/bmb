// TEMP probe (2026-10-26 session) — ดึง job log ของ Contract Tests แล้วหาบรรทัด "Legacy contracts OK"
//   node e2e\probe_cilog.cjs <job_id>
// ลบได้หลังใช้ (AGENTS: temp probes → ห้ามค้างข้ามเซสชั่น)
const JOB = process.argv[2];
if (!JOB) { console.error('usage: probe_cilog.cjs <job_id>'); process.exit(2); }
const REPO = 'bitemebaby2016-coder/bmb';
const hdr = { Accept: 'application/vnd.github+json', 'User-Agent': 'bmb-probe' };
(async () => {
  const res = await fetch(`https://api.github.com/repos/${REPO}/actions/jobs/${JOB}/logs`, { headers: hdr, redirect: 'follow' });
  console.log('HTTP', res.status);
  const text = await res.text();
  const lines = text.split(/\r?\n/);
  const legacy = lines.filter((l) => /Legacy contracts OK/.test(l));
  const fails = lines.filter((l) => /FAIL|Error:|exit code 1/i.test(l) && !/0 fail/i.test(l));
  console.log('--- Legacy contracts lines ---');
  console.log(legacy.length ? legacy.join('\n') : 'NOT FOUND');
  console.log('--- suspicious fail lines (max 20) ---');
  console.log(fails.slice(0, 20).join('\n') || 'none');
  console.log('TOTAL_LINES=' + lines.length);
})().catch((e) => { console.error('PROBE_FAIL', e.message); process.exit(1); });