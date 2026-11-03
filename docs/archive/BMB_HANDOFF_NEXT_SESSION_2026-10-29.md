# Bite Me Baby — HANDOFF + SESSION CLOSURE (ปิดเซสชัน 2026-10-29 · R19)

> ฉบับนี้ = **รายงานปิดงานเซสชัน 2026-10-29 + แฮนด์ออฟส่งต่อแชทหน้า** (ต่อจาก `docs/BMB_HANDOFF_NEXT_SESSION_2026-10-28.md`)
> canonical state = `AI_WORK_STATE.md` + `docs/BMB_MASTER_STATUS.md` (ขัดกันให้ถือ 2 ไฟล์นั้น + โค้ดจริง)
> **QA review ฉบับเต็ม (3 เฟส · 5 หมวด · checklist พร้อมแนวทางแก้) = `docs/BMB_QA_REVIEW_2026-10-29.md`**

---

## §1. รายงานรอบนี้ (R19 · 2026-10-29)

| งาน | เนื้อหา | evidence |
|---|---|---|
| 🔧 **CI ซ่อม (2 จุด)** | **Contract Tests แดง 10 รัน (#188–#197) — จุดที่ 1 = migration 166 (R13)** ที่แทนที่ `pod_path_is_driver` ด้วย `driver_path_folder` แบบ strip อย่างเดียว **ไม่ decode `%XX`** → โฟลเดอร์ `drv-%20c139-60bc` เทียบ id จริงไม่ตรง → RLS บล็อก INSERT ใน **contract 138-139 G7** → **แก้ = `supabase/migrations/169_pod_path_percent_encoding.sql`** (ตัด run `%XX` ก่อน strip + ออก `pod_path_is_driver` ซ้ำ signature เดิม · GRANT คงเดิม · re-run ปลอดภัย) — **พิสูจน์แล้ว: run #198 ผ่าน step 138-139 + 146/147/149/153-156 ทั้งหมด** · **จุดที่ 2 (เจอใน #198) = contract 163 G4 `FAIL driver ไม่ถูกปล่อย: busy`** — G1-G3 ของ contract จงใจทิ้งงานค้างบนไรเดอร์คนเดียวกัน ใต้ rule **168** (delivered คืน available เฉพาะไม่มีงานค้าง = spec ใหม่ของ Owner R16) → driver=busy ถูกต้องแล้ว แต่ assertion เดิมเขียนก่อน 168 → **แก้ = ปิดงาน fixture ของ G1-G3 ก่อนขั้น delivered ใน `e2e/contracts_163_rider_step_sync.sql`** (superuser direct UPDATE + คอมเมนต์อธิบาย · arm busy ของ 168 มีหลักฐาน prod = `e2e/r16Apply168-result.json`) · รอบเขียวล่าสุดก่อนแดง = #187 (R12c `2e7af35`) · **CI workflow (#624) = success ✓** | GitHub Actions (annotations run #197/#198) · `supabase/migrations/169_*.sql` · `e2e/contracts_163_rider_step_sync.sql` |
| 📝 **Copy หน้าเช็คเอาท์ (ตามคำสั่ง Owner)** | 7 จุดใน `CheckoutPage.tsx`: (1) แถบ same-day → `🛵 สั่งวันนี้ = จัดส่งทันที ระบบเลือกไรเดอร์ให้อัตโนมัติ` (ตัดท้าย `— เซิร์ฟเวอร์ตรวจ cutoff…`) (2) การ์ด rounds → `จัดส่งทันที — ระบบเลือกรอบจัดส่งให้อัตโนมัติ` + `รอบที่ระบบเลือก: จัดส่งทันที` (ตัด `· ส่ง … · เหลือ … ที่` + ตัดบรรทัด "ออเดอร์วันนี้ส่งทันทีตามรอบ…") (3) ป้ายเมนูรอบพิเศษ → เหลือ `📅 วันที่ {วัน} มีเมนูรอบพิเศษ ({n} รายการ)` (ตัด `— เมนูเหล่านี้ถูกผูกวัน/รอบ…ERR_PRODUCT_NOT_ON_MENU…`) (4) ค่าส่ง → ตัด `(ลูกค้าไม่ส่งค่าส่งเอง)` (5) PromptPay → `PromptPay (สแกน QR ของร้าน)` + `…แอดมินตรวจสอบและยืนยันการชำระเงิน` (ตัด `→ โอนเอง`/`ให้`) (6) บัตร → `บัตรเครดิต/เดบิต` + `ปลอดภัยผ่าน 3D Secure — ตัดเงินหลังจากยืนยันสั่งซื้อ` (7) เงินสด → `เงินสดปลายทางตอนรับของ` — **คงไว้:** หัวข้อ `(Same-day)`/`(Pre-order)` · ป้าย `วันจัดส่ง` + บรรทัด `(ปฏิทินเมนู): …` · วงเล็บ `(2 ชม.)` ยังอ่านจาก `cutoffHours` (ค่าจริงตอนนี้ = 2) · ไม่มี test ตัวไหน assert ข้อความที่แก้ (probe ยืนยัน) | `src/pages/CheckoutPage.tsx` (7 edits · verify แล้ว) |
| 🔎 **Senior QA / Code Review ทั้งโปรเจกต์** | 3 เฟส (Auth/RLS · Core logic · UI/UX) + 4 หมวด (User flows · Error handling · React perf · PWA) + Edge Functions/CORS — จุดแดง probe จริง: `alert 0 · console.log 0 · dangerouslySetInnerHTML 0 · setInterval/clearInterval ผูกคู่ครบ · EF CORS 19/19 (ที่ไม่มี = 2 webhook server-side)` · **ข้อค้นพบสำคัญ = ไม่มี `onAuthStateChange` listener ใน src (0 จุด) → งาน N3** | **`docs/BMB_QA_REVIEW_2026-10-29.md`** |
| 🧪 Gates ท้องถิ่น | tsc exit 0 · eslint + brandNameGuard (449 ไฟล์) + languageSanity (1257) OK · **vitest ทั้งชุด = 162 files / 1,671 tests / 0 fail (exit 0)** · **vite build exit 0** | `e2e/gates_r19_vitest.log` (VITEST_EXIT=0) · `e2e/gates_r19_build.log` (BUILD_EXIT=0) |

**Production state:** ledger top = **168** (migrations 163–168 APPLIED) · **169 = มีใน repo แล้วแต่ยัง NOT APPLIED บน production** (ดู §3) · Pages = auto-deploy จาก main · git HEAD ให้ตรวจจริงด้วย `git log --oneline -1` เสมอ · ✅ **CI รอบ R19 = ทั้ง 3 workflows เขียวบน `e8831c2`: Contract Tests #200 success (ทุก step รวม legacy 7) · CI #626 success · Cloudflare Pages = Deployed successfully** (ประวัติ: #198 = ผ่าน 138-139 / แดงที่ 163 · #199 = แดงที่ trigger state-spine · ดู §9.0 แถว 42-44)

---

## §2. บทเรียน CI รอบนี้ (ห้ามลืม)

1. **Contract Tests คือ gate เดียวที่จับ regression พวก path/RLS** — vitest ท้องถิ่นเขียวไม่ได้หมายความ SQL ถูก (R13 เขียน "gates ✓" แต่ #188 แดง) → **ทุกรอบที่แตะ migration/policy ต้องดู Contract Tests จนจบ**
2. ประวัติ: #187 success (R12c) → **#188 failure (R13/166) → #189–#197 failure ตลอด** → แก้ด้วย 169 (รอบนี้)
3. `driver_path_folder` ต้อง **"ตัด %XX ก่อน ค่อย strip"** — strip อย่างเดียว = `%20` → `20` หลุดเข้ามาเทียบ (ต้นตอพัง)
4. กติกาเดิมยังใช้: ห้ามแก้ contract ให้เข้าโค้ด — แก้ได้เฉพาะตอน **spec เปลี่ยนโดย Owner แล้วระบุใน migration ใหม่กว่า** (กรณีนี้: contract 163 เขียน 2026-10-27 ก่อน rule 168 ของ R16 2026-10-28 → แก้ fixture ให้สอดคล้อง rule ใหม่ = ถูกต้อง · contract 138-139 G7 = spec คงเดิม ห้ามแตะ → แก้ที่ migration 169 ฝั่งเดียว)

---

## §3. งานที่ต้องทำต่อ (เรียงลำดับความสำคัญ)

1. **✅ CI ทั้ง 3 workflows เขียวบน `e8831c2` แล้ว (Contract #200 · CI #626 · Pages deploy ✓) — §9.0 แถว 42-44 กรอกครบ** · งานที่เหลือของข้อนี้ = แค่รัน push docs รอบปิดเซสชันแล้วดูเลขรันใหม่ (ถ้ามี)
2. **🆕 ตัดสินใจ apply migration 169 บน production** ( Owner pattern: สั่ง `__apply 169__`) — ตอนนี้ ledger = 168 · ผลกระทบถ้าไม่ apply = production ยังใช้ `driver_path_folder` เวอร์ชันไม่ decode `%XX` (ลูกค้าปัจจุบันไม่กระทบเพราะ client สร้างโฟลเดอร์ sanitized แล้ว — แต่ path แบบ legacy %20 จะยังถูกบล็อก) · ถ้า apply = ใช้สคริปต์แบบ `e2e/r*Apply*.cjs` เดิม + evidence JSON
3. **N1 (ค้างเดิม สั่งจาก 4-2):** แถบสถานะ — ให้แอดมินแก้ copy เองได้ (key ใน `business_settings`) แต่คง 🔥/🟢🔴 ไฟสถานะอัตโนมัติ (sameDayOpen/preOrderOpen ห้าม override)
4. **N2 (ค้างเดิม ต่อ 2-8):** `docs/BMB_BACKEND_AI_PART_1.md` ปรับปรุงตามที่ Owner รอ
5. **🆕 N3 (P1 · พบจาก QA review):** เพิ่ม `onAuthStateChange` listener กลาง (authStore/main.tsx) — `SIGNED_OUT` → clear + redirect `/login` เก็บ `from` · `TOKEN_REFRESHED` → `refreshRole()` · `USER_UPDATED` → re-map customer (รายละเอียด `docs/BMB_QA_REVIEW_2026-10-29.md` ข้อ 1.6)
6. **🆕 P1:** จำกัด Google Maps API key ด้วย HTTP referrer ใน Google Cloud (key อยู่ฝั่ง client — QA 5.4)
7. cosmetic (ค้างเดิม): รวม `to_char` id ~40 จุด · รวม haversine 2 ฉบับ · รวม `confirmOfflinePayment` wrappers · `PromotionsPage:124` location.reload → refetch
8. external providers (Grab/Lineman/Foodpanda) = รอ Owner ตัดสินใจ credentials หรือปิด module
9. ของค้างเดิม: **B2** (~11:00) · **C7/C8 ขั้นรัน** · L-11 (LED) รอนิยาม · Backend+AI รอเทียบต้นฉบับ

---

## §4. รายการทดสอบทั้งหมด (ส่งให้แชทหน้า)

**เริ่มจาก `docs/BMB_MASTER_TEST_CHECKLIST_2026-10-28.md`** — hard reload ก่อนเสมอ · `biteme-baby.com` เท่านั้น

### A. retest ที่ Owner ยังไม่ได้รายงาน (ค้างจาก 2026-10-28 — ยังเท่าเดิม)
- **1I ทั้ง 6 ข้อ** (R16: strip เท่า+สีรายสาย · หาคำ "คัทออฟ" = เจอ "ปิดรอบ" เท่านั้น · การ์ดเส้นทาง+ปุ่มนำทาง · แผนที่ 1..N+polyline · multi-job 2 งาน · งานไม่มีพิกัด)
- 2-1/2-2/2-4/2-5/2-6/2-7 · 3-3 (รูปที่อยู่) · 3-4 (ปฏิเสธสลิป) · 3-5 (แบนเนอร์) · 3-9 (ลบออเดอร์ทดสอบ)
- 4-3 (C7) · 4-4 (C8) · 4-5 (RL-DEFECT) — **มีหน้าต่างเวลา**
- Part 5 = settings-sync 14 คีย์ · Part 6 = role guide · 7-1/7-2/7-3/7-5/7-6 · Part 8 · Part 9 (เกณฑ์ปิด)
- **แถบสถานะ stripe 2 (R18 copy ใหม่):** ต้องขึ้น `🟢 เปิดรับ พรีออเดอร์ : จองล่วงหน้า รอบ <ชื่อรอบ> <วันที่> (ปิดรอบ HH:MM)` — ห้ามแบบเดิม `พรีออเดอร์: เปิดรับออเดอร์ รอบส่งถัดไป …`

### B. ทดสอบสิ่งที่แก้/เพิ่มรอบนี้ (R19)
- **หน้าเช็คเอาท์ copy ใหม่ 7 จุด** (ไล่ตาม §1 — สำคัญสุด = ป้ายการ์ด `รอบที่ระบบเลือก: จัดส่งทันที` ไม่มี `· ส่ง … · เหลือ …` แล้ว · PromptPay ไม่มี `→ โอนเอง` · บัตรไม่มี `(Stripe)` และขึ้น `3D Secure` · เงินสด = `เงินสดปลายทางตอนรับของ`)
- หัวข้อ/ป้ายที่ **คงเดิม** ต้องยังอยู่: `🔥 สั่งซื้อวันนี้ (Same-day)` · `📅 สั่งซื้อแบบจองล่วงหน้า (Pre-order)` · `📅 วันจัดส่ง (กำหนดโดยเมนูรอบพิเศษ)` + วันที่ + บรรทัด `(ปฏิทินเมนู): …`
- **CI ทั้ง 3 workflows เขียว** บน commit รอบนี้ ( Contract Tests ผ่าน step 138-139 ที่เคยล้ม)
- ตะกร้า/หน้าโหวตที่สินค้าไม่มีรูป → เห็น `placeholder.svg` แบรนด์ (R17)
- หน้าเมนู console ไม่มี `[Log#same-day]`/`[Log#pre-order]` (R17)
- **QA checklist ของ Owner (ใหม่):** empty state รายหน้า (Orders/Notifications/Admin) · responsive มือถือ/คีย์บอร์ด (หน้าเช็คเอาท์ + RiderPWA) — ดู `docs/BMB_QA_REVIEW_2026-10-29.md` ข้อ 3.5/4.4

### C. งานที่สั่งค้าง (ทำก่อนส่ง test รอบหน้า)
- N1 (แอดมินแก้ copy แถบสถานะ · คงไฟอัตโนมัติ) · N2 (Backend+AI Part 1) · N3 (onAuthStateChange · ใหม่จาก QA)

---

## §5. เกณฑ์ปิดงาน (ยังห้ามประกาศ "ปิดครบทุกลูป")

ยังขาด: **C7/C8 ขั้นรัน** · **B2 หลักฐาน** · **RL-DEFECT 4+1** · **Part 5/6/7 ส่วนที่ค้าง** · **test pack ทั้งหมดไม่มี FAIL ค้าง** · **CI ทุก workflow เขียวบน HEAD ใหม่** (ต้องตรวจหลัง push รอบนี้) → ยังห้ามพูด "ปิดครบทุกลูป / เหลือ Owner อย่างเดียว"

---

*จัดทำ 2026-10-29 (R19) · CI root cause = 166 %XX regression → 169 · QA review = docs/BMB_QA_REVIEW_2026-10-29.md · copy เช็คเอาท์ 7 จุด แก้แล้ว*