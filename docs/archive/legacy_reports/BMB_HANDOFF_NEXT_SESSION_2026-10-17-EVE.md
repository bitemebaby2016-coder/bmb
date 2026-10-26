# HANDOFF → แชทถัดไป (อัปเดต 19 ต.ค. 2026 — REAL-TEST FIX / รอบแก้ตามผลทดสอบจริง)

> **สถานะรวม:** แก้ครบตามคำสั่ง Owner รอบทดสอบจริง 19 ต.ค. (ค่าครัวเพี้ยน 200+ กม. · คูปองไม่คำนวณ · หน้าจ่ายเงินไม่โชว์ส่วนลด · same-day ต้องทันทีอัตโนมัติ · แสตมป์พรีออเดอร์เกินวัน · ฟอร์มไรเดอร์ dropdown) — commit+push ได้รับอนุญาตแล้ว
> เอกสารนี้ถูก**เขียนทับทั้งฉบับ**ตามกติกา "อัปเดต = เขียนทับ ห้ามเขียนต่อ" — ประวัติเก่าดูจาก git

---

## 1. สถานะปัจจุบัน (verified 19 ต.ค. 2026 — รอบ REAL-TEST FIX)

| หัวข้อ | สถานะจริง |
|---|---|
| Audit "งานสั่งแล้วค้างอยู่ไหม" | ✅ **ตอบแล้วตามจริง** — ไม่มีงานค้างใน stage/stash · Master Plan same-day/pre-order phases 0-6 + promo engine + mode consistency = commit แล้วทั้งหมด · สิ่งที่เจอ = ช่องว่างที่ phase ไม่ครอบคลุม (ดู AI_WORK_STATE รอบนี้) |
| ค่าระยะทาง/ค่าส่ง/ช่องทางมั่ว (ห่างครัว 200+ กม.) | ✅ **ปิดแล้ว** — root cause: fallback พิกัดครัวผิด (10.7016, 102.1429) ใน 7 จุด → รวมเป็น `src/config/kitchenLocation.ts` (ครัวจริง 12.615659, 102.098063) จุดเดียว |
| โปรโมชั่น "ใช้ไม่ได้/ไม่คำนวณให้เห็น" | ✅ — engine จริงมีอยู่แล้ว (WELCOME10 ใช้ได้) แต่ cart ไม่ recalc → แก้แล้ว + หน้าชำระเงินโชว์สินค้า/ส่วนลด/ค่าจัดส่ง/รวม |
| same-day vs pre-order มั่ว | ✅ — same-day = **จัดส่งทันที ระบบเลือกรอบให้อัตโนมัติ** (ไม่ต้องเลือกเอง, เลือกรอบที่เวลาปัจจุบันอยู่ในหน้าต่างส่งก่อน) · pre-order = เลือกวัน/รอบเหมือนเดิม · server gates ไม่แตะ |
| พรีออเดอร์เกินวันไม่มีแสตมป์ | ✅ — FoodMenuCard + MenuPage: วันจาก menu_schedule < วันนี้ → "หมดเวลาจอง (Out of stock)" + ปิดปุ่มจอง |
| ลงทะเบียนไดรเวอร์ (Owner สั่ง 19 ต.ค.) | ✅ — dropdown เลือกจากผู้ใช้ที่ลงทะเบียนบนเว็บแล้ว (เติมชื่อ/เบอร์อัตโนมัติ) + dropdown พาหนะ · ลูกค้า 2 คนที่เพิ่ม: `jin.pao66` (Pual bite drive — จะเป็นไดรเวอร์) + `siamportal` |
| แผนที่ checkout ไม่ขึ้น (บางเครื่อง) | ⚠️ ใช้ GPS/ป้อนพิกัดแทนได้จริงระหว่างทดสอบ — ถ้ายังโหลดไม่ขึ้น = เช็ก Google Cloud key/referrer restriction (ฝั่ง Owner) · โค้ดพร้อมตั้งแต่ build `1cada70` |
| Encoding (Owner เตือน BOM/mojibake) | ✅ — แก้ผ่าน editor เท่านั้น · สแกนทั้ง repo = 0 mojibake / 358 ไฟล์ · BOM 21 ไฟล์คงเดิม |
| "coming soon" 2 ตัว + "สินค้าสำเร็จรูป" | ✅ เก็บไว้ตามคำสั่ง — ของจริงที่ Owner จะเปลี่ยนเอง |
| Gates รอบนี้ | ✅ lint=0 (385) · tests เต็มชุดผ่าน · build=0 |

## 2. สิ่งที่ปิดรอบนี้ (REAL-TEST-FIX-2026-10-19)

1. **พิกัดครัว single source** (`src/config/kitchenLocation.ts`) — แก้ fallback ใน locationStore/deliveryFeeApi/externalProviders/routeOptimization/seo/ContactPage/RouteOptimizationPage + อัปเดตเทสต์ค่าจัดส่ง
2. **คูปอง recalc ทันที** (`cartStore.ts`) + **หน้าชำระเงินโชว์การคำนวณ** (PaymentConfirmationPage)
3. **same-day "จัดส่งทันที" อัตโนมัติ** (CheckoutPage — แยกจากพรีออเดอร์ชัด + เลือกรอบตามหน้าต่างเวลาปัจจุบัน)
4. **แสตมป์ Out of stock พรีออเดอร์เกินวัน** (FoodMenuCard + MenuPage)
5. **ฟอร์มไรเดอร์ dropdown** (DeliveryManagement — เลือกคนลงทะเบียนแล้ว + พาหนะ) + ลบโค้ดซ้ำ
6. หมายเหตุ audit: ไม่มีงานค้างใน stage — ทุกอย่าง commit แล้ว (รายละเอียด AI_WORK_STATE)

