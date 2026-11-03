# BMB ADMIN SYSTEM — LEGACY DUPLICATION AUDIT (คำสั่งใหม่ของ Owner · 2026-10-24)

> คัดลอกคำสั่งต้นฉบับของ Owner มาไว้ ณ ที่นี้เพื่อใช้เปิดแชทหน้า (ห้ามแก้เนื้อหาคำสั่ง) ·
> บริบท: เป็นคำตอบ **Q4** ของ `BMB_ROUND_MODEL_ONE_PAGER_2026-10-24.md`
> ("มีการทำงานซ้ำซ้อนและเมนูซ้ำซ้อนกับใน setting แอดมิน ตรวจและแก้ตามคำสั่งใหม่")
> ลำดับงานแชทหน้า = **อ่าน-ตรวจสอบอย่างเดียวก่อน** → ส่งรายงาน → **รอ Owner approve** → ค่อย implement

---

# BMB ADMIN SYSTEM — LEGACY DUPLICATION AUDIT
## OWNER DIRECTIVE — READ-ONLY, NO IMPLEMENTATION

Owner has identified substantial suspected duplication across the existing Admin system, including menus, features, naming, and potentially overlapping backend responsibilities.

Your first task is to investigate the existing system, not to create or modify it.

### 1. Protect the current state

Before auditing, report:

- Exact repository and working directory.
- Current branch and HEAD SHA versus origin/main.
- Staged and unstaged diffs.
- Every untracked file, its size, and likely purpose.
- Stash list and status.
- Current CI/build status if verifiable.

Preserve all existing work. Do not reset, clean, overwrite, stage, commit, or push anything.

### 2. Inventory the entire Admin system

Inspect every existing Admin navigation entry, including nested menus, routes, localized labels, page components, shared components, API endpoints, services, database objects, permissions, and relevant background jobs.

Trace actual implementations and dependencies. Do not classify features based on menu labels or filenames alone.

### 3. Produce a duplication matrix

For every suspected duplicate, document:

- Thai and English menu labels.
- Route and actual destination.
- Capability and business purpose.
- Frontend implementation and backend dependencies.
- Database tables, functions, and policies involved.
- Roles and permissions.
- Actual differences, overlaps, and known usage.
- Evidence supporting the classification.
- Recommended action: KEEP, MERGE, REPAIR, DEPRECATE, REMOVE, or NEEDS INVESTIGATION.
- Risks and required regression tests.

Distinguish genuine duplication from separate business functions that share similar names.

### 4. Propose the canonical Admin architecture

Design a consolidated navigation and capability map using the existing system as the baseline.

Identify which existing implementation should own each capability, which routes and labels should point to it, and which redundant implementations can be safely retired.

Do not assume that every duplicate requires a new service, table, migration, or registry.

### 5. Identify hidden duplication and incomplete functionality

Investigate overlapping business logic, disconnected pages, placeholder features, duplicate APIs, inconsistent permissions, competing sources of truth, and features that appear complete in the UI but do not work end to end.

### 6. Deliver the audit report

Provide:

1. Verified current-state baseline.
2. Complete Admin navigation and capability inventory.
3. Evidence-backed duplication matrix.
4. Proposed target navigation and architecture.
5. Prioritized consolidation plan with dependencies and risks.
6. Test and acceptance criteria for each proposed change.
7. Explicit Owner decisions required.
8. Findings that could not be verified and the evidence still needed.

### STRICT STOP CONDITIONS

- No source-code modifications.
- No database writes or schema changes.
- No new migrations.
- No renaming, deletion, or deprecation execution.
- No environment or configuration changes.
- No deployment, commit, or push.

Stop after delivering the audit and proposed plan. Wait for explicit Owner approval before implementing any consolidation.

Do not claim the Admin system is fully audited unless the report accounts for all relevant navigation entries and traces their actual implementations and dependencies. Clearly disclose any incomplete coverage.

---

## ภาคผนวก (ไม่ใช่คำสั่ง — บริบทให้แชทหน้าเริ่มได้ทันที)

### A. จุดเริ่มตรวจสอบสถานะ (ขั้นที่ 1 ของคำสั่ง) ณ ปิดเซสชันรอบ 14

- Repository: `D:\A PROJECT\Bite Me Baby` · branch `main`
- HEAD `7a24123` = `origin/main` · working tree **clean** · stash = `stash@{0}: On main: local-edits-before-sync-2026-09-21` (PRESERVED ห้ามแตะ)
- CI ล่าสุด: `7a24123` → **CI success + Contract Tests success** (ก่อนหน้านั้น `9d5fc24`, `d306ca7` ก็เขียวทั้งคู่)
- Production DB ledger = **149,148,147,146** · deploy = `biteme-baby.com` (auto-deploy จาก main)
- ไฟล์ `UNIVERSAL_MASTER_AI_RULES.md` = **Owner เขียนเอง** (คัดกฎจาก AI_WORK_STATE) = กฎใหม่ที่ใช้ในแชทหน้า

### B. จุดที่ Owner ชี้ว่ามี "เมนู/งานซ้ำซ้อน" (เบาะแส — ต้องตรวจสอบ ห้ามเชื่อก่อนพิสูจน์)

1. **`/admin/rounds` (AdminRounds) vs หน้า settings** — คัทออฟ/แพทเทิร์น/เวลา อาจซ้ำกับที่อยู่ใน AdminSettings (`OrderPolicyPanel`, `order_pattern`)
2. **หน้า settings หลายชิ้น** — `orderPolicy` fields กับคีย์ `business_settings` ที่ตั้งจากที่อื่น (JSON ดิบเดิม)
3. **Q3 (อนุมัติแล้ว)** — รวมบล็อก "แพทเทิร์น + รอบรายวัน" ใน AdminRounds เป็นแท็บเดียว (ทำ **หลัง** audit + approve)
4. เมนูแอดมิน 13 กลุ่ม (`navGroupsForRole` ใน `AdminNav.tsx`) — ต้องไล่ทุก entry + route + component จริง

### C. สิ่งที่ห้ามลืมทำในรายงาน (มาตรฐานไร้รอยต่อ)

- ทุก nav entry ต้องมีบรรทัดใน inventory **ครบ** ถ้าขาดต้องเขียน "INCOMPLETE COVERAGE" ตรง ๆ
- แยก "ชื่อซ้ำแต่คนละธุรกิจ" ออกจาก "ซ้ำจริง" ด้วยหลักฐาน (โค้ด/สคีมา/การเรียกใช้จริง)
- ทุกข้อเสนอต้องมี test/acceptance criteria + ความเสี่ยง + สิ่งที่ Owner ต้องตัดสินใจ

**สถานะไฟล์นี้: 📌 DIRECTIVE (read-only ห้าม implement จนกว่า Owner approve รายงาน)**