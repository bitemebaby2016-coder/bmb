# Bite Me Baby — AI Work State (ระบบบันทึกสถานะสำหรับแชทถัดไป)

> **สถานะงานปัจจุบันของโปรเจกต์ Bite Me Baby** ใช้แนบเข้าสู่ Context ตอนเริ่มแชทเสมอ

**last_updated:** 2026-10-23 รอบ 4 (R2.2 root-cause analysis + แฮนออฟปิดเซสชั่น — เขียนทับรอบ 3)
**phase:** 🔴 **D1 recovery — วิเคราะห์/วางแผนครบแล้ว (Root Cause Matrix D-01…D-08) · เหลือ "ลงมือแก้ + ทดสอบจริง" ในแชทถัดไป**
**current_focus:** แชทถัดไปเริ่มงานตาม `docs/BMB_RECOVERY_PLAN_2026-10-23.md` §3 — เริ่ม P0-1 (D-08 ทางอ่าน payment_intents) → P0-2 (D-02 POD RLS) → P1 → P2/P3 แล้วปิดด้วย Test A–E บน `biteme-baby.com` + อุปกรณ์จริง
**blocked_by:** (1) Owner ตัดสิน D-08 ทาง A (read RPC — แนะนำ) หรือ B (GRANT SELECT) (2) Owner approve ทุก migration ใหม่ (3) ถาม Owner: ใครปิดรอบ evening 23–25 เมื่อ 2026-10-22 10:33–10:35

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