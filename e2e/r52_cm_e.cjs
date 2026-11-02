// R52 codemod E — login greeting mascot + footer social logo normalization
// (lines with astral emoji are matched/replaced by ASCII anchors only — never emit raw astral chars)
// Run: node e2e\r52_cm_e.cjs
//  1) LoginPage / RegisterPage / ResetPasswordPage:
//       <div className="text-6xl mb-4">[heart]</div>  ->  centered <MascotBadge pose="greeting" size="lg" loading="eager" />
//       + import MascotBadge (inserted after last top-level import)
//  2) socialLinks.ts: messenger gets img '/Messenger logo.webp';
//                     facebook gets imgClass 'scale-90' (optical size match vs circular logos)
//                     SocialLinkItem type + socialLinkItems mapper carry imgClass
//  3) Footer.tsx: img className template-appends social.imgClass
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const log = [];

function load(rel) { return fs.readFileSync(path.join(ROOT, rel), 'utf8'); }
function save(rel, text) { fs.writeFileSync(path.join(ROOT, rel), text, 'utf8'); }
function lines(rel) { return load(rel).split('\n'); }
function join(arr) { return arr.join('\n'); }
function one(arr, pred, what) {
  const hits = [];
  arr.forEach((l, i) => { if (pred(l)) hits.push(i); });
  if (hits.length !== 1) throw new Error(what + ': expected 1 match, got ' + hits.length);
  return hits[0];
}
const IMPORT_LINE = "import { MascotBadge } from '@/components/MascotBadge'";

// ---------- 1) auth pages: heart -> greeting mascot ----------
const MASCOT_JSX = '<MascotBadge pose="greeting" size="lg" alt="น้อง Bite ต้อนรับ" loading="eager" />';
for (const rel of ['src/pages/login/LoginPage.tsx', 'src/pages/login/RegisterPage.tsx', 'src/pages/ResetPasswordPage.tsx']) {
  let L = lines(rel);
  if (L.some((l) => l.includes('pose="greeting"'))) { log.push(rel + ': already applied, skip'); continue; }
  const heart = one(L, (l) => l.includes('text-6xl mb-4'), rel + ' heart line');
  const indent = L[heart].match(/^\s*/)[0];
  L.splice(
    heart, 1,
    indent + '<div className="mb-4 flex justify-center">',
    indent + '  ' + MASCOT_JSX,
    indent + '</div>'
  );
  // import after last top-level import (avoids emoji anchors entirely)
  let lastImp = -1;
  L.forEach((l, i) => { if (/^import\s/.test(l)) lastImp = i; });
  if (lastImp < 0) throw new Error(rel + ': no import found');
  L.splice(lastImp + 1, 0, IMPORT_LINE);
  save(rel, join(L));
  log.push(rel + ': heart -> MascotBadge greeting + import');
}

// ---------- 2) socialLinks.ts ----------
{
  const rel = 'src/lib/socialLinks.ts';
  let L = lines(rel);
  // interface field
  if (!L.some((l) => l.trim() === 'imgClass?: string')) {
    const field = one(L, (l) => l.trim() === 'img?: string', rel + ' img? field');
    L.splice(field + 1, 0,
      '  /** R52: คลาสเสริมปรับขนาด/จัดตำแหน่งให้เท่ากัน (เช่น facebook scale-90) */',
      '  imgClass?: string');
  }
  // facebook imgClass
  const fb = one(L, (l) => l.includes("network: 'facebook'"), rel + ' facebook row');
  if (!L[fb].includes('imgClass')) {
    if (!/\s\},\s*$/.test(L[fb])) throw new Error(rel + ' facebook row unexpected format');
    L[fb] = L[fb].replace(/\s\},\s*$/, ", imgClass: 'scale-90' },");
  }
  // messenger img (ASCII-only transform: append before trailing "},")
  const msg = one(L, (l) => l.includes("network: 'messenger'"), rel + ' messenger row');
  if (!L[msg].includes('img:')) {
    if (!/\s\},\s*$/.test(L[msg])) throw new Error(rel + ' messenger row unexpected format');
    L[msg] = L[msg].replace(/\s\},\s*$/, ", img: '/Messenger logo.webp' },");
  }
  // mapper passes imgClass through
  const mapIdx = one(L, (l) => l.includes('.map(({ network, label, icon, img })'), rel + ' socialLinkItems map');
  L[mapIdx] = L[mapIdx]
    .replace('icon, img })', 'icon, img, imgClass })')
    .replace('icon, img, href:', 'icon, img, imgClass, href:');
  save(rel, join(L));
  log.push(rel + ': messenger img + facebook scale-90 + imgClass plumbing');
}

// ---------- 3) Footer.tsx ----------
{
  const rel = 'src/components/layout/Footer.tsx';
  let L = lines(rel);
  const img = one(L, (l) => l.includes('<img src={social.img}'), rel + ' img line');
  if (!L[img].includes('social.imgClass')) {
    L[img] = L[img].replace(
      'className="w-6 h-6 object-contain"',
      'className={`w-6 h-6 object-contain ${social.imgClass ?? \'\'}`}'
    );
    if (!L[img].includes('social.imgClass')) throw new Error(rel + ' className replace failed');
    save(rel, join(L));
    log.push(rel + ': img className appends social.imgClass');
  } else {
    log.push(rel + ': already applied, skip');
  }
}

console.log('[r52_cm_e] applied:');
for (const l of log) console.log('  - ' + l);
console.log('[r52_cm_e] OK');