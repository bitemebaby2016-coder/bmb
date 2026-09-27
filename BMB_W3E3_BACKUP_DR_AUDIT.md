# BMB_W3E3_BACKUP_DR_AUDIT.md
**W3-E-3 — Backup / DR Verification (CLOSURE) · วันที่: 2026-09-27 · READ-ONLY · หลักฐานจาก Supabase Management API จริง (ยืนยันซ้ำ 2 ครั้ง ผลตรงกัน) · Scheduler = CLOSED/PASS (ไม่แตะตามคำสั่ง)**

## ⚠️ CRITICAL FINDING (VERIFIED — หักล้าง assumption รอบแรกของเอกสารฉบับก่อน)

```text
Supabase Management API (PAT ของ CLI — read-only GET) ยืนยันซ้ำ 2 ครั้ง ผลตรงกัน:
  GET /v1/projects/ivkdfognyiwjcmrhcnwz/database/backups → 200
    { region: "ap-northeast-2", walg_enabled: true,
      pitr_enabled: false,        ← PITR ปิด
      backups: [],                ← ไม่มี backup แม้แต่ชุดเดียว
      backup_days: 0, total_backups: 0 }
  GET /v1/projects/ivkdfognyiwjcmrhcnwz → 200
    { status: "ACTIVE_HEALTHY", region: "ap-northeast-2" }
```

**Production BMB ปัจจุบัน ไม่มี automated backup และไม่มี PITR ที่พิสูจน์ได้
→ หากข้อมูลสูญหายวันนี้ (มนุษย์/bug/ransom/instance ล่ม) business data ไม่มีทางกู้คืน
(กู้คืนได้เฉพาะ code/schema จาก repo) — ความเสี่ยงระดับ CRITICAL · Owner action ด่วน**

หมายเหตุ: รอบแรกของ audit สรุป "Backup = ASSUMED / OWNER VERIFY" — **ผิด**;
ตอนนี้ตรวจได้จริงด้วย Management API (รอบแรก 404 เพราะ scope ไม่ถึง) —
เอกสารฉบับนี้แทนที่ข้อสรุปเดิมทั้งหมด

## สถานะรายหมวด (CONFIGURED ≠ VERIFIED ≠ TESTED)

```text
Backup configuration     = ASSUMED / OWNER VERIFY (dashboard → Database → Backups — AI DEV ไม่มีสิทธิ์ API; ค่าเริ่มต้นแพลตฟอร์มไม่ใช่ evidence)
PITR                     = NOT VERIFIED (add-on รายแพลตฟอร์ม — Owner ตรวจ toggle จริง)
Retention                = NOT VERIFIED (ขึ้นกับ plan)
Restore capability       = NOT VERIFIED (ไม่มี restore test เกิดขึ้น)
Restore verification     = MISSING (ไม่เคย restore บน non-production)
RPO                      = NOT DEFINED
RTO                      = NOT DEFINED
```

## RPO / RTO
ไม่มี documented/verified value จาก BMB หรือ provider → **RPO = NOT DEFINED / OWNER DECISION · RTO = NOT DEFINED / OWNER DECISION** (ห้ามเรียก backup frequency ว่า RPO อัตโนมัติ / ห้ามเรียก restore availability ว่า RTO)

## Restore verification — test plan (ห้าม restore production)
Path ปลอดภัย: สร้าง **Supabase project แยก (test)** → restore backup ลงนั้น → verify:
1. schema ตรง 49 migrations 2. row counts ตรง production snapshot 3. RLS ทำงาน (ยิง F-18 probe เทียบ)
4. Edge Functions deploy จาก repo แล้วเรียกได้ 5. RPC contract ผ่าน (e2e/contracts_*.sql)
- **BLOCKED — OWNER DECISION**: ต้องสร้าง project ใหม่ (อาจมีค่าใช้จ่าย) — ห้ามสร้างเอง ห้ามเสียเงินแทน Owner
- และขณะนี้ "ไม่มี backup ให้ restore" → test plan นี้ทำได้เมื่อ Owner เปิด backup แล้วเท่านั้น

## Recovery dependencies

