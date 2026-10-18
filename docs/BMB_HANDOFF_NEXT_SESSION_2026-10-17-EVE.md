# HANDOFF → แชทถัดไป (อัปเดต 18 ต.ค. 2026 — FINAL PRE-TEST CLOSURE)

> **สถานะรวม:** ปิดงานค้างทุกข้อที่ทำได้ด้วยโค้ด+สิทธิ์ปัจจุบันแล้ว (Theater/Waiting Stage unity + เปิด/ปิด Theater / login context restoration / G6-G7 alignment + regression tests) — เหลือ **Owner E2E ทดสอบเปิดร้านจริง** ตาม §3 + Blocker ภายนอก §4
> เอกสารนี้ถูก**เขียนทับทั้งฉบับ**ตามกติกา "อัปเดต = เขียนทับ ห้ามเขียนต่อ" — ประวัติเก่าดูจาก git

---

## 1. สถานะปัจจุบัน (verified 18 ต.ค. 2026 — gates รอบ PRE-TEST CLOSURE)

| หัวข้อ | สถานะจริง |
|---|---|
| Theater/Waiting Stage unity (ค้าง PRE-OPENING) | ✅ **ปิดแล้ว** — มาสคอตบนเวที FoodTheater (ทั้ง stage + empty) = ปุ่มเปิด Talk to Bite ชุดเดียวกับ Floating Bite (`openChat()` → overlay ตัวเดียว) + บริบทจริง (route + จำนวนตะกร้า) |
| เปิด/ปิด Theater + ซื้อผ่านหน้าร้านปกติ | ✅ **ปิดแล้ว** — ปุ่ม `theater-toggle` (preference รายเครื่อง `bmb_theater_open`, default เปิด) — สถานะปิด = ปุ่มเปิดใหม่ + ปุ่มไป `/menu` (ส่วนร้าน /shop ใช้ได้เสมอ) |
| Login context restoration (ค้าง PRE-OPENING) | ✅ **ปิดแล้ว** — returnTo (`state.from` + `?next=`) ไหลผ่าน Login ↔ Register ครบ — ไม่วน Landing เมื่อมีหน้าเป้าหมาย |
| G6/G7 order boundary (§3 คำสั่งรอบนี้) | ✅ enforcement ครบชั้นสอดคล้องกัน (Policy read-only · Tool get_* · Web cart-only · Server create-only + idempotent) + อัปเดตสัญญา G6/G7 + tests ใหม่ 12 ข้อ |
| ของพรีออเดอร์ใต้หัวข้อเดิม + ปุ่มจองล่วงหน้า 2 จุด | ✅ (PREORDER-MERGE / PREORDER-ENTRY 2026-10-18) — workflow เดียวกัน |
| Rounds 3 รอบ/วัน + ปิด/เต็ม/พ้น cutoff | ✅ `delivery_rounds` จริง + UI disabled + `ERR_ROUND_CLOSED` server authority |
| Mixed cart (same-day + pre-order) | ✅ split 2 order + COD-only + ห้ามเคลมสำเร็จถ้า child พัง (`checkoutMixedSplit`) |
| Cart/Context คงข้ามหน้า/เข้าสู่ระบบ | ✅ `cartPersistence` (rebuild ผ่าน cartStore + revalidate) — login ไม่แตะตะกร้า |
| Bite บริบทจริง (§5) | ✅ `composeRealContext()` + memory แยกตาม customerId + `cartContextIsolation` |
| Facebook (webhook/dedup/intake กลาง — §4) | ✅ โค้ดพร้อม (HMAC signature · verify token · self-echo guard · event dedup · `p_external_ref_id`) — ทดสอบได้ระดับสิทธิ์ปัจจุบัน · Meta App Review ชะลอ |
| Audience Voices / Content entry (§6) | ✅ รีวิว = ตารางจริง + ภาพลูกค้าจริง + testimonial label (RE-D2) · ทางเข้า 6 เส้นทางใช้ workflow จริง |
| Gates รอบนี้ | ✅ lint=0 (384 ไฟล์) · tests **109 ไฟล์ / 1,172 ข้อ** ผ่านทั้งหมด · build=0 (tsc+vite+PWA) |
| ⚠️ งบ OpenRouter | เหลือ ~$5 / $160 — **เติมงบก่อนเทสต์ AI จริง** |
| ⚠️ Git | commit ท้องถิ่นแล้ว — **ยังไม่ push** (push = auto-deploy production → รอคำสั่ง Owner) |
| Google Maps | ✅ ใช้งานได้แล้วบน prod (ตรวจแล้วรอบก่อน — build `1cada70`) |
| Clean slate ทดสอบจริง | ✅ ข้อมูลธุรกรรม = 0 ทั้งระบบ + บัญชีลูกค้า 37 ใช้ได้ (CLEAN-SLATE-ROUNDS-2026-10-18) |

