# BMB — HANDOFF: แชทถัดไป (2026-10-26 · งานที่สั่งใหม่ทั้งหมด)

> **ทำไมมีไฟล์นี้:** Owner สั่งปิดท้ายรอบ 2026-10-26 ว่า "ไม่ต้องรื้อระบบ · อัพเดทเอกสารให้มีสถานะปัจจุบัน
> ชุดเดียวก่อน (รวมงานที่ตอบและสั่งใหม่) **แล้วค่อยแฮนด์ออฟงานทั้งหมดไปทำแชทหน้า**" → ไฟล์นี้คืองานทั้งหมดนั้น
>
> **ลำดับการอ่านตอนเข้าแชทใหม่:** `AI_ENTRYPOINT.md` → `AI_WORK_STATE.md` → `docs/BMB_MASTER_STATUS.md`
> (§3 backlog · §3.1 งานสั่งใหม่ · **§9.0 CI canonical**) → **ไฟล์นี้** → `docs/BMB_PRODUCTION_TEST_PACK.md` (§0/§L)

## กติกาของรอบนี้ (ห้ามละเมิด)

> **สรุปสถานะเมื่อจบรอบ 2026-10-26 (อัปเดตโดยรอบที่ทำงานจริง):**
> **W-1 ปิด** (replay 157/157 · parity รอบสุดท้าย MATCH rls/acl_tables/ledger 158) · **W-2 ปิด** (7/7 + CI #577/#151 success) ·
> **W-3 เสร็จในทางข้อมูล** (`marketing_rules` มีค่าจริง → C7/C8 ปลดล็อก) ·
> **W-4 ปิด 4/9 ข้อ** (1·2·6·9) · **ยังเหลือ 5 ข้อ** (3·4·5·7·8) · **W-5 ทำแล้วรอบนี้** ·
> **B-6 (P0) ปิดแล้ว** — apply 157+158 บน production (Owner อนุมัติ) + guest เปิด `/menu` จริงเห็นเมนูครบ ·
> **งานค้างที่เหลือ = UI 5 ข้อ + legacy functions 6 ตัว (รอ Owner เลือก)**

1. **ห้ามรื้อระบบ** — แก้เป็นจุด ๆ ตามที่ Owner สั่งเท่านั้น (โดยเฉพาะ UI: ปรับเฉพาะส่วนที่ระบุ)
2. **เอกสารชุดเดียว:** `BMB_MASTER_STATUS.md` = canonical · `AI_WORK_STATE.md` = บันทึกสั้น · ถ้าขัดกันให้ถือ master + โค้ดจริง
3. **ห้ามพูดว่า "เหลือ Owner อย่างเดียว"** จนกว่าจะปิด: **B-6 (apply 157 + พิสูจน์ guest เห็นเมนู)** ·
   **UI อีก 5 ข้อ** · **W-1 แผน 3 ข้อ มีคำสั่ง** — Owner ย้ำรอบนี้
4. **Test pack ต้องตรงความจริง:** ห้ามสั่งตรวจสิ่งที่ยังไม่สำเร็จว่าต้องผ่าน (ปรับ §L ทุกครั้งที่ปิดงานได้)
5. Gates เหมือนเดิม: tsc/eslint/vitest/build ต้องเขียว + push + ตรวจ CI จริงผ่าน GitHub Actions API (ไม่มี `gh`)
6. ห้ามแตะ production (migration/apply/deploy/เขียนข้อมูล) โดยไม่มีคำสั่ง/การอนุมัติใหม่

---

## W-1 · fresh replay เทียบ production — **ปิดแล้ว (2026-10-26) ✅**

**ผลจริง:** fresh replay 001→157 = `REPLAY_ALL_GREEN 157/157` · schema parity รันแล้วแบบ read-only →
MATCH (tables/columns/indexes/constraints/sequences/triggers/views/**ledger 156=156**) ·
**DRIFT 5 กลุ่มมีคำอธิบาย+แผนครบ** → `e2e/w1-parity-report-2026-10-26.md` · §4/§5 = **VERIFIED**

**ยังค้าง (ไม่ใช่งาน AI ทำเองได้): แผน 3 ข้อรอ Owner อนุมัติ (production write)**
1. migration เปิด RLS บน `admin_portfolio_items` + `products_branch_overrides` (092/094 ไม่เคยสั่ง ENABLE)
2. align grants 31 ตาราง + EXECUTE ตาม `pg_default_acl` ของ production
3. legacy functions 6 ตัวใน production (ไม่มี src caller) = ปลดออก หรือ คงไว้และบันทึก

---

## W-2 · Legacy SQL contracts 7 ไฟล์ (B-2) — **ปิดแล้ว (2026-10-26) ✅**

**ผลจริง:** ทั้ง 7 ไฟล์ **EXIT=0** บน replay ท้องถิ่น 2 รอบ (รอบ reproduce + รอบ fresh replay 001–157) ·
step **`Legacy contracts 017-033` กลับเข้า `.github/workflows/contract-tests.yml` แล้ว**

**สิ่งที่แก้ (รายละเอียดในไฟล์ contract แต่ละไฟล์ · ผลรัน = `e2e/w2-contracts_*.log`):**

| ไฟล์ | สิ่งที่ทำให้เขียว |
|---|---|
| 017_018 | ลบ `v_has fn%TYPE` · fixture เมนูปฏิทิน + พิกัด/ที่อยู่ (153) · ยอดบิล = subtotal + delivery_fee · ยกเลิกผ่าน `cancel_order` (141 unified) |
| 019 | signature `create_production_batch(text,date,text)` · JWT admin fixture · รอบวันนี้ + order_mode/scheduled_date ตรงกัน |
| 020 | signature `compute_delivery_fee(+branch)` / `driver_login(text)` · fixture rider (drivers ผูก user) + สลับ claims ตามบทบาท · ค่าจัดส่งอิงโซนจริง · POD ก่อน delivered (132) |
| 021 | JWT + user fixture (FK `ai_customer_memory.user_id`) |
| 022 | signature `submit_content_for_approval` 5 args · JWT admin (FK `created_by`) |
| 029 | gate ปัจจุบันของ PRE_ORDER = เมนูรายวัน (141/142) → fixture เมนู "คนละวัน" แล้วรอ `ERR_PRODUCT_NOT_ON_MENU` |
| 033 | expected anon set = grants จริง **16 ตาราง** (050 ปิด anon อ่าน orders) · G4 ยกเว้น `order_submissions` (124 design) · fixture platform-admin · G5d ยืนยัน anon อ่าน orders ต้องถูกปฏิเสธ |

**เกณฑ์ปิด W-2 (ทำครบแล้ว):** เขียว 7/7 ท้องถิ่น **ก่อน** push ✓ · step กลับเข้า CI ✓ ·
ต้องยืนยัน Contract Tests success + บรรทัด `Legacy contracts OK — 7/7` จาก Actions จริง (test pack A2)

---

## W-3 · CAP-22 ให้ "พร้อม" ก่อนทดสอบระบบจริง — **เสร็จในทางข้อมูล (2026-10-26)**

- ตรวจ read-only บน production แล้ว: **`marketing_rules` มีแถว `default` อยู่จริง** (updated 2026-10-22):
  `publishing_window 10:00–19:00` · `cooldown_hours 6` · `frequency_per_week 3` ·
  `content_mix {menu 40, promotion 30, festival 20, brand 10}` → **เงื่อนไข C7/C8 ครบ → ปลดล็อกได้**
- ยังว่าง = `menu_rules` + `stop_conditions` (ทางเลือก ไม่ใช่ blocker — ดู test pack §L L-12)
- ห้ามแตะ: การอนุมัติโพสต์ (คนเสมอ) · worker `marketing_publish` (ตัวเดิม) · ห้ามสร้าง publish path ใหม่

## W-4 · UI ฝั่งลูกค้า 9 ข้อ — **ปิดแล้ว 4 ข้อ · ยังเหลือ 5 ข้อ**

**ปิดแล้ว (มี test กำกับ):**

| ข้อ | สิ่งที่แก้ | test |
|---|---|---|
| 1 | `theaterEditorial` kicker = `"เมนูพร้อมขายวันนี้"` + **guard บังคับค่าเก่า `"BITE · AI WAITER STAGE"`** ให้ fallback (ถ้า admin เคยตั้งไว้ก็ไม่แสดง) | `uiTechnicalLabels.test.ts` |
| 2 | `ReviewCarouselSection` + `ReviewPage` — ลบป้ายอังกฤษเชิงการตลาด → `"เสียงชมจากผู้ชม"` | `uiTechnicalLabels.test.ts` |
| 6 | `homeProviders.getStoreStatusFromRounds` — ไม่เอารอบที่หมดหน้าต่างมาโชว์ · บอก `เซมเดย์ยังสั่งได้ + รอบถัดไป HH:MM–HH:MM` · ไม่โชว์ capacity ของรอบผิด · preOrderLine ชี้รอบถัดไป | `storeStatusWindow.test.ts` (4/4) |
| 9 | **`src/styles/frameCanonical.css`** (import หลัง `index.css`) — เฟรมเมนู/การ์ดทุกใบ = `aspect-ratio: 1/1` + เฟรมโปรโมชั่นเท่ากัน | ตรวจใน `frameCanonical.css` + คู่ test ที่อ้าง main.tsx |

**ยังเหลือ 5 ข้อ (ทำต่อในแชทถัดไป — รายละเอียดเต็ม = `BMB_MASTER_STATUS.md` §3.1 N-4 · เกณฑ์ = test pack §L):**
(3) จิ้มแล้วเลื่อนไปเป้าหมายให้เหมือนกันทุกหน้า · (4) หัวข้อแท็บบนสุดครบ + เมนูวันนี้/จองล่วงหน้า ถูก ·
(5) หน้าโหวตเมนู ไทยถูก + ครบทุกเมนู · (7) ลำดับ+ลิงก์หัวข้อ/ฟุตเตอร์ ตามลำดับที่กำหนด ·
(8) พรีออเดอร์ยังไม่ถึง/เลยรอบ = สีเทา กดไม่ได้ **ทุกจุด**

**วิธีทำงาน:** แก้ทีละข้อตามไฟล์จริง (home/menu/footer/nav/vote) · ห้ามรื้อระบบ · ทุกข้อต้องมี test
(unit/source-contract ตามแบบ repo) · gates เขียว + push + CI ก่อนปิดข้อ · แล้วย้ายข้อออกจาก §L

## ⛔ B-6 (P0) · guest อ่านเมนูบน production ไม่ได้ — **ปิดแล้ว ✅ (apply 157+158 · Owner อนุมัติ 2026-10-26)**

**หลักฐาน (ตรวจจริง 2026-10-26 · read-only ทั้งหมด):**
- PostgREST ตรง ๆ ด้วย anon key = **401 `{"code":"42501","message":"permission denied for function is_staff"}`**
  ทั้ง `products` · `delivery_rounds` · `menu_sections` · `business_settings`
- เปิด `https://biteme-baby.com/menu` จริงด้วย Playwright (guest ไม่ล็อกอิน) = **"ไม่พบเมนู" + console error 401 ทุก endpoint**
  → evidence: `e2e/w2_guest_menu_probe.cjs` + `e2e/w2prod_anon.cjs`

**ต้นตอ:** migration **129** ทำ 2 อย่างพร้อมกัน — (a) `REVOKE ... is_staff() FROM PUBLIC, anon`
(b) `CREATE POLICY *_staff_select ... USING (is_staff())` **โดยไม่ระบุ `TO role`** → policy มีบทบาท PUBLIC
→ PostgreSQL ต้องประเมิน `is_staff()` ตอน guest อ่าน → ไม่มีสิทธิ์ EXECUTE → ทั้ง statement ล้ม (ไม่ใช่แค่กรองแถว)

**แก้แล้ว:** `supabase/migrations/157_anon_policy_role_scoping.sql` — ตัด anon/public ออกจาก policy ที่เรียก
helper `is_*()` (20 policy · fail-closed self-check ในไฟล์) + แยก `reviews_anon_read` (anon อ่านเฉพาะแถว verified)
**ผลบน replay:** anon อ่านครบ 16 ตาราง · **zero write leak** (`e2e/w2_b6_verify.sql`)

**ผลหลัง apply (ตรวจจริง):** `anon-visible helper policies 19→0` · `reviews_anon_read` อยู่ · RLS 2 ตาราง = true ·
anon write leak = 0 · ledger top = **158** (`e2e/w6Apply157158-*.json`) → **PostgREST ทุก endpoint = 200** ·
**Playwright เปิด `/menu` จริง = เห็นเมนูครบ + ไม่มี console error** (`e2e/w2_guest_menu_probe.cjs` รอบหลัง apply)
→ **ยังค้างหลังปิด B-6 = UI 5 ข้อ + legacy functions 6 ตัว (รอ Owner เลือก)**

## W-5 · ตรวจเอกสารชุดนี้ซ้ำ — **ทำแล้วรอบนี้ (ต้องทำซ้ำทุกครั้งที่ปิดงาน)**

- `BMB_MASTER_STATUS.md`: §9.0 ต้องตรงกับ Actions จริงทุกแถว · §3/§3.1/§4/§5 ห้ามมีคำว่า Owner-only ✓ (รอบนี้)
- `AI_WORK_STATE.md`: §3/§4 ห้ามขัดกับ master ✓ (รอบนี้)
- `BMB_PRODUCTION_TEST_PACK.md`: §0/§L ตรงกับสิ่งที่แก้จริง — **ปิดข้อไหนใน W-1..W-4 ก็ย้ายออกจาก §L ทันที** ✓
- ถ้ามีเอกสารอื่นอ้าง "acceptance ผ่านแล้ว" โดยไม่มี evidence = DOC DRIFT → แก้เอกสาร (ไม่ต้องรื้อระบบ)

## Definition of Done ของแชทถัดไป

1. ~~**B-6 ปิด**~~ **ทำแล้ว ✅** = apply 157+158 + พิสูจน์ guest เปิด `/menu` เห็นเมนูจริง (มี evidence)
2. W-1 แผน เหลือ 1 ข้อ: legacy functions 6 ตัว มีคำสั่ง Owner (ปลด/คง) — ข้ออื่นปิดแล้ว (158)
3. W-4 ปิดครบ 9 ข้อ (ตอนนี้ 4/9) → §L เหลือเฉพาะ L-10/L-12
4. Test pack ถูกรันโดย Owner ตามขั้นที่ปลด lock แล้ว (B/E/I ต้องผ่านด้วยตา Owner)
5. ทุกรอบ push มี CI + Contract Tests success จาก GitHub Actions API (ไม่ใช่ความจำ)
   · Contract Tests ต้องมีบรรทัด `Legacy contracts OK — 7/7`
6. **ห้ามพูดว่า "เหลืองาน Owner"** จนกว่าข้อ 1–3 ข้างบนจะครบ (Owner ย้ำ 2026-10-26)

> ไฟล์นี้ถูกแทนที่เมื่อสถานะเปลี่ยน — ย้ายรายการที่ปิดแล้วออก แล้วเพิ่มคำสั่งใหม่ของ Owner ลงไป (ห้ามเก่าทับใหม่จนมั่ว)