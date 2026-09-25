# BMB — MASTER OBJECTIVE RECONCILIATION

## M1 CLOSURE ≠ FULL PRODUCT COMPLETION

> **⚠️ ข้อความสำคัญก่อนอ่านต่อ:** M1 Closure ≠ Full Product Completion (การปิด Milestone 1 ไม่ใช่การจบสินค้า/โปรเจกต์ทั้งหมด)

> **วันที่:** 2026-09-25
> **Repository:** `bitemebaby2016-coder/bmb`
> **HEAD ณ เวลาตรวจสอบ:** `81c513b` (branch `main` = `origin/main`)
> **ผู้ตรวจสอบ:** AI Engineering Agent (ตรวจจาก Code / Database Migration / Evidence จริงเท่านั้น — ห้ามใช้ Fake Evidence, ห้าม Mock ข้อมูล, ห้ามใช้ Documentation อย่างเดียวในการสรุป)
> **ขอบเขต:** ไฟล์นี้ไม่มีการแก้ implementation code ใดๆ ทั้งสิ้น (ตามกฎ AUDIT / RECONCILE / CLASSIFY / EVIDENCE เท่านั้น)
> **Revision 2 (แก้ตาม owner feedback):** ตีความ SAME_DAY / PRE_ORDER ใหม่เป็น **operating model คนละ lifecycle** (Section 5), แยก Capacity mechanism vs business capability (Section 8), Kitchen/Delivery แยก current-day vs scheduled (Section 9/10), และแก้ M1 Acceptance Model เป็น **2 Operational E2E แยกโหมด** (Section 23) — ห้ามแก้โค้ด

---

## 0. PURPOSE

ก่อนแก้ code เพิ่ม ห้ามสรุปว่า BMB เหลือเพียง 3 owner actions และห้ามถือว่า M1 closure evidence = full product completion

เอกสารนี้เป็น **Master Objective Reconciliation** เพื่อพิสูจน์ว่า:

> สิ่งที่เจ้าของกำหนดให้ BMB เป็น Cloud Kitchen Operating Platform ตั้งแต่ต้น
> ถูก implement จริงครบแค่ไหน, เชื่อมต่อกันจริงแค่ไหน, production runtime ผ่านแค่ไหน และอะไรถูก defer อย่างมีเหตุผล

ต้องแยกให้ชัด 2 คำถามที่ห้ามปนกัน:

### A. M1 CLOSURE

> M1 technical/operational acceptance criteria ปิดครบหรือยัง?

### B. FULL BMB PRODUCT OBJECTIVE

> BMB Cloud Kitchen Platform ตาม objective ที่กำหนดไว้ทั้งหมด สร้างครบและพร้อมใช้งานจริงหรือยัง?

**ห้ามใช้ A แทน B** — สองสิ่งนี้เป็นคนละเรื่องกันโดยสิ้นเชิง

---

## 1. NON-NEGOTIABLE AUDIT RULES

ลำดับชั้นของหลักฐาน (evidence hierarchy) ที่ใช้ในเอกสารนี้:

```text
1. Running production behavior
2. Live Supabase schema / RPC / RLS / data
3. Application runtime code
4. Integration configuration / Edge Functions / Make.com
5. Automated tests
6. Migrations
7. Documentation
8. AI assumptions
```

กฎที่ห้ามฝ่าฝืนเด็ดขาด:

```text
HARDCODED != VERIFIED
EXISTS FILE != FEATURE COMPLETE
TEST EXISTS != PRODUCTION VERIFIED
RPC EXISTS != CUSTOMER FLOW CONNECTED
ADMIN PAGE EXISTS != ADMIN SYSTEM COMPLETE
AI FUNCTION EXISTS != AI SYSTEM INTEGRATED
MOCK REMOVED != REAL WORLD FLOW VERIFIED
DOCUMENTATION CLAIM != IMPLEMENTATION EVIDENCE
```

ห้ามสร้าง fake evidence, mock evidence หรือ claim จาก documentation อย่างเดียว

---

## 2. BASELINE RECONCILIATION (ตรวจก่อนเริ่มงาน)

ผลการตรวจจริง ณ 2026-09-24:

| รายการ | ค่า | หลักฐาน |
|--------|-----|---------|
| Branch | `main` | `git branch --show-current` |
| HEAD | `1df7498` | `git rev-parse HEAD` |
| Origin/main | `1df7498` | `git rev-parse origin/main` |
| Working Tree | มี staged deletion ของไฟล์นี้เอง (งานนี้สร้างขึ้นใหม่แทน) | `git status --short` |
| `04d19c7` เป็น ancestor ของ HEAD | **PASS** (exit code 0) | `git merge-base --is-ancestor 04d19c7 HEAD` |

### สรุป baseline

1. **`04d19c7` (fix: replace MOCK_DRIVERS with real DB drivers) ถูก merge แล้ว** — ยืนยันจาก ancestor check + โค้ดปัจจุบัน `src/pages/admin/DeliveryManagement.tsx` import `listDrivers()` จาก `src/lib/bmbAdminApi_drivers.ts` ซึ่งเรียก RPC `list_drivers` จริง — **ห้าม reimplement 04d19c7**
2. เอกสาร `docs/BMB_M1_CLOSURE_EVIDENCE_2026-09-24.md` สอดคล้องกับ actual repository state — commit หลังจากนั้นทั้งหมดเป็น docs-only ไม่มีการเปลี่ยนสถานะ code
3. **HEAD ปัจจุบัน:** `81c513b` (feat(PRE-05): weekly PRE_ORDER menu + mode/round controls (Migr 039)) — Migrations 001–039 live, contracts 8/8 PASS, vitest 358/358

### คำจำกัดความสถานะ (MATRIX LEGEND)

| สถานะ | ความหมาย |
|-------|----------|
| **VERIFIED** | Implement ครบทั้ง Code, DB, RPC และมีหลักฐานการทำงานจริงบน Production |
| **PARTIAL** | มี Code, DB, RPC แล้วแต่ยังขาดหลักฐานสำคัญอย่างน้อยหนึ่งชั้น (ส่วนใหญ่คือ production runtime evidence) |
| **MISSING** | ยังไม่มีการ Implement เลย — ไม่พบ Code / DB / RPC / Flow ที่เกี่ยวข้อง |
| **BLOCKED** | ระบบพร้อมแต่ถูก block จาก dependency ภายนอก (API key, credentials, owner decision) |
| **OWNER-ONLY** | ต้องทำโดยตรงจาก Owner เท่านั้น (production secrets, API keys, order จริง, bill จริง) |
| **DEFERRED** | เลื่อนออกไป phase หลังหรือ post-M1 อย่างชัดเจน |

**ห้ามใช้คำว่า `COMPLETE` เว้นแต่มีหลักฐานครบทุกชั้นตามลำดับชั้นด้านบน**

---

## 3. MASTER OBJECTIVE MATRIX (โครงสร้างมาตรฐาน)

ทุกตารางในเอกสารนี้ใช้โครงสร้างแถวมาตรฐานเดียวกัน:

```text
| Domain | Original Objective | Required Capability | Implementation Evidence | DB/RPC Evidence | Runtime Evidence | Production Evidence | Status | M1/P2/Deferred | Exact Gap |
```

Status ใช้เพียง: `VERIFIED / PARTIAL / MISSING / BLOCKED / OWNER-ONLY / DEFERRED`

---

## 4. RECONCILE: CUSTOMER ORDERING PLATFORM

| หัวข้อ | หลักฐานจากโค้ดจริง | สถานะ | ช่องว่างที่เหลือ |
|--------|--------------------|-------|------------------|
| Customer PWA | `index.html` + PWA manifest + `HomePage/MenuPage/CartPage/CheckoutPage` | VERIFIED | — |
| Mobile-first ordering | Responsive + lazy page chunks + WebP assets | PARTIAL | ต้องวัดผลบน production จริง |
| Menu | `MenuPage.tsx` + `products` table + `bmbAdminApi_products.ts` | VERIFIED | — |
| Product availability | `src/lib/availabilityEngine.ts` (quota + cutoff + sold-out) | PARTIAL | engine มีจริง แต่ไม่มี production trace |
| Same-day ordering — ORDER CREATION | RPC `create_order_with_items` (Migr 007→016→020) server-authoritative | VERIFIED (creation เท่านั้น) | — |
| Same-day ordering — FULL OPERATION (current-day path: availability→cutoff→capacity→fee→payment→confirm→inventory→kitchen→current round→dispatch→delivered) | RPC + trigger + CheckoutPage + AdminKitchen + DeliveryManagement | **PARTIAL** | ต้องพิสูจน์ current-day operational path ครบ chain (ดู Section 5 MODE A) |
| Pre-order — ORDER CREATION | Migr 024/025 canonical RPC + Migr 035 address trigger | VERIFIED (creation เท่านั้น) | — |
| Pre-order — FULL SCHEDULED LIFECYCLE (scheduled production + scheduled delivery, ดู MODE B) | Migr 024/025/027/035 + AdminPreOrders | **PARTIAL** | ยังไม่พิสูจน์ lifecycle ครบ 20 ขั้น (ordered→…→delivered/cancel→restore/refund) |
| Scheduled date | `scheduled_date` ใน canonical order spine (Migr 023) | VERIFIED (schema) | — |
| Delivery round | `delivery_rounds` + `orders.delivery_round_id` + capacity ต่อรอบ | VERIFIED (schema) | — |
| Address | Migr 015 (customer_location) + Migr 035 trigger `validate_pre_order_delivery()` บังคับ address สำหรับ PRE_ORDER | PARTIAL | ไม่มี production evidence |
| Delivery fee | `compute_delivery_fee` zone-based (Migr 020) + `deliveryFeeApi.ts` | PARTIAL | ไม่มี real flow trace |
| Cutoff | CheckoutPage ตรวจ `cutoff_time` ก่อนสร้าง order (commit `886836d`) | VERIFIED (code) | ต้องมี production trace |
| Capacity | Trigger `orders_increment_round` + `FOR UPDATE` lock + `ERR_CAPACITY_FULL` | VERIFIED (DB logic) | ไม่มี stress test จริง |
| Payment | `record_payment_result` (service_role, idempotent, amount-match) + Stripe webhook verified 6/6 (2026-09-19) + PromptPay TXN reference | PARTIAL | ไม่มี real card charge bill |
| Confirmation | Order state machine ฝั่ง server (allow-list + BEFORE UPDATE trigger + audit log) | VERIFIED | — |
| Cancellation | RPC cancel + restore inventory (Migr 018/019) + คืน capacity (Migr 017 pre-order) | PARTIAL | ไม่มี real cancel trace บน prod |
| Refund | Edge Function พร้อม, payment state machine รองรับ | PARTIAL | ไม่มีบิล refund จริง |
| Order tracking / status | `OrderTrackPage.tsx` + `OrdersPage.tsx` อ่าน DB จริง | PARTIAL | ต้อง verify กับ order จริงบน prod |
| Order history | `OrdersPage.tsx` | VERIFIED (code) | — |

