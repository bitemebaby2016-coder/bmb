# BMB OPENING READINESS MASTER — 2026-10-14

**นี่คือเอกสารสถานะหลักฉบับเดียว (single source of truth)** ของรอบ PRE-OPENING PRODUCTION CLOSURE
เอกสารสนับสนุนอื่น = หลักฐานเท่านั้น (ดู §5) — ห้ามมีรายงาน "ฉบับสุดท้าย" แข่งกัน
**สถานะรวม: ยังไม่พร้อมเปิดร้าน (NOT open-ready)** — ทุกอย่างในนี้คือ local verification + plan
จนกว่าเส้นทาง Admin → ลูกค้า → สั่งซื้อ จะได้รับการพิสูจน์บนสภาพแวดล้อมจริง/ยอมรับโดย Owner

Baseline: repo `D:/A PROJECT/Bite Me Baby` · branch `main` · origin/main = `4e0453eb385166c36c23f416d7345ac19d3a42db` · HEAD (local) = `8075f5d` (4 commits: `06a697b`/`7f808ce`/`34385c7`/`8075f5d`)
รอบงานนี้: 2026-10-14 (Owner Master Directive — Unified Catalog + Cart + Checkout + W5C) · ต่อเนื่อง 2026-10-14 (Owner mandate: loop ต่อจนผ่าน gate — อัปเดตเอกสาร/commit/push อนุญาตแล้ว; production data mutation = gate แยก)
**อัปเดตรอบต่อเนื่อง:** Gate 1 admin preflight = DONE (หลักฐาน `docs/BMB_GATE1_PREFLIGHT_GATE3_RELEASE_EVIDENCE_2026-10-14.md`) · Gate 2 Option A = **EXECUTED** (4 UPDATE rows ตามมติ Owner — ผลตรวจครบใน evidence doc §2) · Gate 3 release review = PASS · Gate 4 push+deploy = DONE · Gate 5 smoke = PASS 9/9

---

## 1. Architecture + Source-of-Truth Map (ของจริง ณ วันนี้)

| ชั้น | แหล่งข้อมูลจริง (canonical) | เขียนโดย | อ่านโดย | หมายเหตุ |
|---|---|---|---|---|
| Catalog (สินค้า) | `products` (Supabase, tenant-scoped) | `bmbAdminApi_products.createProduct/updateProduct/archiveProduct` (หน้า `/admin/products`) | `getProducts()` ทุกหน้าลูกค้า (Menu/Home/TalkToBite/checkout revalidate) | ไม่มี parallel store · cache = fetch-on-mount + refetch เมื่อ tab visible (WS3 รอบนี้) |
| หมวดหมู่ | `product_categories` | `createCategory/updateCategory/archiveCategory` + **ปุ่มย้ายสินค้า (ใหม่ รอบนี้)** | `getCategories()` = `is_active=true` เท่านั้น (ลูกค้า) · `getCategoriesAdmin()` = ทั้งหมด (แอดมิน) | **ต่างกันโดยเจตนา** — ตัวแสดง "ลูกค้าเห็น/ซ่อน" บนหน้าแอดมินแล้ว (รอบนี้) |
| Sections | `menu_sections` | Admin (`getSectionsAdmin`) | `getSections()` | หมวดที่ผูก section ปิด = ซ่อนทั้งหมวด (CAT-D01=B, server-enforced) |
| Visibility gate | RLS `product_categories_public_read USING (is_active=true)` + `buildCatalogGroups` | migration 005 + `src/lib/catalogStructure.ts` | เมนูลูกค้า | เหตุผลที่ cat-1/cat-2 หายจากหน้าลูกค้า (§3) |
| Sale status | `products.is_available` (RLS `products_public_read USING (is_available=true)`) + `available_same_day/available_preorder` (023 canonical) | Admin form | ทุกหน้า | alias `is_preorder` = one-way mirror (023) — ห้ามอ่านตรง (INV-18) |
| Cart | `src/store/cartStore.ts` (zustand, ตัวเดียว) | ทุก entry point ผ่าน `addItem` | Header/CartPage/FloatingCart/StickyCartBar/Checkout | `stores/useCartStore.ts` = delegating shim ที่พิสูจน์แล้ว (CartIsolationModal) — ไม่ใช่ store ที่สอง · line identity = product+mode+options (รอบนี้) |
| Cart persistence | `localStorage['bmb-cart-v1']` (ids/qty/options/mode เท่านั้น ไม่เก็บราคา) | `cartPersistence.ts` | hydrate ตอน boot + **revalidate ก่อน checkout** | D01 — ราคา/สต็อก re-derive จาก catalog ใหม่เสมอ |
| Order (อำนาจสูงสุด) | RPC `create_order_with_items` (025) + gates 016/018/024/026/030 + idempotency 124 (ยังไม่ apply) | `m1Submit.ts` ผ่าน Supabase | orders/order_items | เงิน/ราคา/สต็อก/สถานะ = server เท่านั้น · client ไม่มีอำนาจ (canonicalOrderFlow พิสูจน์แล้ว) |
| Payment | `payment_intents` + `record_payment_result` (idempotent) · manual PromptPay (txn → admin confirm) · COD · card = Edge Function (Omise test / Stripe) | paymentGateway/omise | Checkout/PaymentConfirmation | ไม่มีอำนาจเงินฝั่ง client/AI |

