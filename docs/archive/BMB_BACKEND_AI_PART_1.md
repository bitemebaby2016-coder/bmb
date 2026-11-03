# BMB — Backend+AI Part 1 (สร้างใหม่ 2026-10-27)

> **ที่มา:** เอกสารชื่อ "Backend+AI Part 1" ถูกอ้างโดย `BMB_PRODUCTION_TEST_PACK.md` §F/§G/§H/§I/L-10/L-11
> มาตลอด แต่**ไม่เคยมีอยู่จริงใน repo** (ค้นทั้ง `docs/`, `docs/archive/`, root แล้ว) —
> Owner สั่ง 2026-10-27: "Backend+AI Part 1 ไม่เคยสร้างนะ ต้องใช้สร้างใหม่เลย" → เอกสารนี้
> **เรียบเรียงใหม่จากโค้ดจริง ณ HEAD รอบ R9** ทุกหัวข้อ = สิ่งที่มีอยู่จริงในระบบตอนนี้
> (ถ้าท่านมีต้นฉบับเดิมในเครื่อง ส่งมาเทียบได้ — รายการไหนไม่ตรงให้ยึดต้นฉบับท่าน)
>
> **วิธีใช้:** แต่ละ § = "ของจริงอยู่ไหน + วิธีทดสอบ + เกณฑ์ผ่าน" — ใช้คู่กับ
> `docs/BMB_OWNER_ROLE_TEST_GUIDE_2026-10-27.md` §14 (แถวเดียวกัน)
>
> **ปรับปรุงรอบ R19 (2026-10-29 · N2 ต่อ checklist ข้อ 2-8 "รอปรับปรุงเพิ่ม"):**
> ไล่ตรวจทุก § เทียบโค้ดจริงที่ HEAD รอบนี้ → แก้จุดที่คลาดเคลื่อน (§F เส้นทางสั่งซื้อจริง ·
> §H รายชื่อไฟล์/proxy) · เติมสิ่งที่ขาด (§G = P1 คีย์ Google Maps ต้องจำกัด referrer +
> สถานะ external providers · §I = copy ทั้งเว็บ + guards อัตโนมัติ) · อัปเดต L-10/L-11
> — ทุกข้ออ้างอิงชี้ไฟล์/เทสต์ที่มีอยู่จริง (No evidence = not done) ·
> ถ้าท่านมีต้นฉบับเดิม ส่งมาเทียบได้เสมอ (ต่าง = ยึดต้นฉบับท่าน)

---

## §F — Ring system (วงแหวน/สเตจของ Food Theater)

- **ของจริง:** `src/lib/theaterGeometry.ts` (วงกลม/ตำแหน่งสเตจ) · `src/lib/theaterReasons.ts`
  (เหตุผลที่การ์ดหมุนมา) · `src/lib/theaterPreferences.ts` (จำรสที่ชอบ) ·
  `src/components/theater/FoodTheater.tsx` (หน้าเวที `/shop`) · `src/components/theater/TheaterCards.tsx`
- **พฤติกรรม:** การ์ดเมนูหมุนบนวงแหวน — เลือกเมนูจากรายการจริงของร้าน (ไม่แต่งเมนูปลอม)
- **เส้นทางสั่งซื้อจริง (ตรวจซ้ำ R19):**
  - กด "เพิ่ม" บนการ์ด → `FoodTheater.add()` = `deriveOrderMode(p)` (canonical OD-3/OD-5) →
    `useCartStore.getState().addItem(p, qty, {}, mode)` — **semantics เดียวกับ `TalkToBite.addToCart`** (comment ในไฟล์)
  - กด "ปรับแต่ง"/"จองล่วงหน้า" → `onCustomize={handleSameDay}` / `onPreOrder={handlePreOrder}`
    ที่ `src/pages/HomePage.tsx:343` → เข้า **`runOrderBuilder` (`src/lib/orderEntry.ts:72`)** —
    เส้นทางสั่งซื้อ canonical เดียวที่หน้าแรก/เมนูใช้ร่วมกัน
  - **gate L-8:** pre-order-only ที่ยังไม่ลงปฏิทิน → toast `เมนูนี้ยังไม่ลงปฏิทินรอบถัดไป — ยังจองไม่ได้` (ห้ามเพิ่ม)
