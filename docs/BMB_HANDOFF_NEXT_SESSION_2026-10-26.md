# BMB — HANDOFF: แชทถัดไป (2026-10-26 · งานที่สั่งใหม่ทั้งหมด)

> **ทำไมมีไฟล์นี้:** Owner สั่งปิดท้ายรอบ 2026-10-26 ว่า "ไม่ต้องรื้อระบบ · อัพเดทเอกสารให้มีสถานะปัจจุบัน
> ชุดเดียวก่อน (รวมงานที่ตอบและสั่งใหม่) **แล้วค่อยแฮนด์ออฟงานทั้งหมดไปทำแชทหน้า**" → ไฟล์นี้คืองานทั้งหมดนั้น
>
> **ลำดับการอ่านตอนเข้าแชทใหม่:** `AI_ENTRYPOINT.md` → `AI_WORK_STATE.md` → `docs/BMB_MASTER_STATUS.md`
> (§3 backlog · §3.1 งานสั่งใหม่ · **§9.0 CI canonical**) → **ไฟล์นี้** → `docs/BMB_PRODUCTION_TEST_PACK.md` (§0/§L)

## กติกาของรอบนี้ (ห้ามละเมิด)

1. **ห้ามรื้อระบบ** — แก้เป็นจุด ๆ ตามที่ Owner สั่งเท่านั้น (โดยเฉพาะ UI: ปรับเฉพาะส่วนที่ระบุ)
2. **เอกสารชุดเดียว:** `BMB_MASTER_STATUS.md` = canonical · `AI_WORK_STATE.md` = บันทึกสั้น · ถ้าขัดกันให้ถือ master + โค้ดจริง
3. **ห้ามพูดว่า "เหลือ Owner อย่างเดียว"** จนกว่าจะปิด W-1 (schema parity) และ W-2 (B-2) — Owner ย้ำรอบนี้
4. **Test pack ต้องตรงความจริง:** ห้ามสั่งตรวจสิ่งที่ยังไม่สำเร็จว่าต้องผ่าน (ปรับ §L ทุกครั้งที่ปิดงานได้)
5. Gates เหมือนเดิม: tsc/eslint/vitest/build ต้องเขียว + push + ตรวจ CI จริงผ่าน GitHub Actions API (ไม่มี `gh`)
6. ห้ามแตะ production (migration/apply/deploy/เขียนข้อมูล) โดยไม่มีคำสั่ง/การอนุมัติใหม่

---

## W-1 · fresh replay เทียบ production — **APPROVED (Owner 2026-10-26) ยังไม่รัน**

**สถานะตอนนี้:** `UNVERIFIED` ทั้งใน `BMB_MASTER_STATUS.md` §4/§5 — ถ้ารันผ่าน = ปิดช่องนี้และค่อยพูดเรื่อง "เหลือ Owner"

**วิธี (ตามหลักฐานรอบก่อน):**
1. Container PostgreSQL สะอาด → apply `supabase/migrations/001` ถึง `156` ตามลำดับ (prelude stubs แบบ
   `e2e/ci/00_prelude_supabase_stubs.sql` + preprocessor เดียวกับ `contract-tests.yml` §migrations step)
2. เก็บผลเป็นไฟล์ durable ใน `e2e/` (แบบ `r16Apply156-*.json`) — **ห้ามอ้างผลในหัว**
3. เทียบ schema (ตาราง/คอลัมน์/index/policy/ACL/RLS + ledger version) กับ production แบบ **read-only**
   (ตัวอย่างเครื่องมือที่มีอยู่: `scripts/dbBackup.mjs` / `dbRestoreDrill.mjs` · ห้ามสุ่มสี่สุ่มห้า query production)
4. PASS = ไม่มี drift โดยไม่อธิบาย / drift ทุกจุดต้องมีคำอธิบาย + แผน · FAIL/ยังไม่รัน = คง `UNVERIFIED`

**เกณฑ์ปิด W-1:** `BMB_MASTER_STATUS.md` §4 + §5 เปลี่ยนเป็น **VERIFIED (มี evidence path + วันที่)**

---

## W-2 · Legacy SQL contracts 7 ไฟล์ (B-2) — **สั่งใหม่: "ปิดด้วย"**

**ประวัติ (ห้ามทำซ้ำแบบไม่รู้):**
- ความพยายามที่ 1 = เพิ่ม step ใน `contract-tests.yml` → **Contract Tests #147 failure ครบทั้ง 7 ไฟล์**
  (annotations ของ run `40266375919` · ดู `BMB_MASTER_STATUS.md` §3 ตาราง B-2)
- ความพยายามที่ 2 = ซ่อมตามหลักฐาน + รัน replay ท้องถิ่น 2 รอบ → **เขียวแค่ 1/7 (029)** → rollback หมด
- ตอนนี้ step ถูกถอดออกจาก workflow (มี comment กันเพิ่มกลับมั่ว ๆ) — **B-2 ยังไม่ปิด**

**ปัญหาที่ทราบครบทุกไฟล์ (ใช้เป็น checklist):**

| ไฟล์ | error จริง | แนวทางที่พอจะไปต่อ |
|---|---|---|
| 017_018 | syntax `%` (declaration `v_has fn%TYPE` ตายแล้ว) → หลังแก้เจอ `ERR_SCHEDULED_DATE_INVALID` | ลบ declaration ทิ้ง + เลือก round เป็นอนาคต (>= นัดถัดไป) |
| 019 | `to_regprocedure` drift (`create_production_batch(text,date,text)`) → ต่อมา `ERR_FORBIDDEN` | signature ปัจจุบัน + fixture ต้องมีสิทธิ์ admin |
| 020 | signature drift (`compute_delivery_fee(_rpc)` +`p_branch_id`, `driver_login(text)`) → `SELF_DELIVERY_EXCEEDS_5KM_LIMIT 211.98km` | signature + แก้พิกัด fixture dropoff |
| 021 | ต้อง JWT context (`ERR_NOT_AUTHENTICATED`) → ต่อมา FK `ai_customer_memory_user_id` | ตั้ง claims แบบ `contracts_033` + ต้องมี user จริงใน fixture |
| 022 | signature (`submit_content_for_approval` 5 args) → FK `content_approvals_created_by` | เช่นเดียวกัน 021 |
| 029 | **เขียวแล้วหลังแก้** (รับ `ERR_PRE_ORDER_REQUIRES_MENU` ของ 142) | เก็บแนวทางนี้ไว้เป็นตัวอย่าง |
| 033 | anon read set ขยาย (8 ตารางใหม่จาก feature ที่อนุมัติ) → `G4 service_role missing 4` | ปรับ expected set ทั้ง G1b และ G4 ตาม grants จริง |

**Loops ตรวจสอบ (ใช้ซ้ำได้):**
- container เดิม `bmb_pg140` (db `replay`, user/pass `postgres/postgres`) รันแบบ ROLLBACK:
  `Get-Content <file> -Raw | docker exec -i bmb_pg140 psql -U postgres -d replay -v ON_ERROR_STOP=1 -f -`
- **เงื่อนไขก่อนเพิ่มกลับ CI: ทั้ง 7 ไฟล์ต้อง EXIT=0 ใน loop นี้ก่อน** — ห้าม push แล้วภาวนา

**เกณฑ์ปิด W-2:** step ใน `contract-tests.yml` กลับมา + Contract Tests success ที่มีบรรทัดยืนยัน 7/7 ·
`BMB_MASTER_STATUS.md` §3 B-2 = CLOSED (มี URL run)

---

## W-3 · CAP-22 ให้ "พร้อม" ก่อนทดสอบระบบจริง

- โค้ดพร้อมแล้ว (`src/lib/marketingAutoSchedule.ts` + ปุ่มในแท็บ 📅) · **ขาด = `marketing_rules` ยังไม่ถูกกำหนด**
- Owner: "AI เลือกเวลาจัดตารางการตลาดจะกำหนดให้พร้อมก่อนทดสอบระบบจริง"
- ทำ: ตั้งค่าในแท็บ ⚙️ กติกา (หน้าต่างเผยแพร่ HH:MM–HH:MM · cooldown ชม. · จำนวนโพสต์/สัปดาห์)
  ให้ตรงนโยบายร้าน → ค่อยปลด lock ขั้น **C7/C8** ใน test pack
- ห้ามแตะ: การอนุมัติโพสต์ (คนเสมอ) · worker `marketing_publish` (ตัวเดิม) · ห้ามสร้าง publish path ใหม่

## W-4 · UI ฝั่งลูกค้า 9 ข้อ (งานหลักของแชทถัดไป)

**รายการเต็มแบบถอดตรง = `docs/BMB_MASTER_STATUS.md` §3.1 (N-4) ข้อ 1–9 · เกณฑ์ตรวจ = `BMB_PRODUCTION_TEST_PACK.md` §L (L-1..L-9)**
สรุปชื่อ (ไม่ตกข้อ): (1) ป้าย `BITE · AI WAITER STAGE` ห้ามเห็น เริ่ม "เมนูพร้อมขายวันนี้" (2) ป้าย
`(Marketing Testimonials)` ห้ามเห็น (3) จิ้มแล้วเลื่อนไปเป้าหมาย ทุกหน้าเท่ากัน (4) เมนูแท็บบนสุด ครบทุกหัวข้อ
+ ถูกทั้งวันนี้/จองล่วงหน้า (5) โหวตเมนู ไทยถูก + ครบทุกเมนู (6) แถบสถานะ ~11:00 = เซมเดย์ยังสั่งได้ +
พรีออเดอร์รอบถัดไป (วันที่ 27) (7) หัวข้อแท็บ = ลิงก์จริง + ชื่อตามแอดมิน + ลำดับตายตัว (แนวตั้ง section 1–2 =
theater + เมนูแนะนำ) + ฟุตเตอร์ลำดับเดียวกันและลิงก์จริง (8) พรีออเดอร์ยังไม่ถึง/เลยรอบ = สีเทากดไม่ได้
(9) เฟรม 1:1 ทั้งเว็บ + เฟรมโปรโมชั่นเท่ากัน

**วิธีทำงาน:** แก้ทีละข้อตามไฟล์จริง (home/menu/footer/nav/vote) · ห้ามรื้อระบบ · ทุกข้อต้องมี test
(unit/source-contract ตามแบบ repo) · gates เขียว + push + CI ก่อนปิดข้อ · แล้วย้ายข้อออกจาก §L

## W-5 · ตรวจเอกสารชุดนี้ซ้ำ (ปิดงานที่ทำไว้รอบ 2026-10-26)

- `BMB_MASTER_STATUS.md`: §9.0 ต้องตรงกับ Actions จริงทุกแถว · §3/§3.1/§4/§5 ห้ามมีคำว่า Owner-only
- `AI_WORK_STATE.md`: §3/§4 ห้ามขัดกับ master
- `BMB_PRODUCTION_TEST_PACK.md`: §0/§L ต้องตรงกับสิ่งที่แก้จริง — **ปิดข้อไหนใน W-1..W-4 ก็ย้ายออกจาก §L ทันที**
- ถ้ามีเอกสารอื่นอ้าง "acceptance ผ่านแล้ว" โดยไม่มี evidence = DOC DRIFT → แก้เอกสาร (ไม่ต้องรื้อระบบ)

## Definition of Done ของแชทถัดไป

1. W-1 + W-2 ปิด (มี evidence) → **เท่านั้น** ที่จะพูดได้ว่า "เหลืองาน Owner"
2. W-4 ปิดครบ 9 ข้อ → §L เหลือแค่ L-10..L-12 ที่ปิดตาม W-1..W-3
3. Test pack ถูกรันโดย Owner ตามขั้นที่ปลด lock แล้ว (B/E/I ต้องผ่านด้วยตา Owner)
4. ทุกรอบ push มี CI + Contract Tests success จาก GitHub Actions API (ไม่ใช่ความจำ)

> ไฟล์นี้ถูกแทนที่เมื่อสถานะเปลี่ยน — ย้ายรายการที่ปิดแล้วออก แล้วเพิ่มคำสั่งใหม่ของ Owner ลงไป (ห้ามเก่าทับใหม่จนมั่ว)