**Cache/refetch behavior ที่กำหนดชัด (multi-tab/session):** ไม่มี cache layer — ทุกการ mount โหลดใหม่จาก DB;
แท็บที่เปิดค้างอยู่จะ **refetch เมื่อกลับมา visible** (MenuPage/HomePage — เพิ่มรอบนี้); หลายแท็บ = ต่างแท็บต่าง refresh ของตัวเอง
การเปลี่ยนเมนูโดยแอดมิน = ข้อมูลล้วน ไม่ต้อง deploy โค้ด

## 2. Workstream status (ตามจริง)

| WS | ขอบเขต | สถานะ | หลักฐาน/หมายเหตุ |
|---|---|---|---|
| WS1 W5C/124 | ทวน 6 ไฟล์ + preserve ทุกข้อ + independent verify | **REVIEW = PASS** · ไม่แตะไฟล์ | harness rerun 2 รอบ `HARNESS_EXIT=0` (รอบนี้) · `unique_violation` = **ไม่มี runtime coverage (ยืนยันซ้ำ)** · R9/R12 OPEN · R10 BLOCKED · R11 OPEN · 124 prod apply = NOT AUTHORIZED |
| WS2 Catalog/Category | source-of-truth map + lifecycle (create/rename/reorder/on-off/**ย้ายสินค้า**/archive) + feedback | **IMPLEMENTED (code)** | ปุ่มย้าย/รวมสินค้า + ตัวแสดง "ลูกค้าเห็น/ซ่อน" บนหมวด · แผน cat-1/cat-2 = §3 (ยังไม่ apply — ต้อง gate แยก) |
| WS3 Admin→Customer | save error handling + visibility truth + refetch | **IMPLEMENTED (code)** | save guard (ห้าม toast สำเร็จถ้า write ล้ม) + visibility badge + visibilitychange refetch |
| WS4 Cart | entry points ครบ + line identity + context policy + persistence | **IMPLEMENTED (code)** | แก้ subtotal merge bug + options หาย + confirmDraft false-success + context-clear toast · sticky bar ไม่ทับ BottomNav (D02 contract: `bottom: var(--bmb-bottom-nav-h)`, z 60<80, 50) |
| WS5 Checkout | revalidate + submit lock + server authority | **VERIFIED (code+tests)** | revalidate-before-checkout มีจริง · submit lock → 'conflict' (test ใหม่) · server re-derive = canonicalOrderFlow tests |
| WS6 Readiness audit | ทุก capability จำแนกสถานะ | **DONE** (§8 matrix) | ใช้สัญญาเดิม/หลักฐานเดิม ไม่ reinvent |
| WS7 Testing | focused → full → build → harness | **DONE** | §5 — ทุกคำสั่งรันจริง |
| WS8 Docs | เอกสารหลักฉบับเดียว | **DONE (เอกสารนี้)** | supporting logs = §5 |