---

## 5. SAME-DAY vs PRE-ORDER — BUSINESS MODEL RECONCILIATION (แทน feature checklist เดิม)

### 5.0 หลักการสำคัญที่สุดของ audit รอบนี้

> **Shared backend ≠ shared business lifecycle**

SAME_DAY และ PRE_ORDER ใช้ canonical order spine เดียวกัน (`orders` + `order_mode`) — แต่เป็น **operating model คนละแบบ**:

```text
                 CANONICAL ORDER SPINE
                         │
             ┌───────────┴───────────┐
             │                       │
         SAME_DAY                PRE_ORDER
       "ส่งวันนี้"              "จองล่วงหน้า"
             │                       │
      CURRENT OPERATING         SCHEDULED OPERATING
             │                       │
      วันนี้ / cutoff           future date
      current capacity          date capacity
      current round             selected round
      current dispatch          scheduled batch
             │                       │
             └──────────┬────────────┘
                        │
                 Kitchen / Delivery
```

**ข้อห้ามในการตีความ:**

1. **ห้าม**ตีความว่า `SAME_DAY = PRE_ORDER แต่ scheduled_date = วันนี้` — ทำให้ business rules ของ same-day (current cutoff, current capability, current dispatch window) หายไป
2. **ห้าม**ใช้ PRE_ORDER E2E เป็นตัวแทนของ SAME_DAY (หรือกลับกัน) — แต่ละ mode ต้องมี M1 Operational E2E ของตัวเอง
3. **ห้าม**ถือว่า DB mechanism (lock/trigger/RPC) = business capability ที่ VERIFIED

### 5.1 MODE A — SAME_DAY: CURRENT-DAY OPERATIONAL PATH

Objective เดิม: ลูกค้า "สั่งตอนนี้ → รับ/ส่งวันนี้" พร้อมเงื่อนไข operational ของตัวเอง

```text
Customer
 ↓
เลือกเมนู
 ↓
SAME_DAY
 ↓
ตรวจ availability            ← availabilityEngine
 ↓
ตรวจ cutoff (วันนี้)          ← CheckoutPage (886836d)
 ↓
ตรวจ capacity (current date + current round)
 ↓
คำนวณ delivery               ← compute_delivery_fee
 ↓
ชำระเงิน / payment state     ← record_payment_result
 ↓
confirm                      ← state machine + inventory hook
 ↓
inventory deduct             ← deduct_inventory_for_order
 ↓
เข้า kitchen queue           ← create_production_batch (SAME_DAY)
 ↓
จัดรอบส่งปัจจุบัน (TODAY round / dispatch window)
 ↓
Bite Drive / external rider
 ↓
dispatch
 ↓
delivered
```

**การแยกสถานะที่ถูกต้อง (แทนการตอบ "มี order วันนี้"):**

| ขั้นของ SAME_DAY chain | สถานะ |
|------------------------|-------|
| Order creation (server-authoritative) | VERIFIED |
| Availability check | PARTIAL |
| Current-day cutoff enforcement | VERIFIED (code) / ไม่มี prod trace |
| Current capacity (today + current round) reserve → full → reject | PARTIAL |
| Delivery fee ปัจจุบัน | PARTIAL |
| Payment / payment state | PARTIAL (ไม่มี bill จริง) |
| Confirm + inventory deduct | PARTIAL (ไม่มี prod trace) |
| เข้า kitchen queue (SAME_DAY batch) | PARTIAL |
| จัดรอบส่งปัจจุบัน / current dispatch window | PARTIAL |
| Dispatch → delivered วันเดียวกัน | PARTIAL |

> **SAME_DAY ORDER CREATION = VERIFIED / SAME_DAY FULL OPERATION = PARTIAL** — จนกว่าจะพิสูจน์: order → payment → confirm → inventory → kitchen → current delivery round → dispatch → delivered ครบ

### 5.2 MODE B — PRE_ORDER: SCHEDULED OPERATING MODEL

PRE_ORDER ของ BMB **ไม่ใช่ SAME_DAY ที่เปลี่ยนวันที่** — เป็น **scheduled production + scheduled delivery model**

```text
วันนี้
  ↓
ลูกค้าจอง
  ↓
เลือก scheduled_date          (เช่น 2026-09-25)
  ↓
เลือกรอบ                       (เช่น Morning 06:00–09:00)
  ↓
capacity ของวันนั้น/รอบนั้น    (date + round เป็นหัวใจของการวางแผน)
  ↓
payment
  ↓
confirmed
  ↓
รอ production date
  ↓
Kitchen batch                 (ตาม scheduled_date + round)
  ↓
เตรียมตาม scheduled_date + round
  ↓
Dispatch ตามรอบ
  ↓
Delivered
```

**PRE_ORDER lifecycle เฉพาะของมัน (ไม่ใช่ state machine เดียวกับ same-day เฉยๆ):**

```text
ORDERED
   ↓
PAID / CONFIRMED
   ↓
SCHEDULED
   ↓
QUEUED_FOR_PRODUCTION
   ↓
BATCHED
   ↓
PREPARING
   ↓
READY
   ↓
DISPATCHED
   ↓
DELIVERED
```

**PRE_ORDER capability = ทั้ง chain 20 ขั้นนี้ — ไม่ใช่เพียง Migration 024/025/035 ผ่าน:**

| # | ขั้น | สถานะ |
|---|------|-------|
| 1 | เลือกวันที่ (min today+1, ห้ามวันนี้/อดีต) | VERIFIED (code) |
| 2 | เลือกรอบ | VERIFIED (code) |
| 3 | ตรวจว่ารับ pre-order ได้ (pre-order window) | PARTIAL |
| 4 | ตรวจ cutoff ของ pre-order (แยกจาก same-day cutoff) | PARTIAL |
| 5 | ตรวจ capacity ของ date+round (อนาคต) | PARTIAL |
| 6 | ตรวจ address (Migr 035 trigger) | VERIFIED (code) / ไม่มี prod trace |
| 7 | คำนวณ delivery fee | PARTIAL |
| 8 | payment | PARTIAL |
| 9 | confirm | VERIFIED (code) |
| 10 | reserve capacity (date+round) | PARTIAL |
| 11 | deduct inventory ตาม lifecycle ที่ออกแบบ | PARTIAL |
| 12 | เข้า production batch (Migr 027 PRE_ORDER) | VERIFIED (code) / ไม่มี prod batch |
| 13 | ถึงวันผลิต (scheduled_date) | PARTIAL — ไม่มี prod trace |
| 14 | kitchen prepare ตาม schedule | PARTIAL |
| 15 | ready | PARTIAL |
| 16 | assign driver | PARTIAL |
| 17 | dispatch ตามรอบ (scheduled_date + delivery_round + capacity + production batch + delivery assignment) | PARTIAL |
| 18 | delivered | PARTIAL |
| 19 | cancel ก่อน cutoff → restore capacity + inventory | PARTIAL |
| 20 | refund ตาม payment state | PARTIAL |

**ข้อสรุป PRE_ORDER (แก้ถ้อยคำเดิม):** ถ้อยคำเดิมที่ให้ความรู้สึกว่า "architecture ของ PRE_ORDER เกือบปิดแล้ว เหลือเพียง production trace" ถูกแก้ไขแล้ว — สิ่งที่ถูกคือ architecture + creation สร้างเสร็จ แต่ **PRE_ORDER operational scheduling capability ยัง PARTIAL เพราะไม่เคยพิสูจน์ chain date+round → production batch → delivery round แบบ end-to-end**

### 5.3 Matrix เทียบ operational semantics (แทน feature checklist เดิม)

