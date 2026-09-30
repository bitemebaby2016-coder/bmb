# BMB STEP 3B-2E — PAYMENT EXCEPTIONS

**ฐาน:** `0136dd2` (3B-2D closed) · สถานะเป้าหมาย: 3B-2E CLOSED → HARD STOP

---

## 1. AUDIT สถานะจริง (Production probe read-only `ct-3b2e-payment-probe.cjs` + Code + Migrations)

| รายการ | สถานะจริง |
|---|---|
| Canonical vocabulary (ไม่เดา) | `orders.payment_status` CHECK ∈ **pending / paid / refund / partially_refunded** (migration 001 §CHECK — 035 ยืนยัน column) · `orders.payment_method` ∈ promptpay_qr / credit_card / cash_on_delivery · `payment_intents.status` ∈ pending / processing / completed / failed / refunded / partially_refunded (prod data ยืนยัน) |
| Payment authority | **webhook** (stripe-webhook EF) → `record_payment_result` RPC (idempotent, amount-matched, live 5/5 RPCs) · **admin offline confirm** → `confirm_offline_payment` (COD→delivered / PromptPay→TXN) · **refund** → **stripe-refund EF** (admin-only, Stripe Idempotency-Key = bmb-refund-\<order\>-\<amountMinor\>, ledger ใน `payment_intents.metadata.refunded_total_minor` + refund_ids, ห้ามเกินยอด, ERR_NOT_CARD_PAYMENT / ERR_NOT_PAID / ERR_REFUND_ALREADY_EXISTS) |
| Prod distribution (read-only) | orders: pending promptpay 150 / pending card 11 / pending COD 2 / paid promptpay 4 / paid card 26 / refund card 8 / **partially_refunded 1** · intents: pending 14 / processing 3 / completed 30 / refunded 8 / partially_refunded 1 |
| Webhook inconsistency (order pending + intent completed) | **0 รายการ** บน prod — canonical wiring สมบูรณ์ |
| Stale unpaid >24h (non-COD) | 15+ รายการ (ชุด QA 2026-09-27) — เห็นผ่าน view ใหม่ |
| RLS | orders: own_read/own_update/own_create + admin_manage (RLS on) · payment_intents: own SELECT + anon create-checkout policy (มีอยู่เดิมตาม create-checkout flow — ไม่แตะ) · ไม่มี credential column ใน payment_intents (client_secret เท่านั้น, ไม่แสดงใน UI) |
| Admin payment UI เดิม | AdminOrders มี payment badge + confirmOfflinePayment (canonical) อยู่แล้ว · **ไม่มีหน้ารวม payment exceptions** → สิ่งที่ implement ใน step นี้ |

**ไม่มี payment-authority conflict / ไม่มี schema conflict → ไม่ต้อง HARD STOP** · ข้อสังเกต: 054 (3B-2C) comment ว่า "partially_refunded ไม่มี" ไม่เป็นจริงตาม 001 CHECK — แต่ logic allow-list ของ gate ถูกต้องอยู่แล้ว (ไม่ใช่ paid → NOT_READY) จึงไม่แก้ gate (แค่ document)

## 2. EXCEPTION DEFINITION (จาก contract จริง ไม่ประดิษฐ์)

| Kind | แหล่ง canonical | attention |
|---|---|---|
| WEBHOOK_MISMATCH | order `pending` + intent `completed` (เหตุการณ์ inconsistency จริงที่ 010/028 ป้องกัน) | ✅ |
| MISSING_INTENT | pending non-COD ไม่มี intent ใด | ✅ |
| STALE_UNPAID | pending non-COD >24ชม. (display threshold เท่านั้น ไม่ใช่กฎใหม่) | ✅ |
| PENDING_UNPAID | pending + intent pending | ✅ |
| PROCESSING | intent `processing` | ✅ |
| INTENT_FAILED | intent `failed` (+failure_reason) | ✅ |
| PARTIAL_REFUND | orders `partially_refunded` (canonical 001) | ✅ |
| REFUNDED | orders `refund` | ✅ |
| OK_COD_AWAITED / OK_PAID | COD pending ปกติ / paid | ไม่ใช่ exception |

