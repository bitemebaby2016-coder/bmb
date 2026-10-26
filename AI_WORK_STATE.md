> ## 🟢 สถานะล่าสุด — ปิดเซสชั่น 2026-10-26 (ยึดบล็อกนี้ + `docs/BMB_HANDOFF_NEXT_SESSION_2026-10-26.md` ถ้าข้อความด้านล่างขัดกัน)
> - **ปิดแล้ว (มี evidence ทุกข้อ):** **W-1** (`REPLAY_ALL_GREEN 157/157` · parity MATCH = rls 67=67 · acl_tables 768=768 · ledger 158=158 · `e2e/w1-parity-report-2026-10-26.md`) · **W-2** (legacy contract **7/7** → Contract Tests **#151/#153/#155 success**) · **W-3** (`marketing_rules` มีค่ารอบก่อน → C7/C8 — *probe ซ้ำวันนี้ = 42501 → คง **UNVERIFIED***) · **W-5** (เอกสารชุดเดียว) · **UI 9 ข้อครบ** = L-1/2/6/9 (รอบก่อน) + **L-3/4/5/7/8 (Owner 2026-10-26 · test รายข้อ: uiTapScroll/menuTopTabs/votePageUi/headingOrderFooter/preOrderLockUi · gates ALL ZERO · CI `67f10b8` #585/#159)** · **B-6 (P0)** apply 157+158 แล้ว (Owner อนุมัติ · ledger top 158 · evidence `e2e/w6Apply157158-{precheck,apply157,apply158,verify,record}.json`) · **legacy 6 functions = Owner สั่ง DROP · migration 159 = PREPARED — NOT APPLIED TO PRODUCTION** (ยังยืนยันไม่ได้ว่าลบออกจาก production แล้ว) → `supabase/migrations/159_drop_legacy_manual_functions.sql` (IF EXISTS · parity signatures · **CI auto-apply เฉพาะ ephemeral — ห้าม apply production จนกว่า Owner ยืนยัน + precheck**)
> - **เหลือ (หลัง reconcile 2026-10-26):** **(ก)** production runtime = **บางส่วน verify**: Pages serving ✓ (marker `btn-locked` ใน CSS/JS จริง) แต่ **`marketing_rules` re-read 42501 → C7/C8 = UNVERIFIED** · **B2 = UNVERIFIED** (code-fix โดย L-6 มี test · ยังไม่เห็นของจริง) · **(ข)** **apply 159 production = PREPARED ยังไม่ทำ** (รอ Owner ยืนยันรอบสุดท้าย + precheck) · **(ค)** **test pack ฉบับ reconcile (§L → L-RT) ให้ Owner รัน** — รายการปิดมี evidence ไม่ต้องซ้ำ → **ยังห้ามสรุปว่าปิดครบทุกลูป**
> - **git:** HEAD = `5f891de` = origin/main (docs reconcile · CI **#586 success** · Contract **#160 success**) · โค้ดปิด UI = `67f10b8` (CI **#585 success** · Contract **#159 success** · Pages job success) · ผล CI ทุก SHA = `BMB_MASTER_STATUS.md` §9.0 (failure #152 = §9.8) · stash `local-edits-before-sync-2026-09-21` = เดิมของเซสชั่นอื่น **ห้ามแตะ**
> - **gates รอบปิด (2026-10-26):** tsc 0 · eslint 0 · brandGuard 0 (434 ไฟล์) · **vitest ทั้งชุด 0 fail** · build 0 → evidence **`e2e/gates_ui2026-10-26.log` = ALL 5 EXIT=0** (เดิม: `session20261026-r3-gates-evidence.log` · `gates_final.log`)
> - ⚠️ **กติกาปิดงาน:** UI 9 ข้อ (โค้ด+test+CI เขียว) + legacy = **เตรียมเสร็จ (159 ยัง NOT applied production)** · Pages serving = **verify แล้ว (marker btn-locked)** — **ยังห้ามพูด "ปิดครบทุกลูป / เหลือ Owner อย่างเดียว"** จนกว่าจะครบ: **marketing_rules/B2 มีหลักฐานใหม่** (C7/C8/B2 ตอนนี้ = UNVERIFIED) · **159 apply+verify production จริง** (เมื่อ Owner สั่ง) · **test pack ฉบับ reconcile รันผ่าน**
>
## 1. งานที่ทำอยู่ (สำคัญสุด — นี่คือ "Current Work State")
# Bite Me Baby — AI Work State (บันทึกสถานะสำหรับแชทถัดไป)

> **ไฟล์นี้ = บันทึกสั้นของเซสชันล่าสุดเท่านั้น**
> เอกสารสถานะหลัก (canonical current state / capability matrix / backlog / evidence) =
> **`docs/BMB_MASTER_STATUS.md`** — ถ้าขัดกันให้ถือไฟล์นั้น + โค้ดจริงเสมอ (DOC DRIFT)
> กติกาคงเดิม: No evidence = not done · SKIPPED ≠ PASS · ห้ามมี task `NOT_STARTED`/`IN_PROGRESS`
> ค้างโดยไม่มีหลักฐาน · ห้ามใช้รายงานเก่าใน `docs/` (ที่มีวันที่) มาสั่งงานซ้ำแทนไฟล์สถานะหลัก

**last_updated:** 2026-10-26 · **session:** whole-repo reconciliation + code closure (Owner directive 2026-10-26)

---

## 1. HEAD / gates (ตรวจริงบนเครื่อง 2026-10-26)

- repo `D:\A PROJECT\Bite Me Baby` · `main` = `origin/main` · **HEAD ก่อนเริ่มงาน = `47b33e1`**
- working tree clean · staged/unstaged ว่าง · **untracked = 0** · stash `local-edits-before-sync-2026-09-21` **คงเดิมไม่ถูกแตะ**
- **รอบที่ 3 (2026-10-26 · ปิด W-1/W-2 + UI 4 ข้อ) — สิ่งที่รัน/มีหลักฐาน:**
  - **fresh replay 001→157 = `REPLAY_ALL_GREEN 157/157`** (`e2e/w1-replay-apply-2026-10-26-full.log` ·
    `e2e/w1-replay-apply-2026-10-26-full.jsonl`)
  - **legacy contracts 7/7 EXIT=0** บน replay ชุดเดียวกัน (`e2e/w2-contracts_*.log`)
  - **schema parity รันแล้ว** → `e2e/w1-parity-2026-10-26.json` + รายงาน `e2e/w1-parity-report-2026-10-26.md`
  - unit ที่เพิ่ม/รันตรง: `storeStatusWindow` 4/4 · `uiTechnicalLabels` 4/4 ·
    `mascotClosed`+`roundsSameDayNoCutoff` 34/34
  - gates ชุดใหญ่ (tsc/eslint/brandGuard/vitest/build) = **ทุกตัว exit 0 · vitest 1549 tests 0 fail**
    → evidence = **`e2e/session20261026-r3-gates-evidence.log`**
- **รอบที่ 2 (ปิด backlog ทั้งหมด):** tsc 0 · eslint 0 · brandNameGuard OK · vitest 146 files /
  1541 tests 0 fail · build 0 → `e2e/session20261026-r2-gates-evidence.txt`
- **production: ไม่ได้แตะ migration/apply/deploy/write ใด ๆ ในรอบนี้** (การเขียน production รอ Owner อนุมัติ —
  ดู B-6 ใน §3) · ledger ของรอบก่อน top = **156**
- **CI canonical (ตารางเดียวทุก SHA):** `docs/BMB_MASTER_STATUS.md` **§9.0** · ห้ามอ้างเลขรันกระจัดกระจาย

## 2. งานที่ปิดรอบนี้ (CLOSED — มีหลักฐาน)

### รอบที่ 1 (เส้นทางสั่งซื้อ + docs + dead code)
1. **เส้นทางสั่งซื้อเดียว** สำหรับพรีออเดอร์+เซมเดย์: สร้าง `src/lib/orderEntry.ts` (`runOrderBuilder`) แล้วให้
   `HomePage`/`MenuPage` delegate — เดิมมีสำเนา logic คู่กัน 2 ชุด (Owner: "มีหลายเส้นทางจนมั่วกันเอง")
2. **บั๊กจริงที่แก้:** `HomePage.handleReviewCta` ไม่เคยเช็ค `AddToCartResult` ก่อน toast "เพิ่มลงตะกร้าแล้ว" + navigate
3. **ลบ dead code 11 ไฟล์** (พิสูจน์ 0 reference ทั้ง `src` รวม tests และ `supabase/scripts/e2e/.github/public`)
4. **ปิด D14** (settings default ซ้ำ): `platformConfig` hardcode `dailyQuota 120` vs canonical `100` →
   อ้าง `ORDER_POLICY_DEFAULTS` + test ใหม่ใน `configAuthorityMap.test.ts`
5. **เอกสาร:** สร้าง `docs/BMB_MASTER_STATUS.md` (สถานะหลักเดียว) · ปรับไฟล์นี้ให้สั้น ·
   เพิ่มจุดชี้ใน `AI_ENTRYPOINT.md` · `docs/archive/INDEX_2026-10-26.md`

### รอบที่ 2 (ปิดงานค้างตามคำสั่ง Owner — ปิด 4/5 · B-2 = BLOCKED)
6. **B-1 ปิด:** `orderTimeline` + `categorySections` + `homeSectionModeCta` deterministic ด้วย
   render+flush ใน `act()` (assertion คงเดิมทุกข้อ ไม่มี skip)
7. **B-2 ไม่ปิด (BLOCKED):** เพิ่ม legacy contract 7 ตัวเข้า CI = Contract Tests #147 **ล้มเหลวทั้ง 7** →
   ซ่อมตามหลักฐาน + ตรวจด้วย replay ท้องถิ่น 2 รอบ = เขียวแค่ 1/7 → **หยุดตามกติกา 0.9** · rollback หมด ·
   step ถูกถอดออกจาก workflow (มี comment อธิบายในไฟล์) · รอ Owner เลือก (ก) ซ่อม หรือ (ข) ปลดระเบียบ
8. **CAP-21 ปิด:** `src/lib/customerIntelligence.ts` + `/admin/customers` (แถบสรุป + คอลัมน์กลุ่ม) =
   **อัตโนมัติทุกครั้งที่โหลด ไม่มีช่องให้แอดมินตั้ง** · test `customerIntelligence.test.ts`
9. **CAP-22 ปิด:** `src/lib/marketingAutoSchedule.ts` + ปุ่ม "ให้ AI เลือกเวลาทั้งหมด" ในแท็บปฏิทิน =
   เลือกเวลาจาก `marketing_rules` จริง → RPC เดิม → worker เดิม · **คงกติกา CNT-01 (ห้าม auto-approve)**
   · test `marketingAutoSchedule.test.ts`
10. **B-5 ปิด (ส่งมอบ):** ชุดทดสอบ production รวม = **`docs/BMB_PRODUCTION_TEST_PACK.md`** (ขั้น A–K)

## 3. งานค้าง (สถานะจริง ณ 2026-10-26 รอบที่ 3 — **ยังไม่ใช่ "เหลือ Owner อย่างเดียว"**)

- **ปิดแล้วรอบนี้ (มีหลักฐาน):**
  - **W-1 fresh replay + schema parity** — `REPLAY_ALL_GREEN 157/157` + parity รันแล้ว ·
    drift 5 กลุ่มมีคำอธิบาย/แผนครบ = `e2e/w1-parity-report-2026-10-26.md` → §4/§5 = VERIFIED
  - **W-2 legacy contracts 7 ตัว (B-2)** — ทั้ง 7 ไฟล์ EXIT=0 · step กลับเข้า `contract-tests.yml`
  - **UI 4 ข้อ:** L-1 (ป้าย theater) · L-2 (Marketing Testimonials) · L-6 (แถบสถานะ ~11:00) ·
    L-9 (เฟรม 1:1) — มี test กำกับครบ (`uiTechnicalLabels` · `storeStatusWindow`)
  - **W-3 CAP-22** — `marketing_rules` **มีค่าจริงอยู่แล้ว** (window 10:00–19:00 · cooldown 6 · 3/สัปดาห์)
    → C7/C8 ปลดล็อกได้ · เหลือแค่ `menu_rules`/`stop_conditions` ที่ยังว่าง (ทางเลือก)
- **blocker/งานค้าง:**
  - **B-6 (P0) = ปิดแล้ว ✅** — guest อ่านเมนู production ไม่ได้ (401 is_staff) → **apply 157 + 158 แล้ว
    (Owner อนุมัติ 2026-10-26)** → ตรวจซ้ำ: PostgREST ทุก endpoint = 200 · Playwright เปิด `/menu` จริง =
    เห็นเมนูครบ + **console ไม่มี error** → `e2e/w2_guest_menu_probe.cjs` (รอบหลัง apply)
  - **W-1 แผน: ปิดแล้ว 2 ใน 3** (RLS 2 ตาราง + align grants = migration 158 apply แล้ว) ·
    เหลือ **legacy functions 6 ตัว** (ไม่มี src caller) = รอ Owner เลือกปลด/คง
  - **UI ฝั่งลูกค้า ยังเหลือ 5 ข้อ:** L-3 (จิ้มแล้วเลื่อนทุกหน้า) · L-4 (แท็บหัวข้อไม่ครบ/โหมดผิด) ·
    L-5 (โหวตเมนูไทย+ครบทุกเมนู) · L-7 (ลำดับ+ลิงก์หัวข้อ/ฟุตเตอร์) · L-8 (พรีออเดอร์สีเทาทุกจุด)
    — รายละเอียด = `docs/BMB_MASTER_STATUS.md` §3.1 (N-4) + เกณฑ์ `BMB_PRODUCTION_TEST_PACK.md` §L
- **แฮนด์ออฟทั้งหมด:** `docs/BMB_HANDOFF_NEXT_SESSION_2026-10-26.md`

## 4. งานรอ Owner (ไม่ใช่งาน AI) — **รันได้เฉพาะที่ไม่ติด blocker**

- = **`docs/BMB_PRODUCTION_TEST_PACK.md`** · ตอนนี้ **ปลดได้:** A1/A2 (เมื่อ CI รอบนี้เขียว) · A3 ·
  B (รวม **B2** — แถบสถานะแก้แล้ว) · **C7/C8** (rules มีค่าจริง) · D–K
  · **ยังงด:** ขั้นที่ผูกกับ UI 5 ข้อที่ค้าง (L-3/4/5/7/8)
- **ห้าม**พูดว่า "เหลือ Owner อย่างเดียว" จนกว่า: (1) B-6 ปิด (apply 157 + พิสูจน์ guest เห็นเมนู) ·
  (2) UI 5 ข้อที่ค้างปิด · (3) W-1 แผน 3 ข้อ มีคำสั่ง (Owner 2026-10-26)

## 5. คำสั่ง/rules ที่ห้ามลืม

- **Owner directive 2026-10-26** (whole-repo reconciliation · code closure · lean production acceptance)
- **PRE_ORDER vs SAME_DAY:** SAME_DAY **ไม่มี cutoff** · PRE_ORDER มี cutoff ตาม policy (server 143/148) —
  ห้ามเอา requirement ที่ถูกยกเลิกจากเอกสารเก่ากลับมา
- เอกสารย้อนหลังทั้งหมด = `docs/archive/` (มี index) — **ห้ามใช้รายงานเก่าสั่งงานซ้ำ**