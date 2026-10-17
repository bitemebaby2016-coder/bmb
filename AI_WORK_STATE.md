# AI_WORK_STATE — Bite Me Baby (evidence ledger)

> Updated per `.clinerules` WORK STATE rule after each meaningful task.
> Rule source of truth: `UNIVERSAL_MASTER_AI_RULES.md` (⚠️ **not present in repo
> yet** — see "Blocked" below), bootstrap: `AI_ENTRYPOINT.md` (⚠️ not present).

---

## Task ID: PRETEST-CLOSURE-2026-10-17
- **Status:** CODE COMPLETE — full gates running (lint=0 already)
- **Objective (Owner FINAL PRE-TEST CLOSURE DIRECTIVE):** ปิดงานค้างทั้งหมดที่ทำได้ —
  โดยเฉพาะ §3 (AI สร้างออเดอร์ใหม่ได้ผ่าน Workflow อนุญาต, ห้ามแก้ออเดอร์เดิม) +
  §4 (FB Comments/Messenger รับรายการเข้า workflow กลาง) + §5 (Bite จำบริบทจริง)
- **Completed:**
  - **§3/§4 order intake (ใหม่, create-only):** `supabase/functions/_shared/socialOrderIntake.ts`
    — extraction schema (`confirmed` ต้องชัดเจนครบ, ไม่งั้นถามก่อน), catalog matching
    (ห้ามเดาสินค้า), identity ผ่าน `customer_channel_identities` (046 ชุดเดียวกับ
    webhook), round resolution (เฉพาะ active+มีที่ว่าง), `submitNewOrder` =
    **create เดียวผ่าน `rpc/create_order_with_items`** + `p_external_ref_id` =
    event id (**idempotent** — webhook retry ไม่สร้างซ้ำ) + `buildIntakeLine`
    (ระบบเขียนบรรทัดยืนยันจากผล RPC จริงเท่านั้น)
  - **social-ai-worker:** intent=order_request + message (ช่องทางส่วนตัว) → intake;
    comment สาธารณะ = ไม่สร้าง/ไม่เปิดเผยรายละเอียด (§5.1) ชวนเข้า Inbox/หน้าร้าน;
    footer ระบบแนบท้าย draft; draft พังแต่ระบบมีผล → `fallbackIntakeReply`
    (ไม่เงียบ, ไม่เกินจริง); **ไม่มี mutation surface ของออเดอร์เดิม**
  - **G6-09 boundary revised** (g6Security.test.ts): อนุญาต create-only ผ่าน shared
    intake · ยังแบน record_payment/transition/cancel/refund/update/delete/assign_driver/
    inventory + worker ห้ามเรียก RPC ตรง · เพิ่ม assertion delegation+idempotency
  - **§5 Bite context:** `TalkToBite.composeRealContext()` — ส่งบริบทจากสถานะจริง
    (รายการ/จำนวนใน Cart จาก cart store, route จริง, ช่องทาง) เข้า chatWithAI ทุกครั้ง
    (ท่อ openChat เดิมมีแต่ไม่มีใครเรียก — ตอนนี้สดจาก store ตรง)
  - **Tests ใหม่:** `src/__tests__/socialOrderIntake.test.ts` (20 ข้อ: schema,
    semantic ask-first, catalog match, truthful line, create-only source contract,
    worker wiring/idempotency)
- **Verified:** targeted: intake 20 + G6 28 + G7 63 + continuity 17 + talkToBite 30 +
  biteAIStore 8 + bitePageContext 10 ผ่านทั้งหมด · `tsc --noEmit` = 0 ·
  **full gates รอบสุดท้าย: lint=0 (378 ไฟล์) · tests 104 ไฟล์ / 1,099 ผ่าน · build=0**
- **Failed:** 1 ระหว่างทาง — tsc TS2741 (union type ของ semanticOrderExtract) →
  แก้ type + narrow helper ในเทสต์ (Attempt 1 แก้จุดจริง)
- **Blocked:** `AI_ENTRYPOINT.md` / `UNIVERSAL_MASTER_AI_RULES.md` ไม่มีใน repo (เดิม)
- **Files Changed:** `supabase/functions/_shared/socialOrderIntake.ts` (ใหม่) ·
  `supabase/functions/social-ai-worker/index.ts` · `src/__tests__/g6Security.test.ts`
  (G6-09 revised) · `src/__tests__/socialOrderIntake.test.ts` (ใหม่) ·
  `src/components/ai/TalkToBite.tsx`
