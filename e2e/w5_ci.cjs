// W-5 — อ่าน CI จริงจาก GitHub API (ไม่มี `gh`) สำหรับ SHA ที่ push
//   node e2e\w5_ci.cjs <sha ย่อหรือเต็ม>   (เรียกผ่าน bat บน host เพราะ path มีช่องว่าง)
const SHA = process.argv[2];
if (!SHA) { console.error('usage: w5_ci.cjs <sha>'); process.exit(2); }
const REPO = 'bitemebaby2016-coder/bmb';
const hdr = { Accept: 'application/vnd.github+json', 'User-Agent': 'bmb-ci-check' };
(async () => {
  const runs = await fetch(`https://api.github.com/repos/${REPO}/actions/runs?per_page=50`, { headers: hdr })
    .then((r) => r.json());
  const mine = (runs.workflow_runs || []).filter((r) => String(r.head_sha).startsWith(SHA));
  if (!mine.length) console.log(`NO_RUNS yet for ${SHA} (รอ GitHub เริ่ม job)`);
  for (const r of mine) {
    console.log(`${r.name} #${r.run_number} = ${r.conclusion || r.status}  ${r.html_url}`);
  }
  const checks = await fetch(`https://api.github.com/repos/${REPO}/commits/${SHA}/check-runs?per_page=50`, { headers: hdr })
    .then((r) => (r.ok ? r.json() : { check_runs: [] }));
  for (const c of checks.check_runs || []) {
    console.log(`check: ${c.name} = ${c.conclusion || c.status}  ${c.html_url}`);
  }
  const legacy = (checks.check_runs || []).find((c) => /contract/i.test(c.name));
  console.log(legacy ? `CONTRACT_STATUS=${legacy.conclusion || legacy.status}` : 'CONTRACT_STATUS=not-found');
})().catch((e) => { console.error('CI_FETCH_FAIL', e.message); process.exit(1); });