---

## 3. Owner E2E Checklist — รอบทดสอบซ้ำ (เช็กจุดที่เพิ่งแก้ก่อน)

**ก่อนเริ่ม:** ① ทดสอบบน **biteme-baby.com เท่านั้น** + hard refresh (Ctrl+F5) ② เงินจริง/เปิดรับจริง/คีย์ live = ยืนยันก่อนเสมอ

### 3.1 จุดที่เพิ่งแก้ — เช็กก่อนเลย
- [ ] หน้า /check (checkout): ปักหมุดที่ครัว → **ระยะทาง ≈ 0 กม. ค่าจัดส่งโซนร้าน ไม่ใช่ 200+ กม./฿1748** · แถวสรุปไม่มั่ว
- [ ] ตะกร้า: พิมพ์ `WELCOME10` กดใช้โค้ด → **แถวส่วนลด -10% ขึ้นทันที** ในสรุป
- [ ] หน้าชำระเงิน (/payment/...): **โชว์สินค้า/ส่วนลด/ค่าจัดส่ง/รวม** (ไม่ใช่แค่ยอดรวม)
- [ ] สั่ง same-day: **ไม่ต้องเลือกรอบ** — เห็นการ์ด "จัดส่งทันที ระบบเลือกรอบให้อัตโนมัติ" · สั่งพรีออเดอร์: ยังเลือกวัน/รอบตามเดิม
- [ ] เมนูพรีออเดอร์ที่เลยวันแล้ว → **แสตมป์ "หมดเวลาจอง (Out of stock)"** + ปุ่มจองปิด
- [ ] หน้า /admin/delivery: **dropdown เลือกผู้ลงทะเบียนแล้ว (Pual bite drive) + dropdown พาหนะ** → บันทึกไรเดอร์ → ผูกบัญชี → เข้า /rider ได้
- [ ] หน้า /admin/rounds: ภาษาไทย/อิโมจิครบ (ซ่อมแล้วรอบก่อน)

### 3.2 เดินต่อตาม checklist รอบก่อน (ยังใช้ได้)
- [ ] Login/Register จาก /checkout กลับ /checkout ครบ + ตะกร้าไม่หาย · Mixed cart = 2 ออเดอร์ + COD
- [ ] จ่าย PromptPay/Omise test mode (`4242 4242 4242 4242`) → 'paid' จาก webhook · จ่ายไม่สำเร็จ = ไม่เคลมสำเร็จ
- [ ] Messenger: สั่ง → เลขที่จริง · ซ้ำ = เลขที่เดิม (idempotent) · AI แตะออเดอร์เดิมไม่ได้
- [ ] รอบปิด/เต็ม/พ้น cutoff = server ปฏิเสธ (`ERR_ROUND_CLOSED`)

## 4. Blocker เหลือ (Owner / ภายนอก)

| # | Blocker | ใครต้องทำ |
|---|---|---|
| 1 | **Meta App Review ชะลอ** — สิทธิ์ FB ทดสอบได้เฉพาะเพจ/บัญชี Owner | รอบถัดไปค่อยทำ App Review |
| 2 | **แผนที่ Google ไม่ขึ้นบางเครื่อง** — ถ้า GPS/ป้อนพิกัดแทนยังไม่พอ | Owner เช็ก Google Cloud key restriction (HTTP referrer) + billing |
| 3 | **"coming soon" 2 ตัว + "สินค้าสำเร็จรูป"** = ของจริงรอ Owner เปลี่ยน | Owner แก้ข้อมูลสินค้าเอง (ระบบห้ามแตะ) |
| 4 | ลงทะเบียนไรเดอร์จริง (เริ่มจาก Pual bite drive) | Owner ทำผ่าน dropdown ใหม่ |
| 5 | HARD STOP ห้ามขายจริงจน Owner สั่ง go | Owner เท่านั้น |

## 5. กติกา/สัญญาที่ต้องรักษา (คงเดิม)

- **เอกสารสถานะ = เขียนทับทั้งฉบับ ห้าม append** · `.clinerules` ห้าม commit · **HARD STOP ห้ามขายจริงจน Owner สั่ง go**
- **Encoding:** เขียนข้อความไทยผ่าน editor เท่านั้น (PowerShell `Get-Content` แสดงไฟล์ไม่มี BOM เพี้ยนได้เอง) · ค้นใน shell ใช้ `\uXXXX` · ก่อน commit ต้องสแกน mojibake = 0
- **พิกัดครัว = `src/config/kitchenLocation.ts` เท่านั้น** ห้าม hardcode ค่าใหม่ที่อื่น
- **G6/G7 boundary:** AI สร้างออเดอร์ใหม่ผ่าน `create_order_with_items` (create-only + idempotent) เท่านั้น · server gates (`ERR_ROUND_*`, cutoff, ความจุ, mode) = authority — ห้าม bypass ฝั่ง client
- Contract tests หลัก: `deliveryFeeApi` · `deliveryRouter` · `checkoutModeLock` · `checkoutMixedSplit` · `promotionClient` · `menuScheduleRoundLink` · `g6g7OrderBoundary` · `theaterUnity` · `loginContextRestoration`
- Deploy EF (ถ้ามีโค้ด EF เปลี่ยน): `SUPABASE_ACCESS_TOKEN` จาก `.env.local` → `supabase functions deploy <name> --project-ref ivkdfognyiwjcmrhcnwz` · ทดสอบบน `biteme-baby.com` เท่านั้น

