# BMB STEP 3B-2C — READY_TO_MAKE CONTRACT AUDIT (OWNER ADDENDUM COMPLIANCE)

**สถานะ: HARD STOP — รอ Owner decision ก่อน implement**
Base: `427c789` (HEAD == origin/main) · WORKTREE มีเฉพาะไฟล์ audit นี้ + `e2e/ct-3b2c-kitchen-probe.cjs` (read-only) — **ยังไม่ commit** (ตามแบบ 3B-1: evidence รอ Owner)

---

## 1. Authority ปัจจุบันกระจายอยู่ที่ไหน (จาก source + production read-only)

| # | Authority | ไฟล์ | ครอบคลุมอะไร | ขาดอะไร |
|---|---|---|---|---|
| A1 | State machine | migr 008 §C.1 + 030 (ELSE fix) | allow-list `confirmed→preparing→ready_for_dispatch` + terminal lock | **ไม่ตรวจ payment** |
| A2 | Transition RPC | migr 019 §9b `transition_order_status` | auth + allow-list + INV-01 deduct@confirm/restore@cancel + audit | **ไม่ตรวจ payment/schedule** |
| A3 | Batch RPC | migr 028 §2 `create_production_batch` | `is_admin()` + round/date/mode + status ∈ {confirmed, preparing} + **idempotent ต่อ order ต่อ round+date** (NOT EXISTS) | **ไม่ตรวจ payment** (status-only) |
| A4 | Commercial authority | migr 008/010/028 `record_payment_result` (webhook, idempotent) + `confirm_offline_payment` (COD→delivered / PromptPay→TXN) | `orders.payment_status` = canonical commercial state | ไม่มีสิ่งนี้เชื่อมกับ kitchen gate |
| A5 | Schedule/cutoff | migr 025 (cutoff authority Asia/Bangkok) + 038 (PRE_ORDER 2h cutoff + cancel window) | บังคับ**ตอนสร้าง/ยกเลิก** order | ไม่มี gate "ถึงเวลาทำได้แล้ว" ฝั่งครัว |

**Production probe (read-only, `ct-3b2c-kitchen-probe.cjs`):** kitchen RPCs 7/7 present · batch/batch_items schema ครบ (order_mode snapshot) · orphan batch→order linkage = **0** · batches ปัจจุบัน = 0 แถว · pipeline live: confirmed 2 (pending 1 / paid 1) · ready_for_dispatch 8 · cancelled 29
→ **สรุป: ปัจจุบันไม่มี single canonical predicate/RPC สำหรับ READY_TO_MAKE** — authority กระจายใน A1–A5

## 2. Contract ที่ตรวจพบ (ตาม format ที่ Owner กำหนด)

| Condition | Required (ADDENDUM) | Authority ปัจจุบัน | Runtime verified? |
|---|---|---|---|
| 1. Order valid + non-terminal | ต้องมี | A1 (008/030) + trigger | ✅ prod (guard live, 29 cancelled locked) |
| 2. Payment = paid เท่านั้น (ยกเว้น canonical ที่ระบบรองรับ) | ต้องมี | A4 มี payment_state แต่ **A1/A2/A3 ไม่ enforce** | ❌ ไม่มี server gate |
| 3. status = confirmed → preparing เท่านั้น | ต้องมี | A1+A2 | ✅ (RPC reject illegal) |
| 4. Order content (items/qty/addons) | ต้องมี | order_items snapshot (migr 016/025) + 027 batch snapshot | ✅ (schema) / UI ยังไม่แสดง |
| 5. Product validity | ต้องมี | products FK + create-time guards | ✅ ตอนสร้าง (ไม่มี re-check ตอน kitchen — ไม่สร้างกฎใหม่) |
| 6. Schedule: PRE_ORDER ตาม round/cutoff | ต้องมี | A5 server-side (038) ตอนสร้าง | ✅ ตอนสร้าง / ❌ ไม่มี "ถึงเวลาทำ" gate |
| 7. Capacity/round display-only | ต้องมี | A3+A5 | ✅ (028 idempotent + 025 lock) |
| 8. Idempotency Start Preparing ซ้ำ | ต้องมี | A3 (NOT EXISTS per order/round/date) + transition same-state no-op | ✅ ตามโค้ด 028 |

