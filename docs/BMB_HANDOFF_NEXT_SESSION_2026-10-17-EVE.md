# HANDOFF → แชทถัดไป (อัปเดต 18 ต.ค. 2026 — ปิดเซสชัน)

> **สถานะรวม:** งานตามคำสั่ง Owner 17–18 ต.ค. ปิดครบแล้ว (UI / pre-order / clean slate / rounds 3 รอบ/วัน / Maps config) — เหลือ **E2E ทดสอบเปิดร้านจริง** ตาม §2.2
> เอกสารนี้ถูก**เขียนทับทั้งฉบับ**ตามกติกา "อัปเดต = เขียนทับ ห้ามเขียนต่อ" — ประวัติเก่าดูจาก git

---

## 1. สถานะปัจจุบัน (verified 18 ต.ค. 2026 ปิดเซสชัน)

| หัวข้อ | สถานะจริง |
|---|---|
| UI จากภาพ QA (หน้า /check) | ✅ **แก้แล้ว (UI-FIX-QA-2026-10-17)** — ระยะทาง 0 กม. / รอบส่งมั่ว / แผนที่ซ้ำ / ตัวอักษรขาว / bubble ทับฟอร์ม / music pill ทับราคา |
| รูปเมนูลอยเหนือกรอบ | ✅ **ครบสเปกทุกข้อ** — ปกติ `translateY(-10px) scale(1.04)`+มุมมน/เงา · hover `-16px/1.08` · `pointer-events:none` · badge เหนือรูปเสมอ (z-40 รวมตอน hover) · เว้นที่เหนือการ์ด+padding carousel · reduced-motion ปิดลอย |
| ปุ่มจองล่วงหน้า (home/footer) | ✅ (PREORDER-ENTRY-2026-10-18) — deep-link `?tab=pre-order` + feedback กดซ้ำ |
| ของพรีออเดอร์ใต้หัวข้อเดิม | ✅ (PREORDER-MERGE-2026-10-18) — 7 ชิ้นใต้ "จองล่วงหน้า / พรีออเดอร์" + หน้าเมนูไม่มีตัวกรองซ้อน |
| Clean slate ทดสอบจริง | ✅ (CLEAN-SLATE-ROUNDS-2026-10-18) — ออเดอร์ 208/เงิน 57/ประวัติ 458/ออโต้ 1,622/โซเชียล 34 + อื่น ๆ = **0 ทั้งหมด** |
| Rounds จัดส่ง | ✅ **3 รอบ/วัน มาตรฐานเดียว** (18–24 ต.ค. 21 แถว) เช้า 06:00–09:00 ปิดรับ 08:00 (60) / เที่ยง 11:00–14:00 ปิดรับ 10:30 (80) / เย็น 17:00–20:00 ปิดรับ 16:00 (100) — template ที่ติด "W3C-EXT test round" ล้างแล้ว; วันใหม่ระบบสร้างเอง (`ensure_rounds_for_date`) |
| Gates | ✅ lint=0 · tests **105 ไฟล์ / 1,112 ข้อ** ผ่าน · build=0 |
| EF `social-ai-worker` | ✅ deploy แล้ว (41 kB) — create-only + idempotent |
| Bite บริบทจริง | ✅ `composeRealContext()` |
| ⚠️ งบ OpenRouter | เหลือ ~$5 / $160 — **เติมงบก่อนเทสต์ AI จริง** |
| Google Maps | ✅ **คีย์ครบแล้ว (Owner เพิ่ม `VITE_GOOGLE_MAPS_API_KEY` ใน Cloudflare Pages 12:41 น. 18 ต.ค.)** — สาเหตุที่แผนที่ว่างทั้งหมด: build ไม่เคยเห็นคีย์ตัวนี้ (มีแค่ `VITE_GOOGLE_MAPS_MAP_ID`) + โค้ดเดิมบังคับ MAP_ID ตอนโหลด SDK → ตอนนี้โค้ด+env ครบ, build รอบถัดไปจะฝังคีย์ (ตรวจยืนยันในคอมมิตตาม) · เก็บตก: ลบตัวแปรขยะ `"BmB web Map"` ใน Cloudflare ด้วยปุ่มถังขยะ (ไม่ได้ถูกใช้) · `.env.local` ซ่อมแล้ว (คอมเมนต์ไทย+BOM; ค่า 32 บรรทัดเดิมทุกตัว) |

