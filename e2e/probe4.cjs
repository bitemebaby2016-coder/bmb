// TEMP probe 4 (2026-10-26) — safety pins: test strings ที่การแก้ UI อาจทำพัง
const fs = require('fs');
const p = require('path');
const walk = (d) => fs.readdirSync(d, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? walk(p.join(d, e.name)) : [p.join(d, e.name)]));
const testFiles = walk('src/__tests__').filter((f) => /\.tsx?$/.test(f));
const srcFiles = walk('src').filter((f) => /\.(ts|tsx)$/.test(f) && !f.includes('__tests__'));

function grep(files, name, re) {
  const hits = [];
  for (const f of files) {
    fs.readFileSync(f, 'utf8').split(/\r?\n/).forEach((l, i) => { if (re.test(l)) hits.push(`${f}:${i + 1}: ${l.trim().slice(0, 130)}`); });
  }
  console.log(`\n===== ${name} (${hits.length}) =====`);
  console.log(hits.join('\n') || 'NONE');
}

grep(testFiles, 'TEST pins: headingChips/chips filter', /headingChips|saleModeOfCategory\(c\)/);
grep(testFiles, 'TEST pins: opacity-60/btn-disabled/bg-brand-border', /opacity-60|btn-disabled|bg-brand-border/);
grep(testFiles, 'TEST pins: preOrderCount/sameDayCount', /preOrderCount|sameDayCount/);
grep(testFiles, 'TEST pins: Footer sort/menuLinks', /menuLinks|sort_order.*Footer|footerSrc/);
grep(testFiles, 'TEST pins: cartStore.addItem behavior', /addItem\(/);
grep(srcFiles, 'SRC: useSearchParams users', /useSearchParams|setSearchParams/);
grep(srcFiles, 'SRC: runOrderBuilder calls', /runOrderBuilder\(\{/);
grep(srcFiles, 'SRC: handlePreOrder direct addItem PRE_ORDER', /mode: 'PRE_ORDER'|'PRE_ORDER'\)/);
console.log('\n===== TEST files list =====');
console.log(testFiles.map((f) => p.basename(f)).join(', '));
