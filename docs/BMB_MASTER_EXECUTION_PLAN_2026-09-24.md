# BMB — MASTER EXECUTION PLAN

## AI DEV HANDOFF — 2026-09-24

> **Repository:** `bitemebaby2016-coder/bmb` · **HEAD baseline:** `3ace98a` (main = origin/main)
> **เอกสารอ้างอิงหลัก:** `docs/BMB_MASTER_OBJECTIVE_RECONCILIATION_2026-09-24.md` (Revision 2)
> **ผู้จัดทำ:** Principal Engineer + Product Architect + Audit Reconciliation Agent
> **สถานะรอบนี้:** AUDIT → RECONCILE → PLAN → DEPENDENCY MAP → ACCEPTANCE CRITERIA → OWNER CHECKLIST เท่านั้น — **ห้ามแก้ implementation code จนกว่า Owner จะ approve plan นี้**

### กฎผูกพันของ plan นี้ (อ่านก่อนทุก task)

1. **SAME_DAY = CURRENT-DAY OPERATIONAL FULFILLMENT** — สั่งตอนนี้ → availability/cutoff/capacity ของวันนี้ → payment → confirm → inventory → kitchen current queue → current delivery window → dispatch → delivered วันนี้ **ห้ามตีความว่า `SAME_DAY = PRE_ORDER + scheduled_date = today`**
2. **PRE_ORDER = SCHEDULED PRODUCTION + SCHEDULED DELIVERY** — จองล่วงหน้า → future scheduled_date → delivery_round → pre-order window/cutoff → capacity(date+round) → address → fee → payment → confirm → production batch → ผลิตตาม schedule → driver → dispatch ตามรอบ → delivered **ห้ามลดเหลือเพียง "มี scheduled_date"**
3. **SHARED CANONICAL SPINE ≠ SHARED BUSINESS LIFECYCLE** — infrastructure กลาง (`orders`, `order_mode`, `scheduled_date`, `delivery_round_id`, `order_items`, payment, inventory, capacity, `production_batches`, `delivery_assignments`) ใช้ร่วมได้ แต่ business semantics ของแต่ละ mode ต้องถูกพิสูจน์แยกกัน
4. **M1 ต้องมี Operational E2E แยก 2 scenario** — MODE A (SAME_DAY REAL ORDER) + MODE B (PRE_ORDER REAL ORDER) — ห้ามใช้ PRE_ORDER เป็นตัวแทน SAME_DAY และห้ามใช้ happy path อย่างเดียว (ต้องมี negative coverage: cutoff reject / capacity full reject / insufficient inventory reject / cancel / capacity restore / inventory restore / refund / invalid address-distance / invalid scheduled date / invalid delivery round)
5. **Evidence hierarchy:** 1. Running production behavior → 2. Live Supabase schema/RPC/RLS → 3. Runtime code → 4. Integration config/Edge Functions/Make.com → 5. Automated tests → 6. Migrations → 7. Documentation → 8. AI assumptions
6. กฎห้ามฝ่าฝืน: `HARDCODED != VERIFIED` · `EXISTS FILE != FEATURE COMPLETE` · `TEST EXISTS != PRODUCTION VERIFIED` · `RPC EXISTS != CUSTOMER FLOW CONNECTED` · `ADMIN PAGE EXISTS != ADMIN SYSTEM COMPLETE` · `AI FUNCTION EXISTS != AI SYSTEM INTEGRATED` · `MOCK REMOVED != REAL WORLD FLOW VERIFIED` · `DOCUMENTATION CLAIM != IMPLEMENTATION EVIDENCE`
7. ห้าม: rewrite architecture · redesign DB โดยไม่มี evidence · เพิ่ม feature นอก objective · สร้าง mock เพื่อให้ test ผ่าน · สร้าง fake production evidence · claim COMPLETE โดยไม่มี evidence · **reimplement `04d19c7`**
8. สถานะที่ใช้ได้: `VERIFIED / PARTIAL / MISSING / BLOCKED / OWNER-ONLY / DEFERRED` — **ห้ามใช้ COMPLETE** เว้นแต่ evidence ครบทุกชั้น

---

## Section 1 — EXECUTIVE OBJECTIVE

> **BMB = Cloud Kitchen Operating Platform** — ไม่ใช่ generic restaurant POS

Platform ต้องบริหาร: การรับ order จากลูกค้า (PWA และ channels อื่นตาม objective) → canonical order hub → payment → inventory → capacity ต่อรอบ → kitchen production → delivery (self ≤5km / external riders) → admin command center → และวงจร Content → Acquisition → Order → Review → Data → AI → Better Content ตาม objective เดิมของ owner

**สอง operating modes ที่แยก business lifecycle จากกัน:**

```text
                 CANONICAL ORDER SPINE
                         │
             ┌───────────┴───────────┐
         SAME_DAY                PRE_ORDER
      CURRENT OPERATING         SCHEDULED OPERATING
      วันนี้ / cutoff           future date
      current capacity          date capacity
      current round             selected round
      current dispatch          scheduled batch
             └──────────┬────────────┘
                        │
                 Kitchen / Delivery
```

