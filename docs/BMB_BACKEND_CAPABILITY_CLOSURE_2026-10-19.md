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
| GCS daily backup | `scripts/gcsBackup.mjs`, `.github/workflows/daily-backup.yml` | pg_dump→gzip→GCS JSON API→sha256 verify→retention 30/12 · 07:30 น. เวลาไทย |
| SQL verification harness | `e2e/ci/apply_all_migrations.sh`, `e2e/contracts_127_130.sql` | replay 001-130 บน PG17 ephemeral (preprocess+shims จาก CI verbatim) |
| Routing/UI wiring | `bmbAdminApi_orders.ts`, `CheckoutPage.tsx`, `PaymentConfirmationPage.tsx`, `App.tsx`, `adminUi.ts` | pickup toggle ที่ checkout, แสดงรหัสรับอาหาร, routes /admin/pos /admin/reports /admin/print-settings |
| Tests | `src/__tests__/{printTemplates,pickupRouting,gcsBackupHelpers}.test.ts` | 19 tests ใหม่ (pure + mocked RPC routing) |

## 2. Evidence

- `ALL MIGRATIONS APPLIED CLEANLY (001-130)` บน PostgreSQL 17 (docker, DB เริ่มต้นใหม่)
- Functional smoke บน DB เดียวกัน: pickup fee=0 · transition matrix ไม่ถูกเปิดกว้างเกินจำเป็น · pickup code 6 หลัก · guards fail-closed (ERR_FORBIDDEN/ERR_INVALID_PAYMENT_METHOD) · role CHECK รับ `staff` ปฏิเสธ `cashier`
- `e2e/contracts_127_130.sql` ผ่าน (ROLLBACK) + step ใน `contract-tests.yml`
- vitest ทั้ง suite ผ่าน · `tsc --noEmit` = 0 · `eslint` = 0 · `vite build` = 0

## 3. สิ่งที่ Owner ต้องทำก่อนเริ่มทดสอบจริง

1. **GitHub Secrets:** `GCS_SERVICE_ACCOUNT_JSON` (service account ที่มีสิทธิ์ Object Admin บน bucket `bmb-db-backups-prod`) และ `BMB_DATABASE_URL` (Supabase pooler connection string สำหรับ pg_dump) · เลือกตั้ง `LINE_NOTIFY_TOKEN` สำหรับแจ้งเตือน backup ล้มเหลว
2. **Apply migrations 127–130 ขึ้น production** (supabase db push / SQL editor เรียงลำดับ) — หรืออนุมัติให้ดำเนินการ
3. **Google:** เปิด Cloud Storage JSON API (เปิดแล้ว) + สร้าง service account + เพิ่มเป็นสมาชิก bucket (บัญชีเจ้าของ bucket = `bitemebaby2016@gmail.com`)
4. **ทดสอบจริง:** PWA pickup (เลือกช่วงเวลา → รหัส 6 หลัก → รับที่ร้าน) · POS ขายเงินสด + ปิดกะ · พิมพ์ใบเสร็จ/คิวครัว + ยืนยันสถานะพิมพ์ · ปิดยอดรายวัน + export CSV · trigger `daily-backup` ด้วยมือ 1 ครั้ง + ตรวจไฟล์ใน bucket + `--verify`

## 4. ขอบเขตที่ยังไม่ทำ (DEFERRED — แจ้งตรงไปตรงมา)

- POS รับออเดอร์ **delivery** (ต้องมี geocoding/แผนที่ฝั่งพนักงาน — วันนี้ POS = ขายหน้าร้าน/รับที่ร้าน; ลูกค้าสั่ง delivery ผ่าน PWA ได้ตามเดิม)
- ESC/POS raw transport ข้าม browser (ใช้ browser print ซึ่งรองรับเครื่องพิมพ์ทุกตัวที่ OS เห็นก่อน)
- Backup **Storage objects** (รูปสินค้า) — ต่อจาก DB backup (workflow ขยายได้ทันที)
- กำไร/ต้นทุนต่อจาน (ต้องมีข้อมูลต้นทุนที่ครบก่อน — ห้ามประมาณจากข้อมูลที่ไม่มีจริง)
- Restore test อัตโนมัติรายเดือน (ทำด้วยมือได้ทันทีจาก `gcsBackup.mjs --verify` + download + pg_restore)

## 5. วินัยข้อมูลที่ยึดตลอดงาน

- order total ≠ เงินสดที่ได้รับ: รายงานแยก paid/unpaid/refunded เสมอ
- สถานะพิมพ์ 4 ระดับ ไม่อ้าง "พิมพ์สำเร็จ" โดยไม่มีหลักฐาน
- Idempotency ทุกช่องทางสั่งซื้อ (124) + print job id (deterministic) + close_day (PK upsert)
- Secrets ไม่อยู่ใน git (`.env*` ignored; backup ใช้ GitHub secrets เท่านั้น)