// R62 PHASE 8 — rewrite stale operational pointers in KEPT docs
// (path-qualified docs/X -> docs/archive/X ; bare `X` -> archive path)
// Skips: AI_WORK_STATE history (รายงาน ณ วันนั้น = ห้ามย้อนแก้), lines already noting the move.
const fs = require('fs');
const path = require('path');
const moveList = require('./r62MoveList.json');
const moved = new Map();
for (const x of [...moveList.root, ...moveList.docs]) moved.set(path.basename(x.from), x.to);
moved.set('BMB_OWNER_ROLE_TEST_GUIDE_2026-10-27.md', 'docs/archive/BMB_OWNER_ROLE_TEST_GUIDE_2026-10-27.md');

const targets = [
  'docs/BMB_PRODUCTION_TEST_PACK.md',
  'docs/BMB_OPENING_READINESS_MASTER.md',
  'docs/BMB_MASTER_TEST_CHECKLIST_2026-10-28.md',
  'docs/BMB_OWNER_LAUNCH_CHECKLIST.md',
  'README.md',
];
let changedFiles = 0, changedLines = 0;
for (const f of targets) {
  if (!fs.existsSync(f)) continue;
  const lines = fs.readFileSync(f, 'utf8').split(/\r?\n/);
  let touched = false;
  for (let i = 0; i < lines.length; i++) {
    let l = lines[i];
    const orig = l;
    for (const [name, to] of moved) {
      // 1) path-qualified stale: docs/<name> without archive prefix
      const dq = 'docs/' + name;
      if (l.includes(dq) && !l.includes('docs/archive/' + name)) l = l.split(dq).join(to);
      // 2) bare backtick mention, line has no archive ref yet, line is NOT a "moved" note
      if (!l.includes('archive') && l.includes('`' + name + '`')) l = l.split('`' + name + '`').join('`' + to + '`');
    }
    if (l !== orig) { lines[i] = l; changedLines++; touched = true; }
  }
  if (touched) { fs.writeFileSync(f, lines.join('\n')); changedFiles++; }
}
console.log(JSON.stringify({ changedFiles, changedLines, targets: targets.length }));