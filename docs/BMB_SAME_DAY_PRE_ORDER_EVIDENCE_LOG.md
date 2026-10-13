# BMB — EVIDENCE LOG: SAME_DAY / PRE_ORDER

> **สร้าง:** 2026-10-13 (Phase 0) · **HEAD:** `4b4dc1486952b688cab20fefa9f3d2e89dfdbc7c` = `origin/main`
> กฎ: ทุก entry ต้องระบุ `tier` = `SOURCE` | `AUTOMATED TEST` | `PRODUCTION-RUNTIME` · **ห้ามปิด phase ด้วย evidence ชั้นต่ำกว่าที่ contract กำหนด** · ห้ามลบ entry เก่า ให้เพิ่ม new entry ทับเมื่อมีข้อมูลใหม่ (ระบุ `supersedes`)

---

## 1. Baseline entries (Phase 0 — READ ONLY)

| ID | วันที่ | Tier | ข้อเท็จจริง | Reference | สถานะ |
|---|---|---|---|---|---|
| EV-001 | 2026-10-13 | SOURCE | `HEAD = 4b4dc1486952b688cab20fefa9f3d2e89dfdbc7c` = `origin/main` · branch `main` · staged 0 · untracked 13 ไฟล์ (`e2e/screenshots/*.png` 10 + webp 3) · stash `local-edits-before-sync-2026-09-21` ไม่ถูกแตะ | `git log/status/rev-parse` รันจริง | DOCUMENTED |
| EV-002 | 2026-10-13 | AUTOMATED TEST | `npm test` → **79 ไฟล์ / 860 tests ผ่านทั้งหมด** (duration ~48s) | vitest run จริงใน workspace นี้ | DOCUMENTED |
| EV-003 | 2026-10-13 | SOURCE | **RC-1**: `AdminOrders.loadOrders` ไม่ส่ง `orderMode` เข้า `getOrdersPaged` · `filteredOrders = orders` ไม่ client-filter · `filterMode` ใช้แค่เปิด grouping | `src/pages/admin/AdminOrders.tsx:70-78,191,195,245` · `src/lib/bmbAdminApi_orders.ts:138,147` | CONFIRMED (SOURCE) |
| EV-004 | 2026-10-13 | SOURCE | **RC-2**: `getHomeProducts` else-branch ไม่เช็ค `available_same_day` · `pickTopAvailable` ไม่เช็ค mode flags · server reject path มีจริง | `src/lib/homeProviders.ts:85-89` · `src/lib/talkToBite.ts` · `supabase/migrations/118_restore_fc_gates_after_117.sql:150-154` | CONFIRMED (SOURCE) |
| EV-005 | 2026-10-13 | SOURCE | **RC-3**: `handlePreOrder` ไม่เช็ค `AddToCartResult` แล้ว navigate ทันที · `?mode=pre-order` ชนะ cart lock | `src/pages/HomePage.tsx:149-168` · `src/pages/CheckoutPage.tsx:56-57` · `src/store/cartStore.ts:103-105` | CONFIRMED (SOURCE) |
| EV-006 | 2026-10-13 | SOURCE | **RC-4**: สินค้าซ้ำ 3 ผิว (FoodTheater + คารูเซล 2 + CategorySections) ไม่มี dedupe ข้าม section | `src/pages/HomePage.tsx:215,279,292,297` | CONFIRMED (SOURCE) |
| EV-007 | 2026-10-13 | SOURCE | **RC-5**: อาการ "การ์ดมีปุ่มทั้งสองใต้หัวข้อโหมดเดียว" **ไม่ reproduce** จาก source — `HomeProductCard` ปุ่มเดียวตาม `item.mode` · ปุ่มคู่จริงที่ `ShowcaseCard`/`FoodMenuCard` | `src/components/home/HomeProductCard.tsx:21-36,73-80` · `src/components/home/CategorySections.tsx:71-95` · `src/components/FoodMenuCard.tsx:123-134` · `src/lib/homeProviders.ts:85-89` | NOT REPRODUCED (SOURCE) — รอ OD-2 |
| EV-008 | 2026-10-13 | SOURCE | **RC-6**: `AdminPreOrders` subset 100% + N+1 + no pagination + dead `paymentBadge` + ข้อความไทยพัง · ไม่มี test/e2e อ้าง (0 จุด) · routes/nav: `App.tsx:42,238` · `adminUi.ts:15,68` · `AdminDashboard.tsx:14` | `src/pages/admin/AdminPreOrders.tsx` ทั้งไฟล์ + grep ผลลัพธ์ | CONFIRMED (SOURCE) |
| EV-009 | 2026-10-13 | SOURCE | **RC-7**: `MenuPage.tsx:169` ใช้ `product.is_preorder` ตรง ๆ ต่างจาก fallback `:46-47` · mirror semantics ระบุที่ types | `src/pages/MenuPage.tsx:46-47,169` · `src/types/index.ts:28-30` | SUSPECTED (SOURCE) |
| EV-010 | 2026-10-13 | SOURCE | Server mode/cutoff/capacity/lead gates + per-item `ERR_PRODUCT_MODE_NOT_ALLOWED` มีใน RPC definition ล่าสุด (`118` = CREATE OR REPLACE ล่าสุดใน `supabase/migrations/`) · trigger `trg_menu_gate` → `ERR_ORDER_MODE_CLOSED` (`039`) | `118…sql:89-160` · `039…sql:223-254` · grep `CREATE OR REPLACE FUNCTION public.create_order_with_items` | DOCUMENTED (SOURCE) — **ยังไม่ใช่ production parity** |
| EV-011 | 2026-10-13 | AUTOMATED TEST | Mode-gate/lock/persistence/kitchen/queue มี test จริง: `canonicalOrderFlow.test.ts:106-130` · `cartIsolationStore` · `cartPersistence` · `menuScheduleGate` · `kitchenControl` · `preOrderQueue` · `adminOrdersOp.test.ts:79-83` (API level) | ไฟล์ test เหล่านี้ (รวมใน EV-002 run) | DOCUMENTED |
| EV-012 | 2026-10-13 | SOURCE | แผนก documents: ไม่พบ `BMB_SAME_DAY_PRE_ORDER_*` อยู่เดิม → สร้างใหม่ 4 ไฟล์ไม่ซ้ำ · `docs/archive/legacy_reports/MASTER_PLAN.md` และ `BMB_MASTER_*` = คนละเรื่อง (archive) | `Get-ChildItem docs/` + pattern match | DOCUMENTED |
| EV-013 | 2026-10-13 | SOURCE | `BMB_ADMIN_CONSOLIDATION_HANDOFF.md` สร้างบน HEAD `f297424` (ตามหลังจริง 1 commit) · เนื้อหา 2.1 อ้างว่า `HomeProductCard` render ทั้งสองปุ่ม — **ขัดกับ EV-007** → บันทึกเป็น correction ใน handoff | `docs/BMB_ADMIN_CONSOLIDATION_HANDOFF.md:3` · เทียบ EV-007 | DOCUMENTED |
| EV-014 | 2026-10-13 | SOURCE + AUTOMATED TEST | **Phase 3 เสร็จ**: `AdminOrders.loadOrders` ส่ง `orderMode` เข้า `getOrdersPaged` แล้ว (`orderMode: mode === 'all' ? undefined : mode`) · page-level test ใหม่ **6 tests ผ่าน** · **พิสูจน์ regression จริง**: ถอด fix ชั่วคราว = 6/6 FAILED · คืน fix = 6/6 PASSED · full suite **866/866 tests / 80 ไฟล์ ผ่านทั้งหมด** · tsc 0 · lint 0 · build 0 | `src/pages/admin/AdminOrders.tsx:70-79` · `src/__tests__/adminOrdersModeFilter.test.ts` (6 tests) · vitest run จริง 2026-10-13 | CONFIRMED (SOURCE + AUTOMATED TEST) |
| EV-015 | 2026-10-13 | SOURCE + AUTOMATED TEST | Phase 0 documentation commit = `fbe5ac6432ee2ce27ac550db007307eb4ce5f3e0` (5 เอกสาร +430/−21) push แล้ว · CI **run #410 `completed/success`** บน `fbe5ac6` (02:07:33Z) — ปิด ME-04 | `git log` · GitHub Actions run 38335305374 | DOCUMENTED |
| EV-016 | 2026-10-13 | SOURCE + AUTOMATED TEST | **Phase 1 เสร็จ (RC-2/OD-3/OD-5)**: canonical helpers `sameDayEligible`/`preorderEligible`/`deriveOrderMode` ที่ `talkToBite.ts` · `getHomeProducts` else-branch เช็ค eligibility แล้ว · `pickTopAvailable` กรองสินค้าไร้สิทธิ์ทั้งสองโหมด · `FoodTheater.add/customize` + `HomePage.handleReviewCta` ใช้ canonical derive และบล็อก `null` (เจอจาก caller survey — เดิม fallback SAME_DAY) · caller survey: `MenuPage.tsx:45-49`, `FoodMenuCard.tsx:123,134`, `homeShowcase.ts:49-50` canonical อยู่แล้ว ✓ · test ใหม่ 8 tests · **proof**: ถอด check ใน `homeProviders` = 3 tests FAILED, คืน fix = ผ่าน · full suite **874/874** · tsc 0 · lint 0 · build 0 | `src/lib/talkToBite.ts` (helpers ~L102-125) · `src/lib/homeProviders.ts:40,85-93` · `src/components/theater/FoodTheater.tsx` (add/customize) · `src/pages/HomePage.tsx` (`handleReviewCta`) · `src/__tests__/storefrontEligibility.test.ts` (8 tests) | CONFIRMED (SOURCE + AUTOMATED TEST) |
| EV-017 | 2026-10-13 | SOURCE + AUTOMATED TEST | **Phase 2 เสร็จ (RC-3/OD-4)**: `handlePreOrder` เช็ค `AddToCartResult` — `needs_confirmation`/`context_blocked` → ไม่ navigate (modal เดิมทำงาน) · `handleSameDay` แจ้งผลตามจริง (ห้ามบอก Added เมื่อต้องยืนยัน) · `CheckoutPage` — **lock ชนะ deep link** `?mode=pre-order` + แจ้งผู้ใช้ครั้งเดียวตอน mount · test ใหม่ **5 tests** (page-level 2 ไฟล์) · **proof 2 ทาง**: ถอด guard ใน HomePage = 1 fail · คืน deep-link-wins เก่าใน CheckoutPage = 1 fail · full suite **879/879** · tsc 0 · lint 0 · build 0 | `src/pages/HomePage.tsx` (`handlePreOrder`/`handleSameDay`) · `src/pages/CheckoutPage.tsx:55-69` · `src/__tests__/homePreOrderModeGuard.test.ts` (2) · `src/__tests__/checkoutModeLock.test.ts` (3) | CONFIRMED (SOURCE + AUTOMATED TEST) |
| EV-018 | 2026-10-13 | SOURCE + AUTOMATED TEST | **Phase 4 เสร็จ (RC-6)**: **ลบ `src/pages/admin/AdminPreOrders.tsx`** (256 บรรทัด, 0 test refs) · `App.tsx` route `/admin/pre-orders` → `<Navigate to="/admin/orders?mode=PRE_ORDER" replace>` (bookmark ไม่ตาย) + ลบ lazy import · `adminUi.ts` ลบ nav entry ทั้ง `ADMIN_NAV_ITEMS` + `ADMIN_NAV_GROUPS` (flatten invariant test เดิมผ่าน) · `AdminDashboard` quick link → `/admin/orders?mode=PRE_ORDER` · `AdminOrders` อ่าน `?mode=` เป็นค่าเริ่มต้น `filterMode` · **grep `pages/admin/AdminPreOrders` = 0** (recursive) · test ใหม่ **7 tests** · full suite **886/886** · tsc 0 · lint 0 · build 0 · **ห้ามแตะ**: `AdminKitchen`/`AdminMenuSchedule`/`AdminRounds` = ไม่ได้แก้ (ตรวจจาก diff) | `src/App.tsx:237-238` · `src/lib/adminUi.ts` · `src/pages/admin/AdminOrders.tsx:55-61` · `src/__tests__/adminPreOrdersConsolidation.test.ts` (7 tests) | CONFIRMED (SOURCE + AUTOMATED TEST) |
| EV-019 | 2026-10-13 | **PRODUCTION-RUNTIME (read-only)** | **Phase 5A — production identity + RC-5 probe** ที่ `biteme-baby.com` (HTTP 200, ไม่มีการคลิกสั่ง/เขียนใด ๆ): entry = `/assets/index-7UHx2Gky.js` · **content markers ครบใน build จริง**: P1 toast OD-3 block · P2 toasts (handlePreOrder/handleSameDay) · P3 `orderMode:` ใน `AdminOrders` chunk · P4 redirect `mode=PRE_ORDER` + ไม่มี `AdminPreOrders` chunk → deployed source state ≈ HEAD `f96ba33` **ระดับ content** (AO 12,665 ไบต์/FT 7,262 ไบต์ เท่ากัน local) · จุดต่างของ chunk ทั้งหมด = **env define** (geo `10.7016`/`102.1429` → `void 0` บน deploy) + hash cascade — **ไม่ใช่คนละ source** · **SHA-level binding = MISSING** (ไม่มี build-id ใน app/headers) → **RC-5 formal verdict = BLOCKED** ตาม OD-2/handoff · DOM observation: `/shop` home-cards = **CTA เดียวต่อ card ทุกใบ** (7 × เพิ่มลงตะกร้า + 3 × จองล่วงหน้า) **ไม่มี dual ปุ่ม** · showcase 'ลุยสวนหมู+กุ้ง' = 2 ปุ่มบน heading หมวดหมู่กลาง ๆ (สินค้า dual-mode จริง) · `/menu`: tabs `วันนี้ (12)`/`จองล่วงหน้า (3)` · FoodMenuCard 'ลุยสวนหมู+กุ้ง' มีทั้ง 2 ปุ่ม · theater present (`วันนี้ผมเลือกมาให้ 7 อย่างครับ`) · placeholder 'coming soon' 2 ใบมีปุ่มเพิ่มลงตะกร้า (สังเกตการณ์ ไม่แก้) | Playwright read-only probe + fetch จริง 2026-10-13 · entry `index-7UHx2Gky.js` · ผล probe ครบใน EV-019 บรรทัดนี้ | **OBSERVED** · SHA-binding **MISSING** |

