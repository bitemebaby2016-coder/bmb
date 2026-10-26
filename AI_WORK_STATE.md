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
  **vitest 144 files / 1518 tests / 0 fail / exit 0** (run 2 · `D:\tmp\vitest2.log`) · **build exit 0**
- หมายเหตุตรง ๆ: run 1 ของ vitest เจอ **flaky 4 เคสใน `orderTimeline.test.ts`** (รันตัวเดียว 6/6 ผ่าน) = งานค้าง B-1
- **production: ไม่ได้แตะในรอบนี้** (ไม่มี migration/apply/deploy/write) · ledger ของรอบก่อน top = **156**
  (evidence `e2e/r16Apply156-*.json`) — ยังไม่ re-verify รอบนี้ = UNVERIFIED
- **CI ของ SHA ที่ push จริง = ตรวจแล้วผ่านทั้งสองเส้น**: `066e961` → CI #569 **success** +
  Contract Tests #143 **success** (อ่านจาก GitHub Actions API จริง · เครื่องนี้ไม่มี `gh`) —
  รายละเอียด/URL/วิธีตรวจซ้ำ = `docs/BMB_MASTER_STATUS.md` §5.3/§9.4

## 2. งานที่ปิดรอบนี้ (CLOSED — มีหลักฐาน)

1. **เส้นทางสั่งซื้อเดียว** สำหรับพรีออเดอร์+เซมเดย์: สร้าง `src/lib/orderEntry.ts` (`runOrderBuilder`) แล้วให้
   `HomePage`/`MenuPage` delegate — เดิมมีสำเนา logic คู่กัน 2 ชุด (Owner: "มีหลายเส้นทางจนมั่วกันเอง")
2. **บั๊กจริงที่แก้:** `HomePage.handleReviewCta` ไม่เคยเช็ค `AddToCartResult` ก่อน toast "เพิ่มลงตะกร้าแล้ว" + navigate
3. **ลบ dead code 11 ไฟล์** (พิสูจน์ 0 reference ทั้ง `src` รวม tests และ `supabase/scripts/e2e/.github/public`)
4. **ปิด D14** (settings default ซ้ำ): `platformConfig` hardcode `dailyQuota 120` vs canonical `100` →
   อ้าง `ORDER_POLICY_DEFAULTS` + test ใหม่ใน `configAuthorityMap.test.ts`
5. **เอกสาร:** สร้าง `docs/BMB_MASTER_STATUS.md` (สถานะหลักเดียว) · ปรับไฟล์นี้ให้สั้น ·
   เพิ่มจุดชี้ใน `AI_ENTRYPOINT.md` · `docs/archive/INDEX_2026-10-26.md`

## 3. งานค้าง (engineering — เอาจากตัวนี้ ไม่ต้องขุดรายงานเก่า)

รายละเอียด/หลักฐานทั้งหมด = **`docs/BMB_MASTER_STATUS.md` §3**

- **B-1** `orderTimeline.test.ts` flaky ตอนรันชุดใหญ่ — ต้องทำให้ deterministic **โดยห้ามลด assertion/ห้าม skip**
- **B-2** legacy contract 7 ตัว นอก CI = ตามคำสั่ง Owner "ไม่ซ่อม" (known state ไม่ใช่ที่ถูกซ่อน)
- **B-3/B-4** CAP-21 ระบบจำลูกค้าอัตโนมัติ · CAP-22 auto-post ของ AI = **รอ Owner ตัดสินใจ**
- **B-5** runtime จริงของ CAP-10/11/13/14/18 = ต้องใช้ production/device/browser จริง

## 4. งานรอ Owner (ไม่ใช่งาน AI)

= **`docs/BMB_MASTER_STATUS.md` §7** — hard refresh แล้วตรวจหน้า · สั่งจริง 2 โหมด ·
R-16 Print-to-PDF · acceptance §4 Growth & Rewards · ตรวจ CI ของ SHA ล่าสุด · ตัดสินใจ CAP-21/22

## 5. คำสั่ง/rules ที่ห้ามลืม

- **Owner directive 2026-10-26** (whole-repo reconciliation · code closure · lean production acceptance)
- **PRE_ORDER vs SAME_DAY:** SAME_DAY **ไม่มี cutoff** · PRE_ORDER มี cutoff ตาม policy (server 143/148) —
  ห้ามเอา requirement ที่ถูกยกเลิกจากเอกสารเก่ากลับมา
- เอกสารย้อนหลังทั้งหมด = `docs/archive/` (มี index) — **ห้ามใช้รายงานเก่าสั่งงานซ้ำ**