## 2. สิ่งที่ปิดรอบนี้ (PRETEST-CLOSURE-2026-10-18)

1. **Theater/Waiting Stage unity** — `FoodTheater.tsx`: มาสคอตบนเวทีเป็นปุ่ม `theater-mascot-chat` → `openChat()` ของ `useBiteAIStore` = TalkToBite overlay **ตัวเดียวกับ** Floating Bite (ไม่มีแชตคู่ขนาน) + CSS `.theater-greeting-mascot-btn` — test `theaterUnity` (10 ข้อ)
2. **เปิด/ปิด Theater** — ปุ่ม `theater-toggle` + `src/lib/theaterPreferences.ts` (ใหม่: `readTheaterOpen`/`writeTheaterOpen`, localStorage, default เปิด, ไม่ throw) — ปิดแล้วซื้อผ่านหน้าร้านปกติได้ทันที
3. **Login context restoration** — `LoginPage.tsx` พก `state.from` ไป /register · `RegisterPage.tsx` รับ `from`/`?next=` และส่งต่อทั้ง `navigate('/login', {state})` + ลิงก์กลับ — test `loginContextRestoration` (8 ข้อ)
4. **G6/G7 (§3)** — ตรวจ Policy/Tool/API/Server enforcement ครบชั้น = สอดคล้องกับการตัดสินใจ "AI สร้างออเดอร์ใหม่ผ่าน workflow อนุญาตได้ · ห้ามแก้ออเดอร์เดิม" → แก้เฉพาะจุดจำเป็น: `BMB_G6_CONTRACT.md`/`BMB_G7_CONTRACT.md` (RULE REVISION note) + `BMB_G6_WORKLOG.md` (แถว G6-09) + test ใหม่ `g6g7OrderBoundary` (12 ข้อ — pin ทุกชั้น + doc-code alignment)
5. **shopRoute timeout** 20s → 60s เฉพาะ heavy-mount test (assertion คงเดิม — ที่เหลือไม่แตะ)
6. **ไฟล์แก้ไข:** `FoodTheater.tsx` · `theaterPreferences.ts` (ใหม่) · `index.css` · `LoginPage.tsx` · `RegisterPage.tsx` · `shopRoute.test.ts` · tests ใหม่ 3 ไฟล์ · `BMB_G6_CONTRACT.md` · `BMB_G7_CONTRACT.md` · `BMB_G6_WORKLOG.md`

---

## 3. Owner E2E Checklist — Final (ทดสอบเปิดร้านจริง เริ่มได้ทันที)

**ก่อนเริ่ม:** ① เติมงบ OpenRouter ให้พอ (ปัจจุบัน ~$5 — AI จะหยุดตอบเมื่อถึงเพดาน) ② ทดสอบบน **biteme-baby.com เท่านั้น** (`*.bitemebaby.pages.dev` = stale) ③ ข้อมูลธุรกรรมว่าง + รอบส่ง 3 รอบ/วัน + บัญชีลูกค้า 37 ใช้ได้
**⚠️ จุดที่ต้องยืนยันก่อนดำเนินการ (เงินจริง/ตั้งค่าที่กระทบการรับออเดอร์):** การทดสอบจ่ายเงินจริง (PromptPay/Omise live) · การเปิดรับออเดอร์จริงจากลูกค้า · การเปลี่ยนคีย์ live — **ทั้งหมดให้ Owner ยืนยันก่อนเริ่ม**; ถ้าใช้ test mode ได้ให้เริ่มจาก test mode ก่อน

