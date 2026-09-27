# BMB_W3C_HANDOFF.md
**Wave 3-C — Omnichannel · วันที่: 2026-09-27 · CORE = PASS / F-14 = RESOLVED (CORE) · HARD STOP**

## Production State
- Supabase: canonical intake RPCs (`create_order_with_items`, `create_pre_order_with_items`)
  + RLS deny-by-default สำหรับ direct DB insert (runtime: 403/401) + automation-worker (W3-B)
  + ai-proxy (W3-A) + **identity foundation (migrations 046/047 — อัปเดต 2026-09-27)**
- Cloudflare production = build จาก `84fbd75` (ไม่แตะ src/ — ไม่ต้อง redeploy)

## Implementation (งาน W3-C)
- **ไม่ implement channel integration ใหม่** — สิ่งที่ต้องสร้างล้วนติด F-14 schema dependency
  (ตอนนั้น) → ทำ audit + probe ตามความจริง ไม่ invent schema
- probe `e2e/w3cIntakeProbe.cjs` + evidence `e2e/w3c-omnichannel-e2e.json`

## Runtime Verification (TEST DATA ONLY)
- **PASS 12/12**: PWA intake ✓ · MANUAL (admin) intake ✓ · PRE-ORDER intake (mode-gated) ✓ ·
  direct DB insert denied (403 RLS / 401 anon) ✓ · duplicate transition idempotent ✓ ·
  invalid payload rejected ✓ · duplicate order creation = 2 orders (CURRENT behavior ตอนนั้น —
  แก้แล้วด้วย F-14 duplicate guard, ดู BMB_F14_HANDOFF.md) · automation handoff once ✓

## Tests / Security
- tsc 0 · vitest 22 files / 179 tests (canonical suite) · build ✓ · lint 0 · secret scan CLEAN

## F-14 Status
- **F-14 = RESOLVED (CORE) — 2026-09-27** — migrations 043/044/045 + E2E 16/16
  (`e2e/f14-channel-intake-e2e.json`) · ดู `BMB_F14_HANDOFF.md` และ
  `BMB_F14_OMNICHANNEL_SCHEMA_EVIDENCE.md`
- **IDENTITY FOUNDATION = PASS (2026-09-27)** — migrations 046/047 + E2E 19/19
  (`e2e/identity-foundation-e2e.json`) · ดู `BMB_CHANNEL_IDENTITY_FOUNDATION_EVIDENCE.md`
- คง BLOCKED: production webhook integration (ต้องมี webhook signature verification + รอ Owner เปิด)

## GAP / READY / BLOCKED
- READY: PWA channel · MANUAL channel · canonical intake + Order Hub + mode gate ·
  automation handoff · F-14 channel intake schema · identity foundation
- production webhook: channel-webhook EF = IMPLEMENTED + DEPLOYED + RUNTIME VERIFIED (foundation) · CONNECTED = BLOCKED (รอ Owner Meta config — BMB_W3C_EXTERNAL_EVIDENCE.md §10)
- NOT IMPLEMENTED: LINE/TikTok/Google/QR/Direct (ไม่มี Owner requirement)

## Final Gate (แยก verdict)
```
W3-C CORE = PASS · F-14 = RESOLVED (CORE) · IDENTITY FOUNDATION = PASS
PWA = PASS · MANUAL = PASS
FACEBOOK / FACEBOOK_GROUP / MESSENGER = SCHEMA INTAKE PASS (canonical contract)
  — production webhook integration ยังไม่เปิด
LINE / TikTok / Google / QR / Direct = NOT IMPLEMENTED
Security = PASS · E2E = PASS (12/12 + F-14 16/16 + Identity 19/19) · Quality Gate = PASS
```

## Next Step
**HARD STOP — รอคำสั่ง Owner**
(ประเด็นรอตัดสิน: เปิด W3-C-EXTERNAL Facebook/Messenger adapters เมื่อพร้อม → แล้ว W3-D Notifications)