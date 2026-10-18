# BMB_02_RPC_PRODUCTION_AUDIT.md
**Read-only RPC audit (production)** Â· Evidence: `e2e/prod-phase2-audit.json → functions/rpc_grants/function_sources_key` (2026-09-27)

## ภาพรวม

- 103 functions ใน schema public — เกือบทั้งหมด **SECURITY DEFINER** (ตรวจจาก probe functions)
- RPC สำคัญทั้งหมดที่ architecture (Phase 1) อ้าง — **มีอยู่จริงบน production ทั้งหมด:**
  - `create_order_with_items(p_items jsonb, p_delivery_round_id text, p_delivery_method, ...)` — def 13,523 chars Â· refs cutoff ✓ Â· refs max_capacity ✓
  - `transition_order_status` Â· `order_transition_allowed` (มี ELSE fix 030 — ตรวจสอบก่อนหน้า แต่ re-probe ใน JSON)
  - `record_payment_result` (3,221) Â· `create_payment_intent_record` Â· `submit_offline_payment_reference` Â· `confirm_offline_payment` (2,464) Â· `mark_payment_failed`
  - `compute_delivery_fee_rpc` Â· `ensure_rounds_for_date(date)` (2,624) Â· `get_ai_memory`/`save_ai_memory` Â· `append_audit_log` Â· `customer_intelligence` Â· `submit_content_for_approval`/`review_content`

## Enforcement จริงต่อ RPC (จาก body keyword probe)

| Function | มี cutoff logic | มี capacity logic | หมายเหตุ |
|---|---|---|---|
| create_order_with_items | ✓ | ✓ | ศูนย์กลาง order transaction |
| enforce_pre_order_window | ✓ | — | trigger-level |
| ensure_rounds_for_date | ✓ | ✓ | instantiate rounds per date |
| confirm_offline_payment | — | — | admin-gated (is_admin) |
| record_payment_result | — | — | service_role + idempotency |
| transition_order_status | — | — | allow-list + trigger |
| driver_login / driver_accept_assignment / assign_driver | — | — | identity = พารามิเตอร์โทรศัพท์ (ไม่พบ JWT binding) ⚠️ |

## Security หมายเหตุ

- SECURITY DEFINER เกือบทั้งหมด → ต้องพึ่ง validation ภายใน body (ยังไม่ได้อ่าน body เต็มของทั้ง 103 — NOT VERIFIED ระดับ byte)
- EXECUTE grants ราย function (rpc_grants probe ใน JSON) — จุดที่ต้องเช็คชนิดพิเศษ: driver_* / set_menu_schedule / publish_menu_schedule ควรจำกัด admin
- Search path ของแต่ละ function = NOT VERIFIED (ต้อง dump proconfig)


