# BMB MASTER HANDOFF — 2026-10-22 (นำไปทำต่อในแชทใหม่)

> สถานะตอนเขียน: `origin/main = 2cbf203` (CI เขียวทั้ง workflow — migrations 001–134 + contracts 123/124/127–130/131/133 ผ่านบน ephemeral PG จำลองเหมือน CI) · production = `biteme-baby.com` (auto-deploy จาก main)
> เอกสารนี้คือ **แผนงาน + หลักฐานจากซอร์สจริง** — รอบนี้ไม่มีการแก้โค้ด ("ห้ามโค้ด" ตามคำสั่ง Owner)
> กติกาเหล็ก §0 ใช้ทุกงานในแชทหน้า — ห้ามละเมิดแม้แต่ข้อเดียว

---

## 0. กติกาเหล็ก (คัดจากคำสั่ง Owner)

1. ตรวจซอร์สจริงบน `origin/main` + commit จริงก่อนเสมอ — ห้ามเชื่อ README / audit / status doc โดยไม่มีหลักฐาน implementation
2. สำรวจระบบที่มีอยู่ก่อนแก้ — ห้ามสร้าง Scheduler / Queue / Dispatcher / Worker / AI service / Admin page ซ้ำ ถ้าของเดิมต่อยอดได้
3. **ห้ามทำงานซ้ำกับงานประเภทเดียวกัน — รวมไฟล์/ปรับปรุงต่อ ห้ามทำเพิ่ม** (แผนรวม = §2)
4. ห้ามเปลี่ยน logic ธุรกิจ order/payment/inventory/promotion/pricing/delivery/refund โดยไม่ได้รับอนุมัติ Owner
5. ห้าม mock/stub/fake อ้างว่าฟีเจอร์ทำงานจริง · ห้าม hard-code เมนู/แบรนด์/โปรโมชัน/ค่าตั้ง
6. ห้ามเผย secrets / service-role / automation tokens / ข้อมูลลูกค้า
7. ห้าม deploy production / เปลี่ยน production secrets โดยไม่ได้รับอนุมัติ (apply migration ต้อง Owner approve เท่านั้น)
8. ทุก push ต้องผ่าน gates ก่อน (§4) · ห้ามประกาศ PASS โดยไม่มี runtime evidence
9. ทดสอบจริงทุกเส้นทาง: ลูกค้า → ชำระเงิน/สลิป → dispatch → ไรเดอร์ → ส่งมอบ ต้องจบครบวงจร
10. รายงานมือถือ/แอดมิน/ไรเดอร์แยกกันชัดเจน พร้อมสิ่งที่ยังติดสิทธิ์ภายนอก (Meta / credentials / Omise)

---

## PART A — บั๊กจากทดสอบจริง 3 อุปกรณ์ (2026-10-22) · หลักฐานซอร์ส + แผนแก้

> ทุกข้อ = [อาการ] → [หลักฐาน ไฟล์:บรรทัด] → [สาเหตุ] → [แผนแก้แบบรวม ไม่สร้างใหม่] → [หลักฐานที่ต้องเก็บตอนทดสอบ] · **ยังไม่ได้แก้ไข — ทั้งหมดคือแผน**

### A1. ลูกค้า — โค้ดส่วนลดซ้ำซ้อน + กด "ใช้โค้ด" แล้วไม่ได้โค้ด
- หลักฐาน:
  - `src/pages/PromotionsPage.tsx:84-106` `handleUseCode` ใช้ `navigator.clipboard.writeText` **อย่างเดียว** ไม่เรียก `setCouponCode` เข้า cart store → ต้องพิมพ์เองตอนจ่ายเงิน; และถ้า clipboard ใช้ไม่ได้ (WebView/มือถือ/ไม่ใช่ https) เส้น fallback ยัง **toast "คัดลอกแล้ว" ทั้งที่ไม่ได้ก้อบ**
  - UI โค้ดซ้ำซ้อนจริง: `src/pages/CartPage.tsx:33-58,126-154` (ช่องโค้ด+ใช้+ลบ) **และ** `src/pages/CheckoutPage.tsx:102-146` (ชุดเดียวกันอีกรอบ) + gate ซ้ำ L520-530
  - เครื่องคำนวณจริงมีตัวเดียว = `src/lib/promotionClient.ts` (`evaluateCoupon`) — ใช้ร่วมกันแล้ว ✅
- แผนแก้: **CouponBox component เดียว** ใช้ทั้ง Cart+Checkout (ลบ UI ซ้ำ) + `handleUseCode` ต้อง apply เข้า `useCartStore.setCouponCode`+`setAppliedPromotion` ทันที (clipboard = bonus; fallback แสดงโค้ดบนจอ ไม่ใช่ toast ปลอม) + deep-link `/menu?code=X` auto-apply
- เก็บหลักฐาน: กด "ใช้เลย" บน Android/iOS → เข้า checkout แล้วโค้ดอยู่ในช่อง + ส่วนลดตรงกับโปรโมชันจริง

