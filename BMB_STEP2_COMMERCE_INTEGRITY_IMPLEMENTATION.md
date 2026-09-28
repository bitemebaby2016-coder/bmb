# BMB_STEP2_COMMERCE_INTEGRITY_IMPLEMENTATION

**STEP 2 — COMMERCE INTEGRITY** (ตาม `BMB_PRODUCTION_CLOSURE_MASTER.md` §6 · Owner เปิด Gate: 2026-09-28)
**โหมด:** IMPLEMENTATION — แก้ code ตาม findings F1-F4 จาก STEP 1 + CONTROLLED TEST runtime
**ขอบเขต:** แก้ F1-F4 + runtime verify single-open-PI / cancel / reassign / refund (ไม่ใช้เงินจริง)

---

## 1. Findings จาก STEP 1 ที่ต้องแก้ใน STEP 2

| Finding | ระดับ | ไฟล์ | ปัญหา | แผนแก้ |
|---------|-------|-------|-------|--------|
| **F1** | สูง | `create-checkout/index.ts:178-205` | Insert PI row ล้มเหลวแล้วเงียบ (`console.warn`) → guard หลุดทางอ้อม | Throw error แทน warn + return 500/409 เพื่อไม่ให้สร้าง PI ใหม่ซ้ำ |
| **F2** | กลาง | `stripe-webhook/index.ts:155-157` | `charge.refunded` (refund ผ่าน Dashboard) ไม่ sync เข้า DB → unhandled = 202 no-op | เพิ่ม handler สำหรับ `charge.refunded` เรียก RPC sync refund |
| **F3** | ต่ำ | `stripe-refund/index.ts:226` | PI row set `status='refunded'` เสมอแม้ partial refund | Set `status='partially_refunded'` เมื่อ partial, `'refunded'` เมื่อ full |
| **F4** | ต่ำ | `008_payment_state_machine_and_phase_d.sql:292-299` | `mark_payment_failed` เป็น dead path (ไม่มี caller) | ตัดสินใจ: (A) ลบ, (B) ให้ webhook เรียกเมื่อ failed, (C) คงไว้ admin manual — **Owner ตัดสินใจ** |

---

## 2. Implementation Plan

### Phase 2A: Fix F1 — create-checkout PI insert failure handling
- [x] แก้ `create-checkout/index.ts` lines 203-205: throw error แทน `console.warn`
- [x] Return proper error response (500) เพื่อ client retry ได้

### Phase 2B: Fix F2 — stripe-webhook handle charge.refunded
- [x] เพิ่ม case `charge.refunded` ใน switch event.type
- [x] เรียก RPC ใหม่หรือ reuse `record_payment_result` พร้อม p_status='refunded'
- [x] ต้องมี idempotency (payment_intent_id unique index มีแล้ว)
- [x] Handle full vs partial refund correctly (nextPiStatus / nextOrderPaymentStatus)

### Phase 2C: Fix F3 — stripe-refund PI status accuracy
- [x] แก้ line 226: `status: refundedTotal >= chargedMinor ? 'refunded' : 'partially_refunded'`
- [x] ตรงกับ order payment_status logic (line 221)

### Phase 2D: Fix F4 — mark_payment_failed decision
- [x] Owner review: **Option A - ลบ (Delete)**
- [x] Removed RPC function from migration 008
- [x] Removed GRANT/REVOKE statements
- [x] Removed frontend functions (paymentGateway.ts, bmbAdminApi_orders.ts)
- [x] Removed Admin UI button and handler (AdminOrders.tsx)
- [x] Updated tests (paymentStateMachine.test.ts, supabaseMock.ts, sqlContracts.cjs)

### Phase 2E: CONTROLLED TEST Runtime Verification
- [ ] Test single-open-PI reuse (สร้าง order → create-checkout 2 ครั้ง)
- [ ] Test customer cancellation (pending → cancelled)
- [ ] Test driver reassignment flow
- [ ] Test refund flow (full + partial) via stripe-refund EF
- [ ] Test offline payment flow (PromptPay reference submit + admin confirm)

---

## 3. Evidence Checklist (ต่อจาก STEP 1)

| รายการ | STEP 1 | STEP 2 Target |
|---------|--------|---------------|
| create-checkout JWT + amount re-derive | ✅ CODE/CONTRACT | ✅ + runtime |
| create-checkout duplicate guard (409) | ✅ CODE/CONTRACT | ✅ + runtime |
| create-checkout single-open-PI reuse | ✅ CODE/CONTRACT | ✅ runtime CONTROLLED TEST |
| create-checkout PI insert (F1) | ✅ + **F1** | **FIXED + runtime** |
| stripe-webhook signature | ✅ RUNTIME PROBE | ✅ |
| stripe-webhook succeeded/failed → RPC | ✅ CODE/CONTRACT | ✅ + runtime |
| stripe-webhook charge.refunded (F2) | **F2** | **FIXED + runtime** |
| stripe-refund admin + ledger | ✅ CODE/CONTRACT | ✅ + runtime |
| stripe-refund PI status (F3) | **F3** | **FIXED + runtime** |
| payment state machine allow-list | ✅ CODE/CONTRACT | ✅ + runtime |
| payment state machine guard trigger | ✅ CODE/CONTRACT | ✅ + runtime |
| payment RPCs permissions | ✅ + **F4** | **F4 DECIDED + runtime** |
| offline payment (PromptPay) | ✅ CODE/CONTRACT | ✅ runtime CONTROLLED TEST |
| driver identity binding | ✅ CODE/CONTRACT | ✅ |
| driver/delivery lifecycle | ✅ CODE/CONTRACT | ✅ runtime CONTROLLED TEST |
| tracking security | ✅ RUNTIME PROBE | ✅ |
| RLS PII tables | ✅ RUNTIME PROBE | ✅ |
| EF deployment guards | ✅ RUNTIME PROBE | ✅ |
| production PWA | ✅ RUNTIME PROBE | ✅ |

---

## 4. Status Tracking

```text
STEP 2 STARTED: 2026-09-28 (Owner Gate Opened)
PHASE 2A (F1): [x] DONE - create-checkout PI insert error handling
PHASE 2B (F2): [x] DONE - stripe-webhook charge.refunded handler
PHASE 2C (F3): [x] DONE - stripe-refund PI status accuracy
PHASE 2D (F4): [x] DONE - mark_payment_failed removed (Owner Option A)
PHASE 2E (RUNTIME TESTS): [ ] PENDING (requires CONTROLLED TEST setup)
STEP 2 COMPLETE: [x] CODE FIXES COMPLETE
OWNER GATE FOR STEP 3: [ ] PENDING
```

---

## 5. สถานะปัจจุบัน

**รอเริ่ม Phase 2A: Fix F1** — เริ่มแก้ `create-checkout/index.ts` insert failure handling