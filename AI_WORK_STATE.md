# Bite Me Baby — AI Work State (ระบบบันทึกสถานะสำหรับแชทถัดไป)

> **สถานะงานปัจจุบันของโปรเจกต์ Bite Me Baby** ใช้แนบเข้าสู่ Context ตอนเริ่มแชทเสมอ

**last_updated:** 2026-10-23 รอบ 3 (R1.2-R1.5 + R2.1 = IMPLEMENTED + เทสต์ 1317/1317 — เขียนทับสถานะรอบ 2)
**phase:** 🟡 **D1 — โค้ดซ่อมครบทุกข้อแล้ว (D-01 DONE จริง · D-02..D-07 = IMPLEMENTED รอทดสอบจริง) · เหลือ R2.2 status walk + R3 evidence บนอุปกรณ์จริง = ปิด D1 ได้ — แผนเต็ม `docs/BMB_RECOVERY_PLAN_2026-10-23.md`**
**current_focus:** รอบถัดไป = ทดสอบจริงบน biteme-baby.com (แอดมิน/ลูกค้า/ไรเดอร์ "พอล ไบท์ไดรฟ์"): วงจรเงิน→dispatch→ไรเดอร์×2 รอบ + status walk + หน้าตั้งค่า → เก็บ evidence R3
**blocked_by:** ไม่มีฝั่งโค้ด — เหลือ "ทดสอบจริง + เก็บ evidence" เท่านั้น (No Evidence = Not Done)

---

## 🩺 REALITY CHECK (2026-10-23) — เขียนทับรอบ 2: โค้ดซ่อมครบทุกข้อแล้ว (รอทดสอบจริง)

- **รอบ 1 (เช้า):** R0 audit ปิด D-01..D-08 ระดับ DB + apply migration 136 + drift repair (Owner approve) — evidence `e2e/artifacts/r0-prod-audit*.json`, `prod-apply-136*.json`, `prod-verify-136.json`
- **รอบ 2 (บ่าย): เขียนโค้ดซ่อมครบทุกข้อ + เทสต์ 1317/1317 (baseline 1291 → +26 เคสใหม่ · tsc/lint/build=0 · mojibake=0):**
  - **R1.2 (D-04/D-05/H-02):** intent dedupe (`createPaymentIntent` คืนแถวเดิมถ้ายัง active — ปิดต้นเหตุ intent ซ้ำแบบ BMB-20261023-841/205) · self-heal latch จริง · SlipReviewPanel เห็นทุกออเดอร์รอตรวจไม่ผูกตัวกรอง + ปุ่มปิดพร้อมเหตุผลไทย (paymentConfirmability) · ข้อความ "คนสั่ง = คนจ่าย" · แก้ dead UI การ์ดลองชำระใหม่ (เดิมเช็ค payment_status='failed' ซึ่งเป็นไปไม่ได้ตาม CHECK)
  - **R1.3 (D-03):** readyQ = confirmed/preparing/ready_for_dispatch (ตามสัญญา RPC จริง) — บอร์ดมอบหมายเห็นออเดอร์จ่ายแล้วทันที
  - **R1.4 (H-04):** mock ตรงสัญญา 132/135/136 แล้ว (ERR_POD_REQUIRED บังคับจริง — เดิมเทสต์เขียวแต่ของจริงพัง) + วงจรไรเดอร์เต็ม 6 เคส (ประกาศ→claim คนแรกจอง→POD→สำเร็จ + GPS heartbeat)
  - **R1.5 (D-06/D-07):** replay banner ถาวรบน /payment (เห็นชัด ไม่เงียบ) · branch filter ไม่ซ่อนออเดอร์ branch NULL
  - **R2.1 (D-02):** social_links เหลือทางบันทึกเดียว (ออกจาก generic editor + Save All)
- **กติกา (D-08) ยังใช้:** ทุกอย่างข้างต้น = **IMPLEMENTED (รอทดสอบจริง)** — ห้ามเรียก "DONE" จนกว่า Owner ทดสอบจริงผ่าน · เอกสารสถานะเขียนทับเสมอ ห้ามเขียนต่อ · ห้ามอ้างไฟล์ที่ไม่มีจริง

---

## ⚡ TASK: D1-CHUNK1-A5-M1-TIMELINE-2026-10-22 — รวม timeline ลูกค้าเหลือตัวเดียว + fix label ซ้ำ
- **STATUS: 🟡 IMPLEMENTED + gates ผ่านครบ — UNVERIFIED บนอุปกรณ์จริง (รอ Owner ทดสอบ 3 อุปกรณ์ก่อน push)**
- **Task ID:** D1-CHUNK1-A5-M1-TIMELINE-2026-10-22
- **Objective:** A5 (label "กำลังจัดส่ง" ซ้ำ 2 ช่อง) + M1 (รวม timeline ซ้ำ 2 ชุด/2 คำศัพท์เหลือตัวเดียว)
- **Completed:**
  - สร้าง `src/components/customer/OrderTimeline.tsx` ตัวเดียว ขับจาก server enum + `orderVocabulary` (8 ขั้นเดินหน้า + terminal end card — ไม่มี progress ปลอม)
  - `orderVocabulary.ts` fix label: `dispatched`='เริ่มจัดส่ง' / `in_transit`='กำลังเดินทาง' (ตรงฝั่งไรเดอร์) — label ไม่ซ้ำทุกสถานะ
  - `OrderTrackPage.tsx` ลบ TIMELINE ในไฟล์ → เรียก `OrderTimeline` (ตัวเดียว)
  - ลบ component ซ้ำ 2 ตัว: `components/customer/CustomerTimeline.tsx` + `components/dashboard/CustomerTimeline.tsx` (ไม่มี import ไหนใช้, ไม่มีเทสต์ผูก — ตรวจด้วย Get-ChildItem -Recurse)
  - เพิ่มเทสต์ `src/__tests__/orderTimeline.test.ts` 6 ตัว (label ไม่ซ้ำ/A5 fix/enum ครบทุกสถานะ/terminal/unknown)
- **Verified:** `npx tsc --noEmit`=0 · `npm run lint`=0 · `npm run test`=**1222/1222 (116 files)** (1216 เดิม+6 ใหม่) · `npm run build`=0 · mojibake scan ไฟล์ที่แตะ=0 · BOM=ไม่มีเพิ่ม
- **Failed:** ไม่มี
- **Blocked:** runtime evidence 3 อุปกรณ์ (track ทุกสถานะ ห้าม label ซ้ำ) — ต้อง Owner ทดสอบ · push = ต้อง Owner approve
- **Files Changed:** `src/components/customer/OrderTimeline.tsx` (ใหม่) · `src/lib/orderVocabulary.ts` · `src/pages/OrderTrackPage.tsx` · `src/__tests__/orderTimeline.test.ts` (ใหม่) · ลบ `src/components/customer/CustomerTimeline.tsx`, `src/components/dashboard/CustomerTimeline.tsx`
- **Tests / Commands Run:** ดู Verified
- **Known Risks:** (1) `lib/orderStateMachine.ts`+`stores/useOrderStateMachine.ts` คงอยู่ (pure logic+เทสต์ — ห้ามลดจำนวนเทสต์ตาม gate) — UI เลิกใช้แล้ว เหลือ `dashboard/RiderPWA.tsx` (scope M3) (2) ป้ายสถานะ OrdersPage/TalkToBite เปลี่ยนตาม vocabulary อัตโนมัติ ('เริ่มจัดส่ง'/'กำลังเดินทาง')
- **Next Exact Action:** A1+M2 — สร้าง `CouponBox` ตัวเดียว (Cart+Checkout) + `handleUseCode` apply เข้า cart store ทันที + deep-link `/menu?code=X`

