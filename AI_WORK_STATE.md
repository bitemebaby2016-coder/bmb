# Bite Me Baby — AI Work State (ระบบบันทึกสถานะสำหรับแชทถัดไป)

> **สถานะงานปัจจุบันของโปรเจกต์ Bite Me Baby** ใช้แนบเข้าสู่ Context ตอนเริ่มแชทเสมอ

**last_updated:** 2026-10-24 **ปิดเซสชันรอบ 14** (P0-1 + P0-2 ผ่านหมด production · ledger **149,148,147,146**
· vitest **135 files/1393 tests exit 0** · tsc/lint/build 0 · Docker replay 001→149 ALL_GREEN ·
contracts 123/124/127-149 PASS ทั้ง ephemeral และ production · **HEAD `7a24123` = origin/main ·
CI success + Contract Tests success ทุก commit รอบนี้ (40103315924 / 40103315919)**)
**phase:** 🟢 ปิดเซสชัน — P0-1 ✅ · P0-2 ✅ · P1-A ✅ **Owner ตอบ Q1–Q4 ครบ** · P1-B = Owner รันเอง (ขอรายการแล้ว)
**current_focus:** **แชทหน้า = 1) BMB ADMIN LEGACY DUPLICATION AUDIT (READ-ONLY, คำสั่งใหม่)
→ 2) ส่งรายงาน + รอ Owner approve → 3) implement Q1 (เอาหน้าต่างส่งออกจากเซมเดย์) + Q3 (รวม AdminRounds
เป็นแท็บเดียว) + แผนรวมเมนูที่ audit เสนอ → 4) Owner รัน acceptance ที่เหลือ**
**blocked_by:** ห้าม implement อะไรก่อน Owner approve รายงาน audit (STRICT STOP CONDITIONS ในคำสั่ง)
· กฎใหม่ที่ใช้ = **`UNIVERSAL_MASTER_AI_RULES.md` (Owner เขียนเอง คัดจากไฟล์นี้ — ฉบับปัจจุบันคือ canonical)**

---

---

## 🩺 REALITY CHECK (2026-10-24 รอบ 13 · role system — sign-off → implement → production)

- **คำสั่ง Owner:** "P1-p3 อนุมัติ signoff · missing ทำให้หมด · partial ให้สมบูรณ์ทั้งระบบ · รอทดสอบบนโปรดักชั่นจริงเท่านั้น"
- **ทำเสร็จ (missing 3 + partial 6 + P1 nav + assignment):**
  - **Migration 146** = `profiles_role_check` 13 ค่า · predicates 11 ตัว (is_admin+owner,
    is_staff+pos, is_owner/kitchen/inventory/finance/marketing/pos/auditor/support/developer/rider)
    · `set_user_role` (admin gate, owner-only promote→owner, self-guard, audit) · rider backfill+trigger
    → **production verify:** constraint 13 ค่า, predicates 10, linked driver = 'rider' แล้ว
  - **Migration 147** = policies: kitchen writes (recipes/batches/items + RPC guards canonical 3-arg),
    inventory grant S/I/U/D คืน+write policy, finance (closings + close_day/get_daily_sales gate),
    marketing (posts/rules + RPC guards×2), support read×4, auditor/dev `_audit_read` 16 ตาราง
    (+GRANT audit_logs/system_errors/menu_schedule), rider 3 policies, grants parity ตาราง post-006
  - **Client:** `isAdminCapableRole` (11 ค่า) ใน AdminRoute+shouldShowAdminLink · `navGroupsForRole`
    ใน AdminNav (per-role hiding) · role sync เข้า authStore ตอน deep-link /admin
  - **Contracts:** `contracts_146` (predicates/set_user_role/trigger) + `contracts_147` (G1–G8
    access matrix ราย role) เสียบ workflow ครบ (ตอนนี้ contract ถึง 147)
- **Verified (หลักฐานจริง):** vitest **134 files/1385 tests exit 0** (roleSystem +10, 4 เทสต์ nav/role รวม 38) ·
  tsc 0 · lint 0 · build 0 · Docker replay **ALL_GREEN (001→147)** · contracts **127–147 ALL_PASS exit 0**
  · production: precheck/apply146/verify146/apply147/verify147/contract146/contract147/record
  **STAGE_OK ทุกขั้น** (evidence `e2e/r7Apply146-*.json`) · ledger = **147,146,145,144**
- **บทเรียนรอบนี้:** (1) anchor-based edit ห้ามใช้บล็อกที่จะลบเป็น anchor โดยไม่ใส่กลับ
  (GRANT/RETURN หาย 2 ครั้งติด) (2) ตารางหลัง 006 ต้อง explicit GRANT ใน CI แม้ production มี
  (default privileges) (3) `create_production_batch` canonical = 3-arg (027 DROP 2-arg แล้ว)
- **Failed/ยังไม่ยืนยัน:** ~~CI~~ → **CI run#539 = success · Contract Tests run#113 = success บน 33df8ce** ·
  runtime บนเบราว์เซอร์จริงทั้งหมด = **Owner checklist #1–#14** (รวมป้ายแจ้งเตือน 841,
  nav desktop/mobile, ราย role 14a–14j)
- **Next Exact Action:** Owner รัน acceptance #1–#14 บน production (สูตรแต่งตั้ง role ใน #14)

---

---

## ✅ ROUND-14 — ผลการดำเนินงาน (2026-10-24 · P0-1 + P0-2 ผ่านหมด production)

> ทำตามลำดับในแฮนด์ออฟ §17 · ทุกขั้นมีหลักฐานจริง (rules: No Evidence = Not Done)

| ID | สถานะ | ทำอะไรบ้าง |
|---|---|---|
| **P0-1** | ✅ DONE + production | **Migration `148_same_day_no_cutoff.sql`** (สร้างด้วย `e2e/m148Build.cjs` anchor-guarded): SAME_DAY ถอด time-gate `ERR_CUTOFF_PASSED` · `ensure_rounds_for_date` ไม่เขียน/ไม่ส่งคีย์คัทออฟเซมเดย์ · `auto_close_expired_rounds` = ปิดเฉพาะวันที่ผ่านไปแล้ว (ไม่ปิดด้วย cutoff) · strip คีย์ `order_pattern` · **DROP COLUMN `same_day_cutoff`** · ฝั่ง client: `deliveryRoundStatus` (SAME_DAY = null cutoff + ป้าย "ไม่มีคัทออฟ"), `orderPolicy` pattern, `bmbAdminApi_rounds`, AdminRounds (ช่องคัทออฟเซมเดย์ถูกถอด → เหลือ "ปิดรับเดิม (legacy)" + "ปรับของพรีออเดอร์"), CheckoutPage, `types/index.ts` · รื้อของที่ผูก 2-คัทออฟ: **ลบ `contracts_145.sql`** → ใหม่ `contracts_148_same_day_no_cutoff.sql` (G1–G6) · **ลบ `roundsTwoCutoffs.test.ts`** → ใหม่ `roundsSameDayNoCutoff.test.ts` (13 ข้อ) · fixture pairing 12 ไฟล์ + `concurrency_124.sh` + `contracts_147` ถูก strip · contract 140 (auto-close) / 143 (G6) / 023 (T7) ปรับตามกติกาใหม่ · workflow = Contract 148 แทน 145 |
| **P0-2** | ✅ DONE + production | **พิสูจน์สาเหตุด้วย probe จริง** `e2e/p14ProbeRounds.cjs` → `e2e/p14ProbeRounds.json`: `orders.delivery_round_id`/`products` → `delivery_rounds` = **FK NO ACTION** (ลบไม่ได้จริง 4 รอบเก่า/4 ออเดอร์) · RLS ไม่ใช่ตัวการ (admin = is_platform) · **Migration `149_round_archive_cleanup.sql`**: คอลัมน์ `archived` + cleanup รอบเก่าไม่มีใครอ้างอิง + **archive อัตโนมัติ 4 แถวพร้อม audit** · client: `archiveRound`/`restoreRound`/`deleteRound` + `roundDeleteErrorText` (เหตุผล FK ตรงความจริง) + AdminRounds ปุ่ม "📦 เก็บ"/"↩ กู้คืน" + ลิสต์ "🗂 รอบที่เก็บไว้" · contract `contracts_149_round_archive.sql` (G1–G6) |
| **P1-A** | ⏳ WAITING_OWNER | one-pager → **`docs/BMB_ROUND_MODEL_ONE_PAGER_2026-10-24.md`** (คำศัพท์รอบ + กติกาหลัง 148/149 + **Q1–Q4 ที่ต้องการคำสั่ง**) · **ยังไม่แตะโครง UI** ตามกฎ "ห้ามเดา product decision" |
| **P1-B** | ⏳ ของ Owner | รัน acceptance ที่เหลือ — **ขั้น #6 ถูกยกเลิก/แทนที่โดย 148 แล้ว** · เหลือ #5 nav, #7 ป้าย 841, #9–#14 (ราย role 14a–14j) รอ Owner แจ้งผลรวม |

