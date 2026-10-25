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
---

## 7. 🔴 SESSION CLOSE รอบ G&R STAGE 1 (2026-10-25 · ต่อจาก §6)

### 7.1 ปิดแล้วในรอบนี้ (หลักฐาน)
- ✅ **G&R STAGE 1 (Promotions) = IMPLEMENTED + CI GREEN** — commits `c809f00` (feature) → `48f62f2` (contract fix percent=0)
  → `404585e` (docs) · Contract Tests #129/#130 ✓ · CI #556 ✓ · Cloudflare deploy ✓ · local gates ทั้งหมดเขียว
  (evidence = `e2e/g153-gates-evidence.txt` · tsc 0 · lint OK · vitest 141/1446 0 fail · build PWA 141 ·
   replay 001–153 MIGRATIONS_OK · regression contracts 18/18 · contract 153 G1–G8)
- ✅ **PRODUCTION APPLY 153 = เสร็จ + RECORD แล้ว** (Owner อนุมัติ "อนุมัติ migration apply 153")
  — staged `e2e/r13Apply153.cjs` = precheck 9/9 → apply+idempotent-rerun 201 → verify 11/11 →
  contract153 บนโปรดักชั่น PASS (ROLLBACK = zero persisted data) → contractRegr 148 PASS → record (**top = 153**)
  — evidence = `e2e/r13Apply153-{precheck,apply153,verify153,contract153,contractRegr,record}.json`
- ✅ **STAGE 2 (Referral) = อนุมัติแล้ว** — Owner: "อนุมัติตามนายแนะนำ" + ยืนยันรายการทดสอบ OTP ผ่านแล้ว
  → งานแรกของแชทหน้า = ลงมือ Stage 2 ตามแนวทาง inspect-first **ไม่ต้องถามซ้ำ**

### 7.2 งานที่เหลือทั้งหมด — ทำในเซสชันหน้า (เรียงลำดับ · ข้ามขั้นไม่ได้)
| # | งาน | วิธี/หมายเหตุ | ต้อง Owner? |
|---|---|---|---|
| 1 | **STAGE 2 · Referral (เริ่มตรงนี้)** ✅ **ปิดแล้ว → ดู §8.1** | inspect auth/guest/OTP จริง (Owner ยืนยัน OTP tests ผ่านแล้ว) → unique identity → 3 ระดับ self-referral (Hard block/Review/Soft signal) → รางวัลเมื่อออเดอร์ผ่านสถานะ → cancel/refund ปรับตาม ledger → attribution ย้อนหลัง · ทำเหมือน Stage 1: migration + contract + CI step + client mirror + admin UI + tests + gates ทั้งหมดเขียว | ไม่ |
| 2 | **STAGE 3 · Loyalty Tiers** | ข้อ ①/②: ตรวจสอบระบบบันทึกยอดสุทธิเดิมก่อน (ยังไม่สร้างระบบใหม่ทันที) | ไม่ |
| 3 | **STAGE 4 · Engagement & Play** | ④ Spin&Win (มีรางวัล/แต้ม) · ⑤ Affiliate (แต้ม/คูปอง ไม่มีเงินสด) · ⑦ Rewards catalog = ย้าย hardcode → ตาราง admin ตั้งเอง | ไม่ |
| 4 | production apply ของ migration ใหม่ (154+) | staged แบบ `r13Apply153` (precheck→apply→verify→contract→record) — **รอคำสั่ง apply แยก** เหมือน 153 | **ใช่** |
| 5 | งานรอท่าน (เดิมจาก §6.2 ข้อ 1–4) | ตรวจ §D ของ status report · D6 ลบทดสอบ pages.dev · R-16 พิมพ์จริง · acceptance §4 | **ใช่** |

### 7.3 ลำดับอ่านของเซสชันหน้า
`AI_WORK_STATE.md` → handoff ฉบับนี้ §7 → inventory §6 → แล้วลงมือ **Stage 2 (Referral)**

---

## 8. 🔴 SESSION CLOSE รอบ G&R STAGE 2 (2026-10-25 · ต่อจาก §7)