---

## 3. การตัดสินใจหมวดหมู่ — OPTION A (Owner อนุมัติแล้ว 2026-10-14) — preflight แล้วบางส่วน, ยังไม่ apply

> **สถานะ:** Owner เลือก Option A เป็นแผนหลัก (ห้ามถาม A/B ซ้ำ) · ต้องมี read-only preflight ตรงกับแผนก่อนรันจริง
> **Preflight ฝั่ง products (ทำแล้ว 2026-10-14, anon REST = มุมมองลูกค้า):** โครงสร้างตรงแผน (cat-1 = 5 สินค้า, cat-2 = 1 สินค้า, ทั้ง 6 `is_available=true`)
> **แต่พบ plan drift:** ID จริง 2 ตัวมี suffix (`prod-1789607383214-t8rm95`, `prod-1789610117076-2p5e8u`) — ตารางล่าง = ID จริงที่ต้องใช้เท่านั้น
> **Preflight ฐานะ admin (ทำแล้ว 2026-10-14 รอบต่อเนื่อง — หลักฐาน `docs/BMB_GATE1_PREFLIGHT_GATE3_RELEASE_EVIDENCE_2026-10-14.md`):** cat-1 `is_active=false` / cat-2 `archived=false` ตรง hard pre-check ✓ · 6 สินค้าตรงแผน ✓ · `count(products cat-2)=1` ✓ · **baseline order_items 6 สินค้า = 141 แถว** (orders ตาราง = 206, order_items ตาราง = 203)
> **แต่พบ drift เพิ่ม 2 จุด (ค่าจริงต่างจากแผน):** DRIFT-A = ชื่อหมวดจริง 'ส่งวันนี้ / Same Day' / 'จองล่วงหน้า / พรีออเดอร์' (ไม่ใช่ 'จานเดียว'/'ข้าว' ตาม seed) · DRIFT-B = มีสินค้าที่ 7 `prod-w3c-test-pre` (is_available=false) อยู่ใน cat-1 → ตัวเลขหลังรัน "cat-1 = 6" จะเป็น 7 ตามจริง (ลูกค้าไม่เห็นตัวนี้)
> **ดังนั้น: Gate 2 = EXECUTED แล้ว 2026-10-14 (Owner ยืนยัน drift + สั่ง execute):** ทำจริง **4 UPDATE rows** (U1 cat-1 is_active · U2 prod-3 → cat-1 · U3 cat-2 archived · U4 prod-w3c-test-pre archived ตามมติ) · 0 DELETE · after-verify ครบ — cat-1 active รับ 6 สินค้าขายได้ (แถวรวม 7 = ตรง DRIFT-B) · cat-2 archived · order_items 141 แถวเท่า baseline · ลูกค้าเห็น 5 หมวด/6 สินค้า ทั้ง anon RLS + UI จริง (รายละเอียด + rollback: `docs/BMB_GATE1_PREFLIGHT_GATE3_RELEASE_EVIDENCE_2026-10-14.md` §2)

**หลักฐานจริง (anon read = มุมมองลูกค้า, 2026-10-14):** หมวดที่ลูกค้าเห็น 4 = `cat-3` เมนูสุขภาพ, `cat-4` เครื่องดื่ม (sort 1), `cat-5` ของทานเล่น/ผลไม้, `cat-1790830853978` สินค้าสำเร็จรูป
**ที่หายไป:** `cat-1` 'จานเดียว' 🍜 และ `cat-2` 'ข้าว' 🍚 (ชื่อจาก seed 001/004 — แถวจริงถูก RLS `is_active` บัง ต้องตรวจด้วย query ฝั่งแอดมิน) — สินค้า 6 ตัว (`is_available=true` ทั้งหมด) ผูกอยู่ = **หายจากหน้าลูกค้าทั้งที่พร้อมขาย**

