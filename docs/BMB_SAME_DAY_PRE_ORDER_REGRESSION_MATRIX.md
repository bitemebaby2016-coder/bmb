# BMB — REGRESSION MATRIX: SAME_DAY / PRE_ORDER

> **สร้าง:** 2026-10-13 (Phase 0) · **HEAD:** `4b4dc1486952b688cab20fefa9f3d2e89dfdbc7c`
> ใช้คู่กับ `BMB_SAME_DAY_PRE_ORDER_PHASE_CONTRACTS.md` — ทุก Phase ต้องผ่านแถวที่ตัวเองรับผิดชอบก่อนปิด · baseline: `npm test` รัน 2026-10-13 = 79 ไฟล์ / 860 tests ผ่าน (EV-002)
> ระดับหลักฐาน: **SOURCE** = อ่านโค้ด · **AUTO** = ผลรัน test · **PROD** = production/runtime (ยังไม่มีใน matrix นี้ทุกแถว)

**สถานะ:** `COVERED` = มี test แล้ว · `PARTIAL` = มีบางส่วน · `MISSING` = ยังไม่มี → phase ที่รับผิดชอบ

---

## 1. Invariants ฝั่ง server / order creation

| ID | Invariant | Existing tests (AUTO) | SOURCE รองรับ | สถานะ | Phase | Acceptance assertion |
|---|---|---|---|---|---|---|
| INV-01 | สินค้า SAME_DAY สั่งได้เฉพาะภายใต้เงื่อนไข SAME_DAY ที่ถูกต้อง | `canonicalOrderFlow.test.ts` server mode gate (L106-130) · `menuScheduleGate.test.ts` | `118…sql:132-135,153` | COVERED (mock) / **PROD ยังไม่มี** | 7 | mock + production parity มีหลักฐานแยกกัน |
| INV-02 | สินค้า PRE_ORDER สั่งได้เฉพาะภายใต้เงื่อนไข PRE_ORDER ที่ถูกต้อง | `canonicalOrderFlow.test.ts:106-130` | `118…sql:136-141,154` | COVERED (mock) / **PROD ยังไม่มี** | 7 | เหมือน INV-01 |
| INV-03 | สินค้า dual-mode ปฏิบัติตามกฎที่ชัดเจนสม่ำเสมอทุกผิว | ไม่มี test ข้ามผิว | `homeShowcase.ts:49-50` fallback | **MISSING** | **1, 5** | นิยาม rule เดียวใน matrix นี้ (ดู 3.1) + test ทุกผิว |
| INV-04 | โหมดที่เลือกห้ามเปลี่ยนเงียบ ๆ ระหว่างเลือกสินค้า → ตะกร้า → checkout → สร้างออเดอร์ (OD-4) | `cartIsolationStore.test.ts` (lock/pending) · `cartPersistence.test.ts:131-136` (คง lock) | `cartStore.ts:103-105` · **`CheckoutPage.tsx:56-57` deep-link ยังชนะ lock** | **PARTIAL — gap ที่ RC-3** | **2** | ทุก conflict path ต้องแจ้ง+ยืนยัน ไม่มี silent switch (test ครอบคลุม navigation/reload) |
| INV-05 | วันที่/รอบที่เลือกถูกต้องและสอดคล้องกันตลอดสาย | `menuScheduleGate.test.ts` · `canonicalOrderFlow` (round date/lead) | `118…sql:132-141` · `CheckoutPage:340-361` mirror | COVERED (mock) / **PROD ยังไม่มี** | 7 | E2E สองโหมดมีหลักฐาน |
| INV-06 | cutoff หมด · สินค้าไม่ว่าง · รอบเต็ม — ไม่สามารถ bypass ด้วย stale UI | `kitchenControl.test.ts` · `preOrderQueue.test.ts` (capacity/cutoff states) | `118…sql:130-143` | PARTIAL (client stale-state ไม่มี test) | 2 (client), 7 (PROD) | stale cart/URL ที่ submit แล้ว server reject มี test + ข้อความแจ้งผู้ใช้ |
| INV-07 | การสร้างออเดอร์ถูกบังคับโดย server — ซ่อนปุ่มอย่างเดียวไม่พอ | `canonicalOrderFlow.test.ts` (payload hygiene, mode gate) | `118…sql:150-154` | COVERED (mock) / **PROD ยังไม่มี** | 7 | production function parity อ่านค่าจริง |

## 2. Invariants ฝั่งหน้าร้าน (storefront)