## ⚡ TASK: D1-CHUNK2-A1-M2-COUPON-2026-10-22 — คูปอง: UI เดียว + apply เข้าตะกร้าทันที
- **STATUS: 🟡 IMPLEMENTED + gates ผ่านครบ — UNVERIFIED บนอุปกรณ์จริง (รอ Owner ทดสอบ 3 อุปกรณ์ก่อน push)**
- **Task ID:** D1-CHUNK2-A1-M2-COUPON-2026-10-22
- **Objective:** A1 (กด "ใช้เลย" ไม่ได้โค้ด + UI ซ้ำซ้อน) + M2 (รวม coupon UI เป็น component เดียว)
- **Completed:**
  - สร้าง `src/components/CouponBox.tsx` — UI เดียวใช้ทั้ง CartPage+CheckoutPage + ทาง apply เดียว: `applyCouponCode()` / `removeCouponCode()` / `revalidateCouponForSubmit()` (gate ตอนสั่งซื้อย้ายจาก CheckoutPage มาที่นี่ตาม M2)
  - `PromotionsPage.handleUseCode` (A1): "ใช้เลย" → `applyCouponCode` เข้า `useCartStore` **ทันที** (โค้ด+โปรโมชันเข้าตะกร้า ไม่ต้องพิมพ์เองตอนจ่าย) · clipboard = bonus เงียบ (ไม่มี toast "คัดลอกแล้ว" ปลอม — fallback โชว์โค้ดบนจอ) · ปุ่มเปลี่ยนเป็น "ใช้แล้ว ✓"
  - deep-link `/menu?code=X` auto-apply ใน MenuPage (strip param หลัง apply — ไม่ยิงซ้ำ)
  - ลบ UI+handler ซ้ำใน CartPage/CheckoutPage (testids เดิม `applied-coupon`/`coupon-input`/`coupon-apply` คงไว้ใน CouponBox) · rehydration ของโค้ดย้ายเข้า CouponBox (ทุกหน้าที่โชว์กล่องคูปองได้ประโยชน์)
  - สถานะใหม่ pending (below_min): เก็บโค้ดไว้ตรวจอีกครั้งตอนยอดถึง — ไม่แสร้งว่าหักส่วนลดแล้ว
  - เพิ่มเทสต์ `src/__tests__/couponBox.test.ts` 11 ตัว (apply path/pending/dead-code/gate/UI)
- **Verified:** `npx tsc --noEmit`=0 · `npm run lint`=0 (brandNameGuard OK 401 ไฟล์) · `npm run test`=**1233/1233 (117 files)** (1222+11 ใหม่) · `npm run build`=0 · mojibake scan=0 ทุกไฟล์ที่แตะ · BOM: MenuPage.tsx มี BOM เดิมค้างอยู่ก่อน (ตรวจ diff = hunk แรกที่บรรทัด 11 ไม่แตะหน้าไฟล์) — คงเดิมตามกติกา
- **Failed:** ไม่มี (เทสต์ couponBox รอบแรก fail 1 ตัวจาก mock ไม่ตั้งค่าใน test setup — แก้ test setup ให้ครบ ไม่แตะ assertion)
- **Blocked:** runtime evidence 3 อุปกรณ์ (กด "ใช้เลย" → checkout มีโค้ดในช่อง + ส่วนลดตรงโปรโมชันจริง) — ต้อง Owner ทดสอบ · push = ต้อง Owner approve
- **Files Changed:** `src/components/CouponBox.tsx` (ใหม่) · `src/pages/CartPage.tsx` · `src/pages/CheckoutPage.tsx` · `src/pages/PromotionsPage.tsx` · `src/pages/MenuPage.tsx` · `src/__tests__/couponBox.test.ts` (ใหม่)
- **Tests / Commands Run:** ดู Verified
- **Known Risks:** (1) UI คูปอง Cart+Checkout รวมร่าง copy ต่างกันเล็กน้อยเหลือชุดเดียว (ตั้งใจตาม M2) (2) โค้ด typed-but-not-applied ไม่ถูกส่งเป็น promotion_code อีกต่อไป (ต้องกด "ใช้โค้ด" ก่อน — สม่ำเสมอทั้งสองหน้า) (3) A1+M2 ยังไม่ผ่าน E2E จริง 3 อุปกรณ์
- **Next Exact Action:** A2+A7(ก.)+M5 — แผงตรวจสลิปเดียวใน AdminOrders + SlipThumb โชว์ error ชัดแทน "—" เงียบ + ทุกออเดอร์ต้องมี payment_intents row + paymentExceptions ใช้ `getPaymentIntents` ตัวเดียว

## ⚡ TASK: D1-CHUNK3-A2-A7K-M5-SLIP-2026-10-22 — แผงตรวจสลิปเดียว + intent ทุกออเดอร์ + เส้นอ่านเดียว
- **STATUS: 🟡 IMPLEMENTED + gates ผ่านครบ — UNVERIFIED บนอุปกรณ์จริง (Owner ทดสอบจาก production หลัง push)**
- **Task ID:** D1-CHUNK3-A2-A7K-M5-SLIP-2026-10-22
- **Objective:** A2 (แอดมินไม่เห็น/ตรวจสลิปยาก + SlipThumb เงียบเป็น "—") + A7(ก.) (ปิดช่องโหว่ intent หาย — Owner เลือกทาง ก. คง manual ตาม D4) + M5 (payment read สองทาง → เส้นเดียว)
- **Completed:**
  - **M5:** `paymentGateway.getPaymentIntents` รองรับ `orderNumbers[]` batch + `paymentExceptions.getPaymentIntentsFor` เลิกยิง `from('payment_intents')` เอง → delegate ไป `getPaymentIntents` ตัวเดียว (มี source-guarantee test คุม) + SlipThumb เลิก self-fetch — รับ `intents` props จากพ่อแม่ (AdminOrders query ครั้งเดียวต่อหน้า 25 ออเดอร์)
  - **A2:** สร้าง `components/admin/SlipReviewPanel.tsx` = "แผงตรวจสลิปเดียว" — รายการออเดอร์ payment pending ทั้งหน้า + หลักฐาน (SlipThumb) + ปุ่ม `confirm_offline_payment` **จุดเดียว** (ลบปุ่ม Confirm payment + SlipThumb ซ้ำออกจากแถวออเดอร์แล้ว — action เดียวกันห้ามมีสองที่)
  - **A7(ก.):** (1) SlipThumb ไม่มี "—" เงียบ — 6 สถานะชัด: ✓ ตรวจแล้ว / ไม่ต้องตรวจสลิป (COD/บัตร) / ⏳ รอตรวจ / ⏳ รอสลิปจากลูกค้า / ⚠ ไม่พบ payment intent / ⚠ โหลดสลิปไม่ได้ (signed URL พัง) (2) checkout: `ensureReplaySafeIntent` retry 1 ครั้งเมื่อ RPC ตอบ failure + toast เตือนชัดทั้ง single/split (เดิมเงียบเป็น console.warn) + self-heal เดิมที่หน้า /payment คงไว้ — ทุกออเดอร์มี intent ≥1 ตามเป้า (เขียนผ่าน RPC เดิมเท่านั้น ไม่แตะ logic เงิน)
  - เทสต์ใหม่ 14 ตัว: `slipThumbStates.test.ts` (8) + `paymentIntentsSingleRead.test.ts` (6 รวม source guarantee) + mock `paymentExceptions` ในเทสต์ AdminOrders 2 ตัวให้ hermetic (จำนวนเทสต์เดิมไม่ลด)
- **Verified:** `npx tsc --noEmit`=0 · `npm run lint`=0 · `npm run test`=**1247/1247 (119 files)** (1233+14 ใหม่) · `npm run build`=0 · mojibake/BOM scan=0 ทุกไฟล์ที่แตะ
- **Failed:** ไม่มี (เทสต์รอบแรกมี parse error จาก `}` หายในเทสต์ใหม่ — แก้ทันที)
- **Blocked:** runtime evidence 3 อุปกรณ์บน production (ลูกค้าอัปโหลดสลิป → แอดมินเห็น thumbnail ≤30 วิ + เปิดเต็มได้ + กดยืนยันแล้วสถานะลูกค้าเปลี่ยน) — Owner ทดสอบหลัง push · สาเหตุจริงของ "BMB-20261019-405 ไม่พบ payment intent" ต้อง verify บน production ว่ามาจากเส้นสร้างไหน (ตอนนี้ปิดฝั่ง client ครบทุกเส้น + โชว์สถานะชัดเมื่อยังขาด)
- **Files Changed:** `src/lib/paymentGateway.ts` · `src/lib/paymentExceptions.ts` · `src/components/admin/SlipThumb.tsx` (rewrite) · `src/components/admin/SlipReviewPanel.tsx` (ใหม่) · `src/pages/admin/AdminOrders.tsx` · `src/pages/admin/AdminPaymentExceptions.tsx` · `src/pages/CheckoutPage.tsx` · `src/__tests__/slipThumbStates.test.ts` (ใหม่) · `src/__tests__/paymentIntentsSingleRead.test.ts` (ใหม่) · `src/__tests__/adminOrdersModeFilter.test.ts` (+mock) · `src/__tests__/adminPreOrdersConsolidation.test.ts` (+mock)
- **Tests / Commands Run:** ดู Verified
- **Known Risks:** (1) ปุ่ม "💰 Confirm payment" แถวออเดอร์ถูกย้ายเข้าแผง — แอดมินต้องเปิดแผงเพื่อยืนยัน (UI เปลี่ยนตามตั้งใจ A2) (2) intents query ต่อหน้า = 1 batch (RLS admin) — ถ้า policy พังจะเห็น "⚠ ไม่พบ payment intent" ซึ่งตรงกับความจริง (3) retry intent = เรียก create_payment_intent_record ซ้ำ 1 ครั้งเฉพาะกรณี RPC ตอบ failure ชัด — B5/B10 replay guard เดิมไม่กระทบ (เทสต์ call-count ผ่าน)
- **Next Exact Action:** A3 — ตรวจ AdminSettings เขียนลง `delivery_zones` เดียวกับ RPC อ่าน + ตัด/ติดป้าย local-mirror + โชว์ `feeSource` บน checkout

