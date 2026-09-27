# BMB_02_MIGRATION_DRIFT.md
**Read-only comparison: repo migrations (39) vs production `supabase_migrations.schema_migrations` + live catalog probes**
**Evidence:** `e2e/prod-phase2-audit.json` (2026-09-27)

## Migration history

- LOCAL: 39 files (001â€“039) in `supabase/migrations/`
- REMOTE: 39 recorded versions, 001â†’039 à¸•à¸£à¸‡à¸¥à¸³à¸”à¸±à¸šà¸Šà¸·à¹ˆà¸­
- LOCAL ONLY: none Â· PRODUCTION ONLY (stale history rows): none

## Object-level drift

| à¸›à¸£à¸°à¹€à¸ à¸— | à¸œà¸¥à¸à¸²à¸£à¸•à¸£à¸§à¸ˆ |
|---|---|
| Tables | 35 à¸•à¸²à¸£à¸²à¸‡ public â€” à¹„à¸¡à¹ˆà¸žà¸š table à¸—à¸µà¹ˆà¹„à¸¡à¹ˆà¸¡à¸µà¸—à¸µà¹ˆà¸¡à¸² (à¸—à¸±à¹‰à¸‡à¸«à¸¡à¸”à¸ªà¸­à¸”à¸„à¸¥à¹‰à¸­à¸‡à¸à¸±à¸šà¸Šà¸¸à¸” migration 019/020/021/022/039 à¸¯à¸¥à¸¯) â€” à¸¢à¸±à¸‡à¹„à¸¡à¹ˆà¹„à¸”à¹‰ diff body-by-body |
| Enums | order_mode/order_status/payment_status/payment_method/delivery_method/round_period/ingredient_status â€” à¸•à¸£à¸‡à¸à¸±à¸šà¸—à¸µà¹ˆ migrations à¸à¸³à¸«à¸™à¸” |
| Triggers | à¸¡à¸µ order/status/payment/round/menu triggers (trigger list à¹ƒà¸™ JSON) â€” à¸•à¸£à¸‡à¸à¸±à¸š design 007/008/030/038/039 |
| Functions | 103 functions â€” probe keyword-level à¸¢à¸·à¸™à¸¢à¸±à¸™ create_order_with_items/enforce_pre_order_window/ensure_rounds_for_date à¸¡à¸µ cutoff/capacity logic à¸ˆà¸£à¸´à¸‡ |
| Views | public_profiles (view) â€” write path à¸›à¸´à¸” (grant: authenticated SELECT à¹€à¸—à¹ˆà¸²à¸™à¸±à¹‰à¸™) |
| Extensions | probe à¸¡à¸µà¹ƒà¸™ JSON (à¹€à¸Šà¹ˆà¸™ pg_trgm â€” à¹€à¸«à¹‡à¸™ gin_trgm functions) |

## à¸ªà¸£à¸¸à¸›

**à¹„à¸¡à¹ˆà¸žà¸š migration drift à¸£à¸°à¸”à¸±à¸šà¸Šà¸¸à¸”** (39/39 à¸•à¸£à¸‡à¸à¸±à¸™) â€” drift à¸ˆà¸£à¸´à¸‡à¸—à¸µà¹ˆà¸žà¸šà¸„à¸·à¸­à¸£à¸°à¸”à¸±à¸š **deployment surface**: Edge Functions (4/14) à¹à¸¥à¸°à¸£à¸°à¸”à¸±à¸š **code-vs-doc** (README stale 34/34)
**NOT VERIFIED:** body-level equality à¸‚à¸­à¸‡ functions à¸à¸±à¸š SQL à¹ƒà¸™ migration files (à¸•à¹‰à¸­à¸‡ dump + diff â€” à¹à¸™à¸°à¸™à¸³à¹€à¸›à¹‡à¸™à¸‡à¸²à¸™à¸–à¸±à¸”à¹„à¸›à¸–à¹‰à¸²à¸•à¹‰à¸­à¸‡à¸à¸²à¸£à¸„à¸§à¸²à¸¡à¹à¸™à¹ˆà¸™à¸­à¸™ 100%)


