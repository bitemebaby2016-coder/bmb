# BMB — MASTER PLAN: SAME_DAY / PRE_ORDER CONSOLIDATION

> **สร้าง:** 2026-10-13 (Phase 0) · **HEAD:** `4b4dc1486952b688cab20fefa9f3d2e89dfdbc7c` = `origin/main`
> **อนุมัติโดย Owner:** Phase 0 Documentation Only — OD-1..OD-7 อนุมัติแล้ว (ดูข้อ 6)
> **สถานะ:** MASTER PLAN PROPOSED — OWNER REVIEW REQUIRED
> **เอกสารคู่:** `BMB_SAME_DAY_PRE_ORDER_PHASE_CONTRACTS.md` · `BMB_SAME_DAY_PRE_ORDER_REGRESSION_MATRIX.md` · `BMB_SAME_DAY_PRE_ORDER_EVIDENCE_LOG.md` · `BMB_ADMIN_CONSOLIDATION_HANDOFF.md` (ฉบับอ้างอิงเดิม)

---

## 1. วัตถุประสงค์และขอบเขต

แก้ปัญหา SAME_DAY / PRE_ORDER ที่เกิดซ้ำอย่างเป็นระบบ ครอบคลุม storefront → cart → checkout → server validation → kitchen → admin โดยไม่สร้างระบบซ้ำและไม่ทำลายงานที่เสร็จแล้ว พร้อมหลักฐานตรวจสอบย้อนกลับได้

- **อยู่ในขอบเขต:** แก้ application code/tests ตาม Phase Contract · จัดทำเอกสาร · production verification แบบอ่านอย่างเดียว
- **ไม่อยู่ในขอบเขต:** migration ใหม่หรือแก้ RPC · เปลี่ยน business rules (ต้อง Owner approval เท่านั้น) · payment ด้วยเงินจริง · แก้/ลบ untracked files · deploy โดยไม่ผ่าน gates

---

## 2. Repository baseline (ตรวจจริง 2026-10-13)