| ประเด็น | SAME_DAY (current operating) | PRE_ORDER (scheduled operating) |
| -------- | ---------------------------- | -------------------------------- |
| ความหมายทางธุรกิจ | ส่งวันนี้ — current-day fulfillment | จองล่วงหน้า — scheduled production + delivery |
| วันที่ | วันนี้ (current date) | future scheduled_date |
| รอบ | current round / dispatch window ของวันนี้ | selected round ของวันอนาคต |
| Capacity | current capacity (today + current round) | date capacity (future date + selected round) |
| Cutoff | current cutoff ของวันนี้ | pre-order cutoff แยกของตัวเอง |
| Kitchen | เข้า queue ปัจจุบัน | queued_for_production → batch ตามวันผลิต |
| Delivery | current dispatch window | dispatch ตามรอบที่จองไว้ |
| การยกเลิก | ตามนโยบาย cancel ปัจจุบัน | cancel ก่อน cutoff → restore |
| Shared | canonical spine + payment + kitchen + delivery **infrastructure** เดียวกัน | เดียวกัน |

**คอลัมน์ข้างบนคือ lifecycle คนละชุดที่แชร์ infrastructure เดียวกัน — ห้ามอ่านเป็น feature checklist เดียวกันอีกต่อไป**

---

## 6. ORDER SPINE

| องค์ประกอบ | หลักฐาน | สถานะ |
|------------|---------|--------|
| `orders` | Migr 001/023 — canonical order domain | VERIFIED |
| `order_mode` | Migr 023 — `SAME_DAY` / `PRE_ORDER` ในตารางเดียว | VERIFIED |
| `scheduled_date` | Migr 023 | VERIFIED |
| `delivery_round_id` | Migr 023 + FK | VERIFIED |
| `order_status` | enum + allow-list + BEFORE UPDATE trigger (Migr 008/030) | VERIFIED |
| `payment_status` | payment state machine idempotent (Migr 008/010) | VERIFIED |
| `delivery_status` | `delivery_assignments` (Migr 020) | PARTIAL — ไม่ sync orders.status ทุก path |
| `order_items` | Migr 001/007 — atomic INSERT | VERIFIED |
| `inventory` | Migr 019/026 — deduct/restore + transactions | PARTIAL (prod test) |
| `capacity` | trigger per-round + row lock | VERIFIED (DB logic) |

**สรุป spine:** SAME_DAY และ PRE_ORDER ใช้ canonical order spine เดียวกันจริง (Migr 023/025/027) — **แชร์ infrastructure เดียวกัน แต่เป็น business lifecycle คนละชุด** (ดู Section 5: current operating vs scheduled operating — ห้ามตีความว่า SAME_DAY = PRE_ORDER ที่ scheduled_date = วันนี้)

**Legacy `pre_orders` ตรวจแล้ว:** Migr 024/025 ย้ายข้อมูลเก่าเข้า `orders` พร้อม `migrated_order_id`; ตาราง `pre_orders` freeze เป็น archive (anon DENY, auth write REVOKED, RPC-write-only) — **ไม่มี hidden legacy flow ที่ยังทำงานแยกเป็น second source of truth** ตาม `PWA_CANONICAL_ORDER_CONSUMER_AUDIT.md`

---

## 7. INVENTORY

| รายการ | หลักฐาน | สถานะ |
|--------|---------|--------|
| Recipe / BOM | `recipes` table + AdminRecipes + `list_recipes_with_inventory()` RPC (Migr 035) | VERIFIED (code) |
| Ingredient | `ingredients` + `inventory` tables | VERIFIED |
| Order confirmation → deduction | `deduct_inventory_for_order` hook + Migr 026 aggregate fix | PARTIAL — ไม่มี production runtime test |
| Cancel → restore | `restore_inventory_for_order` (Migr 019) | PARTIAL — ต้องทดสอบ cancel จริง แล้วตรวจ `inventory_transactions` |
| Insufficient stock → reject | `ERR_INSUFFICIENT_INGREDIENT` (Migr 026 แทน clamp-to-0) | VERIFIED (code) |
| Concurrency | aggregate per-ingredient + transaction guard | PARTIAL — ไม่มี stress test |

**กฎตามข้อกำหนด:** ต้องพิสูจน์ `confirm → deduct`, `cancel → restore`, `insufficient → reject atomically` ให้ครบ — ยังไม่มี production runtime evidence ครบวงจร สถานะรวมของ Inventory lifecycle จึงเป็น **PARTIAL** ไม่ใช่ VERIFIED

---

## 8. CAPACITY — MECHANISM ≠ BUSINESS CAPABILITY

> **กฎของ Section นี้:** DB mechanism VERIFIED **ไม่เท่ากับ** business capability VERIFIED

| รายการ | หลักฐาน | สถานะ |
|--------|---------|--------|
| Date / round | `delivery_rounds` + `scheduled_date` | VERIFIED (schema) |
| **Capacity enforcement mechanism** | Trigger `orders_increment_round` + `FOR UPDATE` row lock + `ERR_CAPACITY_FULL` | **VERIFIED (mechanism เท่านั้น)** |
| Confirm ผูกกับ lifecycle | ผูกกับ order lifecycle | VERIFIED (schema) |
| Cancel → restore capacity | PRE_ORDER: `cancel_pre_order` (Migr 017); SAME_DAY: transition path (Migr 030) | VERIFIED (mechanism) |
| Full capacity → reject | `ERR_CAPACITY_FULL` | VERIFIED (mechanism) |
| Concurrency mechanism | `FOR UPDATE` lock ต่อรอบ | VERIFIED (mechanism) — design ถูกต้อง |

### 8.1 แยก Mechanism ออกจาก Operational Behavior

**ห้ามสรุป "SAME_DAY Capacity = VERIFIED / PRE_ORDER Capacity = VERIFIED" จากการที่ DB มี lock/trigger** — ต้องแยกดังนี้:

| ชั้น | รายการ | สถานะ |
|------|--------|-------|
| Mechanism | Capacity enforcement (lock + trigger + reject error) | **VERIFIED** |
| Operational | **SAME_DAY capacity behavior** — today + current round: reserve → full → reject → cancel → release | **PARTIAL** (ไม่มี production runtime evidence) |
| Operational | **PRE_ORDER capacity behavior** — future date + selected round: reserve → full → reject → cancel → release | **PARTIAL** (ไม่มี production runtime evidence) |

**สิ่งที่ยังต้องพิสูจน์ runtime ให้ครบ ทั้งสองโหมด:**

```text
SAME_DAY   current date + current round → reserve → full → reject → cancel → release
PRE_ORDER  future date + selected round → reserve → full → reject → cancel → release
```

**PRE_ORDER + scheduled_date + delivery_round — ต้องพิสูจน์ว่า oversell ไม่ได้จริง ณ runtime:** กลไกอยู่ฝั่ง server (server-authoritative) ตาม design แต่ไม่เคยพิสูจน์ด้วย production evidence หรือ stress test — สถานะรวมของ **business capability = PARTIAL** แม้ **mechanism = VERIFIED**

---

## 9. KITCHEN COMMAND CENTER

| รายการ | หลักฐาน | สถานะ |
|--------|---------|--------|
| AdminKitchen page | `src/pages/admin/AdminKitchen.tsx` (commit `ff54783`) | VERIFIED (code) |
| Production batches | `production_batches` + `production_batch_items` (Migr 019/027) | VERIFIED |
| Batch status | status column + progression | PARTIAL — ต้อง trace จาก UI บน prod |
| scheduled_date + delivery_round | batch ผูกทั้งสองค่า | VERIFIED (schema) |
| Order aggregation | `create_production_batch` รวมจาก `orders` (confirmed/preparing) | VERIFIED |
| Batch mechanism ทั้งสองโหมด | Migr 027: canonical source = orders + order_items เท่านั้น (NEVER pre_orders), `p_order_mode` NULL = both, legacy 2-arg overload DROP แล้ว | VERIFIED (mechanism เท่านั้น — batch mechanism รองรับทั้งสอง mode ไม่เท่ากับ production lifecycle ผ่าน) |
| SAME_DAY current-day queue behavior | batch จาก confirmed/preparing วันนี้ → เตรียม → dispatch window ปัจจุบัน | PARTIAL — ไม่มี prod trace |
| PRE_ORDER scheduled batch lifecycle | queued_for_production → batch ตาม scheduled_date + round → prepare ตามรอบ | PARTIAL — ไม่เคยพิสูจน์ chain date+round → batch → delivery round จริง |
| Recipe/BOM admin | `bmbAdminApi_recipes.ts` + `list_recipes_with_inventory()` (Migr 035) | VERIFIED (code) |

**คำถามตามข้อกำหนด:** Kitchen สามารถ operationally ทำงานจาก confirmed orders ได้จริงหรือไม่?

> **ตอบ: PARTIAL (แยกตามโหมด)** — มี DB RPC จริง (`create_production_batch`, `kitchen_queue`, `get_inventory_requirements`) รองรับทั้งสอง mode — นั่นคือ **batch mechanism = VERIFIED** แต่ (1) SAME_DAY current-day queue behavior และ (2) PRE_ORDER scheduled batch lifecycle ยังไม่มี production evidence — Kitchen จึงยังไม่ได้พิสูจน์ว่า operationally ทำงานจาก confirmed orders ได้จริงครบ lifecycle ของแต่ละโหมด

---

## 10. DELIVERY / BITE DRIVE

