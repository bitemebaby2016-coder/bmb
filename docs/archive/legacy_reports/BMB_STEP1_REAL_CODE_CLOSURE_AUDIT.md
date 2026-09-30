# BMB_STEP1_REAL_CODE_CLOSURE_AUDIT

**STEP 1 — REAL CODE CLOSURE AUDIT** (ตาม `BMB_PRODUCTION_CLOSURE_MASTER.md` §6 · Owner เปิด Gate: 2026-09-28)
**โหมด:** READ-ONLY ONLY — ห้ามแก้ code/DB/config/user/artifact · ไม่มี production mutation
**วิธีตรวจ:** (1) source code จริง (EFs + migrations + client) ระบุไฟล์/บรรทัด · (2) runtime probes สด read-only (ไม่สร้าง order / ไม่ mutate) วันที่ตรวจ
**ประเภทผล:** `CODE/CONTRACT VERIFIED` = โค้ด+สัญญาพิสูจน์ด้วยการอ่านจริง · `RUNTIME PROBE VERIFIED` = runtime สด read-only ยืนยัน · `NOT VERIFIED` = ยังไม่มีหลักฐาน · `FINDING` = พบปัญหาต้องจัดการ STEP ถัดไป

## 1. ผลตรวจรายพื้นที่

| # | พื้นที่ | ผล | หลักฐาน |
|---|---|---|---|
| 1 | create-checkout — ตรวจ JWT caller | CODE/CONTRACT VERIFIED | `create-checkout/index.ts:64-85` + probe สด 401 ERR_NOT_AUTHENTICATED |
| 2 | create-checkout — amount re-derived จาก DB | CODE/CONTRACT VERIFIED | header :7-8 + โหลด order ฝั่ง server ด้วย service key — client กำหนดยอดไม่ได้ |
| 3 | create-checkout — กันเก็บซ้ำ (409) | CODE/CONTRACT VERIFIED | :131-133 `payment_status in paid/refunded/partially_refunded` → 409 ERR_ORDER_ALREADY_PAID |
| 4 | create-checkout — single-open-PI reuse | CODE/CONTRACT VERIFIED | :134-161 query open row (`pending,processing`) → GET Stripe → reuse เมื่อ open · *runtime สดรอบนี้ไม่ทำ (สร้าง order = mutation) → ต้อง CONTROLLED TEST ใน STEP 2* |
| 5 | create-checkout — บันทึก PI row | CODE/CONTRACT VERIFIED + **FINDING F1** | :178-205 insert ด้วย service key · **F1: insert fail แค่ console.warn (:204) → รอบถัดไปไม่เจอ open row → สร้าง PI ใหม่ (guard หลุดทางอ้อม)** |
| 6 | stripe-webhook — signature | RUNTIME PROBE VERIFIED | :36-67 HMAC-SHA256 (importKey ถูกต้อง) + window 300s (:50) + probe สด 400 ERR_INVALID_SIGNATURE |
| 7 | stripe-webhook — succeeded/failed → RPC | CODE/CONTRACT VERIFIED | :122-154 `record_payment_result` (completed→paid / failed→failure_reason) · permanent 400 / transient 500 (:73-79) |
| 8 | stripe-webhook — unhandled events | CODE/CONTRACT VERIFIED + **FINDING F2** | :155-157 202 no-op · **F2: refund ผ่าน Stripe Dashboard (`charge.refunded`) ไม่ sync เข้า DB — refund ต้องผ่าน EF เท่านั้น** |
| 9 | stripe-refund — admin-only + idempotent ledger | CODE/CONTRACT VERIFIED | `stripe-refund/index.ts:41-55` PERMANENT errors · :63-68 ledger (refund_ids + refunded_total_minor) · :167-174 cap ไม่เกินยอดจ่าย · :177 Idempotency-Key · probe สด 401 |
| 10 | stripe-refund — persist | CODE/CONTRACT VERIFIED + **FINDING F3** | :221-235 (partial→`partially_refunded` / full→`refund`) · **F3: PI row set `status='refunded'` เสมอ (:226) แม้ partial — PI row ไม่ตรง order payment_status กรณี partial** |
| 11 | payment state machine — allow-list | CODE/CONTRACT VERIFIED | `008:340-346` pending→confirmed→preparing→ready_for_dispatch→dispatched→in_transit→arrived→delivered + →cancelled/failed · `008:353` customer cancel เฉพาะ pending ของตัวเอง · `008:422` ERR_INVALID_TRANSITION |
| 12 | payment state machine — guard trigger | CODE/CONTRACT VERIFIED | `008:362-366` `guard_order_status_transition()` SECURITY DEFINER + `SET search_path = public` |
| 13 | payment RPCs — สิทธิ์ | CODE/CONTRACT VERIFIED + **FINDING F4** | `008:546-552` record_payment_result = service_role เท่านั้น · **F4: `mark_payment_failed` (008:292-299, service_role-only) ไม่มี caller ใน EF ใด (webhook ใช้ record_payment_result) → dead path ต้องตัดสินใจใน STEP 2** |
| 14 | offline payment (PromptPay slip) | CODE/CONTRACT VERIFIED | `008:192-285` submit_offline_payment_reference (customer) + confirm_offline_payment (admin-only :245 · COD ต้อง delivered :261 · PromptPay ต้อง processing) + `013` fix reference casting · real-world ยัง NOT VERIFIED |
| 15 | driver identity binding | CODE/CONTRACT VERIFIED | `041:1-37` drivers.user_id UNIQUE FK auth.users · RPC resolve ด้วย auth.uid() · ไม่ผูก = ERR_NOT_A_DRIVER · RLS scoped read |
| 16 | driver/delivery lifecycle | CODE/CONTRACT VERIFIED | `020:37-43,49-96,152+` upsert_driver / assign_driver / driver_login / driver_accept_assignment / driver_update_delivery_status · haversine + compute_delivery_fee |
| 17 | tracking security (track_order) | RUNTIME PROBE VERIFIED | `050:28-133` (REVOKE SELECT anon, throttle ledger, deny-all RLS) + `051` phone normalization · **probes สด 5/5** |
| 18 | RLS ตาราง PII | RUNTIME PROBE VERIFIED | probe สด: orders/pre_orders/business_settings/order_status_history/drivers = 401 · products/delivery_rounds/promotions = 200 (public โดยตั้งใจ) · S-1 demo cred ยัง 400 |
| 19 | EF deployment guards | RUNTIME PROBE VERIFIED | probe สด: ai-proxy 401 · stripe-webhook 400(sig) · create-checkout 401 · stripe-refund 401 · automation-worker 401 · phone-auto-login 400 · daily-report 404 = ไม่ได้ deploy (DEFERRED, pg_cron FROZEN) |
| 20 | production PWA | RUNTIME PROBE VERIFIED | probe สด prod home 200 |

