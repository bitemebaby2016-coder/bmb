// R62 PHASE 1/3 — read-only SEO coverage audit v2
// App.tsx has TWO <Routes> blocks: (1) SEO-only block (element = SeoHelmet/Seo comp),
// (2) render block (element = Suspense + Page). Every public path in (2) must have a
// counterpart in (1). Admin/rider paths are exempt (not customer-facing SEO).
const fs = require('fs');
const app = fs.readFileSync('src/App.tsx', 'utf8');
const lines = app.split('\n');

const routesIdx = lines.map((l, i) => /^\s*<Routes>/.test(l) ? i : -1).filter(i => i >= 0);
const [seoBlockStart, renderBlockStart] = routesIdx;

function pathsIn(from, to) {
  const out = [];
  for (let i = from; i < to && i < lines.length; i++) {
    const m = lines[i].match(/<Route path="([^"]+)"/);
    if (m) out.push({ path: m[1], line: i + 1, raw: lines[i].trim().slice(0, 130) });
  }
  return out;
}
const seoPaths = pathsIn(seoBlockStart, renderBlockStart);
const renderPaths = pathsIn(renderBlockStart, lines.length);

const seoSet = new Set(seoPaths.map(p => p.path));
const isExempt = p => p.startsWith('/admin') || p.startsWith('/rider') || p === '*' || p === '/control';
const missingSeo = renderPaths.filter(p => !isExempt(p.path) && !seoSet.has(p.path));
const seoOnly = seoPaths.filter(p => !renderPaths.some(r => r.path === p.path));

const report = {
  seoBlockLine: seoBlockStart + 1,
  renderBlockLine: renderBlockStart + 1,
  seoPathCount: seoPaths.length,
  renderPathCount: renderPaths.length,
  missingSeoCount: missingSeo.length,
  missingSeo: missingSeo.map(p => ({ path: p.path, line: p.line })),
  seoOnlyCount: seoOnly.length,
  seoOnly: seoOnly.map(p => ({ path: p.path, line: p.line })),
};
fs.writeFileSync('e2e/r62SeoAudit-result.json', JSON.stringify(report, null, 1));
console.log(JSON.stringify(report, null, 1));
