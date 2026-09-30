# BMB — ORDER SPINE DESIGN (PHASE 1 — DOMAIN DESIGN, รอตรวจก่อน coding)

> **ตามคำสั่ง:** "สร้าง Canonical Order Domain และ migrate PRE_ORDER เข้าสู่ domain นั้น พร้อมปิด business invariants"
> **HEAD อ้างอิง:** `3061490` · **สถานะ:** PHASE 1 — ห้ามแก้ code/DB ก่อนเอกสารนี้ผ่านการตรวจ
> **หลักฐาน:** migrations 001–022 ณ HEAD + **live production DB (อ่านอย่างเดียว, probe 2026-09-22 ผ่าน `e2e/_probe_spine_design.cjs`)** + grep consumer จริงทั้งหมด

---

# 1. CURRENT MODEL (ข้อเท็จจริงที่ design ยึด)

## 1.1 โครงที่มีอยู่จริง (สรุปจาก DDL จริง)

| ตาราง | สาระสำคัญต่อ design |
|---|---|
| `orders` (001) | id/order_number TEXT unique · customer_id TEXT + customer_ref UUID · delivery_round_id FK · status enum `order_status` 10 ค่า · delivery_method enum · dropoff lat/lng/detail · เงินครบ · payment_status enum (pending/paid/refund/partially_refunded) · payment_method enum NOT NULL DEFAULT 'promptpay_qr' · **ไม่มี order_mode · ไม่มี scheduled_date** |
| `order_items` (001) | product_id FK RESTRICT, product_name, quantity, unit_price, customizations JSONB, item_total (trigger) |
| `pre_orders` (001+006) | island: product/qty/unit_price/total_amount ฝังแถวเดียว · scheduled_date · delivery_round_id FK · status TEXT อิสระ 8 ค่า · customer_ref UUID · ไม่มี payment |
| `payment_intents` (001/003/008/010) | ผูกด้วย `order_number` (ไม่มี FK ตามที่ 001 ระบุไว้ตั้งใจ) + unique partial payment_intent_id + amount-match ใน RPC |
| `delivery_rounds` | **per-date rows** (scheduled_date) + cutoff_time + max_capacity/current_count + status |
| `production_batches(_items)` (019) | มี scheduled_date + delivery_round_id แล้ว; items อ้าง order_id/order_number — พร้อมรับ canonical orders ทันที |
| `recipes`/`inventory(_transactions)` (019) | BOM + deduct/restore hook ที่ `transition_order_status` |
| `drivers`/`delivery_assignments` (020) | ผูก order_number UNIQUE — ใช้กับ canonical ได้ทันที |
| `products` | `is_preorder` boolean เดียว (UI ตีความ "pre-order-only", server ไม่ gate) |

## 1.2 Live production evidence (probe อ่านอย่างเดียว, 2026-09-22)

- **`pre_orders` = 1 แถว**: `PO-20260919-430` · pending · qty 1 · 85฿ · scheduled **2026-09-24** · round-2 · prod-5 · customer 'Guest' · สร้าง 2026-09-19 (= ก่อน 017 ถูก db push 2026-09-21 → legacy direct-insert row)
- **`orders` = 16 แถว** (TEST-001 confirmed/paid · กลุ่ม e2e/bill rows · BMB-LIVE refund 1 แถว) — 2 แถว delivery_round_id = NULL (webhook test)
- **`delivery_rounds` = 3 แถว ทั้งหมด scheduled_date = 2026-09-17 (STALE ทั้งชุด)**, current_count 6/5/2
- **`payment_intents` = 13 แถว** · **`products` = 9 แถวจริง** (prod-5/6 pre-order: scheduled 2026-09-24/2026-10-01)

## 1.3 ข้อค้นพบที่บังคับ design

1. **Rounds เป็น per-date rows และปัจจุบัน stale ทั้งหมด** → บังคับ cutoff โดยไม่มีกลไกสร้าง round ของวันปัจจุบัน = ปิดขายทันทีที่ deploy → ต้องมี round instantiation (§6.3)
2. **แถว PO-20260919-430 ขัดแย้งกับ round ที่ชี้อยู่** (round-2.scheduled_date=2026-09-17 ≠ 2026-09-24) → ถ้ามีใครแตะผ่าน RPC 017 จะโดน `ERR_ROUND_DATE_MISMATCH` → migration ต้องแก้ความสอดคล้องก่อน (§13)
3. `payment_intents` ผูก order_number → **pre-order ที่กลายเป็น canonical order ใช้ payment lifecycle เดิมได้ทันที โดยไม่แตะ payment architecture** (ตรง brief §9)
4. capacity drift จริง (13 สล็อตนับ vs 16 orders รวม 2 null-round) → ยืนยัน G-02 ต้องแก้ในงานนี้