## ⚡ TASK: D1-CHUNK4-A3-DELIVERY-FEE-2026-10-22 — ค่าส่ง: ยืนยันแหล่งเดียว + ยอดสรุปไม่โชว์ค่าเก่าเป็นจริง
- **STATUS: 🟡 IMPLEMENTED + gates ผ่านครบ — UNVERIFIED บนอุปกรณ์จริง (Owner ทดสอบจาก production)**
- **Task ID:** D1-CHUNK4-A3-DELIVERY-FEE-2026-10-22
- **Objective:** A3 — ค่าส่ง/ค่ากำหนดต้องถูกใช้จริงจากตารางเดียวกับแอดมินตั้ง + ไม่มี fallback เงียบทำให้ราคาคลาดเคลื่อน
- **Completed (ส่วนใหญ่เป็นการ verify สายข้อมูลจริง — ของเดิมดีอยู่แล้ว):**
  - ✅ **verify แล้ว:** `AdminSettings.saveZone` เขียน `delivery_zones` (ตารางเดียวกับที่ `compute_delivery_fee` (020) อ่านเลือกโซน + `create_order_with_items` re-derive) — ตอบคำถามค้างใน handoff ได้ว่าเขียนลงตารางเดียวกัน
  - ✅ **verify แล้ว:** `fetchServerDeliveryFee` ไม่มี local-mirror fallback จริง (RPC พัง → `source:'error'` ไม่ใช่ค่าเดา — CR-2 P2 เดิม) + checkout โชว์ `feeSource` ผ่าน `feeUiState` ('คำนวณจากเซิร์ฟเวอร์'/'ประมาณการ (ออฟไลน์)'/error + ปุ่มลองใหม่)
  - ✅ **verify แล้ว:** rounds/capacity เขียน `delivery_rounds` ตรง (AdminRounds + bmbAdminApi_rounds/Products) ขณะที่ server RPC 025/038 คุม cutoff/capacity · lead days = `business_settings.order_policy` (getBusinessSettings/setBusinessSetting ตัวเดียวกัน + server คุมจริง)
  - **แก้ไขจริง (A3 ช่องโหว่แสดงผล):** สร้าง `summaryFeeState()` ใน `deliveryFeeApi.ts` — แถว "ค่าจัดส่ง" ใน Order Summary เดิมติดป้าย "(ประมาณการ)" ทั้งที่ค่า server คือค่าโซนที่แอดมินตั้ง **และ** ตอน quote error โชว์ `deliveryFee` เก่าค้างเหมือนคำนวณแล้ว → ใหม่: server → "(ตามโซนที่แอดมินตั้ง)" / error/null → "รอระบบคำนวณ" (ไม่โชว์ตัวเลขเก่า) + ยอดรวมติดป้าย "(โดยประมาณ)" เมื่อไม่ใช่ค่าจริง · pickup → "รับที่ร้าน — ฟรี"
  - comment `SEEDED_DELIVERY_ZONES` ชัดเจนว่าเป็น test/offline mirror เท่านั้น (admin แก้ delivery_zones จริง — mirror เลื่อนได้ ห้ามโชว์เป็นค่าตั้ง)
  - เทสต์ใหม่ 5 ตัวใน `deliveryFeeApi.test.ts` (summaryFeeState: server/mirror/error/null/pickup) + เติม mock `summaryFeeState` ในเทสต์ checkout 2 ตัว (mock เดิมไม่ครบ)
- **Verified:** `npx tsc --noEmit`=0 · `npm run lint`=0 · `npm run test`=**1252/1252 (119 files)** (1247+5 ใหม่) · `npm run build`=0 · mojibake/BOM=0 ทุกไฟล์ที่แตะ
- **Failed:** เทสต์ checkout 6 ตัว fail รอบแรก (mock deliveryFeeApi ไม่มี summaryFeeState) — เติม mock ให้ครบ ไม่แตะ assertion
- **Blocked:** runtime evidence: เปลี่ยนค่าโซนในแดชบอร์ด → สั่งจริงในรัศมีนั้น → ยอดลูกค้า = ค่าที่ตั้ง ±0 = ยอดที่แอดมินเห็น (Owner ทดสอบบน production)
- **Files Changed:** `src/lib/deliveryFeeApi.ts` · `src/pages/CheckoutPage.tsx` · `src/__tests__/deliveryFeeApi.test.ts` · `src/__tests__/checkoutMixedSplit.test.ts` (+mock) · `src/__tests__/checkoutModeLock.test.ts` (+mock)
- **Tests / Commands Run:** ดู Verified
- **Known Risks:** (1) server `compute_delivery_fee` ยังมี legacy formula fallback เมื่อไม่มีโซน match (020 L137 — "kept until all zones are seeded") — ฝั่ง server ห้ามแตะโดยไม่ผ่าน migration+approval; ถ้าโซนไม่ครบจะเห็นค่าผิดสูตรได้ (2) `localZoneFee` คงไว้เพราะเทสต์เดิม 12 ตัวอ้างถึง (gate ห้ามลดเทสต์) — ไม่มี production caller
- **Next Exact Action:** E2 — ลบ mock ปลอมออกจากหน้า UI (ตามที่ handoff ระบุ: mock data ที่หลุดเข้า production UI)

## ⚡ TASK: D1-CHUNK5-E2-REMOVE-MOCKS-2026-10-22 — ลบ mock ไรเดอร์/ออเดอร์ปลอม ใช้ของจริงเท่านั้น
- **STATUS: 🟡 IMPLEMENTED + gates ผ่านครบ — UNVERIFIED บนอุปกรณ์จริง (Owner ทดสอบจาก production)**
- **Task ID:** D1-CHUNK5-E2-REMOVE-MOCKS-2026-10-22
- **Objective:** E2 — หน้าเส้นทาง/Driver status ต้องอ่าน `delivery_assignments`+`drivers` จริง ห้ามเหลือ mock/demo ในหน้าแอดมิน (กติกาข้อ 5)
- **Completed:**
  - ✅ **verify:** `DeliveryManagement.tsx` สะอาดอยู่แล้ว (comment L12 บอกว่า mock UI "ถูกลบไปแล้ว" — ไม่ใช่ประกาศตัวว่าเป็น mock; ใช้ `list_drivers`/`assign_driver` RPC จริง) — เหลือตัวการเดียว = `RouteOptimizationPage.tsx`
  - **ลบทิ้งทั้งหมด:** `mockOrders` (BMB-001..005 ที่อยู่ปลอม), `mockDrivers` (Somchai/Somying/Wichai), fake 800ms delay, "Max Radius: 5 km" คงที่, ตัวเลข kg ปลอม (estimated_weight ที่ระบบไม่มีจริง)
  - **แทนที่ด้วยของจริง:** ออเดอร์กำลังส่ง (`getOrdersByStatuses` — ready_for_dispatch/dispatched/in_transit/arrived) + ไรเดอร์จริงที่ลงทะเบียน/ผูกบัญชี (`adminListDrivers` = `list_drivers` RPC 037 ตัวเดียวกับ Dispatch board) + รัศมีจริงจาก `branches.service_radius_km`
  - pure mappers ใน `routeOptimization.ts`: `toRouteOrders()` (ข้ามออเดอร์ไม่มีพิกัด — ไม่เดา 0,0; items_count จากจำนวนจริง; estimated_weight=0 เพราะไม่มีข้อมูลจริง) + `toRouteDrivers()` (ชื่อ/สถานะ/ตำแหน่ง/โหลด จากแถวจริง; ตำแหน่ง fallback = ครัว ไม่เดา)
  - หน้าเป็นเครื่องมือวางแผน "อ่านอย่างเดียว" (การมอบหมายจริงอยู่ที่ DeliveryManagement/assign_driver เท่านั้น) + empty state จริง ("ยังไม่มีไรเดอร์ที่ผูกบัญชี")
  - เทสต์ใหม่ 9 ตัว `routeRealData.test.ts` (mappers 5 + ผูก optimizer 1 + **source-guarantee**: หน้าห้ามมี mockOrders/mockDrivers/ชื่อปลอม/BMB-001 และต้องใช้ data services จริง)
