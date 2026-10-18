# HANDOFF → แชทถัดไป (อัปเดต 18 ต.ค. 2026 — FINAL PRE-TEST / พร้อมทดสอบ 100%)

> **สถานะรวม:** ปิดงานทุกข้อตามคำสั่ง Owner รอบดึกแล้ว (mojibake หน้ารอบจัดส่ง+FAQ · ลบไรเดอร์หมด · เก็บ "coming soon"/"สินค้าสำเร็จรูป" ไว้ · ข้อมูลทดสอบสะอาด) — **พร้อมเปิดทดสอบจริง** ตาม §3
> เอกสารนี้ถูก**เขียนทับทั้งฉบับ**ตามกติกา "อัปเดต = เขียนทับ ห้ามเขียนต่อ" — ประวัติเก่าดูจาก git

---

## 1. สถานะปัจจุบัน (verified 18 ต.ค. 2026 — รอบ FINAL PRE-TEST)

| หัวข้อ | สถานะจริง |
|---|---|
| ภาษาหน้ารอบจัดส่ง `/admin/rounds` + หน้า FAQ (เพี้ยนเป็น à¸£à¸­à¸š…) | ✅ **ปิดแล้ว** — root cause: ซอร์สถูก double-encode (CP1252) + ไบต์ NBSP หาย → ซ่อม **896 runs / 15 ไฟล์** (src 6 + EF 1 + archive 8) · สแกนซ้ำทั้ง repo = 0 · ตรวจ DB ทุกตาราง = ไม่มีเพี้ยน (บั๊กอยู่ที่ซอร์สอย่างเดียว) |
| Theater/Waiting Stage unity + เปิด/ปิด Theater | ✅ (PRETEST-CLOSURE 2026-10-18) — มาสคอตบนเวที = TalkToBite ตัวเดียวกับ Floating Bite + `theater-toggle` + fallback `/menu` |
| Login context restoration | ✅ (PRETEST-CLOSURE) — `state.from` + `?next=` ไหลผ่าน Login ↔ Register |
| G6/G7 order boundary | ✅ (PRETEST-CLOSURE) — create-only + idempotent + read-only tools · สัญญาอัปเดต · `g6g7OrderBoundary` (12) |
| ข้อมูลทดสอบ (เริ่มใหม่จริง) | ✅ **พร้อม** — ลูกค้า 0 (Owner ลบเอง เหลือแอดมิน 1) · **ไรเดอร์ 0** (ลบ 6 รายตามคำสั่ง — Owner จะลงทะเบียนใหม่) · test leftovers 0 (social_events/order_submissions/automation_queue) · ออเดอร์/เงิน/รีวิว = 0 · audit_logs เก็บตามสัญญา |
| Rounds 3 รอบ/วัน (18–24 ต.ค.) | ✅ 21 แถวตามมาตรฐาน — normalize รอบเช้า 18 ต.ค. ที่เบี่ยง ("(07:00-08:00)"/05:00/50) → "เช้า (06:00-09:00)"/08:00/60 แล้ว |
| "coming soon" 2 ตัว + หัวข้อ "สินค้าสำเร็จรูป" | ✅ **เก็บไว้ตามคำสั่ง** — เป็นของจริงที่ Owner จะเปลี่ยนเอง (ห้ามลบ/ห้ามซ่อน) |
| งบ OpenRouter | ✅ **ไม่ใช่ blocker** — งบ dev กับงบเอไอในเว็บ = คนละคีย์กัน (Owner ยืนยัน) |
| Facebook (webhook/dedup/intake) | ✅ โค้ดพร้อม (comment/audit text ใน channel-webhook ซ่อมแล้ว) — ทดสอบได้ระดับสิทธิ์ปัจจุบัน · Meta App Review ชะลอ |
| Gates รอบนี้ | ✅ lint=0 (384) · tests เต็มชุดผ่าน · build=0 (tsc+vite+PWA) |
| ⚠️ Push | **Owner อนุญาตแล้ว** — commit+push รอบนี้ = deploy production อัตโนมัติ |
| Google Maps | ✅ ใช้งานได้บน prod (build `1cada70`) |

## 2. สิ่งที่ปิดรอบนี้ (PRETEST-FINAL-2026-10-18)

