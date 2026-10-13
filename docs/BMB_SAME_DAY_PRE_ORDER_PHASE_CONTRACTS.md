# BMB — PHASE CONTRACTS: SAME_DAY / PRE_ORDER

> **สร้าง:** 2026-10-13 (Phase 0) · **HEAD:** `4b4dc1486952b688cab20fefa9f3d2e89dfdbc7c`
> หน้าที่เอกสารนี้: กำหนดสัญญาของแต่ละ Phase — files, expected behavior, business rules, tests, acceptance criteria, risks, rollback — **ห้ามเริ่ม phase ใดโดยไม่ได้ approval และไม่มี gate ผ่าน**
> อ้างอิง: `BMB_SAME_DAY_PRE_ORDER_MASTER_PLAN.md` · `BMB_SAME_DAY_PRE_ORDER_REGRESSION_MATRIX.md` · `BMB_SAME_DAY_PRE_ORDER_EVIDENCE_LOG.md`

**สถานะ approval:** Phase 0 = DOCUMENTATION ONLY อนุมัติแล้ว · Phase 1-7 = **ยังไม่อนุมัติ implementation** (รอ Owner ตรวจเอกสารชุดนี้)

---

## PHASE 0 — Baseline & Documentation (APPROVED: documentation only)

- **Scope:** สร้างเอกสาร 4 ชิ้น + ปรับ `docs/BMB_ADMIN_CONSOLIDATION_HANDOFF.md` (overwrite รักษาสาระเดิม + ชี้มา Master Plan)
- **Files:** เอกสาร `docs/*.md` เท่านั้น — **ห้ามแตะ application code/tests/migrations/config**
- **Acceptance:** ไฟล์ครบ 4+1 · encoding ถูก (ไม่มี `U+FFFD`) · `git status` มีเฉพาะ untracked เดิม 13 ไฟล์ + เอกสารใหม่ที่ยังไม่ commit · ไม่มี commit/push
- **Rollback:** ลบเอกสารใหม่/คืนค่า handoff จาก git — ไม่มีผลกระทบระบบ

---

## PHASE 3 — AdminOrders filter wiring (RC-1) · ลำดับแรกตาม OD-7

- **Goal:** การเลือก filter โหมด (`all` / `SAME_DAY` / `PRE_ORDER`) เปลี่ยนผลลัพธ์หน้าเว็บ **จริง**
- **Files (คาดการณ์จาก source จริง):**
  - `src/pages/admin/AdminOrders.tsx` — `loadOrders` (L70-96) ต้องส่ง `orderMode: filterMode === 'all' ? undefined : filterMode` เข้า `getOrdersPaged`
  - `src/__tests__/` — เพิ่ม **page-level** regression test (ไม่ใช่แค่ API test)
  - ตรวจอย่างเดียว: `src/lib/bmbAdminApi_orders.ts:138-147` (รองรับแล้ว — **ไม่แก้**)
- **Business rules:** ไม่มี rule ใหม่ · permission/query semantics เดิม · group headers คงทำงานเฉพาะ `filterMode === 'PRE_ORDER'` (`AdminOrders.tsx:195`)
- **Expected behavior:** `PRE_ORDER` → list เฉพาะ `order_mode='PRE_ORDER'` · `SAME_DAY` → เฉพาะ SAME_DAY · `all` → ทั้งหมด · pagination (`PAGE_SIZE=25`) คงถูกต้อง · grouping + cancel ยังครบ
- **Tests:** (ก) page-level: mock `getOrdersPaged` แล้ว assert ได้ `orderMode` ที่ถูกต้องทั้ง 3 ค่า (ข) คง `adminOrdersOp.test.ts:79-83`, `ordersPaged.test.ts`, `preOrderQueue.test.ts` ผ่าน
- **Acceptance criteria:** เลือก `PRE_ORDER` แล้วจำนวนผลลัพธ์ ≠ `all` (เมื่อมีออเดอร์ทั้งสองโหมดใน test data) · gates 4 ตัว = 0 · CI success
- **Risks:** ถ้าส่ง `orderMode` ผิดชนิด → type error (กันด้วย tsc) · `total` count ต้องนับแบบ filtered (API ทำอยู่แล้ว)
- **Rollback:** `git revert` commit เดียว — ไม่มี schema/persistence ที่ต้องถอย
- **Approval:** Owner "PHASE 0 ACCEPTED → CONTROLLED EXECUTION" (2026-10-13) — **ดำเนินการแล้ว**: fix ที่ `AdminOrders.tsx:70-79` + `adminOrdersModeFilter.test.ts` (6 tests, พิสูจน์ regression แล้ว) · gates = 0 ทั้ง 4 (EV-014)

