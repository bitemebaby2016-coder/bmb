// TEMP probe (2026-10-26 session) — audit จุด UI ของ L-3/4/5/7/8 (grep UTF-8 ผ่าน node)
//   node e2e\probe_ui.cjs
// ลบได้หลังใช้
const fs = require('fs');
const p = require('path');
const walk = (d) => fs.readdirSync(d, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? walk(p.join(d, e.name)) : [p.join(d, e.name)]));
const files = walk('src').filter((f) => /\.(ts|tsx)$/.test(f));
const read = (f) => fs.readFileSync(f, 'utf8');

function grep(name, re) {
  const hits = [];
  for (const f of files) {
    const lines = read(f).split(/\r?\n/);
    lines.forEach((l, i) => { if (re.test(l)) hits.push(`${f}:${i + 1}: ${l.trim().slice(0, 140)}`); });
  }
  console.log(`\n===== ${name} (${hits.length}) =====`);
  console.log(hits.slice(0, 60).join('\n') || 'NONE');
}

grep('L-3 scrollIntoView/scrollTo', /scrollIntoView|scrollTo\s*\(/);
grep('L-3 anchor href=#', /href="#|href=\{`#/);
grep('L-4 top tabs (ส่งวันนี้/จองล่วงหน้า label defs)', /'ส่งวันนี้'|"ส่งวันนี้"|'จองล่วงหน้า'|"จองล่วงหน้า"/);
grep('L-7 section ids / cat anchors', /id=\{?["'`][a-z-]*cat|section-|cat-anch|scrollTarget/);
grep('L-8 pre-order disable', /available_preorder|cutoff|ปิดรับ|เลยรอบ|ยังไม่ถึงรอบ|disabled=\{/);
grep('VotePage thai candidates', /โหวต|กรุ|เมน/);

// structure
console.log('\n===== structure: components/layout =====');
console.log(walk('src/components/layout').join('\n'));
console.log('\n===== structure: components (top) =====');
console.log(fs.readdirSync('src/components').join(', '));
console.log('\n===== tests =====');
console.log(fs.readdirSync('src/__tests__').join(', '));
console.log('\nTOTAL_SRC_FILES=' + files.length);