# HANDOFF → แชทถัดไป (อัปเดต 17 ต.ค. 2026 รอบ QA จริง)

> **เป้าหมายแชทหน้า (คำสั่ง Owner):** ① **แก้ UI ที่เหลือ** ② **ทดสอบเปิดร้านจริง**
> เอกสารนี้ถูก**เขียนทับทั้งฉบับ**ตามกติกา "อัปเดต = เขียนทับ ห้ามเขียนต่อ" — ประวัติเก่าดูจาก git

---

## 1. สถานะปัจจุบัน (verified 17 ต.ค. 2026 รอบ QA จริง)

| หัวข้อ | สถานะจริง |
|---|---|
| UI จากภาพ QA (หน้า /check) | ✅ **แก้แล้ว (task UI-FIX-QA-2026-10-17)** — ระยะทาง 0 กม. / รอบส่งมั่ว / แผนที่ซ้ำ / ตัวอักษรขาวบนพื้นขาว / bubble ทับฟอร์ม / music pill ทับราคา |
| รูปเมนูลอยเหนือกรอบ (งานใหม่) | ✅ **แล้ว** — สถานะปกติยกเหนือกรอบนิดหน่อย (มือถือเหมือน hover), hover เดสก์ท็อปขยับซ้ำ |
| "เพิ่มลงตะกร้า" | ⏭️ **ข้ามตามคำสั่ง Owner** ("ใช้ได้แล้วข้ามข้อนี้ไป") — ยังไม่เก็บ root cause ถ้าเกิดซ้ำให้ trace OrderBuilderModal → cartStore.addItem |
| Gates | ✅ lint=0 · tests **105 ไฟล์ / 1,108 ข้อ** ผ่าน · build=0 |
| EF `social-ai-worker` | ✅ deploy แล้ว (41 kB, project `ivkdfognyiwjcmrhcnwz` Seoul) — รวม order-intake create-only |
| AI สร้างออเดอร์ | ✅ create-only ผ่าน `rpc/create_order_with_items` + `p_external_ref_id` (retry ไม่สร้างซ้ำ) · แก้ของเดิมไม่ได้ (G6-09) |
| Bite บริบทจริง | ✅ `composeRealContext()` — Cart/route/ช่องทาง จาก store จริงทุกข้อความ |
| ⚠️ งบ OpenRouter | เหลือ ~$5 / $160 — **เติมงบ/ขึ้น limit ก่อนเทสต์ AI จริง** |
| ⚠️ Google Maps บน prod | โหลดไม่สำเร็จ (แผนที่ว่าง) — fallback กรอกพิกัด/GPS ใช้ได้; ควรตรวจ `VITE_GOOGLE_MAPS_API_KEY` (HTTP referrer) |

## 2. งานที่เหลือ — เป้าหมายแชทหน้า

### 2.1 แก้ UI ที่เหลือ
- [x] รายการ UI จากภาพ QA ของ Owner (หน้า /check + รูปเมนูลอยเหนือกรอบ) — ปิดใน task UI-FIX-QA-2026-10-17
- [x] ปุ่มจองล่วงหน้าก่อนฟุตเตอร์กดไม่ได้ — ปิดใน task PREORDER-ENTRY-2026-10-18 (deep-link `?tab=pre-order` + feedback กดซ้ำ; ทดสอบบน biteme-baby.com เท่านั้น — preview pages.dev = build เก่า)
- [x] ของพรีออเดอร์กระจัดกระจาย + หัวข้อ "จองล่วงหน้า / พรีออเดอร์" ว่าง — ปิดใน task PREORDER-MERGE-2026-10-18 (ย้ายรวม 7 ชิ้นใต้หัวข้อเดิม + ตัดตัวกรองซ้อนแท็บ×หัวข้อบนหน้าเมนู — หัวข้อ = แหล่งความจริง)
- [x] Clean slate ก่อนทดสอบจริง — ปิดใน task CLEAN-SLATE-ROUNDS-2026-10-18 (ล้างออเดอร์/เงิน/ประวัติ/งานออโต้/โซเชียล = 0 ทั้งหมด + rounds จัดเป็น 3 รอบ/วันมาตรฐาน 18–24 ต.ค. — รอบเช้า template เดิมติด "W3C-EXT test round" ล้างแล้ว)
- [ ] **เริ่ม E2E ทดสอบจริงทั้งวงจร** (same-day + pre-order, จ่ายจริง, ส่งจริง) ตาม §2.2 — ระบบพร้อม: ข้อมูลว่าง, รอบมาตรฐาน 3 รอบ/วัน, บัญชีลูกค้า 37 ใช้ได้
- [ ] Theater/Waiting Stage unity (ค้างจาก PRE-OPENING audit)
- [ ] Login context restoration (ค้างจาก PRE-OPENING audit)
- [ ] **เช็กภาพจริงบนเครื่อง Owner หลัง deploy** — การ์ด fee error ("ยังคำนวณไม่สำเร็จ") ที่เคยดูเป็นการ์ดขาว label แปลก + รูปเมนู hover/ลอย + แถวรอบส่ง (disabled "ปิดรับแล้ว") + ปุ่มจองล่วงหน้าก่อนฟุตเตอร์ + หัวข้อ "จองล่วงหน้า / พรีออเดอร์ (7)"
- [ ] Google Maps key/referrer — ทำให้แผนที่โหลดได้จริงบน prod (ทาง fallback ยังใช้ได้)
- [ ] (ถ้า Owner สั่ง) เก็บ "coming soon" 2 ตัว + หัวข้อ "สินค้าสำเร็จรูป" ที่ไม่ทราบที่มา
- กติกา: ทุกครั้งปิดด้วย gates — tsc 0 · lint 0 · tests ทั้งชุดผ่าน · build 0 · **ห้ามสร้างโครงสร้าง/ระบบคู่ขนานใหม่ — ใช้หัวข้อเมนูที่มีอยู่***

