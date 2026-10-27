# BMB — Backend+AI Part 1 (สร้างใหม่ 2026-10-27)

> **ที่มา:** เอกสารชื่อ "Backend+AI Part 1" ถูกอ้างโดย `BMB_PRODUCTION_TEST_PACK.md` §F/§G/§H/§I/L-10/L-11
> มาตลอด แต่**ไม่เคยมีอยู่จริงใน repo** (ค้นทั้ง `docs/`, `docs/archive/`, root แล้ว) —
> Owner สั่ง 2026-10-27: "Backend+AI Part 1 ไม่เคยสร้างนะ ต้องใช้สร้างใหม่เลย" → เอกสารนี้
> **เรียบเรียงใหม่จากโค้ดจริง ณ HEAD รอบ R9** ทุกหัวข้อ = สิ่งที่มีอยู่จริงในระบบตอนนี้
> (ถ้าท่านมีต้นฉบับเดิมในเครื่อง ส่งมาเทียบได้ — รายการไหนไม่ตรงให้ยึดต้นฉบับท่าน)
>
> **วิธีใช้:** แต่ละ § = "ของจริงอยู่ไหน + วิธีทดสอบ + เกณฑ์ผ่าน" — ใช้คู่กับ
> `docs/BMB_OWNER_ROLE_TEST_GUIDE_2026-10-27.md` §14 (แถวเดียวกัน)

---

## §F — Ring system (วงแหวน/สเตจของ Food Theater)

- **ของจริง:** `src/lib/theaterGeometry.ts` (วงกลม/ตำแหน่งสเตจ) · `src/lib/theaterReasons.ts`
  (เหตุผลที่การ์ดหมุนมา) · `src/lib/theaterPreferences.ts` (จำรสที่ชอบ) ·
  `src/components/theater/FoodTheater.tsx` (หน้าเวที `/shop`) · `src/components/theater/TheaterCards.tsx`
- **พฤติกรรม:** การ์ดเมนูหมุนบนวงแหวน — เลือกเมนูจากรายการจริงของร้าน (ไม่แต่งเมนูปลอม)
- **วิธีทดสอบ:** เปิด `/shop` → ต้องเห็นวงแหวน + การ์ดหมุน/สลับได้ · กดการ์ด → เข้า flow สั่งซื้อ
  ผ่าน `runOrderBuilder` เดียวกับหน้าเมนู (ปุ่ม "สั่งทันที"/"จองล่วงหน้า" ตามป้ายปฏิทิน)
- **เกณฑ์ผ่าน:** หมุนลื่น ไม่ค้าง · เมนูบนเวที = เมนูจริงตรงแคตตาล็อก · กดสั่งแล้วเข้าตะกร้าถูกโหมด
- **เทสต์ที่เกี่ยวข้อง:** `theaterStage.test.ts` · `theaterUnity.test.ts` · `theaterReasons.test.ts` ·
  `theaterDailyCopy.test.ts`

## §G — N-1: คีย์/ผู้ให้บริการภายนอก (เดิมเรียก "Bing API key")

- **ความจริง 2026-10-27:** ค้นทั้ง `src/` **ไม่มี Bing integration** — แผนที่ใช้ **Google Maps**
  (`src/lib/googleMaps.ts` — `MAPS_KEY` จาก env · `reverseGeocode` · `computeGoogleRoute`) และ
  ผู้ส่งของมี `src/lib/externalProviders.ts` (Grab/LineMan/Foodpanda stub — ปิดอยู่ตาม
  `delivery_policy.external_methods_enabled = []`)
- **ถ้า "N-1/Bing" หมายถึงคีย์แผนที่สำรอง:** ยังไม่ถูกสร้าง — ระบบตอนนี้ Google อย่างเดียว
  (คีย์ไม่มี/ถูกบล็อก = UI ใช้หมุดพิมพ์มือ lat/lng แทนได้ — `DeliveryMapPicker` fallback)
- **วิธีทดสอบ:** หน้าเช็คเอาท์ → แผนที่โหลดได้ · ปักหมุด → ยืนยัน → ที่อยู่เติมอัตโนมัติจาก
  reverse geocode (R9) · ค่าส่งมาจาก RPC `compute_delivery_fee` ไม่ใช่กูเกิล
