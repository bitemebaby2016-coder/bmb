# AI_WORK_STATE — Bite Me Baby (evidence ledger)

> Updated per `.clinerules` WORK STATE rule after each meaningful task.
> Rule source of truth: `UNIVERSAL_MASTER_AI_RULES.md` (repo root, v2.0) ·
> bootstrap: `AI_ENTRYPOINT.md` (repo root, v1.0) — ทั้งคู่อยู่ใน repo แล้ว
> (เพิ่ม 17 ต.ค. 2026 รอบดึก จากไฟล์โลคอลของ Owner)
> **กติกาเอกสาร (Owner 17 ต.ค. รอบดึก): อัปเดต = เขียนทับทั้งฉบับ ห้ามเขียนต่อ (append)**
> ประวัติฉบับก่อน ๆ ดูจาก git history เท่านั้น

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
  1. **แก้ UI ที่เหลือ** — Theater/Waiting Stage unity + login context restoration (ค้างจาก PRE-OPENING audit) + รายการ UI ที่ Owner ชี้เพิ่ม
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