| รายการ | หลักฐาน | สถานะ |
|--------|---------|--------|
| Drivers | `drivers` table (driver_name, phone_number, status, active_assignments) | VERIFIED |
| Driver status | `setDriverStatus()` + RPC | PARTIAL — status update flow ต้องทดสอบจริง |
| Assignment | `delivery_assignments` (Migr 020) + `assignOrderToDriver()` | PARTIAL — RPC มี ต้องมี prod trace |
| Order dispatch | `assign_driver` RPC (Migr 020/035) | PARTIAL |
| Delivery status | `driver_update_delivery_status` (Migr 020) | PARTIAL — อัปเดต assignment; orders.status sync ต้องยืนยัน |
| Self delivery ≤ 5 km | Migr 035 — กฎ 5 กม. ฝั่ง server | VERIFIED (mechanism) |
| External rider > 5 km | provider system (Grab/LineMan/Foodpanda) sandbox logic 5/5 tests | **BLOCKED** — ไม่มี API keys จริง (OWNER-ONLY) |
| Delivery fee | `compute_delivery_fee` zone-based | PARTIAL |
| Distance | Migr 015 customer location columns | VERIFIED (schema) |
| Round — SAME_DAY (current-day fulfillment) | current round / dispatch window ของวันนี้: available_now → current cutoff → current capability → current round/dispatch window | PARTIAL — logic มีใน availabilityEngine + round mapping แต่ไม่มี prod trace ของ current-day dispatch window |
| Round — PRE_ORDER (scheduled fulfillment) | รอบเป็นหัวใจของการวางแผน: scheduled_date + delivery_round + capacity + production batch + delivery assignment (เช่น 2026-09-25 Morning 06:00–09:00 ใช้ตั้งแต่ order → kitchen → delivery) | PARTIAL — schema รองรับทั้งหมด แต่ไม่เคยพิสูจน์ end-to-end ว่า date+round chain ถูกใช้จริงตลอด order → kitchen → delivery |
| Tracking / ETA | `OrderTrackPage.tsx` + `routeOptimization.ts` | PARTIAL — ต้อง verify บน prod |

**ตรวจ `04d19c7` ถูกใช้งานจริง:** **YES** — `DeliveryManagement.tsx` import และเรียก `listDrivers()` → RPC `list_drivers` จริง ไม่ใช่แค่มี function อยู่เฉยๆ

---

## 11. CUSTOMER → ORDER INTAKE CHANNELS

Canonical rule ที่ทุก channel ต้องเดินตาม:

```text
all channels
    ↓
canonical order_id
    ↓
Supabase Order Hub (orders table)
```

| Channel | การแยกสถานะ | หลักฐาน |
|---------|-------------|---------|
| PWA (Direct web) | **IMPLEMENTED** | `create_order_with_items` → canonical `orders` — ยืนยันโดย `PWA_CANONICAL_ORDER_CONSUMER_AUDIT.md` |
| Manual (admin สร้างแทน) | **IMPLEMENTED** (basic) | AdminOrders จัดการ order ใน canonical table |
| Facebook | **PLANNED — ห้ามนับเป็น implemented** | ไม่มี code เชื่อม Facebook เข้า Order Hub |
| Messenger | **PLANNED — ห้ามนับเป็น implemented** | เดียวกัน |
| LINE | **PLANNED — ห้ามนับเป็น implemented** | เดียวกัน |
| Future channels | **DEFERRED** | Phase หลัง (P2+) |

**สรุป:** Canonical rule ถูก enforce จริงเฉพาะ PWA + Manual — planned integration ไม่ถูกนับเป็น implemented ตามกฎของเอกสารนี้

---

## 12. MAKE.COM AUTOMATION

คำถามหลัก: **Make.com เป็น worker จริงหรือยัง หรือเป็นเพียง architecture decision?**

| รายการ | สถานะ |
|--------|-------|
| Live scenario บน Make.com | ไม่พบ live scenario evidence (ไม่มี webhook log / scenario ID / Supabase→Make wiring) |
| Back-office automation | **DEFERRED / OWNER-ONLY** |
| Facebook/Messenger intake ผ่าน Make | **PLANNED** — architecture decision ใน blueprint เท่านั้น |
| Notifications ผ่าน Make | **PLANNED** |
| Operational workflows / external integrations | **PLANNED** |

**ตอบ:** ณ วันนี้ Make.com **ยังไม่ใช่ worker จริง** — ตามลำดับชั้นหลักฐานจึงสรุปเป็น **PARTIAL / OWNER-ONLY / DEFERRED** (ต้องการ owner decision + credentials)

---

## 13. AI SYSTEM

สถาปัตยกรรมที่ตกลงไว้: **AI = Intelligence / Extraction / Assistance** — AI ห้ามมี authority เหนือ price, payment, stock, capacity, cancel, refund, delivery fee, order state

### A. AI architecture (enforce จริงหรือไม่)

| ข้อ | สถานะ |
|-----|-------|
| AI ไม่มีสิทธิ์แตะ order state / เงิน / stock / cancel / refund | **VERIFIED** — ไม่มี mutation tools ที่ลงทะเบียน; AI order access ผูก RLS อ่านได้เฉพาะแถวของตัวเอง (`PWA_CANONICAL_ORDER_CONSUMER_AUDIT.md`) |
| Permission boundary / Guardrails | `aiGuardrails.ts` + `aiGuardrailsAdv.ts` — VERIFIED (code) |

### B. AI implementation

| รายการ | หลักฐาน | สถานะ |
|--------|---------|--------|
| AI content generation | `contentAutomation.ts` | VERIFIED (code) |
| Content assistance | `contentApproval.ts`, `mascotService.ts` | VERIFIED (code) |
| Extraction | `customerIntelligence.ts` | VERIFIED (code) |
| Customer assistance chat | `aiService.ts` (Model A: GLM 5.2 free + fallback Qwen 3.7 Flash) | VERIFIED (code + test 19/19) |
| Order parsing | ภายใต้ guardrails | PARTIAL — ไม่มี prod trace |
| Proactive intelligence | `demandForecasting.ts` / `promotionIntelligence.ts` / `inventoryPrediction.ts` | PARTIAL — lib เท่านั้น ไม่มี production loop |
| Tool calling | `aiToolCalling.ts.disabled` (commit `716b4e9`) | **DEAD CODE ปิดอย่างถูกต้อง** — เดิมไม่ถูก import + เสี่ยง expose OpenRouter API key ฝั่ง client; ไม่ได้ wire เข้า chat จริง |
| Disabled/dead code | ไม่ตกค้างใน bundle — scan = 0 key hits | VERIFIED |
| Provider integration | OpenRouter ผ่าน proxy | PARTIAL — ต้องใช้ key จริงของ owner |

### C. แยก 3 ชั้นตามข้อกำหนด

```text
AI architecture           = VERIFIED (permission boundary + guardrails + RLS)
AI implementation         = VERIFIED (code-level พร้อมใช้)
AI production integration = PARTIAL (ต้องมี prod conversation trace + owner key)
```

---

## 14. CONTENT ENGINE

Original objective ของ BMB ไม่ได้จบที่ order: `Content → Customer acquisition → Order`

| รายการ | สถานะ | หลักฐาน |
|--------|-------|---------|
| Facebook content posting | PARTIAL / OWNER-ONLY | ต้องใช้ FB token ของ owner; ไม่มี live posting trace |
| Content generation | VERIFIED (code) | `contentAutomation.ts` (social post / email / blog / promo) |
| Content management | PARTIAL | `contentApproval.ts` มี แต่ไม่มี production workflow trace |
| Reusable content | PARTIAL | content templates ใน lib |
| AI-assisted content | VERIFIED (code) | `aiService.ts` + contentAutomation |
| Content → order loop | **MISSING** | ไม่มีการวัด content → traffic → order จริง |

**เหตุผลการ defer เป็น P2 (ต้องระบุชัด):** ต้องเชื่อม Meta/FB API ของ owner + เป็น growth layer ที่ไม่ block การ operational ของ M1 (ครัวแรกต้องทำงานก่อน) Requirement ที่ defer ต้องกลับมาทำ: content management UI เต็มรูปแบบ + content → order attribution/loop

---

## 15. NOTIFICATION SYSTEM

| Event | In-memory event | Database event | Actual push/email/LINE/Messenger |
|-------|-----------------|----------------|----------------------------------|
| Order confirmation | ✅ | ✅ (order row + audit log) | ❌ MISSING |
| Payment confirmation | ✅ | ✅ (payment_intents) | ❌ MISSING |
| Kitchen status | ✅ | ✅ (batch status) | ❌ MISSING |
| Dispatch | ✅ | ✅ (assignments) | ❌ MISSING |
| Delivery | ✅ | ✅ | ❌ MISSING |
| Cancellation | ✅ | ✅ | ❌ MISSING |
| Refund | ✅ | ✅ | ❌ MISSING |

**สรุปตามกฎข้อกำหนด:** ปัจจุบันเป็น in-app event bus + database event เท่านั้น (`notificationService.ts`, `NotificationCenterPage.tsx`) — **ลูกค้ายังไม่ได้รับ push/email/LINE จริง** จึง**ห้ามเรียก event emitter ว่า notification system เต็มรูปแบบ** สถานะ = **PARTIAL** (P2 ตาม M1 closure evidence)

---

## 16. REVIEW / FEEDBACK LOOP

Original closed-loop objective:

```text
Content → Customer → Order → Kitchen → Delivery → Review → Data → AI → Better Content
```

