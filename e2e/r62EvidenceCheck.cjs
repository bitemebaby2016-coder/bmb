// R62 PHASE 1 — evidence-file existence check (read-only)
const fs = require('fs');
const runtime = [
  'e2e/r61ImageGenSmoke-result.json', 'e2e/tProdProbe_results_T-A4cart.json',
  'e2e/r61PromoUi-result.json', 'e2e/r61Apply183-result.json',
  'e2e/r61AdminReset-result.json', 'e2e/r61_vitest_full.log',
  'e2e/r61_tsc5.log', 'e2e/r61_lint_full2.log',
  'e2e/r51Apply182-result.json', 'e2e/r49Apply180-result.json',
  'e2e/w6Apply157158-record.json', 'e2e/w1-parity-2026-10-26.json',
];
const docsToCheck = [
  'docs/BMB_PRODUCTION_TEST_PACK.md', 'docs/BMB_OWNER_ROLE_TEST_GUIDE_2026-10-27.md',
  'docs/BMB_PRODUCTION_MASTER_STATUS.md', 'docs/03_ADMIN_USER_GUIDE.md',
  'README.md', 'docs/BMB_DOCUMENT_INVENTORY_AND_ARCHIVE_MAP.md',
  'docs/BMB_REQUIREMENT_RECONCILIATION.md', 'BMB_REQUIREMENT_RECONCILIATION.md',
  'docs/BMB_WHOLE_FINAL_PRODUCTION_CLOSURE_REPORT.md', 'BMB_WHOLE_FINAL_PRODUCTION_CLOSURE_REPORT.md',
  'docs/archive',
];
const out = { runtime: [], docs: [] };
for (const f of runtime) {
  try { out.runtime.push({ f, ok: true, size: fs.statSync(f).size }); }
  catch { out.runtime.push({ f, ok: false }); }
}
for (const f of docsToCheck) out.docs.push({ f, exists: fs.existsSync(f) });
console.log(JSON.stringify(out, null, 1));