## 3. IMPLEMENTATION (smallest useful surface — READ-ONLY)

1. **`src/lib/paymentExceptions.ts`** (pure classification + 2 read helpers): `classifyPaymentException(order, intents)` จาก canonical columns เท่านั้น · `getPaymentExceptionOrders()` (orders .in payment_status pending/refund/partially_refunded, limit 200) · `getPaymentIntentsFor()` · `groupPaymentExceptions()` — **ไม่มี mutation path เลย**
2. **`AdminPaymentExceptions.tsx`** (`/admin/payment-exceptions`, AdminRoute + AdminNav "Payments"): ตารางกลุ่มตาม §7 (order, mode, สถานะ order, วิธีชำระ, สถานะชำระ, จำนวน, อ้างอิง provider/payment_intent_id ตัดสั้น, updated timestamp) · ปุ่มเดียว = รีเฟรช (อ่านจาก source จริงทุกครั้ง) + ลิงก์ไป Admin Orders ที่ canonical actions อยู่ · **ไม่ mark paid / ไม่แก้ status / ไม่ยิง refund / ไม่มี optimistic fake state**
3. **ไม่แตะ**: webhook, record_payment_result, confirm_offline_payment, stripe-refund EF, payment_intents RLS, create-checkout — ทุกอย่างคงเดิม

## 4. ORDER INTEGRITY / KITCHEN (Owner §8-9)

- ไม่สร้าง payment-order lifecycle ใหม่ · UI ไม่เขียน orders.status อะไรเลย (read-only)
- `order_ready_to_make()` ยังเป็น authority: regression test ยืนยัน partially_refunded→NOT_READY, COD+pending→READY, paid→READY (3B-2C contract ไม่ถูก bypass — UI ใหม่ไม่มีปุ่มใด ๆ)
- **ไม่มี audit event ใหม่** (view-only — ตาม §11 ไม่ประดิษฐ์ write-side event)

## 5. TEST + GATE ผลรวม (ตัวเลขจริง)

- **Vitest: 292/292 PASS (30 files)** = เดิม 276 + ใหม่ 16 (`paymentExceptions.test.ts`: matrix 13 + read/integrity/regression 3 — รวม record_payment_result idempotent replay + 3B-2C gate vocabulary + 3B-2D mocks)
- **tsc --noEmit: 0** · **eslint .: 0** · **build: PASS** · **secret scan: CLEAN (0 hits)**
- **Production evidence (read-only):** vocabulary/prod distribution ตาม §1 · ไม่มี mutation ใดบน prod · จัดระดับ: **IMPLEMENTED + CONNECTED + DEPLOYED (view) + CONTROLLED TEST VERIFIED** · **REAL-WORLD VERIFIED = ไม่อ้าง** (ข้อมูล prod จริงถูกใช้ตรวจ classification แล้ว = RUNTIME VERIFIED ฝั่ง READ เท่านั้น)

## 6. Refund capability (Owner §6)

- **CONNECTED / DEPLOYED** แล้วเดิม: stripe-refund EF (admin, idempotent, ledger, card-only, ห้ามเกินยอด, ตรวจ order paid/partially_refunded) — UI ใหม่ "ไม่แตะ" และไม่ยิง refund จริงใน gate นี้ · duplicate/already-refunded behavior = ERR_REFUND_ALREADY_EXISTS (EF code, DOCUMENTED; เทสต์ EF จริง = ต้อง real-money → DEFERRED ตาม §13)

## 7. Gaps จาก 3B-2D (Owner §16) — ไม่แตะ ไม่ resolve เอง

assign_driver active-status validation · reassignment หลัง picked_up · auto reassign — คงเป็น GAP/DEFERRED ตามเดิม (3B-2E ไม่มี dependency)

## 8. Git

- commit เดียว STEP 3B-2E · push แล้ว · HEAD == origin/main · WORKTREE CLEAN

## 🔴 HARD STOP — รอ Owner command (roadmap: Menu/Catalog AUDIT (§17 — ต้องทำ dedicated audit ก่อน) / 3B-3 Dashboard / 3B-4 Daily Ops → G3–G6; ห้ามกระโดด)
