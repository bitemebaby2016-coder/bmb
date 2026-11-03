// R62 PHASE 1/3 — read-only SEO route coverage audit
// Counts public page routes in App.tsx and whether each page sets metadata
// (either via <SeoHelmet> route block or its own component meta).
const fs = require('fs');
const app = fs.readFileSync('src/App.tsx', 'utf8');

// All element routes with a concrete page component (lazy or eager)
const routeLines = app.split('\n').filter(l => l.includes('<Route path=') && l.includes('element='));
const seoHelmetRoutes = routeLines.filter(l => l.includes('SeoHelmet'));
const pageRoutes = routeLines.filter(l =>
  /<([A-Z][A-Za-z]+)\s*/.test(l.replace(/.*element=/, '')) &&
  !l.includes('SeoHelmet') && !l.includes('<Navigate') && !l.includes('<LoadingSpinner'));

const report = {
  totalElementRoutes: routeLines.length,
  seoHelmetBlocks: seoHelmetRoutes.length,
  pageRoutesWithoutSeoHelmetInRoute: pageRoutes.map(l => (l.match(/path="([^"]+)"/) || [])[1]),
};
// Check whether each page component itself has meta (react-helmet or hardcoded title)
const pages = fs.readdirSync('src/pages').filter(f => f.endsWith('.tsx'));
report.pagesWithOwnMeta = [];
report.pagesWithoutOwnMeta = [];
for (const p of pages) {
  const src = fs.readFileSync('src/pages/' + p, 'utf8');
  (src.includes('Helmet') || src.includes('seo') || src.includes('getSeo') ? report.pagesWithOwnMeta : report.pagesWithoutOwnMeta).push(p);
}
fs.writeFileSync('e2e/r62SeoAudit-result.json', JSON.stringify(report, null, 1));
console.log(JSON.stringify(report, null, 1));