### 3.1 เว็บไซต์ (Login / Cart / Pre-order / Rounds)
- [ ] Login ด้วยบัญชีลูกค้า → เข้าหน้าที่ตั้งใจไว้ (ลองจาก /checkout: ต้องย้อนกลับ /checkout ไม่ใช่ Landing) + ตะกร้าที่มีของอยู่ก่อน login **ไม่หาย**
- [ ] Register ใหม่จากหน้า /checkout → สมัครเสร็จ → ได้กลับ /checkout (context ไม่หลุด)
- [ ] ปุ่ม "จองล่วงหน้า" หน้าแรก + ก่อนฟุตเตอร์ → แท็บ "จองล่วงหน้า (7)" + workflow เดียวกัน
- [ ] **เปิด/ปิด Theater:** ปุ่ม `✕` บนโรงละคร → ปิด → กดเปิดใหม่ (`🎭`) ได้ + ตอนปิดยังซื้อผ่าน /menu + แถวร้านด้านล่างได้ครบ
- [ ] มาสคอตบนเวทีโรงละคร → เปิดแชต Talk to Bite **ชุดเดียวกับ** Floating Bite (ไม่มีแชตซ้ำ)
- [ ] Bite ตอบโดยอ้างอิงตะกร้าจริง (สั่งของเข้าตะกร้า 2 ชิ้น แล้วถาม "ตอนนี้ในตะกร้ามีอะไร" → ตอบตรง)
- [ ] รอบที่ปิด/เต็ม/พ้น cutoff = เลือกไม่ได้ (แถว disabled + ป้ายสถานะ) และ server ปฏิเสธจริง (`ERR_ROUND_CLOSED`)
- [ ] Mixed cart (same-day + pre-order ในตะกร้าเดียว) → ต้องได้ 2 ออเดอร์ + รับเงินสด/COD เท่านั้น (ถ้าเลือก PromptPay → ระบบปฏิเสธก่อนสร้างออเดอร์)
- [ ] Cart คงอยู่ระหว่างเปลี่ยนหน้า / reload / กลับมาใช้วันถัดไป (localStorage)

### 3.2 การชำระเงิน (⚠️ ยืนยันก่อนถ้าใช้เงินจริง)
- [ ] Checkout → เลือกรอบ + ที่อยู่ → สร้างออเดอร์ → ได้เลขที่ออเดอร์จริง
- [ ] PromptPay QR / Omise (test mode `4242 4242 4242 4242`) → ชำระสำเร็จ → `orders.payment_status='paid'` **มาจาก webhook เท่านั้น**
- [ ] จ่ายไม่สำเร็จ/ยกเลิกกลางคัน → ระบบไม่เคลมสำเร็จ + ไม่ clearCart
- [ ] หน้า `/track/<เลขที่>` เปิดได้โดยไม่ต้อง login (สำหรับลูกค้าจาก FB)

### 3.3 ระบบจัดการร้าน (/admin)
- [ ] ออเดอร์จากเว็บ + จาก Messenger ปรากฏใน /admin **ชุดเดียวกัน** (source_channel ระบุที่มา)
- [ ] สวิตช์เปิด/ปิดรอบ + เมนูในแอดมิน → มีผลทันทีกับหน้าลูกค้า
- [ ] เดินสถานะออเดอร์ (รับ → ทำ → ส่ง → สำเร็จ) → tracking ลูกค้าอัปเดตตาม
- [ ] แอดมินแก้ราคา/สต็อก → หน้าร้าน/การคิดเงินใช้ค่าใหม่ (server re-derive)

### 3.4 Facebook (ระดับสิทธิ์ปัจจุบัน — Meta App Review ชะลอ)
- [ ] **Messenger:** "สั่งผัดไทย 2 จาน" → ถามยืนยันถ้าไม่ครบ → ยืนยัน → ได้**เลขที่ออเดอร์จริง** + ลิงก์จ่ายเงิน/ติดตาม
- [ ] **ส่งข้อความเดิมซ้ำ (webhook retry) → เลขที่เดิม** (idempotent ไม่สร้างออเดอร์ซ้ำ — ตรวจ `audit_logs` เห็น `channel_event_duplicate`)
- [ ] **Comment สาธารณะ** ใต้โพสต์ → ตอบไม่เปิดเผยรายละเอียดตะกร้า/ข้อมูลส่วนตัว + ชวนเข้า Inbox
- [ ] ข้อความกำกวม ("เอาข้าวหน่อย") → AI ถามก่อน ไม่เดาสินค้า/จำนวน
- [ ] ลูกค้าจาก FB เปิดเว็บ → ติดตามออเดอร์ผ่านลิงก์/เลขที่ได้ (ไม่เดาว่าเป็นลูกค้าคนเดียวกับบัญชีเว็บ)
- [ ] **หมายเหตุสิทธิ์:** ทดสอบได้เฉพาะเพจ/บัญชีที่ผูก webhook แล้ว (ตัว Owner เอง) — **ห้ามอ้างว่าผ่านกับลูกค้าทั่วไป** จนกว่า Meta App Review จะอนุมัติ