1. **แก้ภาษาเพี้ยน (mojibake)** — เขียนเครื่องมือซ่อม CP1252→UTF-8 เฉพาะ run เสีย (จับเคสไบต์ `0xA0`/NBSP ถูก normalize เป็น space) — ซ่อม 896 runs / 15 ไฟล์: `AdminRounds.tsx` (37 — หัวข้อ/ปุ่ม/บรรทัดรอบส่ง), `FaqPage.tsx` (12), `AdminOrders.tsx`, `bmbAdminApi_orders.ts`, `canonicalOrderFlow.test.ts`, `channel-webhook/index.ts` (comment+audit text), archive docs 8 ไฟล์ — **residual 0** + ตรวจ DB ทุกตาราง = สะอาด
2. **ลบไรเดอร์ 6 ราย** ตามคำสั่ง (QA Rider A/B, QA W52 Driver, [STEP2-CT] Rider A/B, ไบท์ ไดรฟ์) — drivers=0, auth.users เหลือ 1 (แอดมิน) · เก็บ test leftovers เพิ่ม (social_events 9, order_submissions 2, automation_queue 3 → 0) เพื่อเริ่มทดสอบจริงสะอาด
3. **Normalize รอบเช้า 18 ต.ค.** ให้ตามมาตรฐาน (display_name/cutoff/capacity ตรงกับวันอื่น)
4. **บันทึกการตัดสินใจ Owner:** OpenRouter คนละคีย์ (ไม่เตือนเติมงบ) · "coming soon"/"สินค้าสำเร็จรูป" = ของจริง เก็บไว้ · ลูกค้าลบแล้วเหลือแอดมิน · อนุญาต commit+push
5. **Gates:** lint=0 · tests เต็มชุดผ่าน · build=0 · **commit + push (อนุญาตแล้ว)**

---

## 3. Owner E2E Checklist — Final (เริ่มทดสอบเปิดร้านจริงได้ทันที)

**ก่อนเริ่ม:** ① ทดสอบบน **biteme-baby.com เท่านั้น** (`*.bitemebaby.pages.dev` = stale) ② ข้อมูลว่าง+ไรเดอร์ 0 → เริ่มจาก **ลงทะเบียนไรเดอร์ใหม่** ในหน้าจัดส่ง (Owner จะลงทะเบียนเอง) ③ AI ใช้คีย์เว็บต่างหาก — ไม่ต้องเติมงบ dev
**⚠️ จุดที่ต้องยืนยันก่อนดำเนินการ (เงินจริง/ตั้งค่ากระทบรับออเดอร์):** ทดสอบจ่ายเงินจริง (PromptPay/Omise live) · เปิดรับออเดอร์จริง · เปลี่ยนคีย์ live — ให้ Owner ยืนยันก่อน; ถ้าใช้ test mode ได้เริ่มจาก test mode

### 3.1 เว็บไซต์ (Login / Cart / Pre-order / Rounds)
- [ ] Login จาก /checkout → ย้อนกลับ /checkout (ไม่ Landing) + ตะกร้าไม่หาย · Register จาก /checkout → ได้กลับ /checkout
- [ ] ปุ่ม "จองล่วงหน้า" หน้าแรก + ก่อนฟุตเตอร์ → แท็บ "จองล่วงหน้า (7)" workflow เดียวกัน
- [ ] **เปิด/ปิด Theater:** `✕` ปิด → เปิดใหม่ `🎭` ได้ + ตอนปิดซื้อผ่าน /menu + แถวร้านได้ครบ · มาสคอตบนเวที = แชตตัวเดียวกับ Floating Bite
- [ ] Bite ตอบอ้างอิงตะกร้าจริง (ถาม "ในตะกร้ามีอะไร" หลังสั่ง 2 ชิ้น → ตอบตรง)
- [ ] รอบปิด/เต็ม/พ้น cutoff = เลือกไม่ได้ + server ปฏิเสธ (`ERR_ROUND_CLOSED`) · **เช็กหน้า /admin/rounds: ภาษาไทย/อิโมจิแสดงถูกต้องทุกจุด**
- [ ] Mixed cart (same-day + pre-order) → 2 ออเดอร์ + COD เท่านั้น · Cart คงข้ามหน้า/reload/วันถัดไป

### 3.2 การชำระเงิน (⚠️ ยืนยันก่อนถ้าใช้เงินจริง)
- [ ] Checkout → เลือกรอบ+ที่อยู่ → ได้เลขที่ออเดอร์จริง
- [ ] PromptPay/Omise test mode (`4242 4242 4242 4242`) → `payment_status='paid'` จาก webhook เท่านั้น
- [ ] จ่ายไม่สำเร็จ → ไม่เคลมสำเร็จ + ไม่ clearCart · `/track/<เลขที่>` เปิดได้ไม่ต้อง login

