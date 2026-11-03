// R62 PHASE 8 — merge BMB_OWNER_ROLE_TEST_GUIDE into BMB_PRODUCTION_TEST_PACK.md
// + insert old→new Test ID map + pointer updates. Guide moves to archive AFTER this.
const fs = require('fs');

const pack = fs.readFileSync('docs/BMB_PRODUCTION_TEST_PACK.md', 'utf8');
const guide = fs.readFileSync('docs/BMB_OWNER_ROLE_TEST_GUIDE_2026-10-27.md', 'utf8');
if (pack.includes('## §RG —')) { console.error('ALREADY_MERGED'); process.exit(1); }

const guideBody = guide
  .replace(/^# [^\n]*\n/, '') // strip guide H1 (pack has its own)
  // prefix guide headings so they don't collide with pack sections (## 0 exists in both)
  .replace(/^(#{2,4}) /gm, '$1 RG·');

const mapSection = `

---

## §MAP — Old → New Test ID map (R62 PHASE 8 · แหล่ง ID เดิม → ตำแหน่งใหม่ในไฟล์นี้)

> **ไฟล์เดียวที่ใช้ปิดงาน = เอกสารนี้** · ID จากเอกสารเก่าทั้งหมดชี้มาที่นี่ · **ห้ามใช้ ID จากไฟล์ย้ายเข้า archive แล้วโดยไม่เทียบตารางนี้**

| แหล่งเดิม (ย้ายเข้า \`docs/archive/\` แล้ว) | ID เดิม | ตำแหน่งใหม่ในไฟล์นี้ |
|---|---|---|
| \`BMB_OWNER_ROLE_TEST_GUIDE_2026-10-27.md\` §3 (บท 1 ลูกค้า) | B1–B7 · E1 · J1–J4 · RL-DEFECT · RT-L3/4/5/7/8 · H10 | §B · §E · §J · §L-RT · §H (RL-DEFECT = §0 รอบ defect 2026-10-26) |
| เล่มเดิม §4 (บท 2 แอดมิน/Owner) | C1–C8 · E2 · G1 · I1–I4 · K · H1 | §C · §E · §G · §I · §K · §H |
| เล่มเดิม §5–§12 (บท 3–10 role อื่น) | H2 (ครัว) · H3 (คลัง) · H4 (การเงิน) · H5 (การตลาด) · H6 (POS) · H7 (ซัพพอร์ต) · H8 (ผู้ตรวจ) · F1/F2 + H9 (ไรเดอร์) | §H (ตาราง role 13 ค่า) · §F (rider ring) |
| เล่มเดิม §13 (ขั้นผูกเวลา) | B2 (~11:00) · RT-HOURS · C7/C8 | §B2 · §L-RT (RT-HOURS) · §C (C7/C8) |
| \`BMB_MASTER_TEST_CHECKLIST_2026-10-28.md\` §1 (P0 retest) | 1A–1I | ผล Owner retest 44 ข้อ = บันทึกใน checklist ฉบับนั้น (ยัง KEEP) · ขั้นตรวจจริง = §M/§N/§O/§P/§R |
| เล่มเดิม §2–§4 (P1) | 2-x · 3-x · 4-x | §B–§E · §L-RT · §C (C7/C8) |
| เล่มเดิม §5–§7 (P2/P3) | settings-sync 14 คีย์ · role (§6) · 7-x | §H (role) · §L-RT · §J (G&R) |
| \`BMB_PRODUCTION_TEST_PACK.md\` §T (R56–R59) | T-A1..T-E2 = **19 แถว** | อยู่ในไฟล์นี้ §T (ไม่เปลี่ยน ID) |

**กติกา:** FAIL = จด defect ใหม่ลง \`AI_WORK_STATE.md\` · SKIPPED ≠ PASS · ห้ามตัดข้อทิ้ง · เกณฑ์ปิด = §RG §16 (ด้านล่างสุดของไฟล์นี้)

---

## §RG — คู่มือสอนเดินทุก Role (ฉบับเต็ม · รวมมาจาก \`BMB_OWNER_ROLE_TEST_GUIDE_2026-10-27.md\` → MOVE เข้า \`docs/archive/\` แล้ว · R62 PHASE 8)

${guideBody}

---
`;

const merged = pack + mapSection;
fs.writeFileSync('docs/BMB_PRODUCTION_TEST_PACK.md', merged);
console.log('MERGED_OK pack_bytes=' + Buffer.byteLength(merged) + ' (was ' + Buffer.byteLength(pack) + ')');
