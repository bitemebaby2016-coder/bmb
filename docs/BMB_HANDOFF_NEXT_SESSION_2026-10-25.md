# BMB — NEXT SESSION HANDOFF (ปิดเซสชัน 2026-10-25 · Wave 2)

> เป้าหมายสูงสุด: **ปิดงานวิศวกรรมทุกฟีเจอร์/เมนูให้ลูปจบสมบูรณ์ — เหลือแค่ Owner ทดสอบจริงบน production**
> สถานะ ณ ปิดเซสชัน: งานที่สั่งทั้งหมด (กฎ §12 · เอกสาร · Features A/B/C) **เสร็จ + gates เขียวครบแล้ว**

## 1. ทำอะไรเสร็จแล้ว (commit `8023268` + คลื่นนี้)

### คลื่น 1 — D1–D8 (commit `8023268` · CI + Contract Tests success)
- **D1** ลบ lazy ตาย 4 ตัวใน App.tsx · **D5** ถอดช่องคัทออฟเดิมจริง + เกณฑ์ #6 ใหม่ ·
  **D2** ศูนย์ขนส่งเดียว `/admin/delivery` 5 แท็บ · **D3** config authority map + เทสต์ ·
  **D7** migrations **150/151** + wave1=superseded · **R-08** POD ข้ามเบราว์เซอร์ · **R-10** role matrix test

### คลื่น 2 (คลื่นนี้)
- **Rules §12** ใน `UNIVERSAL_MASTER_AI_RULES.md` + `.clinerules`: ห้าม poll logs/ใช้ watch mode ·
  ปกป้อง terminal/process · **admin auto-scroll UX** (จิ้มปุ่มใด = เด้งไปฟอร์มที่ทำงาน) + การ์ดเท่ากัน
- **Feature A · Hybrid pre-order cart:** แท็บพรีออเดอร์ที่ /menu รวมสินค้าทั่วไป (จองร่วมรอบเดียวในตะกร้าเดียวกัน —
  เรียงเมนูปฏิทินก่อน, ปุ่มในแท็บเพิ่มเป็น PRE_ORDER) · `checkModeEligibility` = general ride-along (เท่า server 142 G2) ·
  หน้าต่างจอง ≤7 วัน = `pre_order_lead_days` ใน order_policy (**แอดมินตั้ง/เปลี่ยนได้แล้ว — ไม่ต้องแก้เพิ่ม**)
- **Feature B · Homepage:** ลำดับ sections = **แนะนำ → ส่งวันนี้ → พรีออเดอร์ → หมวดหมู่**
  (ลำดับหมวด pinned: สุขภาพ → เครื่องดื่ม → ของทานเล่น/ผลไม้ → สำเร็จรูป ผ่าน `categoryDisplayRank` ใน
  `catalogStructure.ts`) · **แท็บแนวนอน** ทั้งหมด|ส่งวันนี้|พรีออเดอร์|หมวดหมู่ = ลิงก์ smooth-scroll ไป section ·
  แอดมินเปิด/ปิด/จัดหมวด เหมือนเดิม (is_active + sort_order ของหมวดนอกลิสต์)
- **Feature C · Admin Products:** แท็บหมวดหมู่กรองสินค้า + หัวข้อปัจจุบัน · จิ้ม "แก้ไข/เพิ่มเมนู/แก้หัวข้อ/ย้ายสินค้า"
  = **smooth-scroll ขึ้นฟอร์มอัตโนมัติ** (refs + useEffect) · การ์ดสินค้า**เท่ากันทุกใบ**
  (`min-h-[430px]` + `auto-rows-fr` + ปุ่ม `mt-auto` — แก้ปัญหา 2 ใบใหญ่ไม่เท่าเพื่อน)
- **เทสต์:** `homeMenuAdminOrdering.test.ts` 9 ข้อ (A/B/C) + `categorySections.test.ts` 5 ข้อ (ปรับสัญญาเรียงหัวข้อตาม pinned order) · **Gates:** tsc 0 · lint 0 ·
  vitest **138 files/1426 tests 0 fail** · build 0 (PWA 143)

