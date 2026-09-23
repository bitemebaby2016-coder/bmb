# BMB M1 CLOSURE EVIDENCE PACK (ฉบับภาษาไทย)

> **วันที่:** 2026-09-24  
> **HEAD:** 5887fab (docs(M1): สร้างเอกสารหลักฐานปิด M1 v2.0 จาก HEAD 4fa8c03)  
> **Origin/main:** 5887fab  
> **ผู้ผลิต:** AI Engineering Agent (ตรวจสอบจาก Code/DB/Evidence จริง)  

---

## A. สถานะ Git

```text
HEAD          : 5887fab (docs(M1): สร้างเอกสารหลักฐานปิด M1 v2.0 จาก HEAD 4fa8c03)
ORIGIN/MAIN   : 5887fab (ซิงค์แล้ว ✅)
BRANCH        : main
WORKING TREE  : CLEAN (หลัง commit แล้ว)
04d19c7       : IS ancestor ของ HEAD ✅ (การแก้ MOCK_DRIVERS ถูก merge เข้า baseline แล้ว)
```

**Commit ที่เกี่ยวข้อง (15 ตัวล่าสุด):**
```
5887fab docs(M1): สร้างเอกสารหลักฐานปิด M1 v2.0 จาก HEAD 4fa8c03
4fa8c03 docs(M1): rebuild reconciliation matrix v2.0 + fix lint .kilo ignore
2ad74c2 docs(M1): แปลไทยเต็มรูปของ reconciliation matrix
b72b53a docs(M1): แปลไทยเต็มรูป
096d665 docs(M1): อัปเดต reconciliation — สถานะ P0/P1, แก้ MOCK_DRIVERS
04d19c7 fix(M1): แทน MOCK_DRIVERS ด้วย DB drivers จริง
28b0a40 fix(M1): แก้ CI lint failures ทั้งหมด (var->const/let)
665a3e1 docs(M1): สรุปสถานะการทำงาน — 8/10 P0 แก้แล้ว, Admin UI P1 ครบ
ff54783 feat(M1): ปิด P0/P1 blockers — Migration 035, AdminKitchen/PreOrders/Recipes, AuditLog, enforcement cutoff
7a44893 feat(db): Migration 035 — 5km gate, ที่อยู่ pre-order, audit RLS, admin RPCs
886836d fix(P0-6): บังคับ cutoff ใน CheckoutPage handlePlaceOrder
716b4e9 fix(P0-8): ปิด aiToolCalling.ts → เปลี่ยนชื่อเป็น .disabled
9787429 fix(P0-1): เขียนใหม่ InventoryPage ใช้ API DB-backed (เลิกใช้ localStorage)
95b0518 state(M1): อัปเดต AI_WORK_STATE Phase 2 checkpoint
c6a4c69 docs(M1): สร้าง master requirement reconciliation matrix v1.0
```

---

## B. Build / Test / Lint

| เมตริก | ผลลัพธ์ | รายละเอียด |
|--------|---------|-------------|
| LINT | PASS | 0 errors หลังแก้ eslint.config.js `.kilo/**` ignore |
| TYPECHECK | PASS | `tsc strict` ผ่าน |
| BUILD | PASS | Vite + PWA sw.js เกิดขึ้น (52 precache entries) |
| TESTS | 358/358 PASSED | 44 test files, vitest run |
| CI | PASS | GitHub Actions มีประวัติ passing runs |

---

## C. Database Schema & Migrations (001–035)

### Migration ที่สำคัญที่ Trace ได้:

| Migration | จุดประสงค์ | ตรวจสอบจาก |
|-----------|------------|-------------|
| 007 | สร้างออร์เดอร์แบบ server-authoritative (`create_order_with_items`) | CheckoutPage → bmbAdminApi_orders.ts → trace โค้ด |
| 008/010 | Payment state machine, `record_payment_result` แบบ idempotent | stripe-webhook EF → trace โค้ด |
| 025 | Canonical order RPC, `cancel_order` พร้อมคืน capacity/inventory, trigger `release_round_capacity_on_terminal` | CheckoutPage→createOrder(), cancelOrder() RPC |
| 026 | แก้ไข inventory deduction แบบ aggregated (แก้ bug dedup + guard `ERR_INSUFFICIENT_INGREDIENT`) | Code review ยืนยัน SUM aggregated ต่อ ingredient |
| 027 | Kitchen canonical batch (รองรับทั้งสองโหมดผ่าน `p_order_mode NULL`) | AdminKitchen creates_batch() เรียก create_production_batch(roundId,date,NULL) |
| 035 | M1 closure P0: 5km gate, ที่อยู่ pre-order บังคับ (`validate_pre_order_delivery()` trigger), audit RLS, admin RPCs | Trace โค้ด: compute_delivery_fee, trigger, list_drivers RPC |

