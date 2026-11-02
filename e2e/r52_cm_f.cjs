// R52 codemod F (part 1/2) — section headings: mascots move AFTER heading text & added to all sections
// structural anchors only — content lines are moved, never rewritten through emoji
// Run full script after part 2 appended: node e2e\r52_cm_f.cjs
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const log = [];
const IMPORT_LINE = "import { MascotBadge } from '@/components/MascotBadge'";

function load(rel) { return fs.readFileSync(path.join(ROOT, rel), 'utf8'); }
function save(rel, text) { fs.writeFileSync(path.join(ROOT, rel), text, 'utf8'); }
function lines(rel) { return load(rel).split('\n'); }
function join(arr) { return arr.join('\n'); }
function findIdx(L, pred, what) {
  const hits = [];
  L.forEach((l, i) => { if (pred(l)) hits.push(i); });
  if (hits.length !== 1) throw new Error(what + ': expected 1 match, got ' + hits.length);
  return hits[0];
}
function closeAfter(L, from, tag) {
  for (let i = from + 1; i < L.length; i++) if (L[i].trim() === tag) return i;
  throw new Error('closing ' + tag + ' not found after ' + from);
}
// insert a line right before the closing tag; handles both own-line close and glued close
// ("...</h2>" on the content line) by splitting the original line — content string reused as-is (no emoji rewrite)
function insertBeforeClose(L, from, newLine, tag) {
  const closeToken = '</' + tag + '>';
  for (let i = from; i < L.length; i++) { // start AT `from` — single-line elements ("<h2 ...>text</h2>") close on the anchor line itself
    if (L[i].trim() === closeToken) { L.splice(i, 0, newLine); return; }
    const k = L[i].indexOf(closeToken);
    if (k !== -1) {
      const indent = L[i].match(/^\s*/)[0];
      const before = L[i].slice(0, k).replace(/\s+$/, '');
      const rest = L[i].slice(k); // starts with closeToken (may have trailing spaces)
      L.splice(i, 1, before, newLine, indent + rest.trim());
      return;
    }
  }
  throw new Error('closing ' + closeToken + ' not found after ' + from);
}
function ensureImport(L, rel) {
  if (L.some((l) => l.trim() === IMPORT_LINE)) return;
  let lastImp = -1;
  L.forEach((l, i) => { if (/^import\s/.test(l)) lastImp = i; });
  if (lastImp < 0) throw new Error(rel + ': no import found');
  L.splice(lastImp + 1, 0, IMPORT_LINE);
}
function addFlex(L, h) {
  if (L[h].includes('flex items-center gap-2')) return;
  if (!L[h].includes('text-brand-accent')) throw new Error('h line missing text-brand-accent: ' + L[h]);
  L[h] = L[h].replace('text-brand-accent', 'text-brand-accent flex items-center gap-2');
}

// ---------- 1) CategorySections: mascot AFTER title span ----------
{
  const rel = 'src/components/home/CategorySections.tsx';
  let L = lines(rel);
  const spanPre = findIdx(L, (l) => l.includes('<span>{cat.icon'), rel + ' title span');
  const mb = findIdx(L, (l) => l.trim() === '<MascotBadge', rel + ' MascotBadge open');
  if (spanPre < mb) {
    log.push(rel + ': already swapped (span before mascot), skip');
  } else {
    let end = mb;
    while (end < L.length && L[end].trim() !== '/>') end++;
    if (end >= L.length) throw new Error(rel + ' MascotBadge close not found');
    const spanIdx = end + 1;
    if (!L[spanIdx].trim().startsWith('<span>')) throw new Error(rel + ' expected span after mascot, got: ' + L[spanIdx]);
    if (L[mb - 1].trim() !== '>') throw new Error(rel + ' expected h3 open ">" before mascot');
    const spanLine = L[spanIdx];
    const mascotBlock = L.slice(mb, end + 1);
    L.splice(mb, end + 1 - mb + 1, spanLine, ...mascotBlock);
    save(rel, join(L));
    log.push(rel + ': mascot moved after heading span');
  }
}

// ---------- 2) HomePage: 3 h2 mascots + import ----------
{
  const rel = 'src/pages/HomePage.tsx';
  let L = lines(rel);
  const spots = [
    { id: 'id="home-popular-heading"', pose: 'recommend', alt: 'น้อง Bite เมนูแนะนำ' },
    { id: 'id="home-sameday-heading"', pose: 'running', alt: 'น้อง Bite ส่งวันนี้' },
    { id: 'id="home-preorder-heading"', pose: 'menu', alt: 'น้อง Bite พรีออเดอร์' },
  ];
  for (const s of spots) {
    const h = findIdx(L, (l) => l.includes(s.id), rel + ' ' + s.id);
    if (L.slice(h, h + 5).some((l) => l.includes('pose="' + s.pose + '"'))) { log.push(rel + ': ' + s.id + ' already done'); continue; }
    addFlex(L, h);
    insertBeforeClose(L, h,
      '            <MascotBadge pose="' + s.pose + '" size="sm" alt="' + s.alt + '" className="section-float-mascot" />',
      'h2');
    log.push(rel + ': ' + s.id + ' + mascot ' + s.pose);
  }
  ensureImport(L, rel);
  save(rel, join(L));
}