---

## Section 2 — CURRENT BASELINE (ณ HEAD `3ace98a`)

| รายการ | สถานะ | หมายเหตุ |
|--------|-------|----------|
| Branch / HEAD | `main` / `3ace98a` (= origin/main) | reconciliation revision 2 แล้ว |
| 04d19c7 (MOCK_DRIVERS → DB drivers) | **แก้แล้ว — ห้าม reimplement** | `DeliveryManagement.tsx` → `listDrivers()` → RPC `list_drivers` |
| 886836d (cutoff enforcement ใน CheckoutPage) | แก้แล้ว | code-level |
| 716b4e9 (`aiToolCalling.ts.disabled`) | แก้แล้ว | dead code ปิดอย่างถูกต้อง |
| 9787429 (InventoryPage DB-backed) | แก้แล้ว | แทน localStorage |
| ff54783 (Migr 035 + AdminKitchen/PreOrders/Recipes + AuditLog DB) | แก้แล้ว | code-level |
| Migr 033/034 (ACL hardening) / 035 (5km gate + pre-order address + admin RPCs) | deploy ใน migration แล้ว | ต้อง owner live-DB review |
| Production | `bitemebaby-5f7.pages.dev` deployed | same-day creation ใช้งานได้ |
| **Known production evidence ที่มี** | Stripe webhook 6/6 (2026-09-19), tests 19/19, 5km gate + address trigger (code) | — |
| **Known limitations (current, ไม่ใช่ historical)** | ไม่มี production E2E trace ทั้งสองโหมด · ไม่มี card bill จริง · Lighthouse local best 81 (<90) · notification เป็น in-app event · channels อื่นนอกจาก PWA ยังไม่ implement · Make.com ไม่มี live scenario · external riders BLOCKED (keys) | historical finding เช่น MOCK_DRIVERS/localStorage inventory ถูกแก้แล้ว ห้ามนำมาเป็น gap ปัจจุบัน |

---

## Section 3 — PRODUCT OBJECTIVE MAP (25 domains)

| # | Domain | สถานะปัจจุบัน | Milestone |
|---|--------|---------------|-----------|
| 1 | Customer PWA | VERIFIED (creation/UX) | M1 |
| 2 | SAME_DAY (current-day fulfillment) | CREATION=VERIFIED / FULL OPERATION=PARTIAL | M1 |
| 3 | PRE_ORDER (scheduled production+delivery) | CREATION=VERIFIED / SCHEDULED LIFECYCLE=PARTIAL | M1 |
| 4 | Order Spine (canonical orders) | VERIFIED (schema/state machine) | M1 |
| 5 | Payment (Stripe/PromptPay/COD) | spine=VERIFIED / bill จริง=OWNER-ONLY ค้าง | M1 |
| 6 | Inventory (deduct/restore/atomic) | mechanism=VERIFIED / prod cycle=PARTIAL | M1 |
| 7 | Capacity | mechanism=VERIFIED / behavior ทั้งสองโหมด=PARTIAL | M1 |
| 8 | Kitchen (current queue + scheduled batch) | mechanism=VERIFIED / lifecycle=PARTIAL | M1 |
| 9 | Delivery / Bite Drive (self ≤5km) | mechanism=VERIFIED / prod dispatch=PARTIAL | M1 |
| 10 | External Riders (>5km) | BLOCKED (API keys) | P2 |
| 11 | Admin Command Center | code=VERIFIED / prod transitions=PARTIAL | M1 |
| 12 | Notifications (real delivery) | PARTIAL (in-app event เท่านั้น) | P2 |
| 13 | Channels (FB/Messenger/LINE) | PLANNED (PWA+Manual เท่านั้น) | P2 |
| 14 | Make.com | DEFERRED / OWNER-ONLY | P2 |
| 15 | AI (Intelligence/Extraction/Assistance) | arch+code=VERIFIED / prod integration=PARTIAL | M1(arch) / P2(integration) |
| 16 | Content Engine | PARTIAL / loop=MISSING | P2 |
| 17 | Review → Data → AI → Better Content | PARTIAL / ปลายทาง=MISSING | P2/P3 |
| 18 | Security (RLS/ACL) | VERIFIED (code) / live-DB review=OWNER-ONLY | M1 |
| 19 | Performance (Lighthouse ≥90 prod) | PARTIAL (local 81) | M1 gate |
| 20 | Analytics PRO | MISSING | P3 |
| 21 | Inventory PRO | MISSING | P3 |
| 22 | AI-BIZ / AI-FC | MISSING | P3 |
| 23 | SaaS / multi-tenant | MISSING | P3 |
| 24 | White-label | MISSING | P3 |
| 25 | Voice | **CANCELLED/DEFERRED (owner decision AI-06)** — ห้าม resurrect โดยไม่มี owner decision ใหม่ | DEFERRED |

---

## Section 4 — SAME_DAY ARCHITECTURE & LIFECYCLE (MODE A)

