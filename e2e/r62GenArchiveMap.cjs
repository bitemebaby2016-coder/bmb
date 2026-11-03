// R62 PHASE 5 — generate docs/BMB_DOCUMENT_INVENTORY_AND_ARCHIVE_MAP.md
// Data: e2e/r62DocRefs-result.json (dependency check) + filesystem inventory.
// Classification rules:
//   KEEP_ROOT = canonical agent-entry + root contracts with TEST IMPORT / migration-comment deps
//   BLOCKED   = referenced from CODE (import/read) or from migration SQL comments
//   KEEP_DOCS = canonical/current docs (status/test-pack/reconciliation/user guides)
//   ARCHIVE   = point-in-time reports/superseded handoffs, unreferenced from code
const fs = require('fs');
const path = require('path');

const refs = JSON.parse(fs.readFileSync('e2e/r62DocRefs-result.json', 'utf8'));
const referenced = refs.referenced; // {docPath: [codeRefs]}

const KEEP_ROOT = new Set([
  'README.md', 'AI_ENTRYPOINT.md', 'AI_WORK_STATE.md', 'UNIVERSAL_MASTER_AI_RULES.md',
  'BMB_G6_CONTRACT.md', 'BMB_G7_CONTRACT.md',               // test ?raw import
  'BMB_G10_DEFECT_117_FC_ROLLBACK.md',                      // migration 118 comment
]);
const KEEP_DOCS = new Set([
  'docs/BMB_MASTER_STATUS.md',
  'docs/BMB_PRODUCTION_TEST_PACK.md',
  'docs/BMB_REQUIREMENT_RECONCILIATION.md',
  'docs/BMB_OWNER_ROLE_TEST_GUIDE_2026-10-27.md',
  'docs/01_SYSTEM_ARCHITECTURE.md', 'docs/02_API_INTEGRATIONS.md',
  'docs/03_ADMIN_USER_GUIDE.md', 'docs/04_DEPLOYMENT_RUNBOOK.md',
  'docs/BMB_MASTER_TEST_CHECKLIST_2026-10-28.md',
  'docs/BMB_OPENING_READINESS_MASTER.md',
  'docs/BMB_OWNER_LAUNCH_CHECKLIST.md',
  'docs/BMB_HANDOFF_NEXT_SESSION_2026-11-02.md',
]);
const codeRefDocs = new Set(Object.keys(referenced).filter(k => k.startsWith('docs/')));

const keepRootList = fs.readdirSync('.').filter(f => f.endsWith('.md') && KEEP_ROOT.has(f));
const rootArchive = fs.readdirSync('.').filter(f => f.endsWith('.md') && !KEEP_ROOT.has(f));
const docsAll = fs.readdirSync('docs', { recursive: true })
  .filter(f => typeof f === 'string' && f.endsWith('.md'))
  .map(f => 'docs/' + String(f).replace(/\\/g, '/'));

const docsKeep = [], docsBlocked = [], docsArchive = [];
for (const d of docsAll) {
  if (KEEP_DOCS.has(d)) docsKeep.push(d);
  else if (codeRefDocs.has(d) || d.startsWith('docs/archive/')) docsBlocked.push(d);
  else docsArchive.push(d);
}
const target = 'docs/archive';
module.exports = { keepRootList, rootArchive, docsAll, docsKeep, docsBlocked, docsArchive, referenced, target };

