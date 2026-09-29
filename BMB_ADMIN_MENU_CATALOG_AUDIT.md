# BMB — ADMIN MENU / CATALOG CONTROL: DEDICATED AUDIT (audit-only)

**ฐาน:** `b6b32a8` (3B-2E closed) · **ประเภท gate: AUDIT ONLY — ไม่มี implementation/migration/RLS/RPC/PWA/Admin-UI change** · prod probe = READ-ONLY (`e2e/ct-catalog-audit-probe.cjs` + menu_schedule ตรวจเพิ่ม)

---

## 1. Executive Summary

- **Canonical data model มีจริงและเป็น source of truth:** `products` + `product_categories` (+ `menu_schedule` 039 + `media_assets` 008) — Customer PWA **อ่านจาก DB จริง** ไม่มี static/hardcoded catalog (ค้นแล้ว ไม่พบ fallback)
- **Admin CRUD = REAL CONNECTED** (AdminProducts → bmbAdminApi_products → direct RLS-guarded writes; server ยัง re-derive ราคา/availability ตอนสร้าง order เสมอ)
- **GAP หลัก 3 กลุ่ม:** (1) Menu/Section/Heading ไม่มีตาราง (catalog = 2 ชั้น category→product); `menu_schedule` (039 weekly PRE_ORDER menu + mode open/close) **DEPLOYED แต่ไม่มี Admin UI เรียกใช้เลย** (0 callers, ตารางว่าง 0 แถว); (2) รูปภาพ Admin ใช้ base64 ฝังใน DB ขณะที่ storage path (`bmb-images` bucket + `media_assets`) **DEPLOYED แต่ไม่มีผู้เรียก `uploadMediaAsset`**; (3) ไม่มี archive/soft-delete + ไม่มี reorder UX เฉพาะทาง
- **Add-ons:** ไม่มีตาราง add-on/addon-group — ใช้ `products.addons JSONB` ต่อสินค้า (016) + `compute_addons_price()` re-derive ฝั่ง server ตอนสั่ง → ไม่มีระบบ add-on ซ้ำซ้อน; การแก้ผ่าน Admin มีผลต่อลูกค้าทันที (canonical path เดียวกัน)
- **ราคา:** authority = DB (`products.price` + addons) ตรวจซ้ำฝั่ง server ใน `create_order_with_items` (020 §4) — client ส่งราคาไม่ได้; order snapshot อยู่ใน `order_items` → แก้ราคาพรุ่งนี้ไม่กระทบ order เก่า

## 2. Production Schema (probe จริง)

**products** (RLS on): id TEXT PK · name NOT NULL · description '' · price NUMERIC CHECK(>=0) · category_id FK→product_categories · image_url '' · is_available true · is_featured · is_preorder · prep_minutes · sort_order · delivery_round_id FK · scheduled_date · stock · rating · review_count · **addons JSONB '[]'** · available_same_day true · available_preorder false · created/updated_at
**product_categories** (RLS on): id/name/slug NOT NULL · icon · sort_order · is_active · created_at
**menu_schedule** (039, ตารางว่าง 0 แถว — ไม่มี schedule published เลย): (date, product_id) = "สิ่งที่ขายได้วันนั้น" (weekly PRE_ORDER menu)
**media_assets** (008, RLS on, **0 แถว**): metadata รูป; bucket `bmb-images` (011 storage policies)
**ไม่มีตาราง:** menu / menu_sections / addon_groups / product_addons / product_variants (ยืนยันจาก information_schema)
**RPC catalog (7/7 live):** `compute_addons_price` · `check_product_availability` · `get_menu_for_date` · `publish_menu_schedule` · `set_menu_schedule` · `enforce_menu_gate` · `sync_product_mode_alias`

## 3. Actual Catalog Architecture (เรียลโครงสร้าง)