## 2. งานค้างที่เหลือ (ลำดับที่แนะนำให้แชทหน้าทำ)

| # | งาน | สถานะ/วิธีทำ | ต้อง Owner? |
|---|---|---|---|
| 1 | **ซ่อม stale contracts 8 ไฟล์** (023/028/030/036/037/038/039/125) | failure map จริงจากการรันบน replay 001–151: **(a) radius** 023/028/036/039 = fixture ขาด `kitchen_location` (ห่าง test coords 212 km) → seed kitchen coords ใกล้ (10.70,102.14) + radius 5km ตาม intent ทดสอบ · **(b) menu-gate 142** 030/038 = fixture ขาด `menu_schedule` row → ใส่แบบ contracts_142 · **(c)** 125 = `driver_login` parse ค่า claims ว่างเป็น json → set claims ให้ถูกก่อน T5 · **(d)** 037 = ดู error จริงเพิ่ม (exit 3 ไม่มี ERROR line) | ไม่ (ทำได้เลย) |
| 2 | **production apply migrations 150/151** | 150 = idempotent schema parity (`orders.delivery_address`) · 151 = history baseline (HISTORICAL_BASELINE — ถ้า Owner เลือก BACKFILL_UNKNOWN ให้ทิ้ง 151) · ทำแบบ staged precheck/apply/verify เหมือน r8Apply148 | **ใช่ — authorize แยก** |
| 3 | **D6 · ปลด build เก่า `bitemebaby-5f7.pages.dev`** | ต้อง CF account: ลบ Pages project เก่า/ตั้ง redirect → biteme-baby.com · เช็กว่าไม่มี integration ชี้อยู่ก่อน | **ใช่ (CF access)** |
| 4 | **Owner runtime acceptance** บน production | แผน `docs/BMB_E2E_PRODUCTION_ACCEPTANCE_PLAN_2026-10-24.md` §4 (#2–#5, #8, #9, #12, #14a–14j) + เกณฑ์ #6 ใหม่ + เช็ก A/B/C จริง: แท็บพรีออเดอร์รวมสินค้าทั่วไป · ลำดับหน้าแรก+แท็บลิงก์ · แอดมินจิ้ม→เด้งฟอร์ม · การ์ดเท่ากัน | **ใช่ (ของจริง)** |
| 5 | R-17 restore drill บน backup จริง | รัน `scripts/dbRestoreDrill.mjs` กับ backup ล่าสุด เก็บ evidence | ไม่ |
| 6 | R-16 พิมพ์ใบเสร็จ/คิวแม่ครัวบนเครื่องจริง | printService พร้อมแล้ว (receipt/kitchen_ticket + autoPrint) — เทสต์บนเครื่องจริง | ใช่ (อุปกรณ์) |

## 3. กฎการทำงานที่ต้องจำทุกเซสชัน (§12)
1. ห้าม loop อ่าน `.tmp_*.log` · ทดสอบด้วย `npx vitest run` เท่านั้น (ไม่ใช่ watch mode)
2. ห้ามรัน dev server/watcher ใน terminal หลัก · kill เฉพาะ process ของตัวเอง · script .cmd = absolute paths ไม่มี label
3. ปุ่มทำงาน/แก้ไขในแอดมิน = smooth-scroll ไปฟอร์มที่เกี่ยวเสมอ · การ์ดในกริดต้องเท่ากัน

## 4. เกตบังคับก่อน push ทุกครั้ง
`npx tsc --noEmit` → `npm run lint` → `npx vitest run` → `npm run build` → (ถ้าแตะ SQL) Docker replay 001→151 + contracts → commit/push เฉพาะ path ที่ตรวจแล้ว → เช็ค CI + Contract Tests เขียว

---

## 5. 🔴 UPDATE (รอบ CONTINUOUS EXECUTION · 2026-10-25 ต่อจาก Wave 2)

### 5.1 แก้ตามคำสั่ง Owner ระหว่างทาง
- **ปุ่ม CTA "จองล่วงหน้า — สั่งอาหารจันทบุรี เตรียมพร้อมส่ง"** = ย้ายเข้าหมวด `home-sec-preorder`
  และ **แสดงเฉพาะตอนเปิดแท็บ 📅 พรีออเดอร์เท่านั้น** (`homeTab === 'preorder'` gate · แท็บ/หน้าอื่นไม่แสดง)
  — แก้ใน `src/pages/HomePage.tsx` (ไม่สร้างคอมโพเนนต์ใหม่) · สัญญาเทสต์ `preOrderEntry.test.ts`
  realign + เพิ่ม regression ตามคำสั่งใหม่ (ลบ assertion "ก่อน Popular" เดิมที่ขัดคำสั่ง — เปิดเผยในคอมเมนต์)

### 5.2 Task A — stale contracts 8 ไฟล์: **7/8 GREEN แล้ว + 039 เหลือ 1 assertion รอ Owner**
หลักฐาน: replay 001-151 (CI preprocessor verbatim) = **MIGRATIONS_OK** · รัน `e2e/contracts_*.sql` ทั้งหมด
- ✅ 023/028/030/036/037/038/125 = **rc=0** (สรุป `.tmp_contract_logs/SUMMARY.txt` ระหว่างรอบ — ลบไฟล์ temp หลังย้าย evidence)
- ⛔ **039 = G1–G6 PASS · G7 FAIL `anon EXECUTE set_menu_schedule`** = **defect จริง**: ไม่มี
  `REVOKE EXECUTE ... set_menu_schedule/publish_menu_schedule` จาก `PUBLIC/anon` ใน migration ใด ๆ
  (probe ครบทุกไฟล์ + Select-String GRANT/REVOKE ใน 039 มีแค่ get_menu/enforce_*) — มี internal
  `is_admin()` gate คุมอยู่ (G2 ผ่าน) = defense-in-depth ขาด · **แก้ = migration REVOKE = security
  change → ต้อง Owner sign-off (§6/audit rule) — ห้ามแก้สัญญาเทสต์ฝ่ายเดียว**
- ชั้นความล้มเหลวและวิธีแก้ (evidence-based ทุกข้อ): radius fixture (kitchen 10.7016/102.1429 + รัศมี 5) ·
  menu_schedule fixture (แบบ 142) · `mark_payment_failed` ถูกถอด (`aa43dc2`) → ย้าย T14/T7 ไป
  `record_payment_result(status='failed')` (canonical · `bmbAdminApi_orders.ts:408`) + intent seed ·
  zone 095 ทับ 020 → deactivate 3 โซนกลางใน txn · permission `RESET ROLE` 2 จุดใน 038 ·
  G3 038 = "TODAY" ล้าสมัยตาม **143 (Owner production test: พรีออเดอร์วันนี้ได้)** → ย้ายไป PAST ·
  G3b/G4 039 + T4 023 realign กับ **142 R5c menu-gate authority** · `driver_login` 2-arg ถูกถอด →
  rider fixture pattern แบบ 036 + admin claims ก่อน `guard_profile_mutation` · assignment INSERT = postgres
- ⚠️ นอก mandate (ไม่ได้แก้ — นอกเหนือ 8 ไฟล์ที่สั่ง): contracts_017_018/019/020/021/022/029/033
  fail ภายใต้ full-glob run (สายเก่า/ไม่อยู่ใน CI steps) — รายงานไว้ให้ Owner สั่งเพิ่ม

### 5.3 งานอื่น ๆ ในรอบนี้
- **Task B (150/151):** วิเคราะห์ครบ — impact/verify/rollback/ทางเลือก BACKFILL_UNKNOWN →
  `docs/BMB_OWNER_PREP_R16_D6_MIGRATIONS_2026-10-25.md` §3 · **รอ authorize แยก**
- **Task C (D6 pages.dev):** ขั้นตอน+หลักฐานเตรียมแล้ว (prep doc §2) · **รอ Owner (CF account)**
- **Task D (R-17 drill):** รัน `scripts/dbRestoreDrill.mjs` รอบนี้ — ดู `.tmp_drill.log` (evidence ย้ายก่อนลบ temp)
- **Task E (R-16):** เตรียม runbook + แยก automated-vs-จริงแล้ว (prep doc §1) · **พิมพ์จริง = Owner acceptance**
- **3.1 Admin Dashboard / 3.2 Graphite / 3.3 Audio = ตรวจแล้ว DONE มีหลักฐาน** (AdminNav sidebar shell
  single-nav + adminNavFeedback test · AdminDashboard Zone A/B/C · `theme.ts` 3 ธีม+2 เทสต์ต ·
  `ambientMusic.ts` opt-in gesture/volume/duck/singleton+เทสต์) → ไม่สร้างซ้ำตามคำสั่ง · เหลือตา Owner บนเบราว์เซอร์
- **Growth & Rewards = เอกสารเท่านั้น** (`docs/BMB_GROWTH_REWARDS_REQUIREMENTS_2026-10-25.md` +
  `docs/BMB_GROWTH_REWARDS_INVENTORY_2026-10-25.md`) · **ไม่มี implementation ก่อนอนุมัติ**

### 5.4 สถานะหลังรอบ 2 (2026-10-25 ต่อเนื่อง — รายละเอียดครบ = `docs/BMB_OWNER_STATUS_REPORT_2026-10-25.md`)
- ✅ **4 บั๊กหน้าจอ Owner แก้ครบ:** หัวข้อซ้ำ+alias reorder · กรอบการ์ดถอด · label แอดมิน = adminCats · แถบสถานะ 2 เลน (preOrderLine)
- ✅ **Production apply เสร็จ (อนุมัติแล้ว):** 150 ✓ (col+comment · orders ไม่แตะ) · 151(ก) ✓ (insert 0 — history ครบจริง) ·
  152 ✓ (รอบแรกพังด้วยหัว `//` → แก้ `--` · anon=false/auth=true) · record 150/151/152 ✓ — evidence = `e2e/r12Apply150_152-*.json`
- ✅ **Gate รอบสุดท้าย:** clean-room replay 001–152 MIGRATIONS_OK · **contracts 40/40 fail=0 ALL_GREEN** (mandate 8 ครบ ·
  legacy 7 เขียวเอง) · tsc 0 · lint OK · vitest 140/1424 0 fail · build ✓
- ⛔ รอ Owner: ล้าง PWA cache แล้วตรวจ §D ของ status report · ลบทดสอบ D6 pages.dev (ท่านทำเอง) · R-16 พิมพ์จริง ·
  acceptance plan §4 · G&R 8 คำถาม (ห้าม implement ก่อนอนุมัติ) · legacy 7 = "ไม่ซ่อม" (คำสั่ง — เขียวอยู่แล้ว)

---

## 6. 🔴 SESSION CLOSE (2026-10-25) — ส่งต่อทั้งหมดไปเซสชั่นหน้า

### 6.1 คำตอบ/อนุมัติของ Owner ที่เขียนลง `BMB_GROWTH_REWARDS_INVENTORY_2026-10-25.md` แล้ว (วัตถุประสงค์+กติกาตั้งต้นครบ)
- **§1.1–§1.7 = อนุมัติทั้งหมด** เพิ่มเติม: 1.3 → "ลบฮาร์ดโค้ด ปิดช่องว่าง" (สร้าง server points ledger) · 1.4 → Vote "คิดเองได้จากเมนูที่มี" ·
  Share "เชื่อมจากลิงก์จริงที่แอดมินตั้ง ปรับได้ตลอด" · Notification "แจกทาง notice + เก็บในโปรไฟล์" · streak "ทำด้วย" + "inspect เพิ่ม 4" ·
  1.7 → "ไม่ชัดเจนให้ถามทันที ไม่ต้องเดา"
- **§5 ทั้ง 8 ข้อ:** ① อัตราแต้ม/เพดาน/อายุ = ใช้ระบบบันทึกยอดสุทธิสะสมเชื่อถือได้ → **ตรวจสอบก่อน ยังไม่สร้างระบบใหม่ทันที**
  ② Tiers = เช่นข้อ 1 (ตรวจสอบก่อน ยังไม่สร้าง) ③ Referral = identity ด้วยบัญชีที่ระบุตัวตน + OTP ยืนยันเบอร์ (IP/อุปกรณ์ = สัญญาณเดียวห้ามใช้ปฏิเสธรางวัล) ·
  self-referral 3 ระดับ Hard block/Review/Soft signal · รางวัลเมื่อออเดอร์ผ่านสถานะ · cancel/refund ปรับตาม ledger ไม่หักซ้ำ ·
  attribution ตรวจสอบย้อนหลังได้ · **inspect auth/guest checkout/OTP จริงก่อนตัดสินใจ unique key** ④ Spin&Win = **ใช่** (มีรางวัล/แต้ม)
  ⑤ Affiliate = **ใช่** (แต้ม/คูปอง ไม่มีเงินสด) ⑥ งบ AI/เพดานส่วนลด/kill switch = **15% ของยอดขาย · แอดมินปรับเองได้**
  ⑦ แคตตาล็อก Rewards = **ย้าย hardcode → ตาราง admin ตั้งเอง** ⑧ **Rollout: Promotions → Referral → Loyalty Tiers → Engagement & Play**
  + เงื่อนไขเลื่อนระยะ (ไม่เลื่อนเพราะ UI เสร็จ · business rules/server validation/tests/สิทธิ์ ต้องผ่านก่อน)
- ⛔ **ยังคงเดิม:** inventory §6 = "Implementation รอคำสั่งพัฒนาแยก" — คำตอบเหล่านี้ = วัตถุประสงค์/กติกาตั้งต้น **ยังไม่ใช่คำสั่ง start**

### 6.2 งานที่ส่งต่อเซสชั่นหน้า (ทำตามลำดับนี้)
1. **ตรวจ §D ของ `BMB_OWNER_STATUS_REPORT_2026-10-25.md`** (hard refresh ก่อน · 6 ข้อ: หัวข้อไม่ซ้ำ+alias เรียงใหม่ · การ์ดไร้กรอบ · แถบสถานะ 2 เลน · label แอดมินตรงแท็บ · deep-link `?category=` · แจ้งเมื่อ D6 เสร็จ)
2. **D6** — ท่านลบทดสอบ `bitemebaby-5f7.pages.dev` เอง (prep doc §2) → ปิดงาน
3. **R-16 พิมพ์จริง** — runbook prep doc §1 (automated PASS ≠ พิมพ์จริง)
4. **acceptance plan §4 ข้อ #1–#14** — PENDING ทั้งหมด
5. **Growth & Rewards** — คำตอบครบใน inventory (§1/§5) → งานถัดไป = **รอท่านพิมพ์คำสั่ง "เริ่มพัฒนา"** แล้วเรียงตาม Rollout ข้อ ⑧
   (เริ่มสุด = Promotions ต่อยอดคูปองเดิม+งบ 15% · ข้ามขั้นไม่ได้ · **ห้ามลงมือเองก่อนคำสั่ง**)
6. **ปิดแล้วรอบนี้ ไม่ต้องทำซ้ำ:** 4 บั๊กหน้าจอ ✓ · production 150/151/152 apply+verify+record ✓ · stale contracts 8/8
   (039-G7=152) ✓ · legacy 7 เขียว(ไม่ซ่อม) ✓ · R-17 PASS ✓ · G&R docs ✓ · 3.1/3.2/3.3 DONE ✓ ·
   gates: replay 001-152 ALL_GREEN · contracts 40/40 · vitest 140/1424 0 fail · tsc/lint/build ✓
7. **Git:** `be1b012` (รอบแก้+migrations+evidence) · `77ed0eb` (Owner rules v1.1/v2.1) — CI+Contract เขียวทั้งคู่ ·
   commit ปิดเซสชั่นนี้ = inventory (คำตอบท่าน) + เอกสารฉบับนี้ + AI_WORK_STATE
8. **ลำดับอ่านของเซสชั่นหน้า:** `AI_WORK_STATE.md` → status report §A → ข้อ 1-5 ข้างบน