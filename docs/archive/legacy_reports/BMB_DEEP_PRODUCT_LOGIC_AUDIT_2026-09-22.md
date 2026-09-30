# BMB — DEEP PRODUCT LOGIC & BUSINESS TRUTH RECONCILIATION AUDIT

> **วันที่ตรวจ:** 2026-09-22 · **HEAD:** `c5b5467` (main = origin/main) · **Repo:** `bitemebaby2016-coder/bmb`
> **ชนิดงาน:** AUDIT ONLY — ห้ามแก้ code / DB / migration / docs เพื่อปิด gap · ไม่แตะต้อง selfprint (คนละ repo)
> **วิธี:** reconstruct ระบบจริงจาก Actual Code → Migrations (Live DB ผ่าน db push 001–022) → RPC/Edge Functions → Runtime paths (UI → query) → เทียบกับเอกสาร แล้วรายงาน contradiction ตรง ๆ
> **ลำดับความน่าเชื่อถือที่ใช้:** Code > Live DB schema > RPC/EF > Runtime > Tests > เอกสาร — **Code/DB wins เสมอ**
> **Known Evidence (ใช้เป็นพื้นฐาน ไม่ใช่ข้อสรุป):** 163/163 tests · 29/29 SQL contracts · 22 migrations applied · Build/Lint/CI PASS — รายงานนี้ไม่นำตัวเลขพวกนี้มาสรุปว่า "เสร็จ" เพราะพิสูจน์แล้วว่า 29/29 contracts คือ **negative deployment probes** (`e2e/sqlContracts.cjs` — เรียก RPC ด้วย input ตั้งใจผิด แล้วเช็คว่า "ยัง deploy อยู่ + reject ได้") ไม่ใช่การพิสูจน์ business rule

---

# A. EXECUTIVE TRUTH

## A.1 คำตอบตรง ๆ ว่าระบบอยู่ระดับไหน

**BMB วันนี้คือ "ระบบสั่งซื้อ same-day ที่ money/order spine แข็งจริง + pre-order ที่หยุดอยู่แค่แถวข้อมูลในตาราง"**

| ระดับ | สรุป |
|---|---|
| **VERIFIED จริง (มี code + DB + RPC + flow เชื่อมครบตั้งแต่ต้นจนจบ)** | (1) การสร้างออเดอร์ same-day แบบ server-authoritative (007→016→020): ราคา/ส่วนลด/โปรโมชั่น/ค่าส่ง derive ฝั่ง server จาก DB, client ส่งราคามาได้แต่ถูก ignore, capacity lock แบบ `FOR UPDATE` + trigger `orders_increment_round`, atomic INSERT order+items (2) Payment spine: `record_payment_result` (service_role เท่านั้น, idempotent, amount-match กับ `orders.total_amount`), COD ต้อง `delivered` ก่อน, PromptPay ต้องมี TXN reference ก่อน, `create-checkout` EF re-derive ยอดจาก DB, Stripe webhook verified จริง 6/6 (2026-09-19) (3) Order state machine ฝั่ง server: allow-list + BEFORE UPDATE trigger + audit log + hook inventory ตอน confirm/cancel (018/019) (4) RLS hardening + is_admin() + audit log (005/006/014/018) (5) การสร้าง pre-order แถวเดียว (017): gate `is_preorder`, ล็อก capacity รอบ, cancel คืน capacity |
| **VERIFIED แต่ logic integration ยังไม่ครบ (function มีจริง แต่ไม่มีใคร consume หรือ enforce)** | recipes/BOM (KIT-02), production_batches + kitchen_queue (KIT-01), drivers/delivery_assignments (DEL-02), `compute_delivery_fee` zone-based (DEL-01), availabilityEngine (quota+cutoff), `transition_order_status` owner-cancel path, `upsert_driver`/`assign_driver` — รายละเอียดอยู่ใน Section E |
| **PARTIAL** | Refund (EF พร้อม ไม่มีบิลจริง), Card loop (ไม่มีบิลจริง), หน้าจัดการ inventory ฝั่ง admin (localStorage ไม่ใช่ DB), Lighthouse production |
| **MISSING จริง (business requirement ต้องการแต่ระบบไม่มี)** | การ enforce **cutoff** ทั้ง same-day/pre-order/round · การบังคับ **กฎ 5 กม.** ฝั่ง backend · **การชำระเงินของ pre-order ทั้งระบบ** · pre-order → ครัว (batch) · pre-order → delivery (ที่อยู่จริง) · ปุ่มยกเลิกของลูกค้า (orders + pre-orders) · UI จัดการ recipe/BOM · UI สร้าง driver assignment · หน้าติดตามออเดอร์ที่อ่าน DB จริง |
| **DOCUMENT CONTRADICTION** | BMB_MASTER_PRODUCT_SPEC §7/§8/§9 ขัดแย้งกับ CURRENT_STATE + migration 019/020 (รายละเอียด Section F) |
| **ARCHITECTURE GAP** | pre_orders เป็น "ตารางเกาะ" (island table): ไม่มี FK ไป orders, ไม่มี payment, ไม่มี kitchen, ไม่มี delivery pipeline — mode สองอันคือระบบสองชุดที่แชร์แค่ products/delivery_rounds/addons |
| **BUSINESS RISK สูงสุด (P0)** | (1) ตัดสินใจขายโดยไม่มี cutoff → รับออเดอร์เกินกำลังผลิตได้เสมอ (2) capacity รั่วเมื่อยกเลิก same-day (trigger +1 ตอนสร้าง แต่ไม่มี -1 ตอน cancel) → ปิดรอบก่อนเวลาแบบถาวร (3) deduct วัตถุดิบ clamp ที่ 0 และมี bug `v_done_ids` → สต็อกคลาดเคลื่อนเงียบ ๆ (4) pre-order จองได้โดยไม่มีการชำระเงินและไม่มีที่อยู่จริง → ครัวผลิตแล้วส่งไม่ได้/เก็บเงินไม่ได้ |

## A.2 คำถามคานหางของ audit (ตอบด้วยหลักฐาน ไม่ใช่ชื่อ function)

| คำถามคานหาง | คำตอบจากหลักฐาน |
|---|---|
| ใครตัดสินว่า product ขายได้? | ตอนเช็คเอาต์: `create_order_with_items` เทียบแค่ `products.is_available` (020 L286-297) + `delivery_rounds.status='active'` + `(current_count+1) <= max_capacity` — **ไม่เทียบ cutoff_time, ไม่เทียบ is_preorder, ไม่เทียบ inventory คงเหลือ** |
| ถ้าลูกค้าสองคนสั่งพร้อมกัน? | same-day: ชนะเพราะ row lock รอบ + check `(cur+1)>max` → คนถัดไปโดน `ERR_CAPACITY_FULL` (ถูกต้องสำหรับจำนวนออเดอร์) — แต่นับ **ชิ้นอาหารไม่ได้** (สั่ง 100 ชิ้นใน 1 ออเดอร์ = กิน 1 slot) |
| ถ้าสั่ง Pre-Order แล้ว cancel? | pre-order: `cancel_pre_order` คืน capacity ได้ (017 L243-247) — same-day: **ไม่มีการคืน capacity เลย** เพราะ trigger increment ตอน INSERT แต่ไม่มี hook decrement ตอน `status='cancelled'` → capacity รั่วถาวร (ยืนยันจาก 001 trigger + 019 transition ที่ restore เฉพาะ inventory) |
| Kitchen รู้ได้อย่างไรว่าเป็น Pre-Order batch? | **ไม่รู้ — เพราะไม่มี**: `create_production_batch` ดึงเฉพาะจาก `orders WHERE status IN ('confirmed','preparing')` (019) — `pre_orders` ไม่ถูกดึงเข้า batch ตายตัว |
| Delivery รู้ได้อย่างไรว่าต้องส่งรอบไหน? | จาก `orders.delivery_round_id` แต่ rider PWA (`my_deliveries`) ไม่แสดงรอบ และไม่มี UI สร้าง `delivery_assignments` จากฝั่ง admin → ทั้ง loop นี้ต้องรัน SQL มือเท่านั้น |
| Customer เห็นสิ่งเดียวกับที่ backend ตัดสิน? | **ไม่ใช่** — หน้า track ออเดอร์ (`OrderTrackPage.tsx`) เป็น mock ล้วน: `useState('preparing')` + auto-advance ทุก 30 วิ + รายการอาหาร "ผัดไทย x2, ข้าวแกง x1" + ราคา 230 บาท hardcode ทั้งหน้า ไม่มีการ query DB แม้แต่บรรทัดเดียว |