### 3.3 ระบบจัดการร้าน (/admin)
- [ ] **ลงทะเบียนไรเดอร์ใหม่** (เริ่มจากรายการว่าง 0 คน) → เห็นในหน้าความคืบหน้า/จัดส่ง
- [ ] ออเดอร์เว็บ + Messenger ชุดเดียวกันใน /admin (source_channel ระบุที่มา)
- [ ] สวิตช์รอบ/เมนูในแอดมิน → มีผลทันที · เดินสถานะออเดอร์ → tracking ลูกค้าตาม
- [ ] แอดมินแก้ราคา/สต็อก → หน้าร้าน/คิดเงินใช้ค่าใหม่

### 3.4 Facebook (ระดับสิทธิ์ปัจจุบัน — Meta App Review ชะลอ)
- [ ] Messenger: "สั่งผัดไทย 2 จาน" → ยืนยัน → ได้เลขที่จริง + ลิงก์จ่าย/ติดตาม
- [ ] ส่งข้อความเดิมซ้ำ → เลขที่เดิม (idempotent — `audit_logs` เห็น `channel_event_duplicate`)
- [ ] Comment สาธารณะ → ไม่เปิดเผยข้อมูลส่วนตัว/ตะกร้า + ชวนเข้า Inbox · ข้อความกำกวม → ถามก่อน
- [ ] **หมายเหตุสิทธิ์:** ทดสอบได้เฉพาะเพจ/บัญชีที่ผูก webhook (Owner เอง) — ห้ามอ้างว่าผ่านกับลูกค้าทั่วไปจนกว่า App Review

### 3.5 AI / Fallback
- [ ] AI ตอบตามแคตตาล็อกจริง (ชื่อ/ราคาตรงเมนู) ทั้งเว็บ+Messenger
- [ ] AI แตะ/แก้/ยกเลิกออเดอร์เดิมไม่ได้ (ลองสั่ง "ยกเลิกออเดอร์ BMB-xxx" → ปฏิเสธ + audit ไม่มี mutation)
- [ ] AI ล่ม → เว็บสั่งซื้อเองได้ตามปกติ

---

## 4. Blocker เหลือ (Owner / ภายนอก)

| # | Blocker | ใครต้องทำ |
|---|---|---|
| 1 | **Meta App Review ชะลอ** — สิทธิ์ FB ทดสอบได้เฉพาะเพจ/บัญชี Owner | รอบถัดไปค่อยทำ App Review |
| 2 | **ลงทะเบียนไรเดอร์ใหม่** (รายการว่างแล้ว 0 คน) | Owner ลงทะเบียนเองเมื่อเริ่มทดสอบ |
| 3 | **"coming soon" 2 ตัว + "สินค้าสำเร็จรูป"** = ของจริงรอ Owner เปลี่ยน | Owner แก้ข้อมูลสินค้าเอง (ระบบห้ามแตะ) |
| 4 | เช็กภาพจริงบนอุปกรณ์ Owner หลัง deploy (หน้ารอบจัดส่งต้องไม่มีตัวเพี้ยน) | Owner ดูบนเครื่องจริง |

## 5. กติกา/สัญญาที่ต้องรักษา (คงเดิม)

- **เอกสารสถานะ = เขียนทับทั้งฉบับ ห้าม append** · `.clinerules` ห้าม commit · **HARD STOP ห้ามขายจริงจน Owner สั่ง go**
- Contract tests: `g6Security` (G6-09 revised) · `socialOrderIntake` (20) · `socialAiContinuity` · `menuScheduleRoundLink` (9) · `preOrderEntry` (9) · `deliveryRoundStatus` (9) · `menuCartResultGuard` · `cartContextIsolation` · `g6g7OrderBoundary` (12) · `theaterUnity` (10) · `loginContextRestoration` (8)
- **G6/G7 boundary:** AI สร้างออเดอร์**ใหม่**ผ่าน `_shared/socialOrderIntake.ts` → `create_order_with_items` (create-only + `p_external_ref_id`) เท่านั้น — ห้ามแก้/ยกเลิก/เปลี่ยนราคา/สถานะออเดอร์เดิม · ห้ามเคลมสำเร็จก่อนระบบยืนยัน
- Deploy EF (เมื่อมีโค้ด EF เปลี่ยน): `SUPABASE_ACCESS_TOKEN` จาก `.env.local` แล้ว `supabase functions deploy <name> --project-ref ivkdfognyiwjcmrhcnwz` — รอบนี้มี `channel-webhook` เปลี่ยน (comment/audit text ซ่อม mojibake) → deploy คู่กับ push เพื่อ source = deployed
- Meta App Review ชะลอ · เพจ/สิทธิ์ FB จริง = Owner เทสต์เอง · ทดสอบบน `biteme-baby.com` เท่านั้น