- **Tests / Commands Run:** `npx vitest run` (targeted 7 ไฟล์) → ผ่าน · `npx tsc --noEmit` → 0 ·
  `npm run lint` → 0 · `npm test` → **104 ไฟล์ / 1,099 ผ่าน** · `npm run build` → 0
- **Known Risks:**
  - G6-09 เดิมแบน `create_order` ทั้งหมด — ปรับแล้วตามคำสั่ง Owner แต่ยังแบน
    mutation ทุกตัว + worker ไม่แตะ RPC ตรง (regression tests คุมไว้)
  - intake ฝั่ง Messenger สร้างออเดอร์จริงตอนลูกค้ายืนยันชัดเจนเท่านั้น — ยังไม่มี
    live test (ต้องรอ Owner ทดสอบกับเพจจริง)
  - `source_channel` จาก FB ต้องผ่าน channel naming ที่ webhook ใช้ (MESSENGER)
- **Next Exact Action:** ตรวจผล gates → commit/push → Final Report + E2E Checklist

---

## Task ID: ROUND-LINK-2026-10-17
- **Status:** CLOSED — pushed `ab50dc2`
- **Objective:** menu schedule ↔ pre-order ผูกด้วย round key + สวิตช์เปิดปิดทุกรอบ + แอดมินสวิตช์/ดรอปดาวน์
- **Verified:** lint=0 · tests 103 ไฟล์/1,078 ผ่าน · build=0 · tsc=0 (commit `ab50dc2`)
- **Files Changed:** `bmbAdminApi_rounds.ts` · `bmbMenuSchedule.ts` · `catalogStructure.ts` ·
  `AdminMenuSchedule.tsx` · `AdminRounds.tsx` · `HomePage.tsx` · `Footer.tsx` ·
  `menuScheduleRoundLink.test.ts` (9) · `preOrderEntry.test.ts` (5)

---

## Task ID: SOCIAL-AI-2026-10-17 (ปิดแล้ว)
- **Status:** CLOSED — pushed `9d55926`, EF 4 ตัว deploy แล้ว, `BMB_OPENROUTER_API_KEY` ตั้งแล้ว
- **Objective:** แก้ AI ตอบเบิ้ล/สะกดผิด/ข้อมูลมั่ว/แชตหาย + footer social/LINE แอดมินแก้เองได้
- **Verified:** tsc 0 · lint 0 · tests 101 ไฟล์/1,064 ผ่าน · build 0 · deploy EF EXIT=0 ×4 ·
  secret HTTP 201 · รอ Owner เทสต์ Messenger/web ซ้ำ (ยังไม่ Production Verified)
- **Files Changed:** ดู `docs/BMB_HANDOFF_NEXT_SESSION_2026-10-17-EVE.md`
- **Status:** CODE COMPLETE — gates running
- **Objective (Owner):** "menu schedule ซ้ำซ้อนกับ pre-order ให้ลิ้งค์กันจริงด้วย round key
  + ปุ่มเปิดปิดทุกรอบส่ง + การสั่งงานในเมนูแอดมินเป็นสวิตช์ ปิดเปิด และดรอปดาวน์"
- **Completed:**
  - `src/lib/bmbAdminApi_rounds.ts` + `getRoundsForDateAdmin(date)` — ALL rounds of a date
    (รวมรอบปิด; customer `listRoundsForDate` = active only เดิมไม่แตะ)
  - `src/lib/bmbMenuSchedule.ts` + round-key link helpers: `roundKeyOptions()` (dropdown
    จาก `delivery_rounds` จริง — ไม่ hardcode), `nextRoundStatus()`, `toggleDraftEntry()`
  - `src/pages/admin/AdminMenuSchedule.tsx` — การ์ด "รอบส่งของวันนี้" + ToggleSwitch
    เปิด/ปิดทุกรอบ (เขียน `delivery_rounds.status` ผ่าน `setRoundStatus`) + ปุ่ม
    ensure rounds เมื่อยังไม่มีรอบ + product rows: checkbox → ToggleSwitch และ
    dropdown รอบ = `roundKeyOptions(dateRonds)` (ผูก `menu_schedule.delivery_round_key
    ↔ delivery_rounds.round_key` ชุดเดียวกับที่ CheckoutPage ส่งเข้า gate/RPC)
  - `src/pages/admin/AdminRounds.tsx` — ปุ่ม Open/Close คู่ → ToggleSwitch
  - `src/__tests__/menuScheduleRoundLink.test.ts` — 9 regression (dropdown จาก
    รอบจริง/ป้ายปิดรับ/สวิตช์/immutability/ลิงก์ gate end-to-end/source invariants)