| Node | สถานะ | หลักฐาน |
|------|-------|---------|
| Content | PARTIAL | สร้างได้ (code) แต่ไม่มี live posting |
| Customer | VERIFIED | PWA + customers table |
| Order | PARTIAL | canonical spine พร้อม ขาด prod E2E trace |
| Kitchen | PARTIAL | batch RPC พร้อม ไม่มี prod batch cycle |
| Delivery | PARTIAL | dispatch UI + rider PWA พร้อม ไม่มี prod ครบวงจร |
| Review | PARTIAL | `ReviewPage.tsx` + `reviews` table + `bmbAdminApi_reviews.ts` |
| Data | PARTIAL | `customerIntelligenceServer.ts` aggregate จาก DB ได้ |
| AI | PARTIAL | AI อ่าน intelligence ได้ แต่ไม่มี closed-loop automation |
| Better Content | **MISSING** | ไม่มีกลไกเอา Review/Data กลับไปปรับ content อัตโนมัติ |

**Review/Data/AI feedback loop ยังไม่มีครบ — เป็น GAP ที่ต้องแสดงชัดเจน (Section 23D GAP-7)**

---

## 17. ADMIN COMMAND CENTER

Audit ทั้งระบบ ไม่ใช่เฉพาะ page existence — ตรวจ VIEW / CREATE / EDIT / DELETE / STATE TRANSITION / DB PERSISTENCE / RLS / ERROR HANDLING

| Module | Page | CRUD | State transition | DB persistence | สถานะ |
|--------|------|------|------------------|----------------|-------|
| Dashboard | `AdminControlPage` + dashboard components | VIEW | — | ✅ | VERIFIED |
| Orders | `AdminOrders.tsx` + `bmbAdminApi_orders.ts` | VIEW/EDIT | ✅ ผ่าน `transition_order_status` + allow-list | ✅ | VERIFIED |
| Pre-orders | `AdminPreOrders.tsx` (commit `ff54783`) | CRUD เต็ม + cancellation | ✅ | ✅ | VERIFIED (code) |
| Kitchen | `AdminKitchen.tsx` + `bmbAdminApi_kitchen.ts` | CREATE batch / VIEW queue | PARTIAL | ✅ | PARTIAL (prod trace) |
| Inventory | `InventoryPage.tsx` — DB-backed (commit `9787429` แทน localStorage) | CRUD | — | ✅ | VERIFIED (code) |
| Recipes | `AdminRecipes.tsx` + `bmbAdminApi_recipes.ts` + RPC (Migr 035) | CRUD + BOM view | — | ✅ | VERIFIED (code) |
| Drivers | `DeliveryManagement.tsx` + `bmbAdminApi_drivers.ts` (list/upsert/status/assign — 04d19c7) | CRUD | PARTIAL | ✅ | PARTIAL (prod trace) |
| Delivery | `DeliveryManagement.tsx` + provider sandbox | VIEW/dispatch | PARTIAL | ✅ | PARTIAL |
| Customers | `AdminCustomers.tsx` + `bmbAdminApi_customers.ts` | VIEW + detail | — | ✅ | VERIFIED |
| Audit Logs | `AuditLogPage.tsx` อ่านจาก `audit_logs` table โดยตรง | VIEW | — | ✅ | VERIFIED |
| Settings | `bmbAdminApi_settings.ts` | CRUD | — | ✅ | VERIFIED (code) |
| Content | `bmbAdminApi_media.ts` / contentApproval | PARTIAL | — | ✅ | PARTIAL |
| AI | guardrails / intelligence admin | PARTIAL | — | ✅ | PARTIAL |

**คำถามตามข้อกำหนด:** Admin เป็น operational command center จริงหรือไม่?

> **ตอบ: PARTIAL (ใกล้ VERIFIED)** — ทุก module หลักมี CRUD + DB persistence + RLS + audit log รองรับ จุดที่ยัง PARTIAL คือ (1) state transition ของ kitchen/delivery ต้องมี production trace (2) error handling ต้องยืนยันด้วย order จริงบน prod

---

## 18. SECURITY

| รายการ | หลักฐาน | สถานะ |
|--------|---------|--------|
| RLS ทุกตาราง | Migr 005/006 (hardening) + 033 (table-ACL alignment) + 034 (prod ACL drift remediation) | VERIFIED |
| anon | SELECT เฉพาะ canonical tables; I/U/D REVOKED 16 ตาราง; `pre_orders` auth write REVOKED (024 archive RPC-write-only) | VERIFIED (Migr 033/034) |
| authenticated | Minimal grants; REVOKE ALL บน payment_intents / inventory / profiles (Migr 034) | VERIFIED |
| service_role | เฉพาะ `record_payment_result` + Stripe webhook | VERIFIED |
| RPC execute | REVOKE PUBLIC + `is_admin()` gate สำหรับ kitchen/driver/admin RPCs (Migr 019/027/028/031) | VERIFIED |
| Edge Functions | `create-checkout` re-derive ยอดจาก DB; stripe-webhook service_role + signature verify 6/6 (2026-09-19) | VERIFIED |
| Sensitive data exposure | `aiToolCalling.ts.disabled` — ปิดความเสี่ยง client-side key; bundle scan = 0 key hits | VERIFIED |
| Admin authorization | `is_admin()` + Migr 014 owner-admin full access + Migr 006 guard | VERIFIED |
| AI tool authorization | AI อ่านเฉพาะของตัวเองผ่าน RLS; ไม่มี mutation tools | VERIFIED |

**อ้างอิง:** Migration 033/034/035 + `DATABASE_SECURITY_AUDIT.md` + `AUTHORIZATION_AUDIT.md` (Production ACL gate = PASS, anon residue 0/0, REST leak closed)

**หมายเหตุ (OWNER-ONLY):** การยืนยันข้างต้นอ้างอิง migration files + audit docs — ควรทำ live database review ผ่าน Supabase Dashboard เป็นขั้นสุดท้ายโดย owner

---

## 19. VOICE

ตรวจตาม original requirement:

| รายการ | หลักฐาน | สถานะ |
|--------|---------|--------|
| Voice input | grep `voice|speech|synthesis` ใน production code = 0 hits | **MISSING** |
| Voice output | เดียวกัน | **MISSING** |
| Customer/AI interaction ทางเสียง | ไม่มี | **MISSING** |
| Browser/mobile support | ไม่มี | **MISSING** |

**การตัดสินใจของ Owner (มีหลักฐานชัดเจน — ห้ามปล่อยเป็น "unclear"):** `BITEMEBABY_PRODUCT_REALITY_MAP.md` ระบุ AI-06 **CANCELLED**:

> "Voice future — grep voice/speech/synthesis ใน repo = 0 hits → ไม่มีของจริง → ไม่เขียนว่าเสร็จ (no mockup)"

**สถานะสุทธิ: DEFERRED โดย owner decision** — เหตุผล: voice ไม่ใช่ M1 acceptance criteria; ระบบ operational ครัว/ส่งถึงบ้านต้องพิสูจน์ก่อน

---

## 20. PERFORMANCE / PRODUCTION

| รายการ | หลักฐาน | สถานะ |
|--------|---------|--------|
| Production URL | `bitemebaby-5f7.pages.dev` (Cloudflare Pages — deployed) | VERIFIED |
| Lighthouse Performance | Local measurement: 43 → 81 (best run; variance 56–81 จาก external font/CPU noise ตาม AI_WORK_STATE) | **PARTIAL** — target ≥ 90 บน production ยังไม่ทำได้ |
| Mobile | Responsive + lazy chunks + WebP บีบอัด 60–90% + preload LCP | PARTIAL — ต้องวัดบน prod |
| Accessibility / Best practices / SEO | `SeoHelmet.tsx` + meta/OG + sitemap | PARTIAL — ต้องวัดบน prod |

**กฎตามข้อกำหนด: ห้ามใช้ localhost score แทน production score** — ทุกตัวเลขที่มีอยู่เป็น local measurement เท่านั้น จำเป็นต้องรัน Lighthouse บน production URL จริง (OWNER-ONLY run + ENGINEERING fix ถ้าต่ำกว่าเกณฑ์)

---

## 21. DOCUMENTATION RECONCILIATION

แยก **CURRENT TRUTH** (ข้อเท็จจริงปัจจุบัน) กับ **HISTORICAL FINDING** (สิ่งที่เคยเป็นจริงแต่แก้แล้ว):

| เอกสาร | ข้อกล่าวอ้าง | การจัดหมวด |
|--------|-------------|-------------|
| `docs/BMB_M1_CLOSURE_EVIDENCE_2026-09-24.md` | M1 gate = BLOCKED เหลือ 3 owner actions | **CURRENT TRUTH** ✅ ตรงกับ repo state |
| `docs/BMB_MASTER_REQUIREMENT_RECONCILIATION_2026-09-23.md` + `docs/_temp_recon.md` | P0 10 items แก้ 8-10 / MOCK_DRIVERS fixed / aiToolCalling disabled / Migr 035 | **CURRENT TRUTH** (ตรวจซ้ำกับโค้ดจริงแล้ว) |
| `BMB_DEEP_PRODUCT_LOGIC_AUDIT_2026-09-22.md` | "MOCK_DRIVERS / ไม่มี AdminKitchen+PreOrders+Recipes / cutoff ไม่ enforce / OrderTrackPage mock" | **HISTORICAL FINDING** — ถูกแก้แล้วด้วย 04d19c7 / ff54783 / 886836d |
| `ADMIN_GAP_MAP.md` | "DeliveryManagement ใช้ MOCK_DRIVERS; Inventory ใช้ localStorage" | **HISTORICAL FINDING** — แก้แล้วทั้งสองจุด |
| `BMB_MASTER_PRODUCT_SPEC.md` §7/§8/§9 | เดิมขัดแย้งกับ CURRENT_STATE + Migr 019/020 | **HISTORICAL CONTRADICTION** — ยุบแล้วด้วย Migr 023/024/025 (canonical spine) |
| `BMB_100_PERCENT_CLOSURE_BOOK.md` / เอกสาร "100%" ต่างๆ | อ้าง closure ระดับต่างๆ | **HISTORICAL** — ห้ามใช้เป็น evidence ของ full product completion |
| เอกสารนี้ | Single source of truth ปัจจุบัน | **CURRENT TRUTH** |