---

# 2. คำตอบบังคับ 12 คำถามของ brief (Section 2)

| # | คำถาม | คำตอบ |
|---|---|---|
| 1 | `orders` รองรับ PRE_ORDER ได้ไหม? | **ได้ ~95% ด้วยโครงเดิม** — เงิน/items/round/status/payment/audit ครบ ขาดแค่ order_mode, scheduled_date, และ mode-gate สองทาง |
| 2 | เพิ่ม column อะไร? | `orders.order_mode` + `orders.scheduled_date` · `products.available_same_day/available_preorder` · `pre_orders.migrated_order_id` · `production_batch_items.order_mode` (snapshot) — **จบ แค่นี้** |
| 3 | order_mode รูปไหน? | **enum `order_mode ('SAME_DAY','PRE_ORDER')` NOT NULL DEFAULT 'SAME_DAY'** — ตรง convention เดิม (order_status/delivery_method เป็น enum), กัน typo, ใช้ใน RLS/trigger ได้ตรง |
| 4 | scheduled_date อยู่ไหน? | **`orders.scheduled_date`** (snapshot) — ซ้ำกับ round โดยตั้งใจ; RPC บังคับ `order.scheduled_date = round.scheduled_date` เสมอ เพื่อกัน admin ย้าย round ทีหลังแล้วข้อมูลแตก |
| 5 | delivery_round_id อยู่ไหน? | **`orders.delivery_round_id`** เดิม — ในโฟลว์ใหม่บังคับ NOT NULL (2 แถวเก่า NULL เป็น webhook-test rows เก็บตามจริง) |
| 6 | address snapshot อยู่ไหน? | **`orders.dropoff_detail` + `dropoff_latitude` + `dropoff_longitude`** — มี semantic เดียวกันอยู่แล้ว **ห้ามเพิ่มซ้ำ**; pre-order flow ต้องส่งจริง (Phase 5 แก้ hardcode) |
| 7 | payment intent เชื่อมอย่างไร? | เดิม: `payment_intents.order_number` — คงแบบเดียวกัน + **เพิ่ม index บน order_number + validate ใน RPC** (ไม่ใส่ hard FK เพราะมี legacy/test intents ที่ order ไม่อยู่ในตาราง และ 001 ตั้งใจไว้แบบนั้น) |
| 8 | batch ใช้ order_id อย่างไร? | `create_production_batch(p_round, p_date)` ดึง canonical orders (confirmed/preparing) **ทั้งสองโหมด** → batch_items เหมือนเดิม + snapshot `order_mode` |
| 9 | inventory hook ใช้ status ใด? | เดิม: deduct ที่ `confirmed` · restore ที่ `cancelled/failed` (from confirmed/preparing) — ทำงานกับสองโหมดทันทีที่เป็น canonical; แก้ aggregation + กันขาดเงียบ (§8) |
| 10 | cancellation ใช้ state ไหน? | canonical `cancelled` ทั้งสองโหมด; pre-order `expired` → map `failed` (คง enum เดิม ไม่ขยาย enum) |
| 11 | pre_orders migrate อย่างไร? | แถวเดียว → canonical orders (คง order_number `PO-…` เดิม) + order_items 1 แถว + `pre_orders.migrated_order_id` ชี้กลับ + แก้ round ให้สอดคล้อง (§13) |
| 12 | preserve เก่า? | **preserve ทุกแถวทุกตาราง** — ห้าม DROP · batches/payments ไม่ถูกแตะ |

---

# 3. TARGET DOMAIN MODEL

```text
PRODUCT (available_same_day / available_preorder)
        ↓
ORDER MODE (p_order_mode + p_scheduled_date เป็น input ของ RPC เดียว)
        ↓
CANONICAL ORDER (orders + order_items)
        ↓
   ┌────────┬───────────┬────────────┐
Payment  Inventory   Kitchen      Delivery
(payment_intents) (recipes/batches) (zones/drivers/assignments)
        └────────┴───────────┴────────────┘
                     ↓
                Tracking (อ่าน DB)
```

## 3.1 การเพิ่ม schema ทั้งหมด (ยืนยันว่าไม่ duplicate)