### 8.1 ปิดแล้วในรอบนี้ (หลักฐาน)
- ✅ **G&R STAGE 2 (Referral) = IMPLEMENTED + LOCAL GATES ALL GREEN**
  - **inspect-first ก่อนเขียน** (ไม่เดา): auth = OTP quick_login/guest_checkout → `customers`
    (id=uid · phone · guest = phone-keyed) → identity = uid เป็นหลัก + เบอร์ OTP เป็นหลักฐาน
  - **SQL `supabase/migrations/154_referral_program.sql`**: `customers.referral_code/referred_by` ·
    `referral_attributions` + ledger `referral_rewards` (RLS deny-all + definer) · `referral_policy`
    (฿30/฿30 · qualify=delivered · อายุคูปอง 30 วัน · cap 20/เดือน · หน้าต่าง 72 ชม. · share_base_url —
    แอดมินปรับเองได้ทั้งหมด) · RPC `referral_my_code/preview/claim/issue/reverse/my_status/admin_stats/resolve` ·
    trigger `trg_referral_order_status` (ผ่านสถานะ → ออกคูปอง `promotions` 2 ใบ + ledger + notice ·
    ยกเลิก/คืนเงิน → ปรับกลับตาม ledger ไม่หักซ้ำ · ยกเลิกก่อนออก = void) ·
    **ไม่แตะ signature `create_order_with_items`/_i/pickup** (คง overload pin 124/127 — attribution ผ่าน
    `referral_claim` แยก ที่ client เรียกทันทีหลัง order สร้าง)
  - **Contract `e2e/contracts_154_referral_program.sql` G1–G9 PASS (ROLLBACK)** + **CI step แล้ว**
  - **Client**: `referralClient.ts` (mirror + ข้อความไทยครบทุก reason) · `ReferralBox` ที่ Checkout
    (apply/revalidate gate แบบ coupon) · `?ref=` deep-link ใน Layout · `cartStore.referralCode` +
    cartPersistence (optional — cart เก่าไม่พัง) · Checkout claim ทันทีหลัง order ·
    **SharePage เลิกของปลอม** (โค้ดจริง + ลิงก์ base แอดมิน + ledger จริง + ไม่แกล้งให้แต้ม) ·
    ProfilePage โชว์รางวัลจริง (Owner: "เก็บไว้ในโปรไฟล์")
  - **Admin**: `ReferralSettingsPanel` ใน AI Marketing Center แท็บ Rules (policy + สถิติจริง +
    ปุ่มอนุมัติ/ปฏิเสธ รายการพักรางวัล) — ยืนบนศูนย์กลางเดิมตาม §3
  - **เทสต์**: `referralProgram.test.ts` 34 ข้อ — **หลักฐานรวม = `e2e/g154-gates-evidence.txt`**
    (tsc 0 · vitest **142 files/1480 tests 0 fail** · lint OK 428 ไฟล์ · build PWA 141 ·
     Docker replay **001–154 = MIGRATIONS_OK** + ALL_GREEN · **contracts 20/20** รวม 154 G1–G9)
- ⛔ **ยังไม่ apply 154 ลง production** — ตามกติกา = **รอคำสั่ง "apply 154" แยก** เหมือน 153 ( staged `r13` )

### 8.2 งานที่เหลือทั้งหมด — เรียงลำดับ (ข้ามขั้นไม่ได้)
| # | งาน | วิธี/หมายเหตุ | ต้อง Owner? |
|---|---|---|---|
| 0 | ~~production apply migration 154~~ ✅ **ทำแล้ว → ดู §9.1** | staged แบบ `e2e/r13Apply153.cjs` — **ทำเสร็จแล้ว (record=154)** | **ใช่ → เสร็จ** |
| 1 | **STAGE 3 · Loyalty Tiers** | ข้อ ② ก่อน: **inspect ระบบบันทึกยอดสุทธิเดิม** (ยังไม่สร้างใหม่ทันที) → 4 ระดับ Member/Silver(1,500)/Gold(4,000)/Platinum(8,000) rolling 12 เดือน (§5.2) → points ledger+audit → ทำเหมือน Stage 1 (migration + contract + CI + client + admin + tests + gates) | ไม่ |
| 2 | **STAGE 4 · Engagement & Play** | ④ Spin&Win (มีรางวัล/แต้ม) · ⑤ Affiliate (แต้ม/คูปอง ไม่มีเงินสด) · ⑦ Rewards catalog = ย้าย hardcode → ตาราง admin | ไม่ |
| 3 | งานรอท่าน (เดิมจาก §6.2 ข้อ 1–4) | ตรวจ §D ของ status report · D6 ลบทดสอบ pages.dev · R-16 พิมพ์จริง · acceptance §4 | **ใช่** |

