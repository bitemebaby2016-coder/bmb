# BMB_W3C_HANDOFF.md
**Wave 3-C â€” Omnichannel Â· à¸§à¸±à¸™à¸—à¸µà¹ˆ: 2026-09-27 Â· CORE = PASS / F-14 = RESOLVED (CORE) Â· HARD STOP**

## Production State
- Supabase: canonical intake RPCs (`create_order_with_items`, `create_pre_order_with_items`)
  + RLS deny-by-default à¸ªà¸³à¸«à¸£à¸±à¸š direct DB insert (runtime: 403/401) + automation-worker (W3-B)
  + ai-proxy (W3-A) Â· à¹„à¸¡à¹ˆà¸¡à¸µ schema migration à¹ƒà¸«à¸¡à¹ˆà¹ƒà¸™ W3-C
- Cloudflare production = build à¸ˆà¸²à¸ `84fbd75` (W3-C à¹„à¸¡à¹ˆà¹à¸•à¸° src/ â†’ à¹„à¸¡à¹ˆà¸•à¹‰à¸­à¸‡ redeploy)

## Implementation (à¸‡à¸²à¸™à¸™à¸µà¹‰)
- **à¹„à¸¡à¹ˆ implement à¸­à¸°à¹„à¸£à¹ƒà¸«à¸¡à¹ˆ** à¸™à¸­à¸ scope: audit à¸žà¸šà¸§à¹ˆà¸²à¸ªà¸´à¹ˆà¸‡à¸—à¸µà¹ˆà¸•à¹‰à¸­à¸‡à¸ªà¸£à¹‰à¸²à¸‡ (FB/FB-Group/Messenger
  ingestion) à¸¥à¹‰à¸§à¸™à¸•à¸´à¸” **F-14 schema dependency** â†’ à¸«à¸¢à¸¸à¸”à¸•à¸²à¸¡à¸à¸•à¸´à¸à¸² à¹„à¸¡à¹ˆ invent schema/migration
- à¸ªà¸£à¹‰à¸²à¸‡ runtime probe `e2e/w3cIntakeProbe.cjs` + evidence `e2e/w3c-omnichannel-e2e.json`

## Runtime Verification
- Production E2E **12/12** (TEST DATA ONLY): PWA intake âœ“ Â· MANUAL (admin) intake âœ“ Â·
  PRE-ORDER intake (mode-gated) âœ“ Â· direct DB insert denied (403 RLS / 401 anon) âœ“ Â·
  duplicate transition idempotent âœ“ Â· invalid payload rejected âœ“ Â· duplicate order creation
  = 2 orders (CURRENT behavior â€” F-14 GAP, documented) Â· automation handoff once âœ“

## Tests / Security
- tsc 0 Â· vitest 44 files/358 Â· build âœ“ Â· lint 0 Â· git/dist/runtime secret scan 0 hits Â·
  RLS/ACL à¹„à¸¡à¹ˆà¸–à¸¹à¸à¹à¸•à¸° (no unrelated regression)

## F-14 Status
- **F-14 = RESOLVED (CORE) â†’ RESOLVED (CORE) 2026-09-27** â€” Owner à¸­à¸™à¸¸à¸¡à¸±à¸•à¸´ F-14 â†’ migrations 043/044/045
  applied + E2E 16/16 (`e2e/f14-channel-intake-e2e.json`) Â· à¸”à¸¹ `BMB_F14_HANDOFF.md` à¹à¸¥à¸°
  `BMB_F14_OMNICHANNEL_SCHEMA_EVIDENCE.md`
- à¸„à¸‡ BLOCKED: identity table `customer_channel_identities` (à¸£à¸­ Owner) + production webhook
  integration (à¸•à¹‰à¸­à¸‡à¸¡à¸µ identity + webhook signature verification à¸à¹ˆà¸­à¸™)

## GAP / READY / BLOCKED
- READY: PWA channel Â· MANUAL channel Â· canonical intake + Order Hub + mode gate Â·
  automation handoff (à¸£à¸²à¸¢à¸¥à¸°à¹€à¸­à¸µà¸¢à¸”à¹ƒà¸™ BMB_W3C_OMNICHANNEL_EVIDENCE.md)
- BLOCKED: identity table customer_channel_identities (รอ Owner authorization) + FB/FB-Group/Messenger production webhook (รอ identity + webhook verification)
- NOT IMPLEMENTED: LINE/TikTok/Google/QR/Direct (à¹„à¸¡à¹ˆà¸¡à¸µ Owner requirement)

## Final Gate (à¹à¸¢à¸ verdict)
```
W3-C CORE = PASS Â· F-14 = RESOLVED (CORE) Â· PWA = PASS Â· MANUAL = PASS
FACEBOOK / FACEBOOK_GROUP / MESSENGER = SCHEMA INTAKE PASS (canonical contract) — production webhook ยังไม่เปิด
LINE/TikTok/Google/QR/Direct = NOT IMPLEMENTED
Security = PASS Â· E2E = PASS (12/12) Â· Quality Gate = PASS
```

## Commit / Deployment
- Commit: w3c evidence + probe (à¸”à¸¹ git log) Â· push origin/main Â· HEAD == origin/main Â· worktree CLEAN
- à¹„à¸¡à¹ˆà¸¡à¸µ Edge Function deploy à¹ƒà¸«à¸¡à¹ˆ (à¹„à¸¡à¹ˆà¸¡à¸µ code à¸à¸±à¹ˆà¸‡ server à¸—à¸µà¹ˆà¹à¸•à¸° production functions)

## Next Step
**HARD STOP** â€” à¸£à¸­à¸„à¸³à¸ªà¸±à¹ˆà¸‡ Owner à¸à¹ˆà¸­à¸™ W3-D Notifications
(à¸›à¸£à¸°à¹€à¸”à¹‡à¸™à¸£à¸­à¸•à¸±à¸”à¸ªà¸´à¸™: à¸­à¸™à¸¸à¸¡à¸±à¸•à¸´ F-14 migration? à¹€à¸¥à¸·à¸­à¸ backfill policy? identity mapping design?)