```
Customer PWA Menu/Home
   └─ category (product_categories: is_active, sort_order)
        └─ product (products: is_available + available_same_day/preorder, sort_order)
             └─ add-ons = products.addons JSONB (id/name/type checkbox|radio/options[]/max_selections/price)
menu_schedule (039) = เลเยอร์เหนือ: ถ้าวันนั้นมี schedule published → PRE_ORDER ต้องอยู่ในเมนูวันนั้น (enforce_menu_gate)
business_settings.operating_hours = เปิด/ปิด mode/round (prod: เปิดหมดทุก key)
```
ไม่มีตาราง "Menu/Section/Heading" แยก — requirement ถูกตอบด้วย 2 ชั้น + menu_schedule (ที่ยังไม่ถูกใช้)

## 4. Admin Write Path (ต่อ operation)

| Operation | Path | สถานะ |
|---|---|---|
| Product create/update/delete | AdminProducts → createProduct/updateProduct/deleteProduct → supabase `.insert/.update/.delete` (RLS is_admin) | **REAL CONNECTED** |
| Price | updateProduct (products.price) | **REAL CONNECTED** — มีผล order ใหม่ทันที (server re-price 020) |
| Availability | updateProduct (is_available, available_same_day/preorder) | **REAL CONNECTED** — server ปฏิเสธ order (ERR_PRODUCT_UNAVAILABLE 020) |
| Add-ons | AddonsEditor → products.addons JSON | **REAL CONNECTED** (server re-derive compute_addons_price) |
| Category CRUD | getCategoriesAdmin/create/update/deleteCategory | **REAL CONNECTED** (delete = hard delete) |
| Reorder | sort_order ผ่านฟอร์ม (ไม่มี reorder UX เฉพาะ) | PARTIAL |
| Image | **fileToBase64 → products.image_url** (TEXT ใน DB) | **CONNECTED แต่คลาด design** — storage path ไม่ถูกใช้ |
| Media library | AdminMedia + uploadMediaAsset → bucket bmb-images + media_assets | **DEPLOYED / NOT CONNECTED (0 callers)** |
| Menu schedule (039) | set_menu_schedule/publish/get_menu_for_date | **DEPLOYED / NOT CONNECTED (0 callers, 0 แถว)** |
| Mode/round open-close | business_settings.operating_hours (039 trigger enforce) | DEPLOYED (prod: เปิดหมด) — ไม่พบ UI editor |
| Archive/soft-delete | — | **MISSING** (deleteProduct = hard DELETE; order_items.product_id ไม่มี FK → ลบได้แม้มี order เก่า; snapshot รอดเพราะ order_items เก็บค่าไว้เอง) |

## 5. Customer PWA Read Path

MenuPage/HomePage → `getProducts/getCategories/getDeliveryRounds` → supabase direct SELECT (RLS public_read) → **ไม่มี** cache layer เฉพาะ / static fallback / hardcoded catalog (grep STATIC_/DEMO_/fallback = ไม่พบ) → **canonical 100%** · Admin แก้ → ลูกค้าเห็นทันที (refresh) · availability ที่แสดง = is_available; availability ตอนกดสั่ง = server (`check_product_availability` + create_order guards + 038 cutoff + 039 gate เมื่อมี schedule)

## 6. Price Authority

`Admin price → products.price (+addons JSON) → Customer PWA แสดง (read) → cart (client display เท่านั้น) → create_order_with_items (020 §4): server SELECT price, is_available FOR UPDATE + compute_addons_price → total → order_items snapshot (unit_price, item_total, customizations)` — **ราคาตอนสั่ง = server เสมอ, client ส่งราคาไม่ได้** · แก้ราคาพรุ่งนี้ **ไม่กระทบ order เก่า** (snapshot อยู่ใน order_items, ไม่มี FK JOIN กลับไป products ตอนอ่าน) ✅

## 7. Availability / Visibility