Business lifecycle + GAP ต่อขั้น (สถานะอ้างจาก code/DB จริง):

| # | ขั้น | Input/Validation | หลักฐานปัจจุบัน | GAP |
|---|------|------------------|-----------------|-----|
| 1 | เลือกเมนู + SAME_DAY selection | MenuPage/availabilityEngine | code มี | ไม่มี prod trace |
| 2 | availability | availabilityEngine (sold-out/quota) | code มี | prod trace |
| 3 | cutoff วันนี้ | `cutoff_time` ต่อรอบ (886836d) | code VERIFIED | prod trace (reject case) |
| 4 | capacity today + current round | trigger + lock | mechanism VERIFIED | behavior reserve→full→reject ไม่มี prod evidence |
| 5 | delivery fee | `compute_delivery_fee` | PARTIAL | real flow trace |
| 6 | payment | `record_payment_result` + webhook | spine VERIFIED | bill จริง (OWNER) |
| 7 | confirm | state machine + allow-list | VERIFIED (code) | prod trace |
| 8 | inventory deduct | `deduct_inventory_for_order` + Migr 026 | PARTIAL | prod cycle (confirm→deduct, cancel→restore, insufficient→reject atomic) |
| 9 | kitchen current queue | `create_production_batch` (SAME_DAY) | mechanism VERIFIED | current-day queue behavior |
| 10 | จัดรอบส่งปัจจุบัน / dispatch window | `delivery_round_id` (วันนี้) | schema VERIFIED | current dispatch window prod trace |
| 11 | driver/provider | self ≤5km (Migr 035) | mechanism VERIFIED | prod dispatch trace |
| 12 | dispatch → delivered | `driver_update_delivery_status` + transition | PARTIAL | orders.status sync + prod trace |
| 13 | cancel | RPC + policy | PARTIAL | prod cancel trace + policy เวลาฝั่ง server |
| 14 | restore (inventory + capacity) | Migr 017/019/030 | mechanism VERIFIED | prod restore evidence |
| 15 | refund | EF + payment state | PARTIAL | บิลจริง (OWNER) |

---

## Section 5 — PRE_ORDER ARCHITECTURE & LIFECYCLE (MODE B)

ห้ามลดเหลือเพียง "มี scheduled_date" — capability = 20 ขั้น:

| # | ขั้น | หลักฐานปัจจุบัน | GAP |
|---|------|-----------------|-----|
| 1 | scheduled_date เลือกได้ (min today+1, ห้ามวันนี้/อดีต) | VERIFIED (code) | prod trace |
| 2 | delivery_round เลือกได้ | VERIFIED (code) | prod trace |
| 3 | pre-order window (รับจองได้เมื่อไหร่) | NOT FOUND — NEED OWNER DECISION (ไม่พบ enforce ของ window ฝั่ง server) | กำหนด rule + implement + ทดสอบ |
| 4 | pre-order cutoff (แยกจาก same-day cutoff) | PARTIAL — cutoff เดียวกับ same-day path | ต้องยืนยัน/กำหนด pre-order cutoff แยก (OWNER decision ถ้าต้องเพิ่ม) |
| 5 | capacity date+round (อนาคต) | mechanism VERIFIED | behavior date+round ไม่มี prod evidence |
| 6 | address บังคับ | Migr 035 `validate_pre_order_delivery()` | prod trace |
| 7 | fee | PARTIAL | real flow |
| 8 | payment | PARTIAL | intent + charge จริง |
| 9 | confirm | VERIFIED (code) | prod trace |
| 10 | reserve capacity (date+round) | mechanism VERIFIED | prod evidence |
| 11 | deduct inventory ตาม lifecycle | PARTIAL | ยืนยันจุด deduct ของ pre-order ตาม design (อาจต่างจาก same-day — NEED OWNER DECISION หากไม่พบ design เดิม) |
| 12 | production batch (PRE_ORDER) | Migr 027 VERIFIED (mechanism) | prod batch |
| 13 | ถึงวันผลิต (scheduled_date) | PARTIAL | prod trace |
| 14 | prepare ตาม schedule | PARTIAL | lifecycle trace |
| 15 | ready | PARTIAL | lifecycle trace |
| 16 | driver assignment | RPC มี | UI+prod trace |
| 17 | dispatch ตามรอบ | PARTIAL | round-based dispatch trace |
| 18 | delivered | PARTIAL | prod trace |
| 19 | cancel ก่อน cutoff → restore capacity+inventory | mechanism VERIFIED | prod cancel/restore trace |
| 20 | refund ตาม payment state | PARTIAL | บิลจริง (OWNER) |

**ห้ามลด PRE_ORDER เหลือเพียง "มี scheduled_date" — lifecycle 20 ขั้นนี้คือ acceptance ของโหมดนี้**

---

## Section 6 — SHARED CANONICAL ORDER SPINE และจุดที่ LIFECYCLE แยกกัน

