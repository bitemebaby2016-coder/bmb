# BMB Backend Capability Closure — Implementation Report (2026-10-19)

Task: `BACKEND-CAPABILITY-CLOSURE-2026-10-19` · Scope: ปิดช่องว่างระบบหลังบ้านให้เหลือเพียงการทดสอบจริงของ Owner
(ไม่แตะ SelfPrint — คนละโปรเจค · ไม่สร้าง order/payment engine ใหม่ · customer journey เดิมไม่ถูกแตะนอกเหนือ pickup option)

## 1. สิ่งที่ส่งมอบ

| ชิ้น | ไฟล์ | หมายเหตุ |
|---|---|---|
| Pickup fulfillment | `supabase/migrations/127_pickup_fulfillment.sql` | enum `pickup`, pickup_code 6 หลัก (trigger), picked_up_at/handed_by, fee=0, `create_pickup_order_i` (idempotent ผ่าน 124), transition `ready_for_dispatch→delivered` |
| Print jobs | `128_print_jobs.sql`, `src/lib/printService.ts`, `AdminPrintSettings.tsx` | states requested→sent→acknowledged→printed\|failed · auto-enqueue ใบเสร็จ/คิวครัว · browser-print fallback |
| Web POS + staff + shift | `129_pos_staff_shift.sql`, `src/lib/posApi.ts`, `AdminPos.tsx` | role `staff`, `is_staff()`, staff SELECT RLS, `open_shift/close_shift`, `pos_closeout_order` |
| Finance/daily closing | `130_finance_reports.sql`, `AdminReports.tsx` | `get_daily_sales`, `daily_closings`, `close_day` (idempotent), CSV export (BOM) |
| Daily backup (Supabase Storage) | `scripts/dbBackup.mjs`, `.github/workflows/daily-backup.yml` | **refactor จาก GCS (GCP Org Policy บล็อก SA key)** → pg_dump→gzip→**bucket `db-backups` (Private)**→size+sha256 ก่อน/หลัง upload→retention 30/12 · 07:30 น. เวลาไทย · `--verify` ตรวจ manifest+.sql.gz+private |
| SQL verification harness | `e2e/ci/apply_all_migrations.sh`, `e2e/contracts_127_130.sql` | replay 001-130 บน PG17 ephemeral (preprocess+shims จาก CI verbatim) |
| Routing/UI wiring | `bmbAdminApi_orders.ts`, `CheckoutPage.tsx`, `PaymentConfirmationPage.tsx`, `App.tsx`, `adminUi.ts` | pickup toggle ที่ checkout, แสดงรหัสรับอาหาร, routes /admin/pos /admin/reports /admin/print-settings |
| Tests | `src/__tests__/{printTemplates,pickupRouting,dbBackupHelpers}.test.ts` | 21 tests ใหม่ (pure + mocked RPC routing) |

## 2. Evidence

- `ALL MIGRATIONS APPLIED CLEANLY (001-130)` บน PostgreSQL 17 (docker, DB เริ่มต้นใหม่)
- Functional smoke บน DB เดียวกัน: pickup fee=0 · transition matrix ไม่ถูกเปิดกว้างเกินจำเป็น · pickup code 6 หลัก · guards fail-closed (ERR_FORBIDDEN/ERR_INVALID_PAYMENT_METHOD) · role CHECK รับ `staff` ปฏิเสธ `cashier`
- `e2e/contracts_127_130.sql` ผ่าน (ROLLBACK) + step ใน `contract-tests.yml`
- vitest ทั้ง suite ผ่าน · `tsc --noEmit` = 0 · `eslint` = 0 · `vite build` = 0
- **Production (2026-10-19):** apply **migrations 126–130** ขึ้น production สำเร็จ (126 ค้างอยู่ด้วย — track เดิมถึง 125) + บันทึก `schema_migrations` ครบ · verify บน production: tables `print_jobs/shifts/daily_closings` · functions 9 ตัว · enum `pickup` · คอลัมน์ pickup · role CHECK รับ `staff` · RLS 4 policies · functional smoke (fee=0, handover matrix, fail-closed) ผ่าน
- **Bucket `db-backups`:** Private + file_size_limit 50MB (ตั้งผ่าน Storage API) · pipeline test จริง (stub dump → upload → re-download sha256 → `--verify` ผ่าน → ลบไฟล์ทดสอบจน bucket สะอาด)

## 3. สิ่งที่ Owner ต้องทำ (สถาปัตยกรรมใหม่ — ไม่มี GCP แล้ว)

1. **GitHub Secrets 2 ตัว (ต้องมี):** `SUPABASE_SERVICE_ROLE_KEY` (ค่า `sb_secret_…` จาก Supabase Dashboard → Settings → API) และ `BMB_DATABASE_URL` (connection string ของ pooler สำหรับ pg_dump) · เลือกตั้ง `LINE_NOTIFY_TOKEN` สำหรับแจ้งเตือน backup ล้มเหลว
2. **ลบ secret เดิม `GCS_SERVICE_ACCOUNT_JSON`** ทิ้งได้เลย (เลิกใช้แล้ว) — workflow ใหม่ไม่อ้างถึง GCP เลย
3. ~~Apply migrations~~ → **ทำแล้ว 2026-10-19** (126–130 ขึ้น production + verify ครบ)
4. **ทดสอบจริงตาม Checklist:** `docs/BMB_OWNER_PRODUCTION_TEST_CHECKLIST_2026-10-19.md` (PWA pickup · POS เงินสด+ปิดกะ · พิมพ์ใบเสร็จ/คิวครัว · ปิดยอดรายวัน+CSV · ฟีเจอร์อื่นครบ · trigger `daily-backup` ด้วยมือ 1 ครั้ง + ตรวจไฟล์ใน bucket + `--verify`)

## 4. ขอบเขตที่ยังไม่ทำ (DEFERRED — แจ้งตรงไปตรงมา)

- POS รับออเดอร์ **delivery** (ต้องมี geocoding/แผนที่ฝั่งพนักงาน — วันนี้ POS = ขายหน้าร้าน/รับที่ร้าน; ลูกค้าสั่ง delivery ผ่าน PWA ได้ตามเดิม)
- ESC/POS raw transport ข้าม browser (ใช้ browser print ซึ่งรองรับเครื่องพิมพ์ทุกตัวที่ OS เห็นก่อน)
- Backup **Storage objects** (รูปสินค้า) — ต่อจาก DB backup (workflow ขยายได้ทันที)
- กำไร/ต้นทุนต่อจาน (ต้องมีข้อมูลต้นทุนที่ครบก่อน — ห้ามประมาณจากข้อมูลที่ไม่มีจริง)
- Restore test อัตโนมัติรายเดือน (ทำด้วยมือได้ทันทีจาก `scripts/dbBackup.mjs --verify` + download + pg_restore)

## 5. วินัยข้อมูลที่ยึดตลอดงาน

- order total ≠ เงินสดที่ได้รับ: รายงานแยก paid/unpaid/refunded เสมอ
- สถานะพิมพ์ 4 ระดับ ไม่อ้าง "พิมพ์สำเร็จ" โดยไม่มีหลักฐาน
- Idempotency ทุกช่องทางสั่งซื้อ (124) + print job id (deterministic) + close_day (PK upsert)
- Secrets ไม่อยู่ใน git (`.env*` ignored; backup ใช้ GitHub secrets เท่านั้น)