---

## 2. MISSING evidence (ยังไม่มี — ต้องรวบรวมใน phase ที่ระบุ)

| ID | สิ่งที่ยังไม่มี | Phase เก็บ | หมายเหตุ |
|---|---|---|---|
| ME-01 | Production schema/function parity (`create_order_with_items`, `trg_menu_gate` vs `118`/`039`) | 7 | read-only เท่านั้น |
| ME-02 | RC-1/RC-2/RC-3/RC-4 runtime repro — มีแค่ SOURCE | 3/1/2/5 | ห้ามเรียก production defect ก่อนมี ME |
| ME-03 | ~~RC-5 ยืนยันบน `biteme-baby.com` + deployed build identity (OD-2)~~ → **ส่วน observation บันทึกแล้ว (EV-019)**: content markers P1-P4 ครบ + DOM probe (ไม่ reproduce dual-CTA บน mode sections) · **ยังเปิด**: SHA-level binding (ไม่มี build-id ใน app/headers) → formal verdict = BLOCKED | 5 (precondition) | `bitemebaby-5f7.pages.dev` = STALE ห้ามใช้ ✓ · ห้ามอ้างว่าใช้ commit ล่าสุดโดยไม่มี SHA binding ✓ |
| ME-04 | ~~CI status ของ HEAD `4b4dc14`~~ → **ปิดแล้ว**: CI run #410 `completed/success` บน `fbe5ac6` (2026-10-13, EV-015) | 3 (push แรก) | ของ commit Phase 3 ต้องตรวจอีกครั้ง |
| ME-05 | E2E ทั้งสองโหมดด้วย test data ที่ควบคุมได้ | 7 | ไม่มีเงินจริง/ลูกค้าจริง |
| ME-06 | พฤติกรรม cutoff/capacity/lead จริงบน production | 7 | มีแค่ mock |
| ME-07 | ~~Page-level test ของ `AdminOrders` mode filter~~ → **ปิดแล้ว**: `adminOrdersModeFilter.test.ts` (6 tests) 2026-10-13 (EV-014) | 3 | เดิมมีแค่ API test |

---

## 3. แม่แบบ entry ใหม่ (คัดลอกไปใช้ทุกครั้ง)

```
| EV-xxx | YYYY-MM-DD | SOURCE/AUTOMATED TEST/PRODUCTION-RUNTIME | ข้อเท็จจริง (ภาษาไทย) | reference (path:line / ชื่อ test / URL+build id) | CONFIRMED/SUSPECTED/supersedes EV-xxx |
```

## บันทึกการแก้ log

- 2026-10-13 — สร้างฉบับแรก (Phase 0) — Owner approval "PHASE 0 DOCUMENTATION ONLY"
