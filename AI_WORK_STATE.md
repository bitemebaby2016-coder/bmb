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
- **tsc exit 0** · **eslint exit 0** · **brandNameGuard OK (422 ไฟล์)** ·
  **vitest 144 files / 1518 tests / 0 fail / exit 0** (run 2) · **build exit 0** ·
  **route smoke playwright 39/39 passed** — ผลรันรวม = **`e2e/session20261026-gates-evidence.txt`**
- หมายเหตุตรง ๆ: run 1 ของ vitest เจอ **flaky 4 เคสใน `orderTimeline.test.ts`** (รันตัวเดียว 6/6 ผ่าน) = งานค้าง B-1
- **production: ไม่ได้แตะในรอบนี้** (ไม่มี migration/apply/deploy/write) · ledger ของรอบก่อน top = **156**
  (evidence `e2e/r16Apply156-*.json`) — ยังไม่ re-verify รอบนี้ = UNVERIFIED
- **CI ของ SHA ที่ push จริง = ตรวจแล้วผ่านทั้งสองเส้น**: `066e961` → CI #569 **success** +
  Contract Tests #143 **success** (อ่านจาก GitHub Actions API จริง · เครื่องนี้ไม่มี `gh`) —
  รายละเอียด/URL/วิธีตรวจซ้ำ = `docs/BMB_MASTER_STATUS.md` §5.3/§9.4

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

### รอบที่ 2 (ปิดงานค้างทั้งหมดตามคำสั่ง Owner)
6. **B-1 ปิด:** `orderTimeline.test.ts` deterministic ด้วย render+flush ใน `act()` (assertion คงเดิมทุกข้อ)
7. **B-2 ปิด:** legacy contract 7 ตัวเข้า CI gate (`contract-tests.yml` step สุดท้าย)
8. **CAP-21 ปิด:** `src/lib/customerIntelligence.ts` + `/admin/customers` (แถบสรุป + คอลัมน์กลุ่ม) =
   **อัตโนมัติทุกครั้งที่โหลด ไม่มีช่องให้แอดมินตั้ง** · test `customerIntelligence.test.ts`
9. **CAP-22 ปิด:** `src/lib/marketingAutoSchedule.ts` + ปุ่ม "ให้ AI เลือกเวลาทั้งหมด" ในแท็บปฏิทิน =
   เลือกเวลาจาก `marketing_rules` จริง → RPC เดิม → worker เดิม · **คงกติกา CNT-01 (ห้าม auto-approve)**
   · test `marketingAutoSchedule.test.ts`
10. **B-5 ปิด (ส่งมอบ):** ชุดทดสอบ production รวม = **`docs/BMB_PRODUCTION_TEST_PACK.md`** (ขั้น A–K)

## 3. งานค้าง

- **ไม่มีงาน engineering ค้าง** (B-1..B-5 ปิดแล้ว — เหตุผล/หลักฐานอยู่ที่ `docs/BMB_MASTER_STATUS.md` §3)
- งานที่เหลือ = **Owner-only ทั้งหมด** → รัน `docs/BMB_PRODUCTION_TEST_PACK.md` ขั้น A–K

## 4. งานรอ Owner (ไม่ใช่งาน AI)

= **`docs/BMB_MASTER_STATUS.md` §7** — hard refresh แล้วตรวจหน้า · สั่งจริง 2 โหมด ·
R-16 Print-to-PDF · acceptance §4 Growth & Rewards · ตรวจ CI ของ SHA ล่าสุด · ตัดสินใจ CAP-21/22

## 5. คำสั่ง/rules ที่ห้ามลืม

- **Owner directive 2026-10-26** (whole-repo reconciliation · code closure · lean production acceptance)
- **PRE_ORDER vs SAME_DAY:** SAME_DAY **ไม่มี cutoff** · PRE_ORDER มี cutoff ตาม policy (server 143/148) —
  ห้ามเอา requirement ที่ถูกยกเลิกจากเอกสารเก่ากลับมา
- เอกสารย้อนหลังทั้งหมด = `docs/archive/` (มี index) — **ห้ามใช้รายงานเก่าสั่งงานซ้ำ**