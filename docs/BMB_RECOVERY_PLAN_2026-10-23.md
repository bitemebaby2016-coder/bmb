# BMB — Recovery R2.2→R3: Root Cause Matrix + แผนปิดงาน (2026-10-23)
# วิเคราะห์จาก "ของจริง" ทุกจุด — No Evidence = Not Done

> **ที่มา:** Owner ทดสอบจริงบน `biteme-baby.com` 2026-10-23 13:56–14:23 (แอดมิน/ลูกค้า/ไรเดอร์ "พอล ไบท์ไดรฟ์" บนอุปกรณ์จริง) พบวงจรพังหลายจุด + คำสั่งเพิ่ม "แอดมินตรวจสลิปยังใช้ไม่ได้"
> **คำสั่งรอบนี้:** วิเคราะห์อย่างซื่อสัตย์ → แยก "ยืนยันแล้ว" vs "สมมติฐาน" → Root Cause Matrix → แผนปิดงานตามลำดับ dependency → **แฮนออฟให้แชทถัดไปลงมือแก้ — รอบนี้เอกสารเท่านั้น ไม่แตะโค้ด**
> **กติกาเดิมใช้ครบ:** production truth เหนือ unit test · ห้ามเขียน "DONE" จน Owner ทดสอบจริงผ่าน · production write (migration/EF/secret) = Owner approve · เทสต์ห้ามต่ำกว่า 1291 (ปัจจุบัน 1317/1317 ที่ `f1eaebd`) · ห้าม mock/stub ใน production path · ไทยไม่ผ่าน shell · ห้ามอ้างไฟล์ที่ไม่มีจริง

---

## 0. หลักฐาน production ที่วัดได้รอบนี้ (read-only probes — ไม่มีการเขียนข้อมูล)

| Probe (Management API, read-only) | ผล | แปลผล |
|---|---|---|
| `has_table_privilege('authenticated','payment_intents','SELECT')` | **false** | authenticated อ่าน payment_intents ไม่ได้เลย (034 revoke แล้วไม่มี GRANT คืน) |
| `information_schema.role_table_grants` ของ payment_intents | เหลือแค่ `postgres` + `service_role` | ทุกโค้ดที่ `from('payment_intents')` = พังเงียบ |
| `count(*) FROM storage.objects WHERE bucket_id='pod-photos'` | **0** | **ไม่เคยมี POD upload สำเร็จแม้แต่ไฟล์เดียว** |
| payment_intents ของ BMB-20261023-841 / 205 | ใบละ **2 แถว** (processing+completed ห่าง 2 วิ) | dedupe (R1.2) ไม่มีผลในโปรดักชั่น — อ่านกลับไม่เห็น |
| `drivers.id` | มี **space ตำแหน่ง 5** (`drv- …-60bc`, 21 chars) | path ฝั่ง storage ถูก `encodeURIComponent` → เทียบ policy ไม่ตรง |
| `pg_proc.prosecdef` ของ driver_attach_pod / driver_update_delivery_status / submit_payment_slip / confirm_offline_payment / append_audit_log | **true ทั้งหมด** | RPC ไม่ใช่ต้นเหตุ RLS — เหลือ storage INSERT ตัวเดียว |
| delivery_rounds 2026-10-23 | morning/midday `active` (cutoff 08:00/10:30) · **evening `closed`** (updated 2026-10-22 10:34–10:35) | ที่ 14:01 เหลือ evening ตัวเดียวที่ยังไม่เลย cutoff — แต่มันถูกปิด → "ไม่มีรอบ" |
| delivery_rounds 23–25 รอบ evening | ถูกปิดพร้อมกัน 2026-10-22 10:33–10:35 | มีคน/สคริปต์ปิดเป็นชุด — ต้องถาม Owner |
| `enum_range(order_status)` | pending → … → arrived → delivered → cancelled/failed | ใช้แยก domain op "ปิดงาน delivery / mark delivered / ปิดออเดอร์" |

