# BMB_02_ORDER_SPINE_PRODUCTION.md
**Order spine จาก production DB จริง** Â· Evidence: `e2e/prod-phase2-audit.json` (orders_cols, order_items_cols, constraints, triggers, data)

## Object จริงที่รองรับ Order Spine

- orders: PK id(text) + order_number Â· FK customer_ref→profiles Â· delivery_round_id→delivery_rounds Â· enum order_mode (SAME_DAY/PRE_ORDER) Â· scheduled_date Â· payment_status/payment_method enum Â· delivery_method enum Â· is_outside_self_zone Â· ตัวเลขการเงิน numeric NOT NULL defaults 0
- order_items: order_id→orders.id Â· product_id→products Â· unit_price Â· item_total Â· customizations jsonb
- payment_intents Â· delivery_rounds (round_key/display_name/cutoff_time/delivery_start/end/max_capacity/current_count/date) Â· delivery_zones Â· drivers Â· delivery_assignments Â· provider_orders Â· production_batches(+items) Â· pre_orders Â· loyalty_points Â· customers Â· inventory(+transactions) Â· recipes Â· promotions Â· menu_schedule

## State machines (enum จริง)

- order_status: pending→confirmed→preparing→ready_for_dispatch→dispatched→in_transit→arrived→delivered (+cancelled/failed)
- payment_status: pending→paid (+refund/partially_refunded)
- delivery: delivery_assignments.status + provider_orders.status

## Orphans / integrity

- orphan_items=0 Â· invalid order_mode=0 Â· PAID-without-PI=2 (test artifacts) Â· 3/17 orders ไม่มี round (test artifacts)
- **order lifecycle จริงใน production หยุดที่ status pending/confirmed เท่านั้น** (ไม่มี order จริงที่ preparing/ready/dispatched/delivered เลย — จาก data_sanity_orders) → **kitchen/delivery lifecycle ยังไม่เคยรันจริงบน production**

## Trigger guards (จาก probe triggers + function refs)

- order_transition_allowed + BEFORE UPDATE trigger (008/030) Â· enforce_operating_hours Â· enforce_menu_gate Â· enforce_pre_order_window Â· enforce_pre_order_cancel_window Â· decrement/increment_delivery_round_count Â· release_round_capacity_on_terminal Â· ensure_inventory_deducted_on_confirm

## Authority สรุป

Transaction authority ของ order spine = **PostgreSQL (SECURITY DEFINER RPC + triggers + RLS)** — ตรงหลัก Source of Truth ตาม MASTER COMMAND Â§33 ✓ (ไม่พบ frontend/external service เป็น authority order)