### ตารางที่ยืนยันจากโค้ด/Migration:

```
orders              ✅ order_mode(SAME_DAY/PRE_ORDER), scheduled_date, delivery_address, payment_status
order_items         ✅ product_id, quantity, unit_price, customizations
delivery_rounds     ✅ max_capacity, current_count, cutoff_time, status, scheduled_date
inventory           ✅ current_stock, min_stock, status, category
inventory_transactions ✅ type, quantity, reference_type, reference_id (audit trail ครบถ้วน)
recipes             ✅ product_id, ingredient_id, quantity_per_unit
production_batches  ✅ delivery_round_id, scheduled_date, status
production_batch_items ✅ order_number, order_mode, product_name, quantity, status
drivers             ✅ driver_name, phone_number, status, active_assignments
delivery_assignments ✅ order_number, driver_phone, status
payment_intents     ✅ order_number, amount, currency, status, method, provider, metadata(refund_ledger)
audit_logs          ✅ action, entity_type, entity_id, description, metadata
profiles            ✅ role, is_owner
business_settings   ✅ key/value store
pre_orders          ✅ Archive เท่านั้น; rows ที่ migrate แล้วมี migrated_order_id → ไป orders
```

### Security:
```
RLS               ✅ WAVE 3 ยืนยัน: grant probe 7/7 PASS, anon residue 0/0
ACL GRANTS        ✅ Migration 033/034 แก้ production drift
aiToolCalling     ✅ เปลี่ยนชื่อเป็น .disabled (commit 716b4e9); bundle scan = 0 key hits
Admin RBAC        ✅ is_admin() enforced ใน RPCs (SEC DEFINER เมื่อจำเป็น)
Supabase Secrets  ✅ Keys อยู่ใน Edge Function env เท่านั้น (ไม่มีการ expose ฝั่ง client)
```

---

## D. Same-Day E2E Evidence

```
ลำดับการตรวจสอบ (trace จากโค้ดจริง):

1. OrdersPage อ่านจาก 'orders' (RLS scoped ตามออเดอร์ของตัวเอง) — บรรทัด 35
2. โหมด SAME_DAY = default ที่ CheckoutPage บรรทัด 49
3. โหลด rounds ผ่าน listRoundsForDate(today) — บรรทัด 81-90
4. Cutoff: ไคลเอนต์ parse cutoff_time เปรียบเทียบ ICT + server RPC gate — บรรทัด 161-184
5. Capacity: ปุ่ม disabled ไคลเอนต์ + server FOR UPDATE lock — บรรทัด 179-183
6. สร้างออเดอร์ผ่าน canonical RPC — ไม่มีราคาใน payload (server คำนวณทั้งหมด)
7. สร้าง payment intent → redirect ไป PaymentConfirmationPage
8. Webhook/admin confirm → order.payment_status='paid'
9. Admin confirm → deduct_inventory(aggregated, Migr 026) + append_audit_log
10. Kitchen batch: create_production_batch(roundId, date, NULL=both modes)
11. กำหนด driver: list_drivers() DB-backed, assign_driver RPC (ไม่มี MOCK_DRIVERS)
12. Status transitions ตาม pipeline เต็ม
13. Audit log ทุกขั้นตอน

Tests: ✔ availabilityEngine.test.ts, ✔ orderVocabulary(5), ✔ kitchenService(4)
Prod: ✅ Deployed บน Cloudflare Pages

Verdict: SAME-DAY E2E = PARTIAL — ต้องการ live production order trace
```

---

## E. Pre-Order E2E Evidence (BLOCKER หลักของ M1)

### การแก้ความขัดแย้งจาก HEAD 4fa8c03:

| รายการ | แก้แล้วหรือยัง? | หลักฐานโค้ด | สถานะสุดท้าย |
|--------|---------------|-------------|-------------|
| สถาปัตยกรรมชำระเงิน Pre-order | ใช่ | Migr 025: create_pre_order_with_items หุ้ม create_order_with_items(mode=PRE_ORDER). CheckoutPage เรียก createPaymentIntent สำหรับ BOTH โหมด | Architecture VERIFIED / Runtime PARTIAL |
| ที่อยู่ pre-order บังคับ | ใช่ | Migr 035 Part 2: trigger validate_pre_order_delivery() RAISE ถ้าว่าง | Implementation VERIFIED / Prod proof PARTIAL |
| Kitchen batching Pre-order | ใช่ | Migr 027: create_production_batch รับ p_order_mode=NULL (รองรับ both โหมด) | Implementation VERIFIED |
| Legacy pre_orders → canonical | ใช่ | Migr 024/025: legacy migrate แล้ว; ใหม่ใช้ canonical RPC | Implementation VERIFIED |

### ลำดับการทำงาน Pre-Order (Trace จากโค้ด):

```
1. โหมด PRE_ORDER ผ่าน URL ?mode=pre-order — CheckoutPage บรรทัด 49
2. ขีดจำกัดวันอนาคต: minDate=today+1 enforced ที่ date picker; lead time re-validate — บรรทัด 51,53,186-189
3. ที่อยู่จัดส่ง: แสดงสำหรับทั้ง modes; Migr 035 trigger บังคับไม่ให้ว่างสำหรับ PRE_ORDER
4. Payload: delivery_address✓, payment_method✓, order_mode='PRE_ORDER'✓, scheduled_date=future✓, NO financial fields✓
5. createOrder() → create_pre_order_with_items(mode=PRE_ORDER, future_date) → order_number นำหน้า PO-
6. สร้าง payment intent → redirect ไป PaymentConfirmationPage
7. Stripe webhook หรือ admin confirm → payment_status='paid'
8. Admin: confirm → deduct_inventory(Migr 026 aggregated) → batch(Migr 027 both modes) → dispatch(assign_driver) → delivered
9. Cancel: cancel_order RPC(Migr 025) คืน capacity(inventory); trigger release_round_capacity_on_terminal ทำงาน

กรณีผิดพลาดที่ตรวจสอบ:
- ไม่มีที่อยู่: trigger ตรวจ && RAISE EXCEPTION ✓
- วันที่อดีต: client minDate block + server re-validate ✓
- ความจุเต็ม: server FOR UPDATE blocks overbooking ✓
- สินค้าคงคลังไม่พอ: throw ERR_INSUFFICIENT_INGREDIENT, txn rollback ✓
- Webhook ซ้ำ: record_payment_result แบบ idempotent ✓

Verdict: PRE-ORDER E2E = PARTIAL
Architecture + implementation สมบูรณ์และถูกต้อง ข้อควรระวังหลัก: ไม่มี production pre-order runtime evidence เลย.
ไม่สามารถประกาศ VERIFIED ได้จนกว่าจะมี pre-order อย่างน้อยหนึ่งรายการที่จบครบวงจรใน production.
```

---

## F. Inventory Proof
Migr 026 — deduct_inventory_for_order():
1. AGGREGATED ต่อ ingredient: SUM(oi.quantity * r.quantity_per_unit) GROUP BY ingredient_id (แก้ bug dedup)
2. ERR_INSUFFICIENT_INGREDIENT แทน clamp-to-zero: RAISE EXCEPTION เมื่อ stock ไม่พอ
3. Row-level FOR UPDATE locking บนแต่ละ inventory row
4. Transaction audit trail ผ่าน inventory_transactions INSERT
5. Auto sold-out เมื่อต่ำกว่า min_stock → products.is_available=false
Admin UI: InventoryPage.tsx (commit 9787429) — DB-backed CRUD, ไม่ใช่ localStorage
Prod Evidence: ❌ ไม่มี stock movement trace ระหว่าง session นี้
Verdict: INVENTORY = PARTIAL (code ถูกต้อง, logic ตรวจสอบแล้ว, ต้องการ prod test จริง)