| รายการ | ค่า |
|---|---|
| workspace | `D:\A PROJECT\Bite Me Baby` · branch `main` |
| `HEAD` | `4b4dc1486952b688cab20fefa9f3d2e89dfdbc7c` (docs commit 2026-10-13 07:55 +0700) |
| `origin/main` | `4b4dc14…` = HEAD ตรงกัน |
| staged files | 0 |
| untracked | 13 ไฟล์ — `e2e/screenshots/*.png` 10 · `public/**/coming soon.webp` 2 · รูปเครื่องดื่ม 1 → **ห้ามแตะ ห้ามรวมเข้า commit** |
| stash | `local-edits-before-sync-2026-09-21` — **ห้ามแตะ** |
| test baseline | `npm test` รัน 2026-10-13 → **79 ไฟล์ / 860 tests ผ่าน** (EV-002) |
| CI ของ HEAD นี้ | **ยังไม่ได้ตรวจในรอบวางแผน** (handoff อ้าง run#408 ของ `f297424`) |

### ข้อจำกัดของหลักฐาน
1. ผลตรวจ RC-1..RC-7 มาจาก **source inspection ทั้งหมด** — ยังไม่มี runtime evidence ใด ๆ
2. Production: `biteme-baby.com` = current · `bitemebaby-5f7.pages.dev` = **STALE ห้ามใช้เป็นหลักฐานสายตา** (OD-2)
3. ยังไม่เคยเทียบ production schema/function กับ migration chain (ต้องทำ Phase 7 แบบ read-only)
4. PowerShell อ่าน/เขียนภาษาไทยเพี้ยน → เอกสารไทยต้องเขียนผ่าน editor/node เท่านั้น

---

## 3. นิยามสถานะและระดับหลักฐาน

**สถานะ:** `IMPLEMENTED` (โค้ดมีแล้ว) · `CONNECTED` (เรียกกันครบสาย) · `DEPLOYED` (ขึ้น production แล้ว) · `RUNTIME VERIFIED` (ตรวจพฤติกรรมจริงแล้ว) · `DOCUMENTED` (บันทึกแล้ว) · `MISSING` (ยังไม่มี) · `BLOCKED` (ติด Owner/evidence) · `DEFERRED` (เลื่อนตาม decision)

**ระดับหลักฐาน — บันทึกใน `EVIDENCE_LOG` ทุกครั้ง:**
- **SOURCE** — อ่านโค้ด/migration (อ้าง `path:line`)
- **AUTOMATED TEST** — ผลรัน vitest จริง (ชื่อไฟล์/test)
- **PRODUCTION-RUNTIME** — พฤติกรรมบน `biteme-baby.com` หรือค่าที่อ่านจาก production DB (read-only)

**ข้อห้าม:** ห้ามอ้างว่า "server validation ครบถ้วน" หรือ "production defect แก้แล้ว" โดยไม่มีหลักฐานระดับที่ระบุ · ห้ามปิด phase ว่า COMPLETE ก่อนมีหลักฐานจริง

## 4. Canonical data-flow map (SOURCE evidence)

1. **Catalog (authority):** `products.available_same_day` / `products.available_preorder` — migration `023_canonical_order_domain.sql` · `is_preorder` = DEPRECATED one-way mirror (`src/types/index.ts:28-30`)
2. **หน้าแรก 4 ผิว:**
   - `FoodTheater` ← `pickTopAvailable` (`src/lib/talkToBite.ts`) — กรองแค่ `is_available && !archived` **ไม่ดู mode flags** · derive mode ที่ `FoodTheater.tsx:159-171`
   - คารูเซล "🔥 เมนูวันนี้" / "📅 จองล่วงหน้า" ← `getHomeProducts` (`src/lib/homeProviders.ts:71-92`) — split exclusive: preorder flag → bucket preOrder, **else → sameDay โดยไม่เช็ค `available_same_day`** (L85-89)
   - `CategorySections` ← `selectHomeShowcase` (`src/lib/homeShowcase.ts:31-52`) — `ShowcaseCard` ได้ปุ่มทั้งสองเมื่อ flags ทั้งคู่ true (`src/components/home/CategorySections.tsx:71-95`)
   - `HomeProductCard` แสดง **ปุ่มเดียว** ตาม `item.cta` ที่ derive จาก mode (`homeProviders.ts:65`, `HomeProductCard.tsx:73-80`)
3. **Cart:** `src/store/cartStore.ts:86-130` — mode default `'SAME_DAY'` · ล็อกโหมด + `pendingMode` confirmation · persistence validate `order_mode` (`src/lib/cartPersistence.ts:103,145`)
4. **Checkout:** `src/pages/CheckoutPage.tsx:56-57` — deep link `?mode=pre-order` **ชนะ** lock ปัจจุบัน → `createOrder` → RPC `create_order_with_items`
5. **Server (definition ล่าสุด = `supabase/migrations/118_restore_fc_gates_after_117.sql`):** enum mode · round active · SAME_DAY: วันนี้ + cutoff (L132-135) · PRE_ORDER: scheduled_date > today + lead (L136-141) · capacity (L143) · **mode gate ต่อ item `ERR_PRODUCT_MODE_NOT_ALLOWED` (L150-154)** · trigger `trg_menu_gate` (`039…sql:223-254` → `ERR_ORDER_MODE_CLOSED`)
6. **หลังออเดอร์:** `src/lib/kitchenQueueView.ts:72,117` จัดกลุ่มด้วย `order_mode` + `scheduled_date` · `AdminKitchen` (production view) · `AdminMenuSchedule` (catalog) · `AdminRounds` (capacity) — **ห้ามรวม 3 หน้านี้**

---

## 5. Root-cause matrix

| RC | ปัญหา (สรุป) | หลักฐานหลัก | ระดับหลักฐาน | รุนแรง | Phase |
|---|---|---|---|---|---|
| **RC-1** | `AdminOrders` ไม่ส่ง `filterMode` เข้า `getOrdersPaged` → ปุ่มกรองโหมด **ไม่กรองจริง** (มีผลแค่เปิด grouping) | `AdminOrders.tsx:70-78,191,195,245` vs `bmbAdminApi_orders.ts:138,147` | CONFIRMED (SOURCE) | สูง | **3** |
| **RC-2** | `getHomeProducts` else-branch ไม่เช็ค `available_same_day` · `pickTopAvailable` ไม่เช็ค mode flags → สินค้าไม่มีสิทธิ์ถูกเสนอให้สั่ง | `homeProviders.ts:85-89` · `talkToBite.ts` · failure path `118…sql:153-154` | CONFIRMED (SOURCE) | สูง | **1** |
| **RC-3** | `handlePreOrder` เพิกเฉย `AddToCartResult` + `?mode=pre-order` ชนะ cart lock → โหมดอาจเปลี่ยนเงียบ ๆ | `HomePage.tsx:158-167` · `CheckoutPage.tsx:56-57` · `cartStore.ts:103-105` | CONFIRMED (SOURCE) — พฤติกรรมที่ถูกต้อง = OD-4 | กลาง | **2** |
| **RC-4** | สินค้าซ้ำ 3 ผิวบนหน้าเดียว (FoodTheater + คารูเซล×2 + CategorySections) ไม่มี dedupe | `HomePage.tsx:215,279,292,297` | CONFIRMED (SOURCE) | กลาง | **5** |
| **RC-5** | อาการ "การ์ดใต้หัวข้อมีปุ่มอีกโหมด" — **NOT REPRODUCED** จาก source ปัจจุบัน (`HomeProductCard` ปุ่มเดียวตาม mode) · ปุ่มคู่จริงอยู่ที่ `ShowcaseCard`/`FoodMenuCard` | `HomeProductCard.tsx:21-36,73-80` · `CategorySections.tsx:71-95` · `FoodMenuCard.tsx:123-134` | NOT REPRODUCED — ต้องตรวจ production build (OD-2) | ต้องยืนยันก่อน | **5** (BLOCKED) |
| **RC-6** | `AdminPreOrders` = subset 100% ของ `AdminOrders` + N+1 query · no pagination · dead code `paymentBadge` · ข้อความไทยพังหลายจุด | `AdminPreOrders.tsx:24-29,33-37,77-84,49,54,91,107,111` · ไม่มี test/e2e อ้าง (0 จุด) | CONFIRMED (SOURCE) | กลาง | **4** (รอ 3) |
| **RC-7** | `MenuPage.tsx:169` ใช้ alias เก่า `is_preorder` ต่างจาก fallback L46-47 | `MenuPage.tsx:46-47 vs 169` · `types/index.ts:28-30` | SUSPECTED (ผลเท่ากันวันนี้) | ต่ำ | **6** |

**Safeguards ที่มีอยู่แล้ว (SOURCE + AUTOMATED TEST — ยังไม่ใช่ production proof):** server gates ใน `118…sql:89-160` · `trg_menu_gate` (`039`) · cart mode lock + `pendingMode` · `cartPersistence` validate · tests: `canonicalOrderFlow.test.ts:106-130`, `cartIsolationStore`, `cartPersistence`, `menuScheduleGate`, `kitchenControl`, `preOrderQueue`, `adminOrdersOp.test.ts:79-83` (API level เท่านั้น)

---

## 6. Owner decisions (อนุมัติแล้ว 2026-10-13)

| ID | ข้อตัดสินใจ |
|---|---|
| **OD-1** | ทำ **A1** (การ์ดตรงโหมด) ก่อน · A2 (ยุบ section) = **DEFERRED** |
| **OD-2** | ตรวจ production ที่ **`biteme-baby.com`** และยืนยัน deployed build identity ก่อนใช้เป็นหลักฐาน |
| **OD-3** | สินค้าไม่มีสิทธิ์ทั้งสองโหมด → **ต้องไม่แสดง**ในพื้นที่ที่เสนอให้สั่งซื้อ |
| **OD-4** | **cart mode lock เป็นหลัก** · ห้ามเปลี่ยนโหมดเงียบ ๆ ต้องแจ้งและให้ลูกค้ายืนยัน |
| **OD-5** | FoodTheater ต้องใช้ eligibility สอดคล้องกับโหมดที่เสนอขาย |
| **OD-6** | อนุมัติสร้างเอกสาร 4 ชิ้น + ปรับ `BMB_ADMIN_CONSOLIDATION_HANDOFF.md` |
| **OD-7** | ลำดับ implementation: **Phase 3 → Phase 1 → Phase 2** · Phase 4 รอ Phase 3 ผ่าน |

---

## 7. Phase roadmap และ dependencies

| Phase | เนื้อหา | Depends on | เหตุผล |
|---|---|---|---|
| **0** | Baseline + เอกสาร 4 ชิ้น + ปรับ handoff | — | READ ONLY / DOCUMENTATION (รอบนี้) |
| **3** | `AdminOrders` ส่ง `filterMode → orderMode` + page-level tests | approval (OD-7) | เล็กสุด · เป็น gate ของ Phase 4 · **ทำเป็นลำดับแรก** |
| **1** | Storefront eligibility (RC-2 · OD-3 · OD-5) + tests | approval | แตะการ์ด/ผิวหน้าร้าน — ทำก่อน Phase 5 เพื่อไม่แก้ component เดียวกัน 2 รอบ |
| **2** | Cart/checkout consistency (RC-3 · OD-4) | OD-4 (อนุมัติแล้ว) + approval | ถ้า design ที่จะ implement ไม่ตรง OD-4 → HARD STOP ทันที |
| **4** | ยุบ `AdminPreOrders` → `AdminOrders` + redirect + nav | **Phase 3 มีหลักฐานผ่านแล้ว** | กัน preset filter ที่ดูเหมือนกรองแต่ไม่กรอง |
| **5** | A1 + ลดซ้ำ (RC-4) · ยืนยัน RC-5 บน production (OD-2) | Phase 1 + OD-2 | A2 = DEFERRED ตาม OD-1 |
| **6** | RC-7 canonical fallback ให้สม่ำเสมอ | Phase 1 | เล็ก · ห้ามลบ legacy field |
| **7** | Production schema/function verification + E2E ทั้งสองโหมด | ทุก phase + Owner authorization | แยก evidence 3 ชั้น · ห้ามประกาศ closure ปราศจาก runtime evidence |

**Execution protocol (ทุก phase):** audit scope → แสดง Phase Contract → ขอ approval → implement → quality gates → ตรวจ no unrelated changes → อัปเดตเอกสาร → commit เฉพาะ path ใน scope → push → ตรวจ CI `completed/success` → ยืนยัน `HEAD == origin/main` + worktree → รายงาน SHA/evidence/residual risks → หยุดรอ approval ถัดไป

**Quality gates ทุกครั้ง (fresh เท่านั้น):** `npx tsc --noEmit --incremental false` · `npm run lint` · `npm test` · `npm run build` = 0 ทุกตัว

---

## 8. Hard stops (ห้ามฝ่าฝืน)

- แก้ application code/tests/migrations/config/environment **นอก phase ที่อนุมัติ**
- เปลี่ยน business rules โดยไม่มี Owner approval
- แก้/ลบ untracked 13 ไฟล์ หรือแตะ stash เดิม
- commit/push/deploy โดยไม่ผ่าน gates หรือไม่รายงาน
- ใช้ `bitemebaby-5f7.pages.dev` เป็นหลักฐาน · ใช้เงินจริง/ข้อมูลลูกค้าจริงทดสอบ
- พบ security/RLS issue · production mismatch · payment risk · ข้อมูลไม่พอ → `HARD STOP` เฉพาะขอบเขตพร้อมคำถามถึง Owner

---

## 9. Rollback / recovery

- ทุก phase = **1 commit เฉพาะ** → `git revert` ได้ทันที · Phases 1-6 ไม่มี migration → ไม่มี schema ต้องถอย
- CI ตกหลัง push → revert + รายงานทันที ห้าม force-push
- เอกสาร: overwrite เต็มไฟล์ (ไม่ append) — ฉบับก่อนหน้าอยู่ใน git history
- untracked 13 ไฟล์: รายงานแยก ห้ามลบ/ห้ามรวม commit เพื่อความ "สะอาด"