---

# B. PRODUCT MODEL MAP (reconstruct จาก Code + Migrations — ไม่มีจินตนาการ)

## B.1 Entity Inventory จริงจาก migrations 001–022 (ส่วนที่ 1)

| # | Entity | ตารางจริง | ใครสร้าง/แก้ | ใคร consume | สถานะจริง |
|---|---|---|---|---|---|
| 1 | **Product** | `products` (001): id TEXT PK, FK `category_id`, `is_preorder`, `is_available`, `is_featured`, FK `delivery_round_id`, `scheduled_date`, `stock`(012 display), `addons` JSONB (016) | Admin UI (`AdminProducts.tsx` → `bmbAdminApi_products.ts`) + seed | MenuPage/HomePage, RPC order creation (`FOR UPDATE`), INV-02 flip | VERIFIED |
| 2 | **Category** | `product_categories` (001): 5 seed (จานเดียว/ข้าว/แกง/**เครื่องดื่ม cat-4**/**ของหวาน cat-5**) | Admin PHASE 6 "category headings manager" = ตัวนี้ | MenuPage filter, homeProviders | VERIFIED |
| 3 | **Menu Section/Heading** | **NOT FOUND IN DB** — ไม่มี `menu_sections` | — | — | **MISSING** (ดู B.2) |
| 4 | **Add-on** | `products.addons` JSONB (016) — ไม่ใช่ตาราง | Admin `AddonsEditor.tsx` (แก้ JSON) | OrderBuilder UI, `compute_addons_price` re-derive ตอนจ่าย | VERIFIED (server-authoritative จริง) |
| 5 | **Availability (product)** | `products.is_available` + engine `src/lib/availabilityEngine.ts` (quota+cutoff) | INV-02 flip อัตโนมัติเมื่อ stock<min | **เฉพาะ `AdminControl.tsx` + unit test — ไม่ถูกเรียกใน flow ซื้อ** | **PARTIAL / integration MISSING** |
| 6 | **Order Mode** | ไม่มี enum OrderMode ใน DB — คือ `products.is_preorder` boolean + **ตาราง 2 ชุด**: `orders` (same-day) vs `pre_orders` (pre-order) | Admin (แต่ **AdminProducts form ไม่มี toggle is_preorder**) | MenuPage tab, homeProviders split | **PARTIAL** — สินค้าเดียวขายสองโหมดพร้อมกันไม่ได้ (ผลพวงจาก boolean เดียว) |
| 7 | **Target Date** | `pre_orders.scheduled_date` + `products.scheduled_date` + `delivery_rounds.scheduled_date`/`date` (alias sync trigger 002) | ลูกค้าเลือกตอนจอง (default วันนี้+3 วัน) | RPC 017 ตรวจ `ERR_ROUND_DATE_MISMATCH` | PARTIAL |
| 8 | **Delivery Round** | `delivery_rounds` (001): cutoff_time, delivery_start/end, max_capacity, current_count, status, alias 4 คอลัมน์ (trigger 002) | seed round-1/2/3 + AdminRounds UI | Checkout (**hardcode map `{morning:'round-1',…}`**), pre-order UI, ครัว | VERIFIED ตัวตาราง / cutoff ไม่ถูก enforce (ดู E) |
| 9 | **Cutoff** | คอลัมน์ `cutoff_time` เท่านั้น | AdminRounds แก้ได้ | StoreStatus strip (แสดงข้อความ) | **MISSING as enforcement** — grep ทั้ง 22 migrations ไม่มีการเทียบ `cutoff_time` กับเวลาปัจจุบัน |
| 10 | **Capacity** | `max_capacity`/`current_count` | trigger `orders_increment_round` (+1 per order), RPC 017 (+1 per pre-order แถว) | ตรวจตอนสร้าง (row lock) ทั้งสองโหมด | VERIFIED per-order / **GAP**: ไม่คืนเมื่อ cancel same-day, ไม่นับ quantity, ไม่ auto-close |

## B.1 Entity Inventory จริงจาก migrations 001–022 (ส่วนที่ 2 — ต่อ)