---

## PHASE 1 — Storefront eligibility (RC-2 · OD-3 · OD-5)

- **Goal:** สินค้าที่ไม่มีสิทธิ์ทั้งสองโหมด **ไม่ถูกเสนอ**ในพื้นที่สั่งซื้อ · แต่ละโหมดเสนอเฉพาะสินค้าที่มีสิทธิ์จริง
- **Files:**
  - `src/lib/homeProviders.ts` — `getHomeProducts` (L71-92): else-branch ต้องเช็ค `available_same_day ?? !is_preorder` ก่อนใส่ sameDay bucket
  - `src/lib/talkToBite.ts` — `pickTopAvailable`: ต้องรับ/ใช้ mode eligibility (ตาม OD-5)
  - `src/components/theater/FoodTheater.tsx` — `add`/`customize` (L159-189) สอดคล้อง eligibility
  - ตรวจ callers: `HomeProductCard.tsx`, `CategorySections.tsx`, `FoodMenuCard.tsx` (แก้เฉพาะถ้ามีหลักฐาน)
- **Business rules:** ใช้ canonical fields เดิมเท่านั้น (`available_same_day` / `available_preorder` + alias fallback `?? !is_preorder` / `?? is_preorder`) — **ห้ามสร้าง rule ใหม่** · server ไม่ถูกแก้
- **Expected behavior:** sameDay bucket/market ไม่มีสินค้า `available_same_day=false` · preOrder bucket ไม่มีสินค้า `available_preorder=false` · สินค้าไม่มีสิทธิ์ทั้งสองโหมด = ไม่แสดงในพื้นที่ offer (OD-3) · dual-mode แสดงได้ทั้งสองที่ (per rules เดิม)
- **Tests เพิ่ม:** (ก) `getHomeProducts` กัน `available_same_day=false` ออกจาก sameDay (ข) ไม่มีสิทธิ์ทั้งสอง → ไม่อยู่ใน bucket ใด (ค) `pickTopAvailable` mode eligibility (ง) คง `homeShowcase.test.ts`, `mediaFlow.test.ts:139` ผ่าน
- **Acceptance criteria:** matrix rows ของ Phase 1 ผ่านทั้งหมด · gates = 0 · ไม่มีการแก้ server/RPC
- **Risks:** ถ้า catalog ปัจจุบันมีสินค้า `available_same_day=false & available_preorder=false` ที่เคยโชว์ → จะหายไปจากหน้าแรก (**ตรง OD-3 แต่ต้องรายงานจำนวนที่หายในผลรายงาน**) · Theater picks อาจน้อยลง
- **Rollback:** `git revert` เดียว
- **Approval/ผล:** Owner "PHASE 0 ACCEPTED → CONTROLLED EXECUTION" (2026-10-13) — **ดำเนินการแล้ว**: canonical helpers + 4 จุดแก้ + `storefrontEligibility.test.ts` (8 tests) · proof ถอด fix = 3 fail · gates 0 ทั้ง 4 · 874/874 (EV-016) · caller survey: `handleReviewCta` gap แก้แล้ว · `MenuPage`/`FoodMenuCard`/`homeShowcase` canonical อยู่แล้ว

---

## PHASE 2 — Cart & checkout consistency (RC-3 · OD-4)