## 2. งานที่เหลือ — เป้าหมายแชทหน้า

### 2.1 เก็บตก
- [ ] **เช็กภาพจริงบนเครื่อง Owner หลัง deploy รอบนี้** — Google Maps โหลดได้จริง · การ์ด fee error · รูปเมนู hover/ลอย · แถวรอบส่ง disabled · ปุ่มจองล่วงหน้า · หัวข้อ "จองล่วงหน้า / พรีออเดอร์ (7)"
- [ ] Theater/Waiting Stage unity (ค้างจาก PRE-OPENING audit)
- [ ] Login context restoration (ค้างจาก PRE-OPENING audit)
- [ ] (ถ้า Owner สั่ง) เก็บ "coming soon" 2 ตัว + หัวข้อ "สินค้าสำเร็จรูป" ที่ไม่ทราบที่มา
- กติกา: ทุกครั้งปิดด้วย gates — tsc 0 · lint 0 · tests ทั้งชุดผ่าน · build 0 · **ห้ามสร้างโครงสร้าง/ระบบคู่ขนานใหม่ — ใช้หัวข้อเมนูที่มีอยู่***

### 2.2 ทดสอบเปิดร้านจริง (Owner E2E checklist — เริ่มได้ทันที)
ก่อนเริ่ม: เติมงบ OpenRouter ให้พอกับการเทสต์ · ระบบพร้อม: ข้อมูลว่างทั้งหมด + รอบมาตรฐาน 3 รอบ/วัน + บัญชีลูกค้า 37 ใช้ได้
- [ ] เว็บ login → checkout → order เข้า /admin
- [ ] รอบปิด/รอบเต็ม → บล็อกจริง (`ERR_ROUND_CLOSED`) — UI แสดงแถวปิด/เต็ม disabled + ป้ายสถานะ ตรวจว่าตรงกับ server
- [ ] Mixed cart (same-day + pre-order) → split 2 order + COD
- [ ] Pre-order 2 ปุ่ม (home + footer) = workflow เดียวกัน
- [ ] แอดมินสวิตช์รอบ/เมนู → มีผลทันที
- [ ] Bite ตอบตาม Cart จริง (`composeRealContext`)
- [ ] **Messenger:** "สั่งผัดไทย 2 จาน" → ได้**เลขที่ออเดอร์จริง** + ลิงก์จ่ายเงิน → **ส่งซ้ำ = เลขที่เดิม** (idempotent)
- [ ] Comment สาธารณะ = ไม่เปิดเผยรายละเอียด ชวนเข้า Inbox
- [ ] AI ล่ม → เว็บสั่งได้ตามปกติ
- [ ] AI แตะออเดอร์เดิมไม่ได้ (ตรวจ `audit_logs`)

## 3. กติกา/ข้อควรระวัง (คงเดิม)
- **เอกสารสถานะ = เขียนทับทั้งฉบับ ห้าม append** (คำสั่ง Owner 17 ต.ค. รอบดึก)
- `.clinerules` ห้าม commit · `chat\bmb\` เคลียร์แล้ว (ห้ามมี staging copy ค้างอีก) · **HARD STOP ห้ามขายจริงจน Owner สั่ง go**
- Meta App Review = ชะลอตามคำสั่ง · เพจ/สิทธิ์ FB จริง = Owner เทสต์เอง
- Contract tests ที่ต้องรักษา: `g6Security` (G6-09 revised) · `socialOrderIntake` (20) · `socialAiContinuity` · `menuScheduleRoundLink` (9) · `preOrderEntry` (9) · `deliveryRoundStatus` (9) · `menuCartResultGuard` · `cartContextIsolation`
- Deploy EF (เมื่อมีโค้ด EF เปลี่ยน): ใช้ `SUPABASE_ACCESS_TOKEN` จาก `D:\A PROJECT\Bite Me Baby\.env.local` แล้ว `supabase functions deploy <name> --project-ref ivkdfognyiwjcmrhcnwz` (งาน EF = รอ Owner อนุมัติเสมอก่อน deploy ที่กระทบ production flow)
- หมายเหตุ rules: มี `UNIVERSAL_MASTER_AI_RULES.md` label v3.0 (2026 Updated) ในเครื่อง (D:\selfprint-v3-react) — เนื้อหาเหมือน v2.0 ในรีโปทุกบรรทัดยกเว้นบรรทัด version; ถ้า Owner ต้องการ label ใหม่ = แก้บรรทัดเดียว