| Dependency | สถานะ | หมายเหตุ |
|---|---|---|
| Supabase database — schema | Recoverable from source/config | 49 migrations ใน repo — re-run ได้ |
| Supabase database — data | **NOT VERIFIED = ไม่มี backup (VERIFIED)** | 0 backups · PITR off |
| Supabase Edge Functions | Recoverable from source/config | 16 folders ใน repo → `functions deploy` (สำเร็จมาแล้วหลายครั้ง) |
| Supabase secrets | Requires reconfiguration | ค่าจริงอยู่ local (gitignored) + provider dashboards — ถ้าเครื่องหายต้อง re-enter + regenerate |
| GitHub repository | Recoverable from source/config | clone = พื้นฐาน · 2 workflows ใน repo |
| GitHub Actions workflow (Scheduler) | Recoverable from source/config | CLOSED/PASS — secret ฝั่ง GitHub (Owner) |
| Storage (bmb-images) | NOT VERIFIED | object อยู่บน platform ที่ไม่มี backup (VERIFIED 0 backups) |
| Automation Worker | Recoverable from source/config | worker + scheduler มาจาก repo ทั้งหมด |
| Payment integration | Requires external provider (FROZEN) | Stripe keys/webhook ต้อง re-setup หลัง DR — ไม่ implement |
| Meta integration | Requires external provider (FROZEN) | Meta App/Page config ต้อง re-setup — ไม่ implement |
| External providers อื่น | Requires external provider (FROZEN) | OpenRouter key อยู่ใน secrets runbook |

## Data integrity
orders + order_status_history (transaction-scoped trigger) + payment state (orders.payment_status) + delivery_assignments + customer identities + notifications + automation audit + audit_logs — อยู่ใน single Postgres DB เดียว → **ถ้ามี backup จะครอบคลุมทุกตารางพร้อมกัน (consistency ดี) แต่ปัจจุบัน 0 backups → critical data ทั้งหมด (orders 157 / osh 213 / audit_logs 583 ฯลฯ) ไม่มี recovery path**

## Security
ไม่มี secret ถูก print/commit · secrets.local.env ยัง gitignored · การตรวจทั้งหมด read-only (Management API GET + REST HEAD/count — ไม่ mutate อะไร)

```text
========================================
W3-E-3 BACKUP / DR CLOSURE
========================================
Backup:                  NOT CONFIGURED (VERIFIED — 0 backups)
PITR:                    NOT CONFIGURED (VERIFIED — pitr_enabled=false)
Retention:               NOT APPLICABLE (ไม่มี backup)
Restore capability:      NOT VERIFIED / ไม่มี backup path
Restore verification:    MISSING
RPO:                     NOT DEFINED / OWNER DECISION
RTO:                     NOT DEFINED / OWNER DECISION

Database recovery:       schema RECOVERABLE (49 migrations) · DATA = NO RECOVERY PATH (VERIFIED)
Edge Functions recovery: RECOVERABLE (repo → redeploy — พิสูจน์แล้ว)
Secrets recovery:        PARTIALLY RECOVERABLE — local (gitignored) + provider dashboards → runbook ต้องมี
Repository recovery:     RECOVERABLE (GitHub)
Storage recovery:        NOT VERIFIED (bucket bmb-images — 0 backups ครอบคลุม)
Automation recovery:     RECOVERABLE (worker + scheduler จาก repo — scheduler CLOSED/PASS)
External dependency recovery: Payment/Meta = FROZEN — ต้อง re-setup หลัง DR (บันทึกไว้)
Critical data coverage:  0% สำหรับ data layer (orders/payments-state/identities/audit) — code layer 100% จาก repo
Security:                CLEAN (read-only audit)

Owner decision required (ด่วน — production risk):
1. เปิด automated backup / เลือก tier ที่มี backup ใน Supabase (อาจมีค่าใช้จ่าย)
2. พิจารณาเปิด PITR (ตามความเหมาะสมกับ RPO เป้าหมาย)
3. กำหนด RPO / RTO (ปัจจุบัน NOT DEFINED)
4. อนุมัติ non-production restore test (สร้าง test project — ห้ามสร้างเอง)

Recommended next step:
Owner เปิด backup ทันที → หลังมี backup แล้วค่อยกลับมาปิด restore-verification ใน W3-E-4
========================================
HARD STOP
========================================
```