| # | Entity | ตารางจริง | ใครสร้าง/แก้ | ใคร consume | สถานะจริง |
|---|---|---|---|---|---|
| 11 | **Order** | `orders` (001): order_number unique, `customer_ref` UUID, status enum 10 ค่า, ทุก field เงิน | RPC `create_order_with_items` (007→016→020) เท่านั้น; แก้ status ผ่าน RPC `transition_order_status` + trigger กัน skip | AdminOrders, rider `my_deliveries`, OrdersPage, EF create-checkout/stripe-webhook | VERIFIED |
| 12 | **Order Item** | `order_items` (001): unit_price authoritative, `customizations` (addon snapshot 016/020) | RPC เดียวกัน | AdminOrders hydrate, rider | VERIFIED |
| 13 | **Kitchen Batch** | `production_batches` + `production_batch_items` (019) | RPC `create_production_batch` — **ไม่มี page ใดเรียกเลย** (มีเฉพาะ `kitchenService.ts` wrapper + test) | `kitchen_queue` RPC | **CODE EXISTS / BUSINESS LOGIC INCOMPLETE** — batch ดึงเฉพาะ `orders` status confirmed/preparing, **`pre_orders` ไม่ถูกดึงเข้า batch ตายตัว** |
| 14 | **Recipe/BOM** | `recipes` (019): UNIQUE(product,ingredient), quantity_per_unit; seed 6 แถว | seed SQL เท่านั้น — **ไม่มี UI จัดการ BOM เลย** | `deduct_inventory_for_order`, `get_inventory_requirements`, INV-02 | **CODE EXISTS / เกาะไม่ครบ** กับ availability ตอนสั่งและกับ pre-order |
| 15 | **Inventory** | `inventory` + `inventory_transactions` (001/019); seed 4 รายการ | RPC deduct/restore + INV-02; **UI InventoryPage แก้ใน localStorage เท่านั้น** (`inventoryStore` Zustand — `bmbAdminApi_inventory.ts` มีตัวจริงแต่ไม่มี page ใช้) | deduct ตอน confirm / restore ตอน cancel-failed / sold-out flip | **SPLIT-BRAIN สองโลก**: หน้าจอ admin = localStorage; ตัวตัดสินขาย = DB |
| 16 | **Delivery Zone** | `delivery_zones` (008; seed 020: 0–5กม.=25฿, 5–10=45฿, 10–20=80฿) | seed SQL เท่านั้น — **ไม่มี admin UI** | `compute_delivery_fee` (server) | PARTIAL |
| 17 | **Delivery Method** | enum 4 ค่า (self_delivery/grab/linemen/foodpanda) | ลูกค้าเลือกผ่าน provider picker ฝั่ง client (`getBestProvider` mock pricing) | RPC order, `provider_orders` (ไม่มีใครใช้จริง) | PARTIAL — ไม่มี validation ระยะ↔method ฝั่ง server |
| 18 | **Driver** | `drivers` + `delivery_assignments` (020) | RPC `upsert_driver` — **ไม่มี page เรียก** | RiderPwaPage (login/my deliveries/accept/update) | **CODE EXISTS / dispatch loop ไม่ครบ**: ไม่มี UI assign + `driver_update_delivery_status` **ไม่ sync `orders.status`** |
| 19 | **Route** | **NOT FOUND IN DB** — `routeOptimization.ts` เป็น client lib; `DeliveryManagement.tsx` ใช้ **MOCK_DRIVERS 3 คน hardcode** + localStorage `bmb_provider_orders` | — | — | **MISSING/MOCK** |
| 20 | **Payment** | `payment_intents` (001+008/010): payment_intent_id unique (idempotency), amount-match | RPCs + EF create-checkout/stripe-webhook (service_role เท่านั้น) | PaymentConfirmationPage, AdminOrders | **VERIFIED สำหรับ orders — MISSING ทั้งหมดสำหรับ pre_orders** (ไม่มี payment field; `create_payment_intent_record` lookup ใน `orders` → PO-* โดน `ERR_ORDER_NOT_FOUND`) |
| 21 | **Customer** | `customers` (001, id=auth.uid()::text RPC upsert) + `profiles` + 015 location | auth + RPC upsert อัตโนมัติ | RLS, AdminCustomers, intelligence 022 | VERIFIED |
| 22 | **Promotion/Coupon** | `promotions` (001) + is_banner/banner_image (016) | Admin AdminPromotions + banner approval gate (022) | RPC order (server-authoritative); CartPage เป็น preview client เท่านั้น | VERIFIED |
| 23 | **Loyalty** | `loyalty_points` (001) — **ไม่มี RPC/UI/flow เชื่อม** | — | RewardsPage (client display) | **DOCUMENT-ONLY/MOCK** |
| 24 | **Pre-order Vote** | `preorder_votes` (001) | VotePage | VotePage display | แสดงผลเท่านั้น ไม่เชื่อมการสร้าง pre-order |
| 25 | **Menu (รวม)** | ไม่มี entity `menu` — คือ render จาก products+categories+**hardcode sections** | — | — | — |

## B.2 คำตอบคำถามหัวใจ Section 4 ของ brief (trace จริง DB → types → query → admin → PWA → order)

- **Product จริง ๆ คือ?** แถวใน `products` — ราคา/โหมด/availability/add-ons อยู่ในแถวเดียว; `stock/rating/review_count` (012) เป็น display เท่านั้น
- **Category คือ?** `product_categories` (ใช้ filter/icon/sort); "heading" ใน PHASE 6 = ตัวนี้ ไม่มีชั้น heading แยก
- **"น้ำ" และ "ทานเล่น" จริง ๆ คือ?** → **หลายชั้นร่วมกันแบบไม่เชื่อมกัน**:
  - "น้ำ" = (ก) category cat-4 'เครื่องดื่ม' ใน DB (มี prod-4 กาแฟเย็น — สั่งซื้อได้จริง) + (ข) `DRINKS_MENU` mock 5 รายการ comingSoon บน Home (`drinksMenu.ts` + `DrinksSection.tsx`)
  - "ทานเล่น" = (ก) **ไม่มี category ใน DB เลย** (ไม่มี slug snack) + (ข) `SNACKS_MENU` mock 5 รายการ (`snacksMenu.ts` + `SnacksSection.tsx`)
  - **MISSING RELATIONSHIP**: DRINKS_MENU/SNACKS_MENU ↔ `products` — ไม่มี id mapping, ไม่ผ่าน admin CRUD, สั่งซื้อไม่ได้, ลูกค้า "เห็นของที่สั่งไม่ได้" ขณะที่ของที่สั่งได้ (cat-4) ไม่แสดงใน Section นั้น
- **Product อยู่ใน Category อย่างไร?** FK เดียว `category_id` → 1 สินค้า 1 หมวด (อยู่หลายหมวดไม่ได้)
- **Product หนึ่งตัวอยู่หลาย Section ได้ไหม?** ไม่มี Section entity จริง → คำตอบในเชิงระบบจริง: **ไม่สามารถแสดงได้** เว้นแต่ hardcoded (ไม่เชื่อมข้อมูล)
- **Category กับ Section เป็น entity เดียวกันไหม?** ใน DB มีแค่ Category; Section เป็น concept ฝั่ง UI ที่ถูก hardcode เท่านั้น

Chain จริงที่พิสูจน์ได้:

```text
Product (products, FK category_id)
  → Category (product_categories)            [REAL]
  → Section (drinks/snacks)                   [MOCK — hardcode, ไม่เชื่อม DB]
  → PWA Display (MenuPage tab filter + HomePage) [REAL ต่อ category / MOCK ต่อ section]
  → Cart (cartStore)                          [REAL]
  → Checkout (CheckoutPage → RPC create_order_with_items) [REAL]
  → Order Item (order_items, unit_price จาก DB + addons re-derive) [REAL]
```

---

# C. ORDER MODE MODEL — SAME-DAY vs PRE-ORDER (ไม่ใช่ UI option เดียว แต่เป็น "สองระบบที่เกือบไม่เกี่ยวกัน")