- **วิธีทดสอบ:** เปิด `/shop` → ต้องเห็นวงแหวน + การ์ดหมุน/สลับได้ · กดการ์ด → เข้า flow สั่งซื้อ
  ตามป้าย (สั่งทันที/จองล่วงหน้า) · เมนูยังไม่ลงปฏิทินต้องขึ้น toast ข้างต้น
- **เกณฑ์ผ่าน:** หมุนลื่น ไม่ค้าง · เมนูบนเวที = เมนูจริงตรงแคตตาล็อก · กดสั่งแล้วเข้าตะกร้าถูกโหมด
  (โหมดมาจาก `deriveOrderMode` เดียวกันทุกจุดเข้า — ไม่มีเส้นทางที่สอง)
- **เทสต์ที่เกี่ยวข้อง (ตรวจว่ามีจริงแล้ว):** `theaterStage.test.ts` · `theaterUnity.test.ts` ·
  `theaterReasons.test.ts` · `theaterDailyCopy.test.ts`

## §G — N-1: คีย์/ผู้ให้บริการภายนอก (เดิมเรียก "Bing API key")

- **ความจริง 2026-10-27:** ค้นทั้ง `src/` **ไม่มี Bing integration** — แผนที่ใช้ **Google Maps**
  (`src/lib/googleMaps.ts` — `MAPS_KEY` จาก env · `reverseGeocode` · `computeGoogleRoute`) และ
  ผู้ส่งของมี `src/lib/externalProviders.ts` (Grab/LineMan/Foodpanda stub — ปิดอยู่ตาม
  `delivery_policy.external_methods_enabled = []`)
- **ถ้า "N-1/Bing" หมายถึงคีย์แผนที่สำรอง:** ยังไม่ถูกสร้าง — ระบบตอนนี้ Google อย่างเดียว
  (คีย์ไม่มี/ถูกบล็อก = UI ใช้หมุดพิมพ์มือ lat/lng แทนได้ — `DeliveryMapPicker` fallback)
- **🆕 P1 ค้าง Owner (QA review 2026-10-29 ข้อ 5.4):** `src/lib/googleMaps.ts` มี `fetch()` 5 จุด
  ที่ยิงจาก **ฝั่ง client** → คีย์ถูกจำกัดด้วย **HTTP referrer ใน Google Cloud Console เท่านั้น**
  (env `VITE_*` = ฝั่ง browser อยู่แล้ว — การจำกัด referrer เป็นสิ่งที่ท่านต้องทำในคอนโซล ไม่ใช่โค้드)
- **สถานะ external providers (คงเดิม · รอ Owner):** `src/lib/externalProviders.ts` = mock adapter
  ทั้ง Grab/LineMan/Foodpanda · ปิดอยู่ตาม `delivery_policy.external_methods_enabled = []`
  → เลือกได้ 2 ทาง: ใส่ credentials จริง หรือ ปิด module ทิ้ง (ไม่มีผลกระทบกับไรเดอร์ของร้าน — ทำงานจริงแล้ว)
- **วิธีทดสอบ:** หน้าเช็คเอาท์ → แผนที่โหลดได้ · ปักหมุด → ยืนยัน → ที่อยู่เติมอัตโนมัติจาก
  reverse geocode (R9) · ค่าส่งมาจาก RPC `compute_delivery_fee` ไม่ใช่กูเกิล
- **เกณฑ์ผ่าน:** แผนที่แสดงหมุดถูกตำแหน่ง (ยืนยันแล้วโดย Owner 2026-10-27 ✓) · ไม่มีคีย์รั่วในโค้ด
  (`wave1BuildSecretScan` เฝ้าอยู่)