| product_id (ID จริงจาก preflight) | ชื่อ | หมวดปัจจุบัน | โหมดขาย |
|---|---|---|---|
| prod-1 | ผัดไทยกุ้งสด | cat-1 | same-day |
| prod-2 | เมี่ยงแซลม่อน | cat-1 | same-day |
| prod-6 | เมนูใหม่: ข้าวกุ้งกระเทียม | cat-1 | same-day + pre-order |
| prod-1789607383214**-t8rm95** | สปาเกตตี้ผัดพริกแห้งกุ้ง | cat-1 | same-day |
| prod-1789610117076**-2p5e8u** | ข้าวลาบอกไก่+ไข่ต้ม | cat-1 | same-day |
| prod-3 | ปลาต้มผักกาดดอง (ซวนช่ายหยุย) | cat-2 | same-day |

**การวิเคราะห์ซ้ำ:** 'จานเดียว' vs 'ข้าว' = ความหมายทับซ้อน (อาหารจานหลัก) และ 'ข้าว' เหลือ 1 ชิ้นซึ่งไม่ใช่ข้าว → รวมได้ตาม Owner decision B (หนึ่งหมวดหลักต่อหนึ่งความหมาย)

### OPTION A (อนุมัติแล้ว) — ขั้นตอน + script ที่ต้องรัน (ยังไม่รัน)
1. เปิด `cat-1` ให้ลูกค้าเห็น (`is_active = true`)
2. ย้าย `prod-3` (ปลาต้ม) → `cat-1`
3. Archive `cat-2` (`archived = true`) — ไม่ลบแถวใด ๆ
4. ตรวจจำนวนก่อน/หลัง + ออเดอร์เก่า + rollback

**จำนวนแถวที่แก้ = 3 UPDATE rows (ไม่ใช่ 2):** ① `product_categories` cat-1 (`is_active`) ② `products` prod-3 (`category_id`) ③ `product_categories` cat-2 (`archived`) · DELETE 0 · INSERT 0 · `orders/order_items` เขียน 0

**Script (guarded transaction — รันฐานะ admin/SQL editor เท่านั้น; ถ้า pre-check ไม่ตรง = ROLLBACK ทันที):**
```sql
BEGIN;
-- PRE-CHECK (ทุกค่าต้องตรง ไม่งั้น ROLLBACK):
SELECT id, name, is_active, archived FROM product_categories WHERE id IN ('cat-1','cat-2');
--   คาดหวัง: cat-1 is_active=false (หรือแถวไม่มี = ต้องหยุด), cat-2 archived=false
SELECT id, category_id FROM products WHERE id IN
  ('prod-1','prod-2','prod-6','prod-1789607383214-t8rm95','prod-1789610117076-2p5e8u','prod-3');
--   คาดหวัง: 5 ตัวแรก = cat-1, prod-3 = cat-2 (6 แถวเป๊ะ)
SELECT count(*) FROM products WHERE category_id = 'cat-2';           -- คาดหวัง 1
SELECT count(*) FROM order_items WHERE product_id IN
  ('prod-1','prod-2','prod-6','prod-1789607383214-t8rm95','prod-1789610117076-2p5e8u','prod-3'); -- บันทึกตัวเลขนี้เป็น baseline

-- APPLY (guard ด้วยค่าเดิม — ได้แถวละ 1 เท่านั้น):
UPDATE product_categories SET is_active = true  WHERE id = 'cat-1' AND (is_active IS NULL OR is_active = false); -- expect 1
UPDATE products           SET category_id = 'cat-1' WHERE id = 'prod-3' AND category_id = 'cat-2';                -- expect 1
UPDATE product_categories SET archived = true   WHERE id = 'cat-2' AND (archived IS NULL OR archived = false);   -- expect 1

-- AFTER-VERIFY:
SELECT id, name, is_active, archived FROM product_categories WHERE id IN ('cat-1','cat-2');   -- cat-1 active, cat-2 archived
SELECT category_id, count(*) FROM products GROUP BY category_id ORDER BY category_id;          -- cat-1 = 6, cat-2 หายจากผลรวม
SELECT count(*) FROM order_items WHERE product_id IN (...6 ids...);                             -- เท่า baseline เดิม = ประวัติไม่กระทบ
-- COMMIT;  -- เมื่อทุกค่าตรง; ไม่งั้น ROLLBACK;
```
**Rollback (ย้อนได้ 100%):**
```sql
UPDATE product_categories SET is_active = false WHERE id = 'cat-1';
UPDATE products SET category_id = 'cat-2' WHERE id = 'prod-3';
UPDATE product_categories SET archived = false WHERE id = 'cat-2';
```
**ผลกระทบประวัติ:** `order_items` อ้าง `product_id` (ไม่เปลี่ยน) + snapshot ข้อความในออเดอร์เดิม → **ประวัติไม่กระทบ** — ยืนยันด้วย query (ต้องรันฐานะ admin):
```sql
SELECT id, name, slug, is_active, archived FROM product_categories WHERE id IN ('cat-1','cat-2');
SELECT p.id, p.name, p.category_id, (SELECT count(*) FROM order_items oi WHERE oi.product_id = p.id) AS order_lines
FROM products p WHERE p.category_id IN ('cat-1','cat-2');
```
**Rollback:** reverse UPDATE ทั้ง 3 (is_active/archived/category_id) — ย้อนได้ 100% ไม่มีการลบ
**Option B (taxonomy ละเอียด):** เปิดทั้งคู่ + ย้ายเมนูข้าว (prod-6, prod-1789610117076) ไป cat-2 — ได้ 6 หมวด visible (Owner เลือกได้)
**Gate:** ทั้งหมด = production data change → **ยังไม่ทำ** จนกว่า Owner ยืนยัน execution gate แยก (คำสั่งรอบนี้ห้ามไว้ชัด)

## 4. Root causes (รอบ closure นี้) + ไฟล์ที่แก้

**RC-1 (Admin ↔ Customer ไม่เชื่อมกัน):** (a) visibility gate 3 ชั้นฝั่งลูกค้า (RLS `is_active` + `getCategories` + `buildCatalogGroups`) แต่แอดมินไม่มีสัญญาณว่าสินค้าถูกซ่อน → (b) save ทิ้งค่าที่คืน (`createProduct/updateProduct` คืน null ตอนล้ม) → toast "สำเร็จ" เสมอ
**RC-2 (เพิ่มของไม่เข้าตะกร้า/เข้าแบบผิด):** (a) MenuPage/TalkToBite.confirmDraft ไม่เช็ค `AddToCartResult` → toast/navigate ปลอม · (b) `addItem` merge แบบไม่สนใจ options (ตัวเลือกหาย) + ไม่คำนวณ subtotal ใหม่ (ยอดรวมต่ำกว่าจริง) · (c) `resolveContextChange` clear ทุกกรณี (latent ใต้ flag brand-routing) + clear เงียบไม่บอกผู้ใช้
**RC-3 (cat-1/cat-2):** หมวดถูกปิด (is_active=false หรือแถวหาย — รอ query ยืนยัน) โดยไม่มีรายงาน/feedback → สินค้าพร้อมขาย 6 ตัวหายจากเมนู

| ไฟล์ | สิ่งที่แก้ |
|---|---|
| `src/pages/admin/AdminProducts.tsx` | save guard ทั้ง 2 handler · visibility badge สินค้า · ปุ่ม/panel "ย้ายสินค้า" · ตัวแสดง "ลูกค้าเห็น/ซ่อน" บนหมวด |
| `src/lib/catalogStructure.ts` | `customerVisibilityIssue()` + labels |
| `src/pages/MenuPage.tsx` | gate `AddToCartResult` ทั้ง 2 handler · visibilitychange refetch |
| `src/pages/HomePage.tsx` | visibilitychange refetch |
| `src/components/ai/TalkToBite.tsx` | `confirmDraft` นับผล per line + รายงานตรง |
| `src/store/cartStore.ts` | `lineKeyFor` + line identity · subtotal recompute ตอน merge · update/remove แบบ line-precise · toast เมื่อ clear ตาม context |
| `src/pages/CartPage.tsx` | ส่ง `__line_key` ไป update/remove + React key |
| `src/__tests__/cartLineIdentity.test.ts` | 9 tests — duplicate/options/line ops |
| `src/__tests__/submitLockGuard.test.ts` | 2 tests — double-submit |
| `src/__tests__/adminCategoryLifecycle.test.ts` | 4 tests — move/merge contract |
| `src/__tests__/cartEntryPoints.test.ts` | 6 tests — entry points + refetch + revalidate |
| `docs/BMB_OPENING_READINESS_MASTER.md` | เอกสารฉบับนี้ |

(ก่อนหน้านี้รอบ P0 เดียวกัน: save guard/visibility badge/MenuPage gate/resolveContextChange — หลักฐาน `docs/BMB_P0_ADMIN_MENU_CART_EVIDENCE_2026-10-14.md`)

## 5. Tests + evidence (ทุกคำสั่งรันจริง 2026-10-14)

| คำสั่ง | ผล |
|---|---|
| `npx vitest run <7 focused files>` (adminCustomerVisibility, menuCartResultGuard, cartContextIsolation, cartLineIdentity, submitLockGuard, adminCategoryLifecycle, cartEntryPoints) | **PASS 38/38** |
| `npx vitest run` (ทั้งชุด) | **PASS 972/972 (94 files)** — 934 baseline + 38 ใหม่, 0 regression |
| `npx tsc --noEmit` | **exit 0** |
| `npm run lint` | **exit 0** (0 errors; warning เดิม 1 ใน `homeSectionModeCta.test.ts`) · brandNameGuard OK |
| `npm run build` | **exit 0** (vite 8.2.2 + PWA precache 144 entries) |
| `e2e/ci/local_stack_replica.sh` (docker postgres:16, isolated) | **HARNESS_EXIT=0 · ALL_GREEN** ×2 รอบ — 001-123 applied clean · CONTRACT 124 ALL PASSED · cleanup 0/0 · scenario1/R5/R6a/R6b PASS |
| live browser E2E (menu→cart→checkout / admin save→refetch) | **NOT RUN** — ไม่มี non-prod instance (§6/§8) |

**หลักฐานสนับสนุน:** `docs/BMB_P0_ADMIN_MENU_CART_EVIDENCE_2026-10-14.md` (root cause + live anon evidence) · `docs/BMB_WAVE5B_OWNER_DECISION_REVIEW.md` (W5C review) · `docs/BMB_SAME_DAY_PRE_ORDER_EVIDENCE_LOG.md` (EV-032/33) · `docs/BMB_GATE1_PREFLIGHT_GATE3_RELEASE_EVIDENCE_2026-10-14.md` (Gate 1 preflight + Gate 3 release review — รอบต่อเนื่อง)

**Re-run รอบต่อเนื่อง 2026-10-14 (Gate 3 — รันจริงซ้ำบนเครื่อง dev):** `npm test` **972/972 exit 0** · `npx tsc --noEmit` **exit 0** · `npm run lint` **exit 0** (1 warning เดิม + brandNameGuard OK 356 ไฟล์) · `npm run build` **exit 0** (precache 144 entries → `dist/assets/index-B7d67ygF.js`)

## 6. ยังไม่ตัดสินใจ / ภายนอกที่ค้าง

| # | เรื่อง | สถานะ | ผลกระทบ |
|---|---|---|---|
| 1 | แผน cat-1/cat-2 (§3 Option A หรือ B) | **รอ Owner เลือก + execution gate** | 6 สินค้าพร้อมขายยังไม่ขึ้นเมนูลูกค้า |
| 2 | W5C R9 (owner_key ข) / R12 (replay payload) | OPEN (Owner decision เดิม) | contract 124 ยังไม่ accept |
| 3 | W5C R10 prod precheck / R11 staging pgbouncer | BLOCKED / OPEN | ห้าม apply 124 |
| 4 | `VITE_FEATURE_BRAND_ROUTING` | OFF ทุก env — ห้ามเปิดจน deploy รอบนี้แล้ว | latent clear-cart (แก้แล้ว แต่ยังไม่ runtime ใต้ flag) |
| 5 | Payment live cutover (Omise live key / Stripe live) | ภายนอก — key ทดสอบเท่านั้นใน Omise | รับเงินจริงไม่ได้จนกว่า Owner cutover |
| 6 | SMS (THSMS) / Meta channel | key มี — runtime ยังไม่ verify จริง | OTP/guest flow พึ่งพา |
| 7 | Non-prod staging environment | ยังไม่มี | live E2E ถูกบล็อก (§8) |
| 8 | `unique_violation` branch (124) | ไม่มี runtime coverage (ยอมรับ+บันทึก) | defense-in-depth เท่านั้น |

## 7. Deployment + rollback plan

**กลไก deploy จริง:** push → `main` = Cloudflare auto-deploy `biteme-baby.com` (production) — ตรวจแล้ว: CI (`ci.yml`) มีแค่ lint/test/build ไม่มี deploy job = deploy ถูกขับโดย Cloudflare Git integration
**ดังนั้นการ push = การ deploy production โดยปริยาย → ต้องได้รับอนุมัติแยกเสมอ (ไม่ push เงียบ ๆ)**

**Commits ที่สร้างแล้ว (2026-10-14) — release review ผ่านแล้ว (Gate 3, หลักฐาน §5 + evidence doc):**
1. `06a697b` `fix(orders): W5C migration-124 contract remediation R1/R2/R3 + strict result CHECK` — W5C 6 ไฟล์
2. `7f808ce` `fix(admin): catalog save truth + customer-visibility + category move/merge` — AdminProducts, catalogStructure + tests ×2
3. `34385c7` `fix(cart): canonical line identity + honest AddToCartResult handling on every entry point` — cartStore, CartPage, MenuPage, HomePage, TalkToBite + tests ×5
4. `8075f5d` `docs: opening readiness master + P0 evidence + session handoff` — docs ×3
5. *(docs รอบต่อเนื่อง — preflight/release evidence + สถานะนี้)*
**ผล release review:** ขอบเขตตรงทุก commit · ไม่มี protected paths/env/workflow/secret · ไม่มี migration ถูก apply จาก push (`ci.yml` = lint/test/build เท่านั้น; 124 = isolated-only) · ไม่มี commit จาก session อื่น
**Push + deploy (2026-10-14 รอบต่อเนื่อง — ทำแล้ว):** push `4e0453e..3926254` (4 release + 1 docs) · deployed ใหม่ = `assets/index-0s4lXvhI.js`/`index-BMJYc1f5.css` (marker scan ผ่าน — evidence doc §5) · smoke Gate 5 = PASS ทั้ง 9 ข้อ (client-side, ไม่สร้างออเดอร์จริง — evidence doc §6) · **rollback โค้ด = `git revert`**
**กติกา:** ห้ามปนรูปภาพ/screenshots/webp/pre-order assets

**Rollback ของโค้ด:** revert commit (คืนสภาพเดิมทั้งหมด — ไม่มี schema/data change ในชุดนี้) · **Rollback ของแผน §3:** reverse UPDATE (ย้อนได้ 100%)
**Migrations ในรอบนี้:** 0 ไฟล์ — ไม่มี schema change ใด ๆ

## 8. Opening readiness matrix + acceptance checklist

| Capability | IMPLEMENTED | CONNECTED | DEPLOYED | RUNTIME VERIFIED | เอกสาร | ข้อจำกัด |
|---|---|---|---|---|---|---|
| Admin catalog CRUD + move/merge + visibility truth | ✓ (รอบนี้) | ✓ (products/categories API) | ✓ (deploy แล้ว) | บางส่วน (deployed marker — admin save live = production write ยังไม่ทดสอบ) | master + P0 + evidence doc | รอ Owner อนุมัติ write-test |
| Customer menu = canonical reads + refetch | ✓ | ✓ | ✓ (deploy แล้ว) | ✓ (smoke S1/S6 — visibility gate ทำงานจริง) | §1 + evidence doc §6 | — |
| Canonical cart (1 store, line identity, persistence) | ✓ | ✓ | ✓ (deploy แล้ว) | ✓ (smoke S2-S5 — add/merge/reload/cart page) | §1/§4 + evidence doc §6 | — |
| Checkout revalidate + submit lock + server authority | ✓ | ✓ (RPC 025) | ✓ (ส่วนเดิม) | บางส่วน (tests + smoke S8 guest gate — ไม่กด submit จริง) | canonicalOrderFlow/checkoutMixedSplit | ไม่มี live order test (ห้ามจนมี test plan) |
| Login (Supabase Auth) + guest OTP | ✓ | ✓ | ✓ | ผ่าน QA รอบก่อน (cr4 screenshots) | P0-2 docs | SMS runtime ยังไม่ verify |
| GPS/location + denied path | ✓ | ✓ | ✓ | ✓ (หลักฐาน launch-03/04) | — | — |
| SAME_DAY / PRE_ORDER modes + gates | ✓ | ✓ | ✓ | ✓ (contract tests + harness) | 023/025 | — |
| Delivery policy (5km self-delivery) + dispatch | ✓ | ✓ | ✓ | บางส่วน | dispatchContract | frontier `SELF_DELIVERY_EXCEEDS_5KM_LIMIT` |
| PromptPay (manual txn→admin confirm) + COD | ✓ | ✓ | ✓ | ✗ (ไม่ test กับเงินจริง) | paymentGateway | นโยบาย = ตั้งใจ manual |
| Card payment (Omise/Stripe EF) | ✓ | ✓ (test keys) | ✓ | ✗ | omise tests | **live keys = ภายนอก (blocker)** |
| Kitchen handoff + order state machine | ✓ | ✓ | ✓ | บางส่วน | 030 allow-list + tests | — |
| Customer tracking (read-only) | ✓ | ✓ | ✓ | ✓ (w5h1 + harness) | — | — |
| Admin roles/permissions (RLS) | ✓ | ✓ | ✓ | ✓ (g6/g7 tests) | 071 | — |
| Idempotent submit (124) | ✓ (code) | ✗ (ไม่ wire) | ✗ | isolated harness เท่านั้น | W5C docs | prod apply NOT AUTHORIZED |

### Owner acceptance checklist (ต้องทำก่อนประกาศพร้อมเปิด)
- [x] เลือกแผน §3 + ยืนยัน execution gate → apply + ตรวจด้วย verification queries — **ทำแล้ว 2026-10-14** (Option A + จัดการ prod-w3c-test-pre = 4 UPDATE rows · after-verify ครบ · rollback 100% เตรียมไว้ — evidence doc §2)
- [x] Review diff รอบนี้ → อนุมัติ commit boundaries → **อนุมัติ push (= deploy)** — ทำแล้ว 2026-10-14 (release review ผ่าน + Owner mandate อนุญาต commit/push; deployed + marker verified)
- [x] Smoke บน production ฝั่ง client-side (เพิ่มของ→ตะกร้า/line identity/reload/cart/visibility gate/checkout guest gate) — PASS 9/9 (evidence doc §6) · [ ] แอดมินบันทึกเมนู live (production write) · [ ] สั่งซื้อสำเร็จ 1 ออเดอร์จริง (ทดสอบโดย Owner)
- [ ] ตรวจ sticky cart bar ไม่ทับ BottomNav บนมือถือจริง
- [ ] ตัดสินใจ payment live cutover + ยืนยัน SMS/Meta runtime
- [ ] (ถ้าต้องการ) staging environment สำหรับ E2E ก่อน production
- [ ] W5C: ปิด R9/R12 + R10/R11 ก่อน apply migration 124 (คนละ gate)

**ห้ามประกาศ Open Shop ก่อน checklist ข้างบนผ่านจริงทุกข้อ**