### 8.3 ลำดับอ่านของเซสชันหน้า
`AI_WORK_STATE.md` → handoff ฉบับนี้ **§8** → inventory **§6 (Stage 2 entry)** → evidence
`e2e/g154-gates-evidence.txt` → แล้วลงมือ **Stage 3 (Loyalty)** (เริ่มจาก inspect ระบบยอดสุทธิเดิม —
**ถ้าท่านยังไม่สั่ง apply 154 ก็ทำ Stage 3 code ต่อได้** เพราะ 154 ยังไม่กระทบ production)

---

## 9. 🔴 SESSION CLOSE รอบ PRODUCTION APPLY 154 (2026-10-25 · ปิดท้าย §8)

### 9.1 PRODUCTION APPLY 154 = เสร็จสมบูรณ์ ✅ (ตามคำสั่งท่าน "apply 154")
ทำแบบ **staged เหมือน r13Apply153/r8Apply148 เป๊ะ** — สคริปต์ใหม่ `e2e/r14Apply154.cjs`
(Management API · token จาก `.env.local` · project `ivkdfognyiwjcmrhcnwz`):

| Stage | ผล | หลักฐาน |
|---|---|---|
| **precheck** | **12/12** — history top=153 (154 ยังไม่มี) · backup ใหม่ 8 · customers cols/2 ตาราง/policy row/fns 13/trigger = ยังไม่มีทุกตัว · order-fn ไม่มี 'referral' + shape 148 · fixture phones clash=0 · customers=5 แถว | `r14Apply154-precheck.json` |
| **apply154** | 201 + **idempotent-rerun 201** → STAGE_OK | `-apply154.json` |
| **verify154** | **13/13** — คอลัมน์ 2 · 2 ตาราง RLS=true + policies 0 · policy seed 9 keys (฿30/฿30·delivered·30วัน·cap20·72ชม.) · fns 13 · trigger ติดบน orders · normalizers ตรง · anon ถูกกัน (my_code/claim/stats=deny · preview=allow) · backfill ครบ 0 · promotions 2/orders 4 ไม่แตะ | `-verify154.json` |
| **contract154** | 201 ไม่มี ERROR → DO ถึง `CONTRACT 154: PASS` = **G1–G9 PASS · ROLLBACK zero persisted data** | `-contract154.json` |
| **contractRegr** | contracts_153 + contracts_148 = 201 ไม่มี ERROR ✓ | `-contractRegr.json` |
| **record** | **history top = 154** (`154_referral_program`) ✓ | `-record.json` |

⇒ **migration 154 = APPLIED + RECORDED บน production เรียบร้อย** · ไม่มีการเขียนข้อมูลธุรกิจใด ๆ
(contract ทั้งหมด ROLLBACK · verify อ่านอย่างเดียว) · สรุปยาว = `e2e/g154-gates-evidence.txt` ท้ายไฟล์

### 9.2 งานที่เหลือทั้งหมด — เรียงลำดับให้เซสชันหน้า (ข้ามขั้นไม่ได้)
| # | งาน | วิธี/หมายเหตุ | ต้อง Owner? |
|---|---|---|---|
| 1 | **STAGE 3 · Loyalty Tiers (เริ่มตรงนี้)** | **inspect-first:** ตรวจระบบบันทึกยอดสุทธิเดิมจริงก่อน (ยังไม่สร้างระบบใหม่ทันที — §5.2) → points ledger append-only + idempotency + refund reversal + audit (แบบแผน audit_logs/124) → 4 ระดับ Member/Silver(≥1,500)/Gold(≥4,000)/Platinum(≥8,000) rolling 12 เดือน · เกณฑ์ = ยอดสุทธิไม่รวมค่าส่ง · คืนเงินปรับตามต้นทาง · ทำเหมือน Stage 1/2: migration + contract + CI step + client mirror + admin + tests + gates | ไม่ |
| 2 | **STAGE 4 · Engagement & Play** | ④ Spin&Win (ของเดิมสุ่มเมนู → เพิ่มรางวัล/แต้ม) · ⑤ Affiliate (แต้ม/คูปอง ไม่มีเงินสด) · ⑦ Rewards catalog = ย้าย hardcode `RewardsPage` → ตาราง admin ตั้งเอง · มีเพดานความถี่/ต้นทุน/กันกิจกรรมซ้ำ | ไม่ |
| 3 | migration ใหม่ 155+ | staged แบบ `r14Apply154` (precheck→apply→verify→contract→record) — **รอคำสั่ง apply แยก** เหมือน 153/154 | **ใช่** |
| 4 | งานรอท่าน (เดิมจาก §6.2 ข้อ 1–4) | ตรวจ §D ของ status report · D6 ลบทดสอบ `bitemebaby-5f7.pages.dev` · R-16 พิมพ์จริง · acceptance §4 | **ใช่** |

