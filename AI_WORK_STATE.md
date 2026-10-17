# AI_WORK_STATE — Bite Me Baby (evidence ledger)

> Updated per `.clinerules` WORK STATE rule after each meaningful task.
> Rule source of truth: `UNIVERSAL_MASTER_AI_RULES.md` (repo root, v2.0) ·
> bootstrap: `AI_ENTRYPOINT.md` (repo root, v1.0) — ทั้งคู่อยู่ใน repo แล้ว
> (เพิ่ม 17 ต.ค. 2026 รอบดึก จากไฟล์โลคอลของ Owner)
> **กติกาเอกสาร (Owner 17 ต.ค. รอบดึก): อัปเดต = เขียนทับทั้งฉบับ ห้ามเขียนต่อ (append)**
> ประวัติฉบับก่อน ๆ ดูจาก git history เท่านั้น

---

## Task ID: UI-FIX-QA-2026-10-17 (แก้ UI จาก QA จริง + รูปเมนูลอยเหนือกรอบ)
- **Status:** CLOSED — gates ผ่านครบ (lint=0 · tests 105 ไฟล์/1,108 · build=0)
- **Objective (Owner):** แก้ UI จากการทดสอบจริงบน `biteme-baby.com/check` (เบอร์ทดสอบ, ห่างครัว ~500 ม., มือถือ dark mode) + งานใหม่ "รูปเมนูลอยเหนือกรอบขึ้นด้านบนนิดหน่อย (มือถือเหมือนมี hover ตลอด / เดสก์ท็อป hover ขยับซ้ำจากเดิม)" — **ข้ามปัญหา "เพิ่มลงตะกร้า" ตามคำสั่ง Owner ("ใช้ได้แล้วข้ามข้อนี้ไป")**
- **Completed:**
  - **ระยะทาง 0.00 กม. ทั้งที่ห่างครัว ~500 ม.** → `DistanceChecker.tsx` เดิมไม่ส่ง `origin` เข้า `useDeliveryRouter` → `routeOrder({from: undefined})` ใช้ `distanceKm = 0` เสมอ — แก้: default origin = `KITCHEN_LAT/LNG` (display only; server คำนวณค่าส่งจริงตอนสร้างออเดอร์)
  - **รอบส่งมั่ว** (21:32 น. ยังเลือกรอบพ้น cutoff/กรอบส่งผ่านไปได้) → `src/lib/deliveryRoundStatus.ts` (ใหม่, pure) `roundBookability()` = open / cutoff_passed (มิเรอร์ ERR_CUTOFF_PASSED, strict `>` เวลาไทย) / window_passed (รอบทั้งวัน "ส่ง 08:00-20:00 · สั่งได้ถึง 23:59" ที่กรอบส่งผ่านไป) / full + `CheckoutPage.tsx`: แถวพ้นเวลา = disabled + ป้ายสถานะ, auto-select รอบแรกที่ยังสั่งได้, ปุ่มสั่งซื้อบอกเหตุเมื่อไม่มีรอบเปิด — server ยังเป็น authority เดียว
  - **ตัวอักษรขาวบนพื้นขาว (ไม่สมบูรณ์)** → `CheckoutPage.tsx`: กล่องพื้นสีอ่อน (`bg-orange-50`/`bg-blue-50`/`bg-gray-50`) บังคับตัวอักษรเข้มเสมอ (banner โหมด/ชื่อรอบที่เลือก/กล่องค่าส่ง/schedule banner)
  - **แผนที่พัง/ซ้ำ** → `DeliveryMapPicker.tsx`: ซ่อน canvas เปล่า `h-64` เมื่อ Google Maps โหลดไม่สำเร็จ (เดิมค้างทับกล่อง fallback = ดูเหมือนแผนที่ 2 อัน)
  - **UI ทับกัน** → `BiteMascot.tsx`: bubble ไม่แสดงบนหน้า checkout + แตะเพื่อปิดได้ทุกหน้า · `AmbientMusicToggle.tsx`: ตอนปิดเพลงเหลือปุ่มกลม (เดิม pill กว้างทับราคา/ปุ่มบนการ์ด)
  - **งานใหม่ รูปเมนูลอยเหนือกรอบ** → `index.css`: สถานะปกติ `translateY(-10px) scale(1.04)` + มุมมน/เงา (ทุกการ์ด drink/snack/home/fmc/menu), hover เดสก์ท็อปยกซ้ำ `translateY(-16px) scale(1.08)`, รูป `pointer-events: none` (กันกินพื้นที่แตะ), badge/chip z-index เหนือรูป, เว้นที่เหนือการ์ดแนวตั้ง + padding บน `.hc-track` (กัน scroll-clip ใน carousel), `prefers-reduced-motion` ปิดการลอยทั้งปกติ/hover