- **เกณฑ์ผ่าน:** แผนที่แสดงหมุดถูกตำแหน่ง (ยืนยันแล้วโดย Owner 2026-10-27 ✓) · ไม่มีคีย์รั่วในโค้ด
  (`wave1BuildSecretScan` เฝ้าอยู่)

## §H — AI (CL1–CL4 / A1–A4)

- **ของจริง:** `src/lib/aiService.ts` (เส้นทางหลัก) · `src/lib/aiGuardrails.ts` + `aiGuardrailsAdv.ts`
  (กันหลุด/กันแต่งเมนู) · `src/lib/aiDbContext.ts` (context จาก DB จริง) · `src/lib/aiToolCalling.ts`
  · `src/lib/aiVoice.ts` · `src/components/ai/TalkToBite.tsx` (หน้าแชท) · proxy = Edge Function (W3a)
- **CL1–CL4 (ตามพฤติกรรมโค้ด):** CL1 = ตอบจากแคตตาล็อกจริงเท่านั้น · CL2 = ห้ามแต่งราคา/เมนู ·
  CL3 = เกินขอบเขต → บอกให้ติดต่อร้าน · CL4 = timeout/fallback ไม่ค้าง (มี `aiChatTimeout.test.ts`)
- **A1–A4 (ตามพฤติกรรมโค้ด):** A1 = เพิ่มลงตะกร้าผ่าน `runOrderBuilder` เดียว · A2 = ปุ่มเดียวต่อการ์ด ·
  A3 = โหมดถูก (ป้ายปฏิทิน) · A4 = gate "ยังไม่ลงปฏิทิน" toast เดียวกันทุกจุดเข้า
- **วิธีทดสอบ:** `/talk-to-bite` → ถามเมนู/ราคา → ต้องตรงแคตตาล็อก · ขอเมนูที่ไม่มี → ต้องไม่แต่ง ·
  สั่งผ่านแชท → เข้าตะกร้าโหมดเดียวกับหน้าเมนู
- **เกณฑ์ผ่าน:** ไม่มีเมนู/ราคาปลอม · สั่งได้จริง 1 เส้นทาง · ค้าง/timeout = ข้อความ fallback ชัดเจน

## §I — Copy (ข้อความประจำวันของ Food Theater)

- **ของจริง:** `src/lib/theaterDailyCopy.ts` + `src/lib/theaterEditorial.ts` (หมุนข้อความตามวัน ·
  ไม่พิมพ์ซ้ำ · fallback เมื่อไม่มีข้อมูล)
- **วิธีทดสอบ:** `/shop` อ่านข้อความหัวเวที → ต้องไม่ซ้ำกับเมื่อวาน · แก้ copy ที่แอดมิน → หน้าเวทีเปลี่ยน
- **เกณฑ์ผ่าน:** ข้อความหมุนจริง · ไม่มี placeholder/lorem ค้าง

## L-10 — หน้า record (migration 159)

- **ของจริง:** migration 159 = parity functions (w7) · หน้า/ปุ่ม approve record ที่เหลือคือ
  **L-10 รอบ Owner approve หน้า record** (ถ้าท่านยังไม่เคยกด approve) — ดู `BMB_PRODUCTION_TEST_PACK.md` L-10
- **วิธีทดสอบ:** ทำตาม L-10 ใน test pack (แอดมิน approve รายการ) · เกณฑ์ผ่าน = สถานะเปลี่ยน + บันทึก audit

## L-11 — LED

- **ความจริง 2026-10-27:** **ไม่พบ "LED" ในโค้ด/เอกสารใดเลย** (ค้นทั้ง repo แล้ว) — ถ้าหมายถึง
  ไฟแสดงสถานะ/ป้ายบอกทาง ต้องให้ท่านนิยามเพิ่ม · **ยังเป็นรายการเปิด**

---

## เกณฑ์ปิด Backend+AI Part 1

1. §F/§I = ทดสอบผ่านบน production จริง (ภาพหน้าจอ `/shop`)
2. §G = ยืนยันว่าใช้ Google Maps ตามนี้ (หรือส่งสเปก "Bing/N-1" เดิมมา)
3. §H = ทดสอบ CL1–CL4/A1–A4 ผ่าน (จด toast verbatim ตาม convention)
4. L-10 = ถ้าท่าน approve แล้ว = ปิด · L-11 = ต้องได้นิยามจากท่านก่อน

*เรียบเรียงโดย AI จากโค้ดจริง 2026-10-27 (R9) — รอ Owner ยืนยัน/แก้ไข*
