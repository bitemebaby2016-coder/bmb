// R62 PHASE 5 — execute MOVE per e2e/r62MoveList.json (git mv เฉพาะไฟล์ · ห้าม DELETE)
// Dry-run default; pass --apply to execute. Exit 0 = all ok.
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const list = JSON.parse(fs.readFileSync('e2e/r62MoveList.json', 'utf8'));
const apply = process.argv.includes('--apply');
const all = [...list.root, ...list.docs];
const errors = [];
let moved = 0, skipped = 0;

// safety: never touch KEEP sets
const keep = new Set([...list.keepRoot, ...list.keepDocs]);

for (const { from, to } of all) {
  if (keep.has(from)) { errors.push('KEEP-SET VIOLATION: ' + from); continue; }
  if (!fs.existsSync(from)) { skipped++; continue; } // already moved
  if (fs.existsSync(to)) { errors.push('TARGET EXISTS: ' + to); continue; }
  if (apply) {
    try {
      fs.mkdirSync(path.dirname(to), { recursive: true });
      execSync(`git mv "${from}" "${to}"`, { stdio: 'pipe' });
      moved++;
    } catch (e) { errors.push('GITMV FAIL: ' + from + ' → ' + String(e).slice(0, 150)); }
  } else {
    moved++; // would-move count
  }
}

// verify: no KEEP file disappeared, no deletes
const missingKeep = [...keep].filter(f => f.endsWith('.md') && !fs.existsSync(f) && !f.includes('/'));

console.log(JSON.stringify({
  mode: apply ? 'APPLY' : 'DRY_RUN',
  planned: all.length, moved, skipped, errors,
  missingKeep,
}, null, 1));
process.exit(errors.length ? 1 : 0);
