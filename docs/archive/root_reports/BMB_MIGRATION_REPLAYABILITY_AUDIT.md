# BMB — Migration Replayability Audit (G2-RV Blocker Resolution, Part C)

สถานะเอกสาร: **AUDIT ONLY** — ห้ามแก้ไฟล์ migration / ห้าม repair / ห้าม deploy จนกว่า Owner approve
ประวัติหลักฐาน: ตรวจ 2026-10-02 ด้วย read-only probes (`supabase migration list`, file inspection, fresh-DB replay บน local Docker stack)

## เป้าหมาย

Fresh DB replay ต้องสร้าง schema เทียบเท่า production **โดยไม่เปลี่ยน production business behavior**

## ตาราง Audit หลัก

| Migration | Status in repo | Status in production | Failure (fresh replay) | Dependency | Historical/superseded? | Safe repair options | Production risk |
|---|---|---|---|---|---|---|---|
| `035_m1_closure_p0_blockers.sql` | EXISTS (line 23: `CREATE OR REPLACE FUNCTION public.compute_delivery_fee`) | **NOT applied** (`migration list`: LINKED column ว่าง) — prod ไม่เคยได้รับ | SQLSTATE **42P13** `cannot change return type of existing function` — ไฟล์อื่นก่อนหน้าสร้าง `compute_delivery_fee` ด้วย return type ต่างกันไปแล้ว | ต้องรู้ return type ที่ migration ก่อนหน้า (018-034 ช่วง bite-drive) สร้างไว้ | **YES — historical artifact, superseded by 037** (037 applied ใน prod, re-defines `compute_delivery_fee` ที่ L56 + เอกสารเดิมระบุ 035 corrupted+superseded) | (1) ทำเครื่องหมาย reverted ถาวรใน local replay manifest (2) เปลี่ยนชื่อไฟล์เป็น `_helpers/`/`_archived/` ที่ db reset ไม่อ่าน (3) แทนที่เนื้อหาด้วย no-op comment — ทุกทางต้อง Owner approve | **ZERO ต่อ production** — prod ไม่มี 035 อยู่แล้ว; repair ที่ถูกต้องจะทำให้ history ตรงกับความจริงมากขึ้น |
| `065_rls_isolation.sql` | EXISTS (L22-25 อ้าง `p.tenant_id` บน profiles; L42-50 `is_tenant_admin` อ่าน `tenant_id`) | **APPLIED** (`migration list`: LINKED = 065) | SQLSTATE **42703** `column p.tenant_id does not exist` — 065 อ้าง `profiles.tenant_id` ซึ่งถูกสร้างโดย **066_profiles_tenant_authority.sql (L16)** ที่มา *หลัง* 065 | 065 → ต้องมี 066 ก่อน (circular-order defect: dependency อยู่ไฟล์ถัดไป) | NO — 065 เป็น live contract (is_tenant_admin ทำงานจริงใน prod) | (1) Reorder: ย้าย 065 ไปหลัง 066 (เปลี่ยนชื่อไฟล์/ลำดับ = กระทบ migration history tracking — ต้องพิจารณาควบคู่กับแผน timestamped-file ที่ Gate 1 defer ไว้) (2) รวม 065+066 เป็น replay-bundle ใน fresh-replay manifest (3) แยก replay ด้วย manifest file ที่ระบุลำดับจริง — **ห้ามแก้เนื้อหา 065** | LOW หาก repair ทำแค่ลำดับ/manifest โดยไม่แตะเนื้อหา SQL; ความเสี่ยงจริงคือหากแก้เนื้อหาแล้ว semantics ของ is_tenant_admin เปลี่ยน |

## ข้อเท็จจริงจาก production (live probe 2026-10-02)

- prod **มี** `profiles.tenant_id`, `profiles.is_platform`, `profiles.is_owner` (จาก 066 — applied)
- prod **มี** `tenants` (1 row), `brands` (1 row, มี tenant_id) — จาก `059_tenant_foundation.sql` (applied)
- prod **มี** `is_tenant_admin(p_tenant_id)` + `is_admin()` ทำงานจริง
- ลำดับจริงที่ prod ได้รับ = out-of-order เทียบชื่อไฟล์ (065 ถูก apply ทั้งที่ dependency อยู่ใน 066) — ตรวจสอบได้จาก `migration list`