## G. Capacity Proof
Migr 025 + Migr 031:
1. CREATE: atomic FOR UPDATE + increment current_count
2. CANCEL: trigger release_round_capacity_on_terminal decrements current_count
3. Manual reset: resetRoundCapacity RPC (AdminRounds.tsx)
4. Round open/close: setRoundStatus RPC
Prod Evidence: ❌ ไม่มี capacity change trace ระหว่าง session นี้
Verdict: CAPACITY = PARTIAL (atomic locking verified; cancel restoration ต้องการ prod test)

## H. Payment & Refund
Card: CheckoutPage → createCheckout EF → Stripe PI(server amount) → Stripe.js confirm → webhook → record_payment_result → paid
PromptPay: create_payment_intent_record RPC(pending) → TXN submit → admin confirm → paid
COD: create_payment_intent_record RPC(pending) → admin collect(delivered required) → confirm → paid

Security:
✅ Amount authority: create-checkout EF อ่าน order.total_amount จาก DB
✅ Idempotency: record_payment_result ตรวจ payment_intent_id เดิม
✅ Signature: HMAC-SHA256 constant-time comparison ใน stripe-webhook EF
✅ Timestamp window: 5-min reject สำหรับ event เก่า

Evidence:
✅ Real refund 172 THB เสร็จสมบูรณ์
✅ Stripe webhook ยืนยัน 6/6 events
⚠️ Card charge bill: ขาด receipt จริง 1 รายการ (PAY-02 blocker)
Verdict: PAYMENT = PARTIAL

---

## I. Kitchen + Delivery / Bite Drive
Kitchen:
✅ production_batches table พร้อม order_mode snapshot (Migr 019/027)
✅ AdminKitchen.tsx: summary cards, date filter, batch creation UI
✅ list_recipes_with_inventory() RPC for BOM management (Migr 035 Part 6)
Tests: ✔ kitchenService.test.ts(4)
Verdict: PARTIAL (deployed and functional; ต้องการ live batch trace)

Delivery:
✅ drivers table + list_drivers() RPC (Migr 035 Part 6)
✅ 04d19c7: MOCK_DRIVERS แทนที่ด้วย DB drivers จริง (ยืนยัน ancestor แล้ว)
✅ assign_driver(orderNumber, driverPhone) RPC (Migr 020) SEC DEFINER
✅ Route optimization algorithmic ETA (routeOptimization module)
✅ RiderPwaPage.tsx: interface สำหรับ rider
Tests: ✔ providers.test.ts(7), ✔ deliveryRouter.test.ts(6), ✔ routeEta.test.ts(5)
External Providers: grab/lineman/foodpanda adapters มีอยู่แล้ว แต่ไม่มี API keys → OWNER-ONLY
Verdict: Delivery Management = VERIFIED (DB-backed, ไม่มี mocks)
         External integrations = OWNER-ONLY (ต้องการ API keys)

---

## J. AI / Security
✅ AI key: ai-proxy EF ถือ OPENROUTER_API_KEY (server-side เท่านั้น)
✅ Bundle scan: 0 key hits ใน production JS bundles
✅ Guardrails: GUARDRAIL_SEGMENT inject เป็น system message — "ห้าม modify prices/stock/payments/orders/delivery"
✅ aiToolCalling: เปลี่ยนชื่อเป็น .disabled (dead code removed, commit 716b4e9)
✅ Audit log: append_audit_log RPC (SEC DEFINER), AuditLogPage อ่านจาก DB
✅ RLS: WAVE 3 ยืนยัน — grant probe 7/7 PASS, anon residue 0/0
✅ RBAC: profiles.role enforced ใน AdminRoute + is_admin() RPC checks
Verdict: AI / SECURITY = VERIFIED

---

## K. Voice Input/Output
Search ทั้ง src/: SpeechRecognition = 0 matches, SpeechSynthesis = 0 matches, STT/TTS = NOT FOUND anywhere
Original spec ระบุ voice features แต่ MASTER_PRODUCT_SPEC §3.4 บอกเป็น OPTIONAL/enhancement
Not implemented anywhere. Verdict: PARTIAL — deferred unless Owner elevates to P0. NOT blocking M1 closure.

---

