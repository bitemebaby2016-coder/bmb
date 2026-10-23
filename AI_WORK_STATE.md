# Bite Me Baby — AI Work State (ระบบบันทึกสถานะสำหรับแชทถัดไป)

> **สถานะงานปัจจุบันของโปรเจกต์ Bite Me Baby** ใช้แนบเข้าสู่ Context ตอนเริ่มแชทเสมอ

**last_updated:** 2026-10-23 รอบ 7 (R5 Pre-order separation + admin hubs wave 2 — ต่อจาก R3 round-6b)
**phase:** 🟢 **R5 SHIPPED — PRE_ORDER แยกฟีเจอร์เมนูรอบพิเศษ + ยุบรวมแอดมินระลอก 2** — เทสเขียว 1344/1344 + tsc + lint + contract 141 (production)
**current_focus:** รอ Admin/Owner ทดสอบโปรดักชั่นจริงตาม `docs/BMB_R5_PRE_ORDER_SEPARATION_2026-10-23.md` §Checklist (ไทย) — โดยเฉพาะเคสพรีออเดอร์ผสมสินค้าทั่วไป + วันเมนูถูกล็อกโดยปฏิทินแอดมิน
**blocked_by:** (1) ผลทดสอบโปรดักชั่นของ Admin (2) ยืนยัน cache/รีเฟรชหน้าก่อนทดสอบ (build เก่าโชว์ป้ายวันผิด)

---

---

## 🩺 REALITY CHECK (2026-10-23 รอบ 7 · Directive R5)
- **คำสั่ง Owner:** "พรีออเดอร์ควรเพิ่มสินค้าที่ไม่ใช่พรีออเดอร์ได้ทั้งหมดและส่งในรอบเดียวกับพรีออเดอร์ได้ ... ต้องแยกระหว่างพรีออเดอร์ [ทั่วไป] กับเมนูที่แอดมินใส่เองทีละ 7 วัน 14 เมนู (วันถูกกำหนดโดยปฏิทินที่แอดมินใส่ — ป้ายมุมเมนู) แล้วลูกค้าเลือกแค่รอบ ... เมนูที่เลยวันไปแล้วให้เก็บ archive (ไม่โชว์วันที่ผ่านรอบจัดส่ง) ... ต้องการยุบรวมระลอก 2 ... ผ่านหมดค่อยคอมมิทพุช แอดมินจะทดสอบโปรดักชั่นจริง แจ้งรายการทดสอบละเอียดภาษาไทย"
- **ทำรอบนี้ (ทั้งหมด verified):**
  - **C1 PRE_ORDER รับสินค้าทุกตัว:** ยกเลิก gate `PRE_ORDER × available_preorder` (client checkModeEligibility + server create_order_with_items ใน migration 141) — สินค้าทั่วไปเพิ่มในตะกร้าพรีออเดอร์ได้ทั้งหมด · SAME_DAY gate (available_same_day) คงเดิม
  - **C2 แยกเมนูรอบพิเศษตามปฏิทินแอดมิน:** menu_schedule (7 วัน/14 เมนู) ผูก "วันจัดส่ง" ให้สินค้าในเมนูเท่านั้น (ป้ายมุมเมนู = ProductScheduleMap) — checkout ล็อกวันอัตโนมัติ (resolveMenuBoundDate), ลูกค้าเลือกแค่รอบจัดส่ง · สินค้าทั่วไปส่งร่วมรอบเดียวกันได้ · ผูกหลายวัน = conflict แจ้งแยกสั่ง (ไม่เดา) · enforce_menu_gate ใหม่: สินค้าผูกวันต้องตรงวัน/รอบ, สินค้าทั่วไปผ่าน
  - **C3 archive วันเมนูที่ผ่านรอบจัดส่ง:** pickNextScheduleDates กรอง d < today (ไม่โชว์ลูกค้า) + isMenuDateArchived + ป้าย "📦 จัดเก็บแล้ว" ใน week strip แอดมิน (วนใช้รอบถัดไปได้)
  - **ยุบรวมระลอก 2:** MenuHub (เมนู/สินค้า + ตารางเมนูรอบพิเศษ, /admin/products) + OrgHub (องค์กร/ร้านค้า + แบรนด์, /admin/tenants) · เส้นทางเก่า /admin/menu-schedule → ?tab=schedule, /admin/brands → ?tab=brands (bookmark ไม่ตาย)
  - **Gates:** vitest 1344/1344 (130 ไฟล์, preOrderUnification 10 ข้อใหม่) + tsc + lint + brandNameGuard + secret scan · contract 141 (G1–G5b) ใน CI + production
