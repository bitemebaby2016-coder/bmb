# BMB_02_ORDER_SPINE_PRODUCTION.md
**Order spine จาก production DB จริง** · Evidence: `e2e/prod-phase2-audit.json` (orders_cols, order_items_cols, constraints, triggers, data)

## Object จริงที่รองรับ Order Spine

- orders: PK id(text) + order_number · FK customer_ref→profiles · delivery_round_id→delivery_rounds · enum order_mode (SAME_DAY/PRE_ORDER) · scheduled_date · payment_status/payment_method enum · delivery_method enum · is_outside_self_zone · ตัวเลขการเงิน numeric NOT NULL defaults 0
- order_items: order_id→orders.id · product_id→products · unit_price · item_total · customizations jsonb
- payment_intents · delivery_rounds (round_key/display_name/cutoff_time/delivery_start/end/max_capacity/current_count/date) · delivery_zones · drivers · delivery_assignments · provider_orders · production_batches(+items) · pre_orders · loyalty_points · customers · inventory(+transactions) · recipes · promotions · menu_schedule

## State machines (enum จริง)

- order_status: pending→confirmed→preparing→ready_for_dispatch→dispatched→in_transit→arrived→delivered (+cancelled/failed)
- payment_status: pending→paid (+refund/partially_refunded)
- delivery: delivery_assignments.status + provider_orders.status

## Orphans / integrity

- orphan_items=0 · invalid order_mode=0 · PAID-without-PI=2 (test artifacts) · 3/17 orders ไม่มี round (test artifacts)
- **order lifecycle จริงใน production หยุดที่ status pending/confirmed เท่านั้น** (ไม่มี order จริงที่ preparing/ready/dispatched/delivered เลย — จาก data_sanity_orders) → **kitchen/delivery lifecycle ยังไม่เคยรันจริงบน production**

## Trigger guards (จาก probe triggers + function refs)

- order_transition_allowed + BEFORE UPDATE trigger (008/030) · enforce_operating_hours · enforce_menu_gate · enforce_pre_order_window · enforce_pre_order_cancel_window · decrement/increment_delivery_round_count · release_round_capacity_on_terminal · ensure_inventory_deducted_on_confirm

## Authority สรุป

Transaction authority ของ order spine = **PostgreSQL (SECURITY DEFINER RPC + triggers + RLS)** — ตรงหลัก Source of Truth ตาม MASTER COMMAND §33 ✓ (ไม่พบ frontend/external service เป็น authority order)