## 3. CONFLICT ที่ทำให้ต้อง HARD STOP (business-rule change — ห้ามแก้เอง)

**กฎ Owner ADDENDUM: "ห้ามเริ่มทำเมื่อ payment pending" ขัดกับ canonical rule ที่มีอยู่จริง:**

1. **COD (`cash_on_delivery`)**: ตาม `confirm_offline_payment` (migr 008/013) COD จะถูก mark paid **หลัง delivered เท่านั้น** → ถ้า kitchen block pending ทุกกรณี = **COD ทำอาหารไม่ได้ตลอดไป** (ร้านรับ order จริงไม่ได้เลยสำหรับ COD)
2. **ข้อมูล production จริง**: มี order confirmed + payment pending อยู่ 2 รายการ (TEST/QA) — กฎใหม่จะ block ทันที
3. การ enforce = ต้องแก้ `transition_order_status` (019) หรือ `create_production_batch` (028) หรือสร้าง RPC ใหม่ = **RPC contract / business rule change** ซึ่ง ADDENDUM สั่งว่า "HARD STOP รอ Owner หากต้องเปลี่ยน business rule/schema/RPC contract"

## 4. Minimal canonical implementation ที่เสนอ (รอ Owner เลือก)

**ตัวเลือก A (แนะนำ — เพิ่ม, ไม่แก้ของเดิม):** Migration 054 สร้าง RPC เดียว
`public.order_ready_to_make(p_order_number text) RETURNS jsonb` — SECURITY DEFINER, `is_admin()`-guarded, ใช้ server clock (`clock_timestamp()` เท่านั้น ไม่แตะ client time):
```
READY_TO_MAKE =
  order exists
  AND status NOT IN ('cancelled','failed','delivered')     -- non-terminal
  AND status IN ('confirmed','preparing')                   -- canonical prep window
  AND payment_ok := payment_status = 'paid'
        OR (payment_method = 'cash_on_delivery'            -- canonical COD rule (settled at delivery)
            AND payment_status NOT IN ('failed','refund','partially_refunded','refunded'))
  AND EXISTS (order_items ของ order)                         -- content non-empty
  AND (order_mode = 'SAME_DAY' OR scheduled_date + round ตาม DB)  -- schedule จาก DB
  AND idempotency: batch dedup ตาม 028
```
→ Kitchen UI เรียก RPC นี้เป็น gate ก่อนแสดง/กดปุ่ม (server ตัดสิน ไม่ใช่ display fields) · ปุ่มยังคงยิง `transition_order_status` + `create_production_batch` เดิม (ไม่ bypass)

**ตัวเลือก B (แก้ของเดิม — ระวังกว่า):** ใส่ payment check ตรงใน `transition_order_status` (block confirmed→preparing เมื่อ unpaid) + `create_production_batch` — กระทบ caller ทุกตัวที่ใช้ RPC เดิม

**คำถาม Owner ต้องตัดสิน (3 ข้อ):**
1. เลือก **ตัวเลือก A** (RPC ใหม่ 054) หรือ **B** (แก้ RPC เดิม)?
2. **COD policy**: ยืนยันว่า COD ทำอาหารได้ก่อนชำระเงิน (ชำระตอนส่ง ตาม canonical rule) — หรือ block COD ด้วย (ร้านจะรับ COD ไม่ได้)?
3. PromptPay/credit **payment pending** ที่ยังไม่ยืนยัน: ยืนยัน block จริง (ตาม ADDENDUM) — ระบบต้องรอ webhook/confirm ก่อนครัวเริ่ม?

## 5. สิ่งที่ยังไม่ได้ทำ (รอ decision)

- Kitchen order-queue UI + Start Preparing / Mark Ready (ปุ่ม canonical) — ออกแบบไว้แล้ว รอ gate จากข้อ 4
- เทสต์ Phase D · prod runtime verification ของ gate ใหม่ · commit/push

## 🔴 HARD STOP
**3B-2C = BLOCKED (รอ Owner decision ตาม ADDENDUM §4)** — ไม่มี code/migration/commit/push · production ไม่ถูก mutate (probe read-only เท่านั้น)