| มิติ | SAME-DAY | PRE-ORDER | ต่างกันจริงไหม |
|---|---|---|---|
| ตารางข้อมูล | `orders` + `order_items` | `pre_orders` (ตารางเกาะ ไม่มี FK ไป orders) | คนละระบบ |
| RPC สร้าง | `create_order_with_items` (007/016/020) | `create_pre_order_with_items` (017) | คนละ RPC พร้อม gate ต่างกัน |
| Gate ฝั่ง server ต่อโหมด | ตรวจ `is_available` + round status + capacity — **ไม่บล็อกสินค้า is_preorder=true** (020 L286-297) | บล็อก `ERR_NOT_PREORDER_PRODUCT` + `ERR_PRODUCT_UNAVAILABLE` (017 L74-79) | **กันไม่สมมาตร**: สินค้า pre-order ซื้อแบบ same-day ได้ |
| ราคา | server re-derive + add-on + promo + fee | server re-derive เฉพาะ base price × qty (ไม่มี add-on, ไม่มี promo, ไม่มีค่าส่ง) | ต่างกันมาก |
| Cutoff | **ไม่ enforce** | **ไม่ enforce** | เท่ากัน (ต่างพร้อมกันหาย) |
| Capacity | row lock + trigger +1/ออเดอร์; ตรวจ `(cur+1)>max` → `ERR_CAPACITY_FULL` | row lock + ตรวจ `cur>=max` → `ERR_ROUND_FULL` + +1 ตอนสร้าง | ใกล้กัน แต่ cancel คืนได้เฉพาะ pre-order |
| การชำระเงิน | ครบวงจร (promptpay TXN→processing→admin confirm / COD หลัง delivered / card ผ่าน Stripe EF+webhook) | **ไม่มีทั้งระบบ** (ไม่มี payment field, สร้าง intent ไม่ได้) | **MISSING ทั้งโหมด** |
| Kitchen | เข้า `production_batches` ได้เมื่อ confirmed/preparing | **ไม่เข้า batch เลย** | **MISSING downstream** |
| Inventory | deduct ตอน confirm / restore ตอน cancel-failed | **ไม่มี deduct/restore ทั้งหมด** | ต่างกัน |
| ที่อยู่จัดส่ง | ลูกค้ากรอกจริง (lat/lng + detail) | HomePage/MenuPage **hardcode พิกัด 10.7016,102.1429 + delivery_address:''** | **MISSING** |
| State machine | allow-list 10 สถานะ + trigger + audit | สถานะอิสระ 8 ค่า (client type), แก้ตรง ๆ ได้เฉพาะ admin (RLS), ไม่มี guard/trigger/audit | ต่างกันแบบไม่สมดุล |
| การยกเลิก | RPC รองรับ owner-cancel จาก pending **แต่ไม่มีปุ่มใน UI ลูกค้า**; admin cancel ไม่คืน capacity | `cancel_pre_order` (owner/admin) คืน capacity — **แต่ไม่มีปุ่มใน UI ลูกค้าเช่นกัน** | คู่ขนานกันพร่อง |
| คำถาม brief §5: "Product ขายทั้งสอง mode ได้ไหม?" | — | — | **ไม่ได้** — `is_preorder` boolean เดียว: true = เฉพาะ pre-order, false = เฉพาะ same-day; ต้องการ Product A (ทั้งสองโหมด) = ทำในโมเดลปัจจุบันไม่ได้ |
| Scenario E (pre-order only) | — | — | กันได้ครึ่งเดียว: 017 กันขาว แต่ same-day RPC ไม่กันสินค้า is_preorder=true → **backend ไม่ได้ป้องกันจริงทุกทาง** |
| Scenario F (same-day only) | — | — | กันได้จริง (`ERR_NOT_PREORDER_PRODUCT`) |

---

# D. END-TO-END BUSINESS FLOWS (reconstruct จาก code จริง)

## D.1 SAME-DAY (flow จริงที่สมบูรณ์ที่สุด)

```text
Menu/Home → Product (is_preorder=false) → OrderBuilder (addons)
  → cartStore.addItem (ราคา client ประมาณเอง - server จะ derive ใหม่)
  → CheckoutPage (auth required - guest โดน redirect ไป login)
  → แผนที่ round HARDCODE {morning:'round-1', midday:'round-2', evening:'round-3'}   <- gap
  → provider picker (getBestProvider - client mock pricing, บังคับเลือกก่อนกด)
  → createOrder → RPC create_order_with_items (v2, 020)
      ราคา base + addon + promo + fee = derive ฝั่ง server (client totals ถูก ignore)
      round lock FOR UPDATE + capacity + is_available
      INSERT orders(pending) + order_items(unit_price=DB) + trigger current_count+1
  → createPaymentIntent (RPC, amount = DB total)
  → /payment → PromptPay submit TXN (pending→processing) | COD | Card ผ่าน EF
  → admin confirm_offline_payment ตาม rule → payment_status='paid'
  → admin transition confirmed → deduct_inventory_for_order (INV-01)
  → preparing → ready_for_dispatch → ...
```

จุดที่หักใกล้จบ: (1) ปุ่ม Delivered ของ AdminOrders จาก ready_for_dispatch ข้าม state machine → DB ปฏิเสธ (ต้อง dispatched→in_transit→arrived ก่อน) → **ปิดงานจาก UI ตามปกติไม่ได้** (2) ไม่มี UI สร้าง `delivery_assignments` → rider เห็นงานได้ต่อเมื่อรัน SQL มือ (3) rider ทำงานผ่าน RiderPWA แต่ `driver_update_delivery_status` อัปเดตเฉพาะ assignment - **orders.status ไม่ขยับ** → ออเดอร์ไม่เคย delivered โดยระบบ

## D.2 PRE-ORDER (จบแค่ 1 ขั้น)

```text
Menu/Home (tab จองล่วงหน้า, is_preorder=true)
  → createPreOrder → RPC 017: gate is_preorder + round lock + capacity + date-match
  → pre_orders(status='pending') + customers upsert
  → navigate /track/PO-... → หน้า track เป็น mock
  ─── จบจริง ๆ ตรงนี้ ───
  ไม่มี payment ทุกขั้น (จอง = ฟรี, ครัวไม่รู้, เก็บเงินไม่ได้)
  ไม่มีที่อยู่จริง (hardcode พิกัดกลางเมือง + address ว่าง)
  ไม่เข้า batch ครัว, ไม่มี inventory deduct, ไม่มีผูกกับ route
  admin แก้ status ได้เฉพาะ direct update ผ่าน RLS admin - ไม่มีหน้า admin ของ pre-orders
```

## D.3 Flow เหตุการณ์พิเศษ (product unavailable / capacity full / cutoff / inventory / cancel / payment failure)

| Flow | พฤติกรรมจริงที่พิสูจน์แล้ว | สรุป |
|---|---|---|
| **Product unavailable** | `is_available=false` → RPC reject `ERR_PRODUCT_UNAVAILABLE` ทั้งสองโหมด; INV-02 flip อัตโนมัติเมื่อ stock<min หลัง deduct | REAL แต่ผิดจังหวะ (ปิดท้าย ไม่ใช่กันหน้า) |
| **Capacity full** | same-day: `ERR_CAPACITY_FULL` (row lock) · pre-order: `ERR_ROUND_FULL` — UI ไม่มีการซ่อน/ปิดปุ่มล่วงหน้า → ลูกค้าเจอ error ตอนกดจ่าย (reject-at-checkout) | REAL atomic / UX พร่อง |
| **Cutoff passed** | **ไม่มีการตรวจ cutoff_time ใน SQL/RPC ใดเลย** → สั่งรอบเช้าได้ตอน 22:00 ตราบใดที่ round ยัง 'active'; logic cutoff มีอยู่แห่งเดียวคือ availabilityEngine — **ไม่ถูกเรียกใน flow ซื้อ** | **MISSING ทุกชั้น** |
| **Inventory insufficient** | ไม่ block การสั่ง — deduct ตอน confirm ด้วย `GREATEST(current_stock - qty, 0)` (clamp 0, ไม่ error) + **bug `v_done_ids`**: หากหลาย order_item ในใบเดียวกันใช้วัตถุดิบชนิดเดียวกัน (prod-1 และ prod-2 ต่างก็ใช้ ing-1) การ deduct ของ item ถัดไปถูก **skip** (019 L128) → หักขาดเงียบ ๆ | **BROKEN (silent under-deduct + no availability tie)** |
| **Cancel** | ลูกค้า: RPC รองรับ cancel จาก pending แต่ **ไม่มีปุ่มใน OrdersPage** · admin cancel → restore inventory + audit — **แต่ capacity ไม่ถูกคืน** (trigger +1 ที่ INSERT ไม่มีคู่ -1) → รอบรั่วจนกว่า admin กด "Reset capacity" มือ · pre-order cancel คืน capacity จริง | PARTIAL + **capacity leak (P0)** |
| **Payment failure** | `mark_payment_failed` ตั้ง intent='failed' แต่ `orders.payment_status` ค้าง 'pending' (enum ไม่มี failed state) → ลูกค้าเห็น "รอชำระ" ต่อไป ไม่มี recovery UX; ฝั่ง card: webhook failed → intent failed, order ค้าง pending | PARTIAL (recovery ไม่ครบ) |

