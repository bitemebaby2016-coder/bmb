// R52 codemod G — typecheck fixes found by `npx tsc --noEmit` after cm_e/cm_f:
//  1) add missing MascotBadge import to 4 home components (cm_f only ensured HomePage/ReviewPage)
//  2) socialLinks: NETWORK_META inline type needs `imgClass?: string` (facebook row now carries it)
// Run: node e2e\r52_cm_g.cjs  (idempotent — skips when already present)
const fs = require('fs');
const path = require('path');
const ROOT = path.join(__dirname, '..');
const IMPORT_LINE = "import { MascotBadge } from '@/components/MascotBadge'";
const log = [];

function load(rel) { return fs.readFileSync(path.join(ROOT, rel), 'utf8'); }
function save(rel, s) { fs.writeFileSync(path.join(ROOT, rel), s, 'utf8'); }

const components = [
  'src/components/home/PromotionStrip.tsx',
  'src/components/home/ReviewCarouselSection.tsx',
  'src/components/home/ReviewGallerySection.tsx',
  'src/components/home/VerifiedReviewsSection.tsx',
];
for (const rel of components) {
  let L = load(rel).split('\n');
  if (L.some((l) => l.trim() === IMPORT_LINE)) { log.push(rel + ': import already present'); continue; }
  let lastImp = -1;
  L.forEach((l, i) => { if (/^import\s/.test(l)) lastImp = i; });
  if (lastImp < 0) throw new Error(rel + ': no import found');
  L.splice(lastImp + 1, 0, IMPORT_LINE);
  save(rel, L.join('\n'));
  log.push(rel + ': + MascotBadge import');
}

{
  const rel = 'src/lib/socialLinks.ts';
  let L = load(rel).split('\n');
  const t = L.findIndex((l) => l.includes('NETWORK_META: Array<') && l.includes('img?: string'));
  if (t === -1) { log.push(rel + ': NETWORK_META type already patched or not found as expected'); }
  else if (L[t].includes('imgClass')) { log.push(rel + ': type already has imgClass'); }
  else {
    L[t] = L[t].replace('img?: string', 'img?: string; imgClass?: string');
    if (!L[t].includes('imgClass')) throw new Error(rel + ' type replace failed');
    save(rel, L.join('\n'));
    log.push(rel + ': NETWORK_META type + imgClass?: string');
  }
}

console.log('[r52_cm_g] applied:');
for (const l of log) console.log('  - ' + l);
console.log('[r52_cm_g] OK');