- **Verified:** `npx tsc --noEmit`=0 · `npm run lint`=0 · `npm run test`=**1261/1261 (120 files)** (1252+9 ใหม่) · `npm run build`=0 · mojibake scan=0
- **Failed:** รอบแรก (1) tsc: `OrderForm.id` เป็น `string|undefined` — ปรับ mapper ให้ `id?` (2) source-scan โดนคอมเมนต์ตัวเองที่พิมพ์ชื่อปลอมไว้ — แก้คอมเมนต์
- **Blocked:** runtime evidence: หน้าเดิมแสดงเฉพาะออเดอร์จริงของวัน + ไรเดอร์จริงที่ผูกบัญชีแล้ว (Owner ทดสอบบน production)
- **Files Changed:** `src/pages/admin/RouteOptimizationPage.tsx` (rewrite ข้อมูลจริง) · `src/lib/routeOptimization.ts` (+mappers) · `src/__tests__/routeRealData.test.ts` (ใหม่)
- **Tests / Commands Run:** ดู Verified
- **Known Risks:** (1) ออเดอร์เก่าที่ไม่มีพิกัด dropoff จะไม่เข้าแผนเส้นทาง (ตั้งใจ — ดีกว่าหมุดปลอม) (2) `assignOrdersToDrivers` ยังเป็น heuristic อย่างง่าย (nearest/first-available) — คือเครื่องมือวางแผนเท่านั้น การมอบหมายจริงคือ assign_driver RPC
- **Next Exact Action:** E1+A4+A8+M4+M3 — โมเดล "ส่งออกงาน (Dispatch) ประกาศ+push → ไรเดอร์คนแรกรับ = จอง (สถานะเปลี่ยนจริงตอนรับ)" + แอดมิน assign เองได้ + รวม Dispatch Center เดียวที่ DeliveryManagement + ดูด RiderPWA เข้า RiderPwaPage

## ⚡ TASK: D1-CHUNK6-E1-A4-A8-M4-M3-DISPATCH-2026-10-22 — โมเดลประกาศ-รับงาน + Dispatch Center + พอร์ทัลไรเดอร์เดียว
- **STATUS: 🟡 IMPLEMENTED + gates ผ่านครบ + SQL contract 135 พิสูจน์บน PG จริง (G1-G7) — ⚠️ BLOCKED: ต้อง Owner approve "apply migration 135" ลง production ก่อนฟีเจอร์ใช้งานได้จริง (กติกา D2) + runtime evidence 3 อุปกรณ์**
- **Task ID:** D1-CHUNK6-E1-A4-A8-M4-M3-DISPATCH-2026-10-22
- **Objective:** E1 (ประกาศ-รับงาน: คนแรกรับ=จอง สถานะเปลี่ยนจริง + แอดมิน assign เองได้) + A4 (ไรเดอร์เห็นงาน/รับงานได้จริง) + A8 (states ครบ+ชื่อจริง+push) + M4 (Dispatch Center เดียว) + M3 (พอร์ทัลไรเดอร์เดียว แยกจากลูกค้า) + กติกาใหม่: ไม่ hardcode/ไม่ mockup/ไม่ stub/ไม่ dead code
- **Completed:**
  - **Server (migration `135_dispatch_offers.sql` + `e2e/contracts_135_dispatch_offers.sql`):** `dispatch_offers` (1 แถว/ออเดอร์) + `dispatch_offer_declines` (ปฏิเสธต่อคน) + RPC `dispatch_order` (admin ประกาศ), `claim_dispatch_offer` (**atomic UPDATE..WHERE status='offered' — คนแรกได้คนเดียว; claim=accept: assignment เกิดเป็น 'accepted' ทันที**), `driver_decline_offer`, `cancel_dispatch_offer` + `my_deliveries` คืน `offers[]` + `assign_driver` ปิด offer เมื่อแอดมินมอบหมายตรง (แอดมินชนะ) + trigger ปิด offer เมื่อออเดอร์จบทาง + RLS/GRANT ตามแบบ 132
  - **SQL contract พิสูจน์จริงบน ephemeral PG16 (Docker):** G1 ประกาศ/ประกาศซ้ำรีเซ็ต · **G2 คนแรกรับ=จอง คนสอง ERR_OFFER_NOT_AVAILABLE** · G3 assign ตรงชนะประกาศ · G4 ปฏิเสธต่อคน · G5 ยกเลิก+ออเดอร์จบปิดอัตโนมัติ · G6 my_deliveries offers[] · G7 security (no anon, non-admin ประกาศไม่ได้, non-driver รับไม่ได้) — ทั้ง 7 ผ่าน + regression contract 132 ผ่านครบ 6 หลัง replace ฟังก์ชันร่วม
  - **แก้ของพังจริงที่เจอระหว่างทาง:** contract 132 fixture hardcode พิกัด (10.70) ห่างครัวจริง 212km → `SELF_DELIVERY_EXCEEDS_5KM_LIMIT` (พังมาตั้งแต่ครัวย้าย/134) — แก้ทั้ง 132+135 ให้ derive จาก `kitchen_location()` (แบบ 124 — ไม่ hardcode ตามกติกาใหม่)
  - **Client:** `driverService` +4 RPC wrappers + offers mapping + ERR_OFFER_NOT_AVAILABLE · **DeliveryManagement = Dispatch Center**: ปุ่ม "📣 ส่งออกงาน (ประกาศ+push ทุกคน)" แทนปุ่มสลับสถานะเดิม + สถานะประกาศ/ยกเลิกประกาศ + ?focus= deep-link · **AdminOrders (M4)**: เหลือ "ยืนยันออเดอร์ (pending→confirmed)" + deep-link ไป Kitchen/Dispatch (forward chain ออก — ปุ่มเดียวกันอยู่ที่หน้าเจ้าของเดียว: ครัวที่ AdminKitchen, สายส่งที่ Dispatch) + notification events ยิงจากเจ้าของปุ่มแต่ละสาย · **RiderPwaPage (M3+E1+A8)**: งานประกาศใหม่ (รับงาน=claim/ไม่รับ) + ดูด RiderPWA เป็น `PodDeliveryPanel` (geo+POD gates, ไม่มี state จำลอง) + **ลบ `components/dashboard/RiderPWA.tsx`** · **automation-worker**: broadcast push งานประกาศถึงไรเดอร์ทุกคนที่ผูกบัญชี (marker rider_pushed_at กันซ้ำ)
  - เทสต์ใหม่ 11 ตัว `dispatchOffersClient.test.ts` (RPC wiring + race-safety ใน migration + M4 ปุ่มไม่ซ้ำ + M3 ของซ้ำหาย + A8 วงจรครบ) + เพิ่ม contract 135 ใน CI workflow
