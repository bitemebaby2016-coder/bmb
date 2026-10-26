// TEMP probe รอบ 2 (2026-10-26) — node e2e\probe2.cjs (ลบได้หลังใช้)
const fs = require('fs');
const p = require('path');
const read = (f) => fs.readFileSync(f, 'utf8');
const walk = (d) => fs.readdirSync(d, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? walk(p.join(d, e.name)) : [p.join(d, e.name)]));

// 1) CartItem definition
const types = read('src/types/index.ts').split(/\r?\n/);
types.forEach((l, i) => { if (/CartItem/.test(l)) console.log(`TYPES:${i + 1}: ${l.trim()}`); });

// 2) categoryDisplayRank / CATEGORY_DISPLAY_ORDER consumers (src only)
const files = walk('src').filter((f) => /\.(ts|tsx)$/.test(f));
for (const f of files) {
  if (f.includes('__tests__')) continue;
  read(f).split(/\r?\n/).forEach((l, i) => {
    if (/categoryDisplayRank|CATEGORY_DISPLAY_ORDER/.test(l)) console.log(`RANK:${f}:${i + 1}: ${l.trim().slice(0, 130)}`);
  });
}

// 3) booking-button render sites (📅 ... จองล่วงหน้า inside <button)
for (const f of files) {
  if (f.includes('__tests__')) continue;
  const lines = read(f).split(/\r?\n/);
  lines.forEach((l, i) => {
    if (/จองล่วงหน้า|ยังไม่ลงปฏิทิน|หมดเวลาจอง/.test(l) && /button|btn|disabled|ctaLabel/.test(l)) {
      console.log(`BOOK:${f}:${i + 1}: ${l.trim().slice(0, 130)}`);
    }
  });
}

// 4) App routes — footer/static paths must exist
const app = read('src/App.tsx');
for (const path of ['/about', '/faq', '/blog', '/privacy', '/terms', '/viral', '/rewards', '/contact', '/promotions', '/menu', '/track', '/share', '/orders']) {
  console.log(`ROUTE:${path}=${app.includes(`path="${path}"`) ? 'yes' : 'NO'}`);
}

// 5) .btn disabled CSS
const cssFiles = ['src/index.css', ...walk('src/styles').filter((f) => f.endsWith('.css'))];
let found = false;
for (const f of cssFiles) {
  const lines = read(f).split(/\r?\n/);
  lines.forEach((l, i) => {
    if (/btn.*disabled|disabled.*btn/.test(l)) { found = true; console.log(`CSS:${f}:${i + 1}: ${l.trim().slice(0, 130)}`); }
  });
}
if (!found) console.log('CSS: NO btn disabled rule in index.css/src/styles');

// 6) contract-tests loop enumeration (does CI pick up new 159 automatically?)
const wf = read('.github/workflows/contract-tests.yml').split(/\r?\n/);
wf.forEach((l, i) => {
  if (/for f in|supabase\/migrations|apply_migrations|ls .*migrations|migrations\/\*|sort/.test(l)) console.log(`WF:${i + 1}: ${l.trim().slice(0, 160)}`);
});