- **Goal:** ห้ามเปลี่ยนโหมดเงียบ ๆ — cart mode lock เป็นหลัก ต้องแจ้งและให้ลูกค้ายืนยัน
- **Files:**
  - `src/pages/HomePage.tsx` — `handlePreOrder` (L149-168): ต้องเช็ค `AddToCartResult` ก่อน `navigate('/checkout?mode=pre-order')` — ถ้า `'needs_confirmation'` ต้องไม่ navigate (ให้ modal `CartIsolationModal` ทำงานตามกลไกเดิม)
  - `src/pages/CheckoutPage.tsx` — L56-57: กำหนดกติกา conflict ให้ **lock ชนะ** และแจ้งผู้ใช้ (ตาม OD-4) — design detail ต้องยืนยันใน Phase Contract ย่อยก่อน implement
  - ตรวจ: `src/store/cartStore.ts`, `src/lib/cartPersistence.ts` (แก้เฉพาะถ้ามีหลักฐาน)
- **Business rules:** คงกลไก `pendingMode` + `confirmModeSwitch`/`cancelModeSwitch` เดิม · ห้ามทิ้งรายการโดยไม่แจ้ง · persistence backward compatible
- **Tests เพิ่ม:** (ก) `handlePreOrder` ไม่ navigate เมื่อคืน `needs_confirmation` (ข) `?mode=pre-order` + cart lock SAME_DAY → ไม่สร้างออเดอร์ PRE_ORDER เงียบ ๆ (ค) reload กลางทางคง mode (ง) คง `cartIsolationStore`, `cartPersistence`, `canonicalOrderFlow` ผ่าน
- **Acceptance criteria:** conflict path ทุกเส้นทางมีการแจ้ง+ยืนยัน · ไม่มี silent switch · gates = 0
- **HARD STOP:** ถ้า design ที่จะ implement ไม่ตรง OD-4 หรือกระทบ business rule → หยุดและถาม Owner ก่อน
- **Risks:** การเปลี่ยน behavior deep-link กระทบ link เก่าที่แชร์ไว้ (ต้องกันโดยให้ user ยืนยัน ไม่ใช่ block)
- **Rollback:** `git revert` เดียว
- **Approval/ผล:** Owner "PHASE 0 ACCEPTED → CONTROLLED EXECUTION" (2026-10-13) — **ดำเนินการแล้ว**: `handlePreOrder` guard + `handleSameDay` feedback + `CheckoutPage` lock-wins (L55-69) · tests 5 tests (page-level 2 ไฟล์) · proof 2 ทาง = fail เมื่อถอด · gates 0 ทั้ง 4 · 879/879 (EV-017) · design = OD-4 ตามตัวอักษร (lock ชนะ + แจ้ง) ไม่มี business rule ใหม่ → ไม่เข้า HARD STOP

---

## PHASE 4 — Admin consolidation (RC-6) · หลัง Phase 3 เท่านั้น

- **Goal:** `AdminPreOrders` (subset 100%) ยุบเข้า `AdminOrders` · bookmark ไม่ตาย · nav เดียว
- **Files:**
  - `src/pages/admin/AdminPreOrders.tsx` — **ลบ** เฉพาะเมื่อยืนยันไม่มี dependency (ค้น `src/**` + `e2e/**` ซ้ำอีกรอบก่อนลบ)
  - `src/App.tsx` — L39-42 (lazy import) · L238 (route) → เปลี่ยนเป็น redirect `/admin/pre-orders` → `/admin/orders` พร้อม preset `filterMode='PRE_ORDER'` (อ่านจาก searchParams)
  - `src/lib/adminUi.ts` — L15 (`ADMIN_NAV_ITEMS`) + L68 (`ADMIN_NAV_GROUPS`) — คง invariant `flatten(groups) === ADMIN_NAV_ITEMS` (มี test assert อยู่)
  - `src/pages/admin/AdminDashboard.tsx` — L14 quick link → อัปเดต/คงตาม preset ที่ออกแบบ
  - `src/pages/admin/AdminOrders.tsx` — เพิ่มอ่าน `searchParams` ตั้ง `filterMode` เริ่มต้น (เสริมจาก Phase 3)