**ข้อเท็จจริงสถาปัตยกรรมที่มีผลต่อแผน:** แอป **ไม่มี realtime เลย** (stub ทั้ง bundle — `src/lib/stubs/realtimeStub.ts`: "The app NEVER subscribes to realtime") → ทุกข้อ sync ต้องแก้ด้วย polling/refresh-on-action เท่านั้น

---

## 1. Root Cause Matrix (D-01 … D-08)

> ทุกบรรทัดระบุระดับความมั่นใจ: **[ยืนยัน]** = มีหลักฐานโค้ด/ข้อมูลจริงชี้ขาด · **[สมมติฐาน]** = ต้องพิสูจน์ตามขั้นตอนที่ระบุ

### D-01 — ปิดงานไม่อัตโนมัติหลังไรเดอร์ส่งเสร็จ (แอดมินต้องกด "ปิดงาน" เอง)
- **[ยืนยัน]** ฝั่งข้อมูล auto-close อยู่แล้ว: `driver_update_delivery_status('delivered')` ตั้ง order→delivered + assignment→delivered + driver→available ใน RPC เดียว (`132_rider_pod_push_decline.sql:495-570`) — แต่ UI ไม่ปิดตาม: การ์ดงานไรเดอร์ที่ 14:23 ยังโชว์ปุ่ม "รับงานแล้ว/ยืนยันส่ง" ค้างบนงานที่ "ส่งสำเร็จ" แล้ว
- **[ยืนยัน]** ต้นเหตุระดับวงจร: รอบนี้ไรเดอร์กดส่งแล้ว **ล้มที่ D-02 (RLS ที่ storage upload)** → งานไม่เดินถึง delivered → แอดมินต้องกด `admin_advance_delivery_status` (`DeliveryManagement.tsx:536-543`, m116 — ข้าม geolocation/POD + audit) ปิดเอง = "ปิดงานได้ แต่ควรปิดอัตโนมัติ"
- **[ยืนยัน]** domain op ปนกันใน UI: "ปิดงาน delivery" / "mark delivered" / "ปิดออเดอร์" ยังไม่แยกเป็นคนละคำสั่ง (ตาม master handoff §2) — enum จริงพร้อมใช้แยกแล้ว
- **แผนแก้:** (1) ปลด D-02 → วงจรปิดเองโดยธรรมชาติ (2) แยก domain op + ซ่อนปุ่มทุกตัวเมื่อ assignment เป็น terminal (3) บอร์ดแอดมิน derive สถานะจาก data สดไม่ใช่ snapshot เก่า
- **Test A:** ไรเดอร์ส่งจริง 2 รอบ → หลังกดยืนยันรอบสุดท้าย ห้ามมีปุ่มค้าง ห้ามต้องกดปิดเองทั้งไรเดอร์และแอดมิน

### D-02 — ไรเดอร์ส่งงานไม่ได้: (ก) RLS ปฏิเสธทุกการอัปโหลด POD (ข) ปุ่มเพิ่มรูปไม่มี
- **(ก) [ยืนยัน — สาเหตุหลัก]** `pod_photos_driver_upload` WITH CHECK ใช้ scalar subquery กับตาราง RLS:
  `split_part(name, '/', 1) = (SELECT d.id FROM public.drivers d WHERE d.user_id = auth.uid())` (`132_rider_pod_push_decline.sql:94-101`)
  — **ชนิดเดียวกับที่ migration 119 เองบันทึกไว้ว่า "scalar subquery … is hidden by RLS and breaks WITH CHECK"** (132:93 comment ว่าใช้ bucket_id literal เพื่อเลี่ยงปัญหานี้ แต่ subquery ฝั่ง `drivers` ยังอยู่) → ผลลัพธ์ใน policy context เป็น NULL → `split_part(...) = NULL` ไม่เป็น true → ทุก INSERT โดน "new row violates row-level security policy" (ตรง toast ที่ Owner เจอ 14:00)
  - **หลักฐานชี้ขาด:** pod-photos มี object **0 ชิ้นตลอดกาล** ขณะที่ `payment-slips` (133:57-66) ที่เทียบ `= auth.uid()::text` ตรง ๆ ไม่มี subquery **อัปโหลดผ่านจริง** (slip_path มีใน payment_intents)