```text
SAME_DAY + PRE_ORDER
        ↓
canonical orders (orders + order_items + order_mode + scheduled_date + delivery_round_id)
        ↓
payment (record_payment_result / payment_intents / webhook)
        ↓
inventory (deduct/restore + inventory_transactions)
        ↓
capacity (per-round lock + orders_increment_round)
        ↓
kitchen (production_batches + production_batch_items — both modes, source = orders เท่านั้น)
        ↓
delivery (delivery_assignments + driver_update_delivery_status)
```

**จุดที่ business lifecycle แยกกัน (ต้องรักษาตลอด implementation):**

| จุด | SAME_DAY | PRE_ORDER |
|-----|----------|-----------|
| ค่า scheduled_date semantics | current date ตามระบบ (ไม่ใช่ "จอง") | future date ที่ลูกค้าเลือก |
| cutoff ที่ใช้ | current cutoff ของวันนี้ | pre-order cutoff ของ date+round |
| capacity ที่ล็อก | today + current round | future date + selected round |
| จุดเข้า kitchen | current queue ทันทีหลัง confirm | queued_for_production → batch ตามวันผลิต |
| dispatch | current window ของวันนี้ | ตามรอบที่จองไว้ |
| cancel policy | นโยบายปัจจุบัน | ก่อน cutoff → restore |

**ห้าม**ใช้ path เดียวกันทั้งสองโหมดโดยลบความต่างของ business rules ออก

---

## Section 7 — DEPENDENCY GRAPH (ตรวจจาก code/DB จริง)

```text
ORDER SPINE (orders/order_items/order_mode/state machine)   [VERIFIED แล้ว]
        ↓
PAYMENT (record_payment_result + webhook)                   [spine VERIFIED]
        ↓
INVENTORY (deduct/restore/atomic)  +  CAPACITY (lock/reject)
        ↓                          ↓
   KITCHEN (batch both modes)   DELIVERY (assignment/dispatch)
        ↓                          ↓
        └──────────┬───────────────┘
                   ↓
   SAME_DAY E2E (MODE A)  +  PRE_ORDER E2E (MODE B)   ← แยก scenario
                   ↓
            M1 OWNER EVIDENCE (card bill + Lighthouse + live-DB review)
                   ↓
              M1 CLOSURE
                   ↓
   P2 (notifications/channels/external riders/Make.com/content/loop)
                   ↓
   P3 (inventory PRO/analytics/AI-BIZ-AI-FC/SaaS/white-label)
```

**Dependency จริงที่ตรวจพบจาก implementation:**
- Payment block order ไม่ได้ทั้งหมด (COD/PromptPay flow มีอยู่) แต่ **bill จริง block การปิด M1**
- PRE_ORDER E2E ต้องมี production batch (027) + address trigger (035) + round/capacity — ทั้งหมด deploy แล้วที่ migration layer แต่ **ยังไม่ผ่าน runtime chain**
- Kitchen ไม่ block การสร้าง order แต่ block การพิสูจน์ delivered
- Cancel/restore ต้องมี order จริงก่อนจึงทดสอบได้
- P2 notifications ไม่ block M1 แต่ external riders block ด้วย OWNER keys

---

## Section 8 — MASTER WORK BREAKDOWN STRUCTURE

ฟอร์แมต task: `ID · DOMAIN · OBJECTIVE · STATUS · EVIDENCE · GAP · REQUIRED WORK · DEPENDENCY · OWNER / ENGINEERING · ACCEPTANCE · PROD EVIDENCE · AFTER`

### M1 (FIRST OPERATING KITCHEN)

**M1-01 · Order Spine & Mode Contract**
STATUS: VERIFIED (schema) · EVIDENCE: Migr 007/023/025/030 · GAP: ไม่มี (ห้ามแตะ) · REQUIRED: ปกป้อง contract ระหว่างทำงานอื่น · DEPENDENCY: — · OWNER: — / ENG: regression check · ACCEPTANCE: order_mode 2 ค่าเดิน state machine ได้ · PROD: rows ที่มีอยู่ · AFTER: VERIFIED

**M1-02 · SAME_DAY Operational Closure (MODE A)**
STATUS: CREATION=VERIFIED / FULL OPERATION=PARTIAL · EVIDENCE: RPC server-authoritative + cutoff code · GAP: current-day path ไม่มี prod trace · REQUIRED: ทำ real SAME_DAY order ผ่าน availability→cutoff→capacity→fee→payment→confirm→inventory→kitchen→current round→dispatch→delivered บน prod · DEPENDENCY: M1-01, M1-04, M1-05, M1-06, M1-08 · OWNER: place real order / ENG: ตรวจ trace ทุกขั้น · ACCEPTANCE: Section 9.1 · PROD: order_id + DB rows + inventory_transactions + batch + assignment + payment record · AFTER: VERIFIED