## D.4 Scenario matrix (A–J ตาม brief)

| Scenario | ผลจากหลักฐาน |
|---|---|
| A — Same-Day main dish | ผ่านถึง "paid + confirmed + หักของ" — ส่วนท้าย (ready→delivered→assignment→rider) หักพังจาก UI↔DB mismatch |
| B — Pre-Order main dish | ผ่านแค่ "จอง = แถว pending + capacity" — target date/round มีจริง แต่ payment/batch/delivery ไม่มี |
| C — Drink | สองโลก: cat-4 สั่งได้จริง; DrinksSection mock สั่งไม่ได้ — **ไม่ใช่ catalog เดียวกัน** |
| D — Snack | "ทานเล่น" ไม่มีใน DB ทั้ง category ทั้ง product — มีแต่ mock |
| E — Pre-order only product | กันได้ฝั่ง pre-order RPC; ฝั่ง same-day RPC **ไม่กัน** (ซื้อทันทีได้) |
| F — Same-day only product | กันได้จริง (`ERR_NOT_PREORDER_PRODUCT`) |
| G — Capacity full | atomic reject จริงทั้งสองโหมด |
| H — Cutoff passed | **ไม่ถูก enforce ทุกชั้น** (same-day/pre-order/round); admin closing = แก้ status มือเท่านั้น |
| I — Inventory insufficient | **ไม่กัน** — clamp 0 + skip bug; availability ไม่ผูก stock ณ จุดสั่ง |
| J — Cancel | RPC ครบ (owner-cancel + pre-order cancel) — UI ลูกค้าไม่มีปุ่มทั้งคู่; capacity รั่วฝั่ง same-day |

---

# E. GAP MATRIX

| ID | Domain | Requirement (business ต้องการ) | Current Reality (จาก code/DB) | Evidence | Severity | Required Fix (ทิศทาง — ยังไม่แก้) |
|---|---|---|---|---|---|---|
| G-01 | Availability | Enforce cutoff ทุกโหมด | ไม่มีการเทียบ cutoff_time ใน SQL ใดเลย; engine เดียวที่มี logic นี้ไม่ถูกเรียกใน flow ซื้อ | grep 22 migrations = 0 hit; availabilityEngine consumers = AdminControl + test | **P0** | เพิ่ม cutoff check ใน create_order_with_items + create_pre_order_with_items + ให้ StoreStatus อ่าน round จริง |
| G-02 | Capacity | Cancel/failed ต้องคืน capacity ทุกโหมด | trigger +1 ตอน INSERT แต่ไม่มี hook -1 เมื่อ cancelled/failed; แก้มือด้วยปุ่ม Reset เท่านั้น | 001 trigger; transition_order_status (019) restore เฉพาะ inventory | **P0** | เพิ่ม capacity refund ใน transition hook หรือเปลี่ยน current_count เป็น derived count |
| G-03 | Inventory | ของไม่พอต้องกันการสั่ง + deduct ถูกต้อง | deduct clamp ที่ 0 (ไม่ block) + v_done_ids skip การหักของ item ถัดไปที่ใช้วัตถุดิบเดียวกัน; availability ไม่ผูก stock ณ จุดสั่ง | 019 L128-159 | **P0** | แก้ dedup bug + เพิ่ม stock guard ก่อน confirm + เชื่อม availability กับ stock |
| G-04 | Payment | Pre-order ต้องมีการชำระเงินครบวงจร | pre_orders ไม่มี payment field; สร้าง intent ไม่ได้ (lookup ใน orders) | 001 L236-258; 008 create_payment_intent_record | **P0** | ออกแบบ payment path สำหรับ pre-order หรือ unify เข้า orders spine พร้อม flag mode |
| G-05 | Pre-order | ที่อยู่จัดส่งจริง | HomePage/MenuPage hardcode พิกัดกลางเมือง + address ว่าง | HomePage L144-146; MenuPage L97-99 | P1 | ให้ flow จองใช้ที่อยู่/GPS ของลูกค้าเหมือน same-day |
| G-06 | Kitchen | Pre-order เข้า production batch ตาม target date/round | create_production_batch ดึงเฉพาะ orders (confirmed/preparing); pre_orders ไม่ถูกแตะ | 019 create_production_batch | **P0** | ขยาย batch source ให้ครอบ pre_orders หรือ migrate pre-order เข้า orders spine + kitchen UI queue |
| G-07 | Order Mode | กันสินค้าผิดโหมดทั้งสองทาง | pre-order RPC กัน; same-day RPC ไม่กัน is_preorder=true → สินค้าจองล่วงหน้าถูกซื้อทันทีได้ | 020 L286-297 | P1 | เพิ่ม mode gate ใน create_order_with_items |
| G-08 | UI↔DB | ปุ่ม admin เดินตาม state machine | ปุ่ม Delivered จาก ready_for_dispatch โดน DB ปฏิเสธเสมอ (ไม่มีปุ่ม dispatched/in_transit/arrived) | AdminOrders L179-181 + 008 allow-list | P1 | เพิ่มปุ่มตาม allow-list หรือให้ rider status sync ไป orders |
| G-09 | Delivery | Admin มอบหมายไรเดอร์จาก UI | assignDriver/upsertDriver ไม่มี page เรียก; DeliveryManagement ใช้ MOCK_DRIVERS + localStorage providerOrders | grep usage; DeliveryManagement L26-30 | P1 | dispatch UI ที่เรียก RPC 020 จริง + อ่าน drivers จาก DB |
| G-10 | Delivery | Rider ขับเคลื่อน order status | driver_update_delivery_status อัปเดต assignment เท่านั้น — orders.status ไม่ขยับ | 020 L708-760 | P1 | hook assignment status → orders.status (ผ่าน definer) |
| G-11 | Cancel | ลูกค้ายกเลิกได้ตามนโยบาย | RPC รองรับ แต่ OrdersPage ไม่มีปุ่ม (ทั้ง orders และ pre-orders) | grep; TermsPage สัญญา 5 นาที | P1 | เพิ่มปุ่ม cancel เรียก RPC ที่มีอยู่ + นโยบายเวลาฝั่ง server |
| G-12 | Tracking | ลูกค้าเห็นสถานะจริง | OrderTrackPage mock ทั้งหน้า (auto-advance 30 วิ + รายการ/ราคา hardcode) | OrderTrackPage L17-31, L104-123 | P1 | อ่านสถานะจาก orders/pre_orders + orderVocabulary mapper (มีอยู่แล้ว) |

## E.1 Gap Matrix ภาคต่อ (G-13 … G-22)