- **(ก) [ยืนยัน — ตัวซ้ำเติม]** `drivers.id` จริงมี space ตำแหน่ง 5 และ storage-js encode ทุก segment (`@supabase/storage-js …/helpers.ts:159: path.split('/').map(encodeURIComponent).join('/')`) → ชื่อ object อาจเป็น `drv-%20…` ขณะ policy เทียบ `drv- …` → ต่อให้ subquery ทำงานก็ยังไม่ตรง
- **(ข) [ยืนยัน]** `RiderPwaPage.tsx:772` `<input … capture="environment">` = บังคับกล้องอย่างเดียว ไม่มี "เลือกรูปจากเครื่อง" (ตรง "ปุ่มเพิ่มรูปไม่มี มีแต่ปุ่มถ่ายรูป")
- **[ยืนยัน]** RPC ไม่ใช่ต้นเหตุ: driver_attach_pod / driver_update_delivery_status = SECURITY DEFINER (probe) — mock ที่เคยเขียวจึงไม่เคยจับ RLS ตัวนี้ (บทเรียน "mock สีเขียว ≠ ของจริง" ซ้ำรอบ)
- **แผนแก้:** (1) เขียน policy ใหม่ไม่ใช้ subquery — helper SECURITY DEFINER `current_driver_id()` หรือเทียบ uid ตรง + ให้ `driver_attach_pod` (definer อยู่แล้ว) ตรวจความเป็นเจ้าของ path (2) normalize `drivers.id`/path (data fix — Owner approve) (3) แยกปุ่ม "ถ่ายรูป" / "เลือกรูปจากเครื่อง" (input ที่สองไม่มี capture)
- **Test B:** เลือกจากแกลเลอรีได้ + ถ่ายกล้องได้ + ยืนยัน → งานถึง delivered + pod-photos มี object 1 ชิ้น/งาน

### D-03 — คูปองต้องกรอกซ้ำระหว่าง Cart → Checkout
- **[ยืนยัน]** `cartPersistence` เก็บ `couponCode` แต่ **ไม่เก็บ `appliedPromotion`** (`StoredCart` มีแค่ v/savedAt/order_mode/couponCode/items — `cartPersistence.ts:40-49`, serialize `:84`) และ restore ตั้งเฉพาะโค้ด (`:156-157`) → หลัง reload `appliedPromotion=null` → `CouponBox` แสดงสถานะ pending ("โค้ดนี้ยังไม่เข้าเงื่อนไขตอนนี้… ลองอีกครั้ง") = ต้องกด/กรอกซ้ำ — ตรงที่ Owner เจอ (screenshot 14:01)
- **[สมมติฐาน]** อาการเขียว/เหลืองสลับกันระหว่างสอง screenshot (14:01 invalid / 14:02 applied บนตะกร้าเดียวกัน) = `evaluateCoupon([appliedPromotion], couponCode, subtotal)` re-check `min_order_amount` ทุก render (`promotionClient.ts:75-100`) — พิสูจน์ด้วย: ใส่โค้ด → reload หน้า checkout → ดูว่ากลับเป็น pending ทุกครั้งไหม
- **แผนแก้:** persist `appliedPromotion` (หรือ revalidate จากตาราง promotions ตอน hydrate) + **applied-coupon state เดียว** ที่ Cart/Checkout ใช้ร่วมกัน + server revalidate ตอนส่ง (มีแล้ว `revalidateCouponForSubmit`) + ห้ามมีช่องกรอกที่สอง

### D-04 — ส่วนลดต้องใช้กับ "ค่าอาหาร" เท่านั้น + แสดงชื่อคูปองครั้งเดียว + สรุปยอดรวมเดียว
- **[ยืนยัน]** ตรรกะคำนวณถูกแล้ว: discount จาก `subtotal` (ค่าอาหารล้วน) และ `total = subtotal − discount + deliveryFee` (`cartStore.ts:285-293`) = "ส่วนลดเฉพาะค่าอาหาร" ตรง requirement
- **[ยืนยัน]** แต่การแสดงผลไม่ตรงคำสั่ง: Checkout แสดง `CouponBox` (มีช่องกรอกในตัว) ซ้ำอีกชุด (`CheckoutPage.tsx:1092` + `CartPage.tsx:89`) และสรุปยอดใช้คำว่า "ส่วนลด (ประมาณการ)" (`CheckoutPage.tsx:1118`)
- **แผนแก้:** ชุดที่ซ้ำบน Checkout เปลี่ยนเป็น "บัตรคูปองที่ใช้: ชื่อ + โค้ด + เอาออก" (ไม่มี input) + สรุปยอดแสดง `ส่วนลด (คูปอง X · เฉพาะค่าอาหาร) −11.80` รวมในยอดเดียว + ตัดคำ "ประมาณการ" เมื่อ server ยืนยันแล้ว