## L. Documentation Sync
| เอกสาร | สถานะ | การกระทำ |
|--------|--------|-----------|
| README.md | CONFLICT (ชี้ไปที่ ed1ac58) | อัปเดตเป็น HEAD ปัจจุบัน |
| CURRENT_STATE | CONFLICT (ล้าสมัย vs HEAD 4fa8c03) | Reconcile vs HEAD 5887fab |
| CLOSURE_BOOK | CONFLICT (PARTIAL มียกเป็น VERIFIED) | แก้สถานะให้ถูกต้อง |
| RECONCILIATION_MATRIX v2.0 | UPDATED ✅ | ผลลัพธ์ของ session นี้ |

---

## M. Remaining Blockers Table

| ID | ความสำคัญ | รายละเอียด | หลักฐานที่ต้องการ | การกระทำต่อไป | Owner |
|----|----------|-------------|------------------|---------------|-------|
| B-01 | **P0** | Pre-order E2E production evidence | 1 pre-order ที่จบครบวงจร | Place real pre-order: create→pay→confirm→batch→dispatch→deliver | Owner |
| B-02 | **P0** | Real card charge bill (PAY-02) | Stripe charge receipt matching order | ให้ real card charge transaction receipt | Owner |
| B-03 | **P0** | Production Lighthouse Perf ≥ 90 | Measured values จาก bitemebaby-5f7.pages.dev | Run Lighthouse บน production URL | Owner |
| B-04 | **P1** | Same-day E2E production evidence | 1 same-day order trace (create to delivered) | Verify 1 same-day order เสร็จ full flow | Owner |
| B-05 | **P1** | Capacity restore on cancel | delivery_rounds.current_count before/after cancel | Cancel order in prod, verify count restored | Owner |
| B-06 | **P1** | Inventory deduct/restore proof | inventory_transactions before/after order+cancel | Order + cancel, verify transactions | Owner |
| B-07 | P2 | Notification delivery mechanism | Push/email/SMS system | Implement or formally defer | Engineering |
| B-08 | P2 | Voice input/output | Web Speech API integration | Clarify requirement; implement or defer | Owner |
| B-09 | OWNER | External provider API keys | grab/lineman/foodpanda config | Request from call-center | Owner |
| B-10 | P2 | Documentation synchronization | ทุก doc อัปเดตเป็น HEAD ปัจจุบัน | Update README.md, CURRENT_STATE, CLOSURE_BOOK | Engineering |

---

## N. สิ่งที่เป็น VERIFIED แล้ว (มี evidence ครบ)

| # | รายการ | เหตุผลที่ VERIFIED |
|---|--------|-------------------|
| 1 | Same-Day ordering spine | Code trace + tests + deployment |
| 2 | Payment spine (Stripe webhook 6/6, idempotent, amount-match) | EF source + test + production verified |
| 3 | Real Stripe refund (172 THB) | Real transaction completed |
| 4 | Order state machine (allow-list + trigger + audit) | Trigger + audit log code traced |
| 5 | RLS hardening (WAVE 3: 7/7 grants, anon residue 0) | Production ACL verified |
| 6 | Inventory CRUD (DB-backed ตั้งแต่ commit 9787429) | AdminInventory page traces to DB |
| 7 | AI key security (bundle 0 hits, proxy EF only) | Bundle scan + ai-proxy EF source |
| 8 | aiToolCalling disabled (dead code removed) | File renamed .disabled |
| 9 | Admin panels ทั้ง 17 หน้า (functional UI + DB-backed data) | Review all pages |
| 10 | Delivery Management (ไม่มี MOCK_DRIVERS, 04d19c7 ยืนยันแล้ว) | listDrivers() RPC → DB |
| 11 | Migrations 001–035 มีครบ | All files ใน supabase/migrations/ |
| 12 | CI/Build/Lint/Tests ผ่านทั้งหมด (358/358) | Build this session |
| 13 | PWA installable (sw.js + manifest เกิดใน build) | Build output verified |
| 14 | Customer cancel button (OrdersPage.tsx บรรทัด 116-125) | ปุ่ม render เมื่อ status='pending' ✅ |
| 15 | 5km self-delivery gate (Migr 035 compute_delivery_fee block) | Server-enforced |
| 16 | Same-day cutoff enforcement (client + RPC double gate) | CheckoutPage บรรทัด 161-184 |
| 17 | Pre-order canonical RPC (create_pre_order_with_items) | Migr 025 หุ้ม canonical path |
| 18 | Pre-order address mandatory (Migr 035 trigger) | validate_pre_order_delivery() RAISE |
| 19 | Pre-order kitchen batching (Migr 027 both modes) | create_production_batch(NULL=both) |
| 20 | Legacy pre_orders migration to canonical (Migr 024/025) | migrated_order_id references |