if (require.main === module) {
  const lines = [];
  lines.push('# BMB — DOCUMENT INVENTORY & ARCHIVE MAP (R62 PHASE 5)');
  lines.push('');
  lines.push('> **สร้างตามคำสั่ง Owner 2026-11-03** (WHOLE PROJECT FINAL CLOSURE · Old Documents = MOVE TO ARCHIVE, NO DELETE)');
  lines.push('> · dependency check = `e2e/r62DocRefs.cjs` → `e2e/r62DocRefs-result.json` (สแกน code 1,552 ไฟล์: src/e2e/scripts/.github/public/supabase/workers)');
  lines.push('> · **กติกา:** ① MOVE ห้าม DELETE ทุกกรณี ② เอกสารที่โค้ด/migration อ้าง = **BLOCKED ห้ามย้าย** (migrations ห้ามแตะ → แก้ comment ไม่ได้)');
  lines.push('> ③ KEEP = canonical/current ที่ยังอ่าน/ใช้อยู่ ④ แผนผังเก่า→ใหม่ = §5 (ค้นย้อนหลังได้)');
  lines.push('');
  lines.push('## §1 สรุปตัวเลข (ณ สร้างเอกสาร · HEAD `22e2b1b`)');
  lines.push('');
  lines.push('| หมวด | จำนวน |');
  lines.push('|---|---|');
  lines.push(`| Root .md ทั้งหมด | ${keepRootList.length + rootArchive.length} |`);
  lines.push(`| Root KEEP (ห้ามย้าย) | ${keepRootList.length} |`);
  lines.push(`| Root → ARCHIVE (แผนย้าย) | ${rootArchive.length} |`);
  lines.push(`| docs/*.md recursive ทั้งหมด | ${docsAll.length} |`);
  lines.push(`| docs KEEP (canonical/current) | ${docsKeep.length} |`);
  lines.push(`| docs BLOCKED (โค้ด/migration อ้าง) | ${docsBlocked.filter(d => !d.startsWith('docs/archive/')).length} |`);
  lines.push(`| docs → ARCHIVE (แผนย้าย) | ${docsArchive.length} |`);
  lines.push(`| docs/archive มีอยู่แล้ว | ${docsAll.filter(d => d.startsWith('docs/archive/')).length} |`);
  lines.push('');
  lines.push('## §2 ROOT — KEEP (ห้ามย้าย · เหตุผลรายไฟล์)');
  lines.push('');
  lines.push('| เหตุผล | ไฟล์ |');
  lines.push('|---|---|');
  lines.push('| canonical agent entry | `AI_ENTRYPOINT.md` · `AI_WORK_STATE.md` · `UNIVERSAL_MASTER_AI_RULES.md` · `README.md` |');
  lines.push('| **TEST IMPORT** (`?raw` ใน `src/__tests__/g6g7OrderBoundary.test.ts`) | `BMB_G6_CONTRACT.md` · `BMB_G7_CONTRACT.md` |');
  lines.push('| อ้างใน **migration 118** comment + `e2e/m118BuildFromLive.cjs` (ห้ามแตะ migrations) | `BMB_G10_DEFECT_117_FC_ROLLBACK.md` |');
  lines.push('');
  lines.push('## §3 docs/ — KEEP (canonical / current / README อ้าง)');
  lines.push('');
  for (const d of docsKeep.sort()) lines.push('- `' + d + '`');
  lines.push('');
  lines.push('## §4 docs/ — BLOCKED (โค้ด/CI/migration อ้าง · ห้ามย้ายจนกว่าจะแก้ฝั่งโค้ด)');
  lines.push('');
  lines.push('| เอกสาร | อ้างโดย (code paths) |');
  lines.push('|---|---|');
  for (const d of docsBlocked.filter(x => !x.startsWith('docs/archive/')).sort()) {
    const r = (referenced[d] || []).map(x => '`' + path.basename(x) + '`').join(' · ');
    lines.push('| `' + d + '` | ' + r + ' |');
  }
  lines.push('');
  lines.push('## §5 แผนย้าย (MOVE → `docs/archive/`) — รันด้วย `git mv` เฉพาะไฟล์ · ห้าม `git add -A`');
  lines.push('');
  lines.push('### 5.1 Root reports → `docs/archive/root_reports/` (' + rootArchive.length + ' ไฟล์)');
  lines.push('');
  for (const f of rootArchive.sort()) lines.push('- `' + f + '` → `docs/archive/root_reports/' + f + '`');
  lines.push('');
  lines.push('### 5.2 docs/ point-in-time → `docs/archive/` (' + docsArchive.length + ' ไฟล์)');
  lines.push('');
  for (const f of docsArchive.sort()) lines.push('- `' + f + '` → `docs/archive/' + f.slice(5) + '`');
  lines.push('');
  lines.push('## §6 บันทึก');
  lines.push('');
  lines.push('- **Stash** `local-edits-before-sync-2026-09-21` = ไม่เกี่ยวกับเอกสารนี้ · PRESERVE ตามเดิม');
  lines.push('- ย้ายแล้วต้องรัน gates (vitest) ซ้ำ = พิสูจน์ว่าไม่มี test อ่านไฟล์ที่ย้าย (test import หลัก = G6/G7 contracts ซึ่ง KEEP แล้ว)');
  lines.push('- รายงานเก่า = "รายงาน ณ วันนั้น" ห้ามแก้วันที่/สถานะในไฟล์ที่ย้าย (คงสภาพตามต้นฉบับ)');
  lines.push('- dependency check ทุกครั้งก่อนย้าย: `node e2e/r62DocRefs.cjs` ใหม่ ถ้ามี ref เพิ่ม = ชะลอไฟล์นั้น');
  fs.writeFileSync('docs/BMB_DOCUMENT_INVENTORY_AND_ARCHIVE_MAP.md', lines.join('\n'));
  fs.writeFileSync('e2e/r62MoveList.json', JSON.stringify({
    at: new Date().toISOString(),
    root: rootArchive.map(f => ({ from: f, to: 'docs/archive/root_reports/' + f })),
    docs: docsArchive.map(f => ({ from: f, to: 'docs/archive/' + f.slice(5) })),
    blocked: docsBlocked.filter(d => !d.startsWith('docs/archive/')),
    keepRoot: keepRootList, keepDocs: docsKeep,
  }, null, 1));
  console.log('PART1 lines=' + lines.length + ' rootArchive=' + rootArchive.length +
    ' docsKeep=' + docsKeep.length + ' docsBlocked=' + docsBlocked.length +
    ' docsArchive=' + docsArchive.length);
}