### D-05 — สั่งแล้ว "ไม่มีรอบที่เปิดรับ"
- **[ยืนยัน]** ข้อมูลจริง 2026-10-23: morning (cutoff 08:00) / midday (10:30) = `active` แต่เลย cutoff ตอน 14:01 → `cutoff_passed` (`deliveryRoundStatus.ts:47-70`) · **evening (cutoff 16:00, ส่ง 17:00-20:00) = `status='closed'`** (updated 2026-10-22 10:34–10:35) → เหลือศูนย์ที่จองได้ → "ไม่มีรอบที่เปิดรับ" (`CheckoutPage.tsx:896`)
- **[ยืนยัน]** ตัวกรองสองชั้นซ่อนแถว closed: RLS `delivery_rounds_public_read … USING (status='active')` (`088:52-54`) + client filter `status==='active'` (`bmbAdminApi_rounds.ts:90-97`) → ลูกค้าไม่รู้ว่า "มีรอบแต่ถูกปิด" และ `setRoundStatus` เขียนตรงไม่มี audit (`bmbAdminApi_rounds.ts:51-53`) → ตามรอยไม่ได้ว่าใครปิด
- **[สมมติฐาน]** ใครปิด evening 23–25 พร้อมกัน 2026-10-22 10:33–10:35: แอดมินสลับปุ่มในหน้ารอบระหว่างทดสอบ หรือสคริปต์เทสต์ — ถาม Owner + ย้อนรอย (ไม่มี audit)
- **[สมมติฐาน — ระเบิดเวลา]** `ensure_rounds_for_date` โคลนจาก template ที่ `status='active'` เท่านั้น + `RAISE 'ERR_ROUND_TEMPLATE_MISSING'` ถ้า key ไหนไม่มี (`028:174-183`) แต่ client เงียบ error ไปต่อ (`bmbAdminApi_rounds.ts:78`) → ถ้า evening ทุกแถวโดนปิด วันถัดไปจะไม่มีรอบถูกสร้างเลย
- **แผนแก้:** (1) เปิดรอบ evening 23–25 (ทำได้ทันทีที่หน้ารอบ — ไม่ใช่ migration) + ตกลงกติกาว่ารอบไหนปิดถาวรได้ (2) เพิ่ม audit บน `setRoundStatus` + แสดงเหตุผลรายรอบ ("ปิดรับแล้ว/เลย cutoff/เต็ม") แทนข้อความเดียว (3) guard `ERR_ROUND_TEMPLATE_MISSING` ให้เด้งชัด ไม่เงียบ
- **Test C:** หน้า checkout โชว์รอบที่เปิดรับจริง + เหตุผลรายรอบที่ปิด; สั่งได้ 1 ออเดอร์จริง