## §H — AI (CL1–CL4 / A1–A4)

- **ของจริง (ตรวจซ้ำ R19):** `src/lib/aiService.ts` (เส้นทางหลัก) · `src/lib/aiGuardrails.ts` + `aiGuardrailsAdv.ts`
  (กันหลุด/กันแต่งเมนู) · `src/lib/aiDbContext.ts` (context จาก DB จริง) · `src/lib/aiToolCalling.ts`
  · `src/lib/aiVoice.ts` · `src/lib/aiMemory.ts` + `aiServerMemory.ts` (ความจำรายลูกค้า/เซิร์ฟเวอร์)
  · `src/lib/aiModels.ts` (รายการโมเดล) · `src/components/ai/TalkToBite.tsx` (หน้าแชท)
- **proxy (W3a):** Edge Function **`ai-proxy`** — เรียกผ่าน `supabase.functions.invoke('ai-proxy', …)`
  ที่ `aiService.ts:176` และ `:435` · กันค้างด้วย Promise race (`aiService.ts:173` — invoke ไม่รับ AbortSignal)
  · guest ใช้ได้ (ส่ง anon key เป็น Bearer เมื่อไม่มี session · `:160`)
- **เทสต์ที่มีจริง:** `aiChatTimeout.test.ts` (CL4) · `aiGuardrails.test.ts` · `aiDbContext.test.ts` ·
  `aiRouting.test.ts` · `aiVoice.test.ts` · `aiVoiceServer.test.ts` · `aiServerMemory.test.ts`
- **CL1–CL4 (ตามพฤติกรรมโค้ด):** CL1 = ตอบจากแคตตาล็อกจริงเท่านั้น · CL2 = ห้ามแต่งราคา/เมนู ·
  CL3 = เกินขอบเขต → บอกให้ติดต่อร้าน · CL4 = timeout/fallback ไม่ค้าง (มี `aiChatTimeout.test.ts`)
- **A1–A4 (ตามพฤติกรรมโค้ด):** A1 = เพิ่มลงตะกร้าผ่าน `runOrderBuilder` เดียว · A2 = ปุ่มเดียวต่อการ์ด ·
  A3 = โหมดถูก (ป้ายปฏิทิน) · A4 = gate "ยังไม่ลงปฏิทิน" toast เดียวกันทุกจุดเข้า
- **วิธีทดสอบ:** `/talk-to-bite` → ถามเมนู/ราคา → ต้องตรงแคตตาล็อก · ขอเมนูที่ไม่มี → ต้องไม่แต่ง ·
  สั่งผ่านแชท → เข้าตะกร้าโหมดเดียวกับหน้าเมนู
- **เกณฑ์ผ่าน:** ไม่มีเมนู/ราคาปลอม · สั่งได้จริง 1 เส้นทาง · ค้าง/timeout = ข้อความ fallback ชัดเจน

## §I — Copy (ข้อความ/ป้ายทั้งเว็บ + ข้อความประจำวันของ Food Theater)

- **ของจริง (ตาม role guide §14):** ตรวจข้อความ/ป้าย **ทั้งเว็บ** — ไทยธรรมชาติ 100% ·
  ห้ามป้ายเทคนิค/placeholder/lorem หลุดถึงผู้ใช้
- **ของจริง — ข้อความหมุนรายวัน:** `src/lib/theaterDailyCopy.ts` + `src/lib/theaterEditorial.ts`
  (หมุนข้อความตามวัน · ไม่พิมพ์ซ้ำ · fallback เมื่อไม่มีข้อมูล · **`BANNED_KICKERS` ห้ามใช้คำต้องห้าม**
  อยู่ที่ `src/lib/theaterEditorial.ts`)
