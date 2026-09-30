# BMB — ADMIN MENU/CATALOG OWNER DECISION CONTRACT

**ฐาน evidence:** audit `e9d0c5d` (`BMB_ADMIN_MENU_CATALOG_AUDIT.md`) + re-verification read-only probe (`e2e/ct-catdec-probe.cjs`, commit เดียวกับเอกสารนี้)
**สถานะ gate: OWNER DECISION REQUIRED — ทุก decision = PENDING — ห้าม implement จน Owner ตอบครบ**

---

## STEP 1 — Evidence re-verification (ไม่เชื่อสรุปตรวจซ้ำจริง)

| หัวข้อตรวจ | Evidence ที่ยืนยันใหม่/มีอยู่ |
|---|---|
| production schema | products (21 columns incl. addons JSONB, available_same_day/preorder), product_categories, menu_schedule (0 rows), media_assets (0 rows) — information_schema probe |
| production RPC | compute_addons_price · check_product_availability · get_menu_for_date · publish_menu_schedule · set_menu_schedule · enforce_menu_gate · sync_product_mode_alias — 7/7 live |
| migrations | 001 (products/categories), 005 (RLS: public_read is_available filter / admin_manage is_admin() WITH CHECK), 008 (media_assets), 011 (storage policies), 016 (addons JSONB + compute_addons_price), 023 (mode columns), 020 (server re-price §4), 038 (cutoff), 039 (menu_schedule + operating_hours) |
| Admin catalog code | AdminProducts → bmbAdminApi_products (direct RLS-guarded writes), AddonsEditor → products.addons, image = fileToBase64 |
| PWA read path | MenuPage/HomePage → getProducts/getCategories → supabase SELECT — ไม่มี static fallback |
| order/price snapshot | 020 §4: server SELECT price,is_available FOR UPDATE + compute_addons_price; order_items snapshot (product_name, unit_price, item_total, customizations) |
| menu_schedule | 0 แถว, 0 frontend callers → DEPLOYED/NOT CONNECTED |
| media_assets | 0 แถว; AdminMedia/uploadMediaAsset 0 callers → DEPLOYED/NOT CONNECTED |
| products.addons | JSON keys จริง: id, name, type (checkbox/radio), options[], max_selections, price |

**Evidence เพิ่มเติมรอบนี้ (probe):**
- products.image_url: 9/10 rows = **BASE64**, รวม **998,667 bytes (~1MB) ใน DB**; 1 row EMPTY
- Storage bucket `bmb-images` **มีอยู่จริง** (mgmt API 200)
- media_assets RLS: admin = ALL USING(is_admin()) · public_read = SELECT USING(true)
- `is_admin()` SQL function live

## Architecture ปัจจุบัน (สรุปเดิม)

`Category → Product → add-ons (JSONB)` · menu_schedule = เลเยอร์ additive (inactive) · ราคา/availability authority = server ตอนสร้าง order

---

## STEP 2 — DECISION TABLE

| Decision ID | Topic | Current Production Reality | Options | Consequence | Owner Decision |
|---|---|---|---|---|---|
| CAT-D01 | Menu Structure | 2 ชั้น Category→Product; ไม่มี menu/section table | A / B | ดู CAT-D01 ด้านล่าง | **PENDING** |
| CAT-D02 | Weekly Menu | menu_schedule + 5 RPCs live แต่ 0 callers/0 แถว; authority ปัจจุบัน = available_preorder | A / B | ดู CAT-D02 | **PENDING** |
| CAT-D03 | Product Images | 9/10 รูป = base64 ใน DB (~1MB); bucket bmb-images + media_assets ว่าง, upload path 0 callers | A / B | ดู CAT-D03 | **PENDING** |
| CAT-D04 | Archive Policy | ไม่มี archive field; delete = hard DELETE; order_items ไม่มี FK product_id (snapshot รอด) | A / B | ดู CAT-D04 | **PENDING** |
| CAT-D05 | Add-on Model | products.addons JSONB per-product (id/name/type/options/max_selections/price); server re-price | A / B | ดู CAT-D05 | **PENDING** |

---

## CAT-D01 — MENU STRUCTURE

