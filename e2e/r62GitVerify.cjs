// verify git status: all moves are R (renames), zero D (deletes), list non-rename lines
const { execSync } = require('child_process');
const out = execSync('git status --porcelain=v1', { encoding: 'utf8' });
const lines = out.split(/\r?\n/).filter(Boolean);
const renames = lines.filter(l => l.startsWith('R'));
const deletes = lines.filter(l => l.startsWith('D') || l.startsWith(' D'));
const untracked = lines.filter(l => l.startsWith('??'));
const modified = lines.filter(l => l.startsWith(' M') || l.startsWith('M'));
const stagedOther = lines.filter(l => !l.startsWith('R') && !l.startsWith('D') && !l.startsWith('??') && !l.startsWith(' M') && !l.startsWith('M'));
console.log(JSON.stringify({
  total: lines.length, renames: renames.length, deletes: deletes.length,
  untracked: untracked.length, modified: modified.length, stagedOther,
  deleteList: deletes, untrackedList: untracked, modifiedList: modified,
}, null, 1));