**M1-03 · PRE_ORDER Scheduled Closure (MODE B)**
STATUS: CREATION=VERIFIED / LIFECYCLE=PARTIAL · EVIDENCE: Migr 024/025/027/035 · GAP: 20 ขั้นไม่มี prod trace · REQUIRED: real PRE_ORDER ผ่าน date→round→window→cutoff→capacity(date+round)→address→fee→payment→confirm→reserve→inventory→batch→วันผลิต→prepare→ready→driver→dispatch ตามรอบ→delivered (+cancel/restore/refund) · DEPENDENCY: M1-01, M1-04, M1-05, M1-06, M1-07, M1-08 + owner decision ข้อ 5.2#3/#4/#11 · OWNER: place real pre-order ข้ามวัน / ENG: trace lifecycle · ACCEPTANCE: Section 9.2 · PROD: scheduled batch + round dispatch + delivered rows · AFTER: VERIFIED

**M1-04 · Payment Hardening**
STATUS: spine VERIFIED / bill=OWNER-ONLY ค้าง · EVIDENCE: webhook 6/6 · GAP: real card charge + refund bill · REQUIRED: ENG — เตรียม test path + log; OWNER — ทำธุรกรรมจริง 1 รายการ + refund · DEPENDENCY: M1-01 · ACCEPTANCE: payment record ตรง order_id, idempotent, refund มีบิล · PROD: receipt/บิลจริง · AFTER: VERIFIED

**M1-05 · Inventory Lifecycle Proof**
STATUS: mechanism VERIFIED / cycle PARTIAL · EVIDENCE: Migr 019/026 · GAP: confirm→deduct, cancel→restore, insufficient→reject atomic ไม่มี prod evidence · REQUIRED: ทดสอบผ่าน order จริงทั้งสองโหมด + ตรวจ inventory_transactions · DEPENDENCY: M1-02, M1-03 · ACCEPTANCE: 11.4 · AFTER: VERIFIED

**M1-06 · Capacity Behavior Proof (ทั้งสองโหมด)**
STATUS: mechanism VERIFIED / behavior PARTIAL · EVIDENCE: trigger + FOR UPDATE · GAP: SAME_DAY today+round และ PRE_ORDER date+round: reserve→full→reject→cancel→release ไม่มี prod evidence · REQUIRED: runtime test + concurrency check ตามที่ design รองรับ (ห้าม redesign) · DEPENDENCY: M1-02, M1-03 · ACCEPTANCE: 11.5 · AFTER: business capability VERIFIED

**M1-07 · Kitchen Lifecycle Proof**
STATUS: mechanism VERIFIED / lifecycle PARTIAL · GAP: current-day queue behavior + scheduled batch behavior · REQUIRED: สร้าง batch จริงทั้งสองโหมด จาก AdminKitchen, เดิน prepare→ready · DEPENDENCY: M1-02, M1-03 · OWNER: — / ENG: รันจาก AdminKitchen · ACCEPTANCE: 11.6 · AFTER: VERIFIED

**M1-08 · Delivery / Bite Drive Closure**
STATUS: mechanism VERIFIED / prod dispatch PARTIAL · GAP: assignment → dispatch → delivered + orders.status sync · REQUIRED: prod trace assignment จาก UI (04d19c7 ใช้อยู่แล้ว — ห้าม rewrite) · DEPENDENCY: M1-02, M1-03, M1-07 · ACCEPTANCE: 11.7 · AFTER: VERIFIED

**M1-09 · Admin Operational Proof**
STATUS: code VERIFIED / transitions PARTIAL · GAP: state transitions ทุก module บน prod + error handling · REQUIRED: ใช้ admin จริงกับ order จริงตาม E2E · DEPENDENCY: M1-02/03/07/08 · ACCEPTANCE: 11.8 · AFTER: VERIFIED

**M1-10 · Security Live-DB Review**
STATUS: code VERIFIED · GAP: owner live review · OWNER: Supabase Dashboard review ACL/RLS · DEPENDENCY: — · ACCEPTANCE: anon residue 0/0 ยืนยันบน live DB · AFTER: VERIFIED

**M1-11 · Production Lighthouse**
STATUS: PARTIAL (local 81) · OWNER: รันบน prod URL · ENGINEERING: fix ถ้าต่ำกว่า 90 · DEPENDENCY: M1-02/03 เสร็จ (หน้าเว็บเสถียร) · ACCEPTANCE: Perf ≥ 90 บน production URL · AFTER: VERIFIED

**M1-12 · M1 Gate Summary**
STATUS: BLOCKED · เงื่อนไขปิด: E2E #1 + #2 (ครบ business-rule coverage) + card bill + Lighthouse + live-DB review · AFTER: M1 CLOSED

### P2 (OPERATING PLATFORM)

**P2-01 · Notifications จริง** (push/email/LINE) — PARTIAL→ทำ provider + send จริง · DEPENDENCY: M1 closure · ENGINEERING
**P2-02 · External Riders >5km** — BLOCKED บน OWNER API keys · OWNER provide keys → ENGINEERING integrate → sandbox→prod
**P2-03 · Channels intake (FB/Messenger/LINE → canonical order hub)** — PLANNED · OWNER: decision + tokens · ENGINEERING: implement intake
**P2-04 · Make.com worker** — DEFERRED/OWNER-ONLY · OWNER: decision + scenario · ห้าม claim จนกว่ามี live scenario evidence
**P2-05 · Content Engine closure** — content management + FB posting (OWNER token)
**P2-06 · Content → Order attribution loop** — MISSING · ENGINEERING
**P2-07 · Review → Data → AI → Better Content loop** — PARTIAL→MISSING ปลายทาง · ENGINEERING
**P2-08 · AI production integration** — prod conversation trace + owner key

