# BMB STEP 3B-2C — KITCHEN OPERATIONAL CONTROL (IMPLEMENTED + VERIFIED)

**ฐาน:** Owner DECISION อนุมัติ READY_TO_MAKE audit (Option A) · **สถานะเป้าหมาย: 3B-2C CLOSED → HARD STOP**
Base เดิม: `427c789` · มี 3B-2C commit ต่อจากนั้น

---

## 1. READY_TO_MAKE — canonical contract ที่ implement (server-side)

**Authority ใหม่:** migration `054_kitchen_ready_to_make_gate.sql` → RPC `public.order_ready_to_make(p_order_number text) RETURNS jsonb`
· SECURITY DEFINER · `is_admin()`-guarded (non-admin → `ERR_FORBIDDEN`) · **read-only gate ไม่ mutate อะไรเลย** · ใช้ server clock Asia/Bangkok เท่านั้น

| Condition | Required | Authority | Runtime verified? |
|---|---|---|---|
| 1. Order valid, non-terminal, ไม่ cancelled/failed/delivered | ✅ | 054 §1 + 008/030 | ✅ (unit + live eval) |
| 2. status ∈ {confirmed, preparing} เท่านั้น | ✅ | 054 §2 | ✅ (pending→NOT_READY, ready_for_dispatch→NOT_READY) |
| 3a. credit_card → `paid` เท่านั้น | ✅ | 054 §3 | ✅ (pending → PAYMENT_NOT_PAID) |
| 3b. promptpay_qr → `paid` เท่านั้น | ✅ | 054 §3 | ✅ (pending/processing-like → NOT_READY) |
| 3c. cash_on_delivery → `pending`/`paid` OK (ชำระตอนส่ง) | ✅ (Owner §2C) | 054 §3 | ✅ (COD+pending = READY) |
| 3d. refund ทุก method → NOT_READY | ✅ | 054 §3 | ✅ (PAYMENT_REFUNDED) |
| 3e. ห้าม infer COD จาก payment_status — ตรวจ `orders.payment_method` จริง | ✅ (Owner §3) | source field 001/002/035 | ✅ |
| 4. มี order_items (qty>0 + product_id หรือ product_name) | ✅ | 054 §4 | ✅ (EMPTY_ORDER case) |
| 5. product reference valid (FK products) | ✅ | 054 §5 | ✅ (PRODUCT_INVALID case) |
| 6. schedule จาก DB (PRE_ORDER ไม่มี/ย้อนหลัง → NOT_READY) | ✅ | 054 §6 + 025/038 | ✅ |
| 7. capacity/cutoff = server authority, UI display-only | ✅ | 025/028/038 (ไม่แตะ) | ✅ (regression) |
| 8. idempotency: gate = pure read; batch dedup ตาม 028; transition same-state no-op | ✅ | 019/028 | ✅ |

**READY_TO_MAKE = [exact backend conditions]:** order มีอยู่ · status ∈ {confirmed,preparing} · non-terminal · payment ตาม method (card/promptpay → `paid`; COD → `pending`/`paid`; ห้าม `refund` ทุกกรณี) · มี items ผลิตได้ · product FK valid · PRE_ORDER มี scheduled_date และไม่ย้อนหลัง (server clock)
→ คืน `{ready: true|false, reason_code}` — UI แสดง reason ภาษาไทยได้ทันที

**Mapping สถานะ canonical (ไม่เดา):** `orders.payment_status` CHECK ∈ {`pending`,`paid`,`refund`} (migr 035) — สถานะ failed/processing/partially_refunded **ไม่มีอยู่จริงบน orders** → กฎ allow-list ครอบคลุมครบ (ทุกอย่างที่ไม่ใช่ paid/COD-pending = NOT_READY)

## 2. Kitchen flow (Owner §6)

`confirmed → order_ready_to_make() → [🔥 เริ่มทำ] → preparing → [✅ พร้อมส่ง] → ready_for_dispatch`
- ปุ่มยิง **เฉพาะ** `transition_order_status` (008/019/030) — ไม่มี direct UPDATE/force transition
- เริ่มทำ (confirmed→preparing) = ต้องผ่าน gate RPC ก่อน **ทุกครั้ง** (re-check ณ action time)
- ไม่แก้ state machine (Owner §5 — Option B ถูกปฏิเสธ) · `transition_order_status` ยังเป็น sole transition authority

## 3. UI (AdminKitchen.tsx) + libs

