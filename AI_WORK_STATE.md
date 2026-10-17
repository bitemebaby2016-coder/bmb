# AI_WORK_STATE — Bite Me Baby (evidence ledger)

> Updated per `.clinerules` WORK STATE rule after each meaningful task.
> Rule source of truth: `UNIVERSAL_MASTER_AI_RULES.md` (⚠️ **not present in repo
> yet** — see "Blocked" below), bootstrap: `AI_ENTRYPOINT.md` (⚠️ not present).

---

## Task ID: ROUND-LINK-2026-10-17
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
