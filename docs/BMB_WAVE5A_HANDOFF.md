# BMB — WAVE 5A HANDOFF (อ่านก่อนทำงานต่อ)
> สร้าง 2026-10-13 โดย Cline session ก่อนหน้า · repo: `D:\A PROJECT\Bite Me Baby` · branch `main`

## สถานะ ณ สร้างแฮนออฟ
- HEAD == origin/main == `362842a` (docs) ก่อนหน้านี้ = `cd20917`/`460e647` (e2e fixes) — tracked 0 · untracked **13 ไฟล์** · stash `local-edits-before-sync-2026-09-21` — **ห้ามแตะทั้งหมด**
- Local gates ล่าสุดที่วัด: **934/934 tests · tsc 0 · eslint 0 · build 0 · brand OK 349** (ไม่มีการแตะ src/ ใน wave นี้เลย — แก้แค่ `.github/workflows/contract-tests.yml`, `e2e/*`, `supabase/migrations/124_*.sql`, docs)
- CI หลัก: #426/#430 = success ยืนยันแล้ว · commit หลัง ๆ ยังไม่ได้逐一ยืนยัน — **ก่อนรายงานรอบสุดท้าย ให้เช็ค CI ของ SHA สุดท้ายด้วย**

## สิ่งที่ Wave 5A สร้างไว้
1. **`.github/workflows/contract-tests.yml`** — workflow แยกจาก ci.yml: postgres:16 service (ephemeral, ไม่มี production creds) → prelude stubs (`e2e/ci/00_prelude_supabase_stubs.sql`: roles anon/authenticated/service_role, auth schema+uid/jwt/role/email, auth.users (+phone), storage.objects/buckets) → apply migrations 001-123 แบบ **inventory mode** (collect ทุก failure แล้ว exit ท้าย) → contract 123 → apply 124 → contract 124 → cleanup check → `e2e/ci/concurrency_124.sh`
2. **ทุก step emit `::error` annotations** — อ่านผลได้เองผ่าน API (ด้านล่าง) **ไม่ต้องรอ log จาก Owner**
3. **preprocessor บน TEMP COPY เท่านั้น (ห้ามแก้ไฟล์ history):** sed แก้ `}`→`$$` (035, 4 บรรทัด), `$$_`→`$$` (067), `====BEGIN;`→`BEGIN;` (077), RAISE args (070), `cnt, 0 rdy` ย้ายหน้า FROM (035) + awk inject `DROP POLICY IF EXISTS` ก่อนทุก CREATE POLICY (207 จุด — token indexes: a[1]=CREATE a[2]=POLICY a[3]=name a[4]=ON a[5]=table)
4. **CI-only SQL shims ใน loop** (มี comment อธิบายในไฟล์): 035 drop `compute_delivery_fee(numeric,numeric,text,integer,numeric)` + เพิ่ม `orders.delivery_address` (**fresh-DB gap จริง** — production มีจาก drift) · 037 drop fee (jsonb→numeric repair) · 065 pre-add `profiles.tenant_id,is_platform` (065 อ้างก่อน 066) · 066 seed profile `dddf4b57-405f-4852-a985-76d8d52b1b72` · 081 pre-add `profiles.branch_id` (อ้างก่อน 090) · 107 seed media_assets 9 แถว (data precondition)
5. **`supabase/migrations/124_order_submit_idempotency.sql`** — wrapper `create_order_with_items_i` **19 params** (18 ของ 118 + `p_client_submit_key`), owner=`COALESCE(auth.uid(),p_customer_ref)::text` (ตรง 118:49), fingerprint=md5(args 18 ตัว), advisory xact lock ต่อ key, replay คืน result เดิม, `order_submissions` = RLS enabled ไม่มี policy + REVOKE ALL, grants ตรง 025 — **ห้าม apply ใน Production**
6. **`e2e/contracts_124_idempotency.sql`** — matrix T1-T13 (pg_temp SECURITY DEFINER count-helpers, T7 role juggling `set_config('role','none'/'authenticated')` สำหรับ product toggle, T11b ตรวจ 18 args, T13 direct access denied)