## 2. สรุปรายการ failure (Master §9) — ระดับที่ STEP 1 พบ

| Failure | ระดับปัจจุบัน | เหลืออะไร |
|---|---|---|
| payment failure (webhook failed) | CODE/CONTRACT | CONTROLLED TEST (STEP 2/6) |
| duplicate/open PI | CODE/CONTRACT (+runtime ประวัติ) | CONTROLLED TEST — พร้อม F1 ต้องแก้ก่อน |
| customer cancellation | CODE/CONTRACT (cancel เฉพาะ pending) | CONTROLLED TEST |
| driver unavailable | CODE/CONTRACT (041 binding) | CONTROLLED TEST |
| delivery failure / reassignment | CODE/CONTRACT | CONTROLLED TEST |
| refund | CODE/CONTRACT (+F3) | CONTROLLED TEST แล้ว REAL-WORLD 1 ครั้งหลัง live (Owner เปิดเอง) |
| offline payment | CODE/CONTRACT | CONTROLLED TEST → REAL-WORLD |

## 3. Findings — รายการที่ต้องตัดสินใจ/แก้ใน STEP ถัดไป (ยังไม่แก้)

- **F1 (สูง):** `create-checkout` insert PI row ล้มเหลวแล้วเงียบ (`:204`) → single-open-PI guard หลุดทางอ้อมเมื่อ insert fail
- **F2 (กลาง):** refund ผ่าน Stripe Dashboard ไม่ sync เข้า DB (unhandled events → 202 no-op)
- **F3 (ต่ำ):** stripe-refund set PI row `status='refunded'` แม้ partial refund
- **F4 (ต่ำ):** `mark_payment_failed` เป็น dead path (ไม่มี caller) — ตัดสินใจว่าจะใช้/ลบ/ให้ caller
- **F5 (ข้อมูล):** `daily-report` ยังไม่ deploy (404) — DEFERRED ตาม pg_cron FROZEN (ไม่ใช่ bug)

## 4. ขอบเขตที่ยังไม่ได้ตรวจ (ของ STEP ถัดไป)

- runtime ของ single-open-PI / cancel / reassign / refund = ต้อง CONTROLLED TEST (สร้าง order → ไม่อนุญาตใน STEP 1)
- real-world payment/refund = หลัง Owner เปิด live (Master §8)
- admin command center / runbook / บัญชีจริง = STEP 3/7

## 5. ข้อสรุปของ STEP 1

```text
AUDIT COMPLETE (read-only) — 20 พื้นที่ตรวจ
CODE/CONTRACT VERIFIED = ครบชุดหลัก (payment / tracking / driver / RLS / state machine)
RUNTIME PROBE VERIFIED (สด ไม่ mutate) = tracking 5/5 · RLS denies · EF guards · PWA 200
NOT VERIFIED (รอ CONTROLLED TEST / live) = single-open-PI runtime · cancel/reassign/refund runtime · offline real-world
FINDINGS = F1-F4 (ยังไม่แก้ — รอ OWNER REVIEW เลือกให้แก้ใน STEP 2)
PRODUCTION MUTATION = NONE
```

**รอ OWNER REVIEW ผล audit นี้ ก่อนเปิด STEP 2 — COMMERCE INTEGRITY**