### D-06 — แผนที่โหลดไม่ได้ (ขึ้น/ไม่ขึ้น ทุกเครื่อง)
- **[ยืนยัน]** key ถูกอ่านตอน **build** เท่านั้น: `MAPS_KEY = import.meta.env.VITE_GOOGLE_MAPS_API_KEY` (`googleMaps.ts:10`) ถ้าว่าง → error "ไม่พบ VITE_GOOGLE_MAPS_API_KEY ในการ build นี้" (`:194-196`) — `.env.local` ฝั่ง dev **มี** key แต่ build ที่ deploy โชว์ fallback "แผนที่โหลดไม่ได้ (ยังไม่ได้ตั้งค่า Google Maps API key หรือ …)" บนทุกหน้าที่มีแผนที่ (screenshot)
- **[สมมติฐาน — เรียงจากเป็นไปได้มาก]** (1) `VITE_GOOGLE_MAPS_API_KEY` ไม่ได้ตั้งใน **Cloudflare Pages build env** (deploy ไหนไม่มี = ตายทั้ง deploy) (2) key มีแต่ถูก restrict ด้วย HTTP referrer/billing quota → ขึ้นลง (3) CSP กัน `maps.googleapis.com` บางครั้ง — อาการ "intermittent ทุกเครื่อง" ชี้ไป (2) มากกว่า (1) ที่ควรตายตลอด
- **แผนแก้:** Owner ตั้ง `VITE_GOOGLE_MAPS_API_KEY` (+ `VITE_GOOGLE_ROUTES_API_KEY`) ใน Cloudflare Pages env → redeploy · ตรวจ key restrictions ให้ครอบ `https://biteme-baby.com/*` · โค้ดเสริม fallback ชัดเจน (บอกเหตุผลจริง + แผนที่สำรอง) · ตรวจ CSP ที่ `_headers`
- **Test E:** แอดมิน/ไรเดอร์/ลูกค้า เปิดหน้ามีแผนที่บน 3 อุปกรณ์ × 2 รอบ = ขึ้นครบ หรือมีเหตุผลที่อ่านออก

### D-07 — state ข้ามบทบาท (แอดมิน/ไรเดอร์/ลูกค้า) ไม่ sync
- **[ยืนยัน]** แอป **ไม่มี realtime** (stub ทั้ง bundle — `src/lib/stubs/realtimeStub.ts`) → ทุกหน้าพึ่ง polling/refresh เท่านั้น; ไรเดอร์ poll ทุก 25 วิ (`RiderPwaPage.tsx:45`)
- **[ยืนยัน]** การ์ดงานไรเดอร์ค้างปุ่มบนงานที่ "ส่งสำเร็จ" แล้ว (screenshot 14:23) + บอร์ดแอดมิน "งานที่ถือครอง: 1/—" ค้างหลังงานจบ (14:06) = UI derive จาก snapshot เก่า/ไม่ re-render หลัง action
- **แผนแก้ (ห้ามพึ่ง realtime):** (1) terminal-state gating ของปุ่ม — ปุ่ม = ฟังก์ชันของสถานะเสมอ (2) refresh ทันทีหลังทุก action ทุกบทบาท (3) polling สั้นลงเฉพาะหน้าที่กำลังใช้งาน + refresh-on-focus (4) ทดสอบข้าม 3 บทบาทใน Test A

### D-08 — [เพิ่มตามคำสั่งรอบนี้] แอดมินตรวจสลิปยังใช้ไม่ได้
- **[ยืนยัน — สาเหตุชี้ขาด]** `REVOKE ALL ON public.payment_intents FROM authenticated` (`034_production_acl_drift_remediation.sql:88`) และ **ไม่มี GRANT คืนในทุก migration หลังจากนั้น** (grep ทั้งโฟลเดอร์) + probe จริง `has_table_privilege('authenticated','payment_intents','SELECT') = false`
  → ทุกโค้ดที่อ่านตรง `from('payment_intents')` (`paymentGateway.ts:375`, `:253` dedupe, `bmbAdminApi_orders.ts:470`) โดน permission denied แล้ว **เงียบ error คืน `[]`** (`paymentGateway.ts:381-383`)
  → SlipReviewPanel ได้ `intentsByOrder` ว่าง → `paymentConfirmability` ตอบ "ไม่พบ payment intent" + ปุ่มยืนยัน disabled ทุกแถว (`paymentExceptions.ts:152-200`, `SlipReviewPanel.tsx`) = **"แอดมินตรวจสลิปไม่ได้"** ตรงอาการ 100%