## ผลลัพธ์ CI (contract workflow 15 runs)
- ✅ **Migrations 001-123 = GREEN ครั้งแรก** (run #10+)
- ✅ **Contract 123 = EXECUTED & PASSED** (แก้: raw DML รัน as superuser — chain ไม่ grant menu_schedule ให้ authenticated; admin gating ยังผ่าน claims)
- ✅ **Apply migration 124 = สำเร็จ** บน isolated DB
- ⏳ **Contract 124 = ยัง fail** — แก้แล้ว: 19-positional args (key เคยตกเป็น branch_id → `ERR_BRANCH_NOT_FOUND: CK-T1`) และ dropoff coords `13.7563,100.5018` (118 CR-2 → `ERR_MISSING_DELIVERY_COORDS`)
- **ERROR ล่าสุด (run #16, head 362842a, job 115372540656)**: `SELF_DELIVERY_EXCEEDS_5KM_LIMIT: 383.63 km > configured radius 5.00 km` ที่ `contracts_124:186` — **coords ทดสอบอยู่ไกล kitchen ใน DB เกิน 5 กม.** → ขั้นถัดไป: ดู `SELECT public.kitchen_location()` บน isolated DB (หรือ seed ใน workflow) แล้วใช้ coords ใกล้ kitchen ประมาณ <2 กม. แทน 13.7563,100.5018 ทั้งใน contract124 และ `concurrency_124.sh` (ถ้า script ใช้ coords เดียวกัน)

## FIRST ACTIONS สำหรับแชทหน้า
1. Poll รอบล่าสุด: `https://api.github.com/repos/bitemebaby2016-coder/bmb/actions/workflows/contract-tests.yml/runs?per_page=1` (anonymous ได้)
2. เอา `run id` → `.../actions/runs/{id}/jobs` → job id + `check_run_url` + step conclusions
3. ถ้า Contract 124 ยัง fail → `.../check-runs/{jobId}/annotations` → อ่าน `ERROR:` → แก้ใน `e2e/contracts_124_idempotency.sql` (fixture/args/claims) → commit/push → วน — **ข้อผิดพลาดที่ผ่านมาเป็น class เดียวกัน: contract ไม่ตรงกับ behavior จริงของ 118/124 ให้แก้ contract ไม่ต้องแก้ 118/124 เว้นแต่พิสูจน์ defect จริง**
4. เมื่อ contract 124 ผ่าน → **cleanup step** (`order_submissions=0` + orders phones 0) และ **concurrency script** (2 sessions, key `CK-CONC-1` → orders=1, submissions=1, สอง output เลขเดียวกัน) ต้องเขียว → job ทั้งอัน = GREEN
5. ปิดงาน: เพิ่ม EV-029 ใน `docs/BMB_SAME_DAY_PRE_ORDER_EVIDENCE_LOG.md` + แถว Checkpoint W5A · รัน local gates (`npm test`, `npx tsc --noEmit`, `npx eslint .`, `npm run build`, `node scripts/brandNameGuard.cjs`) · เช็ค CI ของ SHA สุดท้าย · รายงาน tier: SOURCE/AUTOMATED/ISOLATED-DB/PROD-RUNTIME

## กติกาเหล็ก (ห้ามละเมิด)
- stage **exact paths** เท่านั้น · ไม่ `git add -A` · ไม่ force push/reset · ห้าม apply 124 ใน Production · ห้ามแก้ไฟล์ migration 001-123 (history) · ห้ามสร้าง production order/publish schedule · ห้ามอ้าง CI ผ่านขณะยังรัน
- PowerShell กิน `$$` และ quote ใน inline command → **เขียนสคริปต์เป็นไฟล์ `.cjs`/`.sh` ผ่าน editor แล้วเรียก** · package = `"type":"module"` → temp script ต้อง `.cjs` · มี Git bash ที่ `C:\Program Files\Git\bin\bash.exe` (ใช้ `bash -n`, awk, sed validate ได้)
- untracked 13 ไฟล์ + stash = ห้ามลบ/แตะ

## Owner-only ที่ยังค้าง (ห้ามทำเอง)
- Approve **migration 124 → Production** (รอ contract124 ผ่านก่อน)
- Approve **fix migration สำหรับ `orders.delivery_address` gap** (fresh-DB ขาดจริง)
- Publish schedule 14 แถว · test order/payment จริง · kitchen/delivery runtime · RC-5 deploy metadata access · evening round (deferred)

## Evidence tiers ปัจจุบัน
SOURCE ✅ · AUTOMATED ✅ (934/934) · **ISOLATED-DB: migrations 001-123 ✅ + contract 123 ✅ + apply 124 ✅ · contract124 ⏳** · PRODUCTION-RUNTIME ❌ — **ยังห้ามประกาศพร้อมเปิดร้าน**
