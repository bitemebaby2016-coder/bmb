// R62 PHASE 8 — pointer integrity: references to MOVED filenames inside KEPT docs
const fs = require('fs');
const path = require('path');
const moveList = require('./r62MoveList.json');
const movedNames = new Set([...moveList.root, ...moveList.docs].map(x => path.basename(x.from)));
movedNames.add('BMB_OWNER_ROLE_TEST_GUIDE_2026-10-27.md'); // moved in PHASE 8

const kept = [
  'AI_ENTRYPOINT.md', 'AI_WORK_STATE.md', 'UNIVERSAL_MASTER_AI_RULES.md', 'README.md',
  'BMB_G6_CONTRACT.md', 'BMB_G7_CONTRACT.md', 'BMB_G10_DEFECT_117_FC_ROLLBACK.md',
  ...moveList.keepDocs,
  'docs/BMB_DOCUMENT_INVENTORY_AND_ARCHIVE_MAP.md',
];
const out = [];
for (const f of kept) {
  if (!fs.existsSync(f)) { out.push({ file: f, missing: true }); continue; }
  const lines = fs.readFileSync(f, 'utf8').split(/\r?\n/);
  lines.forEach((l, i) => {
    for (const name of movedNames) {
      // stale = mentions the bare filename NOT preceded by docs/archive/ and not the §MAP/§RG notes
      if (l.includes(name) && !l.includes('docs/archive/' + name) && !l.includes('archive/root_reports/' + name)) {
        out.push({ file: f, line: i + 1, name, text: l.trim().slice(0, 140) });
        break;
      }
    }
  });
}
console.log(JSON.stringify({ staleCount: out.length, stale: out }, null, 1));
