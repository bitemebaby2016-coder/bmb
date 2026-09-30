# BMB_02_ORDER_SPINE_PRODUCTION.md
**Order spine à¸ˆà¸²à¸ production DB à¸ˆà¸£à¸´à¸‡** Â· Evidence: `e2e/prod-phase2-audit.json` (orders_cols, order_items_cols, constraints, triggers, data)

## Object à¸ˆà¸£à¸´à¸‡à¸—à¸µà¹ˆà¸£à¸­à¸‡à¸£à¸±à¸š Order Spine

- orders: PK id(text) + order_number Â· FK customer_refâ†’profiles Â· delivery_round_idâ†’delivery_rounds Â· enum order_mode (SAME_DAY/PRE_ORDER) Â· scheduled_date Â· payment_status/payment_method enum Â· delivery_method enum Â· is_outside_self_zone Â· à¸•à¸±à¸§à¹€à¸¥à¸‚à¸à¸²à¸£à¹€à¸‡à¸´à¸™ numeric NOT NULL defaults 0
- order_items: order_idâ†’orders.id Â· product_idâ†’products Â· unit_price Â· item_total Â· customizations jsonb
- payment_intents Â· delivery_rounds (round_key/display_name/cutoff_time/delivery_start/end/max_capacity/current_count/date) Â· delivery_zones Â· drivers Â· delivery_assignments Â· provider_orders Â· production_batches(+items) Â· pre_orders Â· loyalty_points Â· customers Â· inventory(+transactions) Â· recipes Â· promotions Â· menu_schedule

## State machines (enum à¸ˆà¸£à¸´à¸‡)

- order_status: pendingâ†’confirmedâ†’preparingâ†’ready_for_dispatchâ†’dispatchedâ†’in_transitâ†’arrivedâ†’delivered (+cancelled/failed)
- payment_status: pendingâ†’paid (+refund/partially_refunded)
- delivery: delivery_assignments.status + provider_orders.status

## Orphans / integrity

- orphan_items=0 Â· invalid order_mode=0 Â· PAID-without-PI=2 (test artifacts) Â· 3/17 orders à¹„à¸¡à¹ˆà¸¡à¸µ round (test artifacts)
- **order lifecycle à¸ˆà¸£à¸´à¸‡à¹ƒà¸™ production à¸«à¸¢à¸¸à¸”à¸—à¸µà¹ˆ status pending/confirmed à¹€à¸—à¹ˆà¸²à¸™à¸±à¹‰à¸™** (à¹„à¸¡à¹ˆà¸¡à¸µ order à¸ˆà¸£à¸´à¸‡à¸—à¸µà¹ˆ preparing/ready/dispatched/delivered à¹€à¸¥à¸¢ â€” à¸ˆà¸²à¸ data_sanity_orders) â†’ **kitchen/delivery lifecycle à¸¢à¸±à¸‡à¹„à¸¡à¹ˆà¹€à¸„à¸¢à¸£à¸±à¸™à¸ˆà¸£à¸´à¸‡à¸šà¸™ production**

## Trigger guards (à¸ˆà¸²à¸ probe triggers + function refs)

- order_transition_allowed + BEFORE UPDATE trigger (008/030) Â· enforce_operating_hours Â· enforce_menu_gate Â· enforce_pre_order_window Â· enforce_pre_order_cancel_window Â· decrement/increment_delivery_round_count Â· release_round_capacity_on_terminal Â· ensure_inventory_deducted_on_confirm

## Authority à¸ªà¸£à¸¸à¸›

Transaction authority à¸‚à¸­à¸‡ order spine = **PostgreSQL (SECURITY DEFINER RPC + triggers + RLS)** â€” à¸•à¸£à¸‡à¸«à¸¥à¸±à¸ Source of Truth à¸•à¸²à¸¡ MASTER COMMAND Â§33 âœ“ (à¹„à¸¡à¹ˆà¸žà¸š frontend/external service à¹€à¸›à¹‡à¸™ authority order)
