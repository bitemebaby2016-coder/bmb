// TEMP probe 5 (2026-10-26) — exhaustive pins ก่อนแก้ L-4/L-7/L-8
const fs = require('fs');
const p = require('path');
const walk = (d) => fs.readdirSync(d, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? walk(p.join(d, e.name)) : [p.join(d, e.name)]));
const testFiles = walk('src/__tests__').filter((f) => /\.tsx?$/.test(f));
const srcFiles = walk('src').filter((f) => /\.(ts|tsx)$/.test(f));

function grep(files, name, re, limit = 80) {
  const hits = [];
  for (const f of files) {
    fs.readFileSync(f, 'utf8').split(/\r?\n/).forEach((l, i) => { if (re.test(l)) hits.push(`${f}:${i + 1}: ${l.trim().slice(0, 140)}`); });
  }
  console.log(`\n===== ${name} (${hits.length}) =====`);
  console.log(hits.slice(0, limit).join('\n') || 'NONE');
}

grep(testFiles, 'TEST pins: categoryDisplayRank/ORDER', /categoryDisplayRank|CATEGORY_DISPLAY_ORDER/);
grep(testFiles, 'TEST pins: headingChips membership (catalogControl)', /headingChips/);
grep(srcFiles, 'SRC: btn-disabled users', /\.btn-disabled|btn-disabled/);
grep(srcFiles, 'SRC: routes vote/random/profile', /path="(\/vote|\/random-menu|\/profile|\/menu|\/promotions)"/);
grep(testFiles, 'TEST pins: MenuPage filtered/ordered strings', /const filtered = products.filter|menuTab === 'pre-order'/);
grep(testFiles, 'TEST pins: CartPage/go-checkout', /go-checkout|CartPage/);
grep(srcFiles, 'SRC: scheduleMap consumers', /getProductScheduleMap/);
console.log('\nApp.tsx route lines for vote/random/profile:');
fs.readFileSync('src/App.tsx', 'utf8').split(/\r?\n/).forEach((l, i) => { if (/path="\/(vote|random-menu|profile|orders)"/.test(l)) console.log(`${i + 1}: ${l.trim().slice(0, 120)}`); });
