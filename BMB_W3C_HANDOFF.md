# BMB_W3C_HANDOFF.md
**Wave 3-C — Omnichannel · วันที่: 2026-09-27 · CORE = PASS / F-14 = BLOCKED · HARD STOP**

## Production State
- Supabase: canonical intake RPCs (`create_order_with_items`, `create_pre_order_with_items`)
  + RLS deny-by-default สำหรับ direct DB insert (runtime: 403/401) + automation-worker (W3-B)
  + ai-proxy (W3-A) · ไม่มี schema migration ใหม่ใน W3-C
- Cloudflare production = build จาก `84fbd75` (W3-C ไม่แตะ src/ → ไม่ต้อง redeploy)

## Implementation (งานนี้)
- **ไม่ implement อะไรใหม่** นอก scope: audit พบว่าสิ่งที่ต้องสร้าง (FB/FB-Group/Messenger
  ingestion) ล้วนติด **F-14 schema dependency** → หยุดตามกติกา ไม่ invent schema/migration
- สร้าง runtime probe `e2e/w3cIntakeProbe.cjs` + evidence `e2e/w3c-omnichannel-e2e.json`

## Runtime Verification
- Production E2E **12/12** (TEST DATA ONLY): PWA intake ✓ · MANUAL (admin) intake ✓ ·
  PRE-ORDER intake (mode-gated) ✓ · direct DB insert denied (403 RLS / 401 anon) ✓ ·
  duplicate transition idempotent ✓ · invalid payload rejected ✓ · duplicate order creation
  = 2 orders (CURRENT behavior — F-14 GAP, documented) · automation handoff once ✓

## Tests / Security
- tsc 0 · vitest 44 files/358 · build ✓ · lint 0 · git/dist/runtime secret scan 0 hits ·
  RLS/ACL ไม่ถูกแตะ (no unrelated regression)

## F-14 Status = BLOCKED — EXACT SCHEMA CHANGE REQUIRED (รอ Owner Gate)
- TABLE: orders
- COLUMN: `source_channel text NOT NULL DEFAULT 'PWA'` · `external_ref_id text NULL`
- CONSTRAINT/INDEX: UNIQUE (source_channel, external_ref_id) WHERE external_ref_id IS NOT NULL
- RPC IMPACT: create_order_with_items + optional p_source_channel/p_external_ref_id (additive)
- RLS IMPACT: ไม่มี · BACKFILL: default ตาม policy ที่ Owner เลือก (PWA vs MANUAL)
- SECURITY IMPACT: unique index = durable duplicate guard; adapter ต้องมี webhook signature verify
- TEST IMPACT: เพิ่ม duplicate-event tests ต่อยอด w3c probe
- ต้องตัดสินเพิ่ม: IDENTITY GAP (external identity mapping table) — Owner decision

## GAP / READY / BLOCKED
- READY: PWA channel · MANUAL channel · canonical intake + Order Hub + mode gate ·
  automation handoff (รายละเอียดใน BMB_W3C_OMNICHANNEL_EVIDENCE.md)
- BLOCKED: F-14 migration · FB/FB-Group/Messenger ingestion · external identity model
- NOT IMPLEMENTED: LINE/TikTok/Google/QR/Direct (ไม่มี Owner requirement)

## Final Gate (แยก verdict)
```
W3-C CORE = PASS · F-14 = BLOCKED · PWA = PASS · MANUAL = PASS
FACEBOOK / FACEBOOK_GROUP / MESSENGER = NOT IMPLEMENTED (F-14 BLOCKED)
LINE/TikTok/Google/QR/Direct = NOT IMPLEMENTED
Security = PASS · E2E = PASS (12/12) · Quality Gate = PASS
```

## Commit / Deployment
- Commit: w3c evidence + probe (ดู git log) · push origin/main · HEAD == origin/main · worktree CLEAN
- ไม่มี Edge Function deploy ใหม่ (ไม่มี code ฝั่ง server ที่แตะ production functions)

## Next Step
**HARD STOP** — รอคำสั่ง Owner ก่อน W3-D Notifications
(ประเด็นรอตัดสิน: อนุมัติ F-14 migration? เลือก backfill policy? identity mapping design?)