**ผลการตรวจ contradiction:** ไม่พบเอกสารปัจจุบันที่ขัดแย้งกัน — เอกสารที่เคยบอก "PRE_ORDER missing" ถูกจัดเป็น HISTORICAL เพราะ Migr 023/024/025/027 ยุบปัญหานั้นแล้ว

---

## 22. IMPORTANT: DO NOT FIX YET

รอบนี้ทำเพียง:

```text
AUDIT / RECONCILE / CLASSIFY / EVIDENCE
```

**ห้ามแก้ implementation** (ยกเว้น bug ที่ทำให้ audit เดินต่อไม่ได้ — ต้องรายงานและขอ owner decision ก่อน)

ห้ามทำ:

- architecture redesign
- scope expansion
- P2 / P3 implementation
- fake integration
- fake production evidence
- mock replacement เพียงเพื่อให้ report ผ่าน

---

## 23. REQUIRED FINAL OUTPUT

## A. EXECUTIVE STATUS

```text
M1 STATUS:            BLOCKED  — M1 Operational E2E ทั้ง 2 โหมด + card bill + production Lighthouse ยังไม่มี evidence
FULL PRODUCT STATUS:  PARTIAL  — M1 spine เกือบครบ; ยังมีงาน P2/P3 + OWNER-ONLY + DEFERRED จำนวนมาก
```

### M1 ACCEPTANCE MODEL — ต้องพิสูจน์ 2 OPERATING MODES แยกกัน

> **"ทั้งสองโหมด" ใน M1 ต้องหมายถึง ทั้งสองโหมดทำงานได้จริงใน business semantics ของตัวเอง — ไม่ใช่ canonical orders รองรับทั้งสองค่า** นี่คือ distinction สำคัญที่สุดของ audit รอบนี้

**MODE A — SAME_DAY (current-day operational fulfillment):**

```text
Customer → SAME_DAY selection → availability → cutoff (วันนี้) → capacity (today+current round)
→ address → fee → payment → confirm → inventory → kitchen (current queue)
→ current fulfillment → driver/provider → dispatch → delivered
```

**MODE B — PRE_ORDER (scheduled production + scheduled delivery):**

```text
Customer → PRE_ORDER → scheduled_date → delivery_round → cutoff (pre-order)
→ capacity (date+round) → address → fee → payment → confirm
→ inventory/capacity reservation → production batch → scheduled kitchen preparation
→ driver assignment → dispatch ตามรอบ → delivered
```

**Shared lifecycle (infrastructure เดียวกัน, lifecycle คนละชุด):**

```text
                ┌── SAME_DAY ────────┐
                │                    │
CUSTOMER → ORDER SPINE               ├→ KITCHEN → DELIVERY
                │                    │
                └── PRE_ORDER ───────┘
```

**ข้อห้าม:** ห้ามใช้ PRE_ORDER เป็นตัวแทน SAME_DAY และห้ามใช้ happy path (order→pay→deliver) แทนการพิสูจน์ business rules ครบทั้งของแต่ละโหมด

## B. M1 CLOSURE MATRIX (เฉพาะ M1 requirements)

| # | M1 Requirement | สถานะ | สิ่งที่ขาดเพื่อปิด |
|---|----------------|-------|--------------------|
| 1 | Same-day ordering — ORDER CREATION (server-authoritative) | VERIFIED | — |
| 1a | **M1 Operational E2E #1 — SAME_DAY REAL ORDER** (current-day path: availability→cutoff→capacity→fee→payment→confirm→inventory→kitchen→current round→dispatch→delivered) | **P0 ค้าง** | ต้องพิสูจน์ทั้ง chain — ห้ามนับแค่ creation |
| 2 | Payment spine (Stripe/PromptPay/COD state machine) | VERIFIED | bill จริง |
| 3 | Order state machine ฝั่ง server | VERIFIED | — |
| 4 | Canonical order spine (SAME_DAY + PRE_ORDER เดียว) | VERIFIED | — |
| 5 | Legacy pre_orders migration + freeze | VERIFIED | — |
| 6 | Cutoff enforcement | VERIFIED (code) | prod trace |
| 7 | Inventory deduct/restore/insufficient reject | PARTIAL | prod cycle test |
| 8 | Capacity — mechanism VERIFIED (lock/trigger/reject) / **business behavior PARTIAL** (SAME_DAY today+round และ PRE_ORDER date+round: reserve→full→reject→cancel→release ยังไม่มี prod evidence) | PARTIAL | runtime proof ทั้งสองโหมด |
| 9 | Kitchen command center operational | PARTIAL | prod batch cycle |
| 10 | Delivery dispatch + MOCK_DRIVERS removed | VERIFIED (04d19c7) | prod dispatch trace |
| 11 | 5km gate + pre-order address (Migr 035) | VERIFIED (code) | prod trace |
| 12 | Admin core CRUD + AuditLog DB-backed | VERIFIED (code) | — |
| 13 | Security RLS/ACL hardening | VERIFIED | owner live-DB review |
| 14 | **M1 Operational E2E #2 — PRE_ORDER REAL ORDER** (scheduled lifecycle: date selection→round selection→pre-order window→pre-order cutoff→capacity date+round→address→fee→payment→confirm→reserve→inventory→batch→วันผลิต→prepare→ready→driver→dispatch ตามรอบ→delivered→cancel→restore→refund) | **P0 ค้าง** | ต้องกำหนด business rules coverage — ห้ามนับ happy path (order→pay→deliver) เพียงอย่างเดียว; ต้องพิสูจน์ date+round → production batch → delivery round chain จริง |
| 15 | Real card charge + bill (PAY-02) | **P0 ค้าง** | owner ทำธุรกรรมจริง |
| 16 | Production Lighthouse Perf ≥ 90 | **P0 ค้าง** | วัดบน prod URL |

```text
# M1 NOT CLOSED (BLOCKED)
M1 gate = 3 owner actions — แต่ action #1 ประกอบด้วย 2 Operational E2E แยกโหมด ห้ามใช้โหมดหนึ่งแทนอีกโหมดหนึ่ง:
  1. M1 Operational E2E (ทั้งสองโหมดแยกกัน, ไม่ใช่ happy path):
     #1 SAME_DAY REAL ORDER  — current-day operational path ครบ chain
     #2 PRE_ORDER REAL ORDER — scheduled lifecycle ครบ (date+round → batch → delivery round)
     แต่ละ scenario ต้องกำหนดว่าครอบคลุม business rules อะไรบ้าง:
     date/round selection · address requirement · cutoff · capacity · payment
     · inventory · kitchen batching · delivery · cancellation · refund
  2. Real card charge bill จริง
  3. Production Lighthouse performance ≥ 90

# Logical gap ที่แก้แล้ว (เดิม): GAP-1 บอกว่า SAME_DAY + PRE_ORDER ต้องมี runtime evidence
# แต่ M1 closure เดิมระบุเพียง "Real pre-order E2E" — เกิด logical gap เพราะใช้ PRE_ORDER
# เป็นตัวแทน SAME_DAY — แก้แล้วโดยระบุ M1 Operational E2E #1 (SAME_DAY) และ #2 (PRE_ORDER) แยกกัน
```

## C. FULL BMB OBJECTIVE MATRIX