- **Verified:** `npm run lint` → 0 · `npm test` → 105 ไฟล์ / 1,108 ข้อ ผ่านทั้งหมด (เพิ่ม `deliveryRoundStatus` 9 ข้อ) · `npm run build` → 0 (tsc + vite + PWA) · screenshot มือถือ 390px ยืนยันรูปลอยเหนือกรอบ/หัวข้อไม่ถูกทับบน /menu
- **Failed:** —
- **Blocked:** —
- **Files Changed:** `src/lib/deliveryRoundStatus.ts` (ใหม่) · `src/__tests__/deliveryRoundStatus.test.ts` (ใหม่ 9 ข้อ) · `src/pages/CheckoutPage.tsx` · `src/components/delivery/DistanceChecker.tsx` · `src/components/delivery/DeliveryMapPicker.tsx` · `src/components/ai/BiteMascot.tsx` · `src/components/audio/AmbientMusicToggle.tsx` · `src/index.css`
- **Known Risks / ข้อควรระวัง:**
  - **"เพิ่มลงตะกร้า" ถูกข้ามตามคำสั่ง Owner** — ยังไม่เก็บ root cause; ถ้าเกิดซ้ำให้ trace `OrderBuilderModal → cartStore.addItem` (contract `menuCartResultGuard`/`cartContextIsolation` คงเดิม)
  - การ์ดขาว label แปลกในภาพ QA ไม่พบข้อความนี้ในซอร์สทั้งรีโป — ประเมินว่าเป็นกล่อง fee error (`feeUiState` "ยังคำนวณไม่สำเร็จ") ที่ข้อความขาวบนพื้นครีมอ่านไม่ออก — แก้ contrast แล้ว **ควรเช็กหน้าจอจริงบนเครื่อง Owner หลัง deploy**
  - Google Maps บน prod โหลดไม่สำเร็จ (แผนที่ว่าง) — fallback กรอกพิกัด/GPS ใช้ได้; ควรตรวจ `VITE_GOOGLE_MAPS_API_KEY` (HTTP referrer) ต่อ
  - ค่าระยะทาง/ค่าส่งบนหน้า = display mirror — `compute_delivery_fee_rpc`/`create_order_with_items` ยังเป็น authority
  - ⚠️ งบ OpenRouter เหลือ ~$5 จาก $160 — เติมงบก่อนเทสต์ AI จริง

---