### A2. แอดมิน — ไม่เห็นสลิปที่ลูกค้าอัปโหลด
- หลักฐาน:
  - ฝั่งโชว์มีจริง: `src/components/admin/SlipThumb.tsx` ใช้ใน `AdminOrders.tsx:361` + `AdminPaymentExceptions.tsx:117` — แต่ SlipThumb **เงียบเป็น "—" ทุกกรณีที่พลาด** (L30 `catch { /* keep empty */ }`, L37 ถ้าไม่มี url/ref → "—") ไม่มี error ให้เห็นว่าพังตรงไหน
  - สายข้อมูล: `getPaymentIntents({orderNumber})` (`paymentGateway.ts:354-362` query `payment_intents.order_number`) → `find(i => i.slip_path)` → `getPaymentSlipSignedUrl` (storage RLS)
  - ฝั่งลูกค้าอัปโหลดผ่านจริง: `PaymentConfirmationPage.tsx:64-117` (`uploadPaymentSlip` → RPC `submit_payment_slip` mig 133)
  - หน้า Payment Exceptions ที่พี่แคป = "ไม่พบ payment intent" (เช่น BMB-20261019-405) → **มีออเดอร์ที่ไม่มี payment_intents row เลย**
- สาเหตุที่ต้องยืนยันในแชทหน้า (เรียงตามน่าจะเป็น):
  1. `payment_intents.order_number` ว่าง/ไม่ตรงจากบางเส้นสร้าง (client `createPaymentIntent` vs RPC `create_payment_intent_record`) → query ฝั่ง admin ได้ 0 row
  2. admin SELECT policy บน `payment_intents` / storage `payment-slips` (mig 133 `is_admin()`) ไม่ผ่านสิทธิ์จริง → signed URL ไม่ออก
  3. intent หลาย row/ออเดอร์ (self-heal `PaymentConfirmationPage.tsx:38-44`) แล้วสลิปอยู่คนละ row กับที่แสดง
- แผนแก้: **แผงตรวจสลิปเดียว** ใน AdminOrders (SlipThumb + ปุ่ม `confirm_offline_payment` เดิม) + SlipThumb โชว์สถานะ error ชัดแทน "—" เงียบ + ทำให้ทุกออเดอร์มี intent row (ฝั่ง RPC เดิมเขียน — ห้ามแตะ logic เงินเอง)
- เก็บหลักฐาน: ลูกค้าอัปโหลด → แอดมินเห็น thumbnail ≤30 วิ + เปิดรูปเต็มได้ + กดยืนยันแล้วสถานะลูกค้าเปลี่ยน

### A3. แอดมิน — ค่าขนส่ง/ค่ากำหนดอื่น ๆ ไม่ถูกใช้จริง
- หลักฐาน:
  - checkout ใช้ RPC เดียว: `CheckoutPage.tsx:281-331` → `fetchServerDeliveryFee({dropoff, distanceKm: haversine(KITCHEN_POINT), itemsCount})` (comment L307-309 "ค่าส่งต้องซิงค์กับที่แอดมินตั้ง" → เลือก zone จาก `delivery_zones`) + **server re-derive ซ้ำใน create RPC** (L523-534)
  - fallback "local-mirror" (`feeSource: 'server'|'local-mirror'|'error'` L152-153) — ถ้า RPC พังจะใช้สูตรฝั่ง client → ค่าอาจไม่ตรงที่ตั้ง
  - mig `134_kitchen_fee_sync.sql` (apply แล้ว) = kitchen location + fee sync — **ยังไม่ยืนยันว่าช่องค่าส่งใน AdminSettings เขียนลงตารางเดียวกับที่ RPC อ่าน (`delivery_zones`) หรือไม่**
- แผนแก้: ตรวจเส้นเขียนของ AdminSettings → ต้องลง `delivery_zones` (canonical เดียว) + ให้ RPC 020/134 คำนวณแหล่งเดียว (ตัด local-mirror หรือติดป้าย "โดยประมาณ") + โชว์ `feeSource` บน checkout + ตรวจค่ากำหนดอื่น (rounds/capacity/lead days) แบบเดียวกันกับ `order_policy`/`delivery_rounds`
- เก็บหลักฐาน: เปลี่ยนค่าโซนในแดชบอร์ด → สั่งจริงในรัศมีนั้น → ยอดลูกค้า = ค่าที่ตั้ง ±0 = ยอดที่แอดมินเห็น

### A4. แอดมิน — กด "Ready to dispatch" แล้วไรเดอร์ไม่เห็นงาน / ไรเดอร์รับงานไม่ได้
- อาการ: ready to dispatch → ไรเดอร์ว่างเปล่า · กด dispatch → ลูกค้าเปลี่ยนจริง ✅ · รับงานไม่ได้
- หลักฐาน (สถาปัตยกรรมจริง = **มอบหมายงาน** ไม่ใช่ "งานว่างให้แย่งรับ"):
  - ไรเดอร์เห็นเฉพาะ `myDeliveries()` = `delivery_assignments` ของตัวเอง (`src/lib/driverService.ts:92-113`) — **ไม่มี API งานว่างเลย**
  - งานจะเข้าตาไรเดอร์ต้องมี row ใน `delivery_assignments` ผ่าน **`assign_driver` RPC** (mig 020/125; `driverService.ts:262-263`) — ปุ่มอยู่ที่ **`DeliveryManagement.tsx:136-151,411-418` เท่านั้น**
  - ปุ่ม Ready/Dispatch ใน AdminOrders มาจาก `src/lib/adminOrderDisplay.ts:20-41` (transition map) — **ไม่สร้าง assignment** → ไรเดอร์ไม่เห็นอะไรจนแอดมินไปมอบหมายที่หน้า DeliveryManagement
  - รับงาน = `driverAcceptAssignment` (`driverService.ts:113`) — ไม่มี assignment row = ไม่มีอะไรให้รับ
  - จอพี่: badge **"unassigned"** คู่สถานะ "arrived" — state machine ปล่อยออเดอร์เดินหน้าโดยไม่มีคนส่ง