- **Business rules:** การ query/filter/cancel/permission คงเดิมทั้งหมด (canonical `cancelOrder` RPC) · **ห้ามแตะ** `AdminKitchen` / `AdminMenuSchedule` / `AdminRounds`
- **ข้อความไทย:** แก้เฉพาะไฟล์ใน scope ที่อนุมัติ (จุดพังใน `AdminPreOrders` จะหายไปพร้อมการลบไฟล์)
- **Tests:** (ก) route redirect test (ข) preset filter จาก URL (ค) nav invariant คงเดิม (ง) ตรวจ grep = 0 reference `AdminPreOrders`
- **Acceptance criteria:** bookmark `/admin/pre-orders` เปิดแล้วเห็นเฉพาะ PRE_ORDER จริง (พิสูจน์ด้วย test data) · gates = 0 · CI success
- **Risks:** nav invariant test ตกถ้าลบรายการผิดจุด · redirect เสีย preset ถ้าไม่แก้ `AdminOrders` ให้อ่าน URL
- **Rollback:** `git revert` — คืนไฟล์ `AdminPreOrders.tsx` + route เดิมได้ทันที
- **Approval:** ~~**BLOCKED** — รอ Phase 3 มีหลักฐานผ่าน~~ → **ดำเนินการแล้ว** (2026-10-13, Phase 3 evidence = `4cb22eb`/CI#411 ✓): ลบ `AdminPreOrders.tsx` + redirect + nav ลบ 2 จุด + preset · tests 7 tests · grep = 0 · gates 0 ทั้ง 4 · 886/886 (EV-018)

---

## PHASE 5 — Homepage UX: A1 + duplication (RC-4 / RC-5 · OD-1 · OD-2)

- **Goal:** การ์ดตรงโหมดตาม section (A1) · ลดสินค้าซ้ำโดยไม่ตั้งใจ (RC-4) · ยืนยัน RC-5 บน production build ก่อนแก้
- **Files:**
  - `src/pages/HomePage.tsx` — L181-186 (ส่ง `mode` ต่างกันตาม section) · L271-297 · search/chips L107-116, L241-265
  - `src/components/home/HomeProductCard.tsx` — เพิ่ม prop `mode?: 'same_day' | 'pre_order' | 'auto'` (ตาม handoff งาน A)
  - `src/components/home/CategorySections.tsx` — `ShowcaseCard` mode-aware
  - **ห้ามแก้** `src/lib/homeShowcase.ts` นอกจากมีหลักฐาน (pure mirror ใช้ที่เดียว)
- **Precondition (OD-2):** ตรวจ `biteme-baby.com` + ยืนยัน deployed build identity (เช่น ดู commit hash ในหน้า build/headers) **ก่อน** สรุปว่า RC-5 เป็น defect จริง
- **Business rules (A1):** `mode='same_day'` → ปุ่มสั่งเลยเท่านั้น · `mode='pre_order'` → ปุ่มจองล่วงหน้าเท่านั้น · `mode='auto'` → ตัดสินจาก `available_preorder ?? is_preorder` + `available_same_day ?? !is_preorder` (OD-3: ไม่มีสิทธิ์ทั้งสอง = ไม่ offer)
- **A2 = DEFERRED** (OD-1) — ห้ามลบ Sections 3-4 / CategorySections / FoodTheater ใน phase นี้
- **Tests เพิ่ม:** (ก) การ์ด section same-day ไม่มีปุ่ม preorder (ข) section preorder ไม่มีปุ่มสั่งเลย (ค) dedupe invariant ระดับที่กำหนด (ง) คง `categorySections.test.ts`, `homeShowcase.test.ts`
- **Acceptance criteria:** matrix rows ของ Phase 5 ผ่าน · RC-5 มีคำตัดสินพร้อม evidence (confirmed/found elsewhere/not a defect) · gates = 0
- **Risks:** `FoodTheater` แตะร่วมกับ Phase 1 → ต้องทำหลัง Phase 1 เท่านั้น · SEO copy ของ section headings ห้ามลบมั่ว (A2 deferred)
- **Rollback:** `git revert` เดียว

---

## PHASE 6 — Canonical field audit (RC-7)

- **Goal:** จุดที่ใช้ `is_preorder` ตรง ๆ ให้ใช้ canonical fallback สม่ำเสมอ เฉพาะที่พิสูจน์ว่ามีความเสี่ยง
- **Files:** `src/pages/MenuPage.tsx` L169 (เทียบ L46-47) · ตรวจจุดอื่นด้วย grep `is_preorder` ก่อนแก้
- **Business rules:** **ห้ามลบ** `is_preorder` / ห้ามทำ migration เพื่อความสะอาด — mirror semantics (`types/index.ts:28-30`) ต้องคงไว้
- **Tests:** assertion เฉพาะจุดที่แก้ · คงเดิมทั้งหมด
- **Acceptance:** fallback pattern สม่ำเสมอในจุดที่แก้ · gates = 0
- **Rollback:** `git revert` เดียว

---

## PHASE 7 — End-to-end & production closure

- **Goal:** พิสูจน์ระบบ SAME_DAY/PRE_ORDER ตั้งแต่หน้าร้านถึงครัว ด้วย evidence 3 ชั้น
- **กิจกรรม (อ่านเป็นหลัก):**
  1. เทียบ production schema/function (`create_order_with_items`, `trg_menu_gate`) กับ migration ล่าสุด (`118`, `039`) — **read-only**
  2. E2E SAME_DAY + PRE_ORDER ด้วย test data ที่ควบคุมได้ (ไม่มีลูกค้าจริง ไม่มีเงินจริง)
  3. บันทึก evidence ลง `EVIDENCE_LOG` แยก `AUTOMATED TEST` / `LOCAL INTEGRATION` / `PRODUCTION-RUNTIME`
- **Hard stops:** ห้าม production mutation · ห้ามใช้เงินจริง · ห้ามใช้ข้อมูลลูกค้าจริง · ทุกอย่างต้องมี Owner authorization
- **Acceptance (declaration เท่านั้นเมื่อครบ):** production parity มีหลักฐาน · E2E สองโหมดมีหลักฐาน · ไม่มี regression · **ห้ามปิด closure หากยังไม่มี deployment + runtime evidence**
- **Rollback:** ไม่มีการแก้ระบบใน phase นี้ (อ่านอย่างเดียว) — ถ้าพบ mismatch → HARD STOP + คำถามถึง Owner

---

**บันทึกเวอร์ชัน contract:** ทุกครั้งที่แก้ contract หลัง approval ให้เพิ่มบรรทัด "ปรับปรุง: วันที่ — เหตุผล — อนุมัติโดย Owner" ท้ายไฟล์นี้

- 2026-10-13 — สร้างฉบับแรก (Phase 0) — โดย Owner approval "PHASE 0 DOCUMENTATION ONLY"
- 2026-10-13 — Phase 3 ดำเนินการเสร็จตาม Owner authorization (อนุมัติเขียน) — เหตุผล: Owner สั่ง "เริ่มจาก Documentation Commit → Git/CI Verification → Phase 3" — ผล: EV-014, INV-11 = COVERED
- 2026-10-13 — Phase 1 ดำเนินการเสร็จตาม Owner authorization (ลำดับต่อจาก Phase 3 ตาม OD-7) — ผล: EV-016, INV-15/INV-17 = COVERED
- 2026-10-13 — Phase 2 ดำเนินการเสร็จตาม Owner authorization (ลำดับต่อจาก Phase 1 ตาม OD-7) — ผล: EV-017, INV-04 = COVERED · design ตาม OD-4 ตรงตัวอักษร (ไม่เข้า HARD STOP)
- 2026-10-13 — Phase 4 ดำเนินการเสร็จ (ปลดบล็อกด้วย Phase 3 evidence `4cb22eb`) — ผล: EV-018, INV-12 = COVERED · grep AdminPreOrders = 0