### 9.3 ลำดับอ่านของเซสชันหน้า
`AI_WORK_STATE.md` → handoff ฉบับนี้ **§9** (ข้าม §8 ที่ปิดแล้ว) → inventory **§6** →
evidence `e2e/g154-gates-evidence.txt` + `e2e/r14Apply154-*.json` → **แล้วลงมือ STAGE 3 (Loyalty)**
ด้วยแนวทาง inspect-first → ออกแบบ → ทำเหมือน Stage 1/2 (ไม่ต้องถามซ้ำเรื่องแนวทาง · ห้ามเดา · ห้ามข้ามขั้น)

---

## 10. 🔴 SESSION CLOSE รอบ STAGE 3 · LOYALTY (2026-10-25 · ปิดท้าย §9)

### 10.1 STAGE 3 (Loyalty Tiers + Points Ledger) = DELIVERED ทุกชิ้น ✅ (ยังไม่ apply — รอคำสั่ง)
ทำตาม §9.2 ข้อ 1 เป๊ะ: **inspect-first → ออกแบบ → ทำเหมือน Stage 1/2**

- **inspect-first (§5.2 บังคับ — ยืนยันก่อนสร้าง):** `customers.loyalty_points` (001:130) +
  ตาราง `loyalty_points` (001:261+RLS 006) = **ไม่มีโค้ดเซิร์ฟเวอร์แตะเลย** ·
  `aiMemory.total_spent` = client-only · `daily_sales.net_sales` = ต่อวัน ไม่ใช่ต่อลูกค้า
  → ยังไม่มีระบบสะสมยอดสุทธิลูกค้าที่เชื่อถือได้ = ช่องว่างจริง → สร้างใหม่แบบ server-authoritative
- **SQL `supabase/migrations/155_loyalty_tiers_points.sql`:** `points_ledger` **append-only**
  (trigger `ERR_LEDGER_APPEND_ONLY` + revoke ทุกบทบาท · PK deterministic + unique partial index)
  · **delta-reversal** ตอนคืนเงิน/ยกเลิก (partial หักตาม `refunded_total_minor` สัดส่วน · ไม่หักซ้ำ) ·
  audit_logs + notice ทุกครั้ง · `loyalty_policy` (4 ระดับ **1,500/4,000/8,000** · rolling 12 เดือน ·
  **อัตราแต้ม seed = ปิด/0** — requirements ห้ามเดา · earn ที่ `delivered`) ·
  `loyalty_order_net` = subtotal − ส่วนลด − คืนเงิน (**ไม่รวมค่าส่ง** · ยกเลิก/คืนเงินเต็ม = 0) ·
  trigger บน `orders` + `payment_intents` → `loyalty_sync_order` จุดเดียว (idempotent) ·
  RPC `loyalty_my_status/my_history/admin_stats/admin_adjust` · **ไม่แตะ signature order**
- **Contract `e2e/contracts_155_loyalty_tiers.sql` G1–G9 PASS** (ROLLBACK rc=0) + **CI step แล้ว**
  + contractRegr 154/153 PASS · บทเรียนแก้ 3 จุด: G7 (state machine ไม่ให้ delivered→cancelled →
  ทดสอบ earn ที่ confirmed ตาม earn_qualify_status จริง) · G9 (bug แคสต์ text/boolean) ·
  ท้ายไฟล์มี `END;`/`$$;` ตกค้าง (`END;` = SQL COMMIT synonym)
- **Client:** `src/lib/loyaltyClient.ts` (mirror ครบ + DEFAULT = seed เป๊ะ) ·
  **RewardsPage ข้อมูลจริง** (tier+progress+แต้ม+ประวัติจาก ledger · catalog = ยัง preview → STAGE 4) ·
  ProfilePage tier+แต้มจริง