- แผนแก้: **รวมศูนย์สั่งงานจัดส่งเป็นหน้าเดียว** (§2 M4) + flow เดียว: `พร้อมส่ง` ต้องผูกไรเดอร์ (assign_driver) ก่อน/พร้อมกัน ห้าม dispatched ตอน `unassigned` + พอร์ทัลไรเดอร์โชว์ "งานที่มอบหมายมาให้รับ/ปฏิเสธ" (driverAcceptAssignment ใช้กับงานที่ assign มา) + ปุ่มครบในหน้าเดียว: มอบหมาย → ไรเดอร์รับ → dispatch → ถึงปลายทาง → ส่งมอบ
- เก็บหลักฐาน: มอบหมาย → ไรเดอร์เห็น ≤25 วิ → รับ → ถึงปลายทาง → POD → ลูกค้า "ส่งสำเร็จ" จบวงจร

### A5. ลูกค้า — สถานะ "กำลังจัดส่ง" ซ้ำ 2 ช่อง
- หลักฐาน 2 ชั้น:
  1. `src/pages/OrderTrackPage.tsx:25-26` — `dispatched` กับ `in_transit` **label "กำลังจัดส่ง" เหมือนกันเป๊ะ** (icon เดียวกัน) → timeline 8 ช่องมีซ้ำ 2 ช่อง
  2. ระบบ timeline มี **2 ชุด 2 คำศัพท์**: `OrderTrackPage.TIMELINE` (enum จริง pending…delivered) vs `src/components/customer/CustomerTimeline.tsx` + `src/lib/orderStateMachine.ts` (ชุดเก่า Created/Accepted/…/Batch Production)
- แผนแก้: **รวมเหลือ timeline เดียว** ขับด้วย `orderVocabulary.ts` (mapper จริง↔flow ที่มีอยู่แล้ว) ดูด/เลิกใช้ `CustomerTimeline`+`orderStateMachine` + fix label `dispatched`="เริ่มจัดส่ง" / `in_transit`="กำลังเดินทาง" (หรือแสดงเป็นขั้นเดียว)
- เก็บหลักฐาน: track ออเดอร์จริงทุกสถานะ — ห้ามมี label ซ้ำ, ตรงกับที่แอดมิน/ไรเดอร์เห็น

### A6. กด "ถึงปลายทาง" → แอดมินขึ้นสำเร็จ แต่ลูกค้ายังไม่จบ
- หลักฐาน:
  - ปุ่มแอดมิน = `adminAdvanceDelivery` (`driverService.ts:276`) + map `adminOrderDisplay.ts` — ต้องยืนยันว่าทุกปุ่มเขียน **`orders.status` + `order_status_history` + `delivery_assignments`** ใน RPC เดียว (ห้ามปุ่มไหนเขียนแค่ตารางเดียว)
  - ลูกค้า `OrderTrackPage` = poll 20 วิ (L31) + โชว์ "ส่งสำเร็จ" เมื่อ `status === 'delivered'` เท่านั้น (L319) — ถ้ากด "ถึงปลายทาง" (arrived) ลูกค้าค้าง arrived โดยเจตนา แต่ปุ่ม/ข้อความแอดมินบอก "สำเร็จ" = คำ/flow หลอก
- แผนแก้: ใช้ `adminAdvanceDelivery` เป็นทางเดียวของทุกปุ่ม + ข้อความปุ่มตรงสถานะจริง ("ถึงปลายทาง" ≠ "ส่งมอบสำเร็จ") + 'delivered' ต้องเขียนครบ 3 ตาราง + ลูกค้าเห็น ≤1 poll + ทดสอบ matrix ปุ่ม×หน้า (แอดมิน/ลูกค้า/ไรเดอร์)
- เก็บหลักฐาน: ตารางเทียบ ปุ่มที่กด → สถานะที่ 3 หน้าเห็น (ต้องตรงกันทุกช่อง)

### A7. "ไม่เชื่อมการชำระเงินจริง"
- ความจริงจากซอร์ส: ปัจจุบัน = **PromptPay QR + โอนจริง + สลิป + แอดมินยืนยัน (manual)** + การ์ดผ่าน Omise (test mode ตาม key) — ตั้งใจเป็น evidence flow ไม่ใช่ auto-charge
- ช่องโหว่จริงที่ต้องปิด: (1) ออเดอร์บางตัวไม่มี payment_intents row (A2) — checkout ต้องสร้าง intent ทุกออเดอร์ (2) ถ้าจะ "จ่ายจริงจบในหน้าเดียว" ต้องใช้ provider — **ต้องเลือก+อนุมัติก่อน (กติกาข้อ 4)**
- ทางเลือก (ต้องตอบก่อนเริ่มเขียน):
  - **ก.** คง manual (สลิป+ยืนยัน) แต่ปิด intent หาย + รวม UI ตรวจสลิป (งานน้อย ไม่แตะ logic เงิน)
  - **ข.** ต่อ Omise PromptPay/บัตร auto-confirm webhook (กลาง, ต้อง live key + webhook secret + rollback plan)
  - **ค.** ต่อ Stripe (ใหญ่, เปลี่ยน provider กลางทาง)
- เก็บหลักฐาน: ทุกออเดอร์มี payment_intents ≥1 เสมอ + ถ้าเลือก ข/ค ต้องมีหลักฐาน charge จาก provider dashboard (ห้ามอ้างจาก UI)