- **เทสที่เปลี่ยนสัญญา (ตั้งใจ):** menuSchedule (PRE_ORDER eligibility + gate), menuScheduleGate (off-menu → created), canonicalOrderFlow (PRE_ORDER accepts) — ตามสัญญา migration 141 C1/C2

## ⚡ TASK: R5-PRE-ORDER-SEPARATION-2026-10-23
1. ✅ client (bmbMenuSchedule/productSchedule/CheckoutPage ล็อกวัน) + server (migration 141) + mock mirror
2. ✅ archive วันเมนูผ่านรอบ + Hub ระลอก 2 + nav/redirect
3. ✅ เทสเขียวหมด → commit/push → apply 141 production → contract 141 production → record
4. ⏳ รอ Admin ทดสอบโปรดักชั่นตาม checklist (docs/BMB_R5_PRE_ORDER_SEPARATION_2026-10-23.md)


## 🩺 REALITY CHECK (2026-10-23 รอบ 6 · Directive R3)
- **ทำรอบนี้:** Phase 0–10 ครบตามลำดับ — ปิด D-05 (round audit+guards), D-04 (coupon hydration race), D-07 (focus refresh rider/admin/rounds), D-06 (map env ครบ+verify wiring), **backup restore drill = RUNTIME VERIFIED จริง** (integrity + restore ลง scratch PG17 · แก้บั๊ก drill 4 จุดที่ทำให้ไม่เคยผ่านจริง) · เพิ่ม daily restore drill ใน `daily-backup.yml`
- **สอบสวน D-05:** evening rounds 23–25 = ถูก toggle วันนี้ 13:42–13:43 UTC (เซสชันแอดมินผ่าน UI, ~2-3 วิ/รอบ) · **ก่อนหน้านี้ไม่มี audit trail ของรอบเลย** → ระบุผู้ปิดวันที่ 10-22 ไม่ได้ (ไม่เดา) · audit ถูกเพิ่มแล้วตั้งแต่รอบนี้
- **Verification รอบนี้:** vitest **1331/1331** (129 ไฟล์) · tsc=0 · lint=0 · drill PASS · probes RO ครบ (`e2e/artifacts/r4-probe-*.json`) · flaky ขนาน `orderTimeline` 3 ตัว = ผ่านเดี่ยว+ผ่านรอบซ้ำ (ไม่ใช่ regression — รายงานตามจริง)
- **Data repair 841/205:** PROPOSED เท่านั้น (แผน reversible ใน closure doc §5) — **ยังไม่แตะข้อมูล** จน Owner อนุมัติ
- **กติกาคงเดิม:** ห้าม DONE ก่อน Owner test ผ่าน · ห้ามเงียบ error · ไม่ใช้ realtime · เขียนทับเอกสารสถานะเสมอ

---