## Task ID: SESSION-CLOSE-2026-10-17 (ปิดเซสซั่น — เตรียมแชทหน้า)
- **Status:** CLOSED — pushed (commit "chore(session-close) 2026-10-17" — ดู git log)
- **Objective (Owner):** อนุมัติ deploy EF `social-ai-worker` · เอา `AI_ENTRYPOINT.md`/`UNIVERSAL_MASTER_AI_RULES.md` จากโลคอลขึ้นรีโป · เขียนทับเอกสารที่เกี่ยวข้อง (ห้ามเขียนต่อ) · เคลียร์ staging worktree · เตรียมเป้าหมายแชทหน้า = แก้ UI ที่เหลือ + ทดสอบเปิดร้านจริง
- **Completed:**
  - **Deploy EF `social-ai-worker` สำเร็จ** — bundle 41 kB (รวม order-intake create-only ของ PRETEST-CLOSURE) ที่ project `ivkdfognyiwjcmrhcnwz` (Seoul) ผ่าน `SUPABASE_ACCESS_TOKEN` จาก `.env.local` · หลักฐาน deploy output: "Deployed Functions on project ivkdfognyiwjcmrhcnwz: social-ai-worker"
  - **เพิ่ม `AI_ENTRYPOINT.md` (v1.0 universal bootstrap) + `UNIVERSAL_MASTER_AI_RULES.md` (v2.0) ที่ repo root** — คัด verbatim จากโฟลเดอร์ Downloads ของ Owner (MD5 เท่าต้นทางทุกไบต์; เนื้อหาเดียวกับ `docs/archive/legacy_reports/`) — ปลด blocked item ค้างจาก 2 task ก่อนหน้า
  - **เขียนทับเอกสารสถานะ (ไม่ append):** `AI_WORK_STATE.md` (ฉบับนี้) + `docs/BMB_HANDOFF_NEXT_SESSION_2026-10-17-EVE.md`
  - **เคลียร์ staging worktree แล้ว:** ลบ `chat\bmb\` (staging clone เก่า 313.5 MB / 20,863 ไฟล์ — ตรวจก่อนลบ: ไฟล์ unique ทุกตัวมีเทียบเท่าในรีปอดจริง (`sms.ts`, `sms-send/`, `117_channel_intake_repair.sql`, e2e probes) และ HEAD `d6c9046` เป็น ancestor ของ main) + ลบ `chat\supabase\` (supabase CLI `.temp` cache) + git staging ว่าง / worktree สะอาด
- **Verified:** deploy output ยืนยันบน project จริง · MD5 ไฟล์ที่คัดมา = ต้นทาง · `git status` สะอาด · gates ปิดท้ายรอบนี้: lint=0 · tests 104 ไฟล์ / 1,099 ผ่าน · build=0
- **Failed:** —
- **Blocked:** Meta App Review = ชะลอตามคำสั่ง · เพจ/สิทธิ์ FB จริง = Owner เทสต์เอง
- **Files Changed:** `AI_ENTRYPOINT.md` (ใหม่, root) · `UNIVERSAL_MASTER_AI_RULES.md` (ใหม่, root) · `AI_WORK_STATE.md` (เขียนทับ) · `docs/BMB_HANDOFF_NEXT_SESSION_2026-10-17-EVE.md` (เขียนทับ)
- **Tests / Commands Run:** `supabase functions deploy social-ai-worker --project-ref ivkdfognyiwjcmrhcnwz` → deployed · `npm run lint` → 0 · `npm test` → 104 ไฟล์/1,099 ผ่าน · `npm run build` → 0
- **Known Risks:**
  - **งบ OpenRouter เหลือ ~$5 จาก $160 (ใช้แล้ว 97% ณ 17 ต.ค. 10:22 — ที่มา: หน้า OpenRouter ของ Owner)** — AI ทุกตัวจะหยุดตอบเมื่อถึงเพดาน → **ต้องเติมงบ/ขึ้น limit ก่อนเทสต์จริง**
  - G6-09 (revised): AI สร้างออเดอร์**ใหม่**ได้ผ่าน `socialOrderIntake` (create-only, idempotent) เท่านั้น — ห้ามแก้/จ่าย/ยกเลิก/คืนเงิน/assign driver/แตะ inventory (regression คุม 20 ข้อ + G6/G7 เดิม)
  - `source_channel` จาก FB ต้องตรง channel naming ที่ webhook ใช้ (`MESSENGER`) · HARD STOP: ห้ามขายจริงจน Owner สั่ง go
  - `UNIVERSAL_MASTER_AI_RULES.md` มี label v3.0 (2026 Updated) ในเครื่อง (D:\selfprint-v3-react) — เนื้อหาเหมือน v2.0 ทุกบรรทัดยกเว้นบรรทัด version — ถ้า Owner ต้องการ label ใหม่ แก้บรรทัดเดียว
- **Next Exact Action (เป้าหมายแชทหน้า — คำสั่ง Owner):**
  1. **แก้ UI ที่เหลือ** — ~~รายการ UI จากภาพ QA~~ (ปิดแล้ว: task UI-FIX-QA-2026-10-17) · ยังเหลือ Theater/Waiting Stage unity + login context restoration (ค้างจาก PRE-OPENING audit)
  2. **ทดสอบเปิดร้านจริง** — พา Owner ผ่าน E2E checklist ใน `docs/BMB_HANDOFF_NEXT_SESSION_2026-10-17-EVE.md` §2.2 (รวม Messenger สั่งออเดอร์จริง → เลขที่จริง → retry ได้เลขที่เดิม)

---

## Task ID: PRETEST-CLOSURE-2026-10-17 (ปิดแล้ว)
- **Status:** CLOSED — pushed `1b381e6` · EF `social-ai-worker` deploy แล้ว (ดู task SESSION-CLOSE)
- **Objective:** §3 AI สร้างออเดอร์ใหม่ผ่าน workflow อนุญาต (ห้ามแก้ออเดอร์เดิม) + §4 FB comments/Messenger เข้า workflow กลาง + §5 Bite จำบริบทจริง
- **Completed:** `_shared/socialOrderIntake.ts` (extraction ask-first → catalog match → identity 046 → round → `rpc/create_order_with_items` + `p_external_ref_id`=event id) · worker intake (Messenger-only; comment สาธารณะไม่เปิดเผยรายละเอียด) · `TalkToBite.composeRealContext()` · G6-09 revised
- **Verified:** lint=0 · tests 104 ไฟล์/1,099 ผ่าน · build=0 · tsc=0
- **Files Changed:** `supabase/functions/_shared/socialOrderIntake.ts` (ใหม่) · `supabase/functions/social-ai-worker/index.ts` · `src/__tests__/g6Security.test.ts` · `src/__tests__/socialOrderIntake.test.ts` (ใหม่ 20 ข้อ) · `src/components/ai/TalkToBite.tsx`
- **สัญญาที่ต้องรักษา (contract):** `socialOrderIntake` 20 ข้อ — create-only source contract · idempotency (`p_external_ref_id`) · semantic ask-first (ไม่เดา) · truthful line จากผล RPC · G6-09 แบน mutation ทุกตัวของออเดอร์เดิม

---

## Task ID: ROUND-LINK-2026-10-17 (ปิดแล้ว)
- **Status:** CLOSED — pushed `ab50dc2`
- **Objective:** menu schedule ↔ pre-order ผูกด้วย round key + สวิตช์เปิดปิดทุกรอบ + แอดมินสวิตช์/ดรอปดาวน์
- **Verified:** lint=0 · tests 103 ไฟล์/1,078 ผ่าน · build=0 · tsc=0
- **Files Changed:** `bmbAdminApi_rounds.ts` · `bmbMenuSchedule.ts` · `AdminMenuSchedule.tsx` · `AdminRounds.tsx` · `menuScheduleRoundLink.test.ts` (9) · `preOrderEntry.test.ts` (5)
- **หมายเหตุ:** สวิตช์รอบ = display mirror — create RPC ยังเป็น authority เดียวตอนสั่งซื้อ (`ERR_ROUND_CLOSED`)

---

## Task ID: SOCIAL-AI-2026-10-17 (ปิดแล้ว)
- **Status:** CLOSED — pushed `9d55926` · EF 4 ตัว deploy แล้ว · `BMB_OPENROUTER_API_KEY` ตั้งแล้ว (HTTP 201)
- **Objective:** แก้ AI ตอบเบิ้ล/สะกดผิด/ข้อมูลมั่ว/แชตหาย + footer social/LINE แอดมินแก้เองได้
- **Verified:** tsc 0 · lint 0 · tests 101 ไฟล์/1,064 ผ่าน · build 0 · deploy EF EXIT=0 ×4
- **Files Changed:** `channel-webhook` (self-echo) · `social-ai-worker` (thread/persona/continuity) · `_shared/shopContext.ts` (ใหม่) · `social-post-worker` · `ai-proxy` · `TalkToBite.tsx` · `src/lib/socialLinks.ts` (ใหม่) · `faqContent.ts`
- **สัญญาที่ต้องรักษา (contract):** `socialAiContinuity` — self-echo guard · thread continuity · persona "ครับ" · shopContext ข้อมูลจริง · ห้ามเงียบ