### A8. ไรเดอร์ — "ระบบไม่สมบูรณ์ รับงานไม่ได้"
- ต่อยอด A4: `RiderPwaPage.tsx` ปัจจุบัน = myDeliveries + ปุ่มรับ/ปฏิเสธ/POD/แจ้งเตือน — ขาด "งานมอบหมายใหม่" ที่เด่นชัด + จอพี่แสดงชื่อ "พ่อ ไม้โทรัพพ์" (fallback/ชื่อผิดจาก `drivers.name`?) — ตรวจอีกทีตอน assign จริง
- แผนแก้: รวมพอร์ทัลไรเดอร์ชุดเดียว (§2 M3) + states ครบ: งานใหม่(รับ/ปฏิเสธ) → กำลังส่ง → ถึงปลายทาง → POD(บังคับรูป) → ส่งมอบ + ชื่อ/สถานะจาก `drivers` จริง + push ตอน assign (ใช้ `push-send`+`automation-worker` เดิม)

---

## PART B — แผนรวมไฟล์/หน้าซ้ำซ้อน (กติกาข้อ 3: รวม+ปรับปรุง ห้ามเพิ่มของใหม่ซ้ำประเภทเดิม)

> หลักการ: ทุก M-item = ดูดฟังก์ชันเข้าของเดิม → ย้าย import → ลบของซ้ำ → พิสูจน์ด้วยเทสต์+runtime เดิมทุกตัว ห้ามทิ้งหน้าผีไว้สองทาง

| # | ของซ้ำที่เจอ (หลักฐานจริง) | รวมเข้า (ตัว canonical) | วิธีรวม |
|---|---|---|---|
| **M1 Timeline ลูกค้า** | `OrderTrackPage.tsx` TIMELINE + `components/customer/CustomerTimeline.tsx` + `lib/orderStateMachine.ts` (chain คนละคำศัพท์) | `lib/orderVocabulary.ts` (mapper จริง↔flow มีอยู่แล้ว) + component timeline ตัวเดียว | สร้าง `components/customer/OrderTimeline.tsx` ตัวเดียวขับจาก enum จริง (label ไม่ซ้ำ — fix A5) → OrderTrackPage เรียกตัวนี้ → CustomerTimeline/orderStateMachine เลิกถูก import (เหลือ type ถ้าจำเป็น) |
| **M2 คูปอง** | ช่องโค้ด+ปุ่มใช้ซ้ำใน `CartPage.tsx` & `CheckoutPage.tsx` + `PromotionsPage.handleUseCode` คนละทาง | `lib/promotionClient.ts` (engine เดิม) + `components/CouponBox.tsx` (ใหม่ตัวเดียว — UI ไม่ใช่ระบบ) | CouponBox ตัวเดียวใช้ 2 ที่; `handleUseCode` apply เข้า cart store + clipboard bonus; ตรรกะ validate ที่ Checkout L520-530 ย้ายเข้า CouponBox เรียกจากที่เดียว |
| **M3 พอร์ทัลไรเดอร์** | `pages/RiderPwaPage.tsx` + `components/dashboard/RiderPWA.tsx` + `components/rider/RiderMiniMap.tsx` | `pages/RiderPwaPage.tsx` (route จริง) | ดูด UI ที่ดีของ RiderPWA เข้าหน้าจริง → ลบ component ซ้ำ; RiderMiniMap เป็น sub-component ของหน้าเดียว |
| **M4 ศูนย์จัดส่งแอดมิน** | ปุ่มสั่งงานกระจายอยู่ใน `AdminOrders.tsx` (transition map `adminOrderDisplay.ts`) + `DeliveryManagement.tsx` (assign_driver) + `RouteOptimizationPage.tsx` (driver status) + `kitchenQueueView.ts` | หน้า `DeliveryManagement` เป็น **Dispatch Center เดียว** | ย้ายปุ่มมอบหมาย+advance ทั้งหมดเข้า Dispatch Center; AdminOrders เหลือ "ดู/ค้น/จัดการออเดอร์" + deep-link มา Dispatch; RouteOptimization เหลือเครื่องมือวางเส้นทาง (อ่านอย่างเดียว) — ปุ่มเดียวกันห้ามมีสองที่ |
| **M5 การชำระเงินฝั่งอ่าน** | `paymentExceptions.ts` (query payment_intents เอง) + `paymentGateway.ts` (getPaymentIntents) + SlipThumb self-fetch | `paymentGateway.ts` เป็น service เดียว | paymentExceptions ย้ายมาใช้ `getPaymentIntents` ตัวเดียวกัน; SlipThumb รับ props intents จากพ่อแม่ (เลิก self-fetch ซ้ำ) |
| **M6 หน้าติดตาม/ทางเข้า** | `OrderTrackPage` + `trackingApi.ts` + ลิงก์จาก `PaymentConfirmationPage`/`OrdersPage`/`ProfilePage` + `CustomerTimeline` | `/track/:orderNumber` เดียว | คง route เดียว รวม logic ตรวจสิทธิ์ (owner RLS vs guest phone RPC) ไว้ใน `trackingApi.ts` ตัวเดียว |

ลำดับทำ: **M1 → M2 → M5 → M4 → M3 → M6** (M1/M2 แก้บั๊กที่ลูกค้าเจอทันที, M4/M3 แก้สาย dispatch/ไรเดอร์) — ทำทีละ M ผ่าน gates ทุกครั้ง ห้ามรวบ big-bang

---

## PART C — BMB MARKETING AUTOMATION CONTROL CENTER (งานใหม่ที่ผนวก)

