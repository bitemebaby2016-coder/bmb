# Bite Me Baby — AI Work State (ระบบบันทึกสถานะสำหรับแชทถัดไป)

> **สถานะงานปัจจุบันของโปรเจกต์ Bite Me Baby** ใช้แนบเข้าสู่ Context ตอนเริ่มแชทเสมอ

**last_updated:** 2026-10-19 (รอบ BACKEND-CAPABILITY-CLOSURE)
**phase:** ปิด Capability Gaps ทั้งระบบ (Pickup/Print/POS/Finance/GCS Backup) — เหลือ Owner ทดสอบจริงบน production
**current_focus:** migrations 127-130 + Web POS + print_jobs + รายงานรายวัน + daily-backup→GCS — ผ่าน lint/tests/build/SQL contract แล้ว
**blocked_by:** (1) Owner ตั้ง GitHub secrets GCS_SERVICE_ACCOUNT_JSON + BMB_DATABASE_URL (2) apply migrations 127-130 ขึ้น production (3) สร้าง service account + share bucket bmb-db-backups-prod

---

## ⚡ TASK: BACKEND-CAPABILITY-CLOSURE-2026-10-19 — ปิดช่องว่างระบบหลังบ้านให้เหลือแค่ทดสอบจริง (คำสั่ง Owner 19 ต.ค.)
- **STATUS: ✅ CLOSED (commit+push)**
- **ขอบเขตที่ทำ (ไม่แตะ SelfPrint — คนละโปรเจค, ไม่สร้าง order/payment engine ใหม่):**
  - **Customer Pickup (127):** `delivery_method='pickup'` + `pickup_code` 6 หลัก (auto trigger) + `picked_up_at/handed_by` + ค่าจัดส่ง 0 (นโยบาย Owner) + `create_pickup_order_i` (idempotent ผ่าน 124) + transition `ready_for_dispatch→delivered` สำหรับส่งมอบหน้าร้าน
  - **Print (128):** `print_jobs` (requested→sent→acknowledged→printed|failed) + auto-enqueue ใบเสร็จ/คิวครัว + `printService.ts` (template 80mm ไทย) + `AdminPrintSettings` + browser-print fallback — **ไม่อ้างพิมพ์สำเร็จจนกว่า operator ยืนยัน**
  - **Web POS + Staff + Shift (129):** role `staff` (CHECK ขยาย) + `is_staff()` + staff SELECT policies + `transition_order_status`/`confirm_offline_payment` ให้ staff + `shifts` + `open_shift/close_shift` (กระทบยอดเงินสดจาก paid orders เท่านั้น) + `pos_closeout_order` (เดิน transition ถูกกฎหมาย + ยืนยันชำระ) + `AdminPos.tsx`
  - **Finance (130):** `get_daily_sales` (gross/net/paid/unpaid/refunded × payment method, แยก pickup) + `daily_closings` + `close_day` (idempotent) + `AdminReports.tsx` + CSV export (BOM) — **ไม่คำนวณกำไร (ต้นทุนยังไม่ครบ)**
  - **GCS Daily Backup:** `scripts/gcsBackup.mjs` (pg_dump→gzip→GCS JSON API→re-download sha256 verify→retention 30 daily/12 monthly) + `.github/workflows/daily-backup.yml` (07:30 น. เวลาไทย + alert) — bucket `bmb-db-backups-prod`
- **EVIDENCE:**
  - **SQL: `ALL MIGRATIONS APPLIED CLEANLY (001-130)` บน PostgreSQL 17 (docker ephemeral)** ด้วย `e2e/ci/apply_all_migrations.sh` (preprocess+shims port จาก contract-tests.yml verbatim) — แก้ typo sed `COUNT\(\*\)` ที่ port ผิดจน replay ได้ครบ
  - **Functional smoke (DB จริง):** pickup fee=0 ✓ · handover transition: admin ผ่าน/ลูกค้าถูกบล็อก/pending→delivered ยังบล็อก ✓ · pickup code 6 หลัก ✓ · is_staff fail-closed ✓ · role CHECK รับ staff ปฏิเสธ cashier ✓ · print_jobs/shifts/daily_closings มีจริง ✓ · create_pickup_order_i ปฏิเสธ payment ผิด ✓ · mark_print_job ต้อง auth ✓
  - **SQL contract:** `e2e/contracts_127_130.sql` (ROLLBACK) ผ่านบน PG17 + เพิ่ม step ใน `contract-tests.yml`
  - **vitest:** printTemplates 7 · pickupRouting 6 · gcsBackupHelpers 6 = 19 tests ใหม่ผ่าน + ชุดเดิมทั้งหมด (ดูรอบ commit)
  - **lint** = 0 (393 ไฟล์) · **tsc** = 0 · **build** = 0