- **Admin:** `LoyaltySettingsPanel` ใน AI Marketing Center แท็บ Rules (เกณฑ์/หน้าต่าง/เปิดอัตราแต้ม/
  สถิติ · validate Silver<Gold<Platinum)
- **เทสต์+gates:** `loyaltyTiers.test.ts` 20 ข้อ · tsc 0 · lint+brandNameGuard **430 ไฟล์** ·
  vitest **143 files/1500 tests 0 fail** · build ✓ PWA **142** ·
  Docker replay **001–155 ALL_GREEN** — evidence = **`e2e/g155-gates-evidence.txt`**

### 10.2 งานที่เหลือทั้งหมด (เรียงลำดับ — ข้ามขั้นไม่ได้)
| # | งาน | วิธี/หมายเหตุ | ต้อง Owner? |
|---|---|---|---|
| 1 | **STAGE 4 · Engagement & Play** | ④ Spin&Win (ของเดิมสุ่มเมนู → เพิ่มรางวัล/แต้ม) · ⑤ Affiliate (แต้ม/คูปอง ไม่มีเงินสด) · ⑦ Rewards catalog = ย้าย hardcode `RewardsPage` → ตาราง admin · มีเพดานความถี่/ต้นทุน/กันกิจกรรมซ้ำ — ทำเหมือน Stage 1–3 | ไม่ |
| 2 | **migration 155 = รอคำสั่ง "apply 155"** | staged เหมือน `r14Apply154` (precheck→apply→verify→contract→record = `r15Apply155.cjs`) เขียนตอนสั่ง · ยังไม่ apply รอเหมือน 153/154 | **ใช่** |
| 3 | งานรอท่าน (เดิมจาก §9.2 ข้อ 4) | ตรวจ §D ของ status report · D6 ลบ `bitemebaby-5f7.pages.dev` · R-16 พิมพ์จริง · acceptance §4 | **ใช่** |

### 10.3 ลำดับอ่านของเซสชันหน้า
`AI_WORK_STATE.md` → handoff ฉบับนี้ **§10** (ข้าม §8/§9 ที่ปิดแล้ว) → inventory **§6 (Stage 4 entry)**
→ evidence `e2e/g155-gates-evidence.txt` → แล้วลงมือ **STAGE 4 (Engagement & Play)** ทันที
(ทำเหมือน Stage 1–3 · ไม่ต้องถามซ้ำ · ห้ามเดา · ห้ามข้ามขั้น)

---

## 11. 🔴 SESSION CLOSE รอบ APPLY 155 + STAGE 4 (2026-10-25 · ปิดท้าย §10 · กรอบ G&R ครบทุก stage)

### 11.1 ทำอะไรไปบ้าง (คำสั่ง Owner: "apply 155 และทำสเตจ 4 ต่อ ตามกฏเหมือนเดิม ปิดงานให้ครบหมดตามเป้าหมาย")

**A. PRODUCTION APPLY 155 = ✅ APPLIED + RECORDED (top=155)**
- เขียน `e2e/r15Apply155.cjs` (staged แบบ r14 เป๊ะ) + รันครบ 6 รุ่น:
  precheck **11/11** (top=154 · object ยังไม่มีครบ · fixture ว่าง · order-fn untouched) →
  apply+idempotent-rerun **201/201** → verify **11/11** (RLS deny · seed เป๊ะ · 12 fns ·
  3 triggers · anon ถูกกัน · ไม่มี backfill) → contract155 PASS (ROLLBACK) →
  contractRegr 154/153/148 **PASS ทั้งสาม** → record → history top = **155_loyalty_tiers_points**
- evidence = `e2e/r15Apply155-{precheck,apply155,verify155,contract155,contractRegr,record}.json`

**B. STAGE 4 · Engagement & Play = ✅ DELIVERED ทุกชิ้น** (inspect-first → ออกแบบ → ทำเหมือน 1–3)
- **inspect-first:** Spin&Win เดิมมีของปลอม 2 จุด (RandomMenuPage: addPoints(3)+คูปอง
  `RANDOM-xxx` client-side+toast "+3 แต้ม"/"คูปองลด 15%" · ViralPage: สุ่ม [5..100]+addPoints+
  "5 ครั้ง/วัน" ไม่มี server ตรวจ) · Affiliate = ไม่มีระบบ · catalog = hardcode 4 รายการ
