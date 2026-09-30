# BMB_02_EDGE_FUNCTION_PRODUCTION_AUDIT.md
**Edge Functions deployed à¸ˆà¸£à¸´à¸‡ (Management API GET /functions)** Â· Evidence: `e2e/prod-phase2-audit.json â†’ edge_functions`

## Deployed à¸ˆà¸£à¸´à¸‡à¸šà¸™ production: 4/14

| Function | Status | Version | verify_jwt | Caller (à¸ˆà¸²à¸ code) |
|---|---|---|---|---|
| create-checkout | ACTIVE | 33 | true | paymentGateway.ts:66 |
| stripe-webhook | ACTIVE | 41 | false (à¸–à¸¹à¸à¸•à¹‰à¸­à¸‡) | Stripe (external) |
| stripe-refund | ACTIVE | 3 | true | bmbAdminApi_orders.ts:264 |
| phone-auto-login | ACTIVE | 1 | false | UNKNOWN à¹ƒà¸™ repo scan (à¸¡à¸µà¹ƒà¸™ lib? à¸¢à¸±à¸‡ trace à¹„à¸¡à¹ˆà¸„à¸£à¸š) |

## à¹ƒà¸™ repo à¹à¸•à¹ˆà¹„à¸¡à¹ˆ deploy: 10 à¸•à¸±à¸§ â†’ DORMANT

ai-proxy, ai-daily-report, daily-report, generate-rewards, inventory-reorder, random-menu-draw, track-share, vote-menu, + (à¸•à¸£à¸§à¸ˆà¸‹à¹‰à¸³à¸£à¸§à¸¡à¸Šà¸·à¹ˆà¸­à¸—à¸µà¹ˆà¹€à¸«à¸¥à¸·à¸­à¹ƒà¸™ repo 14 à¸¥à¸š 4 = ai-proxy, ai-daily-report, daily-report, generate-rewards, inventory-reorder, random-menu-draw, track-share, vote-menu = 8 â†’ à¸£à¸§à¸¡ caller-found none)

**à¸œà¸¥à¸ªà¸£à¸¸à¸›à¸ªà¸³à¸„à¸±à¸:** `ai-proxy` **à¹„à¸¡à¹ˆà¹„à¸”à¹‰ deploy** à¹à¸•à¹ˆ `aiService.ts` à¹€à¸£à¸µà¸¢à¸à¸¡à¸±à¸™ (aiService.ts:53) â†’ **Bite AI chat à¸šà¸™ production = BROKEN à¸ˆà¸™à¸à¸§à¹ˆà¸²à¸ˆà¸° deploy à¸«à¸£à¸·à¸­à¸¡à¸µ caller à¸—à¸²à¸‡à¸­à¸·à¹ˆà¸™** (CONTRADICTION à¸à¸±à¸š README "SEC-02 verified" à¸‹à¸¶à¹ˆà¸‡ verify à¹à¸„à¹ˆ client-side key à¹„à¸¡à¹ˆ verify deployment) â€” à¸•à¹‰à¸­à¸‡ live-test à¸¢à¸·à¸™à¸¢à¸±à¸™ (Phase 3/9)

## Cron / external caller

- à¹„à¸¡à¹ˆà¸žà¸š scheduled jobs / Make.com / external webhook config à¹ƒà¸™ repo à¹à¸¥à¸°à¹„à¸¡à¹ˆà¸¡à¸µ tooling à¸•à¸£à¸§à¸ˆ cron à¹ƒà¸™ phase à¸™à¸µà¹‰ â†’ NOT VERIFIED
- stripe-webhook = external ACTIVE (Stripe à¹€à¸£à¸µà¸¢à¸à¹€à¸‚à¹‰à¸²) â€” evidence: PI completed/refunded rows à¸ˆà¸£à¸´à¸‡à¹ƒà¸™ production