- ส่วนใหม่ "👨‍🍳 คิวครัว — Order ที่เข้าสายการผลิต": แบ่ง ⚡SAME_DAY / 📅PRE_ORDER(ถึงรอบ) / 📅PRE_ORDER(รอบหน้า) · group ตาม (scheduled_date, round) เหมือน 3B-2B · badges โหมด/การชำระ/สถานะ
- `src/lib/kitchenQueueView.ts` (pure render mirror): `paymentReadyToMake` / `kitchenGatePreview` / `groupKitchenOrders` / `splitSameDayPreOrder` / `kitchenItemLines` — **ไม่มี cost/unit_price/ข้อมูลซัพพลายเออร์/inventory หลุดเข้าครัว** (เทสต์ยืนยัน)
- `bmbAdminApi_kitchen.ts`: `getOrderReadyToMake()` (pass-through) + `getKitchenPipelineOrders()` (confirmed/preparing/ready + hydrate items)
- ออเดอร์ที่ gate ไม่ผ่าน: แสดง ⛔ เหตุผล, **ไม่มีปุ่มให้กด**; ยังอยู่ในคิวเพื่อ visibility (exception มองเห็น)
- ของเดิมยังอยู่ครบ: batch summary + สร้าง batch (RPC 019/027/028 เดิม ไม่แตะ)

## 4. Security matrix (Phase D)

| กรณี | ผล | หลักฐาน |
|---|---|---|
| anon (PUBLIC) เรียก RPC | ไม่มี EXECUTE | routine_privileges: เฉพาะ authenticated/service_role/postgres |
| authenticated แต่ไม่ใช่ admin | `ERR_FORBIDDEN` | 054 + unit test |
| ห้ามเริ่มทำเมื่อ payment invalid | NOT_READY + ไม่มีปุ่ม | unit test matrix + live eval |
| illegal transition (pending→preparing, ready→preparing, ข้ามสถานะ) | block โดย RPC | regression (008/030 mirror) |
| ไม่มี cost/inventory/supplier ในครัว | ผ่าน | kitchenItemLines test |
| no client authority (clock/cutoff/capacity) | ผ่าน | 054 ใช้ clock_timestamp + 025/038 ไม่แตะ |

## 5. Test + verification ผลรวม (Phase C/D)

- **Vitest: 262/262 PASS (28 files)** ← เดิม 232 + ใหม่ 30 (`kitchenControl.test.ts`: gate matrix 19 + helpers 7 + flow/regression 4) ครบ Owner §9 (SAME_DAY/PRE_ORDER COD, card/promptpay paid, card pending, promptpay pending, failed, cancelled, refunded, non-admin, invalid order, empty order) + regression STEP 2/3A/3B-2A/3B-2B (ชุดเดิมผ่านทั้งหมด)
- **tsc --noEmit: 0 error** · **eslint: 0** · **build: PASS** · **secret scan: CLEAN** (probe อ่าน token จาก env เท่านั้น)
- **Prod (read-only verification):** 054 deployed · function SECURITY DEFINER + grants ถูกต้อง · live gate eval: TEST-001 (confirmed+promptpay+paid) = **READY** · BMB-…-382 (confirmed+promptpay+pending) = **PAYMENT_NOT_PAID** · 8 รายการ ready_for_dispatch = INVALID_ORDER_STATE (ถูกต้อง — ไม่ทำซ้ำ) · empty-order check = ไม่มีรายการว่าง
- **ไม่มี production data mutation** (probe ใช้ SELECT เท่านั้น; ไม่สร้าง test order ใน prod)

## 6. สิ่งที่ยังเหลือ (ไม่บล็อก 3B-2C)

- Runtime end-to-end ด้วย admin JWT จริงใน prod (กดปุ่มจริง) = ต้อง mutation ที่ order จริง → ตาม Owner §10 ทำตอน G-Phase/พร้อมเปิดร้าน (ได้รับอนุมัติเป็นรายกรณี)
- Batch panel ยังแสดงระดับ batch (027/028) — การ wire batch item status (queued→ready) ทยอยใน 3B-2D ได้ถ้า Owner สั่ง

## 7. Git

- commit เดียว: STEP 3B-2C (migration 054 + lib + UI + tests + probe + reports) · push แล้ว · `HEAD == origin/main` · **WORKTREE CLEAN**
- **ROADMAP LOCK:** รอ Owner command — ถัดไป 3B-2D (Dispatch/Driver) → 3B-2E → 3B-3 → 3B-4 → G3–G6 · **ห้ามกระโดด** ไป Reviews/Loyalty/Media/AI/Marketing/BI

## 🔴 HARD STOP — 3B-2C CLOSED