> เป้าหมาย: เจ้าของร้านเปิด Admin → เลือกเมนูจริง → สร้างแผน/คอนเทนต์ → อนุมัติ → ตั้งเวลา → เผยแพร่ → วัดผล → วนรอบถัดไป **ไม่ต้องสั่ง AI Developer ทีละโพสต์** · ไม่เอา Chat/Unified Inbox ของ ContentVelo (มี Talk to Bite อยู่แล้ว) · ห้าม AI เปลี่ยนราคา/สต็อก/โปรโมชัน/ธุรกรรมเอง · scheduler ห้ามข้ามขั้นตอนอนุมัติ

### C0. Phase 0 — Source Audit (จากซอร์สจริง 2026-10-22 @ 2cbf203)

| หัวข้อ | ระดับ | หลักฐานจริง (ไฟล์) | หมายเหตุ |
|---|---|---|---|
| Admin nav/routes | **A** | `src/App.tsx` lazy routes + `AdminNav` · หน้า admin 29 ตัว | มีพร้อม: `AdminAiStudio`, `AdminContentApprovals`, `AdminMedia`, `AdminPromotions`, `AdminMenuSchedule` |
| Queue/Dispatcher/Worker | **A** | `supabase/functions/{queue-enqueue,queue-dispatcher,automation-worker}` + `automation_queue` + `adminJobsApi.ts` + RPC `admin_list_jobs/admin_delete_job` (mig 126) | single-path (G8-S5) · allowlist 3 job types · **เพิ่ม job ใหม่ต้องแตะ allowlist+payload+idempotency ทุกจุด** |
| Cron/scheduler | **A** | `.github/workflows/automation-scheduler.yml` (cron */5 + hourly) + `daily-backup.yml` | ต่อยอดไฟล์เดิม ห้ามสร้างใหม่ |
| AI text gen | **A/B** | `aiService.ts`, `aiModels.ts`, `aiGuardrails.ts`, `aiVoice.ts`, `contentAutomation.ts` | `contentAutomation.ts` **ไม่มีใคร import (ตายใน repo)** = ดึงมาใช้ ไม่ต้องเขียนใหม่ |
| Content approval | **B** | RPC `submit_content_for_approval` (mig 126) + `AdminContentApprovals.tsx` | ต้องตรวจก่อนว่า draft อยู่ตารางไหน (verify) |
| Social events/insights | **B/C** | mig `109` = `channel_page_bindings`+`social_events`+`ingest_social_event` (90-day) | ต้องมีตัวดึง insights เข้า · attribution แยก "มีจริง/ไม่มีสิทธิ์" |
| Image generation | **B (scope จำกัด)** | ai-proxy (`aiVoice.ts` STT ใช้ gemini) + ไม่มี service สร้างภาพอาหาร | **คำสั่ง E5: เจนเฉพาะภาพโปรโมชัน — ภาพเมนูใช้รูปจริง sync เท่านั้น ห้ามเจน** |
| Facebook/Meta publish | **A/B (มีจริง! — แก้ไขจากที่เคยเขียนว่า "ไม่พบ")** | `supabase/functions/social-publish-worker` (Graph v21.0) + `social-post-worker` + `social-ai-worker` (comment/messages) + `channel-webhook` · commits `35ac7e0` (โพสต์ภาพเมนูจริง multi-photo), `b6b03c8` (webhook live), `eaa5105` (**Meta app LIVE verified, permalink จริง**), `9098a22` (runbook FB image funnel) | เคย publish สำเร็จจริง — **ต่อของเดิม ห้ามสร้างใหม่** (E6) |
| Analytics/attribution | **B/C** | `AdminReports.tsx` + `social_events` | ห้ามอ้างยอดขายจากโพสต์โดยไม่มี attribution evidence |
| Settings/audit | **A** | `AdminSettings.tsx` + `AuditLogPage.tsx` + `auditLog.ts` | ใช้เก็บ automation rules ต่อได้ |
| Tests/RLS/migrations | **A** | vitest 1216 + `e2e/contracts_*.sql` + CI replay 001–134 | สัญญา SQL ใหม่ตามแบบ 132/133 |

**สรุป:** โครง "คิว+งาน+อนุมัติ+AI ข้อความ" มีจริง ~60% — ขาด **Image gen (D)**, **Meta publish (D/E)**, **ตัวเชื่อม Planner→คิว (ยังไม่มี job type marketing)**, **Analytics พิสูจน์ได้** และ **หน้า Control Center รวมศูนย์**

### C1. Phase 1 — UI ใน Admin เดิม (หน้าเดียว+แท็บ ไม่ใช่แอปใหม่)

**หน้า `AdminMarketing` (`/admin/marketing`)** — 7 แท็บ อ่าน/เขียนตารางจริงผ่าน RPC:
1. **Overview** — นับร่างรออนุมัติ/ตั้งเวลา/เผยแพร่/ล้มเหลว จากตารางจริง
2. **Content Planner** — เลือกสินค้าจาก `products` จริง (ขายดีจาก `order_items` จริง + พร้อมขายตาม inventory/menu rules เดิม) → จำนวนโพสต์+ช่วงวัน+objective+content mix
3. **AI Content Studio** — caption/headline/CTA/hashtag ผ่าน `aiService`+`contentAutomation` เดิม + ภาพจาก image provider (C2) + brand context จาก `AdminBrands` + validate ราคา/สต๊อก/เนื้อหาซ้ำ + draft/regenerate
4. **Approval Center** — ต่อยอด `AdminContentApprovals` เดิม: approve/reject/edit/regenerate/bulk เฉพาะที่ผ่าน validation + audit ผู้อนุมัติ/revision + **อนุมัติ ≠ ตั้งเวลา ≠ เผยแพร่**
5. **Calendar** — day/week/month (Asia/Bangkok) แก้เวลา/ยกเลิก/reschedule + กันเผยแพร่ซ้ำ (idempotency key เดียวกับคิว)
6. **Automation Rules** — frequency, publishing window, content mix, menu rules, duplicate/cooldown, stop conditions, failure notify — persist ในตารางจริง เปลี่ยนจาก Admin ได้ (ห้าม hard-code)
7. **Analytics & Run History** — draft→approved→scheduled→published→measured + provider post ID จริง + error/retry + แยก metrics มีสิทธิ์/ไม่มีสิทธิ์ + ห้ามอ้างยอดขายโดยไม่มี attribution