- **Verified:**  targeted vitest (menuSchedule ชุด + roundLink 9 ข้อ) ผ่าน · `tsc --noEmit` = 0 ·
  **full gates รอบสุดท้าย: lint=0 · tests 103 ไฟล์ / 1,078 ผ่าน · build=0** (build จับ TS error
  `siteCopy.homePreOrderTitle` — แก้แล้ว รันซ้ำเขียวทั้งชุด)
- **Failed:** 1 ครั้งระหว่างทาง — expectation ในเทสต์ใหม่เองผิด (ไม่ใช่โค้ด) — แก้เทสต์ให้ตรง
  semantics ดั้งเดิมของ sentinel `__off__` (off→on = ทุกรอบ) ตาม anti-gaming rules
- **Blocked:** `AI_ENTRYPOINT.md` / `UNIVERSAL_MASTER_AI_RULES.md` ไม่มีอยู่ใน repo
  (ค้นทั้ง working tree แล้ว) — Owner ต้องเพิ่มไฟล์ universal rules ของท่านเอง
- **Files Changed:** `src/lib/bmbAdminApi_rounds.ts` · `src/lib/bmbMenuSchedule.ts` ·
  `src/pages/admin/AdminMenuSchedule.tsx` · `src/pages/admin/AdminRounds.tsx` ·
  `src/__tests__/menuScheduleRoundLink.test.ts` (ใหม่)
- **Tests / Commands Run:** `npx vitest run` (targeted) → ผ่านทั้งหมด · `npx tsc --noEmit` → 0 ·
  `npm run lint` → 0 (brandNameGuard 376 ไฟล์) · `npm test` → **103 ไฟล์ / 1,078 ผ่าน** ·
  `npm run build` → 0
- **Known Risks:**
  - `delivery_rounds` มีคู่คอลัมน์ legacy (`name`/`round_key`, `date`/`scheduled_date`) —
    โค้ดใหม่ใช้ `round_key` + `scheduled_date` ตามที่ checkout ใช้จริง (ยืนยันแล้ว)
  - สวิตช์รอบเขียน `delivery_rounds.status` ตรง (admin RLS) — create RPC ยังเป็น
    authority เดียวตอนสั่งซื้อ (ERR_ROUND_CLOSED) — UI = display mirror เท่านั้น
  - Scope ใหญ่ของ PRE-OPENING DIRECTIVE (audit ทั้งระบบ) ยังเหลือ Phase A/B เต็มรูปแบบ —
    ดู `docs/BMB_HANDOFF_NEXT_SESSION_2026-10-17-EVE.md`
- **Next Exact Action:** ตรวจผล gates → commit/push → รายงาน Final Report (Directive §13)
  พร้อมแผน Final E2E

---

## Task ID: SOCIAL-AI-2026-10-17 (ปิดแล้ว)
- **Status:** CLOSED — pushed `9d55926`, EF 4 ตัว deploy แล้ว, `BMB_OPENROUTER_API_KEY` ตั้งแล้ว
- **Objective:** แก้ AI ตอบเบิ้ล/สะกดผิด/ข้อมูลมั่ว/แชตหาย + footer social/LINE แอดมินแก้เองได้
- **Verified:** tsc 0 · lint 0 · tests 101 ไฟล์/1,064 ผ่าน · build 0 · deploy EF EXIT=0 ×4 ·
  secret HTTP 201 · รอ Owner เทสต์ Messenger/web ซ้ำ (ยังไม่ Production Verified)
- **Files Changed:** ดู `docs/BMB_HANDOFF_NEXT_SESSION_2026-10-17-EVE.md`
