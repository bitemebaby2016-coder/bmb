# HANDOFF → แชทถัดไป (ปิดเซสซั่น 17 ต.ค. 2026 รอบดึก)

> **เป้าหมายแชทหน้า (คำสั่ง Owner):** ① **แก้ UI ที่เหลือ** ② **ทดสอบเปิดร้านจริง**
> เอกสารนี้ถูก**เขียนทับทั้งฉบับ**ตามกติกา "อัปเดต = เขียนทับ ห้ามเขียนต่อ" — ประวัติเก่าดูจาก git

---

## 1. สถานะปัจจุบัน (verified 17 ต.ค. 2026 รอบดึก)

| หัวข้อ | สถานะจริง |
|---|---|
| Git | HEAD = `1b381e6` + commit ปิดเซสซั่นนี้ = `origin/main` · worktree สะอาด · staging เคลียร์แล้ว |
| EF `social-ai-worker` | ✅ **deploy แล้ว** (41 kB, project `ivkdfognyiwjcmrhcnwz` Seoul) — รวม order-intake create-only |
| `AI_ENTRYPOINT.md` / `UNIVERSAL_MASTER_AI_RULES.md` | ✅ **อยู่ที่ repo root แล้ว** (v1.0 / v2.0 — คัด verbatim จากโฟลเดอร์ Downloads ของ Owner) |
| AI สร้างออเดอร์ | ✅ create-only ผ่าน `rpc/create_order_with_items` + `p_external_ref_id` = event id (retry ไม่สร้างซ้ำ) · แก้ของเดิมไม่ได้ (G6-09) |
| Bite บริบทจริง | ✅ `composeRealContext()` — Cart/route/ช่องทาง จาก store จริงทุกข้อความ |
| `chat\bmb\` (staging clone เก่า) | ✅ **ลบแล้ว** — ตรวจก่อนลบ: ทุกไฟล์มีเทียบเท่าในรีปอดจริง |
| ⚠️ งบ OpenRouter | เหลือ ~$5 / $160 (ใช้แล้ว 97%) — **เติมงบ/ขึ้น limit ก่อนเทสต์ AI จริง** |

## 2. งานที่เหลือ — เป้าหมายแชทหน้า

### 2.1 แก้ UI ที่เหลือ (งานแรก)
- [ ] Theater/Waiting Stage unity (ค้างจาก PRE-OPENING audit)
- [ ] Login context restoration (ค้างจาก PRE-OPENING audit)
- [ ] รายการ UI ตกค้างที่ Owner ชี้เพิ่ม — **ถาม Owner ตอนเริ่มแชท**
- กติกา: ทุกครั้งปิดด้วย gates — tsc 0 · lint 0 · tests ทั้งชุดผ่าน · build 0

### 2.2 ทดสอบเปิดร้านจริง (Owner E2E checklist — เริ่มได้ทันที)
ก่อนเริ่ม: เติมงบ OpenRouter ให้พอกับการเทสต์
- [ ] เว็บ login → checkout → order เข้า /admin
- [ ] รอบปิด/รอบเต็ม → บล็อกจริง (`ERR_ROUND_CLOSED`)
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
- Contract tests ที่ต้องรักษา: `g6Security` (G6-09 revised) · `g7...` · `socialOrderIntake` (20) · `socialAiContinuity` · `menuScheduleRoundLink` (9) · `preOrderEntry` (5)
- Deploy EF (เมื่อมีโค้ด EF เปลี่ยน): ใช้ `SUPABASE_ACCESS_TOKEN` จาก `D:\A PROJECT\Bite Me Baby\.env.local` แล้ว `supabase functions deploy <name> --project-ref ivkdfognyiwjcmrhcnwz` (งาน EF = รอ Owner อนุมัติเสมอก่อน deploy ที่กระทบ production flow)
- หมายเหตุ rules: มี `UNIVERSAL_MASTER_AI_RULES.md` label v3.0 (2026 Updated) ในเครื่อง (D:\selfprint-v3-react) — เนื้อหาเหมือน v2.0 ในรีโปทุกบรรทัดยกเว้นบรรทัด version; ถ้า Owner ต้องการ label ใหม่ = แก้บรรทัดเดียว