## ⚡ TASK: R3-WHOLE-PROJECT-CLOSURE-2026-10-23
- **STATUS: 🟡 ENGINEERING CLOSURE READY FOR OWNER ACCEPTANCE = YES (แต่ยังไม่ DONE/accepted)**
- **Completed:** ดู REALITY CHECK + `docs/BMB_R3_ENGINEERING_CLOSURE_2026-10-23.md` §3
- **Verified:** §6/§11 ของเอกสาร closure (vitest 1331 · tsc 0 · lint 0 · restore drill PASS · production probes)
- **Failed:** ไม่มีค้าง (flaky ขนาน 2 ไฟล์ `orderTimeline`/`homeSectionModeCta` = ผ่านเมื่อรันซ้ำ — รายงาน ไม่ซ่อน)
- **Blocked:** Owner test A–Q · §7 3 ข้อ (กติการอบ/capacity/repair approval) · Google key restriction (Owner)
- **Files Changed (รอบนี้):** `src/lib/bmbAdminApi_rounds.ts` · `src/pages/admin/AdminRounds.tsx` · `src/pages/admin/AdminOrders.tsx` · `src/pages/RiderPwaPage.tsx` · `src/components/CouponBox.tsx` · `scripts/dbRestoreDrill.mjs` · `.github/workflows/daily-backup.yml` · `src/__tests__/couponHydrationRace.test.ts` · `src/__tests__/roundsAuditGuards.test.ts` · `e2e/r4BaselineProbe.cjs` · `docs/BMB_R3_ENGINEERING_CLOSURE_2026-10-23.md` · `AI_WORK_STATE.md`
- **Tests/Commands:** vitest 1331/1331 · tsc 0 · eslint 0 · `node scripts/dbRestoreDrill.mjs [--psql]` PASS · `node e2e/r4BaselineProbe.cjs {baseline,money,rounds,ops,investigate}`
- **Known Risks:** backup 05:16 ยังไม่รวม mig 138/139 (recovery ต้อง re-apply จนถึง backup รอบถัดไป) · storage objects ไม่อยู่ใน dump · กำไรสุทธิ = unsupported metric
- **Next Exact Action (แชทถัดไป):** (1) รับผล Owner test A–Q (2) ถ้าอนุมัติ repair 841/205 → ทำตามแผน §5 พร้อม evidence (3) ถ้ามี FAIL → forward-fix ตาม §13 (4) ทำ auto-close rounds ตามนโยบายที่ Owner เลือกใน §7

---

## 🩺 REALITY CHECK (2026-10-23 รอบ 5) — ลงมือปิดงานจริงตามแผน R2.2 §2–§3

- **รอบ 4 (ก่อนหน้า):** root-cause matrix D-01…D-08 + แผน P0–P3 + Test A–E (เอกสาร) — รอบ 5 คือการลงมือ
- **P0-1 (D-08) — IMPLEMENTED + DEPLOYED (DB) + CONNECTED (client, รอ push):**
  - migration `138_payment_intents_read_authority.sql` — **apply ขึ้น production แล้ว** (Management API, 2026-10-23 13:15 UTC, Owner approve "ถ้าผ่านจริง"): `get_payment_intents_for_orders` (SECURITY DEFINER read RPC — ทาง A ตามที่ Owner เลือก) + server-side dedupe ใน `create_payment_intent_record` + partial unique index `uq_payment_intents_active_order_method` (precheck ยืนยัน ACTIVE ซ้ำ = 0 ก่อน apply) + `confirm_offline_payment` เลือกแถวก่อน 'processing' + restore audit (`payment_processed` ที่ 129 ทำหลุด)
  - client: `paymentGateway.getPaymentIntents/confirmPayment` → RPC เท่านั้น · **read failure = throw `ERR_PAYMENT_INTENTS_READ` (ไม่เงียบคืน [] อีก)** · `AdminOrders` มี banner · `PaymentConfirmationPage`/`OrderTrackPage`/`bmbAdminApi_orders` (refund provider lookup) รายงาน error ครบ
  - ตาราง `payment_intents` ยัง REVOKE'd (canonical 034 คงเดิม — probe ยืนยัน `auth_select=false`)