- UI visibility: `products_public_read` กรอง `is_available=true` → ของที่ปิด **anon มองไม่เห็นเลย** (RLS-level filter, ไม่ใช่แค่ซ่อน UI)
- Transaction authority: `create_order_with_items` ตรวจ is_available (ERR_PRODUCT_UNAVAILABLE) + available_same_day/preorder (023) + 038 cutoff + 039 menu gate (เมื่อมี schedule) + operating_hours trigger — **UI hiding ≠ authority, server เป็น authority จริง** ✅
- Inventory-driven: INV-01/02 (deduct/restore + bomFeasibility sold-out display) — เลเยอร์ server-side แยกอยู่แล้ว

## 8. Image / Media

ปัจจุบัน **MIXED**: ใช้จริง = base64 ใน products.image_url (DB TEXT — ทุก product มีรูป base64) · ทาง design = bucket `bmb-images` + media_assets (008/011) **ว่าง 0 แถว, upload path ไม่มีผู้เรียก** → GAP: รูปจริงอยู่ใน DB rows (base64 หนัก) ไม่ใช่ storage; AdminMedia เป็น library ที่ยังไม่ถูกต่อเข้าหน้าจริง

## 9. Add-ons

โมเดลจริง: **ต่อสินค้า** (`products.addons JSONB`: id, name, type checkbox/radio, options[], max_selections, price) — ไม่มี addon-group/ตารางร่วม · customer เลือกจาก JSON นี้ → ส่ง **ids/choices เท่านั้น** → `compute_addons_price` re-derive ฝั่ง server → snapshot ใน order_items.customizations → **ไม่มีระบบ add-on สองชุด** · ข้อจำกัด: ไม่มี required/min selections · ไม่มีกลุ่มแชร์ข้ามสินค้า · แก้ add-on = update product ทั้งชิ้น

## 10. Security / RLS (probe)

- products/product_categories: `*_public_read` anon+authenticated SELECT เฉพาะ is_available/is_active=true · `*_admin_manage` FOR ALL TO authenticated USING(is_admin()) WITH CHECK(is_admin()) → **ปลอดภัยตาม is_admin จริง** (ไม่ใช่ authenticated ทั้งหมด) · **driver ไม่มีสิทธิ์เขียน catalog** (ไม่มี policy พิเศษ)
- media_assets: public_read + admin ALL · payment_intents/anon policies = ของเดิม (frozen-adjacent ไม่แตะ)
- inventory_public_read: ถูก harden แล้วที่ 052 (STEP 3A G-SEC-01 — ปิดเรื่อง, อ้างของเดิม)

## 11. Order Snapshot Integrity

`order_items`: product_id (**ไม่มี FK** → ลบ product ไม่ถูก RESTRICT), product_name, quantity, unit_price, item_total, customizations (addon ids+choices+ราคาที่ server คำนวณ) → **แก้/ลบ product พรุ่งนี้ไม่เปลี่ยน order เก่า** ✅ (ยืนยันจาก schema จริง) — แต่การลบ product ทำให้ forensic link หาย → เข้า GAP-C4

## 12. Contract Table