### P3 (SCALE / INTELLIGENCE)

**P3-01 Inventory PRO · P3-02 Analytics PRO · P3-03 AI-BIZ · P3-04 AI-FC · P3-05 forecasting/copilot · P3-06 SaaS/multi-tenant · P3-07 White-label** — ทั้งหมด MISSING, ปัจจุบันไม่มี implementation evidence ใดๆ — เริ่มได้เมื่อ P2 พิสูจน์แล้วตาม dependency
**DEFERRED: Voice — owner decision AI-06 CANCELLED — ห้าม resurrect โดยไม่มี owner decision ใหม่**

---

## Section 9 — ACCEPTANCE CRITERIA (GIVEN / WHEN / THEN / EVIDENCE)

### 9.1 SAME_DAY (E2E #1)

```text
GIVEN  วันนี้ยังเปิดรับ order (ก่อน cutoff, capacity เหลือ)
WHEN   customer creates SAME_DAY order บน production
THEN   order_mode = SAME_DAY · scheduled_date semantics ถูกต้องตามระบบ
       · capacity ถูก reserve · payment ถูกบันทึก · confirm ผ่าน
       · inventory ถูก deduct · kitchen queue เห็น order (current queue)
       · delivery assignment เห็น order (current window)
       · dispatch สำเร็จ · delivered ถูกบันทึก
EVIDENCE  order_id · DB rows (orders/order_items) · inventory_transactions
          · production_batch · delivery_assignment · status transition log
          · payment record
```

### 9.2 PRE_ORDER (E2E #2)

```text
GIVEN  ลูกค้าเลือก future scheduled_date + delivery_round ที่ยังไม่เต็ม
WHEN   customer creates PRE_ORDER order
THEN   order_mode = PRE_ORDER · scheduled_date = วันที่เลือก (ห้าม today/อดีต)
       · round = รอบที่เลือก · capacity ของ date+round ถูก reserve
       · address บังคับผ่าน trigger · fee คำนวณ · payment บันทึก · confirm ผ่าน
       · inventory/capacity reservation ถูกบันทึกตาม lifecycle ที่กำหนด
       · order อยู่ใน queued_for_production → BATCHED ตาม scheduled_date+round
       · วันผลิต: prepare→ready · driver assignment · dispatch ตามรอบ · delivered
EVIDENCE  scheduled batch row ที่ผูก date+round · assignment ตามรอบ
          · capacity ของวันนั้น/รอบนั้น · ทุก status transition มี audit log
```

### 9.3 Payment
GIVEN order ที่สร้างแล้ว WHEN ชำระด้วย card จริง THEN payment record ตรง order_id + amount-match + idempotent (ซ้ำไม่บิลซ้ำ) EVIDENCE: payment_intents row + webhook log + ใบเสร็จจริง

### 9.4 Inventory
GIVEN order confirmed THEN inventory_transactions แสดง deduct; GIVEN cancel THEN restore; GIVEN สั่งเกิน stock THEN `ERR_INSUFFICIENT_INGREDIENT` และไม่มีการ deduct บางส่วน EVIDENCE: transactions table + order rows

### 9.5 Capacity (ทั้งสองโหมด)
GIVEN รอบเต็ม THEN `ERR_CAPACITY_FULL`; GIVEN cancel THEN count ลด; GIVEN 2 concurrent orders THEN ไม่ oversell EVIDENCE: round counts ก่อน/หลัง + reject log — **ทั้ง SAME_DAY (today+round) และ PRE_ORDER (date+round) แยกกัน**

### 9.6 Kitchen
GIVEN order confirmed THEN batch สร้างได้ทั้งสองโหมด (p_order_mode); prepare→ready trace ได้จาก AdminKitchen EVIDENCE: production_batches/batch_items + status history

### 9.7 Delivery
GIVEN batch ready THEN assignment สร้างได้จาก UI; driver update status → orders.status เดินตาม EVIDENCE: delivery_assignments + orders.status log

### 9.8 Admin
GIVEN order จริงทุกโหมด THEN ทุก transition ทำได้จาก Admin ตาม allow-list, error มี handling, audit_logs มี record EVIDENCE: audit_logs + screenshots บน prod

---

## Section 10 — BUSINESS RULE TEST MATRIX

### SAME_DAY