### C2. Phase 2 — วงจร E2E (ต่ออายุของเดิมเท่านั้น)

`อ่านเมนูจริง → PLAN → GENERATE (aiService/contentAutomation + image provider) → VALIDATE (aiGuardrails+ราคา/สต๊อกจริง) → DRAFT → APPROVE (คนเท่านั้น) → SCHEDULE → ENQUEUE (queue-enqueue เดิม) → PUBLISH (Meta API) → RECORD result → FETCH analytics → UPDATE planning inputs`

ก่อนเพิ่ม job type `marketing_publish` ต้องแตะครบทุกจุด: `queue-enqueue` allowlist+payload template+ref regex (`[a-z0-9][a-z0-9-]{3,63}` — **ห้ามตัวพิมพ์ใหญ่ใน ref** บทเรียน G8-S5) + `queue-dispatcher` JOB_TYPES + `automation-worker` handler + complete/fail RPC + idempotency (`mk-<plan>-<slot>`) · retry ต้องเช็คผลก่อนเสมอ (unknown → ห้ามโพสต์ซ้ำ) · scheduler ห้ามข้าม approval · ตารางใหม่ = marketing plans/posts/rules + migration + contract SQL ตามแบบ 133

### C3. Phase 3 — Tests & Gates
vitest ครอบ: menu data / empty menu / invalid pricing+stale inventory / gen+validate / approval auth+revision / schedule timezone+due-time / enqueue-claim-complete-fail / idempotency / provider auth fail / publish success-fail-timeout-unknown / retry-backoff-cancel / analytics missing+attribution / settings persistence+authz / mobile admin / E2E menu→publish · SQL contracts ใหม่ทุกตาราง/RPC · รัน lint+typecheck+unit+build ตาม package.json จริง · **ห้ามอ้าง E2E/production ผ่านโดยไม่ได้รันจริง**

### C4. Phase 4 — Owner Handoff (ต้องครบตอนส่งมอบ)
HEAD+changed files · ของเดิมที่ reuse · ของใหม่ · migration/RPC · ผลเทสต์จริง · สิ่งติดสิทธิ์ Meta/credentials · วิธีเปิดใช้ทีละขั้น · สร้างโพสต์แรก+อนุมัติ · ตั้งเวลา+เปิด automation · หยุด automation+แก้ failed jobs · Rollback

---

## PART E — คำสั่ง/คำตอบจาก Owner 2026-10-22 รอบ 2 (งานต่อในแชทหน้า — ผูกกับ Part A/B/C)

> ทุกข้อ = **งานต่อ (work items)** ทำตามลำดับใน D1 · ห้ามละเมิดกติกา §0

### E1. สายมอบหมายงาน — โมเดล "ประกาศ-รับงาน + แอดมินเลือกเองได้" (Owner สั่ง)
- อาการจริง: เปิด `/admin/delivery` แล้ว **หาปุ่มมอบหมายไม่เจอ** (ภาพที่ 2 — คิวว่าง/อยู่ล่างจอ) + เดิมต้อง assign ทีละคน
- โมเดลที่สั่ง (ผสม 2 ทาง — คำตอบ D4 ข้อ 2 "เลือกไรเดอร์ก่อน และไรเดอร์กดรับเองได้"):
  1. กด **"ส่งออกงาน (Dispatch)"** → ระบบ **ประกาศ+push แจ้งไรเดอร์ทุกคนที่ลงทะเบียน/ผูกบัญชีแล้ว** (registered & linked — ผูกผ่าน `link_driver_user` มีอยู่แล้ว)
  2. ไรเดอร์คนแรกที่กด **"รับงาน"** = จองงานคนเดียว → **สถานะถึงเปลี่ยนจริง** (การรับงาน = trigger สถานะ ไม่ใช่ปุ่มแอดมิน)
  3. แอดมิน**เลือก/มอบหมายเองก็ได้** (`assign_driver` เดิม — "เลือกไรเดอร์ก่อน") + เห็นทันทีว่าใครรับ/ยังไม่มีใครรับ
- ของเดิมที่ต่อ (ห้ามสร้างใหม่): `assign_driver` RPC (020/125), `driverAcceptAssignment` (`driverService.ts:113`), push audience ไรเดอร์ (`register_push_subscription(p_audience)` + `claim_push_driver_targets`), badge ใน `DeliveryManagement.tsx:28-49`
- เก็บหลักฐาน: dispatch 1 งาน → ไรเดอร์ทุกเครื่องได้แจ้งเตือนพร้อมกัน → คนแรกกดรับ → สถานะเปลี่ยนทั้ง 3 หน้า ≤1 poll · คนอื่นเห็น "งานถูกจองแล้ว" · ทดสอบเส้น assign โดยแอดมินอีก 1 รอบ