### Option A: คง 2-layer (Category → Product) — ยืนยันว่าพอ
- **Admin UI:** ไม่ต้องเพิ่มโครงสร้าง; ปรับ UX reorder/validation เท่านั้น
- **Customer PWA:** ไม่กระทบ (อ่าน 2 ชั้นอยู่แล้ว)
- **ordering/visibility/availability:** ใช้ sort_order/is_active/is_available เดิม (server guards คงอยู่)
- **future menu campaigns:** ทำผ่าน is_featured + menu_schedule (ถ้า D02=A) แทน section จริง — ข้อจำกัด: จัดกลุ่มพิเศษต่อหน้าแบบ "หัวข้อใหม่/โปรสัปดาห์นี้" ไม่ได้โดยไม่แก้ UI
- **existing orders:** ไม่กระทบ (snapshot อยู่ใน order_items)
- **migration complexity:** ศูนย์ (ไม่มี migration)

### Option B: เพิ่ม Menu → Section → Category → Product
- **Admin UI:** ต้องมีหน้าจัดการ menu/section (CRUD + reorder + เปิด/ปิด) — งานใหม่ทั้งชุด
- **Customer PWA:** MenuPage ต้อง render ตาม section hierarchy; fallback เมื่อ product ไม่มี section ต้องกำหนด
- **ordering:** เพิ่ม sort_order ระดับ menu+section; ความหมาย sort_order ของ product เปลี่ยนเป็น "ภายใน section"
- **visibility/availability:** เพิ่มเลเยอร์ is_active ระดับ section — ต้องกำหนดว่า section ปิด = product ซ่อน? และ **server guard ต้องเพิ่มการตรวจ section เพื่อไม่ให้ UI hiding ≠ authority แตก** (ปัจจุบัน RLS กรอง is_available เท่านั้น — ถ้าเพิ่ม section แบบ display-only ต้องยอมรับว่า transaction authority ยังไม่เห็น section)
- **future menu campaigns:** รองรับเต็ม (หัวข้อ/แคมเปญต่อเมนู)
- **existing orders:** ไม่กระทบ (order_items snapshot)
- **migration complexity:** กลาง-สูง (ตารางใหม่ + RLS + Admin + PWA + นิยามขอบเขต server guard)

**คำถามประกอบ:** ถ้า B — section ที่ปิด ต้องถูก server ปฏิเสธการสั่งด้วย หรือเป็น display-only?

## CAT-D02 — WEEKLY MENU (menu_schedule / 039)

**Existing capability (production จริง):** ตาราง `menu_schedule(date, product_id)` · RPCs `set_menu_schedule` (is_admin + audit log), `publish_menu_schedule`, `get_menu_for_date`, trigger `enforce_menu_gate` (PRE_ORDER ของวันที่มี schedule published → product_id ต้องอยู่ในเมนูวันนั้น, ERR_PRODUCT_NOT_ON_MENU), `check_product_availability` · business_settings.operating_hours (5 keys = true หมด)
**Current data:** 0 schedules published · **Admin UI:** ไม่มี (0 callers) · **PWA ปัจจุบัน:** ได้รับผลเฉพาะผ่าน `available_preorder` + 038 cutoff
**ความสัมพันธ์กับ available_preorder:** additive — วันที่ไม่มี schedule = available_preorder เป็น authority ตามเดิม; วันที่มี schedule = เฉพาะรายการใน schedule

### Option A: เชื่อม menu_schedule เข้า Admin + Customer PWA จริง
- Admin: หน้า publish weekly menu (date + products + publish) + editor operating_hours
- PWA: PRE_ORDER แสดงเมนูตามวันที่เลือก (อ่าน get_menu_for_date / menu_schedule)
- ผล: ควบคุม "ขายอะไรวันไหน" ระดับ server ต่อวัน/สินค้า — ตรง business intent 039
- Cost: Admin UI + PWA read + runtime verify — **ไม่ต้อง migration (backend พร้อม)**
- Consequence: PRE_ORDER ที่ไม่อยู่ในเมนูวันนั้นจะถูก server ปฏิเสธ — ต้องมี process ประกาศเมนูก่อนเปิดรับ