- **[ยืนยัน — ผลกระทบวงกว้าง]** (1) dedupe intent (R1.2) ตาบอดในโปรดักชั่น → intent ซ้ำ (841/205 ใบละ 2 แถว ห่าง 2 วิ — หลักฐานจริง) → เสี่ยง `ERR_INTENT_NOT_PROCESSING` ตอน confirm (008 B.5 เลือก `created_at DESC LIMIT 1` ได้แถว 'completed') (2) SlipThumb ไม่เห็นสลิป (slip_path มีจริงใน DB แต่อ่านไม่ได้) (3) `getPaymentSummary` บอด
- **[ยืนยัน]** ทางเขียนยังใช้ได้: `submit_payment_slip`/`confirm_offline_payment` = SECURITY DEFINER (probe) — ปัญหาคือ **ทางอ่าน** อย่างเดียว
- **แผนแก้ (2 ทาง — ให้ Owner เลือก):**
  - **(A) แนะนำ:** สร้าง SECURITY DEFINER read RPC (`get_payment_intents_for_orders(order_numbers[])` — scope เจ้าของ/แอดมิน/staff ตาม policy 006/129 ที่มีอยู่) แล้วสลับ `paymentGateway.getPaymentIntents` ไปเรียก RPC — ตรง canonical model ที่ 034 เขียนไว้ ("access via SECURITY DEFINER RPC") ไม่ต้องแตะ GRANT
  - **(B) ทางลัด:** `GRANT SELECT ON public.payment_intents TO authenticated` (RLS 006/129 คุมแถวอยู่) — เร็วกว่า แต่สวนทาง comment 034 → Owner ตัดสิน
  - ทั้งสองทาง: เลิกเงียบ error (log + surfacing) + ให้ dedupe ทำงานจริง + จัดการแถว intent ซ้ำ (data fix — Owner approve)
- **Test D:** แอดมินเปิดแผงตรวจสลิป → เห็นหลักฐาน (สลิป/เลข TXN) ทุกออเดอร์รอตรวจ + ปุ่มยืนยันทำงาน 1 ครั้ง/ออเดอร์ → order เป็น paid โดยไม่ error

---

## 2. Priority / Dependency Plan (P0 → P3)

> หลักการจัดลำดับ: ปลด "วงจรเงิน" และ "วงจรส่งของ" ก่อน (ธุรกิจเดินได้) → แล้วค่อยเก็บ UX/sync · ทุกงานจบด้วย evidence บน `biteme-baby.com` + อุปกรณ์จริง

| ลำดับ | งาน | แก้ที่ | ขึ้นกับ | production write? | เกณฑ์ผ่าน |
|---|---|---|---|---|---|
| **P0-1** | **D-08** ปลดทางอ่าน payment_intents (RPC ใหม่ หรือ GRANT — Owner เลือก) + เลิกเงียบ error + ซ่อม dedupe/แถวซ้ำ | migration ใหม่ + `paymentGateway.ts` + `bmbAdminApi_orders.ts` | Owner ตัดสิน A/B | **ใช่ — Owner approve** | Test D |
| **P0-2** | **D-02(ก)** เขียน `pod_photos_driver_upload` ใหม่ไม่ใช้ subquery + normalize path/id | migration ใหม่ (policy) + `driverService.uploadPodPhoto` (+ data fix id — Owner approve) | — | **ใช่ — Owner approve** | Test B |
| **P1-1** | **D-05** เปิดรอบ evening 23–25 + เหตุผลรายรอบ + audit `setRoundStatus` + guard template missing | หน้ารอบ (ข้อมูล) + `bmbAdminApi_rounds.ts` + migration ถ้าเพิ่ม audit | ถาม Owner เรื่องใครปิดรอบ | ข้อมูลรอบ = ทำในหน้า UI ได้; audit = ใช่ | Test C |
| **P1-2** | **D-01 + D-07** terminal-state gating + ปิดงานอัตโนมัติ + refresh หลัง action (ห้ามใช้ realtime) + แยก domain op | `RiderPwaPage.tsx` + `DeliveryManagement.tsx` + `AdminJobsPage.tsx` | **P0-2** (วงจรต้องถึง delivered ก่อน) | ไม่ | Test A |
| **P1-3** | **D-02(ข)** ปุ่ม "เลือกรูปจากเครื่อง" + ถ่ายรูป | `RiderPwaPage.tsx:772` | — | ไม่ | Test B |
| **P2-1** | **D-03** persist `appliedPromotion` + applied-coupon state เดียว | `cartPersistence.ts` + `CouponBox.tsx` | — | ไม่ | Test C (คูปอง) |
| **P2-2** | **D-04** บัตรคูปองเดียวบน Checkout + สรุปยอดรวมเดียว (ตัด "ประมาณการ") | `CheckoutPage.tsx` + `CouponBox.tsx` | P2-1 | ไม่ | Test C (คูปอง) |
| **P3-1** | **D-06** แผนที่: Cloudflare Pages env + key restrictions + fallback | Cloudflare/Google Console (Owner) + `googleMaps.ts` | Owner | env/secret = **Owner เท่านั้น** | Test E |