- **P0-2 (D-02) — IMPLEMENTED + DEPLOYED (DB) + CONNECTED (client, รอ push):**
  - migration `139_pod_policies_trusted_helper.sql` — **apply ขึ้น production แล้ว**: helper `current_driver_id()` + `pod_path_is_driver()` (SECURITY DEFINER — ไม่มี scalar subquery ใน policy อีก บทเรียน 119/132) + policy ใหม่ 4 ตัว (verify: `pod_path_is_driver(name)` ทุกตัว) · ทน %20 encoding (drivers.id มี space) · ไม่ rename id ใน production
  - client: `driverService.uploadPodPhoto` normalize/validate path · `RiderPwaPage` **แยกปุ่ม ถ่ายรูป (กล้อง) / เลือกรูปจากเครื่อง (แกลเลอรี่)** + progress รายขั้นตอน upload→attach→ปิดงาน + retry (ยกเว้น state error)
- **Verification ที่รันจริงรอบนี้ (ทั้งหมดเขียว):** vitest **1325/1325** (1317 เดิม + 8 ใหม่) · `tsc --noEmit`=0 · `eslint`+brandNameGuard=0 · **SQL replay 001→139 บน PG16 ephemeral (docker) = ALL CLEAN** · `e2e/contracts_138_139.sql` **G1–G7 ผ่าน** (scope/dedupe/confirm-pick/policy-no-subquery/storage INSERT จริงด้วย driver id มี space ทั้ง raw + %20) · regression `contracts_132`+`contracts_133` ผ่าน
- **Production evidence:** `e2e/artifacts/prod-{precheck,apply,verify,record}-138-139.json` (precheck: history=137 ก่อน · ACTIVE dupes=0 · pod-objects=0 · verify: funcs prosecdef ครบ · grants auth+service_role · policies ใช้ helper · history บันทึก 138/139 แล้ว)
- **กติกาคงเดิม:** ห้ามเรียก "DONE" จน Owner ทดสอบจริงผ่าน (Test A–E) · ห้าม mock ใน production path · ทุก read ห้ามเงียบ error · เอกสารสถานะเขียนทับเสมอ

---

## ⚡ TASK: R3-PRODUCTION-CLOSURE-2026-10-23 — Gate 0–1 + P1-3 ปิด (เหลือ Test A–E + P1-1/2/P2/P3)
- **STATUS: 🟡 P0 ปิดฝั่ง implement+deploy แล้ว · ยังไม่ RUNTIME VERIFIED (รอ Owner ทดสอบจริง)**
- **Completed (รอบนี้):** ตาม REALITY CHECK ข้างบน — migration 138/139 + client payment/POD chain + tests + contracts + CI step (`contract-tests.yml` เพิ่ม Contract 138-139) + apply/verify production
- **Verified:** ทุก gate ที่เครื่องพิสูจน์ได้ (unit/type/lint/replay/contract) + production object verify · **ยังไม่มี E2E จริงบนอุปกรณ์ = ยังไม่ผ่านเกณฑ์ปิดงาน**
- **Failed:** ไม่มี (flaky `homeSectionModeCta` ตอนรันขนาน — ผ่านเมื่อรันเดี่ยว/รันซ้ำ ไม่เกี่ยวกับโค้ดที่แก้)
- **Blocked:** Test A–E = Owner ต้องทดสอบจริง · P1-1 = รอคำตอบ "ใครปิดรอบ evening 23–25" · P3 = รอ Owner ตั้ง Cloudflare env
- **Files Changed (รอบนี้):** `supabase/migrations/138_payment_intents_read_authority.sql` · `139_pod_policies_trusted_helper.sql` · `e2e/contracts_138_139.sql` · `e2e/r3Apply138139.cjs` · `.github/workflows/contract-tests.yml` · `src/lib/paymentGateway.ts` · `src/lib/paymentExceptions.ts` · `src/lib/bmbAdminApi_orders.ts` · `src/lib/driverService.ts` · `src/pages/admin/AdminOrders.tsx` · `src/pages/PaymentConfirmationPage.tsx` · `src/pages/OrderTrackPage.tsx` · `src/pages/RiderPwaPage.tsx` · `src/__tests__/helpers/supabaseMock.ts` · `src/__tests__/paymentReadAuthority.test.ts`
- **Next Exact Action (แชทถัดไป):** (1) Owner ทดสอบ Test A–E บน biteme-baby.com + อุปกรณ์จริง (2) ถาม Owner 2 ข้อ: ใคร/ทำไมปิดรอบ evening 23–25 + กติกาเปิด/ปิดรอบ → ปิด P1-1 (3) ทำ P1-2 terminal-state gating + P2 คูปอง + P3 map fallback (4) data repair เสนอเฉพาะ: แถว intent ซ้ำคู่ 841/205 (processing+completed) — ห้ามลบ/merge จน Owner อนุมัติ