| # | Case | ผลที่ต้องเกิด |
|---|------|---------------|
| 1 | valid order | สร้าง+confirm+deduct+queue สำเร็จ |
| 2 | หลัง cutoff | reject (`ERR_CUTOFF_PASSED`) |
| 3 | capacity full | reject (`ERR_CAPACITY_FULL`) |
| 4 | insufficient stock | reject atomic, ไม่ clamp |
| 5 | invalid distance | reject ตามกฎ 5 กม. |
| 6 | cancel | status change + restore |
| 7 | restore inventory | transactions คืนครบ |
| 8 | restore capacity | round count คืน |
| 9 | payment failure | order ไม่ confirm, state ชัด |
| 10 | duplicate payment | idempotent — ไม่บิลซ้ำ |
| 11 | delivery assignment | assignment ต่อรอบวันนี้ถูกต้อง |

### PRE_ORDER

| # | Case | ผลที่เกิด |
|---|------|-----------|
| 1 | valid future date | สร้างได้ |
| 2 | today rejected | reject |
| 3 | past date rejected | reject |
| 4 | invalid round | reject |
| 5 | pre-order window ผิด | reject (NEED OWNER DECISION — rule ยังไม่พบ) |
| 6 | pre-order cutoff ผิด | reject |
| 7 | capacity full (date+round) | reject |
| 8 | insufficient stock | reject |
| 9 | invalid address | trigger `validate_pre_order_delivery` reject |
| 10 | cancel ก่อน cutoff | restore capacity + inventory |
| 11 | cancel หลัง cutoff | reject หรือ policy ของ owner (NEED OWNER DECISION) |
| 12 | inventory restore | transactions คืน |
| 13 | capacity restore | round count คืน |
| 14 | refund | ตาม payment state + บิลจริง |
| 15 | batch generation | batch ตาม scheduled_date+round |
| 16 | scheduled production + scheduled dispatch | prepare วันผลิต, dispatch ตามรอบ |

---

## Section 11 — PRODUCTION EVIDENCE PLAN

### Engineering-verifiable (AI DEV ทำเองได้)

- code / migration / RPC / RLS review จาก repo + migration files
- unit/integration test (vitest, ปัจจุบัน 19/19 baseline — ห้าม mock เพื่อให้ผ่าน)
- local runtime verification (dev server + local Supabase/staging)
- trace script: query DB rows (orders, inventory_transactions, production_batches, delivery_assignments, payment_intents, audit_logs) หลังทดสอบ
- deploy จาก CI ไป production URL เพื่อให้ Owner ทดสอบได้

### Owner-only (ต้องรอ Owner — ห้าม AI DEV ทำแทน)

- real card charge + refund bill จริง
- การ place real order บน production ทั้งสองโหมด (OWNER ร่วมกับ ENG เฝ้า trace)
- production Lighthouse run บน prod URL
- production secrets / API keys (Stripe live, external riders, FB/LINE, OpenRouter)
- live Supabase Dashboard review (RLS/ACL/data)
- Make.com account + scenario

**กติกา:** งาน ENGINEERING ทำได้เองจนถึง "พร้อมให้ทดสอบ" — ข้ามเส้นนี้เป็น OWNER-ONLY ต้องรอ และ**ห้าม**สร้าง evidence แทน

---

## Section 12 — EXECUTION ORDER (ตาม dependency/critical path — ตรวจแล้วจาก Section 7, ห้ามเรียงตามความง่าย)

```text
PHASE 0  Baseline / Freeze / Audit          — ทำแล้ว (เอกสาร reconciliation rev2) · BLOCKING
PHASE 1  Order + Mode Contract              — M1-01 · BLOCKING (ปกป้อง contract)
PHASE 2  SAME_DAY operational closure       — M1-02 (+05/06/08 trace) · DEPENDENT PHASE 1
PHASE 3  PRE_ORDER scheduled closure        — M1-03 (+ owner decisions 5.2#3/#4/#11) · DEPENDENT PHASE 1 (PARALLEL กับ PHASE 2 หลัง payment/capacity พร้อม)
PHASE 4  Payment / Inventory / Capacity hardening — M1-04/05/06 · DEPENDENT PHASE 1 (PARALLEL ได้บางส่วน)
PHASE 5  Kitchen                            — M1-07 · DEPENDENT PHASE 2/3
PHASE 6  Delivery / Bite Drive              — M1-08 · DEPENDENT PHASE 5
PHASE 7  M1 Production E2E                  — รวม E2E #1 + #2 บน prod · DEPENDENT PHASE 2-6
PHASE 8  M1 Owner Evidence                  — card bill, Lighthouse, live-DB review · OWNER-ONLY
PHASE 9  P2 Platform                        — หลัง M1 CLOSED
PHASE 10 P3 Scale                           — หลัง P2 พิสูจน์
```

**Critical Path:** M1-01 → (M1-04, M1-05, M1-06) → M1-02 + M1-03 → M1-07 → M1-08 → M1-09 → M1-12 (gate) → OWNER actions (M1-04 bill, M1-10, M1-11) → M1 CLOSED

**หมายเหตุ:** sequence ข้างบนอ้างอิง dependency จริงจาก code/DB ที่ตรวจแล้ว — ถ้าพบ dependency เพิ่มระหว่างทำงาน ต้องอัปเดต plan นี้ก่อน ห้ามเดา

---

## Section 13 — DO NOT TOUCH (ห้าม AI DEV แตะ)