- **Verified:** `npx tsc --noEmit`=0 · `npm run lint`=0 · `npm run test`=**1272/1272 (121 files)** (1261+11 ใหม่) · `npm run build`=0 · mojibake=0 · **SQL: replay 001-135 ผ่าน + contract 135 G1-G7 + contract 132 regression ผ่านบน PG จริง**
- **Failed/แก้ระหว่างทาง:** (1) contract fixture พิกัดแข็ง (แก้แล้ว — ของ 132 ที่พังค้างก็แก้ด้วย) (2) source-scan โดนคอมเมนต์ตัวเองรอบสอง (path ที่ห้าม) — แก้คำ
- **Blocked:** ⚠️ **apply migration 135 ลง production = ต้อง Owner approve (กติกา D2)** — ฟีเจอร์ announce-claim จะทำงานบน production ไม่ได้จนกว่า apply (ก่อนหน้านั้นปุ่มส่งออกงานจะได้ ERR จากรอบ RPC) + runtime evidence: dispatch 1 งาน → ไรเดอร์ทุกเครื่องได้แจ้งเตือนพร้อมกัน → คนแรกกดรับ → สถานะเปลี่ยนทั้ง 3 หน้า ≤1 poll · คนอื่นเห็น "งานถูกจองแล้ว" · เส้น assign โดยแอดมินอีก 1 รอบ
- **Files Changed:** `supabase/migrations/135_dispatch_offers.sql` (ใหม่) · `e2e/contracts_135_dispatch_offers.sql` (ใหม่) · `e2e/contracts_132_rider_pod_push_decline.sql` (แก้ fixture) · `.github/workflows/contract-tests.yml` (+step 135) · `src/lib/driverService.ts` · `src/pages/admin/DeliveryManagement.tsx` · `src/pages/admin/AdminOrders.tsx` · `src/pages/admin/AdminKitchen.tsx` · `src/pages/RiderPwaPage.tsx` · `supabase/functions/automation-worker/index.ts` · `src/components/dashboard/RiderPWA.tsx` (ลบ) · `src/__tests__/dispatchOffersClient.test.ts` (ใหม่)
- **Tests / Commands Run:** ดู Verified (รวม Docker ephemeral PG16 replay + contracts)
- **Known Risks:** (1) จนกว่า migration 135 ถูก apply — ปุ่มส่งออกงาน/รับงานประกาศบน production จะ error ชัด (ไม่ใช่เงียบ) (2) push broadcast ผ่าน automation-worker (cron) — latency สูงสุด ~5 นาทีเท่าระบบ push เดิม (3) `useOrderStateMachine` ไม่มี UI consumer แล้ว (RiderPWA ถูกลบ) แต่ยังมีเทสต์คุม — เก็บเป็น pure logic ตามมติเดิม
- **Next Exact Action:** E3/E4 — live tracking ไรเดอร์บนแผนที่ Dispatch Center + เก็บประวัติเส้นทางหลังจบงาน + POD จบจริง (แอดมินเห็นทุกขั้น) · **และขอ Owner approve apply migration 135**

## ⚡ TASK: D1-CHUNK9-MARKETING-PART-C-2026-10-22 — AdminMarketing 7 tabs + marketing_publish pipeline + E5/E6 image-gen
- **STATUS: 🟢 DONE — apply 137 + deploy EF 4 ตัว + set secrets บน production แล้ว (Owner approve 2026-10-22) · เหลือ runtime evidence จาก Owner**
- **Task ID:** D1-CHUNK9-MARKETING-PART-C-2026-10-22
- **Objective:** Part C (C1-C2): AdminMarketing Control Center 7 แท็บของจริง + วงจร PLAN→GENERATE→DRAFT→APPROVE(คน)→SCHEDULE→PUBLISH→RECORD + E5/E6 image-gen (prompt สำเร็จรูป + 3 สไตล์) — ไม่มี mockup/hardcode/stub
- **Completed:**
  - **Server (migration `137_marketing_posts_rules.sql` + `e2e/contracts_137_marketing_posts.sql`):** `marketing_posts` (ผูก content_approvals 1:1) + `marketing_rules` (แอดมินแก้จริง ไม่ hardcode) + RPC `marketing_schedule_post` (**บังคับ approval='approved' — คนเท่านั้นอนุมัติ; ยังไม่ผ่าน = ERR_APPROVAL_REQUIRED**) + `marketing_save_rules` + RLS/GRANT ตามแบบ 135
  - **SQL contract 137 พิสูจน์บน PG จริง:** G1 ตั้งเวลาไม่ได้ถ้ายังไม่อนุมัติ · G2 อนุมัติแล้วตั้งเวลาได้+audit+published แล้วแก้ไม่ได้ · G3 rules บันทึกได้/non-admin ไม่ได้/anon ไม่มี EXECUTE
  - **Queue wiring (ครบตามกติกา G8: allowlist+payload+idempotency ทุกจุด):** `marketing_publish` ใน queue-enqueue (payload template limit 1..50) + queue-dispatcher JOB_TYPES + automation-worker `runMarketingPublish` (เช็ค approval ซ้ำก่อนยิงเสมอ → เรียก `social-publish-worker` ของเดิม → บันทึก provider_post_id/published_at/error+attempts) + scheduler job `hourly-marketing` ใน yml เดิม (ไม่สร้างไฟล์ใหม่)
  - **E5/E6 image-gen EF (`supabase/functions/image-gen/`):** prompt สำเร็จรูป menu/promo/festival (E5) + 3 สไตล์ realistic/illustration/poster (E6) → OpenRouter (`OPENROUTER_API_KEY` server-side ชุดเดียวกับ ai-proxy) → อัปโหลด `site_assets` คืน URL จริง (ใช้กับ Meta publish ได้ทันที) + verify_jwt + เช็ค role=admin จากโปรไฟล์ผู้เรียก
  - **Client:** `src/lib/adminMarketing.ts` (list/create/schedule/rules/best-sellers จาก order_items จริง/stats) + `AdminMarketing.tsx` 7 แท็บ (Overview/Planner/AI Studio/Approval/Calendar/Rules/Analytics) + route `/admin/marketing` + nav item (แก้ทั้ง flat list + group ตาม invariant ของ adminUi.test)
  - เทสต์ใหม่ 19 ตัว `marketingClient.test.ts` (RPC wiring + contract G1-G3 + 7 แท็บของจริง + E5/E6 + queue ครบ 4 จุด + worker เช็ค approval ซ้ำ) + CI step contract 137
- **Verified:** `npx tsc --noEmit`=0 · `npm run lint`=0 · `npm run test`=**1302/1302 (124 files)** (1283+19 ใหม่) · `npm run build`=0 · mojibake=0 · **SQL: apply 137 + contract 137 G1-G3 ผ่านบน PG จริง (Docker ephemeral)** — ⚠ correction 2026-10-23: วัดซ้ำบน HEAD เดิมได้ **1291/1291 (124 files)** = ตัวเลข 1302 คลาดเคลื่อน (โค้ดไม่ได้ถูกแตะ) ใช้ 1291 เป็น baseline
- **Failed/แก้ระหว่างทาง:** (1) contract fixture โดน RLS content_approvals (แก้: fixture insert ฐานะเจ้าของ DB) (2) session role ค้างข้าม DO block (แก้: RESET ROLE ต้น G2/G3) (3) marketingClient assertion ผิด (testid เป็น template ไม่ใช่ literal) (4) adminUi.test invariant flatten(groups)==ITEMS ขาด (แก้: เพิ่ม nav item ทั้งสองที่)
- **Blocked:** 🟢 ปลดล็อกแล้ว — apply 137 ✓ (MIG137-OK) · deploy EF ✓ (image-gen/automation-worker/queue-enqueue/queue-dispatcher = ACTIVE) · secrets ✓ (OPENROUTER_API_KEY + IMAGE_GEN_MODEL) · smoke image-gen = 401 (กัน anon ถูก) · เหลือ runtime evidence: สร้างโพสต์→คนอนุมัติ→ตั้งเวลา→ระบบโพสต์จริงบน Page→Analytics โชว์ provider post id · สร้างภาพ 3 สไตล์ · dispatch งาน → push ถึงไรเดอร์ทุกเครื่อง
- **Files Changed:** `supabase/migrations/137_marketing_posts_rules.sql` (ใหม่) · `e2e/contracts_137_marketing_posts.sql` (ใหม่) · `supabase/functions/image-gen/index.ts` (ใหม่) · `src/lib/adminMarketing.ts` (ใหม่) · `src/pages/admin/AdminMarketing.tsx` (ใหม่) · `src/__tests__/marketingClient.test.ts` (ใหม่) · `supabase/functions/{automation-worker,queue-enqueue,queue-dispatcher}/index.ts` · `.github/workflows/{automation-scheduler.yml,contract-tests.yml}` · `supabase/config.toml` · `src/lib/adminUi.ts` · `src/App.tsx`
- **Tests / Commands Run:** ดู Verified (รวม Docker ephemeral PG apply 137 + contract 137)
- **Known Risks:** (1) จนกว่า deploy EF + apply 137 — แท็บการตลาดบน production จะสร้างโพสต์ไม่ได้ (error ชัด ไม่เงียบ) (2) image-gen ขึ้นกับโมเดล image ของ OpenRouter (ตั้ง IMAGE_GEN_MODEL ให้ถูก) (3) marketing_publish รันรายชั่วโมง — เวลาโพสต์จริงคลาดเคลื่อนได้ ≤1 ชม.
- **Next Exact Action:** ขอ Owner approve: apply 137 + deploy EF 4 ตัว + set secrets → ทดสอบ E2E บน production (โพสต์จริงบน Page + ภาพ 3 สไตล์) → เก็บ evidence · เสร็จแล้ว D1 ปิดโครงการได้ (✅ ทำแล้ว 2026-10-22 — apply+deploy+secrets ครบ, เหลือ evidence)