---

## 🩺 REALITY CHECK (2026-10-23 รอบ 4) — วิเคราะห์จากของจริง ไม่เขียนโค้ดซ่อม (ตามคำสั่ง Owner "แฮนออฟปิดเซสชั่นนี้แล้วไปปิดงานกันแชทหน้า")

- **รอบ 3 (ก่อนหน้า):** R1.2–R2.1 code+tests ครบ (commit `f1eaebd` = HEAD = origin/main · vitest 1317/1317 · tsc/lint/build=0) — แต่ยังไม่ผ่านการทดสอบจริง
- **รอบ 4 (รอบนี้): Owner ทดสอบจริงบน biteme-baby.com 13:56–14:23 (แอดมิน/ลูกค้า/ไรเดอร์ "พอล ไบท์ไดรฟ์") แล้ววงจรยังพัง** → root-cause trace ด้วยโค้ดจริง + read-only probes บนโปรดักชั่น (ไม่เขียนข้อมูลแม้แต่แถวเดียว) → สรุปเป็น **Root Cause Matrix D-01…D-08 + Priority Plan P0–P3 + แผนทดสอบ A–E** ที่ `docs/BMB_RECOVERY_PLAN_2026-10-23.md`
- **root cause ชี้ขาดที่เจอรอบนี้ (ยืนยันด้วย probe จริง):**
  - **D-08 (แอดมินตรวจสลิปไม่ได้):** `034:88 REVOKE ALL ON payment_intents FROM authenticated` ไม่มี GRANT คืน → `has_table_privilege=false` (probe) → ทุก `from('payment_intents')` เงียบ error คืน `[]` → แผงตรวจสลิปไม่เห็นหลักฐาน + ปุ่ม disabled ทุกแถว · แถม dedupe (R1.2) ตาบอด → **intent ซ้ำ 2 แถว/ออเดอร์ (841/205 — หลักฐานจริง)**
  - **D-02 (POD):** `pod_photos_driver_upload` ใช้ scalar subquery กับตาราง RLS (ชนิดที่ 119 เองบันทึกว่า "hidden by RLS and breaks WITH CHECK") → ทุก upload โดน "new row violates row-level security policy" — **pod-photos มี object 0 ชิ้นตลอดกาล** ขณะที่สลิป (เทียบ `auth.uid()` ตรง) ผ่าน · ซ้ำด้วย `drivers.id` มี space (position 5) + storage-js `encodeURIComponent` ทุก segment · `RiderPwaPage.tsx:772` `capture="environment"` = ปุ่มกล้องอย่างเดียว
  - **D-05 (ไม่มีรอบ):** evening rounds 23–25 ถูก `status='closed'` (2026-10-22 10:33–10:35, ไม่มี audit — ต้องถาม Owner) + morning/midday เลย cutoff ตอน 14:01 → "ไม่มีรอบที่เปิดรับ"
  - **D-06 (แผนที่):** key อ่านตอน build (`googleMaps.ts:10`) — build ที่ deploy ไม่มี `VITE_GOOGLE_MAPS_API_KEY` (Owner ต้องตั้งใน Cloudflare Pages env)
  - **D-01/D-07:** วงจร auto-close ใน DB มีแล้ว (132:495-570) แต่ UI ค้าง snapshot เก่า + งานล้มที่ D-02 → แอดมินต้องกด `admin_advance` ปิดเอง · **แอปไม่มี realtime (stub ทั้ง bundle) — ห้ามเสนอ realtime เป็นทางแก้**