| ตาราง | เพิ่ม | เหตุผล |
|---|---|---|
| `orders` | `order_mode order_mode NOT NULL DEFAULT 'SAME_DAY'`, `scheduled_date DATE NULL`, index (`order_mode, scheduled_date`) | หัวใจ canonical |
| `products` | `available_same_day BOOLEAN NOT NULL DEFAULT true`, `available_preorder BOOLEAN NOT NULL DEFAULT false` + index; `is_preorder` กลายเป็น alias ที่ถูก sync | รองรับสินค้า A/B/C |
| `pre_orders` | `migrated_order_id TEXT` (traceability เท่านั้น ไม่มี FK hard) | migration audit |
| `production_batch_items` | `order_mode order_mode NOT NULL DEFAULT 'SAME_DAY'` | ให้คิวครัว query ตรงไม่ต้อง join ทุกครั้ง |

**สิ่งที่ตั้งใจไม่เพิ่ม:** ตาราง payment/kitchen/delivery ของ pre-order แยก (ห้ามตาม brief §1) · ตาราง order_modes · pre_orders_payment · address แยก

## 3.2 RPC surface หลัง Phase 2

| RPC | การเปลี่ยน | ผลต่อ consumer เดิม |
|---|---|---|
| `create_order_with_items` | ขยาย signature ด้วย optional params (`p_order_mode DEFAULT 'SAME_DAY'`, `p_scheduled_date DEFAULT NULL`) + mode rules/cutoff/inventory-guard/delivery-rule ข้างใน | client เดิม (CheckoutPage) ไม่แตก — PostgREST resolve ตามชื่อ |
| `cancel_order` (ใหม่) | canonical cancellation (§12) | ใหม่ทั้งหมด |
| `create_pre_order_with_items` | กลายเป็น **compat shim** → map params → canonical creation (mode=PRE_ORDER) → คืน shape เดิม | HomePage/MenuPage/preOrderService ใช้ต่อได้ระหว่าง migrate |
| `cancel_pre_order` | shim: มี `migrated_order_id` → เรียก `cancel_order`; ไม่มี → legacy path | คง compatibility |
| `ensure_rounds_for_date(p_date)` (ใหม่, admin-guard) | โคลน round template ของวันใหม่ (§6.3) | admin/pre-order flow |
| `quote_pre_order`, `preorder_votes` ฯลฯ | คงเดิม | ไม่แตะ |

**หลักคุม RPC ทั้งหมด:** same validation authority / same price authority / same customer authority / same capacity authority / same payment authority / same state authority / same audit authority — แตกต่างเฉพาะ mode-rules ภายใน (brief §4)

---

# 4. STATE MODEL (canonical, ไม่มีเครื่องจักรที่สอง)

- คง `order_status` enum 10 ค่า + allow-list + BEFORE UPDATE trigger + `transition_order_status` + audit เดิมทั้งชุด (พิสูจน์แล้วว่าแข็ง)
- **ทั้ง SAME_DAY และ PRE_ORDER ใช้ chain เดียวกันนี้** — ความต่างมีแค่ label ที่ลูกค้าเห็น ซึ่ง map ผ่าน `orderVocabulary.ts` ที่มีอยู่แล้ว (pending→Booked, confirmed→Allocated, preparing→Batch Production เป็นต้น)
- pre-order status เก่า (8 ค่า TEXT) map ตอน migrate: pending→pending, confirmed→confirmed, preparing→preparing, ready→ready_for_dispatch, picked_up→dispatched, delivered→delivered, cancelled→cancelled, expired→failed
- เพิ่มเติมเดียว: `transition_order_status` hook — ตอน `cancelled/failed` **คืน capacity** (§7) คู่กับ inventory restore ที่มีอยู่ ใน RPC เดียวกัน (transactional)

---

# 5. CAPACITY MODEL (ตัดสินใจ semantic ให้ชัด)

**DECISION — Option A (แนะนำ): capacity = จำนวนออเดอร์ (สล็อต) + cap จำนวนชิ้นต่อออเดอร์**
- เหตุผล: โครง trigger/lock ปัจจุบัน atomic และพิสูจน์แล้ว; แก้ semantic เป็น "ชิ้นอาหาร" ต้องเขียน trigger/RPC ใหม่ทั้งชุด + เสี่ยง regression ในเวลาที่ M1 ต้องปิด
- กันการโกง slot ด้วย qty ยักษ์: `CHECK` ใหม่ใน RPC — `p_quantity` รวมทุก item ≤ `business_settings.max_items_per_order` (default 20, ตั้งได้)
- Option B (เสนอไว้ ไม่เลือก): capacity = มื้อ/ชิ้น — data impact: ต้อง define หน่วยต่อสินค้า + migration ตัวเลข; rollback impact สูง