### 2.2 ทดสอบเปิดร้านจริง (Owner E2E checklist — เริ่มได้ทันที)
ก่อนเริ่ม: เติมงบ OpenRouter ให้พอกับการเทสต์
- [ ] เว็บ login → checkout → order เข้า /admin
- [ ] รอบปิด/รอบเต็ม → บล็อกจริง (`ERR_ROUND_CLOSED`) — **ตอนนี้ UI แสดงแถวปิด/เต็ม disabled + ป้ายสถานะแล้ว ตรวจว่าตรงกับ server**
- [ ] Mixed cart (same-day + pre-order) → split 2 order + COD
- [ ] Pre-order 2 ปุ่ม (home + footer) = workflow เดียวกัน
- [ ] แอดมินสวิตช์รอบ/เมนู → มีผลทันที
- [ ] Bite ตอบตาม Cart จริง (`composeRealContext`)
- [ ] **Messenger:** "สั่งผัดไทย 2 จาน" → ยืนยันชัดเจน → ได้**เลขที่ออเดอร์จริง** + ลิงก์จ่ายเงิน → **ส่งซ้ำ = เลขที่เดิม** (idempotent)
- [ ] Comment สาธารณะ = ไม่เปิดเผยรายละเอียด ชวนเข้า Inbox
- [ ] AI ล่ม → เว็บสั่งได้ตามปกติ
- [ ] AI แตะออเดอร์เดิมไม่ได้ (ตรวจ `audit_logs`)

## 3. กติกา/ข้อควรระวัง (คงเดิม)
- **เอกสารสถานะ = เขียนทับทั้งฉบับ ห้าม append** (คำสั่ง Owner 17 ต.ค. รอบดึก)
- `.clinerules` ห้าม commit · `chat\bmb\` เคลียร์แล้ว (ห้ามมี staging copy ค้างอีก) · **HARD STOP ห้ามขายจริงจน Owner สั่ง go**
- Meta App Review = ชะลอตามคำสั่ง · เพจ/สิทธิ์ FB จริง = Owner เทสต์เอง
- Contract tests ที่ต้องรักษา: `g6Security` (G6-09 revised) · `g7...` · `socialOrderIntake` (20) · `socialAiContinuity` · `menuScheduleRoundLink` (9) · `preOrderEntry` (5) · `deliveryRoundStatus` (9, ใหม่) · `menuCartResultGuard` · `cartContextIsolation`
- Deploy EF (เมื่อมีโค้ด EF เปลี่ยน): ใช้ `SUPABASE_ACCESS_TOKEN` จาก `D:\A PROJECT\Bite Me Baby\.env.local` แล้ว `supabase functions deploy <name> --project-ref ivkdfognyiwjcmrhcnwz` (งาน EF = รอ Owner อนุมัติเสมอก่อน deploy ที่กระทบ production flow)
- หมายเหตุ rules: มี `UNIVERSAL_MASTER_AI_RULES.md` label v3.0 (2026 Updated) ในเครื่อง (D:\selfprint-v3-react) — เนื้อหาเหมือน v2.0 ในรีโปทุกบรรทัดยกเว้นบรรทัด version; ถ้า Owner ต้องการ label ใหม่ = แก้บรรทัดเดียว
