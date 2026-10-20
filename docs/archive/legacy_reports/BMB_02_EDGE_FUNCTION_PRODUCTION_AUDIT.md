# BMB_02_EDGE_FUNCTION_PRODUCTION_AUDIT.md
**Edge Functions deployed จริง (Management API GET /functions)** · Evidence: `e2e/prod-phase2-audit.json → edge_functions`

## Deployed จริงบน production: 4/14

| Function | Status | Version | verify_jwt | Caller (จาก code) |
|---|---|---|---|---|
| create-checkout | ACTIVE | 33 | true | paymentGateway.ts:66 |
| stripe-webhook | ACTIVE | 41 | false (ถูกต้อง) | Stripe (external) |
| stripe-refund | ACTIVE | 3 | true | bmbAdminApi_orders.ts:264 |
| phone-auto-login | ACTIVE | 1 | false | UNKNOWN ใน repo scan (มีใน lib? ยัง trace ไม่ครบ) |

## ใน repo แต่ไม่ deploy: 10 ตัว → DORMANT

ai-proxy, ai-daily-report, daily-report, generate-rewards, inventory-reorder, random-menu-draw, track-share, vote-menu, + (ตรวจซ้ำรวมชื่อที่เหลือใน repo 14 ลบ 4 = ai-proxy, ai-daily-report, daily-report, generate-rewards, inventory-reorder, random-menu-draw, track-share, vote-menu = 8 → รวม caller-found none)

**ผลสรุปสำคัญ:** `ai-proxy` **ไม่ได้ deploy** แต่ `aiService.ts` เรียกมัน (aiService.ts:53) → **Bite AI chat บน production = BROKEN จนกว่าจะ deploy หรือมี caller ทางอื่น** (CONTRADICTION กับ README "SEC-02 verified" ซึ่ง verify แค่ client-side key ไม่ verify deployment) — ต้อง live-test ยืนยัน (Phase 3/9)

## Cron / external caller

- ไม่พบ scheduled jobs / Make.com / external webhook config ใน repo และไม่มี tooling ตรวจ cron ใน phase นี้ → NOT VERIFIED
- stripe-webhook = external ACTIVE (Stripe เรียกเข้า) — evidence: PI completed/refunded rows จริงใน production


