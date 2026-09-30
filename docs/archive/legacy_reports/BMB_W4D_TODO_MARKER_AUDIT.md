# BMB_W4D_TODO_MARKER_AUDIT.md
**W4-D — TODO / Marker Audit · วันที่: 2026-09-27 · AUDIT FIRST · Authority: Production runtime > Code > Deployment state > Docs**

## Scan จริงทั้ง repo (tracked files, word-boundary)

| Marker | Raw hits ทั้ง repo | ใน code paths | ใน docs/specs |
|---|---|---|---|
| TODO | 26 | **2** (phone-auto-login ×2) | 24 (5 ไฟล์ — รวม lighthouse artifact ×11) |
| FIXME | 0 | 0 | 0 |
| XXX | 67 | 0 | 67 (doc words/IDs) |
| HACK | 9 | **1** (test data value) | 8 |
| TEMP | 257 | benign (SQL `CREATE TEMP TABLE`, `supabase.temp/` gitignored dir, CI strings) | ส่วนใหญ่ doc words |
| PLACEHOLDER | 134 | benign (HTML `placeholder=` attributes ×หลาย, `ci-placeholder` dummy URL ใน ci.yml:14) | doc words |
| STUB | 27 | 0 marker (realtimeStub = intentional KEEP จาก W4-C) | doc words |
| NOT_IMPLEMENTED | 0 | 0 | 0 |

## Marker ใน ACTIVE CODE (รายการเดียวที่เป็น TODO จริง)

| # | File | Line | Marker | Symbol | Context | Production path? | Runtime impact | Business impact | Security impact | Severity | Action |
|---|---|---|---|---|---|---|---|---|---|---|---|
| 1 | supabase/functions/phone-auto-login/index.ts | 14 | TODO OTP | phone-auto-login EF header comment | เอกสารข้อจำกัด flow | **YES** (deployed v4, ACTIVE — PWA quick login ใช้จริง) | login ทำงานตาม design | **customer identity: เบอร์โทรไม่มีการ verify ด้วย OTP** (MVP ตั้งใจ) | ปานกลาง — ใครรู้เบอร์+ชื่อสามารถ login เข้า account ได้ | **HIGH** | **OWNER DECISION REQUIRED** (แก้ = SMS/identity change → FROZEN scope: SMS — ห้าม implement เอง) |
| 2 | supabase/functions/phone-auto-login/index.ts | 117 | TODO OTP | login handler | "for production-grade phone verification replace this flow" | เดียวกับข้อ 1 | — | — | เดียวกับข้อ 1 | HIGH | OWNER DECISION REQUIRED (รายการเดียวกับข้อ 1) |

## Marker อื่นใน code — ไม่ใช่ technical debt

| File | Line | คำ | Classification | Severity | Action |
|---|---|---|---|---|---|
| e2e/contracts_029_round_grant.sql | 85 | HACK | TEST (ค่า promo/menu code ใน fixture) | INFO | NO ACTION |
| .github/workflows/ci.yml | 14 | ci-placeholder | CI env dummy URL (build-only) | INFO | NO ACTION |
| src/components/home/FloatingAdBanners.tsx | 30 | MOCK_BANNER_IMAGE | ชื่อตัวแปรของ asset จริงที่ใช้แสดง (functional) | LOW/INFO | NO ACTION |
| src/lib/homeProviders.ts | 32 | "MOCK_* overlays removed" | COMMENT (บอกสถานะปัจจุบัน — ถูกต้อง) | INFO | NO ACTION |
| src/types/index.ts + bmbAdminApi_products.ts | 28/54/62 | DEPRECATED alias | COMPAT (migration 023 one-way mirror — deliberate) | INFO | NO ACTION |

## Markers ใน docs — จำแนกแล้ว

| Doc | TODO | Classification | Evidence | Severity | Action |
|---|---|---|---|---|---|
| SECURITY_REMEDIATION_PLAN.md | ×4 (P1-1..P1-5) | **ACTIVE KNOWN DEBT (documented)** | P1-1 race = **FROZEN (race optimization — DO NOT TOUCH)** · P1-2 inventory clamp · P1-3/P1-5 localStorage→DB business data | MEDIUM | **OWNER DECISION / DEFERRED** (แก้ = business logic/schema → ห้ามทำใน W4) |
| AI_WORK_STATE.md + BMB_00_REPOSITORY_REALITY.md | ×3 (MOCK_STOCK/BADGE/RATING) | **OBSOLETE (STALE DOC)** — overlays ถูกลบแล้วจริง | src/lib/homeProviders.ts:32 + git grep MOCK_ = ไม่เหลือ (มีเพียง MOCK_BANNER_IMAGE ชื่อ asset) | INFO | NO ACTION (historical state docs) |
| BMB_W4_READINESS_ARCHITECTURE_DEBT_AUDIT.md | ×2 | DOCUMENTATION (W4 status itself) | — | INFO | NO ACTION |
| lighthouse/report.report.html | ×11 | GENERATED ARTIFACT (tool output) | — | INFO | NO ACTION |