### Option B: ไม่ใช้ weekly menu — คง available_preorder เป็น authority
- ไม่สร้าง UI; menu_schedule คง DEPLOYED/NOT CONNECTED (ไม่ลบ)
- ผล: ควบคุมได้เฉพาะ "สินค้าเปิด preorder หรือไม่" — ไม่มีระดับวันที่, แคมเปญรายสัปดาห์ทำไม่ได้โดยไม่แก้ is_available ทั้งชุด
- Cost: ต่ำสุด; ยอมรับข้อจำกัด business อย่างชัดเจน

### Option C: ต่อเฉพาะ Admin (publish) ก่อน — PWA display ทำใน gate ถัดไป
- Admin publish → enforce_menu_gate ทำงานฝั่ง server ทันที; PWA ยังแสดงตาม available_preorder
- ผล: ได้ authority ระดับวันที่ก่อน, scope เล็ก; แต่ PWA อาจแสดงสินค้าที่ gate ปฏิเสธ → ต้องยอมรับ UX ชั่วคราว

## CAT-D03 — PRODUCT IMAGES

**จริงปัจจุบัน (probe):** products.image_url = BASE64 9/10 รูป (รวม **998,667 bytes ~1MB ใน DB**, รูปละ 78–127KB); PWA อ่าน field เดิมโดยตรง; bucket `bmb-images` มีอยู่จริง (ว่าง), media_assets ว่าง, `uploadMediaAsset` 0 callers, media_assets RLS = admin ALL USING(is_admin()) + public_read USING(true)

### Option A: คง Base64 ใน DB
- ไม่มี migration; PWA/Admin เดิมทำงานต่อ
- Consequence: SELECT products.* โหลดรูปทุกครั้งที่ลิสต์เมนู (ไม่มี pagination/cache); ขนาด row โตตามเมนู; design path (008/011) ยังไม่ถูกใช้

### Option B: ย้ายไป Supabase Storage / bmb-images + media_assets
- Migration strategy: upload base64 9 รูป → bucket → เก็บ public URL ใน products.image_url → media_assets metadata; เก็บ base64 เดิมเป็น fallback จน verify ครบแล้วจึงตัด
- PWA: FoodMenuCard ใช้ <img src> รองรับ URL อยู่แล้ว — แก้ minimal
- Rollback: คง base64 ใน DB ระหว่างหน้าต่าง migration → กลับไปชี้ค่าเดิมได้
- Risk: ต่ำ (9 รูป ~1MB, controlled) · ผลดี: SELECT เบาลง, cache ทาง Supabase, ใช้ media library จริง (AdminMedia)
- ต้อง migrate data — ห้ามทำรอบนี้ (หลัง decision)

## CAT-D04 — ARCHIVE POLICY

**จริงปัจจุบัน:** products ไม่มี field archived (is_active มีเฉพาะ category); deleteProduct = hard DELETE; order_items ไม่มี FK product_id → ลบได้แม้มี order เก่า; order เก่าแสดงครบจาก snapshot แต่ forensic link ถึง product หายถาวร
**สถานะ schema:** `archived`/`is_active` บน products = **implementation gap เท่านั้น — ไม่เพิ่มเองรอบนี้**

นิยามเสนอ (ถ้าเลือก B): `is_available` = ปิดชั่วคราว (PWA ไม่เห็นเพราะ RLS filter, server ปฏิเสธ, เปิดกลับได้) · `is_active` (category) = ซ่อนทั้งหมวด · `archived` (products, ต้องเพิ่ม) = ปลดถาวรแต่คง row เพื่อ order เก่า/audit, restore ได้

### Option A: คง hard DELETE (สถานะเดิม)
- ไม่มี migration; Owner ต้องยอมรับอย่างชัดเจน: พนักงานลบผิด = ข้อมูล product หายถาวร (ประวัติ order ยังแสดงเพราะ snapshot)

### Option B: Soft archive
- เพิ่ม archived + ห้าม hard DELETE product ที่มี order_items อ้าง; archived ไม่แสดง PWA; ยังอยู่ใน historical order (snapshot ไม่กระทบอยู่แล้ว); restore ได้; is_available ใช้ปิดชั่วคราว
- Cost: migration 1 ไฟล์ + Admin UX (Archive/Restore) + guard

## CAT-D05 — ADD-ON MODEL

