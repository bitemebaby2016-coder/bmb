# BMB_W4E_ARCHITECTURE_DEBT_AUDIT.md
**W4-E-0 — Architecture / Technical Debt Reality Audit · วันที่: 2026-09-27 · AUDIT ONLY (ไม่มี implementation) · Authority: Production runtime > Code > Deployment state > Docs**

## STEP 1 — SYSTEM HEALTH (re-verified จาก production จริง 2026-09-27)

| Dimension | สถานะ | Evidence (สด) |
|---|---|---|
| Edge Functions | HEALTHY | Management API: 7/7 ACTIVE (create-checkout v36 · stripe-webhook v44 · stripe-refund v6 · phone-auto-login v4 · ai-proxy v4 · automation-worker v7 · channel-webhook v3) — 0 placeholder เหลือ |
| Automation scheduler | HEALTHY | GitHub Actions: automation-scheduler ต่อเนื่อง ≥12 runs ล่าสุด success ทั้งหมด (ล่าสุด 23:56Z) บน HEAD d06761c |
| CI | HEALTHY | CI run completed/success ทุก commit ล่าสุด 5 ตัว: 4c05cf7 · 1873047 · 45ade88 · aab0619 · d06761c ✓ |
| Canonical order boundary | INTACT | Live pg_policies: orders = anon SELECT only / INSERT เฉพาะ own+authenticated / admin ALL — **ไม่มี public INSERT** (W3-E4 ยืนยัน anon INSERT 401) |
| AI boundary | INTACT | AI paths = SELECT-only + read-only helpers; 0 write patterns; business writes = server RPC only |
| Frontend DB writes (RLS-guarded) | BY DESIGN | Admin CRUD (drivers/inventory/media/products/promotions/users) ผ่าน client writes คุมโดย `admin ALL` policies — ความเสี่ยงด้าน consistency ไม่ใช่ bypass |
| Payments | INTACT | canonical RPC state machine (008) — client-direct orders.update({status}) ถูกปิดทาง policy + code comment |
| Secrets | CLEAN | repo-tracked files 0 secrets · dist 0 (hits ทั้งหมดอยู่ใน src/.kilo local tool worktree = gitignored, 0 tracked) |
| DR / Backup | OWNER ACCEPTED RISK | manual dump 2026-09-27-2328 มี · off-site/automated/PITR = ไม่มี (FROZEN ทางการเงิน) |

## Master Debt Matrix

| ID | Component | Finding | Evidence | Severity | Type | Status | Recommended Action |
|---|---|---|---|---|---|---|---|
| D1 | AI intelligence modules | 5 modules (inventoryPrediction/demandForecasting/customerIntelligence/promotionIntelligence ×2) + AdminOrders/DeliveryManagement ยังเรียก `getOrders()` full-table | git grep getOrders callers · getOrdersPaged มีแล้ว (W4-A) | **MEDIUM** | SCALABILITY/PERFORMANCE | OPEN | SAFE CLEANUP CANDIDATE (W4-E-1): migrate callers ไป paged/aggregated reads — non-destructive |
| D2 | Admin write path | Admin CRUD บางเส้น write ผ่าน client + RLS (แทน RPC) | git grep .insert/.update/.delete ใน bmbAdminApi_* | MEDIUM | ARCHITECTURE (consistency) | OPEN | KEEP มาตรฐานปัจจุบัน — ย้ายไป RPC = future phase (schema/logic change) |
| D3 | phone-auto-login | OTP ไม่มี (identity gap) | TODO OTP ×2 (W4-D) | — | SECURITY | FROZEN BY OWNER (ACCEPT MVP RISK) | NO ACTION |
| D4 | capacity race (P1-1) | SECURITY_REMEDIATION_PLAN P1-1 | W4-D | — | RELIABILITY | FROZEN BY OWNER | NO ACTION |
| D5 | P1-2/P1-3/P1-5 | inventory clamp · localStorage business data · Promotions/Review DB | SECURITY_REMEDIATION_PLAN | — | SECURITY/ARCHITECTURE | DEFERRED (Future Security Phase) | บันทึก ledger แล้ว |
| D6 | DR / backup | off-site/automated/PITR ไม่มี · manual dump มี | สถานะจริง + W3-E gates | — | RELIABILITY | OWNER ACCEPTED RISK | รักษา manual dump เป็นระยะ (ห้ามเปิด Pro ใน W4) |
| D7 | docs | raw marker counts (doc words/HTML attrs/fixtures) | W4-D | INFO | DOCUMENTATION | CLOSED | NO ACTION |
| D8 | tooling local | src/.kilo/worktrees (gitignored, 0 tracked) | git ls-files | INFO | MAINTAINABILITY | CLOSED | NO ACTION |
| D9 | test coverage | ไม่มี unit test ของ getOrdersPaged (ยืนยันด้วย runtime probe แทน) | W4-A checkpoint | LOW | MAINTAINABILITY | OPEN | optional follow-up |

## Required Output

```text
========================================
W4-E ARCHITECTURE / TECHNICAL DEBT AUDIT
========================================

SYSTEM HEALTH: HEALTHY — 7/7 EF ACTIVE · scheduler ต่อเนื่อง success ·
  CI success ทุก commit ล่าสุด 5 ตัว · canonical/AI boundaries INTACT ·
  secrets CLEAN · ไม่พบ CRITICAL ใหม่

CRITICAL: 0
HIGH:     0
MEDIUM:   2 (D1 full-table AI/analytics queries · D2 admin client-write path)
LOW:      1 (D9 unit-test gap ของ paged path)
INFO:     D7 D8

OWNER ACCEPTED RISKS: DR off-site/automated/PITR (D6) · OTP MVP risk (D3)
FROZEN: OTP/SMS (D3) · P1-1 (D4) · Meta real E2E · Facebook Group ·
  Payment Events · Web Push/VAPID · Email · SMS · LINE · pg_cron ·
  Supabase Pro/PITR · new external providers
DEFERRED: P1-2 · P1-3 · P1-5 (Future Security Phase)

SAFE CLEANUP: 1 (D1 — migrate AI/analysis callers จาก getOrders() ไป
  paged/aggregated path — non-destructive, ไม่แตะ business rules/schema)
IMPLEMENTATION CANDIDATES: 1 (D1 → W4-E-1) · optional (D9)
OWNER DECISIONS REQUIRED: 1 (เลือก D1 ใน W4-E-1 หรือปิด W4 ที่นี่)
========================================
```

## STEP 8 — AUDIT FINDINGS ≠ IMPLEMENTATION CANDIDATES

- AUDIT FINDINGS = Master Debt Matrix ข้างบน (ไม่มีการ implement ใดในรอบนี้)
- IMPLEMENTATION CANDIDATES (รอ Owner เลือก):
  1. **D1** — migrate 5 AI modules + AdminOrders/DeliveryManagement ไป paged/aggregated reads (`getOrdersPaged` จาก W4-A ใช้ซ้ำได้; non-destructive)
  2. **D9 (optional)** — unit tests ของ getOrdersPaged

## STEP 9 — QUALITY

- git status/diff: เอกสาร audit เท่านั้น · secret scan CLEAN (0)
- Commit/Push แล้ว · HEAD == origin/main · WORKTREE = CLEAN

**HARD STOP — ห้ามเริ่ม W4-E-1 เอง รอ Owner เลือกจาก Debt Matrix**