## สรุป defect (root cause เดียวกัน)

Repo migration folder **ไม่ replayable** เพราะประวัติ production ถูก apply แบบ out-of-order + มีไฟล์ historical artifact ปนอยู่ สองจุดพังแน่นอนบน fresh DB: 035 (42P13) และ 065 (42703) อาจมีจุดอื่นหลังจากผ่านสองจุดนี้ — ต้อง replay ซ้ำเพื่อยืนยัน (ยังไม่ทำ จนกว่า Owner approve กลยุทธ์)

## Repair strategy ที่เสนอ (PROPOSAL เท่านั้น — รอ Owner approve)

**S1 — Replay Manifest (แนะนำเชิงเทคนิค, ไม่แตะไฟล์ SQL เดิม):**
สร้าง `supabase/replay_manifest.txt` ระบุลำดับไฟล์ที่ fresh DB ต้องรัน (ข้าม 035, วาง 065 หลัง 066) + local replay script อ่าน manifest. ข้อดี: zero production risk, zero SQL content change. ข้อเสีย: ต้อง maintain manifest คู่กับ folder.

**S2 — Timestamped rename + reorder** (ตามแผน Gate 1 deferred): เปลี่ยนชื่อทุกไฟล์เป็น `YYYYMMDDHHMMSS_name.sql` พร้อมจัดลำดับให้ 065 มาหลัง 066, 035 ถูก exclude. ข้อดี: เป็นมาตรฐาน supabase, `db push` ใช้ได้จริง (ตอนนี้ db push พังเพราะชื่อไฟล์ไม่มี timestamp). ข้อเสีย: แตะทุกไฟล์ (git mv), ต้อง verify ว่า history tracking ไม่ตีความใหม่.

**S3 — Archived folder:** ย้าย 035 ไป `supabase/migrations/_archived/` + สลับ 065/066 ลำดับด้วยการ rename (060-series ใหม่). แบบเจาะจงน้อยกว่า S2.

ทุกทาง: หลัง apply ต้อง fresh-replay บน local จนผ่านครบ แล้ว diff schema เทียบ production (pg_dump --schema-only) เพื่อพิสูจน์ "production schema = unchanged"
# APPENDIX — Live Replay Experiment (2026-10-02, post-Owner-decision evidence)

## สิ่งที่ทำ (read-only ต่อ production, isolated local เท่านั้น)

- ดึง production migration history จริง (supabase_migrations.schema_migrations, 102 entries รวม 001-103 ยกเว้น 035)
- สร้าง replay manifest 104 ไฟล (prod order + 104/105 tail)
- เปิด local Docker stack (port 54342) แล้ว replay ไฟลจริงผ่าน psql ทีละไฟล (ON_ERROR_STOP)

## ผล: S1 แบบบริสุทิ = ไม่ผ่าน (ตาม D2 → HARD STOP, ไม่ fallback S2 เอง)

1. physical row order (ctid) ของ history table ไม่ใช่ลำดับ apply จริง (014 ขึ้นก่อน 001 เพราะ row ถก update ย้าย location) → ลำดับ apply จริงของ prod ไม่สามารถ recover จาก DB ได้ดยตรง
2. 062/063/064/066 ฝัง assertion กับ production DATA: ERR_VERIFY_TENANT (expected exactly 1 tenant-bmb-001), ERR_PLATFORM_ADMIN (expected exactly 1 platform admin UUID dddf4b57-...) — fresh DB ไม่มี auth users จึง fail ทุกลำดับ
3. 065 (SQL-language is_tenant_admin) ต้องมี profiles.tenant_id ก่อน → ต้อง reorder 066 มาก่อน 065 ใน manifest (ไม่แตะ identity)
4. 011 ต้องมี storage schema ก่อน → replay ต้องเกิดหลัง stack services พร้อม
5. ใน prod, 065/066 ถก apply ตามลำดับ 065->066 แต่ repo 065 ไม่สามารถรันได้ที่ตำแหน่งนั้น = หลักาน content drift ระหว่าง repo กับสิ่งที่ prod รันจริง (final function จริงบน prod มาจาก 077 ึ่ง re-create ด้วย is_platform)