**จริงปัจจุบัน:** `products.addons JSONB` per-product; keys จริง: id, name, type(checkbox/radio), options[], max_selections, price; ไม่มี required/min; `compute_addons_price` คิดราคาจาก JSON ฝั่ง server; snapshot อยู่ order_items.customizations; Admin จัดการผ่าน AddonsEditor

### Option A: คง JSONB
- ไม่มี migration; ขยาย schema JSON ได้ทีหลัง (required, min_selections, sort) — ถ้าต้องการ enforce required/min จริง ต้องแก้ `compute_addons_price`/create path ให้ validate (ปัจจุบัน max_selections ถูกอ่านฝั่ง client, server คิดราคาตาม choices)
- ข้อจำกัด: ใช้ซ้ำข้าม product ต้องคัดลอก; แก้กลุ่ม = แก้ทีละ product; ไม่มี catalog add-on แยก

### Option B: normalized (addon_groups → addons → product_addon_groups)
- ได้: ใช้ซ้ำข้ามสินค้า, จัดกลุ่ม, required/min/max ชัดระดับ DB, ordering ต่อกลุ่ม
- Cost: migration + RLS + Admin UI ใหม่ + PWA อ่านกลุ่มแทน JSON + **`compute_addons_price`/`create_order_with_items` ต้องเปลี่ยนอ่านจากตาราง (แตะ canonical order path — ความเสี่ยงสูงสุดของทั้ง 5 decisions)** + data migration ย้าย JSON เดิม (4 products) + backward compat: order เก่าไม่กระทบ (snapshot), order flow ใหม่ต้อง regression ครบ

---

## STEP 3 — IMPLEMENTATION DEPENDENCY MATRIX (evidence-based; จะ fix ตัวเลข gate หลัง Owner ตอบ)

| Gate | Depends On | Migration | Admin | PWA | RPC | Data Migration | Risk |
|---|---|---|---|---|---|---|---|
| CAT-01 Catalog CRUD hardening (reorder UX + validation + catalog audit log) | — (ต้องทำเสมอ ไม่ขึ้น D01–D05) | ไม่ (อาจเพิ่ม audit trigger ภายหลัง) | AdminProducts UX | ไม่กระทบ | ไม่แตะ | ไม่ | ต่ำ |
| CAT-02 Weekly menu Admin (+PWA ตาม D02 เลือก) | **CAT-D02** | ไม่ (039 พร้อม) | publish UI + operating_hours editor | ถ้า A: เมนูตามวัน | ไม่แตะ (ใช้ของเดิม) | ไม่ | ต่ำ-กลาง |
| CAT-03 Archive policy | **CAT-D04** | ถ้า B: +archived field + DELETE guard | Archive/Restore UX | ไม่แสดง archived (เดิมกรองอยู่แล้ว) | guard ใหม่ | ไม่ | ต่ำ |
| CAT-04 Media/storage | **CAT-D03** | ไม่ (schema พร้อม) | ต่อ uploadMediaAsset + AdminMedia | รองรับ URL อยู่แล้ว | ไม่แตะ | ย้าย 9 รูป base64→bucket | ต่ำ (controlled) |
| CAT-05 Add-on model | **CAT-D05** | ถ้า B: 3 ตาราง + แก้ compute_addons_price | AddonsEditor ใหม่ | อ่านกลุ่มแทน JSON | **แตะ canonical order path** | ย้าย JSON 4 products | **สูง** |
| CAT-06 E2E controlled verify | ทุก gate ก่อนหน้าที่ implement | — | — | — | — | — | ต่ำ |

ลำดับแนะนำ (ตาม risk + dependency): CAT-01 → CAT-02 → CAT-03 → CAT-04 → CAT-05 → CAT-06 (CAT-05 ก่อนหรือหลัง CAT-04 ได้ แต่ไม่ควร overlap กับ gate อื่น — one gate per commit + HARD STOP เหมือนเดิม)

## STEP 4 — PRESERVE EXISTING AUTHORITY (ข้อผูกของ implementation ทุก gate ในอนาคต)