| Domain | Original Objective | Required Capability | Implementation Evidence | DB/RPC Evidence | Runtime Evidence | Production Evidence | Status | M1/P2/Deferred | Exact Gap |
| ------ | ------------------ | ------------------- | ----------------------- | --------------- | ---------------- | ------------------- | ------ | -------------- | --------- |
| Customer Ordering | PWA สั่งอาหาร mobile-first | menu/availability/order/fee/cutoff | pages/* + RPC create_order_with_items | ✅ (Migr 007-023) | ✅ code | ⚠️ trace | PARTIAL | M1 | real order capture |
| Same-Day | สั่งตอนนี้ส่งวันนี้ — **current-day operational fulfillment** | current-day path: availability/cutoff/capacity(today+round)/fee/payment/inventory/kitchen/current dispatch window | RPC + trigger + CheckoutPage + availabilityEngine | ✅ | ✅ code | ❌ (full path ไม่มี trace) | ORDER CREATION=VERIFIED / FULL OPERATION=PARTIAL | M1 (E2E #1) | current-day operational path ครบ chain |
| Pre-Order | จองล่วงหน้า — **scheduled production + scheduled delivery** | 20 ขั้น lifecycle: date→round→window→cutoff→capacity(date+round)→address→fee→payment→confirm→reserve→inventory→batch→วันผลิต→prepare→ready→driver→dispatch ตามรอบ→delivered→cancel→restore→refund | Migr 023/024/025/027/035 + AdminPreOrders + Migr 038/039 | ✅ | ✅ code | ❌ (lifecycle ไม่มี trace) | ORDER CREATION=VERIFIED / SCHEDULED LIFECYCLE=PARTIAL | M1 (E2E #2) | date+round → production batch → delivery round chain end-to-end |
| Same-Day | สั่งตอนนี้ส่งวันนี้ — **current-day operational fulfillment** | current-day path: availability/cutoff/capacity(today+round)/fee/payment/inventory/kitchen/current dispatch window | RPC + trigger + CheckoutPage + availabilityEngine | ✅ | ✅ code (creation) | ❌ (full path ไม่มี trace) | ORDER CREATION=VERIFIED / FULL OPERATION=PARTIAL | M1 (E2E #1) | current-day operational path ครบ chain |
| Pre-Order | จองล่วงหน้า — **scheduled production + scheduled delivery** | 20 ขั้น lifecycle: date→round→window→cutoff→capacity(date+round)→address→fee→payment→confirm→reserve→inventory→batch→วันผลิต→prepare→ready→driver→dispatch ตามรอบ→delivered→cancel→restore→refund | Migr 023/024/025/027/035 + AdminPreOrders | ✅ | ✅ code (creation) | ❌ (lifecycle ไม่มี trace) | ORDER CREATION=VERIFIED / SCHEDULED LIFECYCLE=PARTIAL | M1 (E2E #2) | date+round → production batch → delivery round chain end-to-end |
| Payment | Stripe/PromptPay/COD | idempotent + amount-match | record_payment_result + webhook 6/6 | ✅ | ✅ | ⚠️ ไม่มี bill จริง | PARTIAL | M1 | card bill |
| Inventory | recipe→ingredient→deduct/restore | atomic | Migr 019/026 + InventoryPage DB | ✅ | ✅ code | ❌ prod test | PARTIAL | M1 | prod cycle test |
| Capacity | กัน oversell — **mechanism ≠ business capability** | enforcement: lock/trigger/reject (mechanism) + behavior: reserve→full→reject→cancel→release (operational) | trigger + ERR_CAPACITY_FULL + FOR UPDATE | ✅ (mechanism) | ✅ code | ❌ (behavior ทั้งสองโหมด) | MECHANISM=VERIFIED / BUSINESS CAPABILITY=PARTIAL | M1 | SAME_DAY today+round และ PRE_ORDER date+round runtime proof |
| Kitchen | ผลิตจาก confirmed orders — **แยก current-day queue vs scheduled batch** | SAME_DAY queue behavior + PRE_ORDER scheduled batch lifecycle | AdminKitchen + Migr 027 (both modes) | ✅ | ✅ code | ❌ (ทั้งสอง lifecycle) | MECHANISM=VERIFIED / LIFECYCLE=PARTIAL | M1 | current-day queue + date+round→batch→round chain |
| Delivery/Bite Drive | drivers/assignment/dispatch — **current-day + scheduled-round dispatch แยกกัน** | dispatch ใน current window (SAME_DAY) และ dispatch ตามรอบที่จอง (PRE_ORDER) | 04d19c7 + Migr 035 + RiderPwa | ✅ | ✅ code | ⚠️ | PARTIAL | M1 | dispatch trace ทั้งสองโหมด |
| External Riders >5km | Grab/LineMan/Foodpanda | provider dispatch | sandbox logic 5/5 (logic เท่านั้น) | ✅ schema | ❌ | ❌ | BLOCKED | post-M1 | API keys (OWNER) |
| Channels | PWA/FB/Messenger/LINE | canonical order_id hub | PWA ✅ เท่านั้น | ✅ | ✅ | ✅ (PWA) | PWA=VERIFIED, อื่น=PLANNED | P2 | FB/LINE/Messenger integration |
| Make.com | back-office automation worker | FB intake/notify/workflows | ไม่มี live scenario | ❌ | ❌ | ❌ | DEFERRED / OWNER-ONLY | P2 | credentials + scenarios |
| AI System | Intelligence/Extraction/Assistance | no authority over money/stock/state | guardrails + RLS-bound tools | ✅ | ✅ code | ⚠️ | PARTIAL (prod integration) | M1 arch / P2 integration | prod conversation trace |
| Content Engine | content→acquisition→order | generation/management/loop | contentAutomation.ts | partial | ⚠️ | ❌ | PARTIAL / MISSING (loop) | P2 | FB token + attribution loop |
| Notifications | แจ้งเตือนครบ lifecycle | real push/email/LINE | in-app event bus เท่านั้น | ✅ events | ❌ real channel | ❌ | PARTIAL | P2 | provider + real send |
| Review Loop | review→data→AI→better content | closed loop | reviews + intelligenceServer | ✅ schema | ⚠️ | ❌ | PARTIAL / MISSING (ปลายทาง) | P2/P3 | automation loop |
| Admin | operational command center | 13 modules CRUD+transition | 13 modules DB-backed | ✅ | ✅ code | ⚠️ | PARTIAL (ใกล้ VERIFIED) | M1 | prod state transitions |
| Security | RLS/ACL/0 anon residue | hardened | Migr 033/034/035 | ✅ | ✅ code | ⚠️ owner review | VERIFIED (code) | M1 | live DB review |
| Voice | voice input/output | STT/TTS | 0 hits — CANCELLED | ❌ | ❌ | ❌ | DEFERRED | DEFERRED (owner) | — |
| Performance | Lighthouse ≥ 90 prod | mobile/perf/SEO | local best 81 | — | ⚠️ local เท่านั้น | ❌ | PARTIAL | M1 gate (owner) | prod measurement |
| Analytics PRO (14) | forecasting/reporting | — | — | ❌ | ❌ | ❌ | DEFERRED | P3 | — |
| AI-BIZ / AI-FC (14) | copilot/forecast | — | — | ❌ | ❌ | ❌ | DEFERRED | P3 | — |
| Inventory PRO (10) | advanced stock ops | — | — | ❌ | ❌ | ❌ | DEFERRED | P3 | — |
| SaaS (26) / White-label (8) | multi-tenant/white-label | — | — | ❌ | ❌ | ❌ | DEFERRED | Phase 8-15 | — |

## D. CRITICAL GAPS (เรียงตาม dependency — ไม่ใช่ตามความง่าย)

```text
GAP-1  Production runtime evidence — **M1 Operational E2E ทั้งสองโหมดแยกกัน**
           #1 SAME_DAY REAL ORDER  — current-day path: availability→cutoff→capacity(today+round)
              →fee→payment→confirm→inventory→kitchen→current round→dispatch→delivered
           #2 PRE_ORDER REAL ORDER — scheduled lifecycle: date→round→window→cutoff→capacity(date+round)
              →address→fee→payment→confirm→reserve→inventory→batch→วันผลิต→prepare→ready
              →driver→dispatch ตามรอบ→delivered→cancel→restore→refund
WHY:        ทุกสถานะ PARTIAL ถูก block ที่ชั้นนี้ — ห้ามใช้ PRE_ORDER เป็นตัวแทน SAME_DAY และ
            ห้ามใช้ happy path (order→pay→deliver) แทน business rules ครบ
EVIDENCE:   Matrix B แถว 1a, 6-11, 14
IMPACT:     M1 ปิดไม่ได้
REQUIRED:   ทำ real order ต่อโหมด ผ่าน full lifecycle บน bitemebaby-5f7.pages.dev
            พร้อมกำหนด business-rules coverage ของแต่ละ scenario:
            date/round selection · address requirement · cutoff · capacity · payment
            · inventory · kitchen batching · delivery · cancellation · refund
OWNER/ENG:  OWNER + ENGINEERING
MILESTONE:  M1

GAP-2  Real card charge + bill (PAY-02)
WHY:        Payment spine verified แต่ไม่มีธุรกรรมจริง
EVIDENCE:   record_payment_result + webhook 6/6 verified; ไม่มี receipt
IMPACT:     ไม่ยอมรับเงินจริงได้อย่างมั่นใจ
REQUIRED:   Owner ทำธุรกรรมจริง 1 รายการ
OWNER/ENG:  OWNER
MILESTONE:  M1

GAP-3  Production Lighthouse
WHY:        มีแต่ local score
EVIDENCE:   local best 81 < 90
IMPACT:     M1 gate ไม่ผ่าน
REQUIRED:   Owner รันบน bitemebaby-5f7.pages.dev; engineering fix ถ้าต่ำกว่าเกณฑ์
OWNER/ENG:  OWNER + ENGINEERING
MILESTONE:  M1

GAP-4  Notification delivery จริง (push/email/LINE)
WHY:        in-app event bus ≠ ลูกค้าได้รับแจ้งจริง
EVIDENCE:   notificationService.ts in-memory เท่านั้น
IMPACT:     ลูกค้า/ครัว/ไรเดอร์ไม่รู้สถานะแบบ real-time
OWNER/ENG:  ENGINEERING
MILESTONE:  P2

GAP-5  Multi-channel intake (FB/Messenger/LINE → canonical order hub)
WHY:        original objective ต้องการ; ปัจจุบันมีเฉพาะ PWA
IMPACT:     ช่องทางขายสูญเปล่า
OWNER/ENG:  OWNER (decision + tokens) + ENGINEERING
MILESTONE:  P2

GAP-6  Make.com จาก architecture decision → real worker
EVIDENCE:   ไม่มี live scenario / webhook log
OWNER/ENG:  OWNER
MILESTONE:  P2

GAP-7  Content → Order loop และ Review → Data → AI → Better Content loop
WHY:        closed-loop objective ปลายทางยังไม่มี
OWNER/ENG:  ENGINEERING
MILESTONE:  P2/P3

GAP-8  External riders > 5 km
WHY:        BLOCKED บน API keys
OWNER/ENG:  OWNER
MILESTONE:  หลัง M1

GAP-9  Kitchen/delivery state transition บน production (batch → dispatch → delivered)
OWNER/ENG:  ENGINEERING + OWNER
MILESTONE:  M1 closure evidence
```

## E. FALSE-CLOSURE CHECK

**คำถาม: "เหตุใด M1 closure evidence จึงไม่ควรถูกตีความว่า BMB full product completion?"**

**ตอบตรง:** เพราะ M1 closure evidence ครอบคลุมเฉพาะ **First Operating Kitchen Spine** (PWA ordering ทั้งสองโหมด + payment + kitchen + self-delivery ≤ 5 km + admin + security) เท่านั้น ขณะที่ Full BMB Product Objective ตามที่ owner กำหนดตั้งแต่ต้นคือ **Cloud Kitchen Operating Platform** — ซึ่งมี domain ที่ยังไม่ได้ implement หรือยังไม่ได้ production verify จำนวนมาก

**รายการที่ยังไม่อยู่ใน 3 owner actions ของ M1 (13 หมวด):**

1. Multi-channel intake (Facebook / Messenger / LINE / future channels) — PLANNED เท่านั้น
2. Make.com back-office automation — architecture decision เท่านั้น (ไม่มี live scenario)
3. External rider > 5 km — BLOCKED บน API keys
4. Notification delivery จริง (push/email/LINE/Messenger) — มีแต่ in-app event
5. Content Engine เต็มรูปแบบ + content → order loop — MISSING ปลายทาง
6. Review → Data → AI → Better Content closed loop — MISSING
7. AI proactive intelligence / copilot / forecasting — DEFERRED P3
8. Analytics PRO (14 items) — DEFERRED P3
9. Inventory PRO (10 items) — DEFERRED P3
10. SaaS-ready / multi-tenant (26 items) — DEFERRED (Phase 8-15)
11. White-label (8 items) — DEFERRED
12. Voice input/output — CANCELLED/DEFERRED โดย owner decision (มีหลักฐาน AI-06)
13. AI production integration (conversation trace จริงบน prod) — PARTIAL

## F. MILESTONE BOUNDARY

| Milestone | Scope | เหตุผล |
|-----------|-------|--------|
| **M1** | First real kitchen operational: **ทั้งสองโหมดทำงานได้จริงใน business semantics ของตัวเอง** (SAME_DAY current-day fulfillment + PRE_ORDER scheduled fulfillment) + payment + kitchen + self-delivery ≤ 5 km + admin + security | ต้องปิดก่อนเปิดให้ลูกค้าใช้จริง — ค้าง 3 owner actions โดย action #1 = 2 Operational E2E แยกโหมด |
| **P2** | Notifications จริง, extra channels (FB/LINE/Messenger), Make.com worker, content engine, external riders | จำเป็นสำหรับ platform เต็มรูปแบบ แต่ไม่ block ครัวแรก |
| **P3** | Inventory PRO, analytics, AI copilot/forecast, SaaS, white-label | Growth — ทำหลังพิสูจน์ P2 |
| **OWNER-ONLY** | Production secrets, API keys (external riders), Lighthouse run, real order placement, card bill, live DB review | ต้องใช้บัญชี/บัตร/token ของ owner เท่านั้น |
| **DEFERRED** | Voice, white-label, full analytics, SaaS billing | มี owner decision บันทึกแล้ว |

## G. FINAL RECOMMENDATION

(ไม่มีคะแนน / ไม่มี ranking / ไม่มี best-worst — สรุปเฉพาะตาม evidence)

```text
M1 CLOSURE:        BLOCKED   (3 owner actions ยังไม่มี production evidence)
FULL PRODUCT:      PARTIAL   (M1 spine เกือบครบ; เหลือ P2/P3/OWNER-ONLY/DEFERRED จำนวนมาก)
PAYMENT:           PARTIAL   (spine verified; bill จริงค้าง)
KITCHEN:           PARTIAL   (RPC ครบ; prod batch cycle ค้าง)
DELIVERY:          PARTIAL   (MOCK_DRIVERS แก้แล้ว; prod dispatch trace ค้าง)
INVENTORY:         PARTIAL   (logic verified; prod cycle ค้าง)
NOTIFICATIONS:     PARTIAL   (event เท่านั้น — ไม่ใช่ real delivery)
CONTENT LOOP:      PARTIAL / MISSING (ปลายทางของ loop)
AI:                PARTIAL   (arch + code verified; prod integration ค้าง)
SECURITY:          VERIFIED  (code/ACL) — owner live-DB review ค้าง
VOICE:             DEFERRED  (owner decision บันทึกแล้ว)
MAKE.COM:          DEFERRED  (architecture decision เท่านั้น)
EXTERNAL RIDERS:   BLOCKED   (API keys)
SAAS/WHITE-LABEL:  DEFERRED
```

---

## 24. SUCCESS CONDITION

Owner เปิดไฟล์เดียวนี้แล้วตอบได้ทันที:

1. **BMB objective ทั้งหมดมีอะไรบ้าง** → Section 4-20 + Matrix C
2. **อะไรสร้างแล้ว** → Matrix C (Implementation Evidence)
3. **อะไรเชื่อมแล้ว** → Section 5/6 (canonical spine + two-mode matrix)
4. **อะไร production verified แล้ว** → Matrix B/C แถว VERIFIED
5. **อะไรยัง PARTIAL** → Section 7/8/9/10/15/17 + Matrix B แถว PARTIAL
6. **อะไร MISSING** → Notification จริง, multi-channel intake, review→AI→content loop, voice
7. **อะไร OWNER-ONLY** → prod secrets, external rider keys, Lighthouse run, real order, card bill
8. **อะไร DEFERRED** → Voice, SaaS, analytics, AI copilot/forecast, inventory-pro, white-label, Make.com, FB content
9. **อะไรคือ M1 blocker จริง** → GAP-1 = **M1 Operational E2E ทั้งสองโหมดแยกกัน** (#1 SAME_DAY REAL ORDER + #2 PRE_ORDER REAL ORDER พร้อม business-rules coverage ไม่ใช่ happy path) + GAP-2 (card bill) + GAP-3 (Lighthouse prod)
10. **หลัง M1 ปิด เหลือ product work อะไร** → GAP-4 ถึง GAP-8 + P3 ทั้งหมด (Section F)

**ห้ามตอบเพียงว่า "เหลือ 3 actions"** — ต้องตอบแยกสองส่วน:

> **"เหลือ 3 actions สำหรับ M1 closure"** — โดย action #1 คือ **M1 Operational E2E ทั้งสองโหมดแยกกัน**:
> - **E2E #1 — SAME_DAY REAL ORDER** (current-day operational path ครบ chain)
> - **E2E #2 — PRE_ORDER REAL ORDER** (scheduled lifecycle ครบ: date+round → production batch → delivery round)
> - ห้ามใช้โหมดหนึ่งเป็นตัวแทนอีกโหมดหนึ่ง และห้ามใช้ happy path แทน business rules ครบ
> - พร้อม card bill จริง และ production Lighthouse ≥ 90

และ

> **"ยังเหลือ product work อีก 13 หมวดสำหรับ BMB product objective ทั้งหมด"** (Section E)

สองสิ่งนี้ห้ามปนกัน — ถูกแยกไว้ชัดเจนทั่วทั้งเอกสารนี้

**สรุป distinction ที่สำคัญที่สุดของ audit รอบนี้ (แก้ตาม owner feedback):**

```text
ถูกแล้ว:   canonical order spine เดียว · order_mode แยก SAME_DAY/PRE_ORDER
           scheduled_date · delivery_round · capacity · kitchen batch ทั้งสองโหมด
           legacy pre_orders ไม่ใช่ second source of truth
แก้แล้วในเวอร์ชันนี้:
  1. ห้ามเทียบ SAME_DAY/PRE_ORDER เป็น feature checklist เดียวกัน → เป็น lifecycle คนละชุด (Section 5)
  2. ห้ามถือ DB mechanism = business capability — แยก Mechanism vs Operational Behavior (Section 8)
  3. ห้ามใช้ PRE_ORDER E2E เป็นตัวแทนทั้งสองโหมด — M1 ต้องมี Operational E2E #1 และ #2 แยกกัน (Section 23)
  4. SAME_DAY production E2E ถูกยกขึ้นเป็น explicit M1 acceptance (Matrix B แถว 1a)
  5. แยก current-day fulfillment กับ scheduled fulfillment ชัดเจน (Section 5.3, 10)
  6. พิสูจน์ date+round → production batch → delivery round chain ของ PRE_ORDER แบบ end-to-end
     เป็น acceptance เฉพาะของ PRE_ORDER — ไม่ใช่เพียง Migration 024/025/035 ผ่าน
  7. cancellation/restore/payment/refund ถูกจัดเป็นขั้นของ business lifecycle
     ไม่ใช่ technical capability กระจัดกระจาย (Section 5.2 chain 20 ขั้น)
```

---

**End of Master Objective Reconciliation — 2026-09-24 · HEAD `1df7498` (Thai version)**