| ID | Domain | Requirement | Current Reality | Evidence | Severity | Required Fix (ทิศทาง) |
|---|---|---|---|---|---|---|
| G-13 | Inventory admin | Admin จัดการวัตถุดิบ/สูตรจาก DB เดียว | InventoryPage ใช้ inventoryStore (localStorage) — bmbAdminApi_inventory ไม่มี page ใช้; ไม่มี UI จัดการ recipes สำหรับ BOM เลย (แก้ได้เฉพาะ SQL) | InventoryPage L2,7; grep recipes/bmbAdminApi_inventory usage | P1 | เปลี่ยนหน้าเป็น DB-backed + เพิ่ม recipe editor |
| G-14 | Delivery fee | ค่าส่ง server-authoritative + กฎ 5 กม. | compute_delivery_fee **ยังยอมรับ p_distance_km จาก client เมื่อไม่มีพิกัด** (020 L113-123, L329-333); ไม่มี enforcement ≤5กม.→Bite Drive/>5กม.→external ฝั่ง server; client getBestProvider มี min_distance_km=1 → **ลูกค้าที่อยู่ <1 กม. หา provider ไม่ได้ → ปุ่มยืนยัน disabled ตลอด** | 020; externalProviders L87-105; CheckoutPage L352 | **P0/P1** | บังคับใช้พิกัดเท่านั้น (ระยะจาก server) + tier rule ใน RPC + แก้ min distance ของ Bite Drive = 0 |
| G-15 | Round UX | เลือก round จาก DB จริง | Checkout hardcode map round-1/2/3 → admin สร้าง round ใหม่ (`round-<timestamp>`) ไม่ถึงผู้ใช้ยกเว้น deep-link; UI ไม่บอกว่า round ปิด/เกิน cutoff | CheckoutPage L22, ~L150 | P1 | โหลด rounds เป็น dropdown + filter ตาม status/cutoff |
| G-16 | StoreStatus | สถานะร้านอ่านจาก DB | `getStoreStatusFromRounds` filter `status==='open'` แต่ DB ใช้ 'active' → แทบทุกกรณี fallback เป็น mock time-based | homeProviders L167-168 | P2 | ใช้ vocabulary เดียวกับ DB ('active') |
| G-17 | Capacity | นับตามจำนวนชิ้นอาหาร | นับ per-order (ทั้ง trigger และ 017) — สั่ง 100 ชิ้น = 1 slot; `v_items_total_qty` ถูกคำนวณแต่ใช้แค่คำนวณ fee | 001 trigger; 020 L268 | P2 | กำหนด semantic ให้ชัด (per-order หรือ per-quantity) แล้ว enforce |
| G-18 | Pre-order pricing | ราคา pre-order ครบเหมือน same-day | ไม่รองรับ add-on/promo/ค่าส่ง — ราคา = price × qty เท่านั้น | 017 L117-119 | P2 | เพิ่ม compute_addons_price + promo + fee ใน pre-order RPC (ถ้าต้องการ) |
| G-19 | Pre-order lifecycle | มี guard/audit เหมือน orders | pre_orders แก้ status ตรงได้ (admin RLS) ไม่มี allow-list/trigger/audit; updatePreOrderStatus ฝั่งลูกค้าโดน RLS ตัดเฉียบ (console.warn) | 017 RLS; preOrderService L208-225 | P2 | เพิ่ม state machine/audit สำหรับ pre_orders |
| G-20 | Admin coverage | ดู/จัดการ pre-order จาก UI | ไม่มีหน้า admin pre-orders (AdminOrders แสดงเฉพาะ orders) | pages/admin/* | P2 | เพิ่มหน้า + ผูก batch/payment |
| G-21 | Menu sections | น้ำ/ทานเล่น เป็นข้อมูลจริง | hardcode DRINKS_MENU/SNACKS_MENU comingSoon ไม่เชื่อม DB/ไม่ผ่าน admin/สั่งไม่ได้; "ทานเล่น" ไม่มี category | drinksMenu/snacksMenu; seed categories | **P1 (product)** | ทำเป็น products ใน DB + category ใหม่ + ให้ Section อ่านจาก category |
| G-22 | Display data | stock/rating แสดงจาก DB | homeProviders มี MOCK_STOCK/MOCK_RATING overlay สำหรับ prod-1..6 (fallback เมื่อไม่มีคอลัมน์ 012) | homeProviders L30-47 | P2 | ตัด mock เมื่อข้อมูลจริงครบ |
| G-23 | Admin product form | ตั้ง is_preorder/round/date จาก UI | form ไม่มี toggle is_preorder (มีใน lib/types เท่านั้น) | ADMIN_GAP_MAP L85 + grep AdminProducts = 0 hit | P2 | เพิ่ม field ใน form |
| G-24 | Real-world DEL | Grab/Lineman/Foodpanda จริง | ทุกเจ้ายัง sandbox/mock (รอ API keys); provider_orders เป็น localStorage | externalProviders L14-38; RECONCILIATION §B | DEFERRED | รอ keys — ไม่ block M1 ตามแผน |

---

# F. CONTRADICTION MATRIX (เอกสาร ↔ Code/DB)

| ID | เอกสาร | ข้อความในเอกสาร | Code/DB จริง | Conflict | ต้อง reconcile ว่าอย่างไร |
|---|---|---|---|---|---|
| C-01 | `docs/BMB_MASTER_PRODUCT_SPEC.md` §7 KITCHEN | "CURRENT: PARTIAL — rounds+capacity+cutoff; **ไม่มี batch/production**" | migration 019 (production_batches + kitchen_queue) applied แล้ว; CURRENT_STATE/CLOSURE_BOOK ประกาศ KIT-01/02 VERIFIED | เอกสาร spec ล้าหลัง 019 (spec เก่ากว่าวันที่ apply) | ต้องแก้ spec §7 ให้บอกว่า batch/recipe มีใน DB แต่ **UI + integration (pre-order) ยังไม่ครบ** |
| C-02 | spec §8 INVENTORY | "CURRENT: PARTIAL — **ไม่มี auto-deduct**" | INV-01 auto-deduct/restore มีจริงแล้ว (019 hook ที่ transition) | ขัดแย้งตรง ๆ | แก้ spec §8 + เพิ่ม caveat ว่า deduct มี bug clamp/skip (G-03) |
| C-03 | spec §9 DELIVERY | "fee ยังไม่ authoritative จาก delivery_zones ใน RPC" | 020 ทำแล้ว (compute_delivery_fee ใน create_order) แต่ยังมีรู client distance | ขัดแย้ง | แก้ spec §9 ให้ระบุข้อยกเว้น G-14 |
| C-04 | spec §3 + CURRENT_STATE §4 | "availability engine (quota+cutoff) LIVE" | engine ไม่ถูกเรียกใน flow ซื้อเลย (มีแต่ dashboard widget + test) | เอกสารเกินจริง | แก้เป็น "engine PARTIAL — ยังไม่ wire เข้า flow" |
| C-05 | CLOSURE_BOOK PAY-04 | "Canonical order vocabulary VERIFIED" | pre_orders ใช้ vocabulary ชุดที่ 3 (client PreOrderStatus + PRE_ORDER_STATUS_LABEL ใน OrdersPage) ไม่อยู่ใน map; OrderTrackPage hardcode steps อีกชุด | vocabulary จริงมี 3–4 ชุด ไม่ใช่ชุดเดียว | แก้ PAY-04 ให้ครอบ pre-orders + track page |
| C-06 | CURRENT_STATE §1 | "Customer Storefront LIVE — ผ่าน flow" | หน้า track (ขั้นสุดท้ายของ journey) เป็น mock ไม่อ่าน DB | เกินจริง | แก้เป็น LIVE ยกเว้น Tracking = PARTIAL/MOCK |
| C-07 | `docs/Bite Me Baby — เอกสารข้อกำหนด…txt` §1.2/16.4 | Morning cutoff 08:00 / Midday 10:30 / Evening 16:00 | DB seed = 06:00/10:00/16:00; AdminRounds default ฟอร์ม = 08:00/09:00/12:00 | 3 ชุดเวลาไม่ตรงกัน | กำหนดค่า canonical แล้วแก้ seed/admin default |
| C-08 | spec §4 CART&CHECKOUT | "flow เดียวสำหรับ same-day + pre-order, ทั้งสองโหมดผ่าน server-side pricing" | pre-order มี pricing server แต่ **ไม่มี payment/fee/promo** และยังเป็นสอง flow คนละตาราง/คนละ RPC | เอกสาร target ไม่ตรงสถานะ | ระบุว่า "server pricing = จริง, unified flow = ยังไม่มี" |
| C-09 | CLOSURE_BOOK KIT-01 | "UI queue — PARTIAL (admin)" | ไม่มี UI ใดเรียก create_production_batch/kitchen_queue เลย | "PARTIAL" ควรเป็น "MISSING" | แก้เป็น MISSING + แผน kitchen UI |
| C-10 | DATABASE_SECURITY_AUDIT vs ADMIN_GAP_MAP | DB-audit: "InventoryPage ใช้ Zustand ไม่ sync Supabase" / GAP_MAP AG-06: "ใช้ Supabase เป็น source of truth" | Code: InventoryPage ใช้ inventoryStore (localStorage) เท่านั้น | เอกสารสองฉบับขัดกันเอง | Code wins → AG-06 ผิด ต้องแก้ |
| C-11 | CURRENT_STATE §4 + STATUS_TRACKER | "Bite Drive RPCs LIVE/VERIFIED" | RPC deploy จริง แต่ **ไม่มี UI dispatch + driver status ไม่ sync orders** → "LIVE" ในเชิง capability ไม่ใช่ในเชิง operation | เกินจริงเชิงปฏิบัติการ | ระบุว่า LIVE = deployed, operational loop = PARTIAL |

---

# G. TEST GAP ANALYSIS (ห้ามนับจำนวน — ถามว่าพิสูจน์อะไร)

**ข้อจำกัดเชิงโครงสร้างทั้งชุด:** 163/163 tests รันบน **supabaseMock.ts (in-memory mock, 40KB)** — พิสูจน์ logic ฝั่ง client กับ mock เท่านั้น ไม่ใช่ DB จริง; 29/29 SQL contracts คือ **deployment + negative probes** (เรียก RPC ด้วย input ตั้งใจผิด เช็คว่า reject ได้) — ไม่พิสูจน์ business rule ที่ต้อง "ยอมรับถูกต้อง"

| Business Rule | Existing Test | Evidence ชนิดไหน | Missing Scenario | Risk |
|---|---|---|---|---|
| Product↔Category | api.test.ts (CRUD mock) | Functional (mock) | — | ต่ำ |
| Product↔Order Mode | api.test (pre-order create ผ่าน mock) | Functional (mock) | สั่ง is_preorder=true ผ่าน create_order_with_items จริง (E) | **สูง** |
| Same-day availability | availabilityEngine.test (pure) | Unit pure | engine ไม่ถูกเรียกจริง — ไม่มี integration test | **สูง** |
| Cutoff | availabilityEngine.test เท่านั้น | Unit pure | RPC จริงไม่มี cutoff — ไม่มี test ที่จับได้ | **สูงสุด** |
| Round/Capacity | api.test (mock capacity) | Functional (mock) | concurrency จริง, cancel→capacity refund, per-quantity semantics | **สูง** |
| Inventory | kitchenService.test (ต้องมี env) | Integration-ish | ของไม่พอ→block? skip bug? sold-out flip จริง | **สูง** |
| Batch | kitchenService.test (RPC wrapper mock) | Functional (mock) | batch รวม pre-orders, batch จาก UI | **สูง** |
| Delivery | deliveryRouter/Store/ETA tests (pure+store) | Unit | fee จากพิกัดจริง, 5km tier ฝั่ง server, <1km case | สูง |
| Payment | paymentStateMachine/stripe tests | Unit + webhook smoke จริง (6/6) | refund จริง, bill จริง (เอกสารรับแล้ว), pre-order payment | ปานกลาง |
| Cancellation | api.test (mock) | Functional (mock) | capacity restore จริงหลัง cancel | **สูง** |
| E2E | Playwright 7 steps + real rows (BMB-*, PO-*) | E2E + prod evidence | tracking display จริง (หน้า track เป็น mock อยู่แล้ว), rider loop | สูง |

---

# H. DEPENDENCY GRAPH + STATUS (จริง ๆ แต่ละเส้น)

```text
Product ──(FK)──> Category                      [REAL]
Product ──(FK)──> delivery_round_id (pre-order) [REAL]
Product ──> Availability
   ├─ is_available + INV-02 flip                 [REAL แต่ตาหลังเหตุการณ์]
   ├─ availabilityEngine (quota+cutoff)          [IMPLICIT — ไม่มีใครเรียกใน flow ซื้อ]
   └─ recipe/stock ณ จุดสั่ง                     [MISSING]
Order Mode ──> { orders | pre_orders }           [REAL แต่ไม่มี enum/บังคับทั้งสองทาง (G-07)]
Date/Round/Cutoff
   ├─ date-match (pre-order)                     [REAL]
   ├─ capacity lock ทั้งสองโหมด                  [REAL]
   └─ cutoff                                     [MISSING — document-only]
Capacity ──> cancel restore                      [MISSING same-day / REAL pre-order]
Order ──> Payment                                [REAL (same-day)] / [MISSING (pre-order)]
Order ──> Inventory (deduct/restore)             [REAL แต่มี bug G-03] / [MISSING (pre-order)]
Order ──> Kitchen Batch                          [PARTIAL — มี RPC, ไม่มี UI, ไม่ครอบ pre-order]
Batch ──> Kitchen UI                             [MISSING]
Order ──> Delivery Assignment ──> Driver         [PARTIAL — มี RPC+RiderPWA, ไม่มี dispatch UI, ไม่ sync กลับ]
Delivery ──> 5km Tier rule                       [CLIENT-ONLY — server ไม่ enforce]
Delivery fee ──> delivery_zones                  [REAL ยกเว้นรู client distance]
Order ──> Customer tracking                      [MOCK — OrderTrackPage]
Payment failure ──> recovery                     [PARTIAL]
```

# I. REAL JOURNEY RECONSTRUCTION (สรุปจาก code — ตำแหน่งที่ตั้ง step เป็น mock/จุดขาด)

**CUSTOMER (same-day)**: Landing(REAL) → Menu(REAL) → Product(REAL) → Addons(REAL) → Cart(REAL) → Checkout(REAL, round map hardcoded) → Payment(REAL, admin confirm) → **Tracking = MOCK** → Review(REAL table, UI บน track ยังเป็นปุ่ม mock)

**CUSTOMER (pre-order)**: Menu/Home(REAL) → จอง(REAL row) → **จบ** — ไม่มี payment, ไม่มี kitchen, ไม่มี delivery, tracking จาก mock

**KITCHEN**: AdminOrders(REAL transitions + INV hook) → Batch(REAL RPC, ไม่มี UI) → BatchItems(REAL) → **ไม่มีหน้าจอครัวจริง**

**DELIVERY**: Admin ไม่มีปุ่ม assign(REAL RPC ไม่ถูกเรียก) → RiderPWA(REAL RPC อ่าน/อัปเดต assignment) → **orders.status ไม่ขยับ** → COD confirm ต้องอาศัยปุ่มที่ผิด state

# J. FINAL DECISION TREE — GROUPING

**GROUP A — REALLY COMPLETE (code+DB+RPC+flow ต่อกันจริงทั้งเส้น)**
1. Same-day order creation (server-authoritative, atomic capacity, add-on price re-derive)
2. Payment spine ของ orders (PromptPay offline-ref + COD + Stripe card via EF + webhook idempotent + refund path)
3. Order state machine ฝั่ง server (allow-list + trigger + audit)
4. RLS/is_admin/audit-log + pre-order create/cancel (ส่วนแถวข้อมูล)

**GROUP B — CODE EXISTS BUT BUSINESS LOGIC INCOMPLETE**
cutoff (G-01) · capacity cancel restore (G-02) · inventory deduct bug + availability tie (G-03) · pre-order payment (G-04) · pre-order→kitchen (G-06) · mode gating ไม่สมมาตร (G-07) · admin state buttons (G-08) · dispatch UI (G-09) · driver→order sync (G-10) · cancel UI (G-11) · delivery fee รู client distance + 5km (G-14) · round dropdown (G-15) · capacity semantics (G-17)

**GROUP C — DOCUMENTATION IS WRONG**
C-01…C-11 ทั้งตาราง Section F (ส่วนใหญ่คือ MASTER_PRODUCT_SPEC ล้าหลัง 019/020 และ CURRENT_STATE ประกาศเกินส่วน Tracking/Availability/Vocabulary)

**GROUP D — ACTUAL PRODUCT GAP (ไม่มีจริงเลย)**
Menu Section entity + การเชื่อม "น้ำ/ทานเล่น" เข้า catalog (G-21) · Pre-order payment ทั้งระบบ (G-04, D-side) · pre-order delivery address (G-05) · หน้า admin pre-orders (G-20) · recipe admin UI (G-13 ส่วน recipes) · tracking จริง (G-12) · คูปอง/loyalty integration (document-only)

---

# K. ลำดับความสำคัญหลัง audit (ห้ามเอา P3/P4 มาปนกับ M1)

- **P0 (Business correctness / money / order integrity)**: G-01 cutoff · G-02 capacity leak · G-03 inventory deduct bug + stock guard · G-04 pre-order payment · G-06 pre-order→kitchen · G-14 delivery fee รู client distance
- **P1 (Core product logic)**: G-05 pre-order address · G-07 mode gate · G-08 admin state buttons · G-09 dispatch UI · G-10 driver sync · G-11 cancel UI · G-12 tracking จริง · G-21 menu sections
- **P2 (Admin/operational completeness)**: G-13 inventory/recipe UI · G-15 round dropdown · G-16 store status vocab · G-18 pre-order pricing ส่วนเสริม · G-19 pre-order state machine · G-20 admin pre-orders · G-22/G-23 mock/form cleanups
- **P3 (UX/optimization)**: payment failure recovery UX, capacity auto-close UX, Lighthouse production
- **P4 (SaaS/DEFERRED)**: G-24 external couriers จริง, Domain B ทั้งหมด

---

# L. REQUIRED FINAL ANSWERS (5 ข้อ)

### 1. WHAT IS ACTUALLY COMPLETE?
Same-day spine จนถึง "จ่ายแล้ว+ยืนยันแล้ว+หักของแล้ว": server-authoritative order creation (ราคา/addon/promo/fee จาก DB), atomic capacity + trigger, payment state machine (PromptPay TXN/COD/Card+Stripe webhook idempotent + amount-match), order state machine (allow-list+trigger+audit), RLS/audit-log, การสร้าง/ยกเลิก pre-order (แถวข้อมูล + capacity refund) — ชุดนี้มี code+DB+RPC+UI+test+production evidence รองรับจริง

### 2. WHAT IS ONLY APPARENTLY COMPLETE?
- "Bite Drive LIVE/VERIFIED" — RPC deploy จริง แต่ไม่มี UI dispatch, driver ไม่ขับ orders.status, 5km rule ไม่มีฝั่ง server, หน้า Delivery ยังใช้ MOCK_DRIVERS
- "Kitchen & Inventory VERIFIED" — tables/RPC deploy จริง แต่ไม่มี kitchen UI, batch ไม่ครอบ pre-orders, deduct มี bug + ไม่กันของไม่พอ, admin inventory หน้าเป็น localStorage
- "Availability engine LIVE" — engine ไม่ถูกเรียกใน flow ซื้อ
- "Customer Storefront LIVE ผ่าน flow" — หน้า tracking ขั้นสุดท้ายเป็น mock ทั้งหน้า
- "29/29 contracts + 163 tests" — พิสูจน์ deployment/negative-guards และ client-logic-on-mock เท่านั้น

### 3. WHAT BUSINESS LOGIC IS STILL UNPROVEN?
- Cutoff ทุกโหมด (ไม่มีใน SQL เลย) · capacity คืนเมื่อ cancel same-day · inventory กันของไม่พอ/สั่งพร้อมกัน · pre-order ทั้ง lifecycle หลังแถวถูกสร้าง (payment→kitchen→delivery→tracking) · กฎ 5 กม. ฝั่ง server · concurrency ภายใต้โหลดจริง · refund จริง/บิลจริง (รู้อยู่แล้ว) · ลูกค้าสั่งได้จริงเมื่ออยู่ <1 กม.

### 4. WHAT MUST BE FIXED BEFORE M1 CAN TRULY CLOSE?
กลุ่ม P0 ทั้ง 6 (G-01, G-02, G-03, G-04, G-06, G-14) + แก้เอกสารชุด GROUP C ให้สะท้อนจริง — เพราะทั้งหมดกระทบเงิน กำลังผลิต และสายการส่งของโดยตรง ทั้งที่เอกสารประกาศว่า VERIFIED อยู่แล้ว

### 5. WHAT IS THE SINGLE NEXT ENGINEERING TASK?
**"เชื่อม pre-order เข้า order spine"** — ยกพรีออเดอร์ให้ไหลผ่าน lifecycle เดียวกับ orders (mode flag + payment intent + batch source + delivery round slot + cancel/capacity refund + audit) แทนตารางเกาะ `pre_orders`
- **เหตุผลที่เป็น task เดียวที่ dependency ชัดที่สุด**: เป็นจุดตัดที่พังพา 4 gap P0 พร้อมกัน — G-04 (payment), G-06 (kitchen batch), G-05 (address/fee), ครึ่งหนึ่งของ G-01 (cutoff โดยใช้ rule ชุดเดียวกัน) และแก้ root-cause ของสถาปัตยกรรม (สองระบบคนละตาราง) แทนการ patch ทีละใบ — เมื่อ spine เดียว ทุก enforcement ที่ same-day มีอยู่แล้ว (trigger, state machine, audit, payment, inventory hook) จะได้ผลกับ pre-order ทันทีโดยไม่ต้องเขียนซ้ำ

---

**หมายเหตุท้ายรายงาน**: รายงานนี้เป็น AUDIT ONLY — ไม่มีการแก้ code/DB/UI/docs ใด ๆ · ไม่แตะต้อง selfprint (ต่าง repo) · ทุกข้อสรุปอ้างไฟล์/บรรทัดที่ระบุไว้ในเอกสารนี้ ตรวจซ้ำได้ทันทีด้วย grep/read · Known Evidence (163 tests, 29/29 contracts, migrations 001–022) ถูกใช้เป็นพื้นฐาน ไม่ใช่ข้อพิสูจน์ความเสร็จ