Implementation ใด ๆ ต่อไปนี้ **ต้องไม่ทำลาย** (ยืนยันใน contract ของแต่ละ gate):
- **server-side pricing** — client ส่งราคาไม่ได้เสมอ; ราคาสุดท้ายคำนวณใน `create_order_with_items`
- **`create_order_with_items`** — เป็นจุดเดียวของการสร้าง order (transition/อนุมัติผ่าน state machine เดิม)
- **order item snapshot** — order_items (product_name/unit_price/item_total/customizations) ห้ามถูก re-price/JOIN กลับ catalog ตอนอ่าน
- **product availability guard** — ERR_PRODUCT_UNAVAILABLE + check_product_availability + 038 cutoff + 039 gate คงเป็น authority
- **canonical `order_id`** — ห้ามสร้าง identifier ขนาน
- **existing order history / existing orders** — การเปลี่ยน catalog ต้องไม่เปลี่ยนค่าใน order เก่า (ตรวจด้วย regression: order เก่าคงราคา/สินค้าเดิมหลังแก้ catalog)
- **existing RLS** — public_read/admin_manage ของ products/product_categories/media_assets ไม่ถูกผ่อน
- **admin authorization** — ทุกเขียน catalog ผ่าน is_admin() จริง
- **Customer PWA canonical catalog read** — ห้าม static/hardcoded catalog หรือ source of truth ชุดที่สอง; ห้าม mock API เป็น operational path

## STEP 5 — GATE RESULT

**OWNER DECISION REQUIRED** — CAT-D01..D05 ทั้งหมดยัง `PENDING` · ห้าม implement CAT-01..CAT-06 จนกว่า Owner จะตอบครบ 5 ข้อ (และคำถามประกอบของ D01 ถ้าเลือก B: section ปิด = server reject หรือ display-only)

สถานะรวม (vocabulary ที่กำหนด): products/categories CRUD = **CONNECTED** (Admin→DB→PWA, runtime verified ทางโค้ด+RLS; การยิงจริงหลัง implementation ใช้ controlled TEST data) · weekly menu backend = **DEPLOYED/NOT CONNECTED** · media/storage backend = **DEPLOYED/NOT CONNECTED** · archive = **MISSING** · section/menu = **MISSING** (เว้นแต่ Owner เลือก B) · add-on enforce required/min = **MISSING** (max_selections อ่านฝั่ง client, ราคา enforce ฝั่ง server = CONNECTED) · ทั้งหมดยังไม่ IMPLEMENTED ในรอบนี้ (DEFERRED จนกว่า decisions)

## FINAL REPORT (11 ข้อ)

1. **Production evidence checked:** ✅ schema/probe/RPC/RLS/bucket/base64/016-JSON-keys ยืนยันใหม่รอบนี้ (read-only)
2. **Current architecture:** Category→Product→addons JSONB; menu_schedule+media = deployed/ไม่ถูกใช้
3. **CAT-D01 ต้องตัดสิน:** PENDING (A=คง 2 ชั้น / B=เพิ่ม Section)
4. **CAT-D02 ต้องตัดสิน:** PENDING (A=ต่อเต็ม / B=ไม่ใช้ / C=ต่อ Admin ก่อน)
5. **CAT-D03 ต้องตัดสิน:** PENDING (A=คง base64 / B=Storage+media_assets, ต้อง data migration 9 รูป)
6. **CAT-D04 ต้องตัดสิน:** PENDING (A=คง hard delete ยอมรับความเสี่ยง / B=soft archive)
7. **CAT-D05 ต้องตัดสิน:** PENDING (A=คง JSONB / B=normalized แตะ order path)
8. **Dependency matrix:** ตาราง STEP 3 ข้างบน
9. **Implementation sequence proposal:** CAT-01→02→03→04→05→06 (หนึ่ง gate ต่อหนึ่ง commit + HARD STOP)
10. **Security/data-integrity:** คง RLS is_admin, server re-price, snapshot, canonical order spine — ระบุใน STEP 4; ความเสี่ยงสูงสุดเดียว = CAT-D05 Option B (แตะ create path)
11. **🔴 HARD STOP:** NO IMPLEMENTATION · NO MIGRATION · NO PRODUCTION MUTATION — รอ Owner ตอบ CAT-D01..D05 ครบก่อนเริ่ม gate แรก