| ID | Invariant | Existing tests | สถานะ | Phase | Acceptance assertion |
|---|---|---|---|---|---|
| INV-15 | สินค้าไม่มีสิทธิ์ทั้งสองโหมด **ไม่ถูกเสนอ**ในพื้นที่สั่งซื้อ (OD-3) | `homeShowcase.test.ts:71-80` (preOrder leak fix — เฉพาะ availability) | **MISSING** (โหมด) | **1** | `getHomeProducts`/`pickTopAvailable` ไม่คืนสินค้า `available_same_day=false & available_preorder=false` |
| INV-16 | การ์ดใน section ตามโหมดของ section (A1) — same-day ไม่มีปุ่มจองล่วงหน้า · preorder ไม่มีปุ่มสั่งเลย | ไม่มี | **MISSING** | **5** | test render `HomeProductCard`/`ShowcaseCard` ตาม prop `mode` |
| INV-17 | FoodTheater เสนอเฉพาะสินค้าที่มีสิทธิ์ตามโหมดที่ขาย (OD-5) | `theaterStage.test.ts` (14 tests — ไม่ครอบคลุม mode eligibility) | **MISSING** | **1** | picks ไม่มีสินค้าไร้สิทธิ์ · `add()` mode derive ตรง canonical rule |
| INV-18 | ทุกผิวใช้ canonical fallback สม่ำเสมอ (`available_* ?? alias`) | ไม่มี (RC-7) | **MISSING** | **6** | grep จุดแก้ + assertion |
| INV-19 | การแสดงสินค้าซ้ำข้าม section ไม่สร้าง cart item/order ซ้ำ (การแสดงซ้ำ ≠ ข้อมูลซ้ำ) | `cartPersistence.test.ts` (merge/quantity) · `cartIsolationStore` | COVERED (cart) · **dedupe UX = MISSING** | **5** (RC-4 ส่วน UX) | invariant ระดับ dedupe ตาม design ที่อนุมัติ (A2 = DEFERRED) |
| INV-20 | ห้ามลบ FoodTheater/sections อื่นด้วยเหตุ "จำนวนซ้ำ" เพียงอย่างเดียว | — | เงื่อนไขใน contract | 5 | checklist ก่อนลบอะไรก็ตาม (ตอนนี้ A2 deferred = ไม่ลบ) |

## 3. Invariants ฝั่งแอดมิน

| ID | Invariant | Existing tests | สถานะ | Phase | Acceptance assertion |
|---|---|---|---|---|---|
| INV-11 | `AdminOrders` mode filter เปลี่ยนผลลัพธ์จริง (page-level) | `adminOrdersOp.test.ts:79-83` (**API level**) · `ordersPaged.test.ts` · `preOrderQueue.test.ts:67` | **PARTIAL — page wiring MISSING (RC-1)** | **3** | page-level test ยืนยัน `filterMode` → `getOrdersPaged({orderMode})` ทั้ง 3 ค่า + pagination ถูก |
| INV-12 | bookmark `/admin/pre-orders` ยังใช้ได้และเห็นเฉพาะ PRE_ORDER หลังยุบ | ไม่มี (ไม่มี test ใดอ้าง `AdminPreOrders`) | **MISSING** | **4** | redirect + preset มี test · grep `AdminPreOrders` = 0 |
| INV-13 | nav set เดียว — `flatten(ADMIN_NAV_GROUPS) === ADMIN_NAV_ITEMS` | มี invariant test ใน `adminUi`/`adminShell` (ต้องคง) | COVERED | 4 (คงเดิม) | test เดิมผ่านหลังแก้ L15/L68 |
| INV-14 | `AdminKitchen` / `AdminMenuSchedule` / `AdminRounds` ยังแยกจากกัน | ไม่มี test เชิงโครงสร้าง | PARTIAL | 4 (checklist) | ไม่มีการแก้/ลบ 3 ไฟล์นี้ใน Phase 4 (ตรวจจาก diff) |
| INV-12b | การยกเลิกออเดอร์ใช้ canonical `cancelOrder` RPC เท่ากันทั้งสองหน้าเดิม | `adminOrdersOp.test.ts:175-182` | COVERED | 4 | cancel path ไม่เปลี่ยน |

## 4. Invariants ฝั่งครัว/จัดส่ง

| ID | Invariant | Existing tests | สถานะ | Phase |
|---|---|---|---|---|
| INV-08 | ครัว/จัดส่งจัดกลุ่ม SAME_DAY/PRE_ORDER ตรงกันทุกจุด | `kitchenControl.test.ts` · `preOrderQueue.test.ts` · `dispatchContract.test.ts:37` | COVERED (mock) / PROD ยังไม่มี | 7 |

---

## 3.1 นิยาม rule เดียวที่ทุก phase ต้องใช้ร่วมกัน (canonical eligibility)

- `sameDayEligible(p) = p.available_same_day ?? !p.is_preorder`
- `preorderEligible(p) = p.available_preorder ?? p.is_preorder`
- ไม่มีสิทธิ์ทั้งสอง = ไม่ offer (OD-3) · ห้ามสร้างนิยามใหม่ในไฟล์อื่นโดยไม่แก้ matrix นี้ก่อน

---

## บันทึกการแก้ matrix

- 2026-10-13 — สร้างฉบับแรก (Phase 0) — Owner approval "PHASE 0 DOCUMENTATION ONLY"