---

# 🤝 HANDOFF TO NEW CHAT (2026-10-23) — เริ่มจากแผนซ่อม ไม่ใช่งานใหม่

> ⚠ รอบก่อน (2026-10-22) เขียนว่า "D1 DONE" — **ไม่จริง** · ผลทดสอบจริงของ Owner เจอวงจรพังทั้งสาย · ถอนสถานะแล้ว · งานตอนนี้ = ปิด R0-R3 ใน `docs/BMB_RECOVERY_PLAN_2026-10-23.md`

## 0. สถานะจริง ณ 2026-10-23 ปิดเซสชัน (เขียนทับรอบ 2 — ตรง ๆ ไม่แต่ง)
- **🟡 D1 = โค้ดครบทุกข้อ รอทดสอบจริง** — D-01 ✅ DONE (136 ขึ้นโปรดักชั่น+drift repair) · D-02..D-07 = ✅ IMPLEMENTED (โค้ด+เทสต์เขียว 1317/1317) · เหลือแค่ **ทดสอบจริงบน biteme-baby.com + เก็บ evidence R3 = ปิด D1 ได้**
- **เทสต์:** vitest **1317/1317 (126 files)** (baseline 1291 → +26 เคสใหม่ของ R1-R2 ไม่มีลด) · tsc/lint/build = 0 · mojibake = 0
- **บัญชีจริงพร้อมทดสอบ:** แอดมิน · ลูกค้า · ไรเดอร์ "พอล ไบท์ไดรฟ์" (linked) · ออเดอร์ค้างจริง 1 ใบ `BMB-20261023-841` (confirmed+paid — จะโผล่ในบอร์ดมอบหมายแล้วหลัง deploy รอบนี้)
- **ของอ่านอย่างเดียว:** `docs/BMB_HANDOFF_MASTER_2026-10-22.md` · `UNIVERSAL_MASTER_AI_RULES.md` (แก้ได้เฉพาะกฎทั่วไป) · ~~`docs/BMB_DECISIONS.md`~~ **ไม่มีอยู่จริง — ห้ามอ้าง**

## 1. งานต่อไป = ทดสอบจริง + เก็บ evidence (R2.2 + R3 ใน `docs/BMB_RECOVERY_PLAN_2026-10-23.md`)
1. ~~R0 + R1.1 + R1.2-R1.5 + R2.1~~ ✅ ปิด 2026-10-23 (audit → apply 136 → เขียนโค้ดซ่อมทุกข้อ + เทสต์ 1317/1317)
2. **ทดสอบสายเงินจริง:** สั่ง PromptPay → สลิป/TXN เข้า → แอดมินเห็นในแผงตรวจ (ไม่ว่าหน้า/ตัวกรองไหน) → ปุ่มยืนยันทำงาน/ปิดพร้อมเหตุผลไทย · บัญชีอื่นเปิด /payment ต้องเห็น "คนสั่ง = คนจ่าย"
3. **ทดสอบสาย dispatch จริง ×2 รอบติด:** ออเดอร์ paid โผล่บอร์ดทันที (confirmed/preparing) → assign/ประกาศ → "พอล" เห็นงาน → claim (คนแรกจอง) → รับของ → กำลังส่ง → **POD บังคับ** → สำเร็จ → ลูกค้าเห็น ≤20 วิ + timeline/เส้นทาง (heartbeat 136 = ต้องมีแต้มบนแผนที่)
4. **Replay:** กดสั่งซ้ำ → banner "ออเดอร์เดิม/ใหม่" โผล่บน /payment (ไม่เงียบ) · **หน้าตั้งค่า:** social_links ที่เดียว + แก้แล้ว footer ขึ้นจริง
5. **R2.2 status truth walk** ทุกสถานะ × 3 บทบาท (ตารางในแผน §4) → **R3 เก็บ evidence 5 ข้อ + ผล R1-R2 แนบทุกข้อ = ปิด D1 (No Evidence = Not Done)**
6. **ของใหม่ (Marketing Phase 2 / automation rules / Calendar / analytics / job retry / D2 payment / E7) = ยังไม่แตะ** จนกว่า R2.2+R3 ปิด — ตารางเต็มอยู่หัวข้อ HANDOFF ข้อ 2 ด้านล่าง