| Requirement | Actual model | Admin control | PWA source | Backend authority | Security | Status |
|---|---|---|---|---|---|---|
| Menu | ไม่มีตาราง menu (2 ชั้น) | — | — | — | — | MISSING (structure) |
| Sections/headings | ไม่มี | — | — | — | — | MISSING |
| Categories | product_categories | ✅ CRUD REAL | read | ✅ DB | is_admin write / anon read active | CONNECTED |
| Products | products | ✅ CRUD REAL | read | ✅ DB+server re-check | ✅ | CONNECTED |
| Product name | products.name | ✅ | read | ✅ snapshot order_items | ✅ | CONNECTED |
| Description | products.description | ✅ | read | display only | ✅ | CONNECTED |
| Price | products.price | ✅ | read (display) | ✅ server re-price 020 | ✅ | CONNECTED+VERIFIED |
| Images | products.image_url (base64) / media_assets+bucket (ไม่ใช้) | base64 only | read | DB | admin write | PARTIAL (design gap) |
| Availability | is_available + available_same_day/preorder (023) | ✅ | read | ✅ server guards | ✅ | CONNECTED |
| Add-on groups | ไม่มี (embed ใน addons JSON) | ✅ per-product | read | ✅ compute_addons_price | ✅ | CONNECTED (โมเดลเรียบ) |
| Add-ons | products.addons JSONB | ✅ AddonsEditor | read | ✅ re-derived | ✅ | CONNECTED |
| Product ordering | products.sort_order | PARTIAL (ฟอร์ม) | read | DB | ✅ | PARTIAL |
| Category ordering | product_categories.sort_order | PARTIAL (ฟอร์ม) | read | DB | ✅ | PARTIAL |
| Menu/section ordering | — | — | — | — | — | MISSING |
| Visibility | is_active (cat) + is_available (prod) | ✅ | read (RLS filtered) | ✅ guards | ✅ | CONNECTED |
| Active/inactive | is_active / is_available | ✅ | filtered | ✅ | ✅ | CONNECTED |
| Archive | ไม่มี (hard delete) | ❌ | — | — | — | MISSING |
| Menu metadata | delivery_round_id/scheduled_date/prep_minutes/is_featured | ✅ (fields) | read | ✅ | ✅ | CONNECTED |
| Weekly menu + open/close (039) | menu_schedule + operating_hours | ❌ ไม่มี UI | n/a (0 schedules) | ✅ RPC+trigger live | ✅ | DEPLOYED/NOT CONNECTED |

## 13. Real Connectivity Matrix

| โดเมน | Admin UI มี | Admin เขียน canonical DB | PWA อ่าน canonical DB | การแก้ถึงลูกค้า |
|---|---|---|---|---|
| Products CRUD | ✅ | ✅ (RLS is_admin) | ✅ direct SELECT | ✅ ทันที |
| Categories CRUD | ✅ | ✅ | ✅ | ✅ |
| Price | ✅ | ✅ | ✅ | ✅ (order ใหม่บังคับใช้ราคาใหม่ฝั่ง server) |
| Availability | ✅ | ✅ | ✅ (anon filter) | ✅ (+ server guard) |
| Add-ons | ✅ | ✅ | ✅ | ✅ |
| Images | ✅ (base64) | ✅ (คลาด design) | ✅ | ✅ (แต่ไม่ใช้ storage) |
| Media library | ✅ หน้าเปล่า | ❌ (0 callers) | n/a | ❌ |
| Weekly menu schedule (039) | ❌ | ❌ | n/a (0 แถว) | ❌ (server subsystem พร้อม แต่ไม่มี UI) |
| Open/close mode/round | ⚠ ไม่พบ editor | ❌ | n/a | ⚠ (settings เปิดหมด) |
| Archive | ❌ | ❌ | n/a | n/a |

## 14. Gap List

| ID | Area | Current | Expected | Evidence | Risk | Required impl | Owner? |
|---|---|---|---|---|---|---|---|
| GAP-C1 | Menu/Section/Heading | ไม่มีตาราง (2 ชั้น category→product) | โครงสร้างเมนูตาม requirement หรือยืนยันว่า 2 ชั้นพอ | information_schema | ต่ำ-กลาง (PWA พึ่ง name/description ของ category) | ตาราง menu_sections หรือยืนยัน 2-ชั้นพอ | **YES** |
| GAP-C2 | Weekly menu (039) | DEPLOYED ไม่มีผู้เรียก, 0 schedules | Admin publish/เปิด-ปิดต่อวัน | pg_proc 7/7 live + 0 rows + 0 frontend refs | กลาง (PRE_ORDER ควบคุมด้วย available_preorder เท่านั้น) | Admin UI → set_menu_schedule/get_menu_for_date | **YES** (ลำดับ) |
| GAP-C3 | Images | base64 ใน DB rows | bucket bmb-images + media_assets | AdminMedia 0 callers; probe media=0 | กลาง (DB rows หนัก, ไม่มี CDN/cache) | ต่อ uploadMediaAsset เข้า AdminProducts + migrate ของเดิม | **YES** (เลือกทาง) |
| GAP-C4 | Archive | hard DELETE products/categories | soft-delete/active=false flow | deleteProduct lib; order_items ไม่มี FK product_id | กลาง (ลบแล้ว forensic link หาย) | archive flag + guard + UX | **YES** |
| GAP-C5 | Reorder UX | sort_order ผ่านฟอร์ม | reorder เฉพาะทาง | AdminProducts code | ต่ำ | reorder UI + batch update | NO |
| GAP-C6 | Add-on model | per-product JSON, ไม่มี required/min/group | ตาม requirement ครบ | 016 | ต่ำ (canonical ใช้ได้) | ขยาย JSON schema หรือตาราง ตาม Owner | **YES** |
| GAP-C7 | Open/close editor | operating_hours มีค่า ไม่พบ UI editor | ปิด/เปิด mode/round จาก Admin | 039 + settings rows | กลาง (ตอนนี้เปิดหมด) | AdminSettings section (trigger/RPC พร้อม) | NO (ตามลำดับ) |
| GAP-C8 | Catalog write audit | Admin เขียน products/categories โดยไม่มี audit_log | audit การเปลี่ยน catalog | AdminProducts/bmbAdminApi_products | ต่ำ-กลาง (ตาม convention ของระบบที่เหลือมี audit) | append audit ตอน CRUD หรือ trigger | NO |

