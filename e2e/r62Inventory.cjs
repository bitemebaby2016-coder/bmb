// R62 PHASE 1 — read-only repo inventory (no writes, no network)
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

function walkCount(dir, re) {
  let n = 0;
  (function w(d) {
    for (const f of fs.readdirSync(d)) {
      const fp = path.join(d, f);
      const st = fs.statSync(fp);
      if (st.isDirectory()) w(fp);
      else if (re.test(f)) n++;
    }
  })(dir);
  return n;
}

const out = {};
out.gitHead = execSync('git rev-parse HEAD', { encoding: 'utf8' }).trim();
out.gitStatusPorcelain = execSync('git status --porcelain=v1', { encoding: 'utf8' }).trim() || '(clean)';
out.stash = execSync('git stash list', { encoding: 'utf8' }).trim() || '(none)';
out.unitTestFiles = walkCount(path.join('src', '__tests__'), /\.tsx?$/);
out.e2eFiles = fs.readdirSync('e2e').length;
out.migrationsSql = fs.readdirSync('supabase/migrations').filter(f => f.endsWith('.sql')).length;
out.migrationsMax = fs.readdirSync('supabase/migrations').filter(f => /^\d+_/.test(f)).map(f => parseInt(f)).sort((a, b) => a - b).pop();
out.edgeFunctions = fs.readdirSync('supabase/functions').filter(f => fs.statSync(path.join('supabase/functions', f)).isDirectory() && !f.startsWith('_')).length;
out.adminPages = fs.readdirSync(path.join('src', 'pages', 'admin')).length;
out.workers = fs.readdirSync('workers').length;
out.docRootReports = fs.readdirSync('.').filter(f => /^BMB_.*\.md$/.test(f)).length;
out.docsCount = fs.readdirSync('docs').length;
out.docsArchiveCount = fs.readdirSync(path.join('docs', 'archive')).length;
out.ciWorkflows = fs.readdirSync(path.join('.github', 'workflows'));

// NOTE: cmd.exe expands %x as env vars — never use --format=%h in execSync on Windows
const log = execSync('git log -8 --oneline', { encoding: 'utf8' }).trim();
out.recentCommits = log.split('\n');

fs.writeFileSync(path.join('e2e', 'r62Inventory-result.json'), JSON.stringify(out, null, 2));
console.log(JSON.stringify(out, null, 2));
