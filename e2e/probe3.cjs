// TEMP probe 3 (2026-10-26) — jobs steps ของ Contract run #158 + FoodMenuCard mode usage
const fs = require('fs');
(async () => {
  // 1) jobs/steps ของ Contract Tests run 40284092253 (พิสูจน์ legacy step = success)
  try {
    const res = await fetch('https://api.github.com/repos/bitemebaby2016-coder/bmb/actions/runs/40284092253/jobs', {
      headers: { Accept: 'application/vnd.github+json', 'User-Agent': 'bmb-probe3' },
    });
    console.log('JOBS_HTTP', res.status);
    const j = await res.json();
    for (const job of j.jobs || []) {
      console.log('JOB:', job.name, '=', job.conclusion);
      for (const s of job.steps || []) console.log('  STEP:', s.conclusion, '|', s.name);
    }
  } catch (e) { console.log('JOBS_ERR', e.message); }

  // 2) FoodMenuCard — mode ถูกใช้ตรงไหนบ้าง
  const lines = fs.readFileSync('src/components/FoodMenuCard.tsx', 'utf8').split(/\r?\n/);
  lines.forEach((l, i) => { if (/\bmode\b/.test(l)) console.log(`FMC:${i + 1}: ${l.trim()}`); });
})();