### Verified (หลักฐานจริง — ทุกอันรันเองในเซสชันนี้)

- **vitest 135 files / 1393 tests exit 0** (เทสต์ใหม่ 2 ไฟล์ 18 ข้อ) · **tsc 0 · lint 0 · build 0**
- **Docker replay (postgres:16 ephemeral): ALL MIGRATIONS APPLIED CLEANLY 001→149** + contracts
  123/124/127-130/131/133/135/136/137/138-139/**140/141/142/143/144/146/147/148/149 = PASS ทุกไฟล์**
  (contracts ที่ CI ไม่รันอย่าง 023/028/030/036/037/038/039/125 = **pre-existing drift** — พิสูจน์แล้วว่า
  fail เหมือนเดิมแม้คืนคอลัมน์ same_day_cutoff (ค่า radius/เมนู gate 142) → ไม่ใช่ของที่รอบนี้ทำพัง)
- **Production apply (staged, evidence `e2e/r8Apply148-*.json`):**
  `precheck → apply148 → verify148 (col gone, pattern key gone, gate rewritten, auto-close date-only)
  → apply149 → verify149 (archived col + 4 แถว archive + 4 audit) → contract148 → contract149
  → contractRegr (140/143/144) → record` = **STAGE_OK ทุกขั้น** · **ledger = 149,148,147,146**
- **ไม่มีสาระตกค้างจาก contract ที่ fail กลางคัน** (probe: fixture 0 แถว / test orders 0 / ไม่มี txn ค้าง)

### คำสั่ง/คำตอบ Owner ตอนปิดเซสชัน 2026-10-24 (= requirements ของรอบหน้า)

| หัวข้อ | คำสั่ง Owner | ผล |
|---|---|---|
| **P1-A · Q1** | **(ข) เอาออก = เซมเดย์สั่งได้ทุกเวลาในวันนั้น** | implement = `roundBookability` ฝั่ง SAME_DAY ไม่คืน `window_passed` อีก (คงไว้เฉพาะ PRE_ORDER) + CheckoutPage auto-select/ป้าย + อัปเดตเทสต์ → **ยังไม่ได้ทำ (คิวแชทหน้า)** |
| **P1-A · Q2** | **เปิด/ปิดโดยแอดมินได้** (ระบบไม่เปิดกลับเอง) | **ไม่ต้องแก้โค้ด** — พฤติกรรมปัจจุบันถูกแล้ว · แถว `closed` ที่ค้าง (วันนี้ 3 + 26 อีเวนนิง) = กดเปิดเองจาก AdminRounds |
| **P1-A · Q3** | **(ก) อนุมัติให้รวม AdminRounds เป็นแท็บเดียว** | งาน UI ล้วน → ทำ **หลัง** audit + approve |
| **P1-A · Q4** | "มีการทำงานซ้ำซ้อนและเมนูซ้ำซ้อนกับใน setting แอดมิน ตรวจและแก้ตามคำสั่งใหม่" | → **คำสั่งใหม่: BMB ADMIN LEGACY DUPLICATION AUDIT (READ-ONLY)** = `docs/BMB_ADMIN_LEGACY_DUPLICATION_AUDIT_2026-10-24.md` · **ห้าม implement จนกว่า Owner approve รายงาน** |
| **P1-B** | "ขอรายการจะลองให้ ส่วนใหญ่หายแล้ว" | รายการอยู่ที่ **P1-B checklist ด้านล่าง** |
| **กฎใหม่** | `UNIVERSAL_MASTER_AI_RULES.md` = **Owner เขียนเอง** (คัดกฎจาก `AI_WORK_STATE.md` ใส่) + สั่งให้ใช้เป็นกฎแชทหน้า | ฉบับปัจจุบัน = canonical สำหรับรอบหน้า · ต้องเทียบเคียงกับไฟล์นี้ ห้ามขัดแย้ง (ดู `.clinerules` §RULE AUTHORITY) |

### รู้ไว้ (มีคำตอบแล้ว แต่ยังไม่ implement / เป็นข้อเท็จจริงคงเดิม)

- **หลัง implement Q1:** ฝั่งเซมเดย์เหลือแค่ `full` (ความจุ) + `closed` (สถานะรอบ) — ไม่มี time-gate เลย
- **Q2 = คงเดิม:** ไม่มี auto-reopen ของรอบ — ระบบปิดเฉพาะวันที่ผ่านไปแล้ว (148) ที่เหลือแอดมินสั่งเอง
- **contracts 023/028/030/036/037/038/039/125 = stale pre-existing drift** (ไม่อยู่ใน CI gate) —
  พิสูจน์แล้วว่า fail เหมือนเดิมก่อนงานรอบนี้ (radius/เมนู gate) → เป็นงานค้างถ้า Owner สั่งซ่อม

### หมายเหตุเซสชัน (ต้องไม่หาย)

- **`UNIVERSAL_MASTER_AI_RULES.md` = Owner ยืนยันเองว่าเขียนเอง** (คัดแยกกฎจากไฟล์นี้ใส่ไป) และสั่งให้ใช้
  เป็นกฎใหม่ของแชทหน้า → commit `9d5fc24` ที่ครอบไฟล์นี้ไว้ = **ถูกต้องแล้ว ห้าม revert**
- รอบนี้ไม่ได้แก้ไฟล์อื่นใดนอกจากที่ระบุในแฮนด์ออฟ §18/§19

### P1-B — รายการ acceptance ที่เหลือ (Owner ขอรายการ + จะรันเอง)

> รันบน `https://biteme-baby.com` ตาม `docs/BMB_E2E_PRODUCTION_ACCEPTANCE_PLAN_2026-10-24.md` §4 ·
> `[R]` = อ่านอย่างเดียว `[O]` = สร้างข้อมูลทดสอบของ Owner เเอง · ✅ = ฝั่งโค้ด/หลักฐานตรวจให้แล้ว · ⏳ = ต้องรันบนเบราว์เซอร์/อุปกรณ์จริง

| # | ขั้น | สถานะ |
|---|---|---|
| 1 | CI + Contract Tests หลัง push | ✅ `d306ca7`/`9d5fc24`/`7a24123` = success ทั้ง 2 workflows |
| 2 | `[R]` หน้าแรก/เมนู/รอบ/โปรโมชันโหลดครบ | ⏳ |
| 3 | `[O]` สั่งซื้อเมนูจริง (รายการแรกของร้าน) | ⏳ |
| 4 | `[O]` PRE_ORDER ใน 2 ชม. ก่อนส่ง = ผ่าน · เกินคัทออฟ = ถูกปฏิเสธพร้อมเวลา | ⏳ |
| 5 | `[R]` `/admin` ทุกเมนู (desktop sidebar + มือถือ drawer) + ป้ายคัทออฟพรีออเดอร์ + ป้าย "เซมเดย์ไม่มีคัทออฟ" | ⏳ |
| 6 | ~~ทดสอบ 2 คัทออฟ~~ → **ยืนยันว่าช่องคัทออฟเซมเดย์หายไปจริง** ในหน้ารอบ | ⏳ (ฝั่งโค้ด/เทสต์ ✅ แล้ว) |
| 7 | `[R]` ป้ายแดงค้างเคส **841** → reload 2 ครั้ง = หายไม่กลับ + bell/"อ่านทั้งหมดแล้ว" | ⏳ |
| 8 | `[O]` push บนมือถือ = ได้ 1 notification ต่อสถานะ | ⏳ |
| 9 | `[O]` จ่ายเงินจริง + ตรวจสลิปในแอดมิน (อนุมัติ → paid ใน DB) | ⏳ |
| 10 | `[R]` SMS ยืนยัน (ถ้าเปิดใช้) | ⏳ |
| 11 | `[O]` Rider POD upload บนมือถือ (รูปขึ้นจริง) | ⏳ |
| 12 | `[R]` แผนที่ checkout (Maps key ใน Cloudflare) | ⏳ |
| 13 | `[R]` เอกสาร/commit ตรง production build | ✅ `AI_WORK_STATE` + แฮนด์ออฟอัปเดตแล้ว · HEAD `7a24123` = origin/main |
| 14 | `[O]` ระบบ role 13 ค่า → **14a–14j** (สูตร SQL ในแผน §5) | ⏳ |

### Next Exact Action (เรียงลำดับที่ต้องทำในแชทหน้า)

1. **ข้อ 1 — AUDIT (READ-ONLY):** `docs/BMB_ADMIN_LEGACY_DUPLICATION_AUDIT_2026-10-24.md` —
   เริ่มจากรายงานสถานะ (repo/HEAD/stash/CI/untracked) → inventory ทุก nav entry + route/component/API/DB/role
   → duplication matrix (KEEP/MERGE/REPAIR/DEPRECATE/REMOVE/NEEDS INVESTIGATION) → เสนอสถาปัตยกรรมเป้าหมาย
   → **หยุด รอ Owner approve** (ห้ามแก้โค้ด/DB/มี migration/commit/push ระหว่างทำ)
2. **ข้อ 2 — หลัง approve เท่านั้น:** implement **Q1** (เอา `window_passed` ออกจากฝั่งเซมเดย์) +
   **Q3** (รวม AdminRounds เป็นแท็บเดียว) + แผนรวมเมนูที่ audit เสนอ → เกตเดิมทั้งหมด
   (vitest/tsc/lint/build → Docker replay → contracts → production stages → push → เช็ค CI)
3. **Owner:** รัน **P1-B checklist** ด้านบนแล้วแจ้งผลรวม → defect ใหม่ = จดลงไฟล์นี้
4. **CI ของรอบนี้ ✅:** `d306ca7` → CI success (run 40103315924) + Contract Tests success (run 40103315919) ·
   `9d5fc24` และ `7a24123` ก็เขียวทั้งคู่
   (https://github.com/bitemebaby2016-coder/bmb/actions/runs/40103315924 ·
   https://github.com/bitemebaby2016-coder/bmb/actions/runs/40103315919)

---

## 🔴 ROUND-14 BACKLOG (คำสั่งใหม่ Owner ตอนปิดเซสชัน 2026-10-24 — "ไปทำแชทหน้า") ← ทำเสร็จแล้ว ด้านบน

### กฎใหม่ของ Owner (มีผลเหนือสิ่งที่ทำไปแล้ว — ห้ามฝ่าฝืนรอบหน้า)

1. **SAME_DAY ห้ามมีคัทออฟ** — รอบจัดส่งเซมเดย์ต้องวิ่งปกติตั้งแต่**ร้านเปิด–ปิด**
   ไม่มี cutoff ใด ๆ (ไม่ใช่ "คัทออฟเลยร้านปิด" — คือไม่มีเลย)
2. **คัทออฟมีเฉพาะ PRE_ORDER เท่านั้น** — "คัทออฟอิสระ/สองช่อง" ที่เพิ่งสร้าง
   (`same_day_cutoff` ใน migration **145**) = **ไม่จำเป็น สั่งถอด** (Owner เคยอนุมัติ 2-คัทออฟ
   ตอนนี้ยกเลิกแนวนี้แล้ว)
3. **แนวคิด "รอบ" งง ไปหมด** — รอบรายวันคืออะไร ฯลฯ ต้องรวบรวมให้ชัดก่อนแตะโค้ด
4. **รอบที่ค้าง = ลบไม่ได้** — ที่ค้างอยู่ทั้งหมดเป็นพวก "ลบไม่ได้" ต้องแก้ให้จัดการได้

### ปัญหาที่ต้องแก้ทั้งหมด (เรียงตามความสำคัญ)

| ID | ปัญหา | ขอบเขตที่รู้แล้ว (เริ่มจากตรงนี้) |
|---|---|---|
| **P0-1** | ถอด same-day cutoff + same-day = เปิด–ปิดไม่มีคัทออฟ | migration **148** (ลบ/neutralize `same_day_cutoff` ที่อยู่ใน production แล้ว ปลอดภัย+audit+ledger) · `src/lib/orderPolicy.ts` (same_day check) · AdminRounds สองช่องคัทออฟ → เหลือช่อง pre-order เท่านั้น · **รื้อบางส่วนของรอบ 13:** contract 145 (G1-G6 สร้างบน 2-คัทออฟ), `roundsTwoCutoffs.test.ts` (11 ข้อ), fixture pairing 12 คอนแทรคต์ + concurrency_147-style ที่ทำไว้ · ขั้น #6 ใน acceptance = ยกเลิก (ดูหมายเหตุในไฟล์นั้น) |
| **P0-2** | รอบจัดส่งค้าง "ลบไม่ได้" | พิสูจน์สาเหตุจริงก่อน (สมมติฐาน: FK/orders อ้างอิง หรือ guard ใน RPC/policy — ยังไม่ได้ยืนยัน) · ทางแก้รูปแบบเดียวกับ products = **archive/จัดเก็บ** แทนลบถาวร + SQL cleanup รอบเก่าที่ไม่มีออเดอร์ · ให้เหตุผลที่ UI แสดงเป็นจริงเสมอ |
| **P1-A** | แนวคิดรอบงง (3 รอบ/วัน + "รอบรายวัน" + same-day + pre-order) | `AdminRounds.tsx` มี 2 ส่วน: (1) แพทเทิร์น 3 รอบ/วัน (2) หัวข้อ "📅 รอบรายวัน" = การ์ดจัดกลุ่มตามวัน (สัดส่วน UI ตอนนี้) · **ทำ one-pager สรุปชนิดรอบ/คำศัพท์/กติกา ให้ Owner อนุมัติก่อน** ค่อยยุบ/เปลี่ยน UI (ห้ามเดาเอง) |
| **P1-B** | Owner ยังไม่ได้ runtime acceptance | `docs/BMB_E2E_PRODUCTION_ACCEPTANCE_PLAN_2026-10-24.md` #1–#14 (ยกเว้น #6 ที่ยกเลิกแล้ว) — โดย #7 (ป้าย 841), #5 (nav desktop/mobile), #14a–#14j (ราย role) ยัง UNVERIFIED บนเบราว์เซอร์จริง |

### งานที่เหลือทั้งหมดของแชทหน้า ( checklist เปิดแชท )

1. อ่านกฎ 4 ข้อด้านบนก่อนแตะอะไรทั้งสิ้น (มีผลเหนืองานรอบ 13 บางส่วน)
2. P0-1 → design → migration 148 + contract 148 + รื้อ contract/test ที่ผูก 2-คัทออฟ → replay → production
3. P0-2 → reproduce "ลบไม่ได้" บน production probe (read-only) → archive/cleanup path + contract
4. P1-A → เขียน one-pager ชนิดรอบ → รอ Owner อนุมัติ → ค่อยรวม UI/คำ
5. P1-B → Owner รัน acceptance (รอคำสั่ง/เวลาจาก Owner)
6. ถ้ามี bootstrap rules ใหม่จาก chat นี้: อ่าน AI_ENTRYPOINT/UNIVERSAL_MASTER_AI_RULES/AI_WORK_STATE/.clinerules ก่อนเสมอ

---

---

---

## 🩺 REALITY CHECK (2026-10-24 รอบ 12 · งานครบตามแฮนด์ออฟ §13 ทั้ง 7 ข้อ)

- **งาน 1 (CI ซ่อม 2 จุด + wire contract) — เสร็จ:**
  - `CheckoutPage.tsx` `branch?.branch_id ?? null` · contract 123 P8 เพิ่มแถวเมนู published
    ของ prod-5 (คง assertion `ERR_PRODUCT_UNAVAILABLE` เข้มเดิม) · workflow เพิ่มขั้น
    Contract 142/143/144/**145**
  - **ของแถมที่เจอจากการรันครบ**: contract **141 G1/G4 stale** (ชนตาข่าย 142 — เคส
    regular-only/archived-menu เคยคาดว่า created) → reconcile เป็น
    `ERR_PRE_ORDER_REQUIRES_MENU` (เข้มขึ้น ไม่ใช่การอ่อน assertions) · fixture
    `SET cutoff_time='23:59'` 12 ไฟล์ + `concurrency_124.sh` ต้องเซ็ต `same_day_cutoff`
    คู่กันหลัง 145 (ไม่งั้นคัทออฟเก่าค้าง → contract 124 พังเวลาหลังเที่ยง)
- **งาน 2 (แจ้งเตือน 841) — เสร็จ (โค้ด+เทสต์):** hydrate = server canonical (แทนที่ไม่ใช่
  skip) · `markAllAsReadServer` เขียนเซิร์ฟเวอร์ก่อนค่อยล้าง badge ( fail = ไม่ล้าง) ·
  เรียงตาม **ลำดับสถานะออเดอร์** (probe production จริง: preparing 11:29:07 ใหม่กว่า
  delivered 11:29:05 → created_at ล้วนไม่พอ) + จับกลุ่มตามเลขออเดอร์ · bell โชว์เสมอ +
  footer → `/notifications` · popup ปิดเองเมื่ออ่านจบ · เทสต์ใหม่ 10 ข้อ
- **งาน 3 (เมนู/nav แอดมิน) — เสร็จ:** audit = ไม่มี dead link (24 nav → route ครบทุกตัว,
  legacy = redirect), ไม่มีหน้า placeholder, gate `AdminRoute` ครบทุก page route · เพิ่ม
  **scroll-top on route change** (jsdom-safe guard) · เทสต์ใหม่ 7 ข้อ + routeNav 39/39
- **งาน 4 (รอบจัดส่ง 2-คัทออฟ) — เสร็จ + production แล้ว:** Owner อนุมัติทั้ง schema +
  กฎ ≥2 → migration **145** (`same_day_cutoff`/`pre_order_cutoff` บนรอบเดิม ไม่สร้างตาราง)
  · `create_order_with_items` + `enforce_pre_order_window` + `ensure_rounds_for_date` patch
  (builder anchor-guarded) · client mirror + `orderPolicy` pattern + AdminRounds ป้าย
  "ปรับของเซมเดย์/ปรับของพรีออเดอร์" + API เขียนครบ · contract **145 G1-G6** (override 2 ทาง
  + fallback กฎเดิม + shared-slot ไม่นับซ้ำ + ≥2 publish + กันบายพาส) เขียว **ทั้ง Docker และ
  production** · 143/144 regression production PASS · **apply+verify+record production = ledger
  145 แล้ว** (evidence: `e2e/r6Apply145-*.json`)
- **งาน 5/6 (เอกสาร) — เสร็จ:** `docs/BMB_ROLE_PERMISSION_AI_AUDIT_2026-10-24.md`
  (role/page/RLS matrices + gap 12 หมวด + staged proposal = DOCUMENTED รอ Owner) +
  `docs/BMB_E2E_PRODUCTION_ACCEPTANCE_PLAN_2026-10-24.md` (journey map + gaps + checklist 13 ขั้น)
- **R4 (header 124) — เสร็จ:** คอมเมนต์ STALE ถูก reconcile (comment-only ไม่แตะ SQL/history)
- **Verified (หลักฐานจริง):** vitest **133 files/1375 tests exit 0** (มีเทสต์ใหม่ 3 ไฟล์ 28 ข้อ) ·
  lint exit 0 · build exit 0 · Docker replay ALL_GREEN (migrations 001-145 + 123/124/concurrency)
  · contracts 127-145 ทุกไฟล์ PASS exit 0 · playwright routeNav **39/39** · production
  apply stages STAGE_OK ทุกขั้น
- **Failed/ยังไม่ยืนยัน:** ~~ผล CI~~ → **CI + Contract Tests = SUCCESS บน fa91c2a ทั้งคู่** ·
  ป้ายแจ้งเตือน 841 ยัง **UNVERIFIED บนเบราว์เซอร์จริง** (ต้อง Owner รัน checklist #7) · mobile visual ตา Owner (#5)
- **บทเรียนรอบนี้:** fixture ที่ "เปิดรอบรับเดี๋ยวนี้" ด้วยการอัปเดต `cutoff_time` อย่างเดียว
  พังทันทีที่มีคอลัมน์คัทออฟใหม่ — พอเพิ่ม column ต้องไล่แก้ทุกจุดที่เขียน cutoff เดี่ยว ๆ
- **Next Exact Action:** (1) เช็ค CI ทั้ง 2 workflows หลัง push (2) Owner รัน checklist
  production acceptance (3) ถ้า CI แดง → ดู log แล้วแก้ตามกฎ 2-ครั้ง

---

---

## 🩺 REALITY CHECK (2026-10-24 รอบ 11 · ปิดเซสชัน — ไม่อนุมัติโค้ด, งานทั้งหมดไปแชทหน้า)

- **สิ่งที่ตรวจพบ (อ่านอย่างเดียว ไม่แก้อะไรในรอบนี้):**
  - **CI แดง 2 ตัวจากบั๊กของรอบ 10 (ของผมเอง):** Contract Tests `40064017931` = `e2e/contracts_123_menu_publish.sql:122` (P8 ยังคาดพฤติกรรมก่อน 142) และ CI `40064017932` = `src/pages/CheckoutPage.tsx:334` `branch.branch_id` เป็น null ในเทส → unhandled error ผ่านเขียวล่าสุดที่ `5fdb81e`
  - **Migration 124 = apply แล้วจริง** (ledger มี 118..144 ครบ, `create_order_with_items_i` + `order_submissions` มีจริง) — ที่ CI โชว์ "skipped" เพราะขั้นก่อนหน้าล้ม ไม่ใช่เพราะ 124 หาย; คอมเมนต์ในไฟล์ 124 ที่ว่า "ห้ามใช้ production" จึงเก่าแล้ว ต้อง reconcile
  - **รอบจัดส่ง:** "แพทเทิร์น 3 รอบ/วัน" กับ "รอบรายวัน" ไม่ใช่ของซ้ำ แต่เป็น **เทมเพลต vs รอบจริงของวันนั้น** ใช้ร่วมกันทั้งพรีออเดอร์/เซมเดย์ ความจุก้อนเดียว — Owner ต้องการแยก "ปรับของพรีออเดอร์ / ปรับของเซมเดย์" → ออกแบบเป็น 1 รอบ 2 คัทออฟ (same-day/pre-order) ไม่สร้างตารางใหม่ รอ Owner อนุมัติ schema ก่อนทำ
  - **เมนูและตาราง:** พรีออเดอร์ = ตารางเมนูรอบพิเศษของแอดมิน (`menu_schedule`) จริงตามที่ Owner ถาม
  - **ออเดอร์ 841:** `status='delivered'` ถูกต้อง และแจ้งเตือน 6 แถว `is_read=true` หมดแล้ว — ปัญหาแดงค้างเป็น **บั๊กฝั่ง client** (hydrate ไม่อัปเดต is_read / markAllAsRead ไม่บันทึกลงเซิร์ฟเวอร์ / เรียงเวลาผิดทำให้ข้อความ "กำลังเตรียมอาหาร" โผล่แทน / ป๊อปอัปไม่ปิดเอง) — ยัง **ไม่** ป้ายืนยันว่าป้ายแดงหาย จนกว่าจะเช็ค runtime
- **บทเรียน:** รอบก่อนผมรายงานว่า "vitest 130/1347 เขียว" ทั้งที่ vitest ขึ้น unhandled-error warning — ครั้งหน้าต้องรอ exit code จริง ไม่เชื่อแค่ summary
- **งานทั้งหมดไปแชทหน้า:** ดู `docs/BMB_HANDOFF_NEXT_SESSION_2026-10-24.md` §13 (งาน 1 = ซ่อม CI 2 จุด + เพิ่ม contract 142-144 เข้า workflow) — Owner สั่ง "ไม่อนุมัติโค้ด" เซสชันนี้ จึงมีเฉพาะเอกสาร

---

## 🩺 REALITY CHECK (2026-10-24 รอบ 10 · R5d — คัทออฟ 2 ชม. + ตั้งค่า/แพทเทิร์นรอบฝั่งแอดมิน)

- **บั๊กที่ Owner เจอ (production 10:24 น. 2026-10-24) — ต้นตอและทางแก้:**
  - **ต้นตอ ①:** `create_order_with_items` + trigger `enforce_pre_order_window` ปฏิเสธ `scheduled_date <= วันนี้` (ERR_SCHEDULED_DATE_INVALID / ERR_PRE_ORDER_DATE_INVALID) → เมนูปฏิทิน "วันนี้" สั่งไม่ได้ แม้ยังไม่ถึงคัทออฟ → "สร้างออเดอร์ล้มเหลว"
  - **ต้นตอ ② (กับระเบิดซ่อน):** `order_policy.pre_order_lead_days = "มี7"` (Owner พิมพ์ใน JSON ดิบของ AdminSettings) → `order_setting()` cast 22P02 → **ทุก**พรีออเดอร์พัง (contract 142 ยังเขียวเพราะรันก่อนค่าพังถูกพิมพ์)
  - **ต้นตอ ③:** คัทออฟรอบใช้ `cutoff_time` ที่แอดมินตั้งเอง (30-60 นาที) ไม่ใช่กฎ "ก่อนส่ง 2 ชม." (Owner Q1/FC-4 — มีใน trigger 114 อยู่แล้วแต่ UI/RPC ไม่ได้ใช้)
- **Migration 143 (`143_pre_order_cutoff_settings.sql`):** พรีออเดอร์วันนี้ได้จนถึงคัทออฟ · คัทออฟพรีออเดอร์ = `delivery_start − order_policy.cutoff_hours` (default 2, ตั้งจากแอดมิน) · SAME_DAY คงเดิม (`cutoff_time` — เซมเดย์ส่งได้ตลอด) · ยกเลิก ERR_LEAD_TIME · `order_setting` แข็ง (cast fail → default) + ซ่อมค่า "มี7"→7 — **apply/verify/contract G1–G8 บน production แล้ว** (หลักฐาน `e2e/r5cApply143-*.json`)
- **Migration 144 (`144_round_pattern.sql`):** แพทเทิร์น 3 รอบ/วัน (`business_settings.order_pattern` — แอดมินแก้ได้) เป็น template ของ `ensure_rounds_for_date` (fallback เทมเพลตเดิม) + ซ่อมรอบอนาคตที่ถูกปิดทิ้ง → active — **apply/verify/contract G1–G5 แล้ว** (note: fallback ต้อง clone `branch_id` จากเทมเพลตตาม 113 — แก้แล้วหลัง contract เจอ)
- **Client/UI:** `deliveryRoundStatus` แยกคัทออฟตามโหมด (PRE_ORDER = start−cutoff_hours / SAME_DAY = cutoff_time) + ป้าย "ปิดรับพรีออเดอร์ HH:MM" · CheckoutPage ตัด lead-guard · **AdminSettings = ฟอร์มค่า policy แบบมีชนิด** (`OrderPolicyPanel` — ปิดช่องพิมพ์ JSON ดิบ) · **AdminRounds = แพทเทิร์น 3 รอบ + รอบรายวันจัดกลุ่มตามวัน** (ปุ่ม "สร้าง/ซ่อมรอบ 30 วัน" / "ซ่อมตามแพทเทิร์น")
- **Repro probe ยืนยันบน production (`e2e/r5cReproMixedToday.*`, ROLLBACK):** S1 ตะกร้ารวม+รอบเย็น+วันนี้ = **ok** (บั๊ก Owner หาย) · S3 สินค้าธรรมดาล้วน = ERR_PRE_ORDER_REQUIRES_MENU (gate 142 คง) · **vitest 130/130 ไฟล์ 1347 ทดสอบ · tsc · eslint · secret scan 0**
- **Next Exact Action:** Owner hard refresh → เทส `docs/BMB_R5_PRE_ORDER_SEPARATION_2026-10-23.md` §8 ข้อ 1–12 → รายงานผล → ถ้าตก แก้ในแชทนี้ต่อ

---

## 🩺 REALITY CHECK (2026-10-23 รอบ 9 · R5c ทำครบฝั่งวิศวกรรม — รอ Owner เทส)

- **ทำแล้ว (verified ทั้งหมด):**
  - **ต้นตอ "ภาษาต่างดาว" = ไฟล์ซอร์ส mojibake จริง** (ไม่ใช่ข้อมูลลูกค้า): `src/lib/adminUi.ts` (ป้ายเมนูแอดมิน 48 จุด) + `src/lib/bmbAdminApi_rounds.ts` (ข้อความ validation 12 จุด) + `e2e/contracts_140.sql` (คอมเมนต์ 5 จุด) — เขียนไฟล์ผ่าน shell ที่ encoding พัง → ซ่อมด้วย `e2e/g9FixSourceMojibake.cjs` (cp1252→utf8 round-trip) → `e2e/g9LanguageAudit.cjs` = 0 ทั้งโปรเจกต์ · DB probe (`g9MojibakeDataProbe2/3.cjs`, read-only) = orders/customers/pre_orders **0 mojibake** (commit `df5400e`)
  - **R5c client:** ตัดช่องเลือกวันอิสระ (วันล็อกจากป้ายเมนูเท่านั้น) · ตัดปุ่มสลับโหมด/ป๊อปอัปล้างตะกร้า (CartIsolationModal + m1 split engine ลบ: m1CheckoutPlan/m1Submit) · ตะกร้าเดียว = ออเดอร์เดียว (deriveCartMode: มีบรรทัด PRE_ORDER = ทั้งตะกร้า PRE_ORDER) · ปุ่ม "จองล่วงหน้า" เฉพาะการ์ดมีป้ายปฏิทิน (การ์ดอื่น disabled "ยังไม่ลงปฏิทินรอบถัดไป")
  - **Migration 142** (`supabase/migrations/142_pre_order_requires_menu.sql`, สร้างโดย `e2e/m142Build.cjs` anchor-guarded จาก 141): PRE_ORDER ต้องมี ≥1 เมนูปฏิทินของวันนั้น → ไม่มีเมนูเลย = `ERR_PRE_ORDER_REQUIRES_MENU` · มีเมนูผูกวันแต่คนละวัน = `ERR_PRODUCT_NOT_ON_MENU` (§5-C เดิม) — **apply + verify + contract G1–G5 + record บน production แล้ว** (หลักฐาน `e2e/r5cApply142-*.json`, ledger 142, grants ครบ)
  - **เทส:** เขียนใหม่ตามสัญญา (checkoutModeLock/checkoutMixedSplit/cartIsolationStore → R5c) + แก้ fixture (api/canonicalOrderFlow/menuSchedule/menuScheduleGate/homePreOrderModeGuard/homeSectionModeCta/cartPersistence/preOrderUnification/cartEntryPoints) + supabaseMock mirror 142 — **vitest 129/129 ไฟล์เขียว · tsc · eslint+brandNameGuard · secret scan 0**
- **กติกาที่ยังใช้:** ห้าม text ไทยในคำสั่ง shell (เขียนผ่าน editor/temp node script UTF-8 เท่านั้น) · commit ระบุ path เท่านั้น (ห้าม `git add -A`) · ยังไม่เรียก DONE จน Owner เทสผ่าน
- **Next Exact Action:** ให้ Owner hard refresh แล้วเทส `docs/BMB_R5_PRE_ORDER_SEPARATION_2026-10-23.md` §7 ข้อ 1–19 → รายงานผล (ผ่าน/ตกทีละข้อ) → ถ้าตก แก้ในแชทนี้ต่อ

---

## 🩺 REALITY CHECK (2026-10-23 รอบ 8 · สัญญาปิดท้ายเซสชัน R5c — Owner ยืนยันแล้ว)

- **ปัญหาที่ Owner ชี้ + สาเหตุ:** งาน R5 ตีความผิด — ไปเปิด "พรีออเดอร์วันอิสระ" (เลือกวันเองอิสระ) ซึ่งเป็นฟีเจอร์ซ้อนที่คำสั่งเดิมสั่งให้ตัดออก
- **สัญญาที่ถูกต้อง (Owner ยืนยัน 3 ข้อ):**
  1. พรีออเดอร์มาจากเมนูที่แอดมินลงปฏิทินเท่านั้น (วันจากป้ายมุมเมนู) — ลูกค้าเลือกแค่รอบ · **ไม่อนุญาต**พรีออเดอร์วันอิสระ ถ้าไม่มีเมนูปฏิทินในตะกร้า = same-day เท่านั้น · same-day = ส่งวันนี้ทันที ไม่ต้องรอรอบ ระบบผูกกรอบให้เอง ไม่ให้ลูกค้าเลือกกรอบ (แยกด้วยหมวด+วันอยู่แล้ว)
  2. สินค้าทั่วไป (สินค้า same-day) ติดไปกับรอบพรีออเดอร์ในออเดอร์เดียว รับพร้อมกันที่รอบนั้น — ถูกต้อง
  3. สินค้าที่ปิด "ส่งวันนี้" ติดไปกับพรีออเดอร์ได้
- **มรดกค้าง (ทำรอบถัดไป = R5c):** (1) ตัดช่องเลือกวันอิสระพรีออเดอร์/ปุ่มสลับโหมด/การแยก 2 ออเดอร์ ใน CheckoutPage (2) migration 142 ฝั่ง server: PRE_ORDER ต้องมี ≥1 เมนูจากปฏิทินของวันนั้น + วันต้องตรงวันเมนู ไม่งั้น `ERR_PRE_ORDER_REQUIRES_MENU` (3) แก้เทส/contract/docs ตาม (4) **สอบสวน "ภาษาต่างดาว" ใน UI แอดมิน production** (ที่อยู่ลูกค้าในตารางเพี้ยน — ภาพยืนยันจาก Owner) ต้นตอน่าจะเป็น seed/เขียนข้อมูลผ่าน shell ที่ encoding พัง ไม่ใช่ไฟล์ซอร์ส (scan แล้วไม่เจอใน tracked text) (5) กฎเดิมที่ต้องรักษา: ห้าม text ไทยในคำสั่ง shell — เขียนผ่าน editor/temp node script UTF-8 เท่านั้น
- **การ commit วันนี้:** ใช้การระบุ path เท่านั้น (ไม่ `git add -A` ซ้ำรอยเดิม)

## 🩺 REALITY CHECK (2026-10-23 รอบ 7 · Directive R5)
- **คำสั่ง Owner:** "พรีออเดอร์ควรเพิ่มสินค้าที่ไม่ใช่พรีออเดอร์ได้ทั้งหมดและส่งในรอบเดียวกับพรีออเดอร์ได้ ... ต้องแยกระหว่างพรีออเดอร์ [ทั่วไป] กับเมนูที่แอดมินใส่เองทีละ 7 วัน 14 เมนู (วันถูกกำหนดโดยปฏิทินที่แอดมินใส่ — ป้ายมุมเมนู) แล้วลูกค้าเลือกแค่รอบ ... เมนูที่เลยวันไปแล้วให้เก็บ archive (ไม่โชว์วันที่ผ่านรอบจัดส่ง) ... ต้องการยุบรวมระลอก 2 ... ผ่านหมดค่อยคอมมิทพุช แอดมินจะทดสอบโปรดักชั่นจริง แจ้งรายการทดสอบละเอียดภาษาไทย"
- **ทำรอบนี้ (ทั้งหมด verified):**
  - **C1 PRE_ORDER รับสินค้าทุกตัว:** ยกเลิก gate `PRE_ORDER × available_preorder` (client checkModeEligibility + server create_order_with_items ใน migration 141) — สินค้าทั่วไปเพิ่มในตะกร้าพรีออเดอร์ได้ทั้งหมด · SAME_DAY gate (available_same_day) คงเดิม
  - **C2 แยกเมนูรอบพิเศษตามปฏิทินแอดมิน:** menu_schedule (7 วัน/14 เมนู) ผูก "วันจัดส่ง" ให้สินค้าในเมนูเท่านั้น (ป้ายมุมเมนู = ProductScheduleMap) — checkout ล็อกวันอัตโนมัติ (resolveMenuBoundDate), ลูกค้าเลือกแค่รอบจัดส่ง · สินค้าทั่วไปส่งร่วมรอบเดียวกันได้ · ผูกหลายวัน = conflict แจ้งแยกสั่ง (ไม่เดา) · enforce_menu_gate ใหม่: สินค้าผูกวันต้องตรงวัน/รอบ, สินค้าทั่วไปผ่าน
  - **C3 archive วันเมนูที่ผ่านรอบจัดส่ง:** pickNextScheduleDates กรอง d < today (ไม่โชว์ลูกค้า) + isMenuDateArchived + ป้าย "📦 จัดเก็บแล้ว" ใน week strip แอดมิน (วนใช้รอบถัดไปได้)
  - **ยุบรวมระลอก 2:** MenuHub (เมนู/สินค้า + ตารางเมนูรอบพิเศษ, /admin/products) + OrgHub (องค์กร/ร้านค้า + แบรนด์, /admin/tenants) · เส้นทางเก่า /admin/menu-schedule → ?tab=schedule, /admin/brands → ?tab=brands (bookmark ไม่ตาย)
  - **Gates:** vitest 1344/1344 (130 ไฟล์, preOrderUnification 10 ข้อใหม่) + tsc + lint + brandNameGuard + secret scan · contract 141 (G1–G5b) ใน CI + production
- **เทสที่เปลี่ยนสัญญา (ตั้งใจ):** menuSchedule (PRE_ORDER eligibility + gate), menuScheduleGate (off-menu → created), canonicalOrderFlow (PRE_ORDER accepts) — ตามสัญญา migration 141 C1/C2

## ⚡ TASK: R5-PRE-ORDER-SEPARATION-2026-10-23
1. ✅ client (bmbMenuSchedule/productSchedule/CheckoutPage ล็อกวัน) + server (migration 141) + mock mirror
2. ✅ archive วันเมนูผ่านรอบ + Hub ระลอก 2 + nav/redirect
3. ✅ เทสเขียวหมด → commit/push → apply 141 production → contract 141 production → record
4. ⏳ รอ Admin ทดสอบโปรดักชั่นตาม checklist (docs/BMB_R5_PRE_ORDER_SEPARATION_2026-10-23.md)


## 🩺 REALITY CHECK (2026-10-23 รอบ 6 · Directive R3)
- **ทำรอบนี้:** Phase 0–10 ครบตามลำดับ — ปิด D-05 (round audit+guards), D-04 (coupon hydration race), D-07 (focus refresh rider/admin/rounds), D-06 (map env ครบ+verify wiring), **backup restore drill = RUNTIME VERIFIED จริง** (integrity + restore ลง scratch PG17 · แก้บั๊ก drill 4 จุดที่ทำให้ไม่เคยผ่านจริง) · เพิ่ม daily restore drill ใน `daily-backup.yml`
- **สอบสวน D-05:** evening rounds 23–25 = ถูก toggle วันนี้ 13:42–13:43 UTC (เซสชันแอดมินผ่าน UI, ~2-3 วิ/รอบ) · **ก่อนหน้านี้ไม่มี audit trail ของรอบเลย** → ระบุผู้ปิดวันที่ 10-22 ไม่ได้ (ไม่เดา) · audit ถูกเพิ่มแล้วตั้งแต่รอบนี้
- **Verification รอบนี้:** vitest **1331/1331** (129 ไฟล์) · tsc=0 · lint=0 · drill PASS · probes RO ครบ (`e2e/artifacts/r4-probe-*.json`) · flaky ขนาน `orderTimeline` 3 ตัว = ผ่านเดี่ยว+ผ่านรอบซ้ำ (ไม่ใช่ regression — รายงานตามจริง)
- **Data repair 841/205:** PROPOSED เท่านั้น (แผน reversible ใน closure doc §5) — **ยังไม่แตะข้อมูล** จน Owner อนุมัติ
- **กติกาคงเดิม:** ห้าม DONE ก่อน Owner test ผ่าน · ห้ามเงียบ error · ไม่ใช้ realtime · เขียนทับเอกสารสถานะเสมอ

---

## ⚡ TASK: R3-WHOLE-PROJECT-CLOSURE-2026-10-23
- **STATUS: 🟡 ENGINEERING CLOSURE READY FOR OWNER ACCEPTANCE = YES (แต่ยังไม่ DONE/accepted)**
- **Completed:** ดู REALITY CHECK + `docs/BMB_R3_ENGINEERING_CLOSURE_2026-10-23.md` §3
- **Verified:** §6/§11 ของเอกสาร closure (vitest 1331 · tsc 0 · lint 0 · restore drill PASS · production probes)
- **Failed:** ไม่มีค้าง (flaky ขนาน 2 ไฟล์ `orderTimeline`/`homeSectionModeCta` = ผ่านเมื่อรันซ้ำ — รายงาน ไม่ซ่อน)
- **Blocked:** Owner test A–Q · §7 3 ข้อ (กติการอบ/capacity/repair approval) · Google key restriction (Owner)
- **Files Changed (รอบนี้):** `src/lib/bmbAdminApi_rounds.ts` · `src/pages/admin/AdminRounds.tsx` · `src/pages/admin/AdminOrders.tsx` · `src/pages/RiderPwaPage.tsx` · `src/components/CouponBox.tsx` · `scripts/dbRestoreDrill.mjs` · `.github/workflows/daily-backup.yml` · `src/__tests__/couponHydrationRace.test.ts` · `src/__tests__/roundsAuditGuards.test.ts` · `e2e/r4BaselineProbe.cjs` · `docs/BMB_R3_ENGINEERING_CLOSURE_2026-10-23.md` · `AI_WORK_STATE.md`
- **Tests/Commands:** vitest 1331/1331 · tsc 0 · eslint 0 · `node scripts/dbRestoreDrill.mjs [--psql]` PASS · `node e2e/r4BaselineProbe.cjs {baseline,money,rounds,ops,investigate}`
- **Known Risks:** backup 05:16 ยังไม่รวม mig 138/139 (recovery ต้อง re-apply จนถึง backup รอบถัดไป) · storage objects ไม่อยู่ใน dump · กำไรสุทธิ = unsupported metric
- **Next Exact Action (แชทถัดไป):** (1) รับผล Owner test A–Q (2) ถ้าอนุมัติ repair 841/205 → ทำตามแผน §5 พร้อม evidence (3) ถ้ามี FAIL → forward-fix ตาม §13 (4) ทำ auto-close rounds ตามนโยบายที่ Owner เลือกใน §7

---

## 🩺 REALITY CHECK (2026-10-23 รอบ 5) — ลงมือปิดงานจริงตามแผน R2.2 §2–§3

- **รอบ 4 (ก่อนหน้า):** root-cause matrix D-01…D-08 + แผน P0–P3 + Test A–E (เอกสาร) — รอบ 5 คือการลงมือ
- **P0-1 (D-08) — IMPLEMENTED + DEPLOYED (DB) + CONNECTED (client, รอ push):**
  - migration `138_payment_intents_read_authority.sql` — **apply ขึ้น production แล้ว** (Management API, 2026-10-23 13:15 UTC, Owner approve "ถ้าผ่านจริง"): `get_payment_intents_for_orders` (SECURITY DEFINER read RPC — ทาง A ตามที่ Owner เลือก) + server-side dedupe ใน `create_payment_intent_record` + partial unique index `uq_payment_intents_active_order_method` (precheck ยืนยัน ACTIVE ซ้ำ = 0 ก่อน apply) + `confirm_offline_payment` เลือกแถวก่อน 'processing' + restore audit (`payment_processed` ที่ 129 ทำหลุด)
  - client: `paymentGateway.getPaymentIntents/confirmPayment` → RPC เท่านั้น · **read failure = throw `ERR_PAYMENT_INTENTS_READ` (ไม่เงียบคืน [] อีก)** · `AdminOrders` มี banner · `PaymentConfirmationPage`/`OrderTrackPage`/`bmbAdminApi_orders` (refund provider lookup) รายงาน error ครบ
  - ตาราง `payment_intents` ยัง REVOKE'd (canonical 034 คงเดิม — probe ยืนยัน `auth_select=false`)
- **P0-2 (D-02) — IMPLEMENTED + DEPLOYED (DB) + CONNECTED (client, รอ push):**
  - migration `139_pod_policies_trusted_helper.sql` — **apply ขึ้น production แล้ว**: helper `current_driver_id()` + `pod_path_is_driver()` (SECURITY DEFINER — ไม่มี scalar subquery ใน policy อีก บทเรียน 119/132) + policy ใหม่ 4 ตัว (verify: `pod_path_is_driver(name)` ทุกตัว) · ทน %20 encoding (drivers.id มี space) · ไม่ rename id ใน production
  - client: `driverService.uploadPodPhoto` normalize/validate path · `RiderPwaPage` **แยกปุ่ม ถ่ายรูป (กล้อง) / เลือกรูปจากเครื่อง (แกลเลอรี่)** + progress รายขั้นตอน upload→attach→ปิดงาน + retry (ยกเว้น state error)
- **Verification ที่รันจริงรอบนี้ (ทั้งหมดเขียว):** vitest **1325/1325** (1317 เดิม + 8 ใหม่) · `tsc --noEmit`=0 · `eslint`+brandNameGuard=0 · **SQL replay 001→139 บน PG16 ephemeral (docker) = ALL CLEAN** · `e2e/contracts_138_139.sql` **G1–G7 ผ่าน** (scope/dedupe/confirm-pick/policy-no-subquery/storage INSERT จริงด้วย driver id มี space ทั้ง raw + %20) · regression `contracts_132`+`contracts_133` ผ่าน
- **Production evidence:** `e2e/artifacts/prod-{precheck,apply,verify,record}-138-139.json` (precheck: history=137 ก่อน · ACTIVE dupes=0 · pod-objects=0 · verify: funcs prosecdef ครบ · grants auth+service_role · policies ใช้ helper · history บันทึก 138/139 แล้ว)
- **กติกาคงเดิม:** ห้ามเรียก "DONE" จน Owner ทดสอบจริงผ่าน (Test A–E) · ห้าม mock ใน production path · ทุก read ห้ามเงียบ error · เอกสารสถานะเขียนทับเสมอ

---

## ⚡ TASK: R3-PRODUCTION-CLOSURE-2026-10-23 — Gate 0–1 + P1-3 ปิด (เหลือ Test A–E + P1-1/2/P2/P3)
- **STATUS: 🟡 P0 ปิดฝั่ง implement+deploy แล้ว · ยังไม่ RUNTIME VERIFIED (รอ Owner ทดสอบจริง)**
- **Completed (รอบนี้):** ตาม REALITY CHECK ข้างบน — migration 138/139 + client payment/POD chain + tests + contracts + CI step (`contract-tests.yml` เพิ่ม Contract 138-139) + apply/verify production
- **Verified:** ทุก gate ที่เครื่องพิสูจน์ได้ (unit/type/lint/replay/contract) + production object verify · **ยังไม่มี E2E จริงบนอุปกรณ์ = ยังไม่ผ่านเกณฑ์ปิดงาน**
- **Failed:** ไม่มี (flaky `homeSectionModeCta` ตอนรันขนาน — ผ่านเมื่อรันเดี่ยว/รันซ้ำ ไม่เกี่ยวกับโค้ดที่แก้)
- **Blocked:** Test A–E = Owner ต้องทดสอบจริง · P1-1 = รอคำตอบ "ใครปิดรอบ evening 23–25" · P3 = รอ Owner ตั้ง Cloudflare env
- **Files Changed (รอบนี้):** `supabase/migrations/138_payment_intents_read_authority.sql` · `139_pod_policies_trusted_helper.sql` · `e2e/contracts_138_139.sql` · `e2e/r3Apply138139.cjs` · `.github/workflows/contract-tests.yml` · `src/lib/paymentGateway.ts` · `src/lib/paymentExceptions.ts` · `src/lib/bmbAdminApi_orders.ts` · `src/lib/driverService.ts` · `src/pages/admin/AdminOrders.tsx` · `src/pages/PaymentConfirmationPage.tsx` · `src/pages/OrderTrackPage.tsx` · `src/pages/RiderPwaPage.tsx` · `src/__tests__/helpers/supabaseMock.ts` · `src/__tests__/paymentReadAuthority.test.ts`
- **Next Exact Action (แชทถัดไป):** (1) Owner ทดสอบ Test A–E บน biteme-baby.com + อุปกรณ์จริง (2) ถาม Owner 2 ข้อ: ใคร/ทำไมปิดรอบ evening 23–25 + กติกาเปิด/ปิดรอบ → ปิด P1-1 (3) ทำ P1-2 terminal-state gating + P2 คูปอง + P3 map fallback (4) data repair เสนอเฉพาะ: แถว intent ซ้ำคู่ 841/205 (processing+completed) — ห้ามลบ/merge จน Owner อนุมัติ

---

## 🩺 REALITY CHECK (2026-10-23 รอบ 4) — วิเคราะห์จากของจริง ไม่เขียนโค้ดซ่อม (ตามคำสั่ง Owner "แฮนออฟปิดเซสชั่นนี้แล้วไปปิดงานกันแชทหน้า")

- **รอบ 3 (ก่อนหน้า):** R1.2–R2.1 code+tests ครบ (commit `f1eaebd` = HEAD = origin/main · vitest 1317/1317 · tsc/lint/build=0) — แต่ยังไม่ผ่านการทดสอบจริง
- **รอบ 4 (รอบนี้): Owner ทดสอบจริงบน biteme-baby.com 13:56–14:23 (แอดมิน/ลูกค้า/ไรเดอร์ "พอล ไบท์ไดรฟ์") แล้ววงจรยังพัง** → root-cause trace ด้วยโค้ดจริง + read-only probes บนโปรดักชั่น (ไม่เขียนข้อมูลแม้แต่แถวเดียว) → สรุปเป็น **Root Cause Matrix D-01…D-08 + Priority Plan P0–P3 + แผนทดสอบ A–E** ที่ `docs/BMB_RECOVERY_PLAN_2026-10-23.md`
- **root cause ชี้ขาดที่เจอรอบนี้ (ยืนยันด้วย probe จริง):**
  - **D-08 (แอดมินตรวจสลิปไม่ได้):** `034:88 REVOKE ALL ON payment_intents FROM authenticated` ไม่มี GRANT คืน → `has_table_privilege=false` (probe) → ทุก `from('payment_intents')` เงียบ error คืน `[]` → แผงตรวจสลิปไม่เห็นหลักฐาน + ปุ่ม disabled ทุกแถว · แถม dedupe (R1.2) ตาบอด → **intent ซ้ำ 2 แถว/ออเดอร์ (841/205 — หลักฐานจริง)**
  - **D-02 (POD):** `pod_photos_driver_upload` ใช้ scalar subquery กับตาราง RLS (ชนิดที่ 119 เองบันทึกว่า "hidden by RLS and breaks WITH CHECK") → ทุก upload โดน "new row violates row-level security policy" — **pod-photos มี object 0 ชิ้นตลอดกาล** ขณะที่สลิป (เทียบ `auth.uid()` ตรง) ผ่าน · ซ้ำด้วย `drivers.id` มี space (position 5) + storage-js `encodeURIComponent` ทุก segment · `RiderPwaPage.tsx:772` `capture="environment"` = ปุ่มกล้องอย่างเดียว
  - **D-05 (ไม่มีรอบ):** evening rounds 23–25 ถูก `status='closed'` (2026-10-22 10:33–10:35, ไม่มี audit — ต้องถาม Owner) + morning/midday เลย cutoff ตอน 14:01 → "ไม่มีรอบที่เปิดรับ"
  - **D-06 (แผนที่):** key อ่านตอน build (`googleMaps.ts:10`) — build ที่ deploy ไม่มี `VITE_GOOGLE_MAPS_API_KEY` (Owner ต้องตั้งใน Cloudflare Pages env)
  - **D-01/D-07:** วงจร auto-close ใน DB มีแล้ว (132:495-570) แต่ UI ค้าง snapshot เก่า + งานล้มที่ D-02 → แอดมินต้องกด `admin_advance` ปิดเอง · **แอปไม่มี realtime (stub ทั้ง bundle) — ห้ามเสนอ realtime เป็นทางแก้**
- **กติกา (D-08 เดิม) ยังใช้:** ทุกอย่าง = **รอลงมือ/รอทดสอบจริง** — ห้ามเรียก "DONE" จน Owner ทดสอบจริงผ่าน · เอกสารสถานะเขียนทับเสมอ · ห้ามอ้างไฟล์ที่ไม่มีจริง

---

## ⚡ TASK: R2.2-ROOTCAUSE-HANDOFF-2026-10-23 — วิเคราะห์+วางแผน+แฮนออฟ (เอกสารเท่านั้น)
- **STATUS: 🟢 ฝั่งวิเคราะห์เสร็จสมบูรณ์ · งานแก้ไข = ของแชทถัดไป (ยังไม่ได้ลงมือ — ตามคำสั่ง)**
- **Objective:** root-cause จากอาการจริงของ Owner → Root Cause Matrix (ยืนยัน vs สมมติฐาน) → Priority/Dependency Plan → แฮนออฟปิดเซสชั่น
- **Completed (รอบนี้):**
  - trace โค้ดจริงทุกสายที่เกี่ยว: POD upload chain (`uploadPodPhoto`→`driver_attach_pod`→`driver_update_delivery_status`), payment read/write chain (`paymentGateway.ts`, `paymentExceptions.ts`, `SlipReviewPanel.tsx`, 008/034/129/133), coupon (`cartPersistence.ts`, `CouponBox.tsx`, `promotionClient.ts`, `cartStore.ts`), rounds (`bmbAdminApi_rounds.ts`, `deliveryRoundStatus.ts`, 024/028/088), map (`googleMaps.ts`), rider/admin UI (`RiderPwaPage.tsx`, `DeliveryManagement.tsx`, `CheckoutPage.tsx`)
  - **read-only production probes** (Management API — ไม่เขียนข้อมูล): grants ของ payment_intents (`has_table_privilege=false`), จำนวน object ใน pod-photos (**0**), payment_intents ของ 841/205 (**ใบละ 2 แถว**), drivers.id (**มี space**), delivery_rounds 23–25 (**evening ปิด**), `pg_proc.prosecdef` (RPC ทั้งสาย = definer), enum order_status
  - เขียน **Root Cause Matrix D-01…D-08 + P0–P3 + Test A–E + คำสั่งเริ่มงาน** ที่ `docs/BMB_RECOVERY_PLAN_2026-10-23.md` (ฉบับใหม่ เขียนทับ)
  - **เพิ่ม D-08 (แอดมินตรวจสลิปยังใช้ไม่ได้) ตามคำสั่ง Owner** — ยืนยัน root cause ด้วย probe แล้ว
- **Verified:** ข้อมูลทุกบรรทัดอ้างอิงไฟล์/บรรทัดจริงหรือ probe จริง · ไม่แตะโค้ด = เทสต์คงเดิม 1317/1317 (`f1eaebd`) · ไม่มี production write
- **Failed:** ไม่มี
- **Blocked:** การลงมือแก้ทั้งหมดอยู่ที่แชทถัดไป (ตามคำสั่ง "แฮนออฟปิดเซสชั่นนี้แล้วไปปิดงานกันแชทหน้า")
- **Files Changed (รอบนี้):** `docs/BMB_RECOVERY_PLAN_2026-10-23.md` (เขียนทับ — root cause matrix + plan) · `AI_WORK_STATE.md` (เขียนทับไฟล์นี้)
- **Next Exact Action (แชทถัดไป):** ถาม Owner 1 ข้อ (D-08 ทาง A: read RPC / ทาง B: GRANT — แนะนำ A) แล้วเริ่มเขียน migration `pod_photos_driver_upload` ใหม่ + read path ของ payment_intents ตาม `docs/BMB_RECOVERY_PLAN_2026-10-23.md` §2 บรรทัด P0-1/P0-2 