## Required Output

```text
========================================
W4-D TODO / MARKER AUDIT
========================================

TOTAL MARKERS (raw): 520 (TODO 26 · FIXME 0 · XXX 67 · HACK 9 · TEMP 257 ·
  PLACEHOLDER 134 · STUB 27 · NOT_IMPLEMENTED 0)
TRUE MARKERS IN ACTIVE CODE: 1 item (TODO OTP ×2 lines — phone-auto-login)

CRITICAL: 0
HIGH:     1 (TODO OTP — customer identity verification gap — deliberate MVP)
MEDIUM:   1 (SECURITY_REMEDIATION_PLAN P1-1..P1-5 active known debt — documented)
LOW:      0
INFO:     ที่เหลือทั้งหมด (docs/generated/test fixtures/UI attributes/compat comments)

SAFE CLEANUP: 0 จำเป็น (MOCK_* TODOs = OBSOLETE docs — historical records,
  ไม่แตะ; ไม่มี dead code/typo ที่กระทบ)
OWNER DECISION: 2 — **RESOLVED (Owner 2026-09-27): (1) OTP = ACCEPT MVP RISK/FROZEN (2) P1-2/3/5 = DEFERRED (Future Security Phase)**
  (1) TODO OTP — phone login ไม่มี SMS verification: รับความเสี่ยงต่อ / อนุมัติ
      implement OTP (แตะ FROZEN: SMS + identity → ต้องอนุมัติแยก)
  (2) P1-2/P1-3/P1-5 (inventory clamp, localStorage→DB) — จัดคิว remediation
      หรือ DEFER (P1-1 race = FROZEN)
IMPLEMENTATION REQUIRED: 0 ในรอบนี้ (ทุก implementation = business/schema/
  provider change → ต้องอนุมัติแยกเป็น project ใหม่)
FROZEN / DEFERRED: P1-1 race optimization (FROZEN) · TODO OTP (DEFERRED →
  OWNER) · P1-2/3/5 (DEFERRED → OWNER)
========================================
```

## STATUS

```text
IMPLEMENTED      = 0 (audit-only; ไม่มี code change ใน W4-D)
CONNECTED        = N/A
DEPLOYED         = phone-auto-login v4 (มี TODO OTP ใน comment — runtime ทำงานตาม design เดิม)
RUNTIME VERIFIED = scheduler ต่อเนื่อง ✓ · gates จาก commit aab0619 (tsc 0 · vitest
                   179/179 · lint 0 · build ✓ · secret scans 0 — W4-D ไม่มี code change)
MISSING          = OTP verification (business requirement รอ Owner decision)
BLOCKED          = TODO OTP implementation (FROZEN: SMS scope — ห้ามทำเอง)
DEFERRED         = P1-1 (FROZEN) · P1-2/3/5 (OWNER)
OWNER DECISION   = 2 (รายการข้างบน)
```

## OWNER DECISIONS — LOCKED (2026-09-27)

```text
OTP (phone-auto-login TODO) = ACCEPT MVP RISK → FROZEN
P1-1 race optimization      = FROZEN
P1-2 / P1-3 / P1-5          = DEFERRED (Known Tech Debt / Future Security Phase)
```

## ห้ามตีความ

- ห้ามรายงาน TODO OTP เป็น PASS หรือ RESOLVED — สถานะจบที่ **FROZEN: ACCEPT MVP RISK (Owner 2026-09-27)**
- ห้ามสรุป raw marker counts เป็น debt — ส่วนใหญ่เป็น doc words/UI attributes/SQL syntax

## FROZEN SCOPE — INTACT
Payment Events · Web Push/VAPID · Email · SMS · LINE · Meta real E2E · Facebook Group · pg_cron · race optimization · Supabase Pro/PITR · non-prod restore · new providers — ไม่ถูกแตะ
Manual dump `bmb-prod-dump-20260927-2328.sql`: DO NOT COMMIT / DO NOT UPLOAD — ปฏิบัติตามแล้ว
