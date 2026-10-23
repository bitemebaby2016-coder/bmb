# Bite Me Baby — AI Work State (ระบบบันทึกสถานะสำหรับแชทถัดไป)

> **สถานะงานปัจจุบันของโปรเจกต์ Bite Me Baby** ใช้แนบเข้าสู่ Context ตอนเริ่มแชทเสมอ

**last_updated:** 2026-10-23 รอบ 5 (R3 Gate 0–1 + P1-3 ปิดจริง · migration 138/139 ขึ้น production แล้ว — เขียนทับรอบ 4)
**phase:** 🟡 **D1 recovery R3 — P0-1/P0-2/P1-3 ลงโค้ด+tests+SQL contract+apply production แล้ว · เหลือทดสอบจริง Test A–E (Owner) + P1-1/P1-2/P2/P3**
**current_focus:** รอ Owner ทดสอบจริงบน `biteme-baby.com` + อุปกรณ์จริง (Test A–E) → ถ้าผ่านค่อยปิด P1-1 (รอบส่ง — ต้องถาม Owner ก่อน), P1-2 (UI sync), P2 (คูปอง), P3 (แผนที่ env)
**blocked_by:** (1) Owner ทดสอบจริง Test A–E (2) Owner ตอบ: ใคร/ทำไมปิดรอบ evening 23–25 + กติกาเปิด/ปิดรอบ (3) Owner ตั้ง `VITE_GOOGLE_MAPS_API_KEY`/`VITE_GOOGLE_ROUTES_API_KEY` ใน Cloudflare Pages env (D-06)

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