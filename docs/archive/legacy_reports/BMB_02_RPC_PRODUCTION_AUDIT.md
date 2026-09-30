# BMB_02_RPC_PRODUCTION_AUDIT.md
**Read-only RPC audit (production)** Â· Evidence: `e2e/prod-phase2-audit.json â†’ functions/rpc_grants/function_sources_key` (2026-09-27)

## à¸ à¸²à¸žà¸£à¸§à¸¡

- 103 functions à¹ƒà¸™ schema public â€” à¹€à¸à¸·à¸­à¸šà¸—à¸±à¹‰à¸‡à¸«à¸¡à¸” **SECURITY DEFINER** (à¸•à¸£à¸§à¸ˆà¸ˆà¸²à¸ probe functions)
- RPC à¸ªà¸³à¸„à¸±à¸à¸—à¸±à¹‰à¸‡à¸«à¸¡à¸”à¸—à¸µà¹ˆ architecture (Phase 1) à¸­à¹‰à¸²à¸‡ â€” **à¸¡à¸µà¸­à¸¢à¸¹à¹ˆà¸ˆà¸£à¸´à¸‡à¸šà¸™ production à¸—à¸±à¹‰à¸‡à¸«à¸¡à¸”:**
  - `create_order_with_items(p_items jsonb, p_delivery_round_id text, p_delivery_method, ...)` â€” def 13,523 chars Â· refs cutoff âœ“ Â· refs max_capacity âœ“
  - `transition_order_status` Â· `order_transition_allowed` (à¸¡à¸µ ELSE fix 030 â€” à¸•à¸£à¸§à¸ˆà¸ªà¸­à¸šà¸à¹ˆà¸­à¸™à¸«à¸™à¹‰à¸² à¹à¸•à¹ˆ re-probe à¹ƒà¸™ JSON)
  - `record_payment_result` (3,221) Â· `create_payment_intent_record` Â· `submit_offline_payment_reference` Â· `confirm_offline_payment` (2,464) Â· `mark_payment_failed`
  - `compute_delivery_fee_rpc` Â· `ensure_rounds_for_date(date)` (2,624) Â· `get_ai_memory`/`save_ai_memory` Â· `append_audit_log` Â· `customer_intelligence` Â· `submit_content_for_approval`/`review_content`

## Enforcement à¸ˆà¸£à¸´à¸‡à¸•à¹ˆà¸­ RPC (à¸ˆà¸²à¸ body keyword probe)

| Function | à¸¡à¸µ cutoff logic | à¸¡à¸µ capacity logic | à¸«à¸¡à¸²à¸¢à¹€à¸«à¸•à¸¸ |
|---|---|---|---|
| create_order_with_items | âœ“ | âœ“ | à¸¨à¸¹à¸™à¸¢à¹Œà¸à¸¥à¸²à¸‡ order transaction |
| enforce_pre_order_window | âœ“ | â€” | trigger-level |
| ensure_rounds_for_date | âœ“ | âœ“ | instantiate rounds per date |
| confirm_offline_payment | â€” | â€” | admin-gated (is_admin) |
| record_payment_result | â€” | â€” | service_role + idempotency |
| transition_order_status | â€” | â€” | allow-list + trigger |
| driver_login / driver_accept_assignment / assign_driver | â€” | â€” | identity = à¸žà¸²à¸£à¸²à¸¡à¸´à¹€à¸•à¸­à¸£à¹Œà¹‚à¸—à¸£à¸¨à¸±à¸žà¸—à¹Œ (à¹„à¸¡à¹ˆà¸žà¸š JWT binding) âš ï¸ |

## Security à¸«à¸¡à¸²à¸¢à¹€à¸«à¸•à¸¸

- SECURITY DEFINER à¹€à¸à¸·à¸­à¸šà¸—à¸±à¹‰à¸‡à¸«à¸¡à¸” â†’ à¸•à¹‰à¸­à¸‡à¸žà¸¶à¹ˆà¸‡ validation à¸ à¸²à¸¢à¹ƒà¸™ body (à¸¢à¸±à¸‡à¹„à¸¡à¹ˆà¹„à¸”à¹‰à¸­à¹ˆà¸²à¸™ body à¹€à¸•à¹‡à¸¡à¸‚à¸­à¸‡à¸—à¸±à¹‰à¸‡ 103 â€” NOT VERIFIED à¸£à¸°à¸”à¸±à¸š byte)
- EXECUTE grants à¸£à¸²à¸¢ function (rpc_grants probe à¹ƒà¸™ JSON) â€” à¸ˆà¸¸à¸”à¸—à¸µà¹ˆà¸•à¹‰à¸­à¸‡à¹€à¸Šà¹‡à¸„à¸Šà¸™à¸´à¸”à¸žà¸´à¹€à¸¨à¸©: driver_* / set_menu_schedule / publish_menu_schedule à¸„à¸§à¸£à¸ˆà¸³à¸à¸±à¸” admin
- Search path à¸‚à¸­à¸‡à¹à¸•à¹ˆà¸¥à¸° function = NOT VERIFIED (à¸•à¹‰à¸­à¸‡ dump proconfig)