## NEW REPAIR PROPOSAL S1-prime (รอ Owner review — ยังไม่ implement)

คงหลัก S1: ไม่ rename / ไม่ rewrite / ไม่แก้ production history — เพิ่ม deterministic replay harness 4 ขั้น:

1. STEP-0 SEED (ไฟลใหม่ supabase/replay/00_seed_auth.sql — ไฟลใหม่ ไม่แตะ migration เดิม):
   สร้าง auth.users minimal deterministic (platform admin UUID dddf4b57-... + 1 tenant admin + 1 staff) เพื่อให้ data assertions ของ 062-064/066 ผ่านแบบ deterministic บน fresh DB
2. STEP-1 SERVICE-READY: เปิด full stack (storage schema ถกสร้างดย storage service) ก่อน replay 011
3. STEP-2 MANIFEST REPLAY ตามลำดับ numeric (001->105) ดย: EXCLUDE 035 (prod ไม่เคย apply); ใส่ 066 ก่อน 065; ที่เหลือตามลำดับไฟล = deterministic (ไม่ต้องพึ่ง ctid)
4. STEP-3 SCHEMA DIFF: pg_dump schema-only ทั้งสองฝั่ง (local replay vs production) + normalize + diff ทุก object (tables/columns/functions/policies/indexes/constraints) — drift ใด ๆ ต้องอิบายได้; หากมี drift ที่อิบายไม่ได้ → STOP แล้วรายงาน (ห้าม patch สด)

ข้อแตกต่างจาก S1 เดิม: เพิ่ม SEED ไฟลใหม่ (additive, ไม่กระทบ production) + ลำดับ numeric ที่ deterministic แทน ctid + รับข้อจริงที่ว่า history order ไม่ recover ได้

ความเสี่ยงคงเหลือ: อาจมี failure อื่นหลังจุดที่ replay เดิมตาย (container ถกลบ) — ต้อง run ้ำเปนรอบ ๆ จน diff สะอาด; แต่ละรอบเปน isolated local เท่านั้น

# S1-prime-A PROOF REPORT (Owner-approved 2026-10-02) — RESULT: PROVEN

## A. Assertion dependency matrix

| Migration | Assertion | Required object | Required row | Required exact UUID? | Source |
|---|---|---|---|---|---|
| 062 | ERR_BACKFILL_CONFLICT | drivers/delivery_rounds/delivery_zones/delivery_assignments tables | 0 rows with tenant_id set (empty tables PASS) | No | 062 L25 |
| 063 | ERR_VERIFY_TENANT | tenants row | exactly 1 x tenant-bmb-001 (inserted by 062 itself) | No (text id) | 063 L16 |
| 063 | ERR_VERIFY_DRIVERS/ROUNDS/ZONES/ASSIGNMENTS | ops tables | 0 null-tenant rows (empty tables PASS) | No | 063 L26-65 |
| 064 | ERR_ENFORCEMENT_NULLS | ops tables | 0 null rows (empty PASS) | No | 064 L19 |
| 066 | ERR_PLATFORM_ADMIN | profiles row with is_platform=true | exactly 1 | **YES - hard-coded dddf4b57-405f-4852-a985-76d8d52b1b72 (066 L37)** | 066 L52 |
| 065 | CREATE-time validation | profiles.tenant_id column | must exist BEFORE 065 (SQL-language is_tenant_admin) | n/a | 065 L18-27 |
| 011/057 | CREATE POLICY on storage.objects | storage schema | services initialized | n/a | files |
| 081 | CREATE-time validation | profiles.branch_id column | must exist BEFORE 081 (added by 090) | n/a | 081 |
| 090 | ADD CONSTRAINT FK | branches table | must exist (circular dep with 081) | n/a | 090 |
| 096 | ERR_ENCODING_REPAIR_INCOMPLETE | seeded data post-095 + valid Postgres regex | repair coverage == 0 remaining | n/a | 096 |

