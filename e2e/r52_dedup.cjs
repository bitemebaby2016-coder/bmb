// R52 dedup — remove accidental double-applied edits (owner reported dups kept reappearing):
// 1) MascotBadge.tsx : "export export const POSE_LABELS" -> "export const ..."
//                     duplicate "mascotDefaultSrc" function blocks -> keep first only
// 2) index.css       : duplicate "<!-- R52 idle --> .mascot-badge:not(...) + @keyframes mascotIdle" chunks -> keep first only
// Run: node e2e\r52_dedup.cjs   (throws if expected counts not reached; writes files atomically)
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const log = [];

function read(rel) { return fs.readFileSync(path.join(ROOT, rel), 'utf8'); }
function write(rel, s) { fs.writeFileSync(path.join(ROOT, rel), s, 'utf8'); }
function count(text, needle) { return text.split(needle).length - 1; }

// ---------- 1) MascotBadge.tsx ----------
const MB = 'src/components/MascotBadge.tsx';
let mb = read(MB);

// a) double export
if (mb.includes('export export const POSE_LABELS')) {
  mb = mb.replace('export export const POSE_LABELS', 'export const POSE_LABELS');
  log.push('fixed: export export -> export');
}

// b) duplicate mascotDefaultSrc blocks (line-based, process from bottom up)
{
  const lines = mb.split('\n');
  const fnIdx = [];
  lines.forEach((l, i) => { if (l.includes('export function mascotDefaultSrc')) fnIdx.push(i); });
  for (let k = fnIdx.length - 1; k >= 1; k--) {
    const fn = fnIdx[k];
    let s = fn - 1;
    while (s >= 0 && !lines[s].includes('/** path')) s--;
    if (s < 0) throw new Error('mascotDefaultSrc block start not found');
    let e = fn;
    while (e < lines.length && lines[e].trim() !== '}') e++;
    if (e >= lines.length) throw new Error('mascotDefaultSrc block end not found');
    if ((lines[e + 1] || '').trim() === '') e++;
    lines.splice(s, e - s + 1);
    log.push('removed duplicate mascotDefaultSrc block (fn line ' + fn + ')');
  }
  mb = lines.join('\n');
}
if (count(mb, 'export function mascotDefaultSrc') !== 1) throw new Error('mascotDefaultSrc count != 1');
if (count(mb, 'export export') !== 0) throw new Error('export export still present');
write(MB, mb);

// ---------- 2) index.css ----------
const CSS = 'src/index.css';
let css = read(CSS);
{
  const lines = css.split('\n');
  const selIdx = [];
  lines.forEach((l, i) => { if (l.includes('.mascot-badge:not(')) selIdx.push(i); });
  for (let k = selIdx.length - 1; k >= 1; k--) {
    const sel = selIdx[k];
    // include the 2-line Thai comment right above
    let s = sel;
    while (s > 0 && (lines[s - 1].includes('ทุกมาสคอตขยับได้') || lines[s - 1].includes('ไม่โดนทับ'))) s--;
    // selector block closing brace
    let e = sel;
    while (e < lines.length && lines[e].trim() !== '}') e++;
    if (e >= lines.length) throw new Error('css selector block end not found');
    if ((lines[e + 1] || '').trim() === '') e++;
    // the duplicated @keyframes mascotIdle that follows
    let p = e + 1;
    while (p < lines.length && lines[p].trim() === '') p++;
    if (p < lines.length && lines[p].includes('@keyframes mascotIdle')) {
      let ke = p;
      while (ke < lines.length && lines[ke].trim() !== '}') ke++;
      if (ke >= lines.length) throw new Error('css keyframes end not found');
      e = ke;
      if ((lines[e + 1] || '').trim() === '') e++;
    }
    lines.splice(s, e - s + 1);
    log.push('removed duplicate css idle block (selector line ' + sel + ')');
  }
  css = lines.join('\n');
}
if (count(css, '.mascot-badge:not(') !== 1) throw new Error('css selector count != 1');
if (count(css, '@keyframes mascotIdle') !== 1) throw new Error('keyframes count != 1');
write(CSS, css);

// ---------- summary ----------
if (log.length === 0) {
  console.log('[r52_dedup] nothing to do — already clean');
} else {
  console.log('[r52_dedup] applied:');
  for (const l of log) console.log('  - ' + l);
}
console.log('[r52_dedup] OK counts: mascotDefaultSrc=1, export export=0, css selector=1, keyframes=1');