- **งานที่เหลือ = Owner เท่านั้น:** ตั้ง secrets 2 ตัวใน GitHub · apply migration 127-130 ขึ้น production · สร้าง service account ให้สิทธิ์ Object Admin บน bucket · ทดสอบจริง (ลูกค้า/ไรเดอร์/POS/พิมพ์/ปิดยอด/backup)
- **DEFERRED (แจ้งไว้ชัด):** POS รับออเดอร์ delivery (ต้องมี geocoding/แผนที่ฝั่งพนักงาน — ปัจจุบัน POS = ขายหน้าร้าน/รับที่ร้าน), ESC/POS raw transport (ใช้ browser print ก่อน), storage-objects backup (ต่อจาก DB backup), profit reporting (รอต้นทุนครบ)

---

## ⚡ TASK: REAL-TEST-FIX-2026-10-19 — แก้ตามผลทดสอบจริง + audit ตามจริง (คำสั่ง Owner 19 ต.ค.)
- **STATUS: ✅ CLOSED (รอ push)**
- **คำถาม audit ("งานที่สั่งไปแล้ว ค้างอยู่ในสเตจ/คอมมิทไหนรึเปล่า?") — ตอบตามจริง:**
  - **ไม่มีงานค้างใน staging/stash** (worktree สะอาด ทุกอย่างอยู่ใน commit แล้ว)
  - สิ่งที่เคยสั่งและ**ปิดแล้ว**: Master Plan same-day/pre-order phases 0-6 (commit `4cb22eb`,`3dd44ce`,`f20a6be`,`8bd6276`,`f7bfab1` + EV logs) · promo engine (`4c0bc9f`) · mode consistency (`f20a6be`) · distance 0.00 fix (`33724ce`)
  - สิ่งที่เจอวันนี้ = **ช่องว่าง/บั๊กที่ phase เหล่านั้นไม่ครอบคลุม** (ไม่ใช่ของค้าง): ค่า fallback พิกัดครัวผิดคนละจุด · คูปองไม่ trigger recalc · หน้าจ่ายเงินไม่แสดงการคำนวณ · หน้า checkout ให้เลือกรอบเองทั้งที่ same-day ควรทันทีอัตโนมัติ · พรีออเดอร์เกินวันไม่มีแสตมป์ · ฟอร์มไรเดอร์ต้องพิมพ์เอง