**ลำดับพึ่งกันแบบย่อ:** `P0-2 → P1-2 → Test A` (วงจรปิดงานอัตโนมัติพิสูจน์ได้เมื่อ POD ส่งผ่าน) · `P0-1 → Test D + ครึ่งเงินของ Test A` · `P1-1 → Test C` · `P2-x` ขนานกับ P1 ได้ · `P3-1` ขนานได้ทุกเมื่อ (Owner action)

### แผนทดสอบจริง A–E (ของจริง 3 บทบาท 3 อุปกรณ์ — เก็บ screenshot/evidence ทุกข้อ)
- **Test A (วงจรเงิน→dispatch→ไรเดอร์ ×2 รอบ + status walk + หน้าตั้งค่า):** ลูกค้าสั่ง+จ่าย (PromptPay) → แอดมินตรวจสลิป+ยืนยัน → มอบหมายไรเดอร์ → ไรเดอร์รับ→ส่ง (POD) → งานปิดอัตโนมัติ ×2 รอบซ้ำ + เดิน status ทุกสถานะ + ตรวจหน้าตั้งค่า (ลิงก์โซเชียลเดียว)
- **Test B (ไรเดอร์จริง):** เลือกรูปได้/ถ่ายได้ + RLS ผ่าน + pod-photos มีไฟล์จริง
- **Test C (ลูกค้าจริง):** คูปองเดียวข้าม Cart→Checkout + ส่วนลดเฉพาะค่าอาหาร + สรุปยอดเดียว + มีรอบส่งให้เลือก/เหตุผลชัด
- **Test D (แอดมินจริง):** แผงตรวจสลิปเห็นหลักฐานครบ + ยืนยันเงินได้จริง 1 ครั้ง/ออเดอร์
- **Test E (3 อุปกรณ์):** แผนที่ขึ้นทุกหน้าที่ใช้ หรือ fallback อ่านออก

---

## 3. แฮนออฟให้แชทถัดไป (คำสั่งเริ่มงาน)

1. **เริ่มที่ P0-1 (D-08)** — ถาม Owner ก่อน 1 ข้อ: เลือกทาง (A) read RPC หรือ (B) GRANT SELECT (แนะนำ A ตาม canonical 034)
2. **ต่อด้วย P0-2 (D-02 ก)** — migration policy ใหม่ (ห้ามใช้ scalar subquery ใน storage policy — บทเรียน 119/132) + normalize path · ยื่น migration ให้ Owner approve ก่อน apply เสมอ
3. **P1-1 (D-05)** — ถาม Owner เรื่องใครปิดรอบ evening 23–25 + ตกลงกติกาเปิด/ปิดรอบ แล้วเปิดรอบในหน้า UI
4. **P1-2/P1-3** — UI ปิดวงจร + ปุ่มเลือกรูป
5. **P2/P3** — ตามลำดับ · ปิดท้ายด้วย Test A–E บน `biteme-baby.com` + อุปกรณ์จริง
6. **กติกาเหล็กที่ต้องคง:** ห้ามเขียน DONE จน Owner ทดสอบผ่าน · ห้าม mock/stub ใน production path · เทสต์ ≥ 1291 (ปัจจุบัน 1317/1317) · production write = Owner approve · เงียบ error ห้ามมีอีก (ทุก read ต้อง surfacing) · ไทยไม่ผ่าน shell · สถานะเขียนทับเสมอ