## 2. เหลือตามสเปกเต็ม (นอก D1 หรือทำบางส่วน — เรียงตามคุณค่า)
| งาน | สถานะจริง | จุดเริ่ม |
|---|---|---|
| Marketing Phase 2: FETCH insights (Meta) → UPDATE planning inputs | ยังไม่ทำ | `social_events` (mig 109) มีแล้ว · `AdminReports.tsx` เดิม |
| Automation rules engine (บังคับ content mix / duplicate-cooldown / stop conditions) | config จริงอยู่ใน `marketing_rules` แล้ว แต่ยังไม่มี engine | ต่อยอด `adminMarketing.ts` + worker |
| Calendar มุมมอง day/week/month แบบเต็ม (C1 #5) | ตอนนี้ = รายการตามเวลา + ตั้งเวลาจริง | `AdminMarketing.tsx` แท็บ calendar |
| Analytics attribution "มีจริง/ไม่มีสิทธิ์" (C1 #7) | ตอนนี้ = ตารางผลโพสต์จริง (provider id/error/attempts) | ผูก `social_events` insights |
| Retry backoff + cancel สำหรับ failed jobs ใน AdminJobs | ยังไม่ทำ (worker เก็บ attempts/error แล้ว) | `adminJobsApi.ts` + jobs view |
| D2 payment: A7 ข. Omise auto-confirm / ค. Stripe | นอก D1 (ก. ทำแล้ว) | `omise-webhook` EF มีอยู่ · ต้อง live key + webhook secret + rollback plan |
| E7 "AI โปรโมตสินค้าได้จริง" (auto-pilot ตาม rules) | บางส่วน: Planner แนะนำสินค้าขายดีจริง + Studio สร้างภาพ | ต่อกับ automation rules engine |
| Push realtime (ตอนนี้ ≤5 นาทีตาม cron) | ยอมรับได้ตามระบบเดิม | ถ้าต้องการ realtime = เรียก push-send จาก trigger แทนรอ cron |
| PART B ตกขอบอื่น ๆ | E2 + M3/M4/M5 เก็บใน D1 แล้ว | ไล่ตามตาราง PART B ใน handoff หลัก |

## 3. ช่องทางทำงาน production (บทเรียนจริงจากเซสชันนี้)
- **Apply migration (ต้อง Owner approve เท่านั้น):** Management API `POST https://api.supabase.com/v1/projects/ivkdfognyiwjcmrhcnwz/database/query` body `{"query":"BEGIN;<ไฟล์>;COMMIT;"}` · token = `SUPABASE_ACCESS_TOKEN` ใน `.env.local` (ห้าม print)
- **Deploy EF (ต้อง Owner approve):** `npx supabase functions deploy <name> --project-ref ivkdfognyiwjcmrhcnwz` (อ่าน config.toml เอง) — **เว็บ auto-deploy แต่ EF ไม่** · แก้ EF แล้วต้อง deploy เสมอ
- **Set secrets (ต้อง Owner approve):** `POST /v1/projects/{ref}/secrets` body เป็น **array** `[{"name":"...","value":"..."}]` (object = error)
- **SQL contract ก่อนขึ้นจริง:** Docker `postgres:16` + `e2e/ci/apply_all_migrations.sh` (ต้อง `tr -d '\r'` ก่อน) → รัน `e2e/contracts_*.sql` (ROLLBACK ทุกไฟล์) · `schema_migrations` ไม่มีใน public → **ห้ามใช้ `db push`** (จะยิงทุกไฟล์)
- **CI:** `contract-tests.yml` = replay + contracts 123/124/127-130/131/133/135/136/137 · ดูผลบน GitHub web (ไม่มี `gh` CLI)

## 4. กติกา/บทเรียนห้ามลืม (สรุปจากของจริง)
1. **ไทยห้ามผ่าน shell เด็ดขาด** — เขียน/อ่านเนื้อหาผ่าน editor/read_files เท่านั้น (console codepage เพี้ยนใน output; ถ้าเขียนไฟล์ผ่าน shell = เพี้ยนจริง)
2. แก้ไฟล์ผ่าน editor · **preserve BOM เดิม** (เช่น MenuPage.tsx) · เช็ค `git diff` ว่าหัวไฟล์ไม่ขยับ · สแกน mojibake ทุกไฟล์ที่แตะ (`[\u00e0-\u00ef][\u00b0-\u00bf]` + UTF-8 strict + `\u0eXX` escape + read-back)
3. Vitest include = `.js/.ts` ล้วน — component tests ใช้ `React.createElement` ใน `.ts` หรือ source-scan ด้วย `?raw`
4. **เทสต์ห้ามลดจำนวน** · แก้ fixture ที่พังได้แต่ห้ามลบเทสต์ · assertion อย่าเช็ค literal ของ template string (`mk-tab-${id}` ≠ 'mk-tab-overview')
5. invariant ต้องเช็คทั้งสองฝั่ง (เช่น `ADMIN_NAV_ITEMS` == flatten(`ADMIN_NAV_GROUPS`)) · แก้ nav/รายการต้องแก้ทุกที่ที่ invariant ผูก
6. Commit อังกฤษ · คำสั่งยาวทำ PSReadLine crash — แบ่งสั้น/เขียนผลลง `_tmp_*.txt` (อยู่ใน .gitignore) แล้วอ่าน
7. **production:** push main = เว็บ (loop ปกติ) · migration/EF/secret = ต้อง Owner approve · ทดสอบ production จริงเท่านั้น (ห้าม mockup/hardcode/stub/dead code) · เหลือ 3 บทบาท แอดมิน/ลูกค้า/ไรเดอร์ แยกเส้นเด็ดขาด · เส้นทางจริงทั้งหมด
8. ปุ่มเดียวกันห้ามมีสองที่ — แต่ละ transition เจ้าของปุ่มเดียว + deep-link · คำ/ปุ่มต้องตรงสถานะจริง ("ถึงปลายทาง" ≠ "ส่งสำเร็จ")
9. contract fixture ห้าม hardcode พิกัด (derive จาก `kitchen_location()`) · fixture insert ฐานะเจ้าของ DB (role ใช้ตอนเรียก RPC) · `RESET ROLE` ต้นทุก DO block
10. `AI_WORK_STATE.md` = single source of truth — อัปเดตทุกก้อนงาน · กติกาเต็ม: `.clinerules` + `docs/BMB_HANDOFF_MASTER_2026-10-22.md` (อ่านอย่างเดียว)
11. **ห้ามเขียน "DONE" ถ้า Owner ยังไม่ได้ทดสอบของจริงผ่าน** (2026-10-23) — งานโค้ดเขียว = "IMPLEMENTED" เท่านั้น · ข้อมูลในเอกสารต้องไม่ค้าง (เช็ค HEAD/ของจริงก่อนเขียนเสมอ) · ห้ามอ้างไฟล์ที่ไม่มีอยู่จริง

---

## ⚡ TASK: RIDER-E2E-PRODUCTION-CLOSURE-2026-10-20 — Rider PWA ใช้งานจริง + Map + Portal entry (คำสั่ง Owner 20 ต.ค.)
- **STATUS: 🟡 IMPLEMENTED + ทดสอบ local/DB ครบ — รออนุมัติ production apply + E2E จริง** (รายละเอียดเต็ม: `docs/BMB_RIDER_E2E_CLOSURE_2026-10-20.md`)
- **A1:** /rider polling `my_deliveries` ทุก 25 วิ + รีเฟรชเอง/last-updated/error-retry + งานใหม่ (badge+เสียง WebAudio เปิด/ปิด) + กัน polling ซ้อน/หยุดหลัง logout (ไม่ใช้ Realtime)
- **A2:** push ฝั่งไรเดอร์แยก audience ชัด (`push_subscriptions.driver_id` + `register_push_subscription(p_audience)` + `claim_push_driver_targets` service_role) · automation-worker ยิง "มีงานใหม่→/rider" เฉพาะงาน `assigned` ที่ยังไม่ push (`rider_pushed_at` claim กันซ้ำ) · push พังไม่แตะ order/assignment (polling=fallback) · ปุ่มเปิด/ปิด push ในหน้าไรเดอร์
- **A3:** bucket `pod-photos` (private) + `driver_attach_pod` (path ต้องอยู่โฟลเดอร์ตน) + **`delivered` ต้องมี POD** (ERR_POD_REQUIRED) · client บีบอัด+ตรวจขนาดก่อน upload · แอดมินเห็นรูป (signed URL) ใน /admin/delivery หลัง refresh
- **A4:** `driver_decline_assignment`/`admin_cancel_assignment` (เหตุผล+audit, ไม่ลบแถว) + trigger ปิดงานค้างเมื่อออเดอร์ cancelled/failed + assign_driver reset POD/decline/cancel ตอนมอบหมายใหม่
- **A5:** action คืน `{ok,error,network|permission|state}` + retry เฉพาะ network + กดซ้ำไม่ได้ — เลิก boolean เงียบ
- **Map:** `RiderMiniMap` (จุดปัก ปลายทาง/คุณGPS/ครัว แยกชนิด) + `getGoogleMapsLoadError()` บอกสาเหตุจริง (missing key/key ถูกปฏิเสธ/เครือข่าย) + ตรวจแล้วไม่มี lat/lng สลับ
- **ADDENDUM:** ปุ่ม "งานจัดส่งของฉัน (ไรเดอร์)" ใน Header/Profile (server-verified — คนทั่วไปไม่เห็น) + ปุ่ม "เปิดหน้าไรเดอร์" ใน /admin/delivery + ข้อความ "ยังไม่ถูกผูกบัญชี ติดต่อแอดมิน" ที่ /rider
- **EVIDENCE (fresh 20 ต.ค.):** tsc/eslint 0 · vitest **1205/1205** (เพิ่ม driverActionResults 9 + dbRestoreDrill 3) · build PWA ผ่าน · replay **001–132** สะอาดบน PG17 · `contracts_132` G1–G6 ผ่าน · `contracts_036` ผ่านทุกกลุ่ม (ซ่อม fixture ค้างก่อน 041 + POD gate) · 127-130/131 regression ผ่าน · probe ยืนยัน 126–130 recorded บน production
- **ข้อค้นพบสำคัญ:** (1) migration **131 ไม่ได้ record ใน schema_migrations** (objects ทำงานจริงแล้ว — drift ต้อง repair เมื่ออนุมัติ) (2) restore drill ไม่เคยมี → เพิ่ม `scripts/dbRestoreDrill.mjs` (sha256+structure+guard ห้ามชี้ prod; รันจริงต้องใช้ service-role secret) (3) contract 036 เดิมไม่ผ่านจริงบน stack 041+ (fixture ไม่ผูก JWT) — ซ่อมแล้ว
- **ขออนุมัติ:** apply `132_rider_pod_push_decline.sql` + deploy `automation-worker`/`push-send` + `supabase migration repair` 131 · **ห้ามประกาศ E2E PASS จนกว่าจะทดสอบจริงหลัง deploy**
- **รอบแก้ 2 (บ่าย 20 ต.ค. — Owner สั่ง):** (1) CI #502 แดง TS7016 = ผมเพิ่ม test import `.mjs` หลังรัน build → เพิ่ม `scripts/dbRestoreDrill.d.mts` แล้ว `npm run build` ผ่าน (2) หน้าแรก `/` (landing ไม่มี Header) หาปุ่มไม่เจอ → เพิ่มปุ่มใหญ่ "เข้าสู่ร้าน"/"เข้าสู่ระบบ"/"🛵 งานจัดส่งของฉัน (ไรเดอร์, server-verified)" ใน `TalkToBite.tsx` (3) "ภาษาต่างดาว" = mojibake เก่า (ตั้งแต่รอบ 118) ใน e2e/docs ที่โผล่ในหน้า commit — `src/` สะอาด 0 จุด; ซ่อมแล้ว 17 ไฟล์ เหลือ 3 (migrations 106/109/112 ที่ apply แล้ว ไม่แตะกัน drift) · Gates รอบนี้: tsc/eslint 0 · vitest 1208/1208 · build ผ่าน · replay 001–132 exit 0 · contracts 132/036/127-130/131 exit 0 ทั้งหมด

---

## ⚡ TASK: CUSTOMERS-VISIBLE-ON-REGISTER-2026-10-20 — ลูกค้าลงทะเบียนแล้วชื่อไม่เข้าระบบ (คำสั่ง Owner 20 ต.ค.)
- **STATUS: ✅ CLOSED — ชื่อขึ้นหน้า /admin/customers แล้ว (verify บน production ครบ)**
- **Root cause (2 จุด):** (1) `handle_new_user()` (006) สร้างแค่ `profiles` — หน้าลูกค้าอ่านตาราง `customers` ซึ่ง signup ไม่เคยเขียน (0 แถว) → คนลงทะเบียนไม่เคยขึ้น list (2) หน้ารวมนับ `public_profiles` (VIEW ไม่มีคอลัมน์ role) → `u.role ?? 'customer'` นับทุกคนรวมแอดมิน/สต๊าฟเป็น "ลูกค้า 3" ซึ่งหลอกตา
- **Fix:** migration **131_register_user_to_customers.sql** — `handle_new_user()` upsert `customers` ด้วย convention เดียวกับ 017 (`id`=uid text, `user_id`=uid) + **backfill** ผู้ใช้ที่มีอยู่ · ON CONFLICT เติมเฉพาะช่องว่าง (ไม่ทับชื่อ/เบอร์/อีเมลเดิม) · `getDashboardStats` (bmbAdminApi_users.ts) นับจากตาราง `customers` จริง
- **EVIDENCE:** replay 001–131 ผ่านบน PG17 (docker) · contract `e2e/contracts_131_register_customers.sql` (trigger + key convention + name fallback) + contracts 127–130 ผ่าน · backfill พิสูจน์ใน harness · **production:** apply 201 + verify `customers_rows=3, matched_profiles=3, trigger_ok=1, fn_has_customers=true` — ชื่อจริงขึ้นครบ (ADMIN_BMB / Pual bite drive / Customer) · gates lint/tsc/vitest/build 0 · commit `c89db34`
- **หมายเหตุ:** ตั้งแต่นี้ทุกบัญชีที่ลงทะเบียน (หรือแอดมินเพิ่มผ่าน Supabase Auth) จะมีแถว `customers` อัตโนมัติ — หน้าลูกค้าใช้โค้ดเดิมเห็นทันทีโดยไม่ต้อง deploy (dashboard ตัวเลขนับจะตรงเป๊ะหลัง auto-deploy) · แถว customers = ทุกบัญชีในระบบ (รวม staff/admin เพื่อให้ตัวเลขหน้ารวมกับหน้าลูกค้าตรงกัน)

---

## ⚡ TASK: BACKUP-TO-SUPABASE-STORAGE-2026-10-19 — ย้าย Backup พ้น GCP + apply migrations ขึ้นโปรดักชั่น (คำสั่ง Owner 19 ต.ค.)
- **STATUS: ✅ CLOSED สมบูรณ์ — daily-backup run #6 เขียวจริงบน production (19 ต.ค. ~20:02 น. เวลาไทย, commit 5fb1447)**
- **เหตุผล:** GCP Organization Policy "Secure by Default" บล็อกการสร้าง Service Account Key JSON → ตัด GCP ออกทั้งระบบ
- **สิ่งที่ทำ:**
  - **`scripts/dbBackup.mjs`** (แทน gcsBackup.mjs ที่ลบแล้ว): pg_dump→gzip→**Supabase Storage bucket `db-backups`** (REST + service-role key `sb_secret_…` ต้องส่ง **2 headers** apikey+Authorization) · **size+sha256 ก่อน upload** + **ดาวน์โหลดกลับมาเทียบ byte-for-byte หลัง upload** (fail closed) · `--verify` ตรวจ manifest hash + มีไฟล์ .sql.gz + **bucket ต้องเป็น private** · retention 30 daily/12 monthly เดิม · `PGDUMP_CMD` override (คู่มือ docker pg_dump)
  - **workflow `daily-backup`:** secrets = `SUPABASE_SERVICE_ROLE_KEY` + `BMB_DATABASE_URL` (ลบ GCS_SERVICE_ACCOUNT_JSON) · pg_dump 17 จาก PGDG (server = PG 17.6) · step verify หลัง backup เสมอ · cron 07:30 น. เวลาไทย + manual dispatch (mode backup|verify)
  - **Production:** bucket `db-backups` = **Private + limit 50MB** แล้ว · **apply migrations 126–130** (126 ค้างอยู่ด้วย — track เดิมถึง 125) + บันทึก schema_migrations ครบ · verify: tables/functions/enum/columns/RLS/functional smoke ผ่านทั้งหมด
  - **Pipeline test จริงก่อน push:** stub dump → upload → verify hash → `--verify` ผ่าน (manifest hash ตรง + .sql.gz อยู่จริง + bucket private) → ลบไฟล์ทดสอบจน bucket สะอาด
  - **เอกสาร:** checklist ไทย `docs/BMB_OWNER_PRODUCTION_TEST_CHECKLIST_2026-10-19.md` (8 หมวด: pickup/delivery/POS/พิมพ์/ปิดยอด/ชำระเงิน/หลังบ้าน/backup + กติกาข้อมูล) · อัปเดต closure doc
- **EVIDENCE:** vitest dbBackupHelpers 8/8 (เพิ่ม size gate tests) · lint/tsc/build ผ่านรอบ commit · production query verify ครบ (enum pickup, role CHECK staff, RLS 4 policies, fee=0, handover matrix) · **run #6 SUCCESS:** secret shape len=114 (Session pooler URI) · pg_dump binary 17.11 (PGDG, bypass pg_wrapper ที่จะเลือก 16.15) · ไฟล์จริง `db/bmb-db-*.sql.gz` + `manifest.json` ใน bucket · post-backup verify (hashes+.sql.gz+private) ผ่านบังคับ · แก้ครบ 5 รอบ: annotation→validator→Session pooler→pin pg_dump 17→เขียว
- **หมายเหตุสัตย์จริง:** `npx supabase db push` ติดที่ต้องใช้รหัสผ่าน DB (ไม่มีในเครื่อง) → apply ผ่าน **Supabase Management API** (access token ของ Owner เอง) = ผลเทียบเท่า (SQL เดียวกัน + บันทึก history แบบเดียวกัน) · ถ้าต้องการรันคำสั่งเดิมเป๊ะ: ใส่รหัสผ่านลง `.dbpw.tmp` แล้วรันได้ทันที (ระบบจะขึ้น "already up to date")

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
- `docs/BMB_RECOVERY_PLAN_2026-10-23.md` — **แผนซ่อมปัจจุบัน (R0-R3 · D-01..D-08 · H-01..H-04) — อ่านก่อนเริ่มงานทุกครั้ง**
- `docs/BMB_HANDOFF_NEXT_SESSION_2026-10-17-EVE.md` — handoff ปัจจุบัน (สถานะ + E2E Checklist §3 + Blocker §4)
- `src/config/kitchenLocation.ts` — พิกัดครัว single source (ห้าม hardcode ที่อื่น)
- `BMB_SAME_DAY_PRE_ORDER_MASTER_PLAN.md` + `PHASE_CONTRACTS` + `EVIDENCE_LOG` + `REGRESSION_MATRIX` — กติกาเดิม (phases 0-6 ปิดแล้ว)
