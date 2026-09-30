# BMB_02_RLS_PRODUCTION_AUDIT.md
**Read-only RLS/GRANT reality (production)** Â· Evidence: `e2e/prod-phase2-audit.json â†’ rls/policies/policy_exprs/table_grants`

## à¸œà¸¥à¸ˆà¸²à¸ catalog à¸ˆà¸£à¸´à¸‡

- **RLS ON à¸—à¸¸à¸à¸•à¸²à¸£à¸²à¸‡** (à¹„à¸¡à¹ˆà¸¡à¸µ relrowsecurity=false)
- Pattern à¸«à¸¥à¸±à¸à¸‚à¸­à¸‡ policies: `is_admin()` (SECURITY DEFINER helper) + `auth.uid()` ownership + deny-by-false placeholders

## Access matrix à¸—à¸µà¹ˆà¸¢à¸·à¸™à¸¢à¸±à¸™à¸ˆà¸²à¸ policy expression à¸ˆà¸£à¸´à¸‡

| Resource | anon | authenticated | service_role |
|---|---|---|---|
| orders SELECT | à¹€à¸‰à¸žà¸²à¸° status âˆˆ {delivered, cancelled} (orders_anon_read) | own (customer_ref=auth.uid()) à¸«à¸£à¸·à¸­ is_admin() | full (grant) |
| orders INSERT | none | check(customer_ref = auth.uid()) | full |
| orders UPDATE | none | **using=false (block à¸—à¸¸à¸à¸à¸£à¸“à¸µ â€” à¸•à¹‰à¸­à¸‡à¸œà¹ˆà¸²à¸™ RPC)** | full |
| orders DELETE | none | none (à¹€à¸‰à¸žà¸²à¸° is_admin() à¸œà¹ˆà¸²à¸™ orders_admin_manage) | full |
| payment_intents | using=false (deny) | own + own_create (à¸œà¹ˆà¸²à¸™ order_numberâ†’orders.customer_ref) | full |
| business_settings | using=false | SELECT=true (à¸­à¹ˆà¸²à¸™à¹„à¸”à¹‰) Â· write à¹€à¸‰à¸žà¸²à¸° is_admin() | full |
| customers | using=false | own read + is_admin() manage | full |
| products | SELECT à¹€à¸¡à¸·à¹ˆà¸­ is_available=true | admin manage | full |
| recipes | **SELECT=true (anon à¸­à¹ˆà¸²à¸™à¸ªà¸¹à¸•à¸£à¹„à¸”à¹‰à¸—à¸±à¹‰à¸‡à¸«à¸¡à¸” â€” by design à¹à¸•à¹ˆ mission à¸—à¹‰à¸²à¸—à¸²à¸¢à¸ˆà¸¸à¸”à¸™à¸µà¹‰)** | admin manage | full |
| delivery_rounds | SELECT à¹€à¸¡à¸·à¹ˆà¸­ status='active' | admin manage | full |
| drivers | deny | SELECT=true (à¸­à¹ˆà¸²à¸™à¹„à¸”à¹‰à¸—à¸¸à¸à¸„à¸™ login) Â· write is_admin() | full |
| public_profiles (view) | â€” | SELECT à¹€à¸—à¹ˆà¸²à¸™à¸±à¹‰à¸™ | full |

## Grants (à¸œà¸¥ table_grants)

- **anon write residue = 0** (anon à¹„à¸¡à¹ˆà¸¡à¸µ INSERT/UPDATE/DELETE à¸šà¸™à¸•à¸²à¸£à¸²à¸‡à¹ƒà¸” â€” à¸•à¸£à¸‡à¹€à¸›à¹‰à¸² 033)
- service_role = full CRUD à¸„à¸£à¸š (service_role_missing=0)
- authenticated à¹„à¸”à¹‰ grant CRUD à¸à¸§à¹‰à¸²à¸‡à¹ƒà¸™à¸«à¸¥à¸²à¸¢à¸•à¸²à¸£à¸²à¸‡ (customers, recipes, drivers, ai_*, delivery_assignments, provider_orders, system_errors...) â€” **à¸„à¸§à¸²à¸¡à¸›à¸¥à¸­à¸”à¸ à¸±à¸¢à¸ˆà¸£à¸´à¸‡à¸žà¸¶à¹ˆà¸‡ policy expressions à¹„à¸¡à¹ˆà¹ƒà¸Šà¹ˆ grant narrowing** â€” policy à¸‚à¹‰à¸²à¸‡à¸šà¸™à¸ˆà¸³à¸à¸±à¸”à¹„à¸”à¹‰à¸ˆà¸£à¸´à¸‡à¹€à¸žà¸µà¸¢à¸‡à¸žà¸­à¸ªà¸³à¸«à¸£à¸±à¸šà¸«à¸¥à¸²à¸¢à¸•à¸²à¸£à¸²à¸‡ à¹à¸•à¹ˆà¸•à¸²à¸£à¸²à¸‡à¸—à¸µà¹ˆ policy = "authenticated ALL is_admin()" + grant à¸à¸§à¹‰à¸²à¸‡ à¸œà¸¥à¸¥à¸±à¸žà¸˜à¹Œà¸à¹‡à¸›à¸¥à¸­à¸”à¸ à¸±à¸¢à¹€à¸žà¸£à¸²à¸° policy à¸à¸£à¸­à¸‡ à¸­à¸¢à¹ˆà¸²à¸‡à¹„à¸£à¸à¹‡à¸•à¸²à¸¡à¸•à¸²à¸£à¸²à¸‡à¸—à¸µà¹ˆ policy à¸£à¸¹à¸›à¹à¸šà¸š `auth_read using=true` (à¹€à¸Šà¹ˆà¸™ drivers) = authenticated à¸—à¸¸à¸à¸„à¸™à¸­à¹ˆà¸²à¸™à¹„à¸”à¹‰à¸—à¸±à¹‰à¸‡à¸•à¸²à¸£à¸²à¸‡ (à¸£à¸§à¸¡à¹€à¸šà¸­à¸£à¹Œà¹‚à¸—à¸£à¹„à¸£à¹€à¸”à¸­à¸£à¹Œ) â€” **MEDIUM finding**

## Anon runtime probe

- anon_orders_read = 17 rows à¹ƒà¸™ table â€” à¹à¸•à¹ˆ policy à¸à¸£à¸­à¸‡à¸”à¹‰à¸§à¸¢ status (delivered/cancelled) â†’ anon à¹€à¸«à¹‡à¸™à¹€à¸‰à¸žà¸²à¸° delivered/cancelled (à¸›à¹‰à¸­à¸‡à¸à¸±à¸™à¸‚à¹‰à¸­à¸¡à¸¹à¸¥ live) â€” à¸ˆà¸£à¸´à¸‡à¸«à¸£à¸·à¸­à¹„à¸¡à¹ˆà¸•à¹‰à¸­à¸‡ live-test (Phase 9: NOT VERIFIED)

## Cross-customer access

- orders/payment_intents à¸¡à¸µ ownership predicate à¸ˆà¸£à¸´à¸‡ (`customer_ref = auth.uid()`) à¸—à¸µà¹ˆà¸£à¸°à¸”à¸±à¸š policy â€” **live cross-user test = NOT VERIFIED (Phase 9)**