- **สิ่งที่แก้รอบนี้ (ทั้งหมดอยู่ใน commit เดียว):**
  1. **พิกัดครัว single source** — `src/config/kitchenLocation.ts` (ค่า fallback = ครัวจริง 12.615659, 102.098063) — root cause "ปักที่ครัวแต่ห่าง 200+ กม." = fallback เก่า (10.7016, 102.1429) ถูกใช้ใน 7 จุด (locationStore/deliveryFeeApi/externalProviders/routeOptimization/seo/ContactPage/RouteOptimizationPage) → ระยะทาง/ค่าส่ง/ช่องทางมั่วทั้งหมดเพราะต้นทางเดียว
  2. **คูปองเห็นผลทันที** — `cartStore` setCouponCode/setAppliedPromotion เรียก recalculate (เดิม discount ค้าง 0 จนมี event อื่น = "โปรโมชั่นใช้ไม่ได้/ไม่คำนวณให้เห็น")
  3. **หน้าชำระเงินแสดงการคำนวณ** — สินค้า/ส่วนลด/ค่าจัดส่ง/รวม (เดิมมีแค่ Total 149.20 ดูเหมือนมีส่วนลดลอย ๆ — จริง = 138 − 10% + 25)
  4. **same-day = จัดส่งทันที อัตโนมัติ** — ไม่ให้เลือกรอบเอง (ระบบเลือกรอบที่เวลาปัจจุบันอยู่ในหน้าต่างส่งก่อน ไม่มีค่อยใช้รอบถัดไป) · พรีออเดอร์ยังเลือกวัน/รอบเหมือนเดิม = แยกทางกันชัด (server RPC ยังตรวจ cutoff/ความจุเหมือนเดิม — ไม่แตะ business rule)
  5. **แสตมป์ Out of stock พรีออเดอร์เกินวัน** — FoodMenuCard + MenuPage (วันจาก menu_schedule < วันนี้ → แสตมป์ "หมดเวลาจอง (Out of stock)" + ปิดปุ่มจอง)
  6. **ฟอร์มลงทะเบียนไรเดอร์ = dropdown** — เลือกจากผู้ใช้ที่ลงทะเบียนบนเว็บแล้ว (profiles — เติมชื่อ/เบอร์อัตโนมัติ) + dropdown พาหนะ (มอเตอร์ไซค์/รถยนต์/จักรยาน/อื่น ๆ) — ตรงคำสั่ง "จิ้มเลือกไม่ต้องกรอกใหม่ + ดรอบดาวเลือกพาหนะ" · ลบโค้ดซ้ำ (useEffect โหลดรูป 2 รอบ)
  7. **แผนที่หน้า checkout ไม่ขึ้น** — fallback ป้อนพิกัดเองทำงานได้ (ใช้ GPS/ป้อนมือได้จริงระหว่างทดสอบ) · สาเหตุโหลด SDK ไม่สำเร็จบนเครื่อง = ต้องเช็ก Google Cloud key/referrer restriction (ฝั่ง Owner) — โค้ดพร้อมตั้งแต่ build `1cada70`
- **หมายเหตุ encoding (Owner เตือน):** ทุกไฟล์ที่แก้เขียนผ่าน editor (UTF-8 ตรง) · สแกนซ้ำทั้ง repo = **0 mojibake / 358 ไฟล์** · BOM 21 ไฟล์คงเดิมครบ (ไม่ได้แตะ) · ค้นใน shell ใช้ `\uXXXX` เท่านั้น (PowerShell `Get-Content` ไฟล์ไม่มี BOM จะแสดงไทยเพี้ยนเอง — ไม่ใช่ไฟล์เสีย)
- **ข้อมูลทดสอบจริง (Owner เพิ่ม):** ลูกค้า 2 คน (`jin.pao66` "Pual bite drive" = คนที่จะลงทะเบียนเป็นไดรเวอร์ + `siamportal` "Customer") — ใช้ dropdown ใหม่ลงทะเบียนได้ทันที
- **GATES/EVIDENCE:** lint=0 (385) · tests [ดูผลรอบปิดงาน] · build=0 · mojibake scan 0 · BOM คงเดิม

---

## 📌 STALE ENTRY ที่ต้องระวัง (ระบบจะเตือนตอนดึงกลับ)
- **AI_WORK_STATE.md เวอร์ชันก่อน 19 ต.ค. 2026** = STALE — รอบนี้แก้ตามผลทดสอบจริง (ค่าครัว/คูปอง/จ่ายเงิน/ทันที/แสตมป์/ไรเดอร์) เปลี่ยนพฤติกรรมหน้าเว็บหลายจุด

---

## 📁 โครงสร้างโปรเจกต์ (Files & Docs)
- `docs/BMB_HANDOFF_NEXT_SESSION_2026-10-17-EVE.md` — handoff ปัจจุบัน (สถานะ + E2E Checklist §3 + Blocker §4)
- `src/config/kitchenLocation.ts` — พิกัดครัว single source (ห้าม hardcode ที่อื่น)
- `BMB_SAME_DAY_PRE_ORDER_MASTER_PLAN.md` + `PHASE_CONTRACTS` + `EVIDENCE_LOG` + `REGRESSION_MATRIX` — กติกาเดิม (phases 0-6 ปิดแล้ว)