- **guards อัตโนมัติ (รันทุกก่อน commit):** `npm run lint` = `eslint . && node scripts/brandNameGuard.cjs`
  (brandNameGuard = **449 ไฟล์**) · **languageSanity = 1,257 จุด** — เขียวทุกรอบ gates
  (evidence: `e2e/gates_r18_2026-10-29.log` บรรทัด "guards: brandNameGuard 449 OK + languageSanity 1257 OK")
- **วิธีทดสอบ:** `/shop` อ่านข้อความหัวเวที → ต้องไม่ซ้ำกับเมื่อวาน · แก้ copy ที่แอดมิน → หน้าเวทีเปลี่ยน ·
  เดินหน้าแรก/เมนู/โหวต/checkout/ฟุตเตอร์ → จดทุกจุดที่ภาษาไม่ธรรมชาติ (คำแปลตรงตัว/คำเทคนิค/ป้ายอังกฤษลอย ๆ)
- **เกณฑ์ผ่าน:** ข้อความหมุนจริง · ไม่มี placeholder/lorem ค้าง · guards ทั้งสองตัวเขียว ·
  ป้ายที่ Owner สั่งแก้รอบ R18/R19 ขึ้นตรงตามที่สั่ง

## L-10 — หน้า record (migration 159)

- **ของจริง:** migration 159 = parity functions (w7) · ledger มี 159 แล้ว
  (evidence `e2e/w7Apply159-record.json`) · หน้า/ปุ่ม approve record ที่เหลือคือ
  **L-10 รอบ Owner approve หน้า record** (ถ้าท่านยังไม่เคยกด approve) — ดู `BMB_PRODUCTION_TEST_PACK.md` L-10
- **วิธีทดสอบ:** ทำตาม L-10 ใน test pack (แอดมิน approve รายการ) · เกณฑ์ผ่าน = สถานะเปลี่ยน + บันทึก audit
- **สถานะ R19:** ยังเปิด = รอท่านกด approve ครั้งแรก (ถ้าเคยแล้ว แจ้งมาเพื่อปิดข้อ)

## L-11 — LED

- **ความจริง (ตรวจซ้ำ 2026-10-29):** **ไม่พบ "LED" ในโค้ด/เอกสารใดเลย** (ค้นทั้ง repo) — ถ้าหมายถึง
  ไฟแสดงสถานะ/ป้ายบอกทาง ต้องให้ท่านนิยามเพิ่ม · **ยังเป็นรายการเปิด ห้ามปิดข้อนี้ก่อนได้นิยามจากท่าน**
- **วิธีทดสอบ:** ยืนยันนิยามกับ Owner ก่อนรัน — ยังไม่มีขั้นทดสอบ (SKIPPED ≠ PASS)

---

## เกณฑ์ปิด Backend+AI Part 1

1. §F/§I = ทดสอบผ่านบน production จริง (ภาพหน้าจอ `/shop`)
2. §G = ยืนยันว่าใช้ Google Maps ตามนี้ (หรือส่งสเปก "Bing/N-1" เดิมมา) + **ทำ P1 จำกัด HTTP referrer ของคีย์ใน Google Cloud**
3. §H = ทดสอบ CL1–CL4/A1–A4 ผ่าน (จด toast verbatim ตาม convention)
4. L-10 = ถ้าท่าน approve แล้ว = ปิด · L-11 = ต้องได้นิยามจากท่านก่อน
5. **งานที่ยังรอท่านตัดสินใจ:** external providers (ใส่ credentials หรือปิด module) · L-11 นิยาม ·
   เทียบต้นฉบับ "Backend+AI Part 1" เดิมถ้ามี (ต่าง = ยึดต้นฉบับท่าน)

*เรียบเรียงโดย AI จากโค้ดจริง 2026-10-27 (R9) · **ปรับปรุง + ตรวจโค้ดซ้ำทุก § 2026-10-29 (R19 · N2/checklist 2-8)**
— ยังรอ Owner ยืนยัน/แก้ไข*