- **กติกา (D-08 เดิม) ยังใช้:** ทุกอย่าง = **รอลงมือ/รอทดสอบจริง** — ห้ามเรียก "DONE" จน Owner ทดสอบจริงผ่าน · เอกสารสถานะเขียนทับเสมอ · ห้ามอ้างไฟล์ที่ไม่มีจริง

---

## ⚡ TASK: R2.2-ROOTCAUSE-HANDOFF-2026-10-23 — วิเคราะห์+วางแผน+แฮนออฟ (เอกสารเท่านั้น)
- **STATUS: 🟢 ฝั่งวิเคราะห์เสร็จสมบูรณ์ · งานแก้ไข = ของแชทถัดไป (ยังไม่ได้ลงมือ — ตามคำสั่ง)**
- **Objective:** root-cause จากอาการจริงของ Owner → Root Cause Matrix (ยืนยัน vs สมมติฐาน) → Priority/Dependency Plan → แฮนออฟปิดเซสชั่น
- **Completed (รอบนี้):**
  - trace โค้ดจริงทุกสายที่เกี่ยว: POD upload chain (`uploadPodPhoto`→`driver_attach_pod`→`driver_update_delivery_status`), payment read/write chain (`paymentGateway.ts`, `paymentExceptions.ts`, `SlipReviewPanel.tsx`, 008/034/129/133), coupon (`cartPersistence.ts`, `CouponBox.tsx`, `promotionClient.ts`, `cartStore.ts`), rounds (`bmbAdminApi_rounds.ts`, `deliveryRoundStatus.ts`, 024/028/088), map (`googleMaps.ts`), rider/admin UI (`RiderPwaPage.tsx`, `DeliveryManagement.tsx`, `CheckoutPage.tsx`)
  - **read-only production probes** (Management API — ไม่เขียนข้อมูล): grants ของ payment_intents (`has_table_privilege=false`), จำนวน object ใน pod-photos (**0**), payment_intents ของ 841/205 (**ใบละ 2 แถว**), drivers.id (**มี space**), delivery_rounds 23–25 (**evening ปิด**), `pg_proc.prosecdef` (RPC ทั้งสาย = definer), enum order_status
  - เขียน **Root Cause Matrix D-01…D-08 + P0–P3 + Test A–E + คำสั่งเริ่มงาน** ที่ `docs/BMB_RECOVERY_PLAN_2026-10-23.md` (ฉบับใหม่ เขียนทับ)
  - **เพิ่ม D-08 (แอดมินตรวจสลิปยังใช้ไม่ได้) ตามคำสั่ง Owner** — ยืนยัน root cause ด้วย probe แล้ว
- **Verified:** ข้อมูลทุกบรรทัดอ้างอิงไฟล์/บรรทัดจริงหรือ probe จริง · ไม่แตะโค้ด = เทสต์คงเดิม 1317/1317 (`f1eaebd`) · ไม่มี production write
- **Failed:** ไม่มี
- **Blocked:** การลงมือแก้ทั้งหมดอยู่ที่แชทถัดไป (ตามคำสั่ง "แฮนออฟปิดเซสชั่นนี้แล้วไปปิดงานกันแชทหน้า")
- **Files Changed (รอบนี้):** `docs/BMB_RECOVERY_PLAN_2026-10-23.md` (เขียนทับ — root cause matrix + plan) · `AI_WORK_STATE.md` (เขียนทับไฟล์นี้)
- **Next Exact Action (แชทถัดไป):** ถาม Owner 1 ข้อ (D-08 ทาง A: read RPC / ทาง B: GRANT — แนะนำ A) แล้วเริ่มเขียน migration `pod_photos_driver_upload` ใหม่ + read path ของ payment_intents ตาม `docs/BMB_RECOVERY_PLAN_2026-10-23.md` §2 บรรทัด P0-1/P0-2