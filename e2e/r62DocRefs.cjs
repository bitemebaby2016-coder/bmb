// R62 PHASE 5 — dependency check: find references to markdown files from CODE paths.
// Single pass: read each code file once, test all doc basenames against it.
const fs = require('fs');
const path = require('path');

const ROOT = process.cwd();
const keepRoot = new Set(['README.md', 'AI_ENTRYPOINT.md', 'AI_WORK_STATE.md', 'UNIVERSAL_MASTER_AI_RULES.md']);
const rootDocs = fs.readdirSync(ROOT).filter(f => f.endsWith('.md') && !keepRoot.has(f));
const docsAll = fs.readdirSync('docs', { recursive: true })
  .filter(f => typeof f === 'string' && f.endsWith('.md'))
  .map(f => 'docs/' + String(f).replace(/\\/g, '/'));

const scanDirs = ['src', 'e2e', 'scripts', '.github', 'public', 'supabase', 'workers'];
const codeFiles = [];
(function walk(d) {
  let ents; try { ents = fs.readdirSync(d, { withFileTypes: true }); } catch { return; }
  for (const e of ents) {
    const p = path.join(d, e.name);
    if (e.isDirectory()) {
      if (!['node_modules', 'dist', '.git', 'backups', 'screenshots', 'artifacts', 'ci'].includes(e.name)) walk(p);
    } else if (/\.(ts|tsx|js|cjs|mjs|yml|yaml|json|html|css|ps1|sh|sql)$/.test(e.name)) {
      try { if (fs.statSync(p).size < 2_000_000) codeFiles.push(p); } catch {}
    }
  }
})(ROOT);
codeFiles.push('README.md', 'package.json');

const allDocs = [...new Set([...rootDocs, ...docsAll])];
const refs = {};
for (const cf of codeFiles) {
  let src; try { src = fs.readFileSync(cf, 'utf8'); } catch { continue; }
  for (const doc of allDocs) {
    if (src.includes(path.basename(doc))) (refs[doc] ||= []).push(cf.replace(/\\/g, '/'));
  }
}

const report = {
  at: new Date().toISOString(),
  rootDocCount: rootDocs.length,
  docsMdCount: docsAll.length,
  scannedCodeFiles: codeFiles.length,
  referenced: refs,
  unreferencedRoot: rootDocs.filter(d => !refs[d]),
  unreferencedDocs: docsAll.filter(d => !refs[d]),
};
fs.writeFileSync('e2e/r62DocRefs-result.json', JSON.stringify(report, null, 1));
console.log('rootDocs=' + rootDocs.length + ' docsMd=' + docsAll.length +
  ' codeFiles=' + codeFiles.length + ' referenced=' + Object.keys(refs).length);
console.log('UNREFERENCED_ROOT_COUNT=' + report.unreferencedRoot.length);
console.log('UNREFERENCED_DOCS_COUNT=' + report.unreferencedDocs.length);

