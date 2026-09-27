# BMB_W3C_EXTERNAL_HANDOFF.md
**W3-C-EXTERNAL — Facebook + Messenger Adapters · วันที่: 2026-09-27 · IMPLEMENTED + DEPLOYED + RUNTIME VERIFIED (foundation) · CONNECTED = BLOCKED (รอ Owner Meta config) · HARD STOP**

## Production State
- Edge Functions (production `ivkdfognyiwjcmrhcnwz`): **channel-webhook** (ใหม่) + automation-worker
  + ai-proxy + create-checkout + stripe-webhook + stripe-refund + phone-auto-login
- Secrets ใหม่: `CHANNEL_WEBHOOK_APP_SECRET`, `CHANNEL_WEBHOOK_VERIFY_TOKEN` (test values —
  **เปลี่ยนเป็น Meta secret จริงเมื่อ Owner config ตาม checklist §10 ของ evidence**)
- Migrations 048/049: trusted channel intake (service path `p_customer_ref` เฉพาะ service_role)
  + single-signature repair (ลบ 16-param overload ที่ทำ PGRST203 ambiguous จริง)
- Cloudflare: ไม่เปลี่ยน (ไม่แตะ src/)

## Implementation
- `supabase/functions/channel-webhook/index.ts` — Meta webhook receiver:
  GET verification handshake · POST HMAC-SHA256 signature verify · payload validation ·
  channel derivation จาก explicit metadata (MESSENGER / FACEBOOK / FACEBOOK_GROUP — ไม่เดา) ·
  durable event dedupe (audit_logs) · identity resolution/provisioning ·
  **canonical order RPC** (ไม่มี direct INSERT) · audit trail · retry-safe
- probe `e2e/channelWebhookProbe.cjs` + evidence `e2e/channel-webhook-e2e.json`

## Runtime Verification (TEST DATA ONLY)
- **PASS 15/15** — verification ✓ signature (unsigned/bad-sig rejected) ✓ malformed/unsupported ✓
  unknown-origin rejected ✓ MESSENGER order → canonical order (BMB-20260927-543) + row tagged
  (source_channel=MESSENGER, external_ref_id) ✓ duplicate → no new order (rows=1) ✓
  FACEBOOK/FACEBOOK_GROUP channel derivation ✓ parallel events → ONE order ✓ 0 secret leak ✓

## Status ตามคำสั่ง (แยก IMPLEMENTED→CONNECTED→DEPLOYED→RUNTIME VERIFIED)
```
Facebook  = IMPLEMENTED + DEPLOYED + RUNTIME VERIFIED (foundation) · CONNECTED = DEFERRED BY OWNER
Messenger = IMPLEMENTED + DEPLOYED + RUNTIME VERIFIED (foundation) · CONNECTED = DEFERRED BY OWNER
Facebook Group = foundation PASS · real integration DEFERRED BY OWNER
W3-D      = CORE PASS (2026-09-27 — ดู BMB_W3D_HANDOFF.md)
```

> **UPDATE 2026-09-27**: Owner ตัดสินใจ DEFER Meta real connectivity — สถานะเปลี่ยนจาก
> "BLOCKED (รอ Owner Meta config)" เป็น **"DEFERRED BY OWNER"** (ไม่ใช่ defect · ไม่ rollback ·
> ไม่ mark PASS) — งานเดินต่อที่ W3-D/W3-E ที่ไม่ขึ้นกับ Meta ตาม execution order

## Owner Action Required (production connectivity — ห้าม paste secrets ใน chat)
ตาม checklist §10 ของ BMB_W3C_EXTERNAL_EVIDENCE.md: Facebook App + Page + Meta APP_SECRET
(ผ่าน `supabase secrets set`) + webhook URL/verify token subscription + Page access token +
permissions → แล้ว rerun probe ด้วย secret จริง

## Tests / Regression
- F-05 12/12 · F-06 14/14 · F-18 15/15 · F-14 16/16 · Identity 19/19 · W3-A 11/11 ·
  W3-B 13/13 · W3-C Core 12/12 · tsc 0 · vitest 22/179 · build ✓ · lint 0 · secret scan CLEAN

## Next Step
**HARD STOP — รอคำสั่ง Owner** · เมื่อ Owner config Meta ครบ (§10) → rerun probe = CONNECTED →
จากนั้น W3-D Notifications ตาม execution order