## 15. Proposed Implementation Sequence (audit-only — ไม่ implement)

- **CAT-01:** Menu structure + archive semantics (GAP-C1/C4) — Owner ตัดสินโมเดลก่อน
- **CAT-02:** Admin CRUD hardening (GAP-C5/C8: reorder UX, validation, catalog audit log)
- **CAT-03:** ต่อ 039 weekly menu + open/close editor (GAP-C2/C7) — backend พร้อมหมดแล้ว
- **CAT-04:** Image/media (GAP-C3) — เลือก storage แล้ว migrate base64 เดิม
- **CAT-05:** Add-on model ขยายตาม Owner decision (GAP-C6)
- **CAT-06:** E2E controlled verification: Admin แก้ → DB → PWA เห็น → order ใหม่ใช้ค่าใหม่ → snapshot order เก่าไม่เปลี่ยน (controlled TEST data, ไม่มี real customer)

## 16. Owner Decisions Required (5 ข้อ)

1. **Menu structure:** 2 ชั้น (category→product) พอ หรือต้องมี sections/headings เพิ่ม? (GAP-C1)
2. **Weekly menu 039:** ต่อ Admin UI ให้ครบ หรือคงใช้ available_preorder เท่านั้น? (GAP-C2/C7)
3. **รูปภาพ:** migrate ไป bucket `bmb-images` (ต้องย้าย base64 เดิม) หรือคง base64? (GAP-C3)
4. **Archive:** soft-delete policy สำหรับ product/category? (GAP-C4)
5. **Add-ons:** per-product JSON พอ หรือต้องมี group/required/min? (GAP-C6)

## 17. Explicit Non-Goals (gate นี้)

ไม่ implement อะไรทั้งสิ้น · ไม่แก้ base64 · ไม่แตะ menu_schedule/operating_hours · ไม่แตะ RLS/ตาราง/RLS policy · ไม่เริ่ม 3B-3/3B-4/G-Gates · ไม่แตะ frozen scope

## 20. Test / Build (สภาพเดิม — ไม่แตะ code การใช้งาน)

- รันเพื่อ report สภาพ: Vitest **292/292 (30 files)** · tsc 0 · eslint 0 · build PASS (โค้ด = b6b32a8 เปลี่ยนแค่เพิ่มไฟล์ audit)
- ไฟล์ใหม่ของ gate นี้ = audit deliverable เท่านั้น: `BMB_ADMIN_MENU_CATALOG_AUDIT.md` + `e2e/ct-catalog-audit-probe.cjs` (read-only probe)

## 23. 🔴 HARD STOP — AUDIT COMPLETE · รอ Owner ตัดสิน 5 ข้อ (§16) ก่อน implement ใด ๆ