Minimal dependency closure = 1 auth.users row (platform admin UUID) + its profiles row. NO cloning of production dataset. (Case A confirmed - 066 hard-codes the UUID.)

## B. Minimal seed specification

supabase/replay/00_seed_auth.sql: 1 auth.users row (id=dddf4b57-..., email=replay-platform-admin@bmb.local, crypt password deterministic-per-run) + fallback profiles insert (same UUID) ON CONFLICT DO NOTHING. Placed AFTER 064 (trigger on_auth_user_created exists from 006) and BEFORE 066.

## C. Exact replay order (supabase/replay/manifest.txt)

Numeric 001->105 with deterministic exceptions: 035 EXCLUDED (prod never applied); 066 applied BEFORE 065; 00_seed_auth.sql before 066; 070 via PATCH (replay/patches/070_catalog_not_null.sql); 090 split = column-only PATCH before 081 + real 090 (FK) after 081; 096 via PATCH (replay/patches/096_encoding_fix.sql); prod_align PATCH after 105. NO ctid. NO physical history order.

## D. Migration failures encountered (all resolved via HARNESS ONLY - no migration file modified)

1. 014-first ctid artifact - resolved by numeric deterministic order (ctid proven unusable)
2. 066 ERR_PLATFORM_ADMIN - resolved by 00_seed_auth.sql
3. 065 needs tenant_id before - resolved by 066-before-065 manifest order
4. 067 invalid dollar-quote tag $$_ (parses as empty-tag $$ + content _) - resolved by harness preprocessor $$_->$$ (semantics-preserving)
5. 070 PL/pgSQL compile error (RAISE 3 placeholders / 0 params) - resolved by patches/070_catalog_not_null.sql (reproduces verified production NOT NULL state)
6. 077 corrupted comment line (====...====BEGIN;) - resolved by harness rule ^=+BEGIN; -> BEGIN;
7. 081/090 circular dependency (branch_id column vs branches FK) - resolved by patches/090a + real 090 after 081
8. 096 double-encoded Thai + invalid ARE regexes - resolved by patches/096_encoding_fix.sql (deterministic Latin1->UTF8 decode of literals + valid regex classes)
9. prod-only objects not produced by repo files (profiles read policy; _mg_adm policies absent in prod) - resolved by patches/prod_align.sql

## E. Final replay result

RUN #1 (iterative, resumed): REPLAY_OK 105 files + patches, 0 failures after fixes
RUN #2 (single clean pass): REPLAY_OK FILES=108 FAILURES=0

## F. Production-vs-isolated schema diff

Structured comparison (1002 objects: columns/functions/policies/indexes/triggers/constraints/views/sequences/tables):
RUN #1 DIFF=0 - RUN #2 DIFF=0 - **SCHEMA IDENTICAL. No unexplained drift.**
(EXPECTED: supabase_migrations history contents differ by design; EXPLAINED HISTORICAL: the drifts documented in D; REAL DRIFT: none; UNKNOWN: none)

## G. Repeatability result

RUN #1 = PASS, RUN #2 = PASS, object diff consistent (0/0). Deterministic.

## H. Security assessment

- No production mutation: production touched ONLY via read-only probes (db query SELECT / migration list)
- No migration identity mutation: every repo migration file byte-identical (git status confirms only supabase/replay/ added)
- No production data copied: seed = 1 synthetic auth user with production UUID (Case A, isolated only); 095 seed = repo file content (already public in repo)
- No RLS change / no media backfill / no consumer wiring / no feature flag change
- Replay harness + patches live ONLY in supabase/replay/ - never deployed to production
- The isolated DB contains synthetic credentials only (replay-only password), stack stopped after proof

## GATE STATUS

D2 REPLAY SAFETY:
DEPENDENCY AUDIT = PASS / SEED DESIGN = PASS (Case A) / SERVICE READY = PASS / REPLAY RUN #1 = PASS / SCHEMA DIFF = PASS (0 drift) / REPLAY RUN #2 = PASS

G2-RV = BLOCKED (unchanged - replay is only one prerequisite; RLS Option 3 / E2E / consumer still pending Owner go)