// ---------- 3) ReviewCarousel: title span first, mascot, then logo sticker ----------
{
  const rel = 'src/components/home/ReviewCarouselSection.tsx';
  let L = lines(rel);
  const h = findIdx(L, (l) => l.includes('home-reviews-heading') && l.includes('<h2'), rel + ' heading');
  const close = closeAfter(L, h, '</h2>');
  if (L.slice(h, close).some((l) => l.includes('MascotBadge pose="reviewing"'))) {
    log.push(rel + ': already done');
  } else {
    const imgStart = findIdx(L, (l) => l.trim().startsWith('<img'), rel + ' img block');
    let imgEnd = imgStart;
    while (imgEnd < L.length && L[imgEnd].trim() !== '/>') imgEnd++;
    const spanIdx = findIdx(L, (l) => l.trim().startsWith('<span>'), rel + ' title span');
    if (spanIdx < imgStart || spanIdx > close) throw new Error(rel + ' span outside h2 region');
    const commentLines = L.slice(imgEnd + 1, spanIdx); // e.g. R50 title comment — kept adjacent to span
    const imgBlock = L.slice(imgStart, imgEnd + 1);
    const spanLine = L[spanIdx];
    L.splice(h + 1, close - h - 1,
      ...commentLines,
      spanLine,
      '            <MascotBadge pose="reviewing" size="sm" alt="น้อง Bite อ่านรีวิวจริง" className="section-float-mascot" />',
      ...imgBlock);
    save(rel, join(L));
    log.push(rel + ': comment+span first + mascot reviewing, sticker stays after title');
  }
}

// ---------- 4) generic: add mascot before </h2> ----------
function addH2Mascot(rel, anchorSubstr, pose, alt, opts) {
  let L = lines(rel);
  const rawHits = [];
  L.forEach((l, i) => { if (l.includes(anchorSubstr)) rawHits.push(i); });
  // section tags carry aria-labelledby="<id>" (substring also matches `id="..."`) — keep only the content/h2 line
  const contentHits = rawHits.filter((i) => {
    if (L[i].includes('aria-labelledby')) return false;
    // must live INSIDE an <h2> element (single-line or multi-line)
    let h = i;
    while (h >= 0 && !L[h].trim().startsWith('<h2')) h--;
    if (h < 0) return false;
    for (let j = h; j < L.length; j++) if (L[j].includes('</h2>')) return i <= j;
    return false;
  });
  if (contentHits.length !== 1) {
    throw new Error(rel + ' anchor ' + anchorSubstr + ': expected 1 content match, got ' + contentHits.length + ' (raw ' + rawHits.length + ')');
  }
  const content = contentHits[0];
  if (L.slice(Math.max(0, content - 3), content + 4).some((l) => l.includes('MascotBadge pose="' + pose + '"'))) {
    log.push(rel + ': ' + anchorSubstr + ' already done');
    return;
  }
  let h = content;
  while (h >= 0 && !L[h].trim().startsWith('<h2')) h--;
  if (h < 0) throw new Error(rel + ' <h2 not found above ' + anchorSubstr);
  if (!(opts && opts.flex === false)) addFlex(L, h);
  insertBeforeClose(L, h,
    '            <MascotBadge pose="' + pose + '" size="sm" alt="' + alt + '" className="section-float-mascot" />',
    'h2');
  save(rel, join(L));
  log.push(rel + ': ' + anchorSubstr + ' + mascot ' + pose);
}

addH2Mascot('src/components/home/ReviewGallerySection.tsx', 'review-gallery-heading', 'eating', 'น้อง Bite ดูอัลบั้มรีวิวจริง');
addH2Mascot('src/components/home/VerifiedReviewsSection.tsx', 'verified-reviews-heading', 'thumbsup', 'น้อง Bite รีวิวสั่งซื้อจริง', { flex: false });
// PromotionStrip: file has a single <h2> — anchor by tag line (content anchor would match >1)
{
  const rel = 'src/components/home/PromotionStrip.tsx';
  let L = lines(rel);
  const h = findIdx(L, (l) => l.trim().startsWith('<h2'), rel + ' h2');
  if (L.slice(h, h + 4).some((l) => l.includes('pose="award"'))) {
    log.push(rel + ': already done');
  } else {
    const close = closeAfter(L, h, '</h2>');
    addFlex(L, h);
    L.splice(close, 0,
      '            <MascotBadge pose="award" size="sm" alt="น้อง Bite โปรโมชั่น" className="section-float-mascot" />');
    save(rel, join(L));
    log.push(rel + ': h2 + mascot award');
  }
}

// ReviewPage: 3 headings (plain-text anchors)
{
  const rel = 'src/pages/ReviewPage.tsx';
  addH2Mascot(rel, 'Verified Customer Reviews', 'thumbsup', 'น้อง Bite การันตีรีวิวจริง');
  addH2Mascot(rel, 'รีวิวจริงจากลูกค้า', 'eating', 'น้อง Bite รูปรีวิวจากลูกค้า');
  addH2Mascot(rel, 'Admin Portfolio', 'award', 'น้อง Bite ผลงาน');
  let L = lines(rel);
  ensureImport(L, rel);
  save(rel, join(L));
}

// ---------- 5) MenuPage: category h3 + mascot (import exists) ----------
{
  const rel = 'src/pages/MenuPage.tsx';
  let L = lines(rel);
  const h = findIdx(L, (l) => l.includes('catsec-') && l.includes('<h3'), rel + ' catsec h3');
  if (L.slice(h, h + 4).some((l) => l.includes('pose="menu"'))) {
    log.push(rel + ': already done');
  } else {
    addFlex(L, h);
    insertBeforeClose(L, h,
      '            <MascotBadge pose="menu" size="sm" alt={`น้อง Bite หมวด ${category.name}`} className="section-float-mascot" />',
      'h3');
    save(rel, join(L));
    log.push(rel + ': catsec h3 + mascot menu');
  }
}

console.log('[r52_cm_f] applied:');
for (const l of log) console.log('  - ' + l);
console.log('[r52_cm_f] OK');