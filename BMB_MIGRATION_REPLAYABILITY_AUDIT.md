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