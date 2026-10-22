# Bite Me Baby — AI Work State (ระบบบันทึกสถานะสำหรับแชทถัดไป)

> **สถานะงานปัจจุบันของโปรเจกต์ Bite Me Baby** ใช้แนบเข้าสู่ Context ตอนเริ่มแชทเสมอ

**last_updated:** 2026-10-22 รอบ 5 (D1: A5+M1 + A1+M2 + A2+A7(ก.)+M5 เสร็จ — tests 1247/1247 119 files, tsc/lint/build เขียว · Owner ทดสอบจาก production หลัง push)
**phase:** 🔨 **D1 IN PROGRESS — ✅A5+M1 ✅A1+M2 ✅A2+A7(ก.)+M5 (รอ runtime evidence 3 อุปกรณ์บน production) · ชิ้นถัดไป A3**
**current_focus:** D1 ตามลำดับ: ✅A5+M1 → ✅A1+M2 → ✅A2+A7(ก.)+M5 → A3 → E2 → E1+A4+A8+M4+M3 → E3/E4 → A6 → ก้อน Marketing
**blocked_by:** ไม่มี — แต่ push/production = ต้อง Owner approve (auto-deploy จาก main) + เก็บ runtime evidence จากอุปกรณ์จริงก่อนประกาศ PASS

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
- `docs/BMB_HANDOFF_NEXT_SESSION_2026-10-17-EVE.md` — handoff ปัจจุบัน (สถานะ + E2E Checklist §3 + Blocker §4)
- `src/config/kitchenLocation.ts` — พิกัดครัว single source (ห้าม hardcode ที่อื่น)
- `BMB_SAME_DAY_PRE_ORDER_MASTER_PLAN.md` + `PHASE_CONTRACTS` + `EVIDENCE_LOG` + `REGRESSION_MATRIX` — กติกาเดิม (phases 0-6 ปิดแล้ว)