1. **04d19c7 functionality** — DeliveryManagement → `listDrivers()` → RPC `list_drivers` (แก้แล้ว ห้าม reimplement)
2. **Canonical order spine ที่ VERIFIED แล้ว** — orders/order_items/order_mode/state machine (Migr 007/023/025/030) — ห้าม rewrite เพราะ "อยากทำให้สวย"
3. **Security controls ที่ VERIFIED แล้ว** — Migr 033/034/035 ACL, `is_admin()` gates, webhook service_role
4. **`aiToolCalling.ts.disabled`** — ปิดอย่างถูกต้องแล้ว (716b4e9) — ห้าม un-disable โดยไม่มี owner decision + security review
5. **Legacy `pre_orders` archive/freeze** — ห้ามทำ write path ใหม่; `migrated_order_id` ต้องอยู่
6. **Owner decisions** — Voice CANCELLED (AI-06); ห้าม resurrect โดยไม่มี decision ใหม่
7. ห้ามสร้าง mock/fake evidence เพื่อให้ report ผ่าน

---

## Section 14 — DEFINITION OF DONE

ทุก task ปิดด้วยชั้นที่จำเป็นของ task นั้นเท่านั้น:

```text
CODE · DB · RPC · RLS · UI · RUNTIME · PRODUCTION · TEST · DOCUMENTATION
```

- Implementation task (เช่น ถ้าต้อง implement pre-order window): ต้องมี CODE+DB/RPC+RLS+UI+RUNTIME+TEST+DOC ก่อนถึงจะขึ้น "พร้อมให้ทดสอบ"
- Proof task (เช่น M1-02..M1-09): ต้องมี PRODUCTION evidence จึงจะ VERIFIED
- สถานะสุดท้าย: `VERIFIED / PARTIAL / MISSING / BLOCKED / OWNER-ONLY / DEFERRED` — **ห้าม COMPLETE ถ้า evidence ไม่ครบ**
- ห้ามปิด task ด้วย documentation claim เพียงอย่างเดียว

---

## Section 15 — CONTRADICTIONS FOUND, ASSUMPTIONS, OWNER DECISIONS

### Contradictions ที่ตรวจพบและแก้เป็น current truth เดียวกัน

| เดิม | Current truth (เอกสารนี้ + Reconciliation Revision 2) |
|------|--------------------------------------------------------|
| GAP-1 บอก SAME_DAY + PRE_ORDER ต้องมี runtime evidence แต่เอกสารบางส่วนบอกเหลือเพียง PRE_ORDER E2E | **แก้แล้ว** — M1 ต้องมี Operational E2E #1 (SAME_DAY) และ #2 (PRE_ORDER) แยกกัน |
| เอกสารเก่าตีความ SAME_DAY = PRE_ORDER + scheduled_date=today | **แก้แล้ว** — lifecycle คนละชุด (Section 5/6) |
| เอกสารเก่าถือ DB mechanism = capability VERIFIED | **แก้แล้ว** — Mechanism vs Behavior แยก (M1-06) |
| `BMB_DEEP_PRODUCT_LOGIC_AUDIT` / `ADMIN_GAP_MAP` พูด MOCK_DRIVERS, localStorage inventory, ไม่มี AdminKitchen | HISTORICAL — แก้แล้วด้วย 04d19c7/9787429/ff54783 — ห้ามใช้เป็น current gap |
| `BMB_100_PERCENT_*` closure books | HISTORICAL — ห้ามใช้เป็น evidence ของ product completion |

### Assumptions ที่ยังไม่มีหลักฐาน (ต้องไม่ implement ก่อนยืนยัน)

1. PRE_ORDER ใช้ capacity lock เดียวกับ same-day trigger ที่วันอนาคต — mechanism อยู่ใน migration แต่ยังไม่มี runtime evidence (จะพิสูจน์ใน M1-03/06)
2. `driver_update_delivery_status` sync ไป `orders.status` — ยังไม่ได้ยืนยันทุก path (M1-08 ต้อง trace)
3. pre-order window + cancel-after-cutoff policy — **NOT FOUND — NEED OWNER DECISION**
4. จุด deduct inventory ของ pre-order lifecycle — **NEED OWNER DECISION** (design เดิมไม่พบชัดเจน)
5. Lighthouse เกณฑ์ 90 ใช้กับ production URL — ตัวเลขที่มีทั้งหมดเป็น local (OWNER ต้องรัน)

### Dependency ที่ยังต้อง Owner decision

1. Pre-order window rule + cancel-after-cutoff policy
2. Pre-order inventory deduct timing
3. External rider provider ที่จะใช้ (Grab/LineMan/Foodpanda) + keys
4. Notification provider (email/push/LINE) ที่จะใช้ (P2)
5. Make.com: จะใช้เป็น worker จริงหรือยกเลิก
6. Channels: FB/Messenger/LINE priority + tokens

**PLAN STATUS: READY FOR OWNER REVIEW — ห้ามเริ่ม implementation จนกว่า Owner จะ approve**