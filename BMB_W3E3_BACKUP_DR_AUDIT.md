# BMB_W3E3_BACKUP_DR_AUDIT.md
**W3-E-3 — Backup / DR Verification Audit · วันที่: 2026-09-27 · READ-ONLY AUDIT (ไม่ mutate production) · Scheduler ยังรอ Owner secret (ไม่ถือเป็น blocker ของ audit นี้)**

## สิ่งที่ตรวจได้จาก production/runtime จริง (วันนี้)

| หลักฐาน runtime | ค่าที่วัดได้ |
|---|---|
| live row counts (HEAD count=exact) | orders 157 · order_status_history 213 · order_items 154 · delivery_assignments 8 · customers 4 · customer_channel_identities 60 · profiles 41 · notifications 65 · audit_logs 583 · products 10 · system_errors 0 |
| storage | 1 bucket: `bmb-images` (public, STANDARD, สร้าง 2026-09-15) |
| Supabase project | `ivkdfognyiwjcmrhcnwz` · Northeast Asia (Seoul) · สร้าง 2026-09-15 (CLI `projects list`) |
| Management API backup endpoint | **404 — PAT ไม่มี scope อ่าน backup/org API** → AI DEV ตรวจ backup config ผ่าน API ไม่ได้ |
| repo | 49 migrations (001–049) · 16 Edge Function source folders · 2 workflows · remote = GitHub (`bitemebaby2016-coder/bmb`) |
| secrets | 13 named secrets บน Supabase (`secrets list` — ชื่อเท่านั้น) · ค่าจริงใน `supabase/secrets.local.env` (**gitignored — check-ignore ✓**) |

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
ไม่มี documented/observable value → **RPO = NOT DEFINED, RTO = NOT DEFINED** — OWNER DECISION (ไม่สร้าง policy แทน)

## Restore verification — test plan ที่เสนอ (ห้าม restore production)
Path ปลอดภัย: สร้าง **Supabase project แยก (test)** → restore backup ลงนั้น → verify:
1. schema ตรง 49 migrations 2. row counts ตรง snapshot ด้านบน 3. RLS ทำงาน (ยิง F-18 probe เทียบ)
4. Edge Functions deploy จาก repo แล้วเรียกได้ 5. RPC contract ผ่าน (e2e/contracts_*.sql)
- **Dependency = สร้าง project ใหม่ (อาจมีค่าใช้จ่าย/plan) → STOP ONLY THAT DEPENDENCY → OWNER DECISION REQUIRED**

## Recovery dependencies

| Dependency | สถานะ | หมายเหตุ |
|---|---|---|
| Supabase project access | RECOVERABLE | Owner ถือ account (dashboard + CLI) |
| Database schema | RECOVERABLE | 49 migrations ใน repo — re-run ได้ |
| Database data | OWNER VERIFY | ขึ้นกับ backup config จริง |
| Edge Functions | RECOVERABLE | 16 source folders ใน repo → `functions deploy` (สำเร็จมาแล้ว 3 ครั้งใน session นี้) |
| Secrets | PARTIALLY RECOVERABLE | ค่าจริงอยู่ local (gitignored) + provider dashboards — **ถ้าเครื่องหาย: Owner ต้อง re-enter จาก Stripe/Meta/OpenRouter + regenerate AUTOMATION_TOKEN/CHANNEL_WEBHOOK_* → OWNER ACTION REQUIRED (runbook)** |
| GitHub repo + workflows | RECOVERABLE | clone = recovery พื้นฐาน · workflows ใน repo (scheduler รอ secret เท่านั้น) |
| Storage (bmb-images) | OWNER VERIFY | object บน Supabase storage — ครอบคลุมโดย backup platform เดียวกัน (assumption) |
| Automation | RECOVERABLE | worker + scheduler มาจาก repo ทั้งหมด |
| Payment integration | DEFERRED (frozen) | DR impact: Stripe keys + webhook ต้อง re-setup หลัง DR — บันทึกไว้ |
| Meta integration | DEFERRED (frozen) | DR impact: Meta App/Page config ฝั่ง Meta ต้อง re-setup |
| Web Push | DEFERRED (frozen) | ไม่มีผลกับ DR ปัจจุบัน |

## Data integrity
orders + order_status_history (transaction-scoped trigger) + payment state (orders.payment_status) + delivery_assignments + customer identities + notifications + automation audit + audit_logs — อยู่ใน single Postgres DB เดียว → DB-level backup ครอบคลุมทุกตารางพร้อมกัน (consistency ดี) — **ยังไม่ VERIFIED จนกว่าจะมี restore test**

## Security
ไม่มี secret ถูก print/commit · secrets.local.env ยัง gitignored · การตรวจทั้งหมด read-only (HEAD/count/list)

```text
========================================
W3-E-3 BACKUP / DR AUDIT
========================================
Backup:                  ASSUMED / OWNER VERIFY (dashboard)
PITR:                    NOT VERIFIED
Retention:               NOT VERIFIED
Restore capability:      NOT VERIFIED
Restore verification:    MISSING
RPO:                     NOT DEFINED
RTO:                     NOT DEFINED
Database recovery:       RECOVERABLE (schema) / OWNER VERIFY (data)
Edge Functions recovery: RECOVERABLE (repo → redeploy — พิสูจน์แล้ว)
Secrets recovery:        PARTIALLY RECOVERABLE — local file risk → OWNER ACTION (runbook)
Repository recovery:     RECOVERABLE (GitHub)
Storage recovery:        OWNER VERIFY (bmb-images)
Automation recovery:     RECOVERABLE (repo)
External dependency recovery: Payment/Meta = DEFERRED-frozen — ต้อง re-setup หลัง DR (บันทึกไว้)
Data integrity:          ARCHITECTURE OK (single-DB consistency) — รอ restore test
Security:                CLEAN (read-only audit, no secret exposure)

Owner decision required:
1. ตรวจ Supabase dashboard: Database → Backups (config/retention) + PITR toggle + Storage backup scope
2. กำหนด RPO / RTO
3. อนุมัติ (หรือไม่) สร้าง test project เพื่อ restore verification test

Recommended next step:
Owner ยืนยัน backup config → restore-test บน test project (ตาม plan) → W3-E-4 Operations Final Gate
(Scheduler ปิดแยกทันทีที่ Owner ใส่ AUTOMATION_TOKEN และ runtime test ผ่าน)
========================================
HARD STOP
========================================
```