**ตารางอายุของ capacity (enforce ทั้งหมดใน SQL):**

| เหตุการณ์ | capacity |
|---|---|
| CREATE (ทั้งสองโหมด) | +1 (lock + check ใน RPC; SAME_DAY ผ่าน trigger INSERT เดิม, PRE_ORDER +1 ใน RPC 017 เดิม — คงไว้) |
| CANCEL (ทั้งสองโหมด) | **−1 แบบ idempotent** — เพิ่ม trigger `orders_release_round_capacity` AFTER UPDATE OF status WHEN (OLD.status NOT IN ('cancelled','failed') AND NEW.status IN ('cancelled','failed')) → decrement +1 slot, GREATEST(0, ...) + audit note |
| PAYMENT FAILED | **ไม่ปล่อย slot** (ลูกค้ามีสิทธิ์ retry/ชำระภายหลัง; slot ปล่อยเมื่อ order ถูก cancel/failed เท่านั้น) — ประกาศเป็น rule ชัด |
| CONFIRMED | คง slot เดิม |
| PRE_ORDER | +1 ที่ round ของ scheduled_date อนาคต (ตาม §6) |

Concurrency: SAME_DAY ใช้ row-lock เดิม; ตอน release ใช้ row-lock เดียวกัน (`FOR UPDATE` ใน trigger ผ่าน UPDATE เดียวกัน); idempotent โดยเงื่อนไข transition (OLD→NEW) ไม่ยิงซ้ำ

---

# 6. CUTOFF MODEL (DECISION: ย้าย logic เข้า authoritative RPC — brief §6 ให้เลือกเดียว)

**เลือกทาง (2):** cutoff/quota logic อยู่ใน **SQL ของ canonical RPC** เป็น authority เดียว
`availabilityEngine.ts` ไม่ถูกลบ แต่ถูก **re-spec เป็น client mirror**: ป้อนด้วยข้อมูล round จริงจาก DB (current_count/max_capacity/cutoff_time/scheduled_date) เพื่อ disable ปุ่ม/แสดงสถานะล่วงหน้า — และมี test ยืนยันว่า client engine กับ SQL rule ให้ผลตรงกันในกรณีเดียวกัน (ห้ามตัดสินใจขายโดย client อีกต่อไป)

## 6.1 เวลา (บังคับระบุ)
ทุกการเทียบเวลาใช้ **`now() AT TIME ZONE 'Asia/Bangkok'`** เท่านั้น (Supabase เป็น UTC; ร้านอยู่จันทบุรี) — ห้ามใช้ CURRENT_TIME ดิบ

## 6.2 กฎ cutoff ต่อโหมด (ใน `create_order_with_items`)

| Mode | กฎ server (authoritative) |
|---|---|
| SAME_DAY | round ที่เลือกต้องมี `scheduled_date = วันนี้ (Bangkok)` **และ** `เวลาปัจจุบัน (Bangkok) <= round.cutoff_time` **และ** status='active' → ไม่ผ่าน = `ERR_CUTOFF_PASSED` / `ERR_ROUND_DATE` |
| PRE_ORDER | `p_scheduled_date` บังคับ ≥ วันพรุ่งนี้ (Bangkok); ต้องมี round ของวันนั้น (status='active'); **lead time**: จองได้ต่อเมื่อ `scheduled_date - วันนี้ ≥ pre_order_lead_days` (business_settings, default 1) — booking ไม่ผูกเวลา-of-day เพราะรอบอนาคตยังไม่เปิด |
| ทั้งคู่ | UI ห้ามมี path "UI บอกว่าเต็ม/ปิด แต่ RPC รับ" — RPC เป็นตัวตัดสินเดี่ยว; UI อ่าน round จริงเพื่อ pre-disable เท่านั้น |

## 6.3 Round lifecycle (dependency ที่ต้องมี ไม่งั้น cutoff กลายเป็นการปิดร้านถาวร)

- ปัญหาจริงจาก probe: rounds ทั้ง 3 คือแถววันที่ 2026-09-17 (stale) → same-day ของวันนี้ไม่มี round ให้สั่ง
- แก้ด้วย **round template + instantiation**: `ensure_rounds_for_date(p_date)` (admin) โคลนชุด rounds ล่าสุดของวันใดวันหนึ่ง (id ใหม่ `round-<date>-<key>`) → admin กดสร้างรอบวันนี้/วันจัดส่งล่วงหน้าได้; pre-order flow เรียกให้แน่ใจว่ามี round ของวัน target ก่อนจอง
- Checkout (Phase 5) เปลี่ยนจาก hardcode `{morning:'round-1',…}` เป็น **dropdown จาก rounds ของวันปัจจุบัน** + แสดง cutoff/capacity จริง