- **SQL `156_engagement_play.sql`:** ④ `spin_status`/`spin_reward` (advisory lock · เพดานรายวัน
  Bangkok · audit · `spin_policy` seed **ปิด/0/1ต่อวัน** = ZERO-GUESS §3.1) ·
  ⑤ `affiliate_codes`/`affiliate_attributions` (RLS deny) + `affiliate_my_code`/`affiliate_claim`
  (hard block self · unique กันซ้ำ · ออเดอร์ตายไม่รับ · ?aff= mirror ?ref=) +
  `affiliate_sync_order`+trigger orders/payment_intents (delta-reversal mirror 155 ·
  **monthly_cap fail-closed** · `affiliate_policy` seed ปิด/0/0 · **ไม่มีช่องเงินสด** §4.1-5) ·
  ⑦ `rewards_catalog` (seed = 4 รายการเดิมเป๊ะ) + `rewards_catalog_list`/`rewards_admin_list/save/remove`
  (is_admin + audit) · ขยาย `points_ledger` entry_type += `spin`(>0)/`affiliate` ·
  **ไม่แตะ signature create_order_with_items**
- **Contract `contracts_156_engagement_play.sql` G1–G9 PASS (rc=0)** + CI step แล้ว ·
  replay **001–156 ALL_GREEN** · regression 155/154/153 PASS (4 contracts rc=0)
- **Client/UI:** `engagementClient.ts` (mirror+validate+ไทยครบ) · RandomMenuPage เลิกของปลอมทั้งหมด ·
  ViralPage ล้อของจริง+ป้ายกิจกรรมบอก "พรีวิว" · RewardsPage catalog จากตาราง (ไม่มี hardcode
  fallback) · Layout `?aff=`→sessionStorage · Checkout เรียก `affiliate_claim` หลังออเดอร์ ·
  ProfilePage การ์ดครีเอเตอร์ · **Admin 3 แผงใน Rules tab:** SpinSettingsPanel ·
  AffiliateSettingsPanel (validate เปิดต้องมี rate+cap) · RewardsCatalogPanel (CRUD+เปิด/ปิด)
- **เทสต์+gates:** `engagementPlay.test.ts` 17 ข้อ · tsc 0 · lint **432 ไฟล์** ·
  vitest **144/1517/0 fail** · build PWA **142** — evidence = **`e2e/g156-gates-evidence.txt`**
- บทเรียนรอบนี้: SQL fn body ของ `LANGUAGE sql` ต้องเป็น `SELECT ...` (ไม่ใช่ expression เปล่า) ·
  G7 assertion ตัวเลขผิดเอง (30×3−30=60) · G6 ใช้เส้นทาง refund แทน cancel (state machine) ·
  vitest ชุดใหญ่ flake ทีละไฟล์ render (empty-render+จำนวนเปลี่ยน) → พิสูจน์เดี่ยว/คู่ผ่าน +
  isolate:true → รันเครื่องว่าง = 144/1517/0

### 11.2 งานที่เหลือทั้งหมด (เรียงลำดับ — ข้ามขั้นไม่ได้)
| # | งาน | วิธี/หมายเหตุ | ต้อง Owner? |
|---|---|---|---|
| 1 | **migration 156 = รอคำสั่ง "apply 156"** | staged แบบ r15 → เขียน `e2e/r16Apply156.cjs` ตอนสั่ง (precheck→apply→verify→contract→record) · production ยัง record=155 | **ใช่** |
| 2 | งานรอท่าน (เดิม) | ตรวจ §D status report · D6 ลบ `bitemebaby-5f7.pages.dev` · R-16 พิมพ์จริง · acceptance §4 | **ใช่** |
| 3 | (เสร็จแล้ว) | 🏁 G&R Rollout ①–⑧ **ครบทั้ง 4 stages** — เหลือ apply 156 + acceptance §4 จึงปิดกรอบได้ | — |

### 11.3 ลำดับอ่านของเซสชันหน้า
`AI_WORK_STATE.md` → handoff ฉบับนี้ **§11** (ข้าม §8–§10 ที่ปิดแล้ว) → inventory **§6** →
evidence `e2e/g156-gates-evidence.txt` + `e2e/r15Apply155-*.json` →
งานต่อ = **รอคำสั่ง "apply 156"** หรืองานที่ท่านสั่งใหม่ (กรอบ G&R ครบทุก stage แล้ว —
ถ้าไม่มีคำสั่งเพิ่ม = แจ้งปิดงานพร้อม acceptance §4)