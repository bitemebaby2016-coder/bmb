# BMB_W4_READINESS_ARCHITECTURE_DEBT_AUDIT.md
**W4 — Readiness / Architecture Debt Audit · วันที่: 2026-09-27 · AUDIT ONLY (no implementation / no migration / no schema change / no provider connection / no production mutation) · Baseline: 09eccd8**

## 1. CUSTOMER PWA — READY (พร้อมใช้งานหลัก) / TECHNICAL DEBT เล็กน้อย

| หัวข้อ | สถานะ | หลักฐาน |
|---|---|---|
| PRE-ORDER vs SAME-DAY separation | READY | delivery_rounds + pre_orders (migr 002/024/038) · `create_pre_order_with_items` RPC แยกจาก same-day · pre-order policy enforcement (038) |
| Menu/category behavior | READY | products/categories + availabilityEngine + weekly menu (039) |
| Canonical order flow | READY | `create_order_with_items` (020/025) — RPC เดียว · client ไม่มี INSERT orders (grep: SELECT-only) |
| Checkout/payment | READY | paymentGateway server-authoritative (008/010/028) · COD เท่านั้นก่อน delivery · Stripe server-only |
| Delivery | READY | bite_drive (020) + delivery sync (036) |
| Status tracking | READY | order_status_history (040) + Tracking UI |
| Error handling | TECHNICAL DEBT (LOW) | errorReporter + system_errors feed มี; UX error states ยังกระจัดกระจายบางจุด |

## 2. ADMIN / COMMAND CENTER — READY / TECHNICAL DEBT

- 19 admin pages / 18 admin routes (orders, kitchen, menu, pricing/promotions, rounds, capacity (pre-orders), delivery, notifications, customers, inventory, settings, audit-log, errors, media, mascot, control, content-approvals, route-optimization)
- Order operations ใช้ transition RPC (server-authoritative) ✓
- DEBT (MEDIUM): ไม่มีหน้า worker-health เฉพาะ; dashboard อ่าน orders ทั้งหมดแบบไม่มี pagination (ADMIN_GAP_MAP บันทึกไว้แล้ว)

## 3. BACKEND CONTRACT — READY

- Canonical RPC: create_order_with_items · create_pre_order_with_items · transition_order_status (+order_transition_allowed) · payment state machine (record_payment_result/confirm_offline_payment/mark_payment_failed · idempotent) · delivery (assign_driver/driver_accept/driver_update_delivery_status) · inventory aggregates (026) · capacity/cutoff (rounds lifecycle 024 · mode controls 039) · source channel F-14 (043/048)
- Postgres = transaction authority; trigger-based history (040); audit (018)
- DEBT (LOW): placeholder EF folders 9 ตัว (ai-daily-report, daily-report, generate-rewards, calculate-promotion, check-inventory, inventory-reorder, random-menu-draw, track-share, vote-menu — ไฟล์ว่าง ไม่ deployed) → ลบหรือ implement ภายหลัง (ไม่มีผล runtime)

## 4. AUTOMATION — READY (PASS ทั้งหมดจาก W3)
- Scheduler (W3-E-1 PASS, runtime verified ต่อเนื่อง) · jobs: notification_dispatch / orders_stale_pending / inventory_low_stock · retries bounded+observable · idempotency durable · audit traces ครบ

## 5. AI BOUNDARY — PASS (INTACT)
- grep AI paths (ai*.ts, ai-proxy EF): **0** รูปแบบ business-write (`.insert( / .update( / transition_order / record_payment / assign_driver`)
- AI = INTELLIGENCE / EXTRACTION / ASSISTANCE เท่านั้น — ไม่มี authority เหนือ price/payment/inventory/capacity/refund/cancellation/delivery fee/order state ✓ (aiGuardrails บังคับอยู่แล้ว)

## 6. ARCHITECTURE DEBT (AUDIT ONLY — ห้ามแก้ทันที)

| ระดับ | รายการ | หลักฐาน |
|---|---|---|
| CRITICAL | — | ไม่พบ (operational correctness ไม่มีช่องโหว่ใหม่จาก audit นี้) |
| HIGH | Backup/DR configuration ยังไม่เปิด (อยู่ใน W3-E-3 owner gate — ไม่ใช่ code debt) | W3-E-3 evidence |
| MEDIUM | (1) realtime-js ถูก stub ออก (bundle) — ถ้าอนาคตต้องใช้ realtime ต้องกลับมาตัดสินใจ (vite alias) (2) 9 placeholder EF folders (3) ไม่มี pagination ใน admin dashboard stats | grep/vite.config/adminUi |
| LOW | TODO ×2 + markers ×5 (จำแนกครบแล้วใน W4-D) · getOrdersByCustomer อ่านเต็มตาราง (RLS ปิดอยู่ — ดู D1/D9 ใน W4-E-0) | grep จริง |

## 7. FROZEN INTEGRATION READINESS (ตรวจเท่านั้น — ไม่เปิด)

| Integration | Readiness |
|---|---|
| Meta (FB/Messenger) | HIGH-READY: channel-webhook + F-14 intake + identity foundation + scheduler พร้อม — เหลือเฉพาะ Meta App/Page config + secrets (Owner) |
| Payment Events | MEDIUM: ไม่มี payment event feed (W3-D STOP ยังคง) — ต้อง Owner decision ก่อนออกแบบ schema/trigger |
| Web Push | MEDIUM: PWA พร้อม; ต้อง VAPID config + push_subscriptions schema + permission UX (Owner decision) |
| Email / SMS / LINE | NOT READY: ไม่มี provider/credentials + transport adapter ต้อง implement (Owner decision ก่อน) |

## 8. SUMMARY

```text
READY:                    Customer PWA core · Admin command center · Backend contract · Automation · AI boundary
BLOCKED:                  Backup/DR enablement (COST GATE — Supabase Pro + PITR add-on; Dashboard-only)
OWNER DECISION:           backup tier/PITR · test project · payment events design · push/email/sms/line providers · placeholder EF cleanup
TECHNICAL DEBT (สถานะ 2026-09-27 หลัง W4-A/B/C/D/E-0): 9 placeholder EFs = REMOVED (W4-B) ·
realtime stub = INTENTIONAL KEEP + dead-code helpers removed (W4-C) · admin pagination = DONE (W4-A) ·
TODO/markers จำแนกครบ + OTP = FROZEN ACCEPT RISK + P1-1 FROZEN + P1-2/3/5 DEFERRED (W4-D) ·
remaining: D1 full-table AI/analytics reads (MEDIUM, safe-cleanup candidate) · D2 admin client-write path (MEDIUM, future) · D9 paged-path unit tests (LOW) — ดู BMB_W4E_ARCHITECTURE_DEBT_AUDIT.md
EVIDENCE:                 grep results + W3 gates ทั้งหมด + Management API + runtime probes (doc นี้และ W3 docs)
NEXT IMPLEMENTATION CANDIDATES (ไม่จัดอันดับ — รอ Owner เลือก):
  1. Enable backups/PITR (Owner, Dashboard) — เหตุผลด่วนสุดตาม W3-E-3
  2. Restore verification (เมื่อมี backup)
  3. Payment events feed design (Owner decision)
  4. Web Push (VAPID + subscription schema)
  5. Placeholder EF cleanup
  6. Admin pagination + worker-health visibility
```

**AUDIT ONLY — ไม่มี implementation/migration/schema/provider ใดเกิดขึ้นในรอบนี้**