### E2. ลบ mock ไรเดอร์/ออเดอร์ปลอม — ใช้ของจริงเท่านั้น
- หลักฐาน: `src/pages/admin/RouteOptimizationPage.tsx:23-40` = `mockOrders` (BMB-001..005 ที่อยู่ปลอม) + `mockDrivers` (Somchai/Somying/Wichai ปลอม) + `assignOrdersToDrivers(mockOrders, mockDrivers)` → "429.6 km / 884 min" = ตัวเลขจากของปลอมทั้งหมด (ภาพที่ 1) · `DeliveryManagement.tsx:12` ระบุเองว่าเป็น "old client-side route optimizer mock UI"
- คำสั่ง: **ลบทิ้งทั้งหมด** — หน้าเส้นทาง/Driver status ต้องอ่าน `delivery_assignments`+`drivers` จริง (ที่ลงทะเบียน/ผูกแล้ว) เท่านั้น · ห้ามเหลือ mock/demo ในหน้าแอดมิน (กติกาข้อ 5)
- เก็บหลักฐาน: หน้าเดิมแสดงเฉพาะออเดอร์จริงของวัน + ไรเดอร์จริงที่ผูกบัญชีแล้ว (แถว `drivers` จริง ไม่ใช่ Somchai ปลอม)

### E3. แอดมินเห็นตลอด + เห็นการเดินทางของไรเดอร์ (live)
- คำสั่ง: ระหว่างงาน แอดมินต้องเห็นตำแหน่ง/เส้นทางเดินทางของไรเดอร์คนนั้น ๆ แบบสด เห็นตลอดทุกขั้น
- ของเดิมที่ต่อ: `RiderMiniMap` (ปลายทาง/คุณGPS/ครัว) + `drivers.current_latitude/longitude` + map diagnostics (`googleMaps.ts`) → ต่อเป็น: ไรเดอร์รายงานตำแหน่งเป็นระยะระหว่างงาน → Dispatch Center แสดงแผนที่+เส้นทางของไรเดอร์ที่กำลังส่ง + เก็บประวัติเส้นทางหลังจบงาน
- เก็บหลักฐาน: แอดมินดูหน้าเดียวเห็นไรเดอร์ขยับจริงบนแผนที่ (2 จอพร้อมกันบนเครื่องจริง)

### E4. ส่งจริง = ส่งรูปเสร็จ (POD) — แอดมินเห็นทุกขั้น
- ของเดิมครบแล้ว: `driver_attach_pod` + **`delivered` ต้องมี POD** (`ERR_POD_REQUIRED`) + แอดมินเห็นรูป (signed URL) — คงไว้ + ปุ่ม "ส่งมอบสำเร็จ" ของไรเดอร์ทำงานได้เมื่อแนบรูปแล้วเท่านั้น + แอดมินเห็นสดทุกสถานะ (ผูกกับ E3)
- เก็บหลักฐาน: วงจรจริง ถ่ายรูป → delivered บันทึก → ลูกค้า "ส่งสำเร็จ" + แอดมินเห็นรูป/เส้นทาง

### E5. Image gen — เจน "ภาพโปรโมชัน" เท่านั้น
- คำสั่ง: image gen มีอยู่แต่ใช้น้อย — **ใช้เจนภาพโปรโมชันเท่านั้น**; ภาพอาหาร/เมนู **ห้ามเจน** ใช้รูปจริงที่ sync เท่านั้น (แอดมินอัปเดตเมนู+รายละเอียดเรื่อย ๆ)
- ผลกับ Part C: AI Content Studio สร้างภาพได้เฉพาะครีเอทีฟโปรโมชัน (banner/การ์ดโปร) · ภาพสินค้าในโพสต์ = ดึงจากคลังภาพสินค้าจริง (`AdminMedia`/สินค้า) เท่านั้น · validate บังคับข้อนี้ก่อน publish เสมอ

### E6. Meta publish — ของเดิมที่เคยสำเร็จจริง (ใช้ไม่ใช่สร้างใหม่)
- หลักฐานความสำเร็จจริง: `35ac7e0` (social-publish-worker แนบภาพเมนูจริง multi-photo), `b6b03c8` (webhook fields — messages live), `eaa5105` (**Meta app LIVE verified: post public=true + permalink จริง**), `9098a22` (runbook FB image post funnel + Meta app Live-mode fix)
- คำสั่ง: **ตรวจ+ต่อยอด `social-publish-worker` ของเดิมก่อนเสมอ** (กติกาข้อ 2) — เสียบ Planner/Approval/Calendar ของ Part C เข้ากับ worker ตัวนี้; สร้างใหม่ได้เฉพาะเมื่อพิสูจน์แล้วว่าของเดิมใช้ไม่ได้จริง
- **งานต่อเพิ่ม (จาก D4 ข้อ 4):** "เอไอโต้ตอบได้ ลองตรวจดูขาดอะไรปรับปรุงเอา" → audit `social-ai-worker` (comment/messages auto-reply ผ่าน Graph API) + `channel-webhook` + `social_events` ว่าขาด/พังจุดไหน → ปรับปรุงให้ครบวงจร (ตอบคอมเมนต์/ข้อความ, ขอบเขตที่ปลอดภัยตาม `aiGuardrails`, เก็บ event จริง)

---

## PART D — ลำดับงานรวม + Gates + สิ่งที่ต้องถาม Owner