---

## O. สิ่งที่เป็น PARTIAL (ต้องการ Production Runtime Evidence)

| # | รายการ | ทำไมเป็น PARTIAL | การกระทำที่ต้องการ |
|---|--------|------------------|---------------------|
| 1 | Pre-order E2E | Architecture + code สมบูรณ์; ไม่มี live orders ใน production | Place 1 real pre-order through full lifecycle |
| 2 | Inventory deduct/restore | Code ถูกต้อง (aggregated dedup, ERR guard); ยังไม่มี prod test | Order + cancel, verify inventory_transactions |
| 3 | Capacity restore on cancel | FOR UPDATE lock verified; trigger ยังไม่ได้ prod test | Cancel order, verify capacity count restored |
| 4 | Card charge bill (PAY-02) | Refund ทำงาน完美; ขาด bill | ให้ real card charge receipt |
| 5 | Production Lighthouse Perf ≥ 90 | Local ≈29; ยังไม่ได้ prod measurement | Run Lighthouse บน bitemebaby-5f7.pages.dev |
| 6 | Same-day E2E live trace | ไม่มี prod order captured ระหว่าง session นี้ | Verify 1 same-day order จบ lifecycle |
| 7 | Notifications delivery | Event bus ทำงานได้; push/email/SMS ไม่มี | Implement post-M1 หรือ defer เป็นทางการ |

---

## ผลลัพธ์ M1 GATE สุดท้าย

จากการประเมินตามหลัก evidence-based อย่างเข้มงวดตาม directive นี้:

# M1 NOT CLOSED (BLOCKED)

### สาเหตุที่ไม่ปิด:

P0 items จำนวน 3 รายการยังขาด production runtime evidence:
1. **Pre-order end-to-end**: Architecture และ implementation สมบูรณ์และถูกต้อง แต่ไม่มีการทดสอบ pre-order จริงใน production เลย จุดติดขัดไม่ใช่โค้ด — แต่เป็นหลักฐาน ต้อง placement real pre-order ผ่าน full lifecycle
2. **Real card charge bill สำหรับ PAY-02**: Payment infrastructure ทำงานสมบูรณ์ (webhook 6/6 verified, refund 172 THB สำเร็จ) — เพียงแต่เจ้าของยังไม่ได้ให้ charge receipt
3. **Production Lighthouse Perf ≥ 90**: Production URL มีอยู่แล้วที่ https://bitemebaby-5f7.pages.dev — ต้องทำการวัดผล

### สิ่งที่ DECLARED VERIFIED ได้ตอนนี้แล้ว (20 รายการ):

Same-Day ordering spine, Payment spine, Real Stripe refund, Order state machine, RLS hardening, Inventory CRUD DB-backed, AI key security, aiToolCalling disabled, Admin panels ทั้ง 17 หน้า, Delivery Management (ไม่มี mocks), Migrations 001–035, CI/Build/Lint/Tests ผ่านทั้งหมด, PWA installable, Customer cancel button, 5km gate, Same-day cutoff enforcement, Pre-order canonical RPC, Pre-order address mandatory, Pre-order kitchen batching, Legacy pre_orders migration

### เส้นทางสู่การ CLOSE:

งานวิศวกรรมเกือบเสร็จสมบูรณ์แล้ว การปิด M1 ต้องการ **สูงสุด 5 การกระทำ** ซึ่งทั้งหมดทำได้ในไม่กี่นาทีเมื่อ owner place real pre-order:

1. Owner place 1 real pre-order → pay → confirm → creates batch → dispatches → delivers → capture screenshots
2. Owner ให้ real card charge receipt เดี่ยวจาก Stripe Dashboard
3. Owner run Lighthouse บน production URL
4. Engineering commit documentation updates เพื่อ sync docs กับ HEAD ปัจจุบัน

หาก owner ชอบทำเองมากกว่านี้ (REAL-WORLD PILOT ตามแผนดั้งเดิม) — นั่นสอดคล้องกับ phased approach ของโปรเจกต์ — ทีม engineering ควรรอ pilot results ก่อนปิด M1.