---

# 7. INVENTORY MODEL (business rule ที่ยึดหลักฐาน ไม่แต่งใหม่)

**DECISION — "reject-at-confirm + advisory guard ตอน create"** (สอดคล้องพฤติกรรมเดิมที่ deduct เกิดที่ confirm และ INV-02 ปิดขายหลัง stock ต่ำ — เอกสาร 019 + MASTER_SPEC §3 ไม่ได้กำหนด reserve/backorder ใด ๆ ไว้)

1. **แก้ aggregation bug (G-03):** ลบ `v_done_ids` — หักแบบ **aggregate ต่อ ingredient**: รวม `SUM(quantity * quantity_per_unit)` ทุก item ใน order ก่อน แล้วอัปเดตทีละวัตถุดิบ (item A และ B ใช้ X เดียวกัน = หักจริงรวมกัน)
2. **ห้ามขาดเงียบ:** ลบ `GREATEST(current_stock - req, 0)` — เช็ค `current_stock >= req` ก่อนหัก ถ้าไม่พอ `RAISE 'ERR_INSUFFICIENT_INGREDIENT: <name>'` → **transition confirmed ถูก block ทั้งใบ** (ไม่ negative stock, ไม่ under-deduct) — admin ต้องเติมสต็อกหรือยกเลิก
3. **Advisory guard ตอนสร้าง:** ใน `create_order_with_items` ถ้าโหมด SAME_DAY — เรียก feasibility แบบ aggregate ต่อ product แล้ว **ปฏิเสธล่วงหน้า** (`ERR_INSUFFICIENT_INGREDIENT`) เมื่อของไม่พอสำหรับ qty ที่ขอ (ใช้สูตรเดียวกันกับตอน confirm เพื่อไม่มี "UI ปฏิเสธแต่ server รับ") — PRE_ORDER ไม่ guard ตอนจอง (stock ของวันอนาคตยังไม่ทราบจริง) แต่จะโดน guard ตอน confirm ก่อนผลิต
4. **restore แบบ exact:** อ่าน `inventory_transactions` ที่ deduct ไว้แล้วคืนเท่ากัน (คง idempotency เดิมผ่านการมีอยู่ของแถว) — แก้ทั้งสองโหมดฟรีเพราะ canonical
5. INV-02 (auto sold-out) คงเดิม

---

# 8. PAYMENT MODEL (ใช้ของเดิมทั้งหมด — ห้ามสร้างใหม่)

- เมื่อ pre-order เป็น canonical order: `create_payment_intent_record` (amount-match กับ orders.total), `submit_offline_payment_reference`, `confirm_offline_payment` (COD ต้อง delivered · PromptPay ต้องมี TXN), `record_payment_result` (service_role, idempotent) — **ใช้ได้ทันที ไม่แก้เลย** เพราะค้นหาด้วย order_number
- Stripe card: `create-checkout` EF ตรวจ ownership + payment_method — ใช้ได้ทันที
- **นโยบายการเก็บเงินของ PRE_ORDER (default ที่เสนอให้ owner รับรอง):** อนุญาตทั้งสาม method เหมือน same-day; kitchen ผลิตได้เมื่อ `payment_status='paid'` **หรือ** COD (เก็บปลายทางตามเดิม ต้อง delivered ก่อน confirm เงิน); ปุ่มจ่ายปรากฏบน tracking ของ pre-order ด้วย (Phase 5)
- idempotency/amount-match/failed-path ทั้งหมด = ของเดิมที่ verify แล้ว (webhook 6/6)

---

# 9. KITCHEN MODEL

- `create_production_batch(p_delivery_round_id, p_scheduled_date)` — ขยายให้ดึง canonical orders **ทั้งสองโหมด** โดยเงื่อนไข: status IN (confirmed, preparing) AND (`order_mode, scheduled_date, delivery_round_id` ตรงกับ p_*) — ห้ามอ่าน `pre_orders` เด็ดขาด
- batch_items snapshot `order_mode` (คอลัมน์ใหม่) → คิวแยกช่อง SAME_DAY/PRE_ORDER ได้
- `kitchen_queue` คง signature (round/date) — ตอนนี้จะเห็น pre-order มาเป็น items ธรรมดา
- Phase 6 เพิ่มหน้า `/admin/kitchen` (จอ queue + ปุ่มสร้าง batch) — consumer แรกจริงของ RPC ชุดนี้

---

# 10. DELIVERY MODEL

1. **ห้ามเชื่อ client distance:** ใน `create_order_with_items` ต้องมี `dropoff_latitude/longitude` (ไม่งั้น `ERR_MISSING_DELIVERY_COORDS`); ลบ fallback ใช้ `p_distance_km` เพื่อคิดเงิน (พารามิเตอร์คงอยู่แต่ถูกเมิน — ไม่ break signature)
2. **กฎ 5 กม. server-side:** คำนวณระยะ = `haversine_km(kitchen_location, dropoff)`; `≤ 5.00` → บังคับ `self_delivery` (Bite Drive); `> 5.00` → บังคับ external method — ไม่ตรง → `ERR_DELIVERY_METHOD_ZONE` (admin override = ปรับ zone/ตั้งค่าภายหลัง ไม่ใช่ client แก้ได้)
3. **Dependency จำเป็น (ไม่ใช่ over-implement):** แก้ client `DEFAULT_PROVIDERS.min_distance_km=1` → 0 สำหรับ Bite Drive เพราะปัจจุบันลูกค้า <1 กม. สั่งไม่ได้เลย (ปุ่มถูก disable ตลอด) — ขัด canonical lifecycle
4. fee ยัง derive จาก `delivery_zones` + ระยะ server (มีอยู่แล้วใน 020 — คงไว้)
5. `delivery_assignments` ใช้กับ canonical orders ได้ทันที; Phase 6 เพิ่ม dispatch UI (อยู่นอกเอกสารนี้ แต่เป็น dependency ของ closing order)

---

# 11. TRACKING MODEL

- `OrderTrackPage` เขียนใหม่ (Phase 5) ให้ **อ่าน canonical orders + order_items + payment_intents + delivery_assignments** ผ่าน RLS — ตัด `useState('preparing')`, auto-advance, hardcode items/ราคา ทิ้งทั้งหมด
- Label/mode ใช้ `serverToClientStatus(server, mode)` ที่มีอยู่แล้ว — **ไม่สร้าง fake state machine ที่สอง**
- แสดงเพิ่ม: วันจัดส่ง/round (PRE_ORDER), สถานะ payment + ปุ่มชำระ, สถานะ assignment ถ้ามี

# 12. CANCELLATION MODEL (canonical, transactional)

**RPC ใหม่ `cancel_order(p_order_number, p_reason)`** — ทุกอย่างใน transaction เดียว (SECURITY DEFINER, authenticated, guard ข้างใน):

| Actor | อนุญาตเมื่อ |
|---|---|
| owner | status='pending' (ทั้งสองโหมด); PRE_ORDER ต้องยังไม่ผ่านวันจัดส่ง + อยู่ใน cancel window (`business_settings.cancel_window_minutes`, default 5 ตาม TermsPage) |
| admin | ทุก non-terminal ก่อน delivered |

ผลข้างเคียงบังคับครบใน RPC เดียว (อะตอมมิก — ตายพร้อมกันทั้งชุด):
1. status → cancelled (ผ่าน allow-list อีกชั้น) · 2. capacity −1 (release trigger §5) · 3. inventory restore ถ้าเคย deduct · 4. payment คงสถานะเดิม (paid → admin ใช้ refund EF เป็นขั้นถัดไป) · 5. batch items queued ถูก exclude โดย query · 6. assignment → cancelled ถ้ามี · 7. append_audit_log

กัน "capacity restored แต่ inventory ไม่ restored": ทั้งคู่อยู่ transaction เดียว ตายพร้อมกัน

# 13. MIGRATION ของ pre_orders เดิม (probe: 1 แถว)

```text
ขั้น 1  แก้ round ให้สอดคล้อง — ensure_rounds_for_date('2026-09-24') แล้ว UPDATE PO-20260919-430
       ให้ชี้ round ของวัน 24 (deterministic id)
ขั้น 2  INSERT canonical orders (order_mode='PRE_ORDER', order_number คงเดิม PO-20260919-430,
       status='pending', scheduled_date=2026-09-24, เงิน 85฿, payment_method='promptpay_qr',
       payment_status='pending', dropoff ตามแถวเดิม) + order_items 1 แถว (prod-5, 85฿, qty 1)
       + pre_orders.migrated_order_id = <order id>
ขั้น 3  ตรึง pre_orders เป็น read-only archive (RLS SELECT-only + comment)
       cancel_pre_order กลายเป็น shim เรียก cancel_order ผ่าน migrated_order_id
```

- **ไม่ DROP** `pre_orders` · `preorder_votes` ไม่ถูกแตะ · PO- numbers ใช้ต่อได้ (order_number เป็น TEXT unique ไม่มี prefix constraint)
- เกณฑ์ deprecate: data migrated ✓ → UI migrated (Phase 5) → tests migrated → runtime verified (Phase 7) → no remaining consumers (grep) → rollback พร้อม (§15) → จึง DEPRECATED (ไม่ DELETE)

# 14. COMPATIBILITY MATRIX (consumer จริงทั้งหมด — grep แล้ว)

| Consumer | Class | แผน |
|---|---|---|
| `preOrderService.createPreOrder` (HomePage/MenuPage) | MIGRATE (Phase 5) | canonical RPC (หรือคง shim ชั่วคราว) |
| `getPreOrders/updatePreOrderStatus/cancelPreOrder` | MIGRATE | อ่าน canonical orders (mode=PRE_ORDER) + cancel_order |
| `OrdersPage` (PO list + labels) | MIGRATE | list เดียวจาก orders + orderVocabulary |
| RPC `create_pre_order_with_items`/`cancel_pre_order`/`quote_pre_order` | DEPRECATE→shim | คงชีวิตเพื่อ rollback; ลบหลัง Phase 7 + owner อนุมัติ |
| `pre_orders` ตาราง + RLS | KEEP (archive read-only) | ไม่ลบตลอด M1 |
| `preorder_votes`/VotePage | KEEP | นอก lifecycle |
| 163 tests ที่ mock pre_orders | MIGRATE | suite ใหม่ + แก้ mock schema |
| `PreOrderStatus`/`PreOrder` types | MIGRATE | ชี้ canonical + vocabulary |
| `PO-` prefix | KEEP | RPC canonical สร้าง `PO-` เมื่อ mode=PRE_ORDER — ย้อนดูได้ทั้งระบบ |

# 15. ROLLBACK STRATEGY

- ทุก migration 023+ **additive**: enum/คอลัมน์ใหม่ default/RPC ใหม่ — มี block `-- ROLLBACK:` ชัดทุกไฟล์ (DROP FUNCTION/TRIGGER/COLUMN ย้อน)
- `pre_orders` + RPC เก่าไม่ถูกลบ/แก้พฤติกรรมจน Phase 7 verify ผ่าน → rollback = ชี้ UI กลับ shim เดิม (จุดเดียว: `preOrderService`), data ไม่สูญ (archive ครบ)
- canonical rows ที่ migrate มี `order_mode='PRE_ORDER'` + `PO-` → rollback ไม่ต้องย้อน data
- ทุก migration รันใน transaction + idempotent (convention ของ repo)

---

# 16. แผน Phase 2–7 (หลัง design ผ่าน)

| Phase | สาระ | เกณฑ์ผ่าน |
|---|---|---|
| 2 — DB/RPC | 023: enum `order_mode` + orders.order_mode/scheduled_date + products.available_* + sync trigger + index · 024: migrate แถวเดียว + archive RLS + `ensure_rounds_for_date` · 025: `create_order_with_items` v3 (mode rules + cutoff + mode gate + capacity/qty cap) + `cancel_order` + release trigger + transition hook คืน capacity | db push ผ่าน + owner SQL suite |
| 3 — Payment/Inventory/Kitchen | 026: deduct aggregate + `ERR_INSUFFICIENT_INGREDIENT` + exact restore + advisory guard ตอน create · 027: batch ดึง canonical สองโหมด + batch_items.order_mode | mock + live probes |
| 4 — Delivery | 028: coords required + 5km tier + เมิน client distance · แก้ client `min_distance_km` 1→0 | boundary tests 0/1/4.99/5/5.01 กม. |
| 5 — PWA | pre-order flow ใหม่ (ที่อยู่จริง + round dropdown จาก DB) · Checkout round dropdown/cutoff display · Payment บน tracking · Tracking อ่าน DB · ปุ่ม Cancel · AdminProducts toggle โหมด | vitest + e2e ต่อยอด 7 steps |
| 6 — Admin/Kitchen | `/admin/kitchen` (queue + สร้าง batch) · admin pre-orders view · dispatch UI (drivers RPC) · Inventory DB-backed + recipe editor | — |
| 7 — LIVE VERIFY | รายงาน A–O ตาม brief §23 + invariants พิสูจน์บน production | — |

# 17. TEST PLAN (แปะ brief §16 เป็นข้อบังคับ)

- **mock (vitest)**: order-mode 4 case (A/B/C/wrong-mode) · cutoff 4 case + timezone · capacity create/concurrent/cancel/payment-fail/pre-order-reserve · inventory shared-ingredient/exact/insufficient/over/cancel-restore · payment duplicate-webhook/amount-mismatch/failed/pre-order·card·promptpay·COD · kitchen pre-order→batch/same-day→batch/date+round separation · delivery 0/1/4.99/5/5.01 · tracking DB→UI
- **owner SQL suite (live)**: `e2e/contracts_023_order_spine.sql` — positive path จริง (สร้าง order ทั้งสองโหมด, rollback ท้าย suite) + negative gates (cutoff/capacity/mode/inventory/delivery)
- **ห้ามอ้าง 163/163 เป็นข้อพิสูจน์** — ทุก invariant (§18) ต้องมี test คู่

# 18. INVARIANTS → จุด enforce

| INV | ข้อความ | Enforce ที่ |
|---|---|---|
| 1 | ไม่ซื้อนอกโหมด | products.available_* + gate ใน RPC (สองทาง) |
| 2 | ไม่สั่งหลัง cutoff | RPC cutoff rule (§6) — ไม่มี path ข้าม |
| 3 | capacity ไม่ติดลบ/ไม่รั่ว | create check + release trigger + GREATEST(0) |
| 4 | ไม่ under-deduct เงียบ | aggregate + ERR_INSUFFICIENT_INGREDIENT (§7) |
| 5 | paid order มี payment relationship | amount-match + idempotency เดิม + SQL suite ตรวจ |
| 6 | production order เข้าครัวได้ | batch ดึง canonical สองโหมด (§9) |
| 7 | delivery data authoritative | coords required + zone rule server (§10) |
| 8 | tracking อ่าน DB | OrderTrackPage ใหม่ ไม่มี timer |
| 9 | lifecycle เดียว | ตาราง/state/RPC เดียว — หลักฐาน: grep runtime path ไม่มี consumer อ่าน `pre_orders` หลัง Phase 5 |

# 19. OPEN DECISIONS (รอ owner — ใช้ default ได้ถ้าไม่ขัด)

| # | คำถามธุรกิจ | Default ที่เสนอ |
|---|---|---|
| D-1 | Capacity = ออเดอร์ หรือ ชิ้น? | **ออเดอร์ + cap 20 ชิ้น/ใบ** (§5 Option A) |
| D-2 | เวลา cutoff canonical? | ใช้ที่ owner แก้ใน AdminRounds — migration ไม่แตะตัวเลข; แนะนำ 08:00/10:30/16:00 ตามเอกสารข้อกำหนด (C-07) |
| D-3 | Pre-order รับ COD? | **ได้** (เก็บปลายทาง) — ถ้าไม่เอา block ใน RPC เมื่อ mode=PRE_ORDER |
| D-4 | Lead time ขั้นต่ำ pre-order? | **1 วัน** — ปรับได้ทาง business_settings |
| D-5 | Cancel window ของ owner? | **5 นาที** (ตาม TermsPage) — ผูก business_settings |

# 20. สิ่งที่งานนี้ไม่ทำ (กัน over-implement)

SaaS/multi-tenant · external courier production APIs · advanced route optimization · AI expansion · loyalty redesign · marketing automation · visual redesign — ทั้งหมดนอกขอบเขต (brief §20); dependency ที่ถูกดึงมีแค่: round template (เพราะ cutoff), client `min_distance_km` 1 บรรทัด (เพราะ canonical delivery), hooks payment/inventory/batch ที่มีอยู่แล้ว

# 21. ARCHITECTURE BLOCKER CHECK

**ไม่พบ blocker** — `pre_orders → orders` ปลอดภัยเพราะ (1) มีแถวเดียว (2) ทุก field map ไปคอลัมน์ที่มีอยู่ (3) archive + shim = rollback สมบูรณ์ (4) payment/batch/delivery infra ออกแบบรอ order_number อยู่แล้ว → pre-order ใช้ infra เดิมได้โดยไม่แตะ downstream เลย

สิ่งที่ต้องการจาก owner ก่อน coding = คำตอบ **D-1…D-5** (default พร้อมใช้ถ้าไม่ขัด)

---

**สถานะ: PHASE 1 ส่งเพื่อตรวจ — ยังไม่แก้ code/DB แม้บรรทัดเดียว · รอ approval + D-1…D-5 ก่อนเริ่ม Phase 2**