### 3.5 AI / Fallback
- [ ] AI ตอบตามแคตตาล็อกจริง (ชื่อ/ราคาตรงเมนู ไม่มั่ว) — ทั้งเว็บและ Messenger
- [ ] AI แตะ/แก้/ยกเลิกออเดอร์เดิมไม่ได้ (ลองสั่ง "ยกเลิกออเดอร์ BMB-xxx" → ต้องปฏิเสธ + `audit_logs` ไม่มี mutation)
- [ ] AI ล่ม/งบหมด → เว็บสั่งซื้อเองได้ตามปกติทุกฟังก์ชัน

---

## 4. Blocker เหลือ (Owner / ภายนอก — ปิดเองไม่ได้ในรอบนี้)

| # | Blocker | ใครต้องทำ |
|---|---|---|
| 1 | **งบ OpenRouter เหลือ ~$5 / $160** — AI ทุกตัว (Bite เว็บ + FB) จะหยุดตอบเมื่อถึงเพดาน | Owner เติมงบ/ขึ้น limit **ก่อน**เทสต์ AI |
| 2 | **Push = deploy production** — โค้ดรอบนี้ commit ท้องถิ่นแล้ว (gates เขียว) | Owner สั่ง push (หรือสั่งให้รอก่อน) |
| 3 | **Meta App Review ชะลอ** — สิทธิ์ FB ปัจจุบันทดสอบได้เฉพาะเพจ/บัญชีที่ผูก webhook (Owner เท่านั้น) | รอบถัดไปค่อยทำ App Review |
| 4 | **"coming soon" 2 ตัว (฿1) + หัวข้อ "สินค้าสำเร็จรูป"** — ไม่ทราบที่มา ยังไม่แตะ | Owner สั่งลบ/ซ่อน/เก็บ |
| 5 | **การจ่ายเงินจริง/เปิดรับออเดอร์จริง** — ต้องใช้เงินจริง/คีย์ live | Owner ยืนยันก่อนเริ่ม (ดู §3 ข้อ ⚠️) |
| 6 | เช็กภาพจริงบนเครื่อง Owner หลัง deploy (Maps/fee error/รูปลอย/แถวรอบ/ปุ่มจองล่วงหน้า) | Owner ดูบนอุปกรณ์จริง |

## 5. กติกา/สัญญาที่ต้องรักษา (คงเดิม)

- **เอกสารสถานะ = เขียนทับทั้งฉบับ ห้าม append** (คำสั่ง Owner 17 ต.ค. รอบดึก) · `.clinerules` ห้าม commit · **HARD STOP ห้ามขายจริงจน Owner สั่ง go**
- Contract tests ที่ต้องรักษา: `g6Security` (G6-09 revised) · `socialOrderIntake` (20) · `socialAiContinuity` · `menuScheduleRoundLink` (9) · `preOrderEntry` (9) · `deliveryRoundStatus` (9) · `menuCartResultGuard` · `cartContextIsolation` · **`g6g7OrderBoundary` (12 — ใหม่รอบนี้)** · `theaterUnity` (10) · `loginContextRestoration` (8)
- **G6/G7 boundary (ประกาศในสัญญาแล้ว):** AI สร้างออเดอร์**ใหม่**ผ่าน `_shared/socialOrderIntake.ts` → `create_order_with_items` (create-only + `p_external_ref_id` idempotent) เท่านั้น — ห้ามแก้/ยกเลิก/เปลี่ยนจำนวน/ราคา/สถานะออเดอร์เดิมโดยพลการ · ห้ามเคลมว่ารับออเดอร์/จ่ายเงินสำเร็จก่อนระบบยืนยัน
- Deploy EF (เมื่อมีโค้ด EF เปลี่ยน): ใช้ `SUPABASE_ACCESS_TOKEN` จาก `.env.local` แล้ว `supabase functions deploy <name> --project-ref ivkdfognyiwjcmrhcnwz` (งาน EF = รอ Owner อนุมัติเสมอก่อน deploy ที่กระทบ production flow) — **รอบนี้ไม่มีโค้ด EF เปลี่ยน ไม่ต้อง deploy**
- Meta App Review = ชะลอตามคำสั่ง · เพจ/สิทธิ์ FB จริง = Owner เทสต์เอง · ทดสอบบน `biteme-baby.com` เท่านั้น (`*.bitemebaby.pages.dev` = stale)