### D1. ลำดับลงมือในแชทหน้า (รวมทั้ง 2 งาน + PART E)
1. **ก้อนแก้บั๊กจริงก่อน** (PART A × M-merge × E): A5+M1 → A1+M2 → A2+A7(ก.)+M5 → A3 → **E2 ลบ mock ปลอม** → **E1+A4+A8+M4+M3 (โมเดลประกาศ-รับงาน + Dispatch Center)** → **E3+E4 (live tracking + POD จบจริง)** → A6 — เสร็จทีละชิ้นผ่าน gates+ทดสอบจริง 3 อุปกรณ์ก่อนชิ้นถัดไป
2. **ก้อน Marketing** (PART C × E5/E6): ตรวจ draft schema + ตาราง marketing plans/posts/rules (migration 135+) → `AdminMarketing` 7 แท็บ → **เสียบเข้า `social-publish-worker` ของเดิม (E6)** → image gen **เฉพาะภาพโปรโมชัน** (E5) + ภาพเมนูใช้รูปจริง → job type `marketing_publish` ในคิวเดิม → analytics → E2E menu→publish
3. **Test จริงทุกรอบ**: ลูกค้า(มือถือ)→สลิป→แอดมินยืนยัน→dispatch ประกาศ→ไรเดอร์(ทุกเครื่อง)รับ→live tracking→POD→ส่งมอบจบวงจร + พรีออเดอร์ 1 รอบ + คูปอง 1 ใบ

### D2. Gates ก่อน push ทุกครั้ง (ของเดิมทั้งหมด ห้ามลด)
`npx tsc --noEmit` = 0 · `npm run lint` = 0 · `npm run test` = 1216/1216 (หรือมากกว่าเมื่อเพิ่มเทสต์) · `npm run build` ผ่าน · CI: migrations 001–134 replay + contracts 123/124/127–130/131/133 (+ของใหม่) เขียว · ห้ามประกาศ PASS โดยไม่มี runtime evidence (ภาพ/ล็อกจากอุปกรณ์จริง) · apply migration production = ต้อง Owner approve เท่านั้น

### D3. Rollback procedure (ใช้ทุกงาน)
- โค้ด UI/service: revert commit แล้ว redeploy (auto-deploy จาก main) — ไม่มี migration = ย้อนได้ทันที
- migration ใหม่: เขียน down/repair คู่เสมอ + ทดสอบ replay ทั้งขาขึ้น/ขาลงบน ephemeral PG ก่อนขอ apply · ถ้า production พัง: ย้อนโค้ดก่อน แล้วค่อย repair data ผ่าน RPC (ห้ามยิง SQL ตรงโดยไม่ผ่านแบบแผน)
- Edge functions: deploy ด้วย Management API (multipart `metadata`+`file`, `verify_jwt=true`) + จดเลขเวอร์ชันก่อน/หลังเพื่อย้อน

### D4. คำถาม 5 ข้อ — ✅ Owner ตอบแล้ว 2026-10-22 (คำตอบด้านล่าง = คำพี่ดัดแปลงน้อยที่สุด)
1. **การชำระเงิน (A7)** = **ก. ตามแนะนำ (คง manual+ปิดช่องโหว่) — เพราะกำลังรอ Omise LIVE จะเปิดร้านจริงแล้ว** → เตรียมความพร้อมให้สลับเป็น auto ได้ทันทีเมื่อได้ live keys (webhook/refund path มีอยู่แล้ว: `omise-webhook`/`omise-checkout`/`omise-refund`) · ห้ามเปลี่ยนก่อนได้รับ live keys + อนุมัติ
2. **สายจัดส่ง (A4)** = **เลือกไรเดอร์ก่อน (แอดมิน assign ได้) และไรเดอร์กดรับเองได้ด้วย** — ผสม E1: dispatch → ประกาศ+push ไรเดอร์ทุกคนที่ลงทะเบียน/ผูกแล้ว → คนแรกรับ = จอง → **สถานะเปลี่ยนจริงตอนรับงาน** · แอดมินจะเลือก/มอบหมายเองก็ได้ (assign_driver)
3. **Marketing ช่องทาง** = **Facebook Page อย่างเดียวก่อน** — Instagram+LINE รอระบบทั้งหมดสมบูรณ์เปิดขายได้จริงก่อนจึงอนุญาต
4. **Meta App/สิทธิ์** = **มีแล้วใน env local ทดสอบผ่านมาแล้ว พร้อมใช้งาน** + **"เอไอโต้ตอบได้ ลองตรวจดูขาดอะไรปรับปรุงเอา"** → งานต่อ: audit `social-ai-worker` (comment/messages auto-reply) ว่าขาดอะไร → ปรับปรุง (ดู E6)
5. **Image provider** = **โอเค Gemini ผ่าน OpenRouter** — คีย์ใหม่ชื่อ **`BMB_openrouter_api_key`** (อยู่ใน env แล้ว; ห้ามแสดงค่าในเอกสาร/โค้ด/ล็อก) + ขอบเขตตาม E5 (เจนเฉพาะภาพโปรโมชัน)

### D5. หมายเหตุสภาพแวดล้อม (บทเรียนจากเซสชันนี้)
- ทดสอบ CI บนเครื่องได้จริงด้วย Docker: `postgres:16` + `e2e/ci/apply_all_migrations.sh` (ต้อง `tr -d '\r'` ก่อนรันเพราะ checkout Windows เป็น CRLF) + contracts ตาม `e2e/contracts_*.sql`
- CI ผ่านทั้ง workflow แล้วที่ `2cbf203` · mojibake ใน terminal = ปัญหาแสดงผล PowerShell ไม่ใช่ข้อมูลเสีย
- PWA cache เก่าบนเครื่องลูกค้า/ไรเดอร์: ถ้าเห็นหน้าเก่าให้ hard-refresh/clear storage ก่อนสรุปว่าบั๊ก
- production = `biteme-baby.com` (ของจริง) · `bitemebaby-5f7.pages.dev` = build เก่า ห้ามใช้ทำ QA