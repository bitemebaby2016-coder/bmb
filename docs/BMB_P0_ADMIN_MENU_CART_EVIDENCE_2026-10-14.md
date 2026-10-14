# BMB P0 — ADMIN → MENU → CUSTOMER → CART CLOSURE (2026-10-14)

> **UPDATE 2026-10-14 (รอบต่อเนื่อง):** สถานะปัจจุบันของงานเปิดร้าน = `docs/BMB_OPENING_READINESS_MASTER.md`
> (เอกสารนี้ = หลักฐานรอบ P0 แรก — บันทึกไว้ตามเดิม ไม่แก้ประวัติ)

**Scope:** Owner P0 (2026-10-14) — Admin ไม่เชื่อม data flow จริง / เมนูที่แก้ไม่สะท้อนถึงลูกค้า / กดสั่ง-เพิ่มลงตะกร้าแล้วของไม่เข้าตะกร้า / สายพานทั้งเส้นยังไม่ถูกพิสูจน์
**Mode:** evidence-first → read-only baseline → root cause → smallest fix → tests → gates
**ห้ามแตะ:** 6 ไฟล์ W5C (unstaged เดิม), stash, screenshots/webp/pre-order assets, production writes, migration 124, W5C-3

---

## 1. Baseline (read-only, verified)

- Repo: `D:/A PROJECT/Bite Me Baby` (git toplevel) · branch `main`
- `HEAD` = `origin/main` = `4e0453eb385166c36c23f416d7345ac19d3a42db`
- ก่อนแก้: 6 ไฟล์ W5C unstaged (763+/19−) · staged = ว่าง · stash `local-edits-before-sync-2026-09-21` คงเดิม · untracked ครบ (png ×10, webp ×3, `public/images/pre-order/` = รูปเมนูที่แอดมินเปลี่ยน — ไม่แตะ)
- Test/build evidence เดิม: `npm test` = 934/934 (baseline ก่อนแก้) · production = `biteme-baby.com` (Cloudflare, auto-deploy จาก main)
- **Deployed build verification (read-only GET):** `https://biteme-baby.com` → `/assets/index-Cp4VvREX.js` (rolldown build) — marker scan: `line_mode` ✓ `bmb-cart-v1` ✓ `home-showcase-add-to-cart` ✓ `context_blocked` ✓ `setContextAndClearIfIncompatible` ✓ · `createPreOrder` = หายแล้ว (ไม่ใช่ build เก่า) → **deployed = โค้ดยุคปัจจุบัน (≥ Wave 2D-1)** · Service worker (`src/sw.ts`) = precache เท่านั้น ไม่ cache API → เมนู stale จาก SW ไม่ใช่สาเหตุ

## 2. Root cause (evidence-backed)

### RC-1 — Admin ↔ Customer catalog visibility disconnect (อาการ 1+2)
- **หลักฐาน live (anon read = มุมมองลูกค้าจริง):** `products` = 17 แถว · `product_categories` = **4 แถว** (`cat-3`, `cat-4`, `cat-5`, `cat-1790830853978`) — **`cat-1`/`cat-2` ไม่ปรากฏ** ทั้งที่มีสินค้า 6 ตัวผูกอยู่ (`prod-1` ผัดไทยกุ้งสด, `prod-2` เมี่ยงแซลม่อน, `prod-3` ปลาต้มผักกาดดอง, `prod-6` ข้าวกุ้งกระเทียม, `prod-1789607383214` สปาเกตตี้ผัดพริกแห้งกุ้ง, `prod-1789610117076` ข้าวลาบอกไก่+ไข่ต้ม)
- **กลไกที่ซ่อน:** RLS `product_categories_public_read … USING (is_active = true)` (005:166) + `getCategories()` `.eq('is_active', true)` (bmbAdminApi_products.ts:230) + `buildCatalogGroups` กรอง `c.is_active && !c.archived` → สินค้าหมวดปิด/หาย = **ไม่แสดงบนเมนูลูกค้าโดยไม่มีสัญญาณใด ๆ**
- **ฝั่งแอดมินเห็นคนละโลก:** `getCategoriesAdmin()` ไม่กรอง (bmbAdminApi_products.ts:238) → แอดมินเห็นทุกหมวด/สินค้า จึงแยกไม่ออกว่าลูกค้าไม่เห็น — ตรงกับ "Admin ไม่ได้เชื่อมกับ data flow จริง"
- **RC-1b (silent save):** `AdminProducts.handleAddProduct`/`handleUpdateProduct` **ทิ้งค่าที่คืน** (createProduct/updateProduct คืน `null` ทุกครั้งที่ write ล้ม — RLS `is_tenant_admin` / validation / เครือข่าย) → toast "สำเร็จ!" + ปิดฟอร์มเสมอ → แอดมินเชื่อว่าบันทึกแล้วทั้งที่ไม่มีอะไรเข้าฐานข้อมูล

### RC-2 — add-to-cart contract gaps (อาการ 3)
- **RC-2a (false success):** `MenuPage.handleSameDay`/`handlePreOrder` ไม่เช็ค `AddToCartResult` → toast "Added"/navigate ไป checkout ทั้งที่ `addItem` คืน `blocked`/`needs_confirmation`/`context_blocked` (ไม่ได้เพิ่มอะไร) — HomePage/TalkToBite เช็คแล้ว (RC-3/OD-4) MenuPage เป็นรายเดียวที่หลุด
- **RC-2b (latent P0 — flag OFF ตอนนี้):** `cartStore.resolveContextChange` คืน `'cleared'` **ทุกกรณี**ที่มี item + `BrandProvider` effect ผูก `searchParams` → ทันทีที่ `VITE_FEATURE_BRAND_ROUTING` เปิด (ตอนนี้ OFF ทุก env — `.env/.env.local/.env.example` ไม่มี key นี้) ทุก resolve ซ้ำจะ **ล้างตะกร้าทิ้งเอง**
- **RC-2c:** สินค้าจากหมวดที่ปิด (RC-1) เข้าเมนูไม่ได้ → ไม่มีปุ่มให้กดของที่คาดหวัง; ถ้ามาจาก surface อื่นที่ catalog ต่างกัน → `products.find()` fail → toast "Item not found" → ไม่เข้าตะกร้า

### ตรวจแล้วว่า "ไม่ใช่" สาเหตุ
cart store ไม่ซ้ำซ้อน (`stores/useCartStore.ts` = delegating shim) · `OrderBuilderModal` mount ที่ `Layout` ทุก route จริง · modal CSS (fixed z-80) ปกติ · id mapping (`p.id`) ตรงทุก surface · auth = Supabase Auth จริง (P0-2) · SW ไม่ cache API · deployed bundle ไม่ใช่ build เก่า

## 3. Fixes (smallest coherent — ไม่มี parallel store/หน้าจอ/ระบบใหม่)

| # | Root cause | Patch | ไฟล์ |
|---|---|---|---|
| 1 | RC-1b silent save | `handleAddProduct`/`handleUpdateProduct` เช็คค่าที่คืน → ถ้า `null` = toast error + **คงฟอร์มไว้** | `src/pages/admin/AdminProducts.tsx` |
| 2 | RC-1/RC-2c ความจริงฝั่งแอดมิน | helper `customerVisibilityIssue()` + badge `⚠️ ซ่อนจากหน้าลูกค้า: <เหตุผล>` (`data-testid="admin-product-customer-hidden"`) | `src/lib/catalogStructure.ts`, `src/pages/admin/AdminProducts.tsx` |
| 3 | RC-2a false success | `MenuPage` ทั้ง `handleSameDay`/`handlePreOrder` gate `res !== 'added'` → toast ตามเหตุผล + `return` (ห้าม navigate ทั้งที่ไม่ได้เพิ่ม) | `src/pages/MenuPage.tsx` |
| 4 | RC-2b context clear | `resolveContextChange`: context เดิมเป๊ะ (tenant+brand เท่ากัน) → `'kept'` (ยัง clear เมื่อเปลี่ยน brand/tenant ตาม RD-03) | `src/store/cartStore.ts` |

**ไม่แตะ:** business rule ฝั่ง server (CAT-D01=B catalog gate คงเดิม), RLS, migration, `.env`, payment, 6 ไฟล์ W5C, caller/W5C-3

## 4. Regression tests ที่เพิ่ม

| ไฟล์ | ครอบคลุม | ผล |
|---|---|---|
| `src/__tests__/adminCustomerVisibility.test.ts` | `customerVisibilityIssue` (missing/inactive/archived/ok + labels) + source-contract: save guard ทั้ง 2 handler + visibility badge | 8/8 ✓ |
| `src/__tests__/menuCartResultGuard.test.ts` | source-contract: `handleSameDay`/`handlePreOrder` gate `res !== 'added'` ก่อน toast/navigate + return ทุก non-added branch | 3/3 ✓ |
| `src/__tests__/cartContextIsolation.test.ts` | `resolveContextChange` (empty→kept, same-context→kept, brand เปลี่ยน→cleared, tenant เปลี่ยน→cleared) + `setContextAndClearIfIncompatible` คงตะกร้าเมื่อ resolve ซ้ำค่าเดิม | 6/6 ✓ |

## 5. Verification (commands + ผลจริง)

| Gate | คำสั่ง | ผล |
|---|---|---|
| Focused tests | `npx vitest run src/__tests__/adminCustomerVisibility.test.ts src/__tests__/menuCartResultGuard.test.ts src/__tests__/cartContextIsolation.test.ts` | **PASS 17/17** |
| Unit/integration ทั้งชุด | `npx vitest run` | **PASS 951/951 (90 files)** — 934 เดิม + 17 ใหม่, ไม่มี regression |
| TypeScript | `npx tsc --noEmit` | **PASS (exit 0)** |
| ESLint | `npm run lint` | **PASS (exit 0)** — 0 errors (1 warning เดิมใน `homeSectionModeCta.test.ts` ไม่เกี่ยวกับงานนี้) · brandNameGuard OK (352 ไฟล์) |
| Production build | `npm run build` | **PASS (exit 0)** — vite v8.2.2 + PWA injectManifest precache 143 entries |
| customer menu → add-to-cart → cart display | regression ระดับ store/contract (suite + focused) | PASS (unit) · **live E2E = NOT RUN** (ไม่มี non-prod instance; prod ห้าม mutate) |
| Admin save → customer menu refresh | source-contract + visibility helper tests | PASS (unit) · live = NOT VERIFIED |
| cart persistence / stale revalidation | `cartPersistence.test.ts` + `canonicalOrderFlow.test.ts` (ใน suite 951) | PASS |

## 6. Status (ตามจริง — ห้ามอ้าง production-ready)

- FIX IMPLEMENTED — ✓ 2026-10-14 (patch 4 จุด + tests 17)
- LOCAL TEST VERIFIED — ✓ 951/951 · tsc 0 · lint 0 · build 0
- OWNER DIFF REVIEW — อยู่ระหว่างรอ Owner ตรวจ diff
- COMMIT/PUSH — ไม่ทำ (คำสั่งห้าม)
- PRODUCTION APPLY / RUNTIME VERIFY — **ยังไม่เกิดขึ้น** (auto-deploy เกิดหลัง push ซึ่งยังไม่ได้รับอนุมัติ; runtime จริงยังไม่ถูก verify)

## 7. Outstanding / ต้องตัดสินใจ (Owner)

1. **ข้อมูล cat-1/cat-2 (Production data):** สินค้า 6 ตัวผูกหมวดที่ลูกค้าไม่เห็น — (ก) เปิด `is_active` คืน 2 หมวด (ข) ย้ายสินค้าไปหมวด active (ค) archive สินค้า — **production data mutation = ต้องอนุมัติเท่านั้น** (badge ใหม่ใน /admin/products จะชี้จุดนี้)
2. **เปิด `VITE_FEATURE_BRAND_ROUTING`:** ห้ามเปิดจนกว่า RC-2b patch จะ deploy แล้ว
3. **W5C ค้างตามเดิม:** R9/R12 (Owner decision), R10 BLOCKED, R11 OPEN, `unique_violation` = no runtime coverage, owner_key (ข) — ไม่เปลี่ยนสถานะในรอบนี้
4. **Open Shop:** ห้ามประกาศพร้อมเปิดร้านจน production runtime ได้รับการ verify จริง