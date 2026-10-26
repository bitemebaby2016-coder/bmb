# Bite Me Baby — AI Work State (บันทึกสถานะสำหรับแชทถัดไป)

> **ไฟล์นี้ = บันทึกสั้นของเซสชันล่าสุดเท่านั้น**
> เอกสารสถานะหลัก (canonical current state / capability matrix / backlog / evidence) =
> **`docs/BMB_MASTER_STATUS.md`** — ถ้าขัดกันให้ถือไฟล์นั้น + โค้ดจริงเสมอ (DOC DRIFT)
> กติกาคงเดิม: No evidence = not done · SKIPPED ≠ PASS · ห้ามมี task `NOT_STARTED`/`IN_PROGRESS`
> ค้างโดยไม่มีหลักฐาน · ห้ามใช้รายงานเก่าใน `docs/` (ที่มีวันที่) มาสั่งงานซ้ำแทนไฟล์สถานะหลัก

**last_updated:** 2026-10-26 · **session:** whole-repo reconciliation + code closure (Owner directive 2026-10-26)

---

## 1. HEAD / gates (ตรวจริงบนเครื่อง 2026-10-26)

- repo `D:\A PROJECT\Bite Me Baby` · `main` = `origin/main` · **HEAD ก่อนเริ่มงาน = `29ed251`**
- working tree clean · staged/unstaged ว่าง · **untracked = 0** · stash `local-edits-before-sync-2026-09-21` **คงเดิมไม่ถูกแตะ**
- **รอบที่ 2 (ปิด backlog ทั้งหมด) — gates รันจริง:** **tsc exit 0** · **eslint exit 0** ·
  **brandNameGuard OK** · **vitest 146 files / 1541 tests / 0 fail / exit 0** · **build exit 0**
  → evidence = **`e2e/session20261026-r2-gates-evidence.txt`**
- รอบที่ 1 (evidence เดิม `e2e/session20261026-gates-evidence.txt`): vitest 144/1518 ·
  route smoke playwright 39/39 · flaky 4 เคสใน `orderTimeline.test.ts` = **ปิดแล้ว (B-1 → act())**
- **production: ไม่ได้แตะ** (ไม่มี migration/apply/deploy/write) · ledger ของรอบก่อน top = **156** ·
  fresh replay เทียบ production รอบนี้ = **UNVERIFIED** (ไม่ใช่ PASS)
- **CI canonical (ตารางเดียวทุก SHA):** `docs/BMB_MASTER_STATUS.md` **§9.0** — HEAD `1aa678b` =
  CI #575 success + Contract Tests #149 success · รอบก่อน ๆ ทั้งหมดอยู่ในตารางเดียวกัน
  (อ่านจาก GitHub Actions API จริง · ไม่มี `gh` · ห้ามอ้างเลขรันกระจัดกระจาย)

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

## 3. งานค้าง (สถานะจริง ณ 2026-10-26 รอบที่ 2 — **ยังไม่ใช่ "เหลือ Owner อย่างเดียว"**)

- **blocker (engineering):**
  - **B-2** legacy contract 7 ตัว = **BLOCKED** (พยายาม 2 ครั้งล้มเหลว · **Owner สั่งใหม่ให้ปิดในแชทถัดไป**) —
    รายละเอียด+หลักฐาน = `docs/BMB_MASTER_STATUS.md` §3
  - **schema parity (fresh replay vs production)** = **UNVERIFIED** · Owner **อนุมัติให้รันแล้ว** (2026-10-26)
    แต่ยังไม่รัน = ยังปิดช่องนี้ไม่ได้
- **งานที่สั่งใหม่รอบ 2026-10-26 (ทั้งหมดอยู่ใน handoff):**
  - **UI ฝั่งลูกค้า 9 ข้อ** (ป้าย BITE·AI WAITER STAGE / Testimonials / จิ้มแล้วเลื่อน / เมนูบนสุด /
    โหวตเมนูไทย / แถบสถานะ ~11:00 / ลำดับหัวข้อ+ลิงก์จริง / พรีออเดอร์สีเทา / เฟรม 1:1) —
    รายการเต็ม = `docs/BMB_MASTER_STATUS.md` §3.1 (N-4)
  - **CAP-22 ต้องตั้ง `marketing_rules` ให้พร้อมก่อนทดสอบระบบจริง** (N-3)
  - **Test pack ต้องมีเกณฑ์ตรงความจริง** (N-5 — แก้แล้วรอบนี้ ต้องตรวจซ้ำ)
- **แฮนด์ออฟทั้งหมด:** `docs/BMB_HANDOFF_NEXT_SESSION_2026-10-26.md`

## 4. งานรอ Owner (ไม่ใช่งาน AI) — **รันได้เฉพาะที่ไม่ติด blocker**

- = **`docs/BMB_PRODUCTION_TEST_PACK.md`** (เกณฑ์แก้แล้วให้ตรงความจริง) · ขั้นที่ **ถูกงดไว้ก่อน** (ติด
  defect UI ที่ยังไม่แก้ / CAP-22 ยังไม่ได้ตั้ง rules / B-2) ระบุไว้ในไฟล์นั้น §0 และ §L
- **ห้าม**พูดว่า "เหลือ Owner อย่างเดียว" จนกว่า B-2 + schema parity จะปิด (Owner 2026-10-26)

## 5. คำสั่ง/rules ที่ห้ามลืม

- **Owner directive 2026-10-26** (whole-repo reconciliation · code closure · lean production acceptance)
- **PRE_ORDER vs SAME_DAY:** SAME_DAY **ไม่มี cutoff** · PRE_ORDER มี cutoff ตาม policy (server 143/148) —
  ห้ามเอา requirement ที่ถูกยกเลิกจากเอกสารเก่ากลับมา
- เอกสารย้อนหลังทั้งหมด = `docs/archive/` (มี index) — **ห้ามใช้รายงานเก